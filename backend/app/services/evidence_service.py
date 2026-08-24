import uuid
import logging
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from app.schemas.investigation_state import (
    EvidenceItemSchema,
    StatisticalMetric,
    DocumentCitation,
    CausalStrength,
    ConfidenceCalibrationBreakdown
)

logger = logging.getLogger("datapilot.evidence_service")


class EvidenceLedgerService:
    """Manages the Evidence Ledger, claim-to-evidence associations, and calibrated confidence calculation."""

    @staticmethod
    def create_dataset_evidence(
        claim: str,
        source_id: str,
        source_name: str,
        query_or_method: str,
        result_summary: str,
        created_by_agent: str = "data_analyst",
        confidence: float = 0.85,
        causal_classification: CausalStrength = "CORRELATION",
        supports_claim: bool = True,
    ) -> EvidenceItemSchema:
        """Create a dataset query / tabular proof evidence item."""
        return EvidenceItemSchema(
            evidence_id=str(uuid.uuid4()),
            claim=claim,
            source_type="dataset",
            source_id=source_id,
            source_name=source_name,
            analysis_type="sql_or_pandas",
            query_or_method=query_or_method,
            result_summary=result_summary,
            confidence=confidence,
            causal_classification=causal_classification,
            supports_claim=supports_claim,
            created_by_agent=created_by_agent,
            created_at=datetime.utcnow().isoformat(),
        )

    @staticmethod
    def create_statistical_evidence(
        claim: str,
        source_name: str,
        metric: StatisticalMetric,
        query_or_method: str = "SciPy Deterministic Test",
        created_by_agent: str = "hypothesis_tester",
        supports_claim: bool = True,
    ) -> EvidenceItemSchema:
        """Create a deterministic statistical test evidence item."""
        # Classify causal strength based on p-value and effect size
        p_val = metric.p_value if metric.p_value is not None else 1.0
        eff = abs(metric.effect_size) if metric.effect_size is not None else 0.0

        if p_val < 0.01 and eff >= 0.5:
            classification: CausalStrength = "STRONG_ASSOCIATION"
            conf = 0.92
        elif p_val < 0.05:
            classification: CausalStrength = "CORRELATION"
            conf = 0.84
        elif p_val < 0.10:
            classification: CausalStrength = "OBSERVATION"
            conf = 0.65
        else:
            classification: CausalStrength = "INSUFFICIENT_EVIDENCE"
            conf = 0.35

        return EvidenceItemSchema(
            evidence_id=str(uuid.uuid4()),
            claim=claim,
            source_type="statistical",
            source_name=source_name,
            analysis_type=metric.test_name,
            query_or_method=query_or_method,
            result_summary=metric.interpretation,
            statistical_metrics=metric,
            confidence=conf,
            causal_classification=classification,
            supports_claim=supports_claim and (p_val < 0.05),
            created_by_agent=created_by_agent,
            created_at=datetime.utcnow().isoformat(),
        )

    @staticmethod
    def create_document_evidence(
        claim: str,
        citation: DocumentCitation,
        created_by_agent: str = "rag_agent",
    ) -> EvidenceItemSchema:
        """Create qualitative RAG document context evidence."""
        conf = min(0.95, max(0.4, citation.relevance_score))
        return EvidenceItemSchema(
            evidence_id=str(uuid.uuid4()),
            claim=claim,
            source_type="document",
            source_id=citation.document_id,
            source_name=citation.document_name,
            analysis_type="pgvector_semantic_search",
            query_or_method=f"Semantic match ({citation.section or 'General'})",
            result_summary=f"Context passage: {citation.excerpt[:200]}...",
            document_citation=citation,
            confidence=conf,
            causal_classification="LIKELY_CONTRIBUTING_FACTOR" if conf > 0.8 else "OBSERVATION",
            supports_claim=True,
            created_by_agent=created_by_agent,
            created_at=datetime.utcnow().isoformat(),
        )

    @staticmethod
    def calculate_calibrated_confidence(
        evidence_items: List[EvidenceItemSchema],
        has_critic_pass: bool = True,
        has_contradictions: bool = False,
    ) -> Tuple[float, ConfidenceCalibrationBreakdown]:
        """Compute transparent deterministic confidence calibration.

        Weights:
        - Statistical Evidence: 35%
        - Dataset Coverage: 20%
        - Evidence Consistency: 15%
        - Document / Context Support: 10%
        - Critic Validation: 10%
        - Contradiction Penalty: -10%
        """
        if not evidence_items:
            breakdown = ConfidenceCalibrationBreakdown(
                statistical_evidence_score=0.0,
                data_coverage_score=0.0,
                evidence_consistency_score=0.0,
                document_context_score=0.0,
                critic_validation_score=0.0,
                contradiction_penalty=0.0,
                final_calibrated_confidence=0.10,
            )
            return 0.10, breakdown

        # 1. Statistical Evidence (35%)
        stat_items = [e for e in evidence_items if e.source_type == "statistical"]
        if stat_items:
            valid_stats = [s for s in stat_items if s.statistical_metrics and (s.statistical_metrics.p_value or 1.0) < 0.05]
            stat_score = 0.35 * (len(valid_stats) / len(stat_items))
        else:
            stat_score = 0.15  # Partial baseline if only observational queries

        # 2. Data Coverage (20%)
        dataset_items = [e for e in evidence_items if e.source_type == "dataset"]
        data_score = 0.20 if len(dataset_items) >= 2 else (0.12 if len(dataset_items) == 1 else 0.0)

        # 3. Evidence Consistency (15%)
        supporting_items = [e for e in evidence_items if e.supports_claim]
        consistency_ratio = len(supporting_items) / len(evidence_items) if evidence_items else 0.0
        consistency_score = 0.15 * consistency_ratio

        # 4. Document / Context Support (10%)
        doc_items = [e for e in evidence_items if e.source_type == "document"]
        doc_score = 0.10 if len(doc_items) >= 1 else 0.05

        # 5. Critic Validation (10%)
        critic_score = 0.10 if has_critic_pass else 0.0

        # 6. Contradiction Penalty (-10%)
        contradiction_penalty = -0.10 if has_contradictions else 0.0

        final_conf = max(0.10, min(0.99, (
            stat_score + data_score + consistency_score + doc_score + critic_score + contradiction_penalty
        )))

        breakdown = ConfidenceCalibrationBreakdown(
            statistical_evidence_score=round(stat_score, 3),
            data_coverage_score=round(data_score, 3),
            evidence_consistency_score=round(consistency_score, 3),
            document_context_score=round(doc_score, 3),
            critic_validation_score=round(critic_score, 3),
            contradiction_penalty=round(contradiction_penalty, 3),
            final_calibrated_confidence=round(final_conf, 3),
        )

        return round(final_conf, 2), breakdown


evidence_service = EvidenceLedgerService()
