from __future__ import annotations

import json
import logging

from openai import AsyncOpenAI

from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.prompts.rca_system import RCA_SYSTEM_PROMPT
from app.schemas.kubernetes import KubernetesAnalysisResult
from app.schemas.logs import LogAnalysisResult
from app.schemas.metrics import MetricsAnalysisResult
from app.schemas.prediction import PredictionResponse
from app.schemas.rca import LLMRCAResult, RCARequest, RecommendationResult


logger = logging.getLogger(__name__)


class OpenAIRCAService:
    def __init__(
        self,
        api_key: str,
        model: str,
        timeout_seconds: float,
    ):
        self.model = model
        self.client = AsyncOpenAI(
            api_key=api_key,
            timeout=timeout_seconds,
            max_retries=2,
        )

    async def analyze(
        self,
        payload: RCARequest,
        prediction: PredictionResponse | None,
        metrics: MetricsAnalysisResult,
        logs: LogAnalysisResult,
        kubernetes: KubernetesAnalysisResult,
        historical: HistoricalContext,
        fallback_recommendation: RecommendationResult,
    ) -> LLMRCAResult:
        kubernetes_data = payload.kubernetes.model_dump()
        kubernetes_data["events"] = kubernetes_data.get("events", [])[-100:]
        incident_data = {
            "CURRENT_INCIDENT": {
                "service_id": payload.service_id,
                "pod_id": payload.pod_id,
                "metrics": payload.metrics.model_dump(),
                "metric_sequence": [
                    item.model_dump() for item in (payload.metric_sequence or [])[-12:]
                ],
            },
            "GRU_PREDICTION": prediction.model_dump() if prediction else None,
            "RULE_ENGINE": payload.rule_engine,
            "METRICS": metrics.model_dump(),
            # Send only filtered/deduplicated incident logs, never the full history.
            "LOGS": logs.model_dump(),
            "KUBERNETES": {
                "current": kubernetes_data,
                "analysis": kubernetes.model_dump(),
            },
            "DEPLOYMENT": payload.deployment.model_dump() if payload.deployment else None,
            "HEALTH_CHECK": payload.health_check.model_dump() if payload.health_check else None,
            "PREVIOUS_ACTION": {
                "action": payload.previous_action,
                "result": payload.previous_action_result,
                "result_source": payload.previous_action_result_source,
                "previous_root_cause": payload.previous_rca_root_cause,
            },
            "HISTORICAL_INCIDENTS": [
                {
                    **item.model_dump(exclude={"evidence", "operator_feedback"}),
                    "evidence": [evidence[:2000] for evidence in item.evidence[:20]],
                    "operator_feedback": (
                        item.operator_feedback[:2000] if item.operator_feedback else None
                    ),
                }
                for item in historical.incidents
            ],
            "SECURITY": payload.security.model_dump() if payload.security else None,
            "SECURITY_POLICY": (
                {
                    **payload.security_policy.model_dump(),
                    "request_threshold_unit": "requests/second",
                    "failed_auth_threshold_unit": (
                        "failed authentication attempts/aggregation window"
                    ),
                    "owner": "Main Backend/Policy Engine",
                }
                if payload.security_policy
                else None
            ),
        }
        response = await self.client.responses.parse(
            model=self.model,
            input=[
                {"role": "system", "content": RCA_SYSTEM_PROMPT},
                {
                    "role": "user",
                    "content": "INCIDENT_DATA:\n" + json.dumps(incident_data, ensure_ascii=False),
                },
            ],
            text_format=LLMRCAResult,
            store=False,
            max_output_tokens=1500,
        )
        result = response.output_parsed
        if result is None:
            raise RuntimeError("OpenAI returned no parsed RCA output")
        allowed_ids = set(historical.similar_incident_ids)
        result.similar_incident_ids = [
            item for item in result.similar_incident_ids if item in allowed_ids
        ]
        if not result.historical_context_used or not result.similar_incident_ids:
            result.historical_context_used = False
            result.similar_incident_ids = []
        return self._enforce_action_evidence(
            result,
            payload,
            fallback_recommendation,
        )

    @staticmethod
    def _enforce_action_evidence(
        result: LLMRCAResult,
        payload: RCARequest,
        fallback_recommendation: RecommendationResult | None = None,
    ) -> LLMRCAResult:
        if (
            payload.previous_action
            and payload.previous_action_result in {"FAILED", "PARTIAL"}
        ):
            previous_failure_evidence = (
                f"Previous {payload.previous_action} action result was "
                f"{payload.previous_action_result}"
            )
            if previous_failure_evidence not in result.evidence:
                result.evidence.append(previous_failure_evidence)

        action = result.recommendation.action
        if action == "ROLLBACK_DEPLOYMENT" and payload.deployment is None:
            result.recommendation = RecommendationResult(
                action="NO_ACTION",
                reason="Deployment evidence is required before recommending rollback",
                priority="LOW",
            )
        security = payload.security
        security_policy = payload.security_policy
        has_ip_anomaly = bool(
            security
            and security_policy
            and security.supports_temporary_ip_block(
                security_policy.request_threshold,
                security_policy.failed_auth_threshold,
            )
        )
        if action == "TEMPORARY_IP_BLOCK" and not has_ip_anomaly:
            if (
                fallback_recommendation is not None
                and fallback_recommendation.action != "TEMPORARY_IP_BLOCK"
            ):
                result.recommendation = fallback_recommendation
            else:
                result.recommendation = RecommendationResult(
                    action="NO_ACTION",
                    reason=(
                        "Temporary IP blocking lacks sufficient security evidence, and no "
                        "other action is supported by current evidence"
                    ),
                    priority="LOW",
                )
        action = result.recommendation.action
        if (
            payload.previous_action_result in {"FAILED", "PARTIAL"}
            and action == payload.previous_action
        ):
            result_cause = normalize_cause(result.root_cause.cause)
            successful_retry = any(
                incident.incident_id in result.similar_incident_ids
                and (incident.executed_action or incident.recommended_action) == action
                and incident.action_result == "SUCCESS"
                and normalize_cause(incident.confirmed_root_cause or incident.root_cause)
                == result_cause
                for incident in payload.historical_incidents
            )
            current_evidence = [
                item for item in result.evidence
                if not item.startswith("Similar incident")
                and not item.startswith("Previous ")
            ]
            strong_new_evidence = (
                result.root_cause.confidence >= 0.75 and len(current_evidence) >= 2
            )
            if not successful_retry and not strong_new_evidence:
                result.recommendation = RecommendationResult(
                    action="NO_ACTION",
                    reason=(
                        f"Previous {payload.previous_action} result was "
                        f"{payload.previous_action_result}; it is not prioritized "
                        "because current evidence is not strong enough to repeat it"
                    ),
                    priority="LOW",
                )
        return result
