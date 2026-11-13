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
from app.agents.recommendation_agent import _extract_latest_failure_detail
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
                "request_id": payload.request_id,
                "incident_id": payload.incident_id,
                "cluster_id": payload.cluster_id,
                "namespace": payload.namespace,
                "service_id": payload.service_id,
                "workload_id": payload.workload_id,
                "workload_type": payload.workload_type,
                "suspected_pod_name": payload.suspected_pod_name,
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
            "ACTION_HISTORY": payload.action_history.model_dump() if payload.action_history else None,
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
                f"Previous {payload.previous_action} action result was {payload.previous_action_result} "
                f"(Lần thực thi hành động {payload.previous_action} trước đó có kết quả: {payload.previous_action_result})"
            )
            if previous_failure_evidence not in result.evidence:
                result.evidence.append(previous_failure_evidence)

        blocked_set = set(payload.action_history.blocked_actions) if payload.action_history else set()
        consecutive_failures = payload.action_history.consecutive_failures if payload.action_history else 0
        prev_act_norm = (payload.previous_action or "").upper().strip().replace(" ", "_")

        # Bậc thang Cấp 2: Nếu RESTART_POD thất bại (consecutive_failures < 2) -> Leo thang lên REPLACE_POD
        if (
            (prev_act_norm in {"RESTART_POD", "RESTART_DEPLOYMENT"} and payload.previous_action_result in {"FAILED", "PARTIAL"})
            or (consecutive_failures == 1 and "RESTART_POD" in blocked_set and "REPLACE_POD" not in blocked_set)
        ) and "REPLACE_POD" not in blocked_set and consecutive_failures < 2:
            if result.recommendation.action in {"RESTART_POD", "RESTART_DEPLOYMENT", "NO_ACTION"}:
                result.recommendation.action = "REPLACE_POD"
                result.recommendation.reason = (
                    f"Hành động {payload.previous_action or 'RESTART_POD'} ở Cấp 1 có kết quả hậu kiểm là {payload.previous_action_result or 'FAILED'}; "
                    "hệ thống phân tích RCA lại trên dữ liệu mới và leo thang lên Cấp 2: REPLACE_POD (xóa đích danh Pod lỗi để tạo container mới tinh)."
                )

        # Bậc thang Cấp 3: Circuit Breaker & Node Recovery Enforcement
        if payload.action_history or (prev_act_norm == "REPLACE_POD" and payload.previous_action_result in {"FAILED", "PARTIAL"}):
            ah = payload.action_history
            latest_err = _extract_latest_failure_detail(ah)
            detail_suffix = f" Lỗi gần nhất: {latest_err}." if latest_err else ""
            if (
                fallback_recommendation is not None
                and fallback_recommendation.action == "DRAIN_NODE"
                and not (ah and ah.circuit_breaker_tripped)
            ):
                result.recommendation.action = "DRAIN_NODE"
                result.recommendation.reason = fallback_recommendation.reason
            elif (ah and (ah.consecutive_failures >= 2 or ah.circuit_breaker_tripped)) or (
                prev_act_norm == "REPLACE_POD" and payload.previous_action_result in {"FAILED", "PARTIAL"}
            ):
                result.recommendation.action = "NO_ACTION"
                result.recommendation.priority = "CRITICAL"
                if fallback_recommendation is not None and fallback_recommendation.action == "NO_ACTION":
                    result.recommendation.reason = fallback_recommendation.reason
                else:
                    result.recommendation.reason = (
                        f"Phát hiện lặp sự cố liên tiếp ({max(consecutive_failures, 2)} lần thử trước đó đều thất bại). "
                        f"Kích hoạt Circuit Breaker chuyển quyền điều khiển cho kỹ sư vận hành (Human-in-the-Loop).{detail_suffix}"
                    )
            elif result.recommendation.action in blocked_set:
                blocked_name = result.recommendation.action
                result.recommendation.action = "NO_ACTION"
                result.recommendation.reason = (
                    f"Hành động '{blocked_name}' nằm trong danh sách blocked_actions do lịch sử thất bại gần đây.{detail_suffix}"
                )

        action = result.recommendation.action
        if action == "ROLLBACK_DEPLOYMENT" and payload.deployment is None:
            result.recommendation = RecommendationResult(
                action="NO_ACTION",
                reason="Cần có bằng chứng về bản triển khai (Deployment) trước khi đề xuất rollback",
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
                        "Hành động chặn IP tạm thời chưa có đủ bằng chứng bảo mật và không có "
                        "hành động nào khác được hỗ trợ bởi bằng chứng hiện tại"
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
                and not item.startswith("Lần thực thi")
            ]
            strong_new_evidence = (
                result.root_cause.confidence >= 0.75 and len(current_evidence) >= 2
            )
            if not successful_retry and not strong_new_evidence:
                result.recommendation = RecommendationResult(
                    action="NO_ACTION",
                    reason=(
                        f"Hành động {payload.previous_action} trước đó có kết quả là "
                        f"{payload.previous_action_result}; không tiếp tục lặp lại hành động này "
                        "do chưa có bằng chứng mới đủ mạnh để xác thực an toàn"
                    ),
                    priority="LOW",
                )

        # Preserve target metadata and action parameters from fallback if missing
        if fallback_recommendation is not None:
            rec = result.recommendation
            fb = fallback_recommendation
            if not rec.target_type and fb.target_type:
                rec.target_type = fb.target_type
            if not rec.target_name and fb.target_name:
                rec.target_name = fb.target_name
            if not rec.target_id and fb.target_id:
                rec.target_id = fb.target_id
            if not rec.target_node and fb.target_node:
                rec.target_node = fb.target_node
            if not rec.action_parameters and fb.action_parameters:
                rec.action_parameters = fb.action_parameters
            elif rec.action_parameters and fb.action_parameters:
                if not rec.action_parameters.manual_playbook and fb.action_parameters.manual_playbook:
                    rec.action_parameters.manual_playbook = fb.action_parameters.manual_playbook
                if rec.action_parameters.target_replicas is None and fb.action_parameters.target_replicas is not None:
                    rec.action_parameters.target_replicas = fb.action_parameters.target_replicas

        return result
