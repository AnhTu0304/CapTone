from __future__ import annotations

from dataclasses import dataclass

from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.rca.cause_evaluator import CauseEvaluator
from app.rca.evidence_collector import EvidenceCollector
from app.rca.evidence_validator import EvidenceValidator
from app.rca.severity_evaluator import SeverityEvaluator
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.logs import LogAnalysisResult
from app.schemas.metrics import MetricPoint, MetricsAnalysisResult
from app.schemas.prediction import PredictionResponse
from app.schemas.rca import ActionHistoryContext, RCARequest, RootCauseResult


@dataclass
class RCAConclusion:
    result: RootCauseResult
    evidence: list[str]
    cause_code: str
    explanation: str
    historical_context_used: bool = False
    similar_incident_ids: list[str] | None = None


class RootCauseAnalysisAgent:
    """Orchestrator for Evidence-Based Root Cause Analysis (RCA).

    Executes a 6-stage pipeline:
    Stage 1: Input Validation & Request Normalization
    Stage 2: Structured Evidence Collection (Metrics, Logs, Kubernetes Events, Pod Terminations, Node State)
    Stage 3: Evidence Validation & Contradiction Detection
    Stage 4: Evidence-Based Cause Evaluation (Eliminates arbitrary GRU linear score inflation)
    Stage 5: Independent Severity Evaluation (Service availability & SLO impact, not action failures)
    Stage 6: Structured SRE RCA Output Generation
    """

    CAUSE_LABELS = {
        "memory_exhaustion": "Container memory exhausted",
        "storage_exhaustion": "Storage capacity exhausted",
        "cpu_saturation": "CPU saturation",
        "traffic_overload": "Traffic overload",
        "unstable_pod": "Unstable application pod",
        "deployment_failure": "Deployment failure",
        "dependency_failure": "Upstream dependency failure",
        "application_failure": "Application errors",
        "service_degradation": "Service performance degradation",
        "insufficient_replicas": "Insufficient available replicas",
        "scheduling_failure": "Kubernetes scheduling failure",
        "underutilized": "Workload underutilized (scale down opportunity)",
        "probe_configuration_error": "Probe configuration error",
        "network_degradation": "Network degradation",
        "unknown": "UNKNOWN",
    }

    CAUSE_LABELS_VI = {
        "memory_exhaustion": "Cạn kiệt bộ nhớ container (OOM)",
        "storage_exhaustion": "Cạn kiệt dung lượng lưu trữ",
        "cpu_saturation": "Bão hòa tài nguyên CPU",
        "traffic_overload": "Quá tải lưu lượng truy cập",
        "unstable_pod": "Pod ứng dụng bất ổn định / CrashLoop",
        "deployment_failure": "Lỗi triển khai phiên bản mới",
        "dependency_failure": "Lỗi dịch vụ phụ thuộc thượng nguồn",
        "application_failure": "Lỗi ứng dụng nội bộ (HTTP 5xx)",
        "service_degradation": "Suy giảm hiệu năng dịch vụ",
        "insufficient_replicas": "Không đủ số lượng Pod replica",
        "scheduling_failure": "Lỗi lập lịch điều phối Kubernetes",
        "underutilized": "Tài nguyên dư thừa (Có thể thu hẹp quy mô)",
        "probe_configuration_error": "Lỗi cấu hình kiểm tra probe",
        "network_degradation": "Suy giảm kết nối mạng",
        "unknown": "CHƯA XÁC ĐỊNH",
    }

    RISK_CAUSES = {
        "CPU_OVERLOAD": "cpu_saturation",
        "OOM": "memory_exhaustion",
        "DISK_FULL": "storage_exhaustion",
        "HIGH_LATENCY": "service_degradation",
        "HTTP_5XX_SPIKE": "application_failure",
        "TRAFFIC_OVERLOAD": "traffic_overload",
        "SCALE_DOWN_CANDIDATE": "underutilized",
    }

    def __init__(self) -> None:
        self.collector = EvidenceCollector()
        self.validator = EvidenceValidator()
        self.cause_evaluator = CauseEvaluator()
        self.severity_evaluator = SeverityEvaluator()

    def analyze(
        self,
        prediction: PredictionResponse | None,
        metrics: MetricsAnalysisResult,
        logs: LogAnalysisResult,
        kubernetes: KubernetesAnalysisResult,
        kubernetes_raw: KubernetesData,
        historical: HistoricalContext | None = None,
        previous_action: str | None = None,
        previous_action_result: str | None = None,
        previous_rca_root_cause: str | None = None,
        action_history: ActionHistoryContext | None = None,
        payload: RCARequest | None = None,
    ) -> RCAConclusion:
        historical = historical or HistoricalContext()

        # ========================================================
        # STAGE 1: INPUT VALIDATION & REQUEST NORMALIZATION
        # ========================================================
        effective_payload = payload
        if effective_payload is None:
            # Reconstruct lightweight request adapter for collection and validation
            parsed_cpu = 0.0
            parsed_ram = 0.0
            parsed_disk = 0.0
            parsed_latency = 0.0
            parsed_req_rate = 0.0
            parsed_5xx = 0.0

            for f in metrics.findings:
                f_lower = f.lower()
                if "cpu" in f_lower and "%" in f:
                    try:
                        parsed_cpu = float(f.split("(")[1].split("%")[0])
                    except Exception:
                        parsed_cpu = 95.0
                if "ram" in f_lower and "%" in f:
                    try:
                        parsed_ram = float(f.split("(")[1].split("%")[0])
                    except Exception:
                        parsed_ram = 95.0
                if "độ trễ" in f_lower or "latency" in f_lower:
                    try:
                        parsed_latency = float(f.split("(")[1].split("ms")[0].split()[0])
                    except Exception:
                        parsed_latency = 700.0
                if "lưu lượng" in f_lower or "request" in f_lower:
                    try:
                        parsed_req_rate = float(f.split("(")[1].split(")")[0])
                    except Exception:
                        parsed_req_rate = 1000.0
                if "5xx" in f_lower:
                    try:
                        parsed_5xx = float(f.split("(")[1].split("%")[0])
                    except Exception:
                        parsed_5xx = 10.0

            effective_payload = RCARequest(
                service_id=kubernetes_raw.workload_name or "workload",
                pod_id=kubernetes.target_pod_id,
                suspected_pod_name=kubernetes.target_pod_name,
                cluster_id=kubernetes_raw.cluster_id,
                namespace=kubernetes_raw.namespace,
                metrics=MetricPoint(
                    cpu=parsed_cpu,
                    ram=parsed_ram,
                    disk=parsed_disk,
                    latency=parsed_latency,
                    request_rate=parsed_req_rate,
                    http_5xx_rate=parsed_5xx,
                    pod_restart_count=kubernetes_raw.restart_count,
                    replica_count=kubernetes_raw.available_replicas or 1,
                ),
                logs=logs.important_logs,
                kubernetes=kubernetes_raw,
                action_history=action_history,
                previous_action=previous_action,
                previous_action_result=previous_action_result,
                previous_rca_root_cause=previous_rca_root_cause,
            )

        # ========================================================
        # STAGE 2: STRUCTURED EVIDENCE COLLECTION
        # ========================================================
        evidences = self.collector.collect(
            effective_payload,
            metrics_result=metrics,
            log_result=logs,
            kubernetes_result=kubernetes,
            kubernetes_raw=kubernetes_raw,
        )

        # ========================================================
        # STAGE 3: EVIDENCE VALIDATION & CONTRADICTION ENGINE
        # ========================================================
        incident_context = {
            "target_resource": f"pod/{kubernetes.target_pod_name or effective_payload.pod_id or 'workload'}",
            "target_uid": kubernetes.target_pod_id or effective_payload.pod_id,
            "cluster_id": kubernetes_raw.cluster_id or effective_payload.cluster_id,
            "has_metrics": bool(effective_payload.metrics),
            "has_logs": bool(effective_payload.logs),
            "has_events": bool(kubernetes_raw.events),
            "gru_predictions": [
                {"risk_type": r.risk_type, "confidence": r.confidence}
                for r in (prediction.detected_risks if prediction else [])
            ],
        }

        # If previous action was REPLACE_POD, link historical pod UIDs
        if action_history and action_history.history:
            historical_uids = [
                item.target_id for item in action_history.history
                if item.target_id and item.target_id != (kubernetes.target_pod_id or effective_payload.pod_id)
            ]
            incident_context["historical_pod_uids"] = historical_uids

        validation_result = self.validator.validate(evidences, incident_context)

        # ========================================================
        # STAGE 4: CAUSE EVALUATION (EVIDENCE-BASED, NO GRU SCORING)
        # ========================================================
        cause_eval = self.cause_evaluator.evaluate(
            validation_result=validation_result,
            prediction=prediction,
            kubernetes_analysis=kubernetes,
            kubernetes_raw=kubernetes_raw,
            payload=effective_payload,
        )

        # ========================================================
        # STAGE 5: INDEPENDENT SEVERITY EVALUATION
        # ========================================================
        effective_slo = getattr(effective_payload, "workload_slo", None) or getattr(effective_payload, "slo", None)
        severity = self.severity_evaluator.evaluate(
            valid_evidences=validation_result.valid_evidences,
            kubernetes_raw=kubernetes_raw,
            kubernetes_analysis=kubernetes,
            metrics=effective_payload.metrics,
            cause_code=cause_eval.cause_code,
            is_primary_database=kubernetes.is_primary_database,
            workload_slo=effective_slo,
        )

        # ========================================================
        # STAGE 6: STRUCTURED SRE OUTPUT GENERATION
        # ========================================================
        root_cause_result = RootCauseResult(
            cause=cause_eval.cause_label,
            confidence=round(cause_eval.confidence, 4),
            severity=severity,
            evidence_status=cause_eval.evidence_status,
            evidence_for=cause_eval.evidence_for,
            evidence_against=cause_eval.evidence_against,
            missing_evidence=cause_eval.missing_evidence,
            related_risks=cause_eval.related_risks,
            symptoms=cause_eval.symptoms,
        )

        # Compile flat evidence strings for backward compatibility
        final_evidence_list: list[str] = []
        if cause_eval.cause_code == "unknown" and not cause_eval.evidence_for:
            final_evidence_list = ["insufficient_evidence"]
        else:
            final_evidence_list = list(dict.fromkeys(cause_eval.evidence_for))
            if not final_evidence_list:
                final_evidence_list = [e.description for e in validation_result.valid_evidences[:5]]

        # If there are matching prediction risks for this cause, include them as supporting signal
        if prediction and prediction.detected_risks:
            for r in prediction.detected_risks:
                if self.RISK_CAUSES.get(r.risk_type) == cause_eval.cause_code:
                    pred_ev = f"GRU predicted {r.risk_type} ({r.confidence:.1%})"
                    if pred_ev not in final_evidence_list:
                        final_evidence_list.append(pred_ev)

        # Append previous failure evidence context if present
        if action_history and action_history.consecutive_failures > 0:
            final_evidence_list.append(
                f"Action history recorded {action_history.consecutive_failures} consecutive failure(s) "
                f"(Lịch sử ghi nhận {action_history.consecutive_failures} lần thất bại liên tiếp, "
                f"circuit_breaker_tripped={action_history.circuit_breaker_tripped or action_history.consecutive_failures >= 2})"
            )
        elif previous_action and previous_action_result in {"FAILED", "PARTIAL"}:
            final_evidence_list.append(
                f"Previous {previous_action} action result was {previous_action_result} "
                f"(Hành động {previous_action} trước đó có kết quả: {previous_action_result})"
            )

        # Include historical incidents references as supporting context for backward compatibility
        for incident in historical.incidents:
            historical_cause = normalize_cause(incident.confirmed_root_cause or incident.root_cause or incident.predicted_root_cause)
            source = "confirmed" if incident.confirmed_root_cause else ("recorded" if incident.root_cause else "predicted")
            detail = (
                f"Similar incident {incident.incident_id} had {source} root cause "
                f"{incident.confirmed_root_cause or incident.root_cause or incident.predicted_root_cause}"
            )
            if incident.executed_action and incident.action_result:
                detail += f"; {incident.executed_action} result was {incident.action_result}"
            if detail not in final_evidence_list:
                final_evidence_list.append(detail)

        # Compose comprehensive explanation
        explanation_parts = [
            f"Bằng chứng sự cố hiện tại ủng hộ mạnh nhất nguyên nhân: {cause_eval.cause_label_vi} "
            f"(Trạng thái xác minh: {cause_eval.evidence_status}, mức độ nghiêm trọng: {severity}, độ tin cậy: {round(cause_eval.confidence * 100)}%)."
        ]
        if cause_eval.evidence_for:
            top_for = "; ".join(e.rstrip(".") for e in cause_eval.evidence_for[:3])
            explanation_parts.append(f"Tín hiệu xác thực ghi nhận trực tiếp: {top_for}.")
        if cause_eval.evidence_against:
            top_against = "; ".join(a.rstrip(".") for a in cause_eval.evidence_against[:2])
            explanation_parts.append(f"Tín hiệu đối chứng/phản bác: {top_against}.")
        if kubernetes.is_primary_database:
            explanation_parts.append(
                "Workload đang giữ vai trò PRIMARY trong Replica Set; các hành động tự động nguy cơ cao bị khóa để bảo toàn dữ liệu."
            )
        if historical.similar_incident_ids:
            explanation_parts.append(
                "Các sự cố tương đồng " + ", ".join(historical.similar_incident_ids)
                + " được sử dụng làm thông tin đối chiếu bổ trợ."
            )

        return RCAConclusion(
            result=root_cause_result,
            evidence=final_evidence_list,
            cause_code=cause_eval.cause_code,
            explanation=" ".join(explanation_parts),
            historical_context_used=bool(historical.similar_incident_ids),
            similar_incident_ids=historical.similar_incident_ids,
        )
