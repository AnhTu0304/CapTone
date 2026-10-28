from __future__ import annotations

from app.schemas.kubernetes import (
    KubernetesAnalysisResult,
    KubernetesData,
    NodeInfo,
    PodInfo,
)


class KubernetesEventAgent:
    def analyze(self, data: KubernetesData) -> KubernetesAnalysisResult:
        findings: list[str] = []
        causes: set[str] = set()

        text = " ".join([data.pod_status or "", data.container_status or "", *data.events]).lower()
        if data.restart_count >= 3:
            findings.append(f"Pod khởi động lại nhiều lần ({data.restart_count} lần)")
            causes.add("unstable_pod")

        event_rules = [
            ("readiness probe failed", "Kiểm tra tính sẵn sàng (Readiness probe) thất bại", "unstable_pod"),
            ("liveness probe failed", "Kiểm tra tính sống còn (Liveness probe) thất bại", "unstable_pod"),
            ("oomkilled", "Container bị tiêu diệt do tràn bộ nhớ (OOMKilled)", "memory_exhaustion"),
            ("crashloopbackoff", "Pod bị rơi vào vòng lặp sập liên tục (CrashLoopBackOff)", "unstable_pod"),
            ("imagepullbackoff", "Không thể tải container image (ImagePullBackOff)", "deployment_failure"),
            ("pending", "Pod đang ở trạng thái chờ xếp lịch (Pending)", "scheduling_failure"),
        ]
        for needle, finding, cause in event_rules:
            if needle in text:
                findings.append(finding)
                causes.add(cause)

        desired = data.desired_replicas
        available = data.available_replicas
        if data.deployment:
            desired = data.deployment.desired_replicas if data.deployment.desired_replicas is not None else desired
            available = data.deployment.available_replicas if data.deployment.available_replicas is not None else available
        if desired is not None and available is not None and available < desired:
            findings.append(f"Số lượng replica sẵn sàng ({available}) thấp hơn số lượng mong muốn ({desired})")
            causes.add("insufficient_replicas")

        # ========================================================
        # Enterprise Multi-Pod & Multi-Node Cross-Correlation
        # ========================================================
        faulty_pod: PodInfo | None = None
        target_pod_name: str | None = None
        target_pod_id: str | None = None
        target_node_name: str | None = None
        target_node_id: str | None = None
        target_node_pressure: bool = False
        recommended_destination_node: str | None = None
        destination_node_id: str | None = None
        is_primary_database: bool = False
        exit_code_137_detected: bool = False

        if data.all_pods:
            # 1. Identify faulty pod (prioritize exit code 137, restarts, or non-Running status)
            candidates = sorted(
                data.all_pods,
                key=lambda p: (
                    1 if p.termination and p.termination.last_exit_code == 137 else 0,
                    p.restart_count,
                    0 if p.status == "Running" and p.ready else 1,
                ),
                reverse=True,
            )
            faulty_candidate = candidates[0]
            if (
                faulty_candidate.restart_count > 0
                or (faulty_candidate.termination and faulty_candidate.termination.last_exit_code is not None)
                or faulty_candidate.status != "Running"
                or not faulty_candidate.ready
            ):
                faulty_pod = faulty_candidate
                target_pod_name = faulty_pod.pod_name
                target_pod_id = faulty_pod.pod_id
                target_node_name = faulty_pod.node_name

            # 2. Check container termination exit codes
            for pod in data.all_pods:
                term = pod.termination
                if term and term.last_exit_code == 137:
                    exit_code_137_detected = True
                    causes.add("memory_exhaustion")
                    causes.add("unstable_pod")
                    findings.append(
                        f"Tiến trình trên Pod '{pod.pod_name}' bị tiêu diệt: exitCode 137 "
                        f"({term.reason or 'Linux Kernel OOM-Killer SIGKILL'})"
                    )

            # 3. Pod Cross-Correlation: Isolate single-pod vs systemic failure
            healthy_pods = [p for p in data.all_pods if p.status == "Running" and p.ready and p.restart_count == 0]
            unhealthy_pods = [p for p in data.all_pods if p not in healthy_pods]
            total_count = len(data.all_pods)
            if len(unhealthy_pods) == 1 and healthy_pods:
                findings.append(
                    f"Sự cố mang tính cục bộ trên Pod '{unhealthy_pods[0].pod_name}' (1/{total_count} replica lỗi; "
                    f"{len(healthy_pods)} Pod anh em vẫn hoạt động bình thường)"
                )
            elif len(unhealthy_pods) > 1 and total_count > 1:
                findings.append(
                    f"Sự cố mang tính toàn hệ thống trên nhiều replica ({len(unhealthy_pods)}/{total_count} Pod bị ảnh hưởng)"
                )

            # 4. Domain-Specific Database Cluster Context
            if faulty_pod and faulty_pod.mongodb_cluster_health:
                db_health = faulty_pod.mongodb_cluster_health
                if db_health.role == "PRIMARY":
                    is_primary_database = True
                    quorum_str = db_health.quorum_status or "INTACT (Bảo toàn)"
                    findings.append(
                        f"Pod '{faulty_pod.pod_name}' giữ vai trò PRIMARY trong cụm MongoDB Replica Set (Quorum: {quorum_str})"
                    )

            # 5. Storage / PVC Status
            if faulty_pod and faulty_pod.storage_pvc:
                pvc = faulty_pod.storage_pvc
                if pvc.mount_status and pvc.mount_status != "Mounted":
                    causes.add("storage_exhaustion")
                    findings.append(f"Storage PVC '{pvc.pvc_name}' abnormal mount status: {pvc.mount_status}")
                elif pvc.io_errors > 0:
                    causes.add("storage_exhaustion")
                    findings.append(f"Storage PVC '{pvc.pvc_name}' detected {pvc.io_errors} I/O errors")
                elif pvc.used_percent is not None and pvc.used_percent >= 90:
                    causes.add("storage_exhaustion")
                    findings.append(f"Storage PVC '{pvc.pvc_name}' capacity critically high ({pvc.used_percent:.1f}%)")

            # 6. Memory Configuration Mismatch
            if faulty_pod and faulty_pod.memory_config:
                cfg = faulty_pod.memory_config
                if cfg.container_limit_bytes and cfg.wiredtiger_cache_size_bytes:
                    limit_mb = cfg.container_limit_bytes // (1024 * 1024)
                    cache_mb = cfg.wiredtiger_cache_size_bytes // (1024 * 1024)
                    if cache_mb >= limit_mb * 0.5:
                        causes.add("memory_exhaustion")
                        findings.append(
                            f"Memory limit ({limit_mb}MB) is tightly constrained relative to "
                            f"WiredTiger cache ({cache_mb}MB) plus connection overhead"
                        )

        # ========================================================
        # Node Capacity & Failover Destination Evaluation
        # ========================================================
        if data.nodes:
            # Map target_node_id
            if target_node_name:
                for node in data.nodes:
                    if node.node_name == target_node_name:
                        target_node_id = node.node_id
                        conds = node.conditions if isinstance(node.conditions, dict) else node.conditions.model_dump()
                        if conds.get("MemoryPressure"):
                            target_node_pressure = True
                            causes.add("memory_exhaustion")
                            findings.append(f"Host node '{target_node_name}' is experiencing MemoryPressure")
                        break

            # Identify candidate healthy failover node
            healthy_candidate_nodes: list[NodeInfo] = []
            for node in data.nodes:
                if node.node_name == target_node_name:
                    continue
                conds = node.conditions if isinstance(node.conditions, dict) else node.conditions.model_dump()
                if conds.get("Ready", True) and not conds.get("MemoryPressure", False):
                    healthy_candidate_nodes.append(node)

            if healthy_candidate_nodes:
                # Sort by free_memory_bytes descending, or ram_usage_pct ascending
                healthy_candidate_nodes.sort(
                    key=lambda n: (
                        n.free_memory_bytes or 0,
                        -(n.ram_usage_pct or 100),
                    ),
                    reverse=True,
                )
                best_node = healthy_candidate_nodes[0]
                recommended_destination_node = best_node.node_name
                destination_node_id = best_node.node_id
                free_gb = (best_node.free_memory_bytes or 0) / (1024 * 1024 * 1024)
                findings.append(
                    f"Candidate healthy destination node '{best_node.node_name}' has "
                    f"{free_gb:.2f}GB free memory available for failover"
                )

        return KubernetesAnalysisResult(
            findings=findings,
            suspected_causes=sorted(causes),
            faulty_pod=faulty_pod,
            target_pod_name=target_pod_name,
            target_pod_id=target_pod_id,
            target_node_name=target_node_name,
            target_node_id=target_node_id,
            target_node_pressure=target_node_pressure,
            recommended_destination_node=recommended_destination_node,
            destination_node_id=destination_node_id,
            is_primary_database=is_primary_database,
            exit_code_137_detected=exit_code_137_detected,
        )
