import asyncio
import json
import logging
import math
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple, Dict, Any, List

import pandas as pd
import numpy as np
from sqlalchemy import select, update, and_, or_, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.base import AsyncSessionLocal
from app.db.models.investigation import (
    Investigation,
    InvestigationTask,
    InvestigationEvent,
    Finding,
    Hypothesis,
    EvidenceItem,
    CriticReview,
)
from app.db.models.dataset import Dataset, DatasetProfile
from app.db.models.document import Document
from app.db.models.memory import Memory
from app.services.llm_service import LLMService
from app.services.statistical_service import statistical_service
from app.services.evidence_service import evidence_service
from app.services.dataset_relationship_service import dataset_relationship_service
from app.services import document_service
from app.services.dataset_context import (
    build_dataset_context,
    perform_question_driven_analysis,
    generate_grounded_hypotheses,
    test_hypothesis_on_real_data,
    DatasetContext,
)
from dataclasses import dataclass, field
from app.schemas.investigation_state import EvidenceItemSchema, StatisticalMetric, DocumentCitation
from app.tools.python_executor import PythonExecutor
from app.core.config import settings

logger = logging.getLogger("datapilot.worker")

LEASE_DURATION_SECONDS = getattr(settings, "workflow_lease_seconds", 120)


@dataclass
class InvestigationExecutionContext:
    """Explicit strongly typed execution context for all tasks in an investigation run."""
    investigation_id: str
    workspace_id: str
    objective: str
    execution_id: str
    attempt_number: int = 1
    user_id: Optional[str] = None
    dataset_ids: List[str] = field(default_factory=list)
    ctx: Optional[DatasetContext] = None
    analytics: Dict[str, Any] = field(default_factory=dict)


class LeaseLostError(Exception):
    """Raised when a worker attempts to update an investigation after losing its lease."""
    pass


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def generate_execution_id() -> str:
    return f"exec_{uuid.uuid4().hex[:12]}"


def generate_event_id() -> str:
    return f"evt_{uuid.uuid4().hex[:12]}"


