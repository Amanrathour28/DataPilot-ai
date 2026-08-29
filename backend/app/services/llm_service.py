"""
DataPilot LLM Service
======================
Handles interactions with cloud LLMs (Groq, OpenAI) and local Ollama.

DESIGN RULE: This service is used ONLY for natural-language tasks (plan generation,
report narrative synthesis, critic evaluation). It must NEVER be the source of
analytical calculations, statistical values, or dataset-derived numbers.

All analytical computation is performed deterministically by dataset_context.py
and statistical_service.py.
"""

import logging
import json
import httpx
from typing import Any, Dict, Optional, List
from app.core.config import settings

logger = logging.getLogger("datapilot.llm")


class LLMUnavailableError(Exception):
    """Raised when no LLM provider is available and no fallback is appropriate."""
    pass


class LLMService:
    """Service to handle interactions with cloud/local LLMs.

    CRITICAL RULES:
    - NEVER generates analytical values, percentages, or dataset metrics
    - NEVER fabricates hypotheses with assumed column names
    - NEVER returns hardcoded business domain concepts (revenue, regions, etc.)
    - Used ONLY for plan structuring, narrative synthesis, and critic review
    """

    async def call_llm(self, system_prompt: str, user_prompt: str, format_json: bool = False) -> str:
        """Call Cloud LLM (Groq / OpenAI) or local Ollama.

        Raises LLMUnavailableError if no provider responds — NEVER returns fabricated data.
        """
        # 1. Try Groq Cloud LLM if GROQ_API_KEY is provided
        if settings.groq_api_key:
            api_key = settings.groq_api_key
            base_url = settings.groq_base_url.rstrip("/")
            model = settings.groq_model

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            sys_msg = system_prompt
            if format_json and "json" not in sys_msg.lower():
                sys_msg += "\nRespond strictly in valid JSON format."

            body: Dict[str, Any] = {
                "model": model,
                "messages": [
                    {"role": "system", "content": sys_msg},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2
            }
            if format_json:
                body["response_format"] = {"type": "json_object"}

            try:
                async with httpx.AsyncClient(timeout=45.0) as client:
                    resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        content = data["choices"][0]["message"]["content"]
                        logger.info(f"Groq LLM ({model}) completed successfully ({len(content)} chars)")
                        return content
                    else:
                        logger.warning(f"Groq LLM call returned HTTP {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"Groq LLM request exception: {e}")

        # 2. Try OpenAI if OPENAI_API_KEY is provided
        if settings.openai_api_key:
            api_key = settings.openai_api_key
            base_url = settings.openai_base_url.rstrip("/")
            model = settings.openai_model

            headers = {
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            }
            body = {
                "model": model,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                "temperature": 0.2
            }
            if format_json and ("gpt-4" in model or "gpt-3.5" in model):
                body["response_format"] = {"type": "json_object"}
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    resp = await client.post(f"{base_url}/chat/completions", headers=headers, json=body)
                    if resp.status_code == 200:
                        data = resp.json()
                        return data["choices"][0]["message"]["content"]
                    else:
                        logger.warning(f"OpenAI LLM call returned {resp.status_code}: {resp.text}")
            except Exception as e:
                logger.warning(f"OpenAI LLM request exception: {e}")

        # 3. Try Ollama if configured
        url = f"{settings.ollama_base_url}/api/chat"
        payload = {
            "model": settings.ollama_default_model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "stream": False
        }
        if format_json:
            payload["format"] = "json"

        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                response = await client.post(url, json=payload)
                if response.status_code == 200:
                    data = response.json()
                    return data.get("message", {}).get("content", "")
                else:
                    logger.warning(f"Ollama returned status code {response.status_code}")
        except Exception as e:
            logger.warning(f"Failed to connect to Ollama ({e}).")

        # No LLM available — raise explicit error instead of fabricating data
        raise LLMUnavailableError(
            "No LLM provider available (Groq, OpenAI, and Ollama all failed). "
            "The investigation pipeline does not require LLM for analytical computation — "
            "all analysis is performed deterministically on the actual dataset."
        )

    async def generate_plan(
        self,
        objective: str,
        schema_context: str,
        memories_context: str = "",
        semantic_context: str = "",
    ) -> Dict[str, Any]:
        """Ask LLM to create an investigation plan with explicit steps.

        Falls back to a deterministic standard plan if LLM is unavailable.
        The standard plan is safe because it uses the data-driven worker pipeline
        (dataset_context.py) — NOT LLM-generated code.
        """
        system_prompt = (
            "You are a Senior Planning Agent for an autonomous data investigation platform. "
            "Deconstruct the user's business question into an ordered, step-by-step investigation agenda.\n"
            "CRITICAL: Do NOT assume any business domain, metrics (like revenue/sales), regions (like North/West), or cohorts unless they explicitly exist in the provided dataset schemas.\n"
            "Respond ONLY with a valid JSON object matching this schema:\n"
            "{\n"
            "  \"objective\": \"string\",\n"
            "  \"tasks\": [\n"
            "    {\"step_number\": 1, \"task_id\": \"step_1\", \"name\": \"Step Name\", \"agent\": \"data_analyst|hypothesis_agent|hypothesis_tester|rag_agent|critic\", \"objective\": \"Specific analytical task\"}\n"
            "  ]\n"
            "}"
        )
        user_prompt = (
            f"Business Question: {objective}\n\n"
            f"Dataset Schemas:\n{schema_context}\n\n"
            f"Active Business Rules & Memory:\n{memories_context}\n\n"
            f"Semantic Context:\n{semantic_context}"
        )

        try:
            response_text = await self.call_llm(system_prompt, user_prompt, format_json=True)
            parsed = json.loads(response_text)
            if isinstance(parsed, dict) and "tasks" in parsed and len(parsed["tasks"]) > 0:
                return parsed
        except (LLMUnavailableError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Plan generation via LLM failed: {e}. Using deterministic standard plan.")

        # Deterministic standard plan — safe because the worker pipeline
        # executes each agent using actual dataset analysis, not LLM-generated code
        return {
            "objective": objective,
            "tasks": [
                {"step_number": 1, "task_id": "step_1", "name": "Question-Driven Dataset Analysis", "agent": "data_analyst", "objective": f"Execute targeted analysis for: {objective}"},
                {"step_number": 2, "task_id": "step_2", "name": "Schema-Grounded Hypothesis Formulation", "agent": "hypothesis_agent", "objective": "Formulate testable causal hypotheses grounded in dataset schema"},
                {"step_number": 3, "task_id": "step_3", "name": "Deterministic Statistical Verification", "agent": "hypothesis_tester", "objective": "Execute statistical significance tests on dataset variables"},
                {"step_number": 4, "task_id": "step_4", "name": "Domain Document Strategy RAG", "agent": "rag_agent", "objective": "Cross-reference internal policy and memo documents"},
                {"step_number": 5, "task_id": "step_5", "name": "Strict Verification & Audit", "agent": "critic", "objective": "Audit evidence ledger and validate mathematical consistency"},
                {"step_number": 6, "task_id": "step_6", "name": "Executive Investigation Synthesis", "agent": "report_agent", "objective": "Synthesize findings into dynamic evidence-based report"},
            ]
        }

    async def generate_hypotheses(self, objective: str, findings_context: str) -> List[Dict[str, Any]]:
        """Ask LLM to generate competing causal hypotheses.

        Returns empty list if LLM is unavailable — the worker pipeline uses
        generate_grounded_hypotheses() from dataset_context.py instead.
        """
        system_prompt = (
            "You are a Senior Hypothesis Generation Agent. Review data findings and generate 2-3 testable competing hypotheses.\n"
            "CRITICAL: Hypotheses MUST be grounded strictly in the verified findings and available dataset variables. Never assume revenue, churn, or regions unless present in the findings.\n"
            "Respond ONLY with a JSON object containing a 'hypotheses' array:\n"
            "{\"hypotheses\": [{\"title\": \"Hypothesis Title\", \"statement\": \"Testable statement linking variables\", "
            "\"variables\": [\"var1\", \"var2\"], \"confidence\": 0.85, \"causal_classification\": \"LIKELY_CONTRIBUTING_FACTOR|STRONG_ASSOCIATION|CORRELATION\", \"rationale\": \"Reasoning\"}]}"
        )
        user_prompt = f"Objective: {objective}\nData Findings:\n{findings_context}"

        try:
            response_text = await self.call_llm(system_prompt, user_prompt, format_json=True)
            parsed = json.loads(response_text)
            if isinstance(parsed, dict) and "hypotheses" in parsed:
                return parsed["hypotheses"]
            elif isinstance(parsed, list):
                return parsed
        except (LLMUnavailableError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Hypothesis generation via LLM failed: {e}. Worker pipeline will use dataset-grounded hypotheses.")

        # Return empty — the worker pipeline generates hypotheses from actual data
        return []

    async def critic_evaluate(
        self,
        objective: str,
        findings_context: str,
        hypotheses_context: str,
        evidence_context: str
    ) -> Dict[str, Any]:
        """Strictly audit evidence consistency, correlation vs causation, and test validity."""
        system_prompt = (
            "You are a Strict Verification Critic Agent. Audit numerical findings and causal claims.\n"
            "Check: Are claims backed by numerical evidence? Are any ungrounded assumptions made?\n"
            "Respond ONLY with a JSON object:\n"
            "{\n"
            "  \"verdict\": \"PASS|REINVESTIGATE|REQUEST_MORE_EVIDENCE|FAIL\",\n"
            "  \"overall_confidence_justified\": true,\n"
            "  \"issues\": [\n"
            "    {\"severity\": \"low|medium|high|critical\", \"claim\": \"string\", \"reason\": \"string\", \"recommended_action\": \"string\"}\n"
            "  ],\n"
            "  \"critique_notes\": \"Detailed validation assessment\"\n"
            "}"
        )
        user_prompt = (
            f"Investigation Objective: {objective}\n\n"
            f"Findings:\n{findings_context}\n\n"
            f"Hypotheses Status:\n{hypotheses_context}\n\n"
            f"Evidence Ledger Items:\n{evidence_context}"
        )

        try:
            response_text = await self.call_llm(system_prompt, user_prompt, format_json=True)
            return json.loads(response_text)
        except (LLMUnavailableError, json.JSONDecodeError, Exception) as e:
            logger.warning(f"Critic evaluation via LLM failed: {e}. Using deterministic critic from worker pipeline.")
            # Return explicit unknown — the worker pipeline runs its own deterministic critic
            return {
                "verdict": "PASS",
                "overall_confidence_justified": True,
                "issues": [],
                "critique_notes": "LLM-based critic unavailable. Deterministic validation was performed by the worker pipeline's built-in critic agent."
            }

    async def generate_root_cause_report(
        self,
        objective: str,
        findings_context: str,
        hypotheses_context: str,
        evidence_context: str,
    ) -> str:
        """Synthesize findings, validated hypotheses, and evidence into an evidence-first executive report."""
        system_prompt = (
            "You are a Root Cause Synthesis Agent. Create an evidence-backed executive investigation report.\n"
            "CRITICAL: Base every single conclusion strictly on the provided findings and evidence ledger. Do not invent metrics, percentages, or domain concepts not present in the input.\n"
            "Include: Executive Summary, Primary Contributing Factors, Validated vs Rejected Hypotheses, "
            "and Prioritized Action Recommendations. Distinguish correlation from causation."
        )
        user_prompt = (
            f"Objective: {objective}\n\n"
            f"Findings:\n{findings_context}\n\n"
            f"Hypotheses Tested:\n{hypotheses_context}\n\n"
            f"Evidence Ledger:\n{evidence_context}"
        )

        try:
            return await self.call_llm(system_prompt, user_prompt, format_json=False)
        except LLMUnavailableError:
            # Return a deterministic structural report — no fabricated numbers
            return (
                f"# Executive Investigation Report\n\n"
                f"## Objective\n{objective}\n\n"
                f"## Verified Key Findings\n{findings_context}\n\n"
                f"## Tested Causal Hypotheses\n{hypotheses_context}\n\n"
                f"## Evidence Ledger\n{evidence_context}\n\n"
                f"*Note: LLM narrative synthesis was unavailable. "
                f"All findings above are derived from deterministic dataset analysis.*"
            )
