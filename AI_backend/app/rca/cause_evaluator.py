from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.rca.models import (
    EvidenceAttribution,
    EvidenceItem,
    EvidenceSource,
    EvidenceType,
    ValidationResult,
)
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.prediction import PredictionResponse
from app.schemas.rca import RelatedRiskItem, RCARequest


@dataclass
class CauseEvaluationResult:
    """Evaluation result for candidate root cause.
    
    NOTE ON CONFIDENCE SCORES:
    Confidence scores (e.g., 0.95, 0.88, 0.80, 0.78, 0.75, 0.30) are heuristic operational scores
    calibrated to SRE policy thresholds (CONFIRMED vs PROBABLE vs INSUFFICIENT_EVIDENCE).
    They represent uncalibrated heuristic scores, not true Bayesian/frequentist probabilities.
    0.30 is the conventional baseline score for UNKNOWN / unverified states.
    """

    cause_code: str
    cause_label: str
    cause_label_vi: str
    evidence_status: str  # CONFIRMED, PROBABLE, INSUFFICIENT_EVIDENCE, CONFLICTING_EVIDENCE
    confidence: float
    evidence_for: list[str] = field(default_factory=list)
    evidence_against: list[str] = field(default_factory=list)
    missing_evidence: list[str] = field(default_factory=list)
    related_risks: list[RelatedRiskItem] = field(default_factory=list)
    symptoms: list[str] = field(default_factory=list)
    explanation: str = ""