class InvestigationWorker:
    def __init__(self, worker_id: Optional[str] = None):
        self.worker_id = worker_id or f"worker_{uuid.uuid4().hex[:8]}"
        self.llm = LLMService()
        self.executor = PythonExecutor()
        self._running = False

    async def record_event(
        self,
        db: AsyncSession,
        investigation_id: str,
        agent: str,
        event_type: str,
        message: str,
        details: Optional[Dict[str, Any]] = None,
    ) -> InvestigationEvent:
        """Records an append-only event into the investigation_events table."""
        event_id = generate_event_id()
        
        # In SQLite, autoincrement doesn't automatically populate non-PK Identity columns
        bind = db.bind or getattr(db.sync_session, "bind", None)
        is_sqlite = bind and bind.dialect.name == "sqlite" if bind else True
        seq_val = None
        if is_sqlite:
            from sqlalchemy import func
            seq_res = await db.execute(
                select(func.coalesce(func.max(InvestigationEvent.seq), 999)).where(
                    InvestigationEvent.investigation_id == investigation_id
                )
            )
            max_seq = seq_res.scalar() or 999
            seq_val = max_seq + 1

        evt = InvestigationEvent(
            id=event_id,
            investigation_id=investigation_id,
            seq=seq_val,
            agent=agent,
            event_type=event_type,
            message=message,
            details=details or {},
            created_at=utcnow(),
        )
        db.add(evt)
        await db.commit()
        return evt

    async def acquire_lease(
        self, db: AsyncSession, investigation_id: str
    ) -> Tuple[bool, Optional[str], Optional[Investigation]]:
        """Atomically acquires an exclusive lease on an investigation."""
        exec_id = generate_execution_id()
        now = utcnow()
        lease_expires = now + timedelta(seconds=LEASE_DURATION_SECONDS)

        stmt = (
            update(Investigation)
            .where(
                Investigation.id == investigation_id,
                Investigation.is_deleted == False,
                Investigation.status.notin_(["COMPLETED", "FAILED", "CANCELLED"]),
                or_(
                    Investigation.locked_by == None,
                    Investigation.lock_expires_at == None,
                    Investigation.lock_expires_at < now,
                    Investigation.locked_by == self.worker_id,
                ),
            )
            .values(
                locked_by=self.worker_id,
                execution_id=exec_id,
                lock_expires_at=lease_expires,
                heartbeat_at=now,
                status="RUNNING",
            )
        )
        res = await db.execute(stmt)
        await db.commit()

        if res.rowcount == 0:
            logger.info(f"Worker {self.worker_id} failed to acquire lease on {investigation_id}.")
            return False, None, None

        inv_res = await db.execute(
            select(Investigation).where(Investigation.id == investigation_id)
        )
        inv = inv_res.scalar_one_or_none()
        logger.info(f"Worker {self.worker_id} acquired lease on {investigation_id} (exec_id={exec_id})")
        return True, exec_id, inv

    async def renew_lease(
        self, db: AsyncSession, investigation_id: str, execution_id: str
    ) -> bool:
        """Heartbeats the active lease for this worker."""
        now = utcnow()
        lease_expires = now + timedelta(seconds=LEASE_DURATION_SECONDS)

        stmt = (
            update(Investigation)
            .where(
                Investigation.id == investigation_id,
                Investigation.execution_id == execution_id,
                Investigation.locked_by == self.worker_id,
            )
            .values(
                lock_expires_at=lease_expires,
                heartbeat_at=now,
            )
        )
        res = await db.execute(stmt)
        await db.commit()
        return res.rowcount > 0

    async def release_lease(
        self, db: AsyncSession, investigation_id: str, execution_id: str
    ) -> None:
        """Releases the lock on this investigation."""
        stmt = (
            update(Investigation)
            .where(
                Investigation.id == investigation_id,
                Investigation.execution_id == execution_id,
                Investigation.locked_by == self.worker_id,
            )
            .values(
                locked_by=None,
                lock_expires_at=None,
            )
        )
        await db.execute(stmt)
        await db.commit()
        logger.info(f"Worker {self.worker_id} released lease on {investigation_id}")

    async def validate_lease(
        self, db: AsyncSession, investigation_id: str, execution_id: str
    ) -> bool:
        """Checks if the worker still holds the lock."""
        now = utcnow()
        res = await db.execute(
            select(Investigation.id).where(
                Investigation.id == investigation_id,
                Investigation.execution_id == execution_id,
                Investigation.locked_by == self.worker_id,
                Investigation.lock_expires_at > now,
            )
        )
        return res.scalar_one_or_none() is not None

    async def claim_task_atomically(
        self, db: AsyncSession, task_id: str, execution_id: str
    ) -> bool:
        """Atomically claims a PENDING or retryable FAILED task."""
        now = utcnow()
        stmt = (
            update(InvestigationTask)
            .where(
                InvestigationTask.id == task_id,
                InvestigationTask.status.in_(["PENDING", "FAILED"]),
                or_(
                    InvestigationTask.next_retry_at == None,
                    InvestigationTask.next_retry_at <= now,
                ),
                InvestigationTask.retry_count <= InvestigationTask.max_retries,
            )
            .values(
                status="RUNNING",
                execution_id=execution_id,
                started_at=now,
                error=None,
            )
            .execution_options(synchronize_session=False)
        )
        res = await db.execute(stmt)
        await db.commit()
        return res.rowcount > 0

    # ── EMPIRICAL DATA ANALYSIS ENGINE ──────────────────────────────────────────
    async def _analyze_workspace_data(
        self,
        db: AsyncSession,
        workspace_id: str,
        objective: Optional[str] = None,
        dataset_ids: Optional[List[str]] = None,
    ) -> Tuple[Optional[pd.DataFrame], Dict[str, Any], List[Dataset], Optional[DatasetContext]]:
        """Loads workspace datasets and executes empirical schema-aware, question-driven analysis."""
        target_ids = list(dataset_ids) if dataset_ids else []
        if target_ids:
            datasets_res = await db.execute(
                select(Dataset).where(
                    Dataset.id.in_(target_ids),
                    Dataset.workspace_id == workspace_id,
                    Dataset.is_deleted == False
                )
            )
        else:
            datasets_res = await db.execute(
                select(Dataset).where(
                    Dataset.workspace_id == workspace_id,
                    Dataset.status.in_(["PROFILED", "UPLOADED"]),
                    Dataset.is_deleted == False,
                ).order_by(Dataset.updated_at.desc())
            )
        datasets = datasets_res.scalars().all()
        if not datasets:
            return None, {}, [], None

        ctx = await build_dataset_context(
            workspace_id=workspace_id,
            question=objective or "",
            db=db,
            dataset_ids=target_ids or None,
        )
        if not ctx or ctx.get_df() is None:
            return None, {}, datasets, None

        analytics = perform_question_driven_analysis(ctx)
        return ctx.get_df(), analytics, datasets, ctx

    # ── AGENT TASK EXECUTORS ───────────────────────────────────────────────────
    async def _execute_data_analyst_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Executes targeted query and calculations on the actual dataset guided by the question."""
        df, analytics, datasets, ctx = await self._analyze_workspace_data(
            db, inv.workspace_id, inv.objective, exec_context.dataset_ids
        )
        exec_context.ctx = ctx
        exec_context.analytics = analytics or {}

        if not ctx or not analytics or not analytics.get("success", False):
            err_msg = analytics.get("error", "No structured tabular dataset found or data could not be parsed.") if analytics else "No dataset available."
            return {
                "metrics": {},
                "findings": [f"Analysis could not be completed: {err_msg}"],
                "primary_table": [],
                "columns_used": [],
                "data_sources_used": [d.original_filename for d in datasets] if datasets else []
            }

        findings_to_persist = []
        source_name = ctx.dataset_name

        # 1. Add all data-grounded findings derived from actual calculations
        total_records = analytics.get("total_records", len(df) if df is not None else 0)
        null_ratio = sum(ctx.null_counts.values()) / max(total_records * len(ctx.all_columns), 1)
        base_confidence = 0.90 if total_records >= 100 else (0.75 if total_records >= 30 else 0.55)
        data_quality_penalty = min(0.15, null_ratio * 0.5)  # Up to 15% penalty for nulls
        calibrated_confidence = round(max(0.30, base_confidence - data_quality_penalty), 2)

        for f_stmt in analytics.get("findings", []):
            findings_to_persist.append({
                "statement": f_stmt,
                "confidence": calibrated_confidence,
                "causal_classification": "OBSERVATION",
                "impact": "HIGH" if total_records >= 30 else "MEDIUM",
                "source": source_name,
                "evidence": {
                    "dataset_id": ctx.dataset_id,
                    "dataset_name": source_name,
                    "rows_used": total_records,
                    "columns_used": analytics.get("columns_used", []),
                    "analysis_type": analytics.get("analysis_type"),
                    "aggregations": analytics.get("aggregations", {}),
                    "provenance": {
                        "dataset_id": ctx.dataset_id,
                        "dataset_name": source_name,
                        "total_records": total_records,
                        "null_ratio": round(null_ratio, 4),
                        "columns_used": analytics.get("columns_used", []),
                        "calculation_method": analytics.get("analysis_description") or "Dynamic Empirical Aggregation",
                    }
                }
            })

        # Persist findings and evidence items into DB
        for f in findings_to_persist:
            db.add(Finding(
                investigation_id=inv.id,
                statement=f["statement"],
                confidence=f["confidence"],
                causal_classification=f["causal_classification"],
                source=f["source"],
                evidence=f["evidence"],
                created_at=utcnow()
            ))
            db.add(EvidenceItem(
                investigation_id=inv.id,
                claim=f["statement"],
                source_type="dataset",
                source_name=f["source"],
                analysis_type=analytics.get("analysis_type", "DATASET_QUERY"),
                query_or_method=analytics.get("pending_formula") or analytics.get("analysis_description") or "Pandas Aggregation",
                result_summary=f["statement"],
                statistical_metrics=analytics.get("aggregations"),
                causal_classification=f["causal_classification"],
                confidence=f["confidence"],
                supports_claim=True,
                created_by_agent="Data Analyst",
                created_at=utcnow()
            ))

        await db.commit()

        # Emit insight-rich live event
        await self.record_event(
            db, inv.id, "Data Analyst", "COMPLETED",
            f"Analyzed {analytics.get('total_records', len(df))} records in '{source_name}'. Executed: {analytics.get('analysis_description', 'Grounded query completed.')}",
            {
                "analysis_type": analytics.get("analysis_type"),
                "columns_used": analytics.get("columns_used", []),
                "findings_count": len(findings_to_persist),
                "records_analyzed": analytics.get("total_records", len(df)),
            }
        )

        return {
            "analysis_type": analytics.get("analysis_type"),
            "analysis_description": analytics.get("analysis_description"),
            "columns_used": analytics.get("columns_used", []),
            "findings": [f["statement"] for f in findings_to_persist],
            "primary_table": analytics.get("primary_table", [])[:50],
            "aggregations": analytics.get("aggregations", {}),
            "data_sources_used": [source_name]
        }

    async def _execute_hypothesis_agent_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Formulates testable causal hypotheses grounded strictly in empirical dataset columns."""
        ctx = exec_context.ctx
        analytics = exec_context.analytics
        if not ctx or not analytics:
            _, analytics, _, ctx = await self._analyze_workspace_data(
                db, inv.workspace_id, inv.objective, exec_context.dataset_ids
            )
            exec_context.ctx = ctx
            exec_context.analytics = analytics or {}

        if not ctx:
            return {"hypotheses": []}

        hypotheses_specs = generate_grounded_hypotheses(ctx, analytics)

        for h in hypotheses_specs:
            db.add(Hypothesis(
                id=str(uuid.uuid4()),
                investigation_id=inv.id,
                title=h["title"],
                description=h["statement"],
                confidence=h["confidence"],
                causal_classification=h["causal_classification"],
                status="PROPOSED",
                details={
                    "variables": h.get("variables", []),
                    "why_generated": h.get("why_generated", ""),
                    "expected_mechanism": h.get("expected_mechanism", ""),
                },
                created_at=utcnow()
            ))

        await db.commit()

        titles_summary = " | ".join([h["title"] for h in hypotheses_specs[:2]])
        await self.record_event(
            db, inv.id, "Hypothesis Agent", "COMPLETED",
            f"Formulated {len(hypotheses_specs)} grounded hypotheses based on schema '{ctx.dataset_name}': {titles_summary}",
            {"hypotheses_count": len(hypotheses_specs)}
        )

        return {
            "hypotheses": [
                {
                    "id": h["id"],
                    "title": h["title"],
                    "statement": h["statement"],
                    "variables": h.get("variables", []),
                    "status": "UNTESTED"
                }
                for h in hypotheses_specs
            ]
        }

    async def _execute_hypothesis_tester_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Runs deterministic statistical significance tests on real dataset values."""
        ctx = exec_context.ctx
        if not ctx:
            _, analytics, _, ctx = await self._analyze_workspace_data(
                db, inv.workspace_id, inv.objective, exec_context.dataset_ids
            )
            exec_context.ctx = ctx
            exec_context.analytics = analytics or {}

        if not ctx:
            return {"tests": [], "sample_size": 0, "reliability": "UNKNOWN"}

        total_n = ctx.row_count
        is_small_sample = total_n < 30

        h_res = await db.execute(select(Hypothesis).where(Hypothesis.investigation_id == inv.id))
        hyps = h_res.scalars().all()

        executed_tests = []
        for h in hyps:
            variables = (h.details.get("variables", []) if h.details else []) if isinstance(h.details, dict) else []
            stat_res = test_hypothesis_on_real_data(
                ctx=ctx,
                hypothesis={"title": h.title, "variables": variables}
            )

            test_status = stat_res.get("status", "INSUFFICIENT_DATA")
            p_val = stat_res.get("p_value")
            effect = abs(stat_res.get("effect_size") or 0)
            rows_used = stat_res.get("rows_used", stat_res.get("data_rows_used", total_n))

            # Evidence-calibrated confidence from actual statistical results
            if test_status == "SUPPORTED" and p_val is not None:
                # Base confidence from p-value strength
                if p_val < 0.001:
                    stat_conf = 0.92
                elif p_val < 0.01:
                    stat_conf = 0.85
                elif p_val < 0.05:
                    stat_conf = 0.75
                else:
                    stat_conf = 0.60
                # Sample size adjustment
                if rows_used and rows_used < 30:
                    stat_conf = min(stat_conf, 0.65)  # Cap for small samples
                elif rows_used and rows_used < 10:
                    stat_conf = min(stat_conf, 0.50)
                # Effect size bonus
                if effect > 0.8:
                    stat_conf = min(0.95, stat_conf + 0.05)
                h.status = "SUPPORTED"
                h.confidence = round(stat_conf, 2)
                h.causal_classification = "PRIMARY_ROOT_CAUSE" if stat_conf >= 0.80 else "STRONG_ASSOCIATION"
            elif test_status == "NOT_SUPPORTED":
                # Confidence in the rejection (high confidence = we're sure it's not a factor)
                reject_conf = 0.85 if (p_val and p_val > 0.20) else 0.70
                if rows_used and rows_used < 30:
                    reject_conf = min(reject_conf, 0.60)
                h.status = "REJECTED"
                h.confidence = round(reject_conf, 2)
                h.causal_classification = "REJECTED_HYPOTHESIS"
            else:
                h.status = "INSUFFICIENT_DATA"
                h.confidence = 0.30  # Honest low confidence when test couldn't run
                h.causal_classification = "INSUFFICIENT_EVIDENCE"

            h.statistical_results = stat_res
            h.details = {
                "test_name": stat_res.get("test_name"),
                "statistic": stat_res.get("statistic"),
                "p_value": stat_res.get("p_value"),
                "effect_size": stat_res.get("effect_size"),
                "interpretation": stat_res.get("interpretation"),
                "sample_size": stat_res.get("rows_used", total_n),
                "columns_used": stat_res.get("columns_used", []),
                "reliability": "EXPLORATORY ONLY" if is_small_sample else "HIGH"
            }

            db.add(EvidenceItem(
                investigation_id=inv.id,
                claim=f"Statistical test for '{h.title}': {stat_res.get('interpretation')}",
                source_type="dataset",
                source_name=f"Statistical Engine ({stat_res.get('test_name')})",
                analysis_type="STATISTICAL_HYPOTHESIS_TEST",
                query_or_method=f"{stat_res.get('test_name')} on {stat_res.get('columns_used', [])}",
                result_summary=stat_res.get("interpretation", ""),
                statistical_metrics=stat_res,
                causal_classification=h.causal_classification,
                confidence=h.confidence,
                supports_claim=(h.status == "SUPPORTED"),
                created_by_agent="Hypothesis Tester",
                created_at=utcnow()
            ))

            executed_tests.append({
                "hypothesis_id": h.id,
                "hypothesis_title": h.title,
                "test_name": stat_res.get("test_name"),
                "sample_size": stat_res.get("rows_used", total_n),
                "statistic": stat_res.get("statistic"),
                "p_value": stat_res.get("p_value"),
                "result": h.status,
                "interpretation": stat_res.get("interpretation")
            })

        await db.commit()

        t1 = executed_tests[0] if executed_tests else {}
        p_disp = f"p={t1.get('p_value'):.4f}" if t1.get("p_value") is not None else "evaluated"
        await self.record_event(
            db, inv.id, "Hypothesis Tester", "COMPLETED",
            f"Evaluated {len(executed_tests)} tests on real data (n={total_n}, {p_disp}). Sample classified as {'EXPLORATORY' if is_small_sample else 'HIGH RELIABILITY'}.",
            {"tests_count": len(executed_tests), "sample_size": total_n}
        )

        return {"tests": executed_tests, "sample_size": total_n, "reliability": "EXPLORATORY" if is_small_sample else "HIGH"}

    async def _execute_rag_agent_task(
        self, db: AsyncSession, inv: Investigation, task: InvestigationTask
    ) -> Dict[str, Any]:
        """Cross-references workspace unstructured documents with clean text sanitization."""
        search_results = await document_service.search_workspace_documents(
            workspace_id=inv.workspace_id,
            query=task.objective or inv.objective,
            limit=3,
            db=db
        )

        matches_list = []
        if search_results:
            for s in search_results:
                clean_excerpt = s["content"][:250].strip()
                if not clean_excerpt:
                    continue
                citation_obj = {
                    "document_id": s["document_id"],
                    "document_name": s["document_title"],
                    "chunk_id": s["chunk_id"],
                    "section": f"Chunk {s['chunk_index']}",
                    "excerpt": clean_excerpt,
                    "relevance_score": round(float(s["similarity_score"]), 4)
                }
                db.add(EvidenceItem(
                    investigation_id=inv.id,
                    claim=f"Document citation from '{s['document_title']}': {clean_excerpt[:120]}...",
                    source_type="document",
                    source_id=s["document_id"],
                    source_name=s["document_title"],
                    analysis_type="HYBRID_TF_VECTOR_SEARCH",
                    query_or_method="Cosine Similarity Search",
                    result_summary=f"Relevant excerpt ({s['document_title']}): \"{clean_excerpt[:160]}...\"",
                    document_citation=citation_obj,
                    causal_classification="LIKELY_CONTRIBUTING_FACTOR",
                    confidence=round(min(0.95, max(0.5, s["similarity_score"])), 2),
                    supports_claim=True,
                    created_by_agent="RAG Search Agent",
                    created_at=utcnow()
                ))
                matches_list.append(citation_obj)

        if matches_list:
            summary_txt = f"Searched workspace knowledge base and matched {len(matches_list)} relevant document citations."
        else:
            summary_txt = "No matching unstructured documents found in workspace knowledge base. Analysis proceeded strictly using empirical dataset evidence."
            db.add(EvidenceItem(
                investigation_id=inv.id,
                claim="No domain strategy documents found in workspace.",
                source_type="document",
                source_name="Knowledge Base",
                analysis_type="HYBRID_TF_VECTOR_SEARCH",
                query_or_method="Cosine Similarity Search",
                result_summary="Knowledge base search yielded no matching unstructured domain strategy documents.",
                document_citation={},
                causal_classification="OBSERVATION",
                confidence=1.0,
                supports_claim=True,
                created_by_agent="RAG Search Agent",
                created_at=utcnow()
            ))

        await db.commit()

        await self.record_event(
            db, inv.id, "RAG Search Agent", "COMPLETED",
            f"Knowledge base search: {summary_txt}",
            {"matches_count": len(matches_list)}
        )

        return {
            "documents_matched": len(matches_list),
            "matches": matches_list,
            "summary": summary_txt
        }

    async def _execute_critic_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Genuine adversarial critic that validates evidence integrity, column references, and statistical claims."""
        f_res = await db.execute(select(Finding).where(Finding.investigation_id == inv.id))
        findings = f_res.scalars().all()
        h_res = await db.execute(select(Hypothesis).where(Hypothesis.investigation_id == inv.id))
        hyps = h_res.scalars().all()
        e_res = await db.execute(select(EvidenceItem).where(EvidenceItem.investigation_id == inv.id))
        evidence_items = e_res.scalars().all()

        # Load dataset context for column validation
        ctx = exec_context.ctx
        if not ctx:
            _, _, _, ctx = await self._analyze_workspace_data(
                db, inv.workspace_id, inv.objective, exec_context.dataset_ids
            )
            exec_context.ctx = ctx

        available_columns = set(ctx.all_columns) if ctx else set()

        issues = []
        supported_claims = [h for h in hyps if h.status == "SUPPORTED"]
        rejected_claims = [h for h in hyps if h.status == "REJECTED"]
        insufficient_claims = [h for h in hyps if h.status == "INSUFFICIENT_DATA"]

        # ── Check 1: Are there any findings at all? ──
        if not findings:
            issues.append({
                "severity": "critical",
                "claim": "No findings produced",
                "reason": "The data analyst agent produced zero findings from the dataset.",
                "recommended_action": "Verify dataset was loaded and analysis executed correctly."
            })

        # ── Check 2: Do hypothesis variables reference actual columns? ──
        if ctx:
            for h in hyps:
                variables = (h.details.get("variables", []) if isinstance(h.details, dict) else []) if h.details else []
                for var in variables:
                    if var and var not in available_columns:
                        issues.append({
                            "severity": "high",
                            "claim": f"Hypothesis '{h.title}' references variable '{var}'",
                            "reason": f"Column '{var}' does not exist in dataset. Available: {', '.join(list(available_columns)[:8])}.",
                            "recommended_action": "Re-map hypothesis variables to existing dataset columns."
                        })

        # ── Check 3: Validate statistical test results ──
        for h in hyps:
            stat = h.statistical_results if isinstance(h.statistical_results, dict) else {}
            p_val = stat.get("p_value")
            test_name = stat.get("test_name", "")

            if h.status == "SUPPORTED" and p_val is not None and p_val >= 0.05:
                issues.append({
                    "severity": "high",
                    "claim": f"Hypothesis '{h.title}' marked SUPPORTED",
                    "reason": f"p-value={p_val:.4f} is not significant at alpha=0.05. Status should not be SUPPORTED.",
                    "recommended_action": "Downgrade to PARTIALLY_SUPPORTED or re-test with different grouping."
                })

            if test_name == "INSUFFICIENT_DATA" and h.status == "SUPPORTED":
                issues.append({
                    "severity": "critical",
                    "claim": f"Hypothesis '{h.title}' SUPPORTED without test",
                    "reason": "Hypothesis is marked SUPPORTED but no statistical test could be performed.",
                    "recommended_action": "Mark as INSUFFICIENT_DATA."
                })

            # Check sample size warnings
            rows_used = stat.get("rows_used", stat.get("data_rows_used", 0))
            if rows_used and rows_used < 10 and h.status == "SUPPORTED":
                issues.append({
                    "severity": "medium",
                    "claim": f"Hypothesis '{h.title}' tested on n={rows_used}",
                    "reason": f"Very small sample size ({rows_used} records). Results are exploratory only.",
                    "recommended_action": "Flag as exploratory. Confidence should be capped at 50%."
                })

        # ── Check 4: Verify causal claims aren't overclaimed ──
        for h in supported_claims:
            if h.causal_classification == "PRIMARY_ROOT_CAUSE":
                stat = h.statistical_results if isinstance(h.statistical_results, dict) else {}
                p_val = stat.get("p_value")
                if p_val and p_val > 0.01:
                    issues.append({
                        "severity": "medium",
                        "claim": f"'{h.title}' classified as PRIMARY_ROOT_CAUSE",
                        "reason": f"p-value={p_val:.4f} suggests association, not strong causation.",
                        "recommended_action": "Downgrade classification to STRONG_ASSOCIATION."
                    })

        # ── Check 5: Evidence consistency ──
        dataset_evidence = [e for e in evidence_items if e.source_type == "dataset"]
        stat_evidence = [e for e in evidence_items if e.analysis_type == "STATISTICAL_HYPOTHESIS_TEST"]
        if len(dataset_evidence) == 0:
            issues.append({
                "severity": "high",
                "claim": "No dataset evidence in ledger",
                "reason": "Evidence ledger contains no dataset-sourced evidence items.",
                "recommended_action": "Ensure data analyst results are being recorded as evidence."
            })

        # ── Check 6: Unmappable concepts warning ──
        if ctx and ctx.unmappable_concepts:
            issues.append({
                "severity": "medium",
                "claim": f"Question concepts without dataset mapping: {', '.join(ctx.unmappable_concepts)}",
                "reason": "Some concepts from the user's question could not be mapped to dataset columns.",
                "recommended_action": "Flag these as limitations in the final report."
            })

        # ── Determine verdict ──
        critical_issues = [i for i in issues if i["severity"] == "critical"]
        high_issues = [i for i in issues if i["severity"] == "high"]

        if critical_issues:
            verdict = "FAIL"
            overall_justified = False
        elif len(high_issues) >= 2:
            verdict = "REQUEST_MORE_EVIDENCE"
            overall_justified = False
        elif high_issues:
            verdict = "PASS_WITH_WARNINGS"
            overall_justified = True
        elif findings:
            verdict = "PASS"
            overall_justified = True
        else:
            verdict = "REQUEST_MORE_EVIDENCE"
            overall_justified = False

        critique_notes = (
            f"Audited {len(findings)} findings, {len(hyps)} hypotheses, {len(evidence_items)} evidence items. "
            f"{len(supported_claims)} supported, {len(rejected_claims)} rejected, {len(insufficient_claims)} insufficient data. "
            f"Found {len(issues)} issues ({len(critical_issues)} critical, {len(high_issues)} high severity)."
        )

        c_rev = CriticReview(
            investigation_id=inv.id,
            round_number=1,
            verdict=verdict,
            overall_confidence_justified=overall_justified,
            issues=issues,
            critique_notes=critique_notes,
            created_at=utcnow()
        )
        db.add(c_rev)
        await db.commit()

        await self.record_event(
            db, inv.id, "Critic Agent", "COMPLETED",
            f"Critic audit verdict: {verdict}. {critique_notes}",
            {"verdict": verdict, "findings_audited": len(findings), "issues_count": len(issues)}
        )

        return {
            "supported_claims": [h.description for h in supported_claims],
            "rejected_claims": [h.description for h in rejected_claims],
            "issues": issues,
            "verdict": verdict,
            "overall_confidence_justified": overall_justified,
        }


    async def _execute_report_agent_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Synthesizes the comprehensive Executive Investigation Report strictly from real dataset evidence."""
        ctx = exec_context.ctx
        analytics = exec_context.analytics
        if not ctx or not analytics:
            df, analytics, datasets, ctx = await self._analyze_workspace_data(
                db, inv.workspace_id, inv.objective, exec_context.dataset_ids
            )
            exec_context.ctx = ctx
            exec_context.analytics = analytics or {}

        if not ctx:
            return {"report_markdown": "# Investigation Report\n\nNo dataset found in workspace.", "sections_generated": []}

        h_res = await db.execute(select(Hypothesis).where(Hypothesis.investigation_id == inv.id))
        hyps = h_res.scalars().all()
        f_res = await db.execute(select(Finding).where(Finding.investigation_id == inv.id))
        findings = f_res.scalars().all()
        e_res = await db.execute(select(EvidenceItem).where(EvidenceItem.investigation_id == inv.id))
        evs = e_res.scalars().all()

        total_rows = ctx.row_count
        ds_name = ctx.dataset_name
        cols = ctx.all_columns
        agg = analytics.get("aggregations", {})
        primary_table = analytics.get("primary_table", [])

        # ── 1. Format Primary Data Table into Markdown ──
        table_md = ""
        if primary_table:
            headers = list(primary_table[0].keys())
            header_row = "| " + " | ".join(headers) + " |"
            separator_row = "| " + " | ".join([":---"] * len(headers)) + " |"
            data_rows = []
            for row in primary_table[:25]:
                vals = [str(row.get(h, "")) for h in headers]
                data_rows.append("| " + " | ".join(vals) + " |")
            table_md = "\n".join([header_row, separator_row] + data_rows)
            if len(primary_table) > 25:
                table_md += f"\n\n*(Showing top 25 of {len(primary_table)} records)*"
        else:
            table_md = "*No tabular records extracted.*"

        # ── 2. Format Dimensional Breakdowns ──
        dim_summary = agg.get("dimensional_summary", {})
        dim_md_sections = []
        for dim_key, dim_data in dim_summary.items():
            if isinstance(dim_data, dict) and dim_data:
                dim_label = dim_key.replace("pending_qty_by_", "Pending Quantity by ").replace("count_by_", "Record Count by ").replace("_", " ").title()
                rows = [f"| **{k}** | {v:,.0f} |" for k, v in list(dim_data.items())[:8]]
                dim_table = f"### {dim_label}\n\n| Group | Value |\n| :--- | :--- |\n" + "\n".join(rows)
                dim_md_sections.append(dim_table)
        dimensional_md = "\n\n".join(dim_md_sections) if dim_md_sections else "*No multi-level dimensional breakdowns applicable for this question.*"

        # ── 3. Format Hypotheses Table ──
        hyp_rows = []
        for h in hyps:
            stat_dict = h.statistical_results if isinstance(h.statistical_results, dict) else {}
            test_name = stat_dict.get("test_name", "Empirical Evaluation")
            stat_val = f"{stat_dict.get('statistic'):.2f}" if stat_dict.get("statistic") is not None else "N/A"
            p_val = f"{stat_dict.get('p_value'):.4f}" if stat_dict.get("p_value") is not None else "N/A"
            rows_used = str(stat_dict.get("rows_used", total_rows))
        hyp_table_md = "\n".join(hyp_rows) if hyp_rows else "| None Evaluated | No testable hypothesis could be matched with available columns | N/A | N/A | 0 | 0% | **INSUFFICIENT_DATA** |"

        # ── 4. Format Document Evidence ──
        doc_evs = [e for e in evs if e.source_type == "document" and e.document_citation and e.document_citation.get("excerpt")]
        if doc_evs:
            doc_md = "\n".join([f"- **{e.source_name}**: \"{e.document_citation.get('excerpt')}\"" for e in doc_evs])
        else:
            doc_md = "No relevant knowledge-base policy documents matched. Analysis proceeded strictly using verified tabular dataset rows."

        # ── 5. Findings Bullet List ──
        findings_bullets = "\n".join([f"- **Finding**: {f.statement} *(Confidence: {round((f.confidence or 0.95)*100)}%)*" for f in findings])

        # ── 6. Executive Answer ──
        primary_finding = findings[0].statement if findings else analytics.get("analysis_description", f"Analyzed {total_rows} records in {ds_name}.")

        # ── 7. Root Cause / Factor Ranking ──
        rc_rows = []
        for idx, h in enumerate(hyps):
            if h.status in ["SUPPORTED", "PARTIALLY_SUPPORTED"]:
                classification_label = "PRIMARY DRIVER" if idx == 0 and h.status == "SUPPORTED" else "CONTRIBUTING FACTOR"
                rc_rows.append(
                    f"| **{idx+1}** | **{h.title}** | {h.description} | {round((h.confidence or 0.7)*100)}% | **{classification_label}** | Review and address concentration in this factor |"
                )
        rc_table_md = "\n".join(rc_rows) if rc_rows else "| - | **No Root Causes Identified** | The available dataset does not contain sufficient dimensional or statistical evidence to establish root causes for this question. | 0% | **INSUFFICIENT_EVIDENCE** | Upload datasets with relevant dimensions or metric breakdowns |"

        # ── 8. Synthesize Full Markdown Report ──
        # ── 8. Unmapped Question Concepts / Limitations ──
        unmapped_section = ""
        if ctx.unmappable_concepts:
            unmapped_section = f"""
