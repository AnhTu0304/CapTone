from __future__ import annotations

import json

from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.agents.rca_agent import RCAConclusion, RootCauseAnalysisAgent
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.rca import (
    Action,
    ActionHistoryContext,
    ActionParameters,
    RecommendationResult,
    SecurityContext,
    SecurityPolicyContext,
)


def _extract_latest_failure_detail(action_history: ActionHistoryContext | None) -> str | None:
    if not action_history or not action_history.history:
        return None
    failed_items = [
        item for item in action_history.history
        if str(getattr(item, "result", "") or "").upper() in {"FAILED", "PARTIAL"}
    ]
    candidates = failed_items or list(action_history.history)
    for item in candidates:
        vr = getattr(item, "verification_result", None)
        vr_msg: str | None = None
        if isinstance(vr, str) and vr.strip():
            try:
                parsed = json.loads(vr)
                if isinstance(parsed, dict):
                    vr_msg = str(parsed.get("error") or parsed.get("message") or parsed.get("reason") or "").strip() or None
                else:
                    vr_msg = vr.strip()
            except Exception:
                vr_msg = vr.strip()
        elif isinstance(vr, dict):
            vr_msg = str(vr.get("error") or vr.get("message") or vr.get("reason") or "").strip() or None

        fr = getattr(item, "failure_reason", None)
        fr_str: str | None = None
        if isinstance(fr, dict):
            fr_str = str(fr.get("error") or fr.get("message") or fr.get("reason") or "").strip() or None
        elif fr is not None:
            cand = str(fr).strip()
            if cand and cand.lower() not in {"none", "null"}:
                fr_str = cand

        chosen = None
        if fr_str and fr_str.upper() not in {"EXECUTION_FAILED", "UNKNOWN", "FAILED"}:
            chosen = fr_str
        elif vr_msg:
            chosen = vr_msg
        elif fr_str:
            chosen = fr_str

        if chosen:
            clean = " ".join(chosen.split())
            return clean[:137] + "..." if len(clean) > 140 else clean
    return None


