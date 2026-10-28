from __future__ import annotations

from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.agents.rca_agent import RCAConclusion
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.rca import (
    Action,
    ActionHistoryContext,
    ActionParameters,
    RecommendationResult,
    SecurityContext,
    SecurityPolicyContext,
)


class RecommendationAgent:
    ALLOWED_ACTIONS = {
        "RESTART_POD", "REPLACE_POD", "RESTART_DEPLOYMENT", "SCALE_REPLICAS",
        "ROLLBACK_DEPLOYMENT", "CLEANUP_STORAGE", "TEMPORARY_IP_BLOCK", "NO_ACTION",
    }

    def recommend(
        self,
        conclusion: RCAConclusion,
        kubernetes: KubernetesData,
        historical: HistoricalContext | None = None,
        previous_action: str | None = None,
        previous_action_result: str | None = None,
        action_history: ActionHistoryContext | None = None,
        kubernetes_analysis: KubernetesAnalysisResult | None = None,
        security: SecurityContext | None = None,
        security_policy: SecurityPolicyContext | None = None,
    ) -> RecommendationResult:
        historical = historical or HistoricalContext()
        cause = conclusion.cause_code
        action: Action = "NO_ACTION"
        reason = "Chưa có hành động hạ tầng nào đủ an toàn dựa trên bằng chứng hiện tại (Kích hoạt Circuit Breaker)"

        if (
            security
            and security_policy
            and security.supports_temporary_ip_block(
                security_policy.request_threshold,
                security_policy.failed_auth_threshold,
            )
        ):
            action = "TEMPORARY_IP_BLOCK"
            reason = f"Phát hiện bất thường bảo mật từ IP nguồn {security.source_ip}; tạm thời chặn IP để bảo vệ dịch vụ"
        elif cause == "deployment_failure":
            action = "ROLLBACK_DEPLOYMENT"
            reason = "Sự cố có tương quan trực tiếp với bản triển khai vừa cập nhật; đề xuất rollback phiên bản"
        elif cause == "storage_exhaustion":
            action = "CLEANUP_STORAGE"
            reason = "Dung lượng ổ đĩa đã cạn kiệt hoặc sắp chạm ngưỡng tới hạn; cần dọn dẹp lưu trữ"
        elif cause == "unstable_pod":
            action = "REPLACE_POD" if kubernetes.restart_count >= 3 else "RESTART_POD"
            reason = "Pod bị ảnh hưởng đang ở trạng thái không khỏe mạnh hoặc liên tục khởi động lại"
        elif cause in {"traffic_overload", "cpu_saturation", "insufficient_replicas", "service_degradation"}:
            action = "SCALE_REPLICAS"
            reason = "Bổ sung số lượng Pod replica để phân phối tải và phục hồi năng lực xử lý (hạ độ trễ dịch vụ)"
        elif cause == "underutilized":
            action = "SCALE_REPLICAS"
            reason = "Chỉ số tải ở mức thấp kéo dài; thu hẹp số lượng replica để tối ưu hóa tài nguyên"
        elif cause == "memory_exhaustion":
            action = "REPLACE_POD"
            reason = "Container bị cạn kiệt bộ nhớ RAM và cần được thay thế an toàn sau khi rà soát chính sách"
        elif cause == "application_failure":
            if kubernetes.deployment and kubernetes.restart_count == 0:
                action = "RESTART_DEPLOYMENT"
                reason = "Lỗi ứng dụng xảy ra phân tán trên nhiều replica; khuyến nghị rolling restart toàn bộ deployment"
            elif kubernetes.restart_count > 0:
                action = "RESTART_POD"
                reason = "Lỗi ứng dụng trùng khớp với Pod đang không khỏe mạnh; khuyến nghị khởi động lại Pod"

        # History may explain/support the action selected from current evidence,
        # but must never replace that action merely because it succeeded once.
        for incident in historical.incidents:
            historical_cause = normalize_cause(
                incident.confirmed_root_cause or incident.root_cause
            )
            historical_action = incident.executed_action or incident.recommended_action
            if (
                historical_cause == cause
                and incident.action_result == "SUCCESS"
                and historical_action == action
                and action != "NO_ACTION"
            ):
                reason = (
                    f"Current evidence independently supports {action}; similar confirmed "
                    f"incident {incident.incident_id} is supporting context where it succeeded"
                )
                break

        # Reassess an unsuccessful or partially successful action. It may still
        # be correct when strong new evidence or confirmed history supports it.
        if previous_action_result in {"FAILED", "PARTIAL"} and action == previous_action:
            successful_retry = any(
                (item.executed_action or item.recommended_action) == action
                and item.action_result == "SUCCESS"
                and normalize_cause(item.confirmed_root_cause or item.root_cause) == cause
                for item in historical.incidents
            )
            current_evidence = [
                item for item in conclusion.evidence
                if not item.startswith("Similar incident")
                and not item.startswith("Previous ")
            ]
            strong_new_evidence = (
                conclusion.result.confidence >= 0.75 and len(current_evidence) >= 2
            )
            if not successful_retry and not strong_new_evidence:
                action = "NO_ACTION"
                reason = (
                    f"Hành động {previous_action} trước đó có kết quả là {previous_action_result}; "
                    "không ưu tiên lặp lại vì bằng chứng hiện tại chưa đủ mạnh để đảm bảo an toàn"
                )
            elif strong_new_evidence:
                reason = (
                    f"Although previous {previous_action} result was {previous_action_result}, "
                    f"strong current signals independently support this action under the new conditions "
                    f"(Mặc dù hành động {previous_action} trước đó có kết quả là {previous_action_result}, "
                    "nhưng nhiều tín hiệu mới ủng hộ mạnh mẽ hành động này trong điều kiện mới)"
                )

        # ========================================================
        # Circuit Breaker & Anti-Loop Enforcement
        # ========================================================
        circuit_breaker_tripped = False
        consecutive_failures = 0
        if action_history:
            consecutive_failures = action_history.consecutive_failures
            circuit_breaker_tripped = (
                action_history.circuit_breaker_tripped or consecutive_failures >= 2
            )
            blocked_set = set(action_history.blocked_actions)

            if circuit_breaker_tripped:
                action = "NO_ACTION"
                reason = (
                    f"Phát hiện lặp sự cố liên tiếp ({consecutive_failures} lần thử restart/replace trước đó đều thất bại). "
                    "Kích hoạt Circuit Breaker chuyển quyền điều khiển cho kỹ sư vận hành (Human-in-the-Loop) "
                    "nhằm tránh crash loop và nguy cơ ảnh hưởng toàn cụm."
                )
            elif action in blocked_set:
                action = "NO_ACTION"
                reason = (
                    f"Hành động '{action}' nằm trong danh sách blocked_actions do lịch sử thất bại gần đây. "
                    "Chuyển sang chế độ can thiệp thủ công (NO_ACTION)."
                )

        # ========================================================
        # Target & Playbook Resolution
        # ========================================================
        target_type = None
        target_name = None
        target_id = None
        target_node = None
        faulty_node_id = None
        recommended_dest_node = None
        dest_node_id = None
        is_primary = False
        exit_code_137 = False

        if kubernetes_analysis:
            target_name = kubernetes_analysis.target_pod_name
            target_id = kubernetes_analysis.target_pod_id
            target_node = kubernetes_analysis.target_node_name
            faulty_node_id = kubernetes_analysis.target_node_id
            recommended_dest_node = kubernetes_analysis.recommended_destination_node
            dest_node_id = kubernetes_analysis.destination_node_id
            is_primary = kubernetes_analysis.is_primary_database
            exit_code_137 = kubernetes_analysis.exit_code_137_detected

        if action in {"RESTART_DEPLOYMENT", "ROLLBACK_DEPLOYMENT", "SCALE_REPLICAS"}:
            target_type = "DEPLOYMENT"
            target_name = kubernetes.workload_name or (kubernetes.deployment.version if kubernetes.deployment else None) or "deployment"
            target_id = kubernetes.workload_id or target_id
        elif target_name or kubernetes.pod_status or kubernetes.restart_count > 0:
            target_type = "POD"
            if not target_name:
                target_name = kubernetes.workload_name or "pod"
        elif kubernetes.deployment:
            target_type = "DEPLOYMENT"
            target_name = kubernetes.workload_name or kubernetes.deployment.version or "deployment"
            target_id = kubernetes.workload_id or target_id

        manual_playbook: list[str] = []
        if circuit_breaker_tripped or action == "NO_ACTION":
            if is_primary:
                manual_playbook = [
                    "1. Failover an toàn: Chuyển quyền Primary sang Pod khác bằng lệnh 'rs.stepDown(60)' trên MongoDB Shell.",
                    "2. Tăng cấu hình cgroup: Cập nhật StatefulSet với resources.limits.memory: 2Gi để tương thích với WiredTiger cache 512MB + query overhead.",
                    "3. Đánh Index: Tạo Index cho trường truy vấn 'createdAt' trên collection 'orders' để ngăn chặn CollScan toàn bộ 250,000 documents.",
                ]
            elif exit_code_137 or cause == "memory_exhaustion":
                manual_playbook = [
                    f"1. Điều tra OOM Pod '{target_name or 'target'}': Phân tích heap memory và container cgroup limit.",
                    "2. Nâng ngưỡng tài nguyên: Tăng memory limits trong workload spec để đáp ứng đỉnh tải đột biến.",
                    f"3. Lập lịch sang node khỏe: Di dời Pod sang '{recommended_dest_node or 'node khả dụng'}' có đủ bộ nhớ trống.",
                ]

        action_params = ActionParameters(
            faulty_pod_id=target_id if target_type == "POD" else None,
            faulty_pod_name=target_name if target_type == "POD" else None,
            faulty_node_id=faulty_node_id,
            faulty_node_name=target_node,
            recommended_destination_node=recommended_dest_node,
            destination_node_id=dest_node_id,
            consecutive_failures=consecutive_failures,
            circuit_breaker_tripped=circuit_breaker_tripped,
            manual_playbook=manual_playbook,
        )

        priority = "CRITICAL" if circuit_breaker_tripped else conclusion.result.severity

        return RecommendationResult(
            action=action,
            reason=reason,
            priority=priority,
            target_type=target_type,
            target_name=target_name,
            target_id=target_id,
            target_node=target_node,
            action_parameters=action_params,
        )