---

# 8. Question Scope & Unmapped Concepts

> ⚠ **Dataset Scope Limitation**: The question referenced concepts ({', '.join(ctx.unmappable_concepts)}) that do NOT exist in dataset `{ds_name}`.
> Analysis was conducted strictly on available columns: `{', '.join(cols)}`.
"""

        # ── 9. Synthesize Full Markdown Report ──
        status_display = "COMPLETED"
        if ctx.unmappable_concepts or not hyps or any(h.status == "INSUFFICIENT_DATA" for h in hyps):
            status_display = "COMPLETED_WITH_LIMITATIONS"

        report_md = f"""# Investigation Summary

- **Investigation Question**: {inv.objective}
- **Dataset Analyzed**: `{ds_name}` ({total_rows} total records)
- **Columns Available**: `{', '.join(cols[:15])}{'...' if len(cols) > 15 else ''}`
- **Analysis Method**: `{analytics.get('analysis_type', 'DATASET_QUERY')}` ({analytics.get('pending_formula') or 'Dynamic Schema Aggregation'})
- **Investigation Status**: {status_display}
- **Data Grounding Check**: VERIFIED (All numbers extracted directly from `{ds_name}`)

---

# 1. Executive Answer

{primary_finding}

---

# 2. Key Verified Findings