def _build_manual_playbook(
    cause: str,
    target_name: str | None,
    workload_name: str | None,
    workload_type: str | None,
    namespace: str | None,
    target_node: str | None,
    recommended_dest_node: str | None,
    is_primary: bool,
    exit_code_137: bool,
    tried_actions: list[str],
    latest_err: str | None,
) -> list[str]:
    wl_kind = (workload_type or "deployment").lower()
    if is_primary and wl_kind in {"statefulset", "mongodb"}:
        return [
            "1. Failover an toàn: Chuyển quyền Primary sang Pod khác bằng lệnh 'rs.stepDown(60)' trên MongoDB Shell.",
            "2. Tăng cấu hình cgroup: Cập nhật StatefulSet với resources.limits.memory: 2Gi để tương thích với WiredTiger cache 512MB + query overhead.",
            "3. Đánh Index: Tạo Index cho trường truy vấn 'createdAt' trên collection 'orders' để ngăn chặn CollScan toàn bộ 250,000 documents.",
        ]

    pod_ref = target_name or workload_name or "target-pod"
    wl_ref = workload_name or target_name or "service"
    ns_flag = f"-n {namespace} " if namespace else ""
    tried_summary = f" (đã thử {', '.join(tried_actions)})" if tried_actions else ""
    err_note = ""

    if cause == "dependency_failure":
        return [
            f"1. Kiểm tra dịch vụ phụ thuộc thượng nguồn (Database/Upstream Services){tried_summary}: Chạy 'kubectl get pods {ns_flag}' và kiểm tra tính sẵn sàng của Service/Endpoints (MongoDB, Redis, Postgres...).{err_note}",
            f"2. Kiểm tra nhật ký kết nối mạng và DNS: Xác thực cấu hình DNS ('nslookup') và thông tin xác thực/URI kết nối trong ConfigMap/Secret của {wl_kind}/{wl_ref}.",
            "3. Phục hồi phụ thuộc & Xác nhận: Sau khi khôi phục dịch vụ phụ thuộc và kết nối thông suốt, bấm 'Xác Nhận & Đóng Sự Cố'.",
        ]

    if exit_code_137 or cause == "memory_exhaustion":
        return [
            f"1. Điều tra OOM Pod '{pod_ref}'{tried_summary}: Chạy 'kubectl describe pod {ns_flag}{pod_ref}' và 'kubectl top pod {ns_flag}{pod_ref}' để phân tích heap memory và container cgroup limit.{err_note}",
            f"2. Nâng ngưỡng tài nguyên: Tăng 'resources.limits.memory' trong cấu hình {wl_kind}/{wl_ref} để đáp ứng đỉnh tải đột biến (do khởi động lại/thay Pod không làm tăng giới hạn RAM).",
            f"3. Lập lịch sang node khỏe & Xác nhận: Di dời Pod sang '{recommended_dest_node or 'node khả dụng'}' có đủ bộ nhớ trống hoặc bấm 'Xác Nhận & Đóng Sự Cố' sau khi nâng cấu hình.",
        ]

    if cause == "storage_exhaustion":
        return [
            f"1. Kiểm tra dung lượng thực tế{tried_summary}: Chạy 'kubectl exec -it {ns_flag}{pod_ref} -- df -h' và 'du -sh /*' để xác định phân vùng hoặc thư mục chiếm dụng ổ đĩa.{err_note}",
            f"2. Mở rộng PVC hoặc dọn dẹp dữ liệu: Xóa tệp log/temp quá hạn hoặc tăng dung lượng PersistentVolumeClaim của {wl_kind}/{wl_ref}.",
            "3. Khôi phục & Mở lại cầu dao: Kiểm tra mức sử dụng đĩa giảm xuống dưới 80% và bấm 'Xác Nhận & Đóng Sự Cố' để mở lại chế độ tự phục hồi.",
        ]

    if cause == "deployment_failure":
        return [
            f"1. Kiểm tra lịch sử triển khai{tried_summary}: Chạy 'kubectl rollout history {wl_kind}/{wl_ref} {ns_flag}' và 'kubectl describe pod {ns_flag}{pod_ref}' để kiểm tra lỗi ImagePullBackOff hoặc ConfigMap/Secret thiếu.{err_note}",
            f"2. Khôi phục bản phát hành ổn định: Kiểm tra tag container image hoặc chạy 'kubectl rollout undo {wl_kind}/{wl_ref} {ns_flag}' về revision ổn định.",
            "3. Xác nhận trạng thái Ready: Đảm bảo toàn bộ Pod đạt Running/Ready và bấm 'Xác Nhận & Đóng Sự Cố'.",
        ]

    if cause in {"cpu_saturation", "traffic_overload", "insufficient_replicas", "service_degradation"}:
        return [
            f"1. Kiểm tra tải CPU & độ trễ{tried_summary}: Chạy 'kubectl top pod {ns_flag}' trên node '{target_node or 'cluster'}' để kiểm tra hiện tượng CPU throttling và nghẽn kết nối.{err_note}",
            f"2. Điều chỉnh quy mô & giới hạn CPU: Mở rộng số lượng replica hoặc nâng 'resources.limits.cpu' cho {wl_kind}/{wl_ref} (kiểm tra quota tài nguyên của Node).",
            "3. Xác nhận SLO & Mở lại cầu dao: Theo dõi CPU và độ trễ ổn định trong 5 phút rồi bấm 'Xác Nhận & Đóng Sự Cố'.",
        ]

    return [
        f"1. Kiểm tra nhật ký tiến trình sập{tried_summary}: Chạy 'kubectl logs {ns_flag}{pod_ref} --previous --tail=100' và 'kubectl describe pod {ns_flag}{pod_ref}' để xem stacktrace/lỗi kết nối.{err_note}",
        f"2. Xử lý nguyên nhân gốc rễ trên {wl_kind}/{wl_ref}: Kiểm tra biến môi trường, kết nối cơ sở dữ liệu/dịch vụ phụ thuộc và cấu hình Liveness/Readiness probe.",
        "3. Mở lại cầu dao tự động: Sau khi xử lý triệt để và Pod ổn định, bấm nút 'Xác Nhận & Đóng Sự Cố' để khôi phục chế độ tự phục hồi.",
    ]