class CauseEvaluator:
    """Evaluates candidate root causes based strictly on validated EvidenceItems, eliminating arbitrary scoring."""

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

    def evaluate(
        self,
        validation_result: ValidationResult,
        prediction: PredictionResponse | None = None,
        kubernetes_analysis: KubernetesAnalysisResult | None = None,
        kubernetes_raw: KubernetesData | None = None,
        payload: RCARequest | None = None,
    ) -> CauseEvaluationResult:
        valid_evs = validation_result.valid_evidences
        ev_types = {e.evidence_type for e in valid_evs}

        # Build related_risks strictly from GRU prediction (Prediction != Ground Truth)
        related_risks: list[RelatedRiskItem] = []
        if prediction and prediction.detected_risks:
            for r in prediction.detected_risks:
                related_risks.append(RelatedRiskItem(
                    risk_type=r.risk_type,
                    confidence=r.confidence,
                    description=f"Mô hình học sâu GRU cảnh báo nguy cơ {r.risk_type} ({r.confidence:.1%})",
                ))

        # Collect observed symptoms (Probe Timeout, Probe Failures, etc.)
        symptoms: list[str] = [
            e.description for e in valid_evs
            if e.evidence_type in {
                EvidenceType.PROBE_TIMEOUT,
                EvidenceType.LIVENESS_PROBE_FAILED,
                EvidenceType.READINESS_PROBE_FAILED,
            } or e.metadata.get("is_symptom")
        ]

        # Check for conflicting evidence (genuine conflicting telemetry only)
        if validation_result.conflicting_evidences:
            conflict_descriptions = [c[2] for c in validation_result.conflicting_evidences]
            return CauseEvaluationResult(
                cause_code="unknown",
                cause_label=self.CAUSE_LABELS["unknown"],
                cause_label_vi=self.CAUSE_LABELS_VI["unknown"],
                evidence_status="CONFLICTING_EVIDENCE",
                confidence=0.30,
                evidence_for=[c[0].description for c in validation_result.conflicting_evidences],
                evidence_against=conflict_descriptions,
                missing_evidence=["Cần đối chiếu lại dữ liệu viễn trắc và nhật ký do có mâu thuẫn giữa các nguồn"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Hệ thống phát hiện các bằng chứng mâu thuẫn trực tiếp giữa các nguồn viễn trắc thực tế; tạm dừng kết luận tự động.",
            )

        # ----------------------------------------------------
        # 1. EVALUATE: MEMORY_EXHAUSTION
        # ----------------------------------------------------
        has_oom_killed = EvidenceType.OOM_KILLED in ev_types
        has_high_ram = EvidenceType.HIGH_RAM_USAGE in ev_types
        has_ram_trend = EvidenceType.RAM_STEEP_INCREASE in ev_types
        has_node_mem_press = EvidenceType.NODE_MEMORY_PRESSURE in ev_types
        has_oom_log = EvidenceType.LOG_OOM_PATTERN in ev_types
        has_normal_ram = EvidenceType.NORMAL_RAM_USAGE in ev_types
        has_exit_137_non_oom = EvidenceType.EXIT_CODE_137_NON_OOM in ev_types

        if has_oom_killed:
            oom_evs = [e.description for e in valid_evs if e.evidence_type == EvidenceType.OOM_KILLED]
            return CauseEvaluationResult(
                cause_code="memory_exhaustion",
                cause_label=self.CAUSE_LABELS["memory_exhaustion"],
                cause_label_vi=self.CAUSE_LABELS_VI["memory_exhaustion"],
                evidence_status="CONFIRMED",
                confidence=0.95,
                evidence_for=oom_evs,
                evidence_against=[],
                missing_evidence=[],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Bằng chứng xác thực trực tiếp: Container bị Linux Kernel OOM-Killer tiêu diệt (OOMKilled).",
            )

        if has_high_ram and (has_ram_trend or has_oom_log or has_node_mem_press):
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type in {EvidenceType.HIGH_RAM_USAGE, EvidenceType.RAM_STEEP_INCREASE, EvidenceType.LOG_OOM_PATTERN, EvidenceType.NODE_MEMORY_PRESSURE}
            ]
            return CauseEvaluationResult(
                cause_code="memory_exhaustion",
                cause_label=self.CAUSE_LABELS["memory_exhaustion"],
                cause_label_vi=self.CAUSE_LABELS_VI["memory_exhaustion"],
                evidence_status="PROBABLE",
                confidence=0.75,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa ghi nhận sự kiện OOMKilled trực tiếp từ Kubelet"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Mức sử dụng RAM bão hòa ở ngưỡng nguy hiểm kèm xu hướng tăng dốc hoặc nhật ký cảnh báo bộ nhớ.",
            )

        # ----------------------------------------------------
        # 2. EVALUATE: DEPLOYMENT_FAILURE
        # ----------------------------------------------------
        has_image_pull = EvidenceType.IMAGE_PULL_BACKOFF in ev_types
        has_failed_sched = EvidenceType.FAILED_SCHEDULING in ev_types

        if has_image_pull:
            for_items = [e.description for e in valid_evs if e.evidence_type == EvidenceType.IMAGE_PULL_BACKOFF]
            return CauseEvaluationResult(
                cause_code="deployment_failure",
                cause_label=self.CAUSE_LABELS["deployment_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["deployment_failure"],
                evidence_status="CONFIRMED",
                confidence=0.92,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa có nhật ký chi tiết từ Image Registry để xác định lỗi mạng hay xác thực"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Xác nhận lỗi kéo container image (ImagePullBackOff); không võ đoán nguyên nhân Registry nếu chưa có logs.",
            )

        if has_failed_sched:
            for_items = [e.description for e in valid_evs if e.evidence_type == EvidenceType.FAILED_SCHEDULING]
            return CauseEvaluationResult(
                cause_code="deployment_failure",
                cause_label=self.CAUSE_LABELS["deployment_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["deployment_failure"],
                evidence_status="CONFIRMED",
                confidence=0.92,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=[],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Kubernetes Scheduler không thể xếp lịch cho Pod (FailedScheduling) do không đủ tài nguyên khả dụng trên cụm.",
            )

        has_deploy_event = any(
            "deploy fail" in e.description.lower()
            or "rollout fail" in e.description.lower()
            or "deployment fail" in e.description.lower()
            or "deploy" in e.description.lower()
            for e in valid_evs
        )
        has_degraded_rollout = bool(
            kubernetes_raw
            and kubernetes_raw.deployment
            and kubernetes_raw.deployment.version
            and kubernetes_raw.deployment.previous_version
            and kubernetes_raw.deployment.version != kubernetes_raw.deployment.previous_version
            and kubernetes_raw.deployment.available_replicas is not None
            and kubernetes_raw.deployment.desired_replicas is not None
            and kubernetes_raw.deployment.available_replicas < kubernetes_raw.deployment.desired_replicas
        )

        if (has_deploy_event and has_degraded_rollout) or (has_degraded_rollout and getattr(kubernetes_raw, "restart_count", 0) > 0):
            for_items = [
                e.description for e in valid_evs
                if "deploy" in e.description.lower() or "rollout" in e.description.lower()
            ]
            if not for_items:
                for_items = ["Failures appeared alongside a deployment/rollout event"]
            return CauseEvaluationResult(
                cause_code="deployment_failure",
                cause_label=self.CAUSE_LABELS["deployment_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["deployment_failure"],
                evidence_status="PROBABLE",
                confidence=0.725,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa có nhật ký chi tiết từ container startup logs"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Sự cố phát sinh ngay sau đợt cập nhật phiên bản mới kèm số replica sẵn sàng suy giảm.",
            )

        # ----------------------------------------------------
        # 3. EVALUATE: STORAGE_EXHAUSTION
        # ----------------------------------------------------
        has_disk_full_log = EvidenceType.LOG_DISK_FULL in ev_types
        has_disk_capacity = EvidenceType.STORAGE_CAPACITY_EXHAUSTED in ev_types
        has_node_disk = EvidenceType.NODE_DISK_PRESSURE in ev_types

        if has_disk_full_log:
            for_items = [e.description for e in valid_evs if e.evidence_type == EvidenceType.LOG_DISK_FULL]
            return CauseEvaluationResult(
                cause_code="storage_exhaustion",
                cause_label=self.CAUSE_LABELS["storage_exhaustion"],
                cause_label_vi=self.CAUSE_LABELS_VI["storage_exhaustion"],
                evidence_status="CONFIRMED",
                confidence=0.95,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=[],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Nhật ký hệ thống xác nhận lỗi cạn kiệt ổ đĩa (No space left on device).",
            )
        if has_disk_capacity or has_node_disk:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type in {EvidenceType.STORAGE_CAPACITY_EXHAUSTED, EvidenceType.NODE_DISK_PRESSURE}
            ]
            return CauseEvaluationResult(
                cause_code="storage_exhaustion",
                cause_label=self.CAUSE_LABELS["storage_exhaustion"],
                cause_label_vi=self.CAUSE_LABELS_VI["storage_exhaustion"],
                evidence_status="PROBABLE",
                confidence=0.75,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa ghi nhận lỗi I/O ghi đĩa thất bại trong logs"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Dung lượng ổ đĩa lưu trữ chạm ngưỡng cảnh báo nghiêm trọng (>= 90%).",
            )

        # ----------------------------------------------------
        # 3b. EVALUATE: DEPENDENCY_FAILURE (DEF-04 & Strict Gating)
        # ----------------------------------------------------
        dep_evs = getattr(validation_result, "dependency_evidences", []) or []
        dep_types = {e.evidence_type for e in dep_evs}
        has_dep_conn_log = (
            EvidenceType.LOG_CONNECTION_FAILURE in ev_types
            or EvidenceType.LOG_CONNECTION_FAILURE in dep_types
            or any(
                "getaddrinfo" in e.description.lower()
                or "not ready yet" in e.description.lower()
                or "connection refused" in e.description.lower()
                or "econnrefused" in e.description.lower()
                or "enotfound" in e.description.lower()
                for e in [*valid_evs, *dep_evs]
            )
        )
        has_dep_unhealthy = (
            EvidenceType.CRASH_LOOP_BACKOFF in dep_types
            or EvidenceType.POD_RESTART_COUNT_HIGH in dep_types
            or EvidenceType.LOG_CRASH_PANIC in dep_types
            or any(e.attribution_status == EvidenceAttribution.DEPENDENCY for e in dep_evs)
        )

        has_5xx = EvidenceType.HIGH_HTTP_5XX_RATE in ev_types
        has_high_latency = EvidenceType.HIGH_LATENCY in ev_types

        if has_dep_conn_log or (dep_evs and (has_5xx or has_high_latency)):
            conn_logs = [
                e.description for e in [*valid_evs, *dep_evs]
                if e.evidence_type == EvidenceType.LOG_CONNECTION_FAILURE
                or any(k in e.description.lower() for k in ["connection", "not ready", "enotfound", "econnrefused", "refused", "timeout"])
            ]
            dep_errors = [
                e.description for e in dep_evs
                if e.attribution_status == EvidenceAttribution.DEPENDENCY
                and e.evidence_type != EvidenceType.LOG_CONNECTION_FAILURE
            ]
            all_dep_for = list(dict.fromkeys([*conn_logs, *dep_errors]))

            target_symptoms = [
                e.description for e in valid_evs
                if e.evidence_type in {EvidenceType.HIGH_HTTP_5XX_RATE, EvidenceType.HIGH_LATENCY}
            ]
            combined_symptoms = list(dict.fromkeys([*symptoms, *target_symptoms]))

            # Gating: CONFIRMED requires both app connection failure logs AND verified dependency unhealthiness/errors
            is_fully_confirmed = bool(conn_logs and dep_errors)
            status = "CONFIRMED" if is_fully_confirmed else "PROBABLE"
            confidence = 0.90 if is_fully_confirmed else 0.74
            missing = [] if is_fully_confirmed else ["Cần đối chiếu thêm trạng thái sẵn sàng (Ready) của Service/Endpoint phụ thuộc và kiểm tra DNS"]

            return CauseEvaluationResult(
                cause_code="dependency_failure",
                cause_label=self.CAUSE_LABELS["dependency_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["dependency_failure"],
                evidence_status=status,
                confidence=confidence,
                evidence_for=all_dep_for or ["Ghi nhận lỗi kết nối phụ thuộc thượng nguồn"],
                evidence_against=[],
                missing_evidence=missing,
                related_risks=related_risks,
                symptoms=combined_symptoms,
                explanation=(
                    "Dịch vụ phụ thuộc thượng nguồn (Database/Upstream Service) gặp sự cố khiến "
                    "ứng dụng mục tiêu phát sinh lỗi kết nối và suy giảm phản hồi (HTTP 5xx / Latency)."
                ),
            )

        # ----------------------------------------------------
        # 4. EVALUATE: APPLICATION_FAILURE / POD UNSTABILITY
        # ----------------------------------------------------
        has_crash_log = EvidenceType.LOG_CRASH_PANIC in ev_types
        has_5xx = EvidenceType.HIGH_HTTP_5XX_RATE in ev_types
        has_crashloop = EvidenceType.CRASH_LOOP_BACKOFF in ev_types
        has_probe_failed = (
            EvidenceType.LIVENESS_PROBE_FAILED in ev_types
            or EvidenceType.READINESS_PROBE_FAILED in ev_types
            or EvidenceType.PROBE_TIMEOUT in ev_types
        )
        has_restarts = EvidenceType.POD_RESTART_COUNT_HIGH in ev_types
        restart_count = getattr(kubernetes_raw, "restart_count", 0)

        if has_crash_log and has_5xx and not has_crashloop and restart_count < 3:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type in {EvidenceType.LOG_CRASH_PANIC, EvidenceType.HIGH_HTTP_5XX_RATE}
            ]
            return CauseEvaluationResult(
                cause_code="application_failure",
                cause_label=self.CAUSE_LABELS["application_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["application_failure"],
                evidence_status="CONFIRMED",
                confidence=0.88,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=[],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Ứng dụng gặp sự cố sập nội bộ nghiêm trọng (Panic/Fatal Crash) kèm tỷ lệ lỗi HTTP 5xx cao.",
            )

        # Diagnosed as unstable_pod ONLY when there is actual structural instability:
        # e.g., CrashLoopBackOff, or high restart count (>= 3), or restart count >= 1 with probe failure
        has_structural_instability = (
            has_crashloop
            or (has_restarts and restart_count >= 3)
            or (has_probe_failed and restart_count >= 1)
        )
        if has_structural_instability:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type in {
                    EvidenceType.LIVENESS_PROBE_FAILED,
                    EvidenceType.READINESS_PROBE_FAILED,
                    EvidenceType.POD_RESTART_COUNT_HIGH,
                    EvidenceType.CRASH_LOOP_BACKOFF,
                }
            ]
            conf = 0.85 if (has_probe_failed and has_restarts) else (0.80 if restart_count >= 2 else 0.775)
            return CauseEvaluationResult(
                cause_code="unstable_pod",
                cause_label=self.CAUSE_LABELS["unstable_pod"],
                cause_label_vi=self.CAUSE_LABELS_VI["unstable_pod"],
                evidence_status="PROBABLE",
                confidence=conf,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=[],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Pod ứng dụng ở trạng thái bất ổn định nghiêm trọng (khởi động lại nhiều lần hoặc rơi vào CrashLoopBackOff).",
            )

        if has_5xx:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type == EvidenceType.HIGH_HTTP_5XX_RATE
            ]
            return CauseEvaluationResult(
                cause_code="application_failure",
                cause_label=self.CAUSE_LABELS["application_failure"],
                cause_label_vi=self.CAUSE_LABELS_VI["application_failure"],
                evidence_status="PROBABLE",
                confidence=0.75,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa ghi nhận stacktrace hoặc fatal crash panic trong application logs"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Tỷ lệ lỗi HTTP 5xx tăng cao bất thường; ứng dụng đang gặp lỗi nội bộ trong quá trình phục vụ request.",
            )

        # ----------------------------------------------------
        # 5. EVALUATE: CPU_SATURATION
        # ----------------------------------------------------
        has_high_cpu = EvidenceType.HIGH_CPU_USAGE in ev_types
        has_normal_cpu = EvidenceType.NORMAL_CPU_USAGE in ev_types
        has_high_latency = EvidenceType.HIGH_LATENCY in ev_types

        cpu_val = payload.metrics.cpu if (payload and payload.metrics) else None
        is_cpu_low = has_normal_cpu or (cpu_val is not None and cpu_val < 50.0)

        if has_high_cpu and not is_cpu_low:
            for_items = [e.description for e in valid_evs if e.evidence_type == EvidenceType.HIGH_CPU_USAGE]
            return CauseEvaluationResult(
                cause_code="cpu_saturation",
                cause_label=self.CAUSE_LABELS["cpu_saturation"],
                cause_label_vi=self.CAUSE_LABELS_VI["cpu_saturation"],
                evidence_status="PROBABLE",
                confidence=0.78,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Cần kiểm tra thêm số liệu CPU Throttling chi tiết"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Mức sử dụng vi xử lý CPU vượt ngưỡng bão hòa an toàn (>= 90%).",
            )

        # ----------------------------------------------------
        # 6. EVALUATE: TRAFFIC_OVERLOAD
        # ----------------------------------------------------
        has_high_req_rate = (
            EvidenceType.HIGH_REQUEST_RATE in ev_types
            or (payload and payload.metrics and payload.metrics.request_rate >= 900.0)
        )
        if has_high_req_rate:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type == EvidenceType.HIGH_REQUEST_RATE
            ]
            if not for_items and payload and payload.metrics:
                for_items = [f"Lưu lượng yêu cầu cao đột biến: {payload.metrics.request_rate:.1f} req/s"]
            return CauseEvaluationResult(
                cause_code="traffic_overload",
                cause_label=self.CAUSE_LABELS["traffic_overload"],
                cause_label_vi=self.CAUSE_LABELS_VI["traffic_overload"],
                evidence_status="PROBABLE",
                confidence=0.80,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=["Chưa ghi nhận nghẽn băng thông mạng cụm"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Lưu lượng yêu cầu dịch vụ tăng cao đột biến gây quá tải tài nguyên xử lý.",
            )

        # ----------------------------------------------------
        # 7. EVALUATE: SERVICE_DEGRADATION / LATENCY
        # ----------------------------------------------------
        if has_high_latency:
            for_items = [e.description for e in valid_evs if e.evidence_type == EvidenceType.HIGH_LATENCY]
            against_items = []
            if has_normal_cpu:
                against_items.append("Mức sử dụng CPU ở ngưỡng bình thường (< 70%), loại trừ bão hòa CPU")
            return CauseEvaluationResult(
                cause_code="service_degradation",
                cause_label=self.CAUSE_LABELS["service_degradation"],
                cause_label_vi=self.CAUSE_LABELS_VI["service_degradation"],
                evidence_status="PROBABLE",
                confidence=0.68,
                evidence_for=for_items,
                evidence_against=against_items,
                missing_evidence=["Chưa có bằng chứng nghẽn cơ sở dữ liệu hoặc phụ thuộc thượng nguồn"],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Dịch vụ bị suy giảm hiệu năng xử lý (độ trễ phản hồi tăng cao).",
            )

        # ----------------------------------------------------
        # 8. EVALUATE: EXIT CODE 137 WITH NODE MEMORY PRESSURE
        # ----------------------------------------------------
        if has_exit_137_non_oom and has_node_mem_press:
            for_items = [
                e.description for e in valid_evs
                if e.evidence_type in {EvidenceType.EXIT_CODE_137_NON_OOM, EvidenceType.NODE_MEMORY_PRESSURE}
            ]
            return CauseEvaluationResult(
                cause_code="unknown",
                cause_label=self.CAUSE_LABELS["unknown"],
                cause_label_vi=self.CAUSE_LABELS_VI["unknown"],
                evidence_status="PROBABLE",
                confidence=0.50,
                evidence_for=for_items,
                evidence_against=[],
                missing_evidence=[
                    "Cần đối chiếu Kernel dmesg logs trên Node để phân biệt container bị Kubelet/Node evict hay cgroup OOM",
                ],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Tiến trình nhận SIGKILL (exit 137) đồng thời Node ghi nhận MemoryPressure; đánh giá dựa trên bằng chứng cấp Node mà không suy diễn máy móc.",
            )

        # ----------------------------------------------------
        # 9. EVALUATE: ISOLATED PROBE TIMEOUT (SYMPTOM ONLY -> UNKNOWN)
        # ----------------------------------------------------
        if has_probe_failed:
            probe_evs = [
                e.description for e in valid_evs
                if e.evidence_type in {
                    EvidenceType.PROBE_TIMEOUT,
                    EvidenceType.LIVENESS_PROBE_FAILED,
                    EvidenceType.READINESS_PROBE_FAILED,
                }
            ]
            return CauseEvaluationResult(
                cause_code="unknown",
                cause_label=self.CAUSE_LABELS["unknown"],
                cause_label_vi=self.CAUSE_LABELS_VI["unknown"],
                evidence_status="INSUFFICIENT_EVIDENCE",
                confidence=0.30,
                evidence_for=probe_evs or ["Liveness Probe Timeout"],
                evidence_against=[],
                missing_evidence=[
                    "Application health endpoint response",
                    "Probe configuration",
                    "Application logs",
                    "CPU throttling metrics",
                    "Historical latency",
                ],
                related_risks=related_risks,
                symptoms=symptoms or probe_evs or ["Liveness Probe Timeout"],
                explanation="Phát hiện triệu chứng Probe Timeout nhưng chưa đủ bằng chứng viễn trắc/nhật ký để xác định nguyên nhân gốc rễ (nghẽn endpoint, cấu hình probe, CPU throttling hay deadlock ứng dụng).",
            )

        # ----------------------------------------------------
        # 10. EVALUATE: ISOLATED EXIT CODE 137 (SIGKILL SIGNAL ONLY -> UNKNOWN)
        # ----------------------------------------------------
        if has_exit_137_non_oom:
            exit_evs = [e.description for e in valid_evs if e.evidence_type == EvidenceType.EXIT_CODE_137_NON_OOM]
            return CauseEvaluationResult(
                cause_code="unknown",
                cause_label=self.CAUSE_LABELS["unknown"],
                cause_label_vi=self.CAUSE_LABELS_VI["unknown"],
                evidence_status="INSUFFICIENT_EVIDENCE",
                confidence=0.30,
                evidence_for=exit_evs,
                evidence_against=[],
                missing_evidence=[
                    "Container termination reason chi tiết",
                    "Kubernetes Events tại thời điểm container bị SIGKILL",
                    "Chỉ số bộ nhớ heap/cgroup trước thời điểm kết thúc",
                    "Trạng thái áp lực tài nguyên Node (Node Conditions)",
                ],
                related_risks=related_risks,
                symptoms=symptoms,
                explanation="Tiến trình kết thúc với exitCode 137 (SIGKILL) nhưng thiếu bằng chứng xác nhận nguyên nhân cụ thể (OOM, timeout hay tín hiệu hủy từ bên ngoài).",
            )

        # ----------------------------------------------------
        # 11. INSUFFICIENT EVIDENCE / UNKNOWN FALLBACK
        # ----------------------------------------------------
        return CauseEvaluationResult(
            cause_code="unknown",
            cause_label=self.CAUSE_LABELS["unknown"],
            cause_label_vi=self.CAUSE_LABELS_VI["unknown"],
            evidence_status="INSUFFICIENT_EVIDENCE",
            confidence=0.30,
            evidence_for=[],
            evidence_against=[],
            missing_evidence=validation_result.missing_data or ["Chưa có bằng chứng viễn trắc hoặc sự kiện Kubernetes xác thực nguyên nhân"],
            related_risks=related_risks,
            symptoms=symptoms,
            explanation="Các chỉ số viễn trắc, nhật ký và sự kiện Kubernetes hiện tại chưa cung cấp đủ bằng chứng để xác định nguyên nhân an toàn.",
        )