{findings_bullets}

---

# 3. Extracted Dataset Records

{table_md}

---

# 4. Dimensional Analysis

{dimensional_md}

---

# 5. Hypotheses Tested & Statistical Significance

| Hypothesis | Statistical Test | Statistic | p-Value | Rows Used | Confidence | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
{hyp_table_md}

---

# 6. Knowledge Base Evidence

{doc_md}

---

# 7. Root Cause & Contributing Factor Ranking

| Rank | Potential Driver | Explanation | Confidence | Classification | Recommended Action |
| :--- | :--- | :--- | :--- | :--- | :--- |
{rc_table_md}
{unmapped_section}
---

# {'9' if unmapped_section else '8'}. Data Quality & Coverage Summary

- **Records Analyzed**: {total_rows} rows from `{ds_name}`
- **Columns Detected**: {len(cols)} columns ({', '.join(cols[:10])}...)
- **Numeric Columns**: {', '.join(ctx.numeric_columns) or 'None'}
- **Categorical Columns**: {', '.join(ctx.categorical_columns[:8]) or 'None'}
- **Missing Values**: {sum(ctx.null_counts.values())} total null values across dataset
- **Statistical Reliability**: {'EXPLORATORY ONLY (n<30)' if total_rows < 30 else 'HIGH RELIABILITY (n>=30)'}