class RecommendationAgent:
    ALLOWED_ACTIONS = {
        "RESTART_POD", "REPLACE_POD", "RESTART_DEPLOYMENT", "SCALE_REPLICAS",
        "ROLLBACK_DEPLOYMENT", "CLEANUP_STORAGE", "TEMPORARY_IP_BLOCK", "DRAIN_NODE", "NO_ACTION",
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
        previous_rca_root_cause: str | None = None,
    ) -> RecommendationResult:
        historical = historical or HistoricalContext()
        cause = conclusion.cause_code
        action: Action = "NO_ACTION"
        reason = "Chưa có hành động hạ tầng nào đủ an toàn dựa trên bằng chứng hiện tại (Kích hoạt Circuit Breaker)"
        target_replicas: int | None = None

        desired_rep = kubernetes.desired_replicas
        if kubernetes.deployment and kubernetes.deployment.desired_replicas is not None:
            desired_rep = kubernetes.deployment.desired_replicas

        # ========================================================
        # BẬC THANG CẤP 1: Lựa chọn hành động ban đầu theo nguyên nhân
        # ========================================================
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
            base_rep = desired_rep if (desired_rep is not None and desired_rep >= 1) else 1
            target_replicas = min(5, max(2, base_rep + 1))
            reason = f"Bổ sung số lượng Pod replica (lên {target_replicas} replicas) để phân phối tải và phục hồi năng lực xử lý (hạ độ trễ dịch vụ)"
        elif cause == "underutilized":
            action = "SCALE_REPLICAS"
            base_rep = desired_rep if (desired_rep is not None and desired_rep >= 2) else 2
            target_replicas = max(1, base_rep - 1)
            reason = f"Chỉ số tải ở mức thấp kéo dài; thu hẹp số lượng replica (về {target_replicas} replica) để tối ưu hóa tài nguyên"
        elif cause == "memory_exhaustion":
            action = "RESTART_POD"
            reason = "Container bị cạn kiệt bộ nhớ RAM (OOM - Cấp 1); đề xuất khởi động lại Pod (RESTART_POD) trước và chờ Verification kiểm tra sức khỏe thực tế"
        elif cause == "dependency_failure":
            action = "NO_ACTION"
            reason = (
                "Phát hiện lỗi dịch vụ phụ thuộc thượng nguồn (Dependency Failure); "
                "không thực hiện can thiệp tự động (Restart/Replace/Scale) trên workload này để bảo vệ an toàn hệ thống."
            )
        elif cause == "application_failure":
            if kubernetes.deployment and kubernetes.restart_count == 0:
                action = "RESTART_DEPLOYMENT"
                reason = "Lỗi ứng dụng xảy ra phân tán trên nhiều replica; khuyến nghị rolling restart toàn bộ deployment"
            elif kubernetes.restart_count > 0:
                action = "RESTART_POD"
                reason = "Lỗi ứng dụng trùng khớp với Pod đang không khỏe mạnh; khuyến nghị khởi động lại Pod"
        elif cause == "scheduling_failure":
            if kubernetes_analysis and kubernetes_analysis.recommended_destination_node:
                action = "DRAIN_NODE"
                reason = f"Pod không thể lập lịch trên Node hiện tại; đề xuất điều phối (DRAIN_NODE) sang Node khỏe '{kubernetes_analysis.recommended_destination_node}'"
            else:
                action = "REPLACE_POD"
                reason = "Pod gặp lỗi lập lịch (Scheduling Failure); đề xuất tạo lại Pod để Kubernetes Scheduler phân bổ lại"

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

        # Safeguard: Never repeat ROLLBACK_DEPLOYMENT if it was already executed recently.
        if action == "ROLLBACK_DEPLOYMENT" and previous_action in {"ROLLBACK_DEPLOYMENT", "Rollback Deployment"}:
            if kubernetes.restart_count > 0 or kubernetes.pod_status != "Running":
                action = "RESTART_POD"
                reason = "Dịch vụ đã được rollback trước đó nhưng sự cố vẫn tiếp diễn; đề xuất khởi động lại Pod thay vì tiếp tục rollback"
            else:
                action = "NO_ACTION"
                reason = "Dịch vụ đã được rollback trước đó nhưng sự cố vẫn tiếp diễn; kích hoạt rào chắn Circuit Breaker để kỹ sư can thiệp thủ công"

        # ========================================================
        # BẬC THANG CẤP 2: Khi RESTART_POD thất bại hậu kiểm -> RCA lại & Leo thang lên REPLACE_POD
        # ========================================================
        blocked_set = set(action_history.blocked_actions) if action_history else set()
        consecutive_failures = action_history.consecutive_failures if action_history else 0
        prev_act_norm = (previous_action or "").upper().strip().replace(" ", "_")

        explicit_cb_early = bool(action_history and action_history.circuit_breaker_tripped)
        prev_cause_norm = (previous_rca_root_cause or "").lower().strip()
        escalatable_causes = {"unstable_pod", "memory_exhaustion", "application_failure", "service_degradation"}
        
        # Check if there is valid evidence indicating the fault is specifically tied to the pod
        has_pod_failure_evidence = (
            cause in escalatable_causes
            or prev_cause_norm in escalatable_causes
            or (kubernetes and (getattr(kubernetes, "restart_count", 0) >= 2 or getattr(kubernetes, "pod_status", "") in {"CrashLoopBackOff", "Error"}))
            or any(
                "crash" in str(e).lower() or "backoff" in str(e).lower() or "oom" in str(e).lower()
                for e in (conclusion.evidence or [])
            )
        )

        if (
            (prev_act_norm in {"RESTART_POD", "RESTART_DEPLOYMENT"} and previous_action_result in {"FAILED", "PARTIAL"})
            or ("RESTART_POD" in blocked_set and "REPLACE_POD" not in blocked_set)
        ) and "REPLACE_POD" not in blocked_set and not explicit_cb_early:
            if has_pod_failure_evidence:
                action = "REPLACE_POD"
                reason = (
                    f"Hành động {previous_action or 'RESTART_POD'} ở Cấp 1 có kết quả hậu kiểm là {previous_action_result or 'FAILED'}; "
                    "hệ thống đã phân tích RCA lại trên dữ liệu mới và xác nhận bằng chứng lỗi thuộc Pod; leo thang lên Cấp 2: REPLACE_POD (tạo container mới tinh)"
                )
            elif cause == "unknown" or conclusion.result.evidence_status == "INSUFFICIENT_EVIDENCE":
                action = "NO_ACTION"
                reason = (
                    f"Hành động {previous_action or 'RESTART_POD'} trước đó có kết quả hậu kiểm là {previous_action_result or 'FAILED'}, "
                    "tuy nhiên kết quả Re-RCA hiện tại chưa đủ bằng chứng xác nhận nguyên nhân do Pod (UNKNOWN / INSUFFICIENT_EVIDENCE). "
                    "Dừng tự động hóa (NO_ACTION) để thu thập thêm dữ liệu hoặc chuyển giao kỹ sư vận hành xử lý theo Playbook."
                )
        elif (
            "SCALE_REPLICAS" in blocked_set
            and "RESTART_POD" not in blocked_set
            and not explicit_cb_early
        ):
            action = "RESTART_POD"
            reason = (
                "Hành động mở rộng bản sao (SCALE_REPLICAS) ở Bậc 1 chưa khắc phục được độ trễ/suy giảm hiệu năng; "
                "hệ thống phân tích RCA lại và leo thang lên Bậc 2: RESTART_POD để giải phóng tiến trình bị treo."
            )

        # Reassess an unsuccessful or partially successful non-escalated action (e.g., SCALE_REPLICAS).
        elif previous_action_result in {"FAILED", "PARTIAL"} and action == previous_action:
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

        # Safeguard: Dependency failure must NEVER be escalated to restart/replace/scale target
        if cause == "dependency_failure":
            action = "NO_ACTION"
            reason = (
                "Phát hiện lỗi dịch vụ phụ thuộc thượng nguồn (Dependency Failure); "
                "không thực hiện can thiệp tự động (Restart/Replace/Scale) trên workload này để bảo vệ an toàn hệ thống."
            )

        # ========================================================
        # BẬC THANG CẤP 3: Sau khi REPLACE_POD cũng thất bại -> Node Recovery (DRAIN_NODE) hoặc Circuit Breaker (NO_ACTION)
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
        node_pressure = False

        if kubernetes_analysis:
            target_name = kubernetes_analysis.target_pod_name
            target_id = kubernetes_analysis.target_pod_id
            target_node = kubernetes_analysis.target_node_name
            faulty_node_id = kubernetes_analysis.target_node_id
            recommended_dest_node = kubernetes_analysis.recommended_destination_node
            dest_node_id = kubernetes_analysis.destination_node_id
            # Gating: Stateless Deployments are never primary databases
            is_deploy = (kubernetes.workload_type and kubernetes.workload_type.lower() == "deployment") or (
                kubernetes.deployment is not None
            )
            is_primary = False if is_deploy else bool(kubernetes_analysis.is_primary_database)
            exit_code_137 = kubernetes_analysis.exit_code_137_detected
            node_pressure = kubernetes_analysis.target_node_pressure

        circuit_breaker_tripped = False
        latest_err = _extract_latest_failure_detail(action_history)
        detail_suffix = f" Lỗi gần nhất: {latest_err}." if latest_err else ""
        cause_label_vi = RootCauseAnalysisAgent.CAUSE_LABELS_VI.get(cause, conclusion.result.cause)

        replace_failed = (
            (prev_act_norm == "REPLACE_POD" and previous_action_result in {"FAILED", "PARTIAL"})
            or "REPLACE_POD" in blocked_set
            or consecutive_failures >= 3
        )

        if action_history or replace_failed:
            explicit_cb = bool(action_history and action_history.circuit_breaker_tripped)
            
            # Additional Safety Checks for DRAIN_NODE (Audit 4)
            pdb_blocks_eviction = bool(
                getattr(kubernetes, "pdb_blocks_eviction", False)
                or (getattr(kubernetes, "disruptions_allowed", None) is not None and getattr(kubernetes, "disruptions_allowed", 1) <= 0)
                or any("poddisruptionbudget" in str(ev).lower() and ("cannot evict" in str(ev).lower() or "0 disruptions allowed" in str(ev).lower()) for ev in (kubernetes.events or []))
            )
            has_unmovable_storage = bool(
                getattr(kubernetes, "has_local_storage", False)
                or any("local storage" in str(ev).lower() or "cannot migrate pvc" in str(ev).lower() for ev in (kubernetes.events or []))
            )
            is_same_destination = bool(recommended_dest_node and target_node and recommended_dest_node == target_node)

            can_reschedule_to_healthy_node = (
                not explicit_cb
                and not is_primary
                and not pdb_blocks_eviction
                and not has_unmovable_storage
                and not is_same_destination
                and consecutive_failures <= 3
                and "DRAIN_NODE" not in blocked_set
                and node_pressure
                and bool(recommended_dest_node)
            )

            if replace_failed and can_reschedule_to_healthy_node:
                action = "DRAIN_NODE"
                circuit_breaker_tripped = False
                reason = (
                    f"Sau khi thử thay thế Pod (REPLACE_POD) không hiệu quả, kết quả phân tích RCA lại phát hiện Node '{target_node}' "
                    f"đang suy thoái tài nguyên (Node Pressure); leo thang lên Cấp 3: DRAIN_NODE để cô lập Node lỗi và điều phối Pod sang Node khỏe '{recommended_dest_node}'."
                )
            elif explicit_cb or replace_failed:
                circuit_breaker_tripped = True
                action = "NO_ACTION"
                safety_notes = []
                if pdb_blocks_eviction:
                    safety_notes.append("PodDisruptionBudget không cho phép trục xuất Pod (0 disruptions allowed)")
                if has_unmovable_storage:
                    safety_notes.append("Workload sử dụng PersistentVolume cục bộ không thể di dời")
                if is_same_destination:
                    safety_notes.append("Không thể chọn lại chính Node lỗi làm Node đích")
                if not recommended_dest_node:
                    safety_notes.append(f"Cụm hiện chỉ có 1 Node '{target_node or 'minikube'}', không có Node dự phòng an toàn")
                
                safety_note_str = f" ({'; '.join(safety_notes)})" if safety_notes else ""
                reason = (
                    f"Đã thử các hành động tự khắc phục trước đó nhưng sự cố vẫn tiếp diễn{safety_note_str}. "
                    f"Kích hoạt Cầu dao an toàn (Circuit Breaker - NO_ACTION) để tránh lặp vô hạn và chuyển sang quy trình kiểm tra thủ công.{detail_suffix}"
                )
            elif action in blocked_set:
                blocked_name = action
                action = "NO_ACTION"
                reason = (
                    f"Hành động '{blocked_name}' tạm khóa do đã thất bại trước đó. "
                    f"Kích hoạt Cầu dao an toàn (Circuit Breaker - NO_ACTION) để tránh lặp lại.{detail_suffix}"
                )

        # ========================================================
        # Target & Playbook Resolution
        # ========================================================
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

        tried_actions_for_pb = list(dict.fromkeys([
            *( [ item.action for item in (action_history.history if action_history else []) if getattr(item, "action", None) ] ),
            *( [previous_action] if previous_action else [] ),
        ]))

        manual_playbook: list[str] = []
        if circuit_breaker_tripped or action == "NO_ACTION":
            manual_playbook = _build_manual_playbook(
                cause=cause,
                target_name=target_name,
                workload_name=kubernetes.workload_name,
                workload_type=kubernetes.workload_type,
                namespace=kubernetes.namespace,
                target_node=target_node,
                recommended_dest_node=recommended_dest_node,
                is_primary=is_primary,
                exit_code_137=exit_code_137,
                tried_actions=tried_actions_for_pb,
                latest_err=latest_err,
            )

        action_params = ActionParameters(
            faulty_pod_id=target_id if target_type == "POD" else None,
            faulty_pod_name=target_name if target_type == "POD" else None,
            faulty_node_id=faulty_node_id,
            faulty_node_name=target_node,
            recommended_destination_node=recommended_dest_node,
            destination_node_id=dest_node_id,
            target_replicas=target_replicas if action == "SCALE_REPLICAS" else None,
            is_primary_database=is_primary,
            consecutive_failures=consecutive_failures,
            circuit_breaker_tripped=circuit_breaker_tripped,
            blocked_actions=sorted(blocked_set),
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