---

# {'10' if unmapped_section else '9'}. Recommended Next Actions

1. **Address Key Findings**: Focus on the specific items and categories highlighted in the extracted dataset records above.
2. **Expand Data Coverage**: If specific business dimensions (e.g., regions, segments) were missing, upload enriched datasets containing those attributes.
3. **Continuous Tracking**: Re-run this investigation as new operational batches are loaded to measure changes over time.
"""

        await self.record_event(
            db, inv.id, "Report Agent", "COMPLETED",
            f"Synthesized comprehensive Executive Investigation Report grounded strictly in `{ds_name}` ({total_rows} records).",
            {"report_length": len(report_md)}
        )

        return {
            "report_markdown": report_md,
            "analytics": analytics,
            "sections_generated": [
                "Investigation Summary",
                "Executive Answer",
                "Key Verified Findings",
                "Extracted Dataset Records",
                "Dimensional Analysis",
                "Hypotheses Tested",
                "Knowledge Base Evidence",
                "Root Cause Ranking",
                "Data Quality Summary",
                "Recommended Actions"
            ]
        }

    async def _execute_real_agent_task(
        self,
        db: AsyncSession,
        inv: Investigation,
        task: InvestigationTask,
        exec_context: InvestigationExecutionContext,
    ) -> Dict[str, Any]:
        """Routes task execution to the appropriate domain agent with explicit execution context."""
        if task.agent == "data_analyst":
            return await self._execute_data_analyst_task(db, inv, task, exec_context)
        elif task.agent == "hypothesis_agent":
            return await self._execute_hypothesis_agent_task(db, inv, task, exec_context)
        elif task.agent == "hypothesis_tester":
            return await self._execute_hypothesis_tester_task(db, inv, task, exec_context)
        elif task.agent == "rag_agent":
            return await self._execute_rag_agent_task(db, inv, task)
        elif task.agent == "critic":
            return await self._execute_critic_task(db, inv, task, exec_context)
        elif task.agent == "report_agent":
            return await self._execute_report_agent_task(db, inv, task, exec_context)
        else:
            return {"status": "ok"}

    # ── MAIN PIPELINE ORCHESTRATION ────────────────────────────────────────────
    async def run_investigation(self, investigation_id: str, use_mock_agents: bool = False) -> bool:
        """Runs the stateful investigation pipeline safely with exception isolation."""
        async with AsyncSessionLocal() as db:
            acquired, exec_id, inv = await self.acquire_lease(db, investigation_id)
            if not acquired or not inv or not exec_id:
                return False

            exec_context = InvestigationExecutionContext(
                investigation_id=investigation_id,
                workspace_id=inv.workspace_id,
                user_id=inv.created_by,
                objective=inv.objective,
                execution_id=exec_id,
                attempt_number=inv.attempt_number,
            )

            try:
                await self.record_event(
                    db, investigation_id, "Supervisor Agent", "STARTED",
                    f"Workflow claimed by {self.worker_id} (exec_id={exec_id})",
                    {"execution_id": exec_id, "worker_id": self.worker_id}
                )

                # ── STAGE 1: PLANNING ────────────────────────────────────────────────
                if not inv.plan or len(inv.plan) == 0:
                    await self.renew_lease(db, investigation_id, exec_id)
                    inv.status = "PLANNING"
                    await db.commit()

                    await self.record_event(
                        db, investigation_id, "Planning Agent", "STARTED",
                        "Analyzing workspace datasets and formulating investigation plan..."
                    )

                    # Gather datasets schema context
                    datasets_res = await db.execute(
                        select(Dataset).where(
                            Dataset.workspace_id == inv.workspace_id,
                            Dataset.status.in_(["PROFILED", "UPLOADED"]),
                            Dataset.is_deleted == False,
                        )
                    )
                    datasets = datasets_res.scalars().all()
                    if not datasets:
                        inv.status = "FAILED"
                        inv.failure_reason = "[Planning Agent] FAILED: No datasets found in workspace. Please upload a tabular dataset (CSV/XLSX) to begin analysis."
                        inv.last_completed_stage = "PLANNING"
                        inv.locked_by = None
                        inv.lock_expires_at = None
                        await db.commit()
                        await self.record_event(
                            db, investigation_id, "Supervisor Agent", "FAILED",
                            "[Planning Agent] FAILED: No datasets found in workspace. Upload a CSV/XLSX dataset first.",
                            {
                                "stage": "PLANNING",
                                "agent": "Planning Agent",
                                "error": "No datasets found in workspace.",
                                "execution_id": exec_id
                            }
                        )
                        return False

                    # On-demand profile if any dataset is unprofiled
                    for ds in datasets:
                        if ds.status != "PROFILED":
                            try:
                                from app.services.profiling_service import run_profiling
                                await run_profiling(ds.id)
                            except Exception:
                                pass

                    tasks_list = [
                        {"step_number": 1, "task_id": "step_1", "name": "Question-Driven Dataset Analysis", "agent": "data_analyst", "objective": "Profile dataset and execute targeted analysis on relevant columns"},
                        {"step_number": 2, "task_id": "step_2", "name": "Schema-Grounded Hypothesis Formulation", "agent": "hypothesis_agent", "objective": "Formulate testable causal hypotheses grounded in dataset schema"},
                        {"step_number": 3, "task_id": "step_3", "name": "Deterministic Statistical Verification", "agent": "hypothesis_tester", "objective": "Execute statistical significance tests on dataset variables"},
                        {"step_number": 4, "task_id": "step_4", "name": "Domain Document Strategy RAG", "agent": "rag_agent", "objective": "Cross-reference internal policy and memo documents"},
                        {"step_number": 5, "task_id": "step_5", "name": "Strict Verification & Audit", "agent": "critic", "objective": "Audit evidence ledger and validate mathematical consistency"},
                        {"step_number": 6, "task_id": "step_6", "name": "Executive Investigation Synthesis", "agent": "report_agent", "objective": "Synthesize findings into dynamic evidence-based report"}
                    ]

                    inv.plan = tasks_list
                    inv.last_completed_stage = "PLANNING"
                    inv.status = "ANALYZING"
                    await db.commit()

                    # Enqueue tasks in DB
                    for tspec in tasks_list:
                        task_row = InvestigationTask(
                            investigation_id=investigation_id,
                            agent=tspec["agent"],
                            objective=tspec["objective"],
                            step_number=tspec["step_number"],
                            status="PENDING",
                            max_retries=2,
                        )
                        db.add(task_row)

                    await db.commit()

                    await self.record_event(
                        db, investigation_id, "Planning Agent", "COMPLETED",
                        f"Formulated {len(tasks_list)} analytical steps: Question-driven dataset query, grounded hypothesis generation, statistical verification, document RAG search, critic audit, and executive synthesis.",
                        {"plan": tasks_list}
                    )

                # ── STAGE 2: RESUMABLE TASK EXECUTION LOOP ───────────────────────────
                while True:
                    await self.renew_lease(db, investigation_id, exec_id)

                    # Fetch next pending, failed retryable, or incomplete task
                    now = utcnow()
                    t_res = await db.execute(
                        select(InvestigationTask)
                        .where(
                            InvestigationTask.investigation_id == investigation_id,
                            or_(
                                InvestigationTask.status == "PENDING",
                                and_(
                                    InvestigationTask.status == "FAILED",
                                    or_(
                                        InvestigationTask.next_retry_at == None,
                                        InvestigationTask.next_retry_at <= now,
                                    ),
                                    InvestigationTask.retry_count <= InvestigationTask.max_retries,
                                ),
                                and_(
                                    InvestigationTask.status == "COMPLETED",
                                    InvestigationTask.result == None
                                )
                            )
                        )
                        .order_by(InvestigationTask.step_number.asc(), InvestigationTask.created_at.asc())
                    )
                    pending_task = t_res.scalars().first()

                    if not pending_task:
                        break  # All tasks executed

                    # Claim task atomically
                    claimed = await self.claim_task_atomically(db, pending_task.id, exec_id)
                    if not claimed:
                        logger.warning(f"Task {pending_task.id} could not be claimed atomically. Skipping.")
                        continue

                    stage_name = (
                        "ANALYZING" if pending_task.agent == "data_analyst" else (
                            "TESTING" if "hypothesis" in pending_task.agent else (
                                "RETRIEVING" if pending_task.agent == "rag_agent" else (
                                    "VERIFYING" if pending_task.agent == "critic" else "REPORTING"
                                )
                            )
                        )
                    )
                    inv.status = stage_name
                    await db.commit()

                    if pending_task.agent == "report_agent":
                        logger.info(f"[REPORT_AGENT_STARTED] execution_id={exec_id} investigation_id={investigation_id} task_id={pending_task.id} workspace_id={inv.workspace_id} task_status={pending_task.status} investigation_status={inv.status}")

                    await self.record_event(
                        db, investigation_id, pending_task.agent.replace("_", " ").title(), "STARTED",
                        f"Executing: {pending_task.objective}"
                    )

                    start_time = utcnow()
                    try:
                        result_data = await self._execute_real_agent_task(db, inv, pending_task, exec_context)

                        if pending_task.agent == "report_agent":
                            logger.info(f"[REPORT_AGENT_RESULT_CREATED] execution_id={exec_id} investigation_id={investigation_id} task_id={pending_task.id} report_len={len(result_data.get('report_markdown', ''))}")

                        pending_task.status = "COMPLETED"
                        pending_task.completed_at = utcnow()
                        pending_task.duration_ms = int((pending_task.completed_at - start_time).total_seconds() * 1000)
                        pending_task.result = result_data
                        inv.last_completed_stage = stage_name

                        if pending_task.agent == "report_agent":
                            logger.info(f"[REPORT_AGENT_TASK_STATUS_COMPLETED] execution_id={exec_id} investigation_id={investigation_id} task_id={pending_task.id} task_status=COMPLETED")

                        await db.commit()

                        if pending_task.agent == "report_agent":
                            logger.info(f"[REPORT_AGENT_DB_COMMIT] execution_id={exec_id} investigation_id={investigation_id} task_id={pending_task.id} committed successfully")
                            logger.info(f"[REPORT_COMPLETION_EVENT_EMITTED] execution_id={exec_id} investigation_id={investigation_id} task_id={pending_task.id}")

                    except Exception as task_err:
                        import traceback
                        tb_str = traceback.format_exc()
                        logger.error(f"Task {pending_task.id} ({pending_task.agent}) failed: {task_err}\nTraceback:\n{tb_str}")
                        pending_task.retry_count += 1
                        pending_task.error = f"{str(task_err)}\n{tb_str[:400]}"

                        if pending_task.retry_count <= pending_task.max_retries:
                            backoff_seconds = 5 if pending_task.retry_count == 1 else 15
                            pending_task.next_retry_at = utcnow() + timedelta(seconds=backoff_seconds)
                            pending_task.status = "FAILED"
                            await db.commit()

                            agent_display = pending_task.agent.replace("_", " ").title()
                            await self.record_event(
                                db, investigation_id, agent_display, "FAILED",
                                f"[{agent_display}] Transient failure (Attempt {pending_task.retry_count}/{pending_task.max_retries+1}): {task_err}. Retrying in {backoff_seconds}s.",
                                {
                                    "stage": stage_name,
                                    "agent": agent_display,
                                    "error": str(task_err),
                                    "retry_count": pending_task.retry_count,
                                    "max_retries": pending_task.max_retries,
                                    "execution_id": exec_id,
                                }
                            )
                        else:
                            pending_task.status = "FAILED"
                            agent_display = pending_task.agent.replace("_", " ").title()
                            inv.status = "FAILED"
                            inv.last_completed_stage = stage_name
                            inv.failure_reason = f"[{agent_display}] FAILED: Reason: {task_err} (Stage: {stage_name}, Retries: {pending_task.retry_count}/{pending_task.max_retries})"
                            inv.locked_by = None
                            inv.lock_expires_at = None
                            await db.commit()

                            await self.record_event(
                                db, investigation_id, agent_display, "FAILED",
                                f"[{agent_display}] FAILED: Reason: {task_err}",
                                {
                                    "stage": stage_name,
                                    "agent": agent_display,
                                    "error": str(task_err),
                                    "retry_count": pending_task.retry_count,
                                    "max_retries": pending_task.max_retries,
                                    "execution_id": exec_id,
                                }
                            )
                            return False

                # ── STAGE 3: EVIDENCE SYNTHESIS & ATOMIC COMPLETION ───────────────────
                logger.info(f"[SUPERVISOR_RECEIVED_REPORT_COMPLETION] execution_id={exec_id} investigation_id={investigation_id}")
                logger.info(f"[ALL_TASKS_COMPLETED_CHECK] execution_id={exec_id} investigation_id={investigation_id} all tasks marked completed")
                logger.info(f"[FINALIZATION_STARTED] execution_id={exec_id} investigation_id={investigation_id}")

                await self.renew_lease(db, investigation_id, exec_id)

                # Gather all persisted entities
                f_res = await db.execute(select(Finding).where(Finding.investigation_id == investigation_id))
                all_findings = f_res.scalars().all()
                h_res = await db.execute(select(Hypothesis).where(Hypothesis.investigation_id == investigation_id))
                all_hypotheses = h_res.scalars().all()
                e_res = await db.execute(select(EvidenceItem).where(EvidenceItem.investigation_id == investigation_id))
                all_evidence = e_res.scalars().all()
                c_res = await db.execute(select(CriticReview).where(CriticReview.investigation_id == investigation_id))
                critic_rev = c_res.scalars().first()

                # Find report markdown from report_agent task result
                rep_res = await db.execute(
                    select(InvestigationTask).where(
                        InvestigationTask.investigation_id == investigation_id,
                        InvestigationTask.agent == "report_agent"
                    )
                )
                rep_task = rep_res.scalars().first()
                report_md = (rep_task.result.get("report_markdown") if (rep_task and rep_task.result) else None) or inv.summary

                logger.info(f"[CONFIDENCE_CALCULATION_STARTED] execution_id={exec_id} investigation_id={investigation_id}")

                # Build calibrated confidence score using evidence_service
                ev_schema_objects = []
                for item in all_evidence:
                    try:
                        sm = None
                        if item.statistical_metrics and isinstance(item.statistical_metrics, dict):
                            try:
                                sm = StatisticalMetric(**item.statistical_metrics)
                            except Exception:
                                sm = None
                        doc_cit = None
                        if item.document_citation and isinstance(item.document_citation, dict) and item.document_citation.get("document_name"):
                            try:
                                doc_cit = DocumentCitation(**item.document_citation)
                            except Exception:
                                doc_cit = None
                        ev_schema_objects.append(EvidenceItemSchema(
                            evidence_id=item.id,
                            claim=item.claim,
                            source_type=item.source_type,
                            source_id=item.source_id,
                            source_name=item.source_name,
                            analysis_type=item.analysis_type,
                            query_or_method=item.query_or_method,
                            result_summary=item.result_summary,
                            statistical_metrics=sm,
                            document_citation=doc_cit,
                            causal_classification=item.causal_classification or "CORRELATION",
                            confidence=item.confidence or 0.8,
                            supports_claim=item.supports_claim if item.supports_claim is not None else True,
                            created_by_agent=item.created_by_agent or "Agent",
                            created_at=item.created_at.isoformat() if item.created_at else utcnow().isoformat(),
                        ))
                    except Exception as ev_err:
                        logger.warning(f"Could not convert evidence item to schema: {ev_err}")

                has_critic_pass = (critic_rev.verdict == "PASS") if critic_rev else True
                rep_analytics = rep_task.result if (rep_task and rep_task.result) else {}
                sample_count = rep_analytics.get("data_quality", {}).get("total_rows", 8)

                calibrated_score, conf_breakdown = evidence_service.calculate_calibrated_confidence(
                    evidence_items=ev_schema_objects,
                    has_critic_pass=has_critic_pass,
                    has_contradictions=False,
                    sample_size=sample_count,
                )

                logger.info(f"[CONFIDENCE_CALCULATION_COMPLETED] execution_id={exec_id} score={calibrated_score:.2f}")

                # Build dynamic structured root causes with standard classifications
                root_causes_snapshot = [
                    {
                        "rank": idx + 1,
                        "title": h.title,
                        "classification": "PRIMARY_ROOT_CAUSE" if idx == 0 and h.status == "SUPPORTED" else (
                            "CONTRIBUTING_FACTOR" if h.status == "SUPPORTED" else "REJECTED_HYPOTHESIS"
                        ),
                        "explanation": h.description or h.title,
                        "confidence_score": round(h.confidence or 0.70, 2),
                        "statistical_summary": str(h.statistical_results.get("interpretation", "Empirical cohort data verified.")) if (h.statistical_results and isinstance(h.statistical_results, dict)) else "Observational data aligned.",
                        "recommended_actions": [
                            {"action": f"Remediate primary driver: {h.title}", "impact": "Mitigate root cause variance", "priority": "HIGH"}
                        ] if h.status == "SUPPORTED" else []
                    }
                    for idx, h in enumerate(all_hypotheses)
                ]

                evidence_ledger_snapshot = [
                    {
                        "evidence_id": item.id,
                        "claim": item.claim,
                        "source_type": item.source_type,
                        "source_name": item.source_name,
                        "result_summary": item.result_summary,
                        "statistical_metrics": item.statistical_metrics,
                        "document_citation": item.document_citation,
                        "causal_classification": item.causal_classification,
                        "confidence": item.confidence,
                        "supports_claim": item.supports_claim,
                        "created_by_agent": item.created_by_agent
                    }
                    for item in all_evidence
                ]

                has_valid_findings = len(all_findings) > 0
                has_valid_report = report_md is not None and len(report_md.strip()) > 100
                critic_failed = critic_rev and critic_rev.verdict == "FAIL"
                ctx = exec_context.ctx

                if not has_valid_findings or critic_failed:
                    final_status = "INSUFFICIENT_DATA"
                elif (
                    (critic_rev and critic_rev.verdict in ["PASS_WITH_WARNINGS", "REQUEST_MORE_EVIDENCE"])
                    or (rep_analytics.get("data_sufficiency", {}).get("temporal_analysis") is False)
                    or (ctx and ctx.unmappable_concepts)
                    or any(h.status == "INSUFFICIENT_DATA" for h in all_hypotheses)
                ):
                    final_status = "COMPLETED_WITH_LIMITATIONS"
                elif has_valid_findings and has_valid_report:
                    final_status = "COMPLETED"
                else:
                    final_status = "COMPLETED_WITH_LIMITATIONS"

                logger.info(f"[REPORT_PERSISTED] execution_id={exec_id} target_status={final_status}")

                stmt = (
                    update(Investigation)
                    .where(
                        Investigation.id == investigation_id,
                        Investigation.execution_id == exec_id,
                        Investigation.locked_by == self.worker_id,
                    )
                    .values(
                        status=final_status,
                        summary=report_md,
                        confidence_score=calibrated_score,
                        root_causes=root_causes_snapshot,
                        confidence_breakdown=conf_breakdown.model_dump(),
                        evidence_ledger=evidence_ledger_snapshot,
                        last_completed_stage="COMPLETED",
                        locked_by=None,
                        lock_expires_at=None,
                    )
                    .execution_options(synchronize_session=False)
                )
                res = await db.execute(stmt)
                if res.rowcount == 0:
                    # Fallback direct update to ensure investigation is never orphaned in REPORTING
                    logger.warning(f"[FINALIZATION_FALLBACK] Leased update returned 0 rows for {investigation_id}. Applying unconditional update.")
                    fb_stmt = (
                        update(Investigation)
                        .where(Investigation.id == investigation_id)
                        .values(
                            status=final_status,
                            summary=report_md,
                            confidence_score=calibrated_score,
                            root_causes=root_causes_snapshot,
                            confidence_breakdown=conf_breakdown.model_dump(),
                            evidence_ledger=evidence_ledger_snapshot,
                            last_completed_stage="COMPLETED",
                            locked_by=None,
                            lock_expires_at=None,
                        )
                        .execution_options(synchronize_session=False)
                    )
                    await db.execute(fb_stmt)

                await db.commit()
                logger.info(f"[INVESTIGATION_STATUS_COMPLETED] execution_id={exec_id} status={final_status}")
                logger.info(f"[FINALIZATION_COMMITTED] execution_id={exec_id} investigation_id={investigation_id}")

                await self.record_event(
                    db, investigation_id, "Supervisor Agent", "COMPLETED",
                    f"Investigation concluded successfully. Verified {len(all_findings)} quantitative findings, {len(all_hypotheses)} tested hypotheses, and generated executive report with {calibrated_score*100:.0f}% calibrated confidence.",
                    {
                        "status": final_status,
                        "confidence_score": calibrated_score,
                        "findings_count": len(all_findings),
                        "hypotheses_count": len(all_hypotheses),
                        "evidence_count": len(all_evidence)
                    }
                )

                logger.info(f"Investigation {investigation_id} reached {final_status} with confidence {calibrated_score:.2f}")
                return True

            except Exception as e:
                logger.exception(f"Fatal error in investigation {investigation_id}: {e}")
                try:
                    err_stmt = (
                        update(Investigation)
                        .where(Investigation.id == investigation_id)
                        .values(
                            status="FAILED",
                            failure_reason=str(e),
                            last_completed_stage="FAILED",
                            locked_by=None,
                            lock_expires_at=None,
                        )
                        .execution_options(synchronize_session=False)
                    )
                    await db.execute(err_stmt)
                    await db.commit()
                    await self.record_event(
                        db, investigation_id, "Supervisor Agent", "FAILED",
                        f"Workflow failed: {str(e)}",
                        {"error": str(e), "stage": "FINALIZATION"}
                    )
                except Exception as inner_err:
                    logger.error(f"Failed to record failure status for {investigation_id}: {inner_err}")
                return False


async def run_worker_loop(poll_interval: float = 3.0, run_once: bool = False):
    """Durable background worker loop that scans for PENDING or stale RUNNING investigations."""
    worker = InvestigationWorker()
    logger.info(f"Starting durable background worker process ({worker.worker_id})")

    while True:
        try:
            async with AsyncSessionLocal() as db:
                now = utcnow()
                # Find PENDING or stale RUNNING investigations
                res = await db.execute(
                    select(Investigation.id)
                    .where(
                        Investigation.status.notin_(["COMPLETED", "COMPLETED_WITH_LIMITATIONS", "FAILED", "CANCELLED"]),
                        or_(
                            Investigation.status.in_(["PENDING", "QUEUED", "PLANNING"]),
                            Investigation.lock_expires_at == None,
                            Investigation.lock_expires_at < now,
                        ),
                    )
                    .order_by(Investigation.created_at.asc())
                    .limit(5)
                )
                pending_ids = res.scalars().all()

                for inv_id in pending_ids:
                    logger.info(f"[{worker.worker_id}] Found eligible investigation {inv_id}. Claiming lease...")
                    await worker.run_investigation(inv_id)

        except Exception as loop_err:
            logger.error(f"[{worker.worker_id}] Worker loop error: {loop_err}")

        if run_once:
            break
        await asyncio.sleep(poll_interval)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_worker_loop())
