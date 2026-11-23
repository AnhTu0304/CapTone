"""Two-Tier Capacity Evaluator for Kubernetes Workloads and Cluster Nodes.

Performs:
1. Pod Capacity Analysis: Identifies load imbalance and capacity headroom among siblings using multi-signal telemetry.
2. Node Capacity Validation: Checks whether cluster nodes have sufficient allocatable resources for new replicas (Available = Allocatable - Requested).
3. Two-Tier Scaling Decision: Synthesizes both tiers to prevent premature scaling, scheduling deadlocks, and blind scaling when data is insufficient.
"""

from __future__ import annotations

import logging
from typing import Any
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.kubernetes import NodeInfo, PodInfo

logger = logging.getLogger("app.rca.capacity_evaluator")


class PodCapacityAssessment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    has_headroom: bool = Field(
        description="True if sibling pods have sufficient spare capacity to absorb traffic"
    )
    data_sufficient: bool = True
    ready_count: int = 0
    idle_count: int = 0
    overloaded_count: int = 0
    total_headroom_pct: float = 0.0
    avg_cpu_pct: float = 0.0
    max_cpu_pct: float = 0.0
    min_cpu_pct: float = 0.0
    imbalance_detected: bool = False
    reason: str = ""
    details: list[dict[str, Any]] = Field(default_factory=list)


class NodeCapacityAssessment(BaseModel):
    model_config = ConfigDict(extra="ignore")

    can_fit_new_pod: bool = Field(
        description="True if cluster has at least one healthy schedulable node with capacity"
    )
    data_sufficient: bool = True
    best_node_name: str | None = None
    best_node_id: str | None = None
    best_node_free_memory_gb: float = 0.0
    total_eligible_nodes: int = 0
    cluster_resource_exhausted: bool = False
    preliminary_schedulable: bool = False
    reason: str = ""


class TwoTierScalingResult(BaseModel):
    model_config = ConfigDict(extra="ignore")

    decision: str  # "KEEP_CURRENT_REPLICAS" | "SCALE_UP_APPROVED" | "BLOCKED_CLUSTER_EXHAUSTED" | "INSUFFICIENT_CAPACITY_DATA"
    recommended_action: str  # "NO_ACTION" | "SCALE_REPLICAS"
    target_replicas: int | None = None
    destination_node: str | None = None
    reason: str
    pod_assessment: PodCapacityAssessment
    node_assessment: NodeCapacityAssessment


class PodCapacityAnalyzer:
    """Analyzes resource usage distribution across sibling pods using multi-signal metrics.
    
    Considers CPU/RAM utilization alongside response latency, request rate, and CPU throttling
    to prevent false alarms (e.g. high CPU from background tasks with normal latency).
    """

    def __init__(
        self,
        safe_cpu_threshold: float = 80.0,
        idle_cpu_threshold: float = 50.0,
        safe_latency_threshold_ms: float = 250.0,
        normal_latency_threshold_ms: float = 120.0,
        high_request_rate_threshold: float = 40.0,
        throttled_threshold_pct: float = 10.0,
    ) -> None:
        self.safe_cpu_threshold = safe_cpu_threshold
        self.idle_cpu_threshold = idle_cpu_threshold
        self.safe_latency_threshold_ms = safe_latency_threshold_ms
        self.normal_latency_threshold_ms = normal_latency_threshold_ms
        self.high_request_rate_threshold = high_request_rate_threshold
        self.throttled_threshold_pct = throttled_threshold_pct

    def analyze(self, pods: list[PodInfo]) -> PodCapacityAssessment:
        ready_pods = [
            p for p in pods
            if str(getattr(p, "status", "") or "").lower() == "running"
            and (getattr(p, "ready", True) is not False)
        ]
        if len(ready_pods) < 2:
            return PodCapacityAssessment(
                has_headroom=False,
                data_sufficient=False,
                ready_count=len(ready_pods),
                reason="Workload có ít hơn 2 Pod sẵn sàng; không đủ dữ liệu đo lường để đối chiếu phân bổ tải giữa các Pod anh em.",
            )

        valid_telemetry_pods = [p for p in ready_pods if p.cpu_usage_pct is not None]
        if len(valid_telemetry_pods) < 2:
            return PodCapacityAssessment(
                has_headroom=False,
                data_sufficient=False,
                ready_count=len(ready_pods),
                reason="Dữ liệu Telemetry của các Pod chưa đầy đủ (thiếu chỉ số CPU/RAM trên các Pod anh em).",
            )

        cpu_values: list[float] = []
        idle_pods: list[PodInfo] = []
        overloaded_pods: list[PodInfo] = []
        total_headroom = 0.0
        details: list[dict[str, Any]] = []

        for p in ready_pods:
            cpu = float(p.cpu_usage_pct if p.cpu_usage_pct is not None else 0.0)
            ram = float(p.ram_usage_pct if p.ram_usage_pct is not None else 0.0)
            lat = getattr(p, "latency_ms", None)
            req_rate = getattr(p, "request_rate", None)
            throttled = getattr(p, "cpu_throttled_pct", None)
            cpu_values.append(cpu)

            headroom_for_pod = max(0.0, self.safe_cpu_threshold - cpu)
            total_headroom += headroom_for_pod

            # Multi-signal check:
            # Overloaded requires high CPU AND absence of healthy performance indicators.
            # If a pod has high CPU but low latency (<120ms), low throttling (<5%), and low request rate,
            # it is not suffering from service bottleneck overload.
            is_high_cpu = cpu >= self.safe_cpu_threshold
            has_explicit_good_health = (
                lat is not None and lat < self.normal_latency_threshold_ms
                and (throttled is None or throttled < 5.0)
                and (req_rate is None or req_rate < 10.0)
            )

            is_overloaded = (
                is_high_cpu
                or (req_rate is not None and req_rate >= self.high_request_rate_threshold)
                or (lat is not None and lat >= self.safe_latency_threshold_ms)
            ) and not has_explicit_good_health
            is_idle = cpu < self.idle_cpu_threshold and (lat is None or lat < self.normal_latency_threshold_ms) and (req_rate is None or req_rate < self.high_request_rate_threshold)

            if is_overloaded:
                overloaded_pods.append(p)
            elif is_idle:
                idle_pods.append(p)

            details.append({
                "pod_name": p.pod_name,
                "cpu_usage_pct": cpu,
                "ram_usage_pct": ram,
                "latency_ms": lat,
                "request_rate": req_rate,
                "cpu_throttled_pct": throttled,
                "headroom_pct": round(headroom_for_pod, 1),
                "is_idle": is_idle,
                "is_overloaded": is_overloaded,
            })

        avg_cpu = sum(cpu_values) / len(cpu_values)
        max_cpu = max(cpu_values)
        min_cpu = min(cpu_values)
        avg_req = sum(getattr(p, 'request_rate', 0.0) or 0.0 for p in ready_pods) / max(1, len(ready_pods))

        # Imbalance exists when one pod is heavily loaded while others have significant headroom
        imbalance = (max_cpu - min_cpu) >= 35.0

        # Sufficient headroom exists if:
        # 1. At least 1 pod is idle (< idle_cpu_threshold AND < high_request_rate_threshold)
        # 2. Total aggregate headroom across siblings is at least 45% (equivalent to almost half a healthy pod)
        # 3. Average request rate per pod does not exceed high request rate threshold
        has_headroom = (len(idle_pods) >= 1) and (total_headroom >= 45.0) and (avg_req < self.high_request_rate_threshold)

        if has_headroom:
            reason = (
                f"Phát hiện tải tăng cục bộ (cao nhất {max_cpu:.1f}%), tuy nhiên hệ thống còn "
                f"{len(idle_pods)}/{len(ready_pods)} Pod đang ở mức tải thấp (< {self.idle_cpu_threshold:.0f}% CPU). "
                f"Tổng năng lực khả dụng còn lại của cụm Pod đạt {total_headroom:.1f}%. "
                f"Các Pod hiện tại vẫn đủ khả năng đáp ứng tải, không cần tạo thêm Pod mới."
            )
        else:
            reason = (
                f"Toàn bộ {len(ready_pods)} Pod đều đang hoạt động gần mức giới hạn an toàn "
                f"(Trung bình {avg_cpu:.1f}%, thấp nhất {min_cpu:.1f}%). Dư địa xử lý cạn kiệt, cần bổ sung Pod."
            )

        return PodCapacityAssessment(
            has_headroom=has_headroom,
            data_sufficient=True,
            ready_count=len(ready_pods),
            idle_count=len(idle_pods),
            overloaded_count=len(overloaded_pods),
            total_headroom_pct=round(total_headroom, 1),
            avg_cpu_pct=round(avg_cpu, 1),
            max_cpu_pct=round(max_cpu, 1),
            min_cpu_pct=round(min_cpu, 1),
            imbalance_detected=imbalance,
            reason=reason,
            details=details,
        )


class NodeCapacityValidator:
    """Validates cluster node allocatable capacity and preliminary scheduling feasibility.
    
    Scheduling formula: Available = Allocatable - Requested
    Note: Kubernetes Scheduler remains the final authority on actual pod placement.
    """

    def __init__(
        self,
        min_memory_bytes_required: int = 256 * 1024 * 1024,
        min_cpu_milli_required: float = 200.0,
    ) -> None:
        self.min_memory_bytes_required = min_memory_bytes_required
        self.min_cpu_milli_required = min_cpu_milli_required

    def _cond_is_true(self, val: object) -> bool:
        if isinstance(val, bool):
            return val
        if isinstance(val, str):
            return val.strip().lower() in {"true", "1", "yes"}
        return False

    def validate(
        self,
        nodes: list[NodeInfo],
        requested_cpu_milli: float | None = None,
        requested_memory_bytes: int | None = None,
    ) -> NodeCapacityAssessment:
        if not nodes:
            # FAIL-SAFE: Do NOT assume cluster availability when node inventory is absent
            return NodeCapacityAssessment(
                can_fit_new_pod=False,
                data_sufficient=False,
                best_node_name=None,
                total_eligible_nodes=0,
                cluster_resource_exhausted=False,
                preliminary_schedulable=False,
                reason="Thiếu thông tin danh sách Node của cụm; không thể đánh giá sơ bộ khả năng lập lịch.",
            )

        min_mem = requested_memory_bytes or self.min_memory_bytes_required
        min_cpu = requested_cpu_milli or self.min_cpu_milli_required
        eligible_nodes: list[tuple[NodeInfo, float]] = []

        for node in nodes:
            # 1. Basic Schedulability & Taints
            if getattr(node, "unschedulable", False):
                continue

            taints = getattr(node, "taints", None) or []
            has_unsupported_taint = any(
                (isinstance(t, dict) and t.get("effect") in {"NoSchedule", "NoExecute"})
                or (isinstance(t, str) and ("NoSchedule" in t or "NoExecute" in t))
                for t in taints
            )
            if has_unsupported_taint:
                continue

            # 2. Node Conditions & Resource Pressures
            conds = node.conditions if isinstance(node.conditions, dict) else (node.conditions.model_dump() if node.conditions else {})
            if not self._cond_is_true(conds.get("Ready", True)) or node.status != "Ready":
                continue
            if self._cond_is_true(conds.get("MemoryPressure", False)):
                continue
            if self._cond_is_true(conds.get("DiskPressure", False)):
                continue
            if self._cond_is_true(conds.get("PIDPressure", False)):
                continue
            if self._cond_is_true(conds.get("NetworkUnavailable", False)):
                continue

            # 3. High Utilization Thresholds (Over 88% RAM / 90% CPU means node is near full)
            if node.ram_usage_pct is not None and node.ram_usage_pct >= 88.0:
                continue
            if node.cpu_usage_pct is not None and node.cpu_usage_pct >= 90.0:
                continue

            # 4. Scheduling Model: Available = Allocatable - Requested
            # Memory availability check
            if node.allocatable_memory_bytes is not None and node.requested_memory_bytes is not None:
                avail_mem = node.allocatable_memory_bytes - node.requested_memory_bytes
            elif node.free_memory_bytes is not None:
                avail_mem = node.free_memory_bytes
            elif node.ram_capacity_bytes is not None and node.ram_usage_pct is not None:
                avail_mem = int(node.ram_capacity_bytes * (100.0 - node.ram_usage_pct) / 100.0)
            else:
                avail_mem = 1024 * 1024 * 1024  # Default fallback 1GB

            if avail_mem < min_mem:
                continue

            # CPU availability check
            if node.allocatable_cpu_millicores is not None and node.requested_cpu_millicores is not None:
                avail_cpu = node.allocatable_cpu_millicores - node.requested_cpu_millicores
                if avail_cpu < min_cpu:
                    continue

            free_bytes = float(avail_mem)
            eligible_nodes.append((node, free_bytes))

        if not eligible_nodes:
            return NodeCapacityAssessment(
                can_fit_new_pod=False,
                data_sufficient=True,
                best_node_name=None,
                best_node_id=None,
                best_node_free_memory_gb=0.0,
                total_eligible_nodes=0,
                cluster_resource_exhausted=True,
                preliminary_schedulable=False,
                reason="Toàn bộ các Node trong cụm đều đang bị quá tải hoặc áp lực tài nguyên (NodePressure / Hết RAM-CPU khả dụng theo mô hình lập lịch). Không thể lập lịch cho Pod mới.",
            )

        # Sort eligible nodes by available memory descending
        eligible_nodes.sort(key=lambda x: x[1], reverse=True)
        best_node, best_bytes = eligible_nodes[0]
        free_gb = best_bytes / (1024.0 * 1024.0 * 1024.0)

        return NodeCapacityAssessment(
            can_fit_new_pod=True,
            data_sufficient=True,
            best_node_name=best_node.node_name,
            best_node_id=best_node.node_id,
            best_node_free_memory_gb=round(free_gb, 2),
            total_eligible_nodes=len(eligible_nodes),
            cluster_resource_exhausted=False,
            preliminary_schedulable=True,
            reason=f"Đánh giá sơ bộ có khả năng lập lịch thành công: Cụm có {len(eligible_nodes)} Node khỏe sẵn sàng; Node tối ưu nhất '{best_node.node_name}' còn {free_gb:.2f}GB RAM khả dụng (Kubernetes Scheduler sẽ quyết định việc phân bổ thực tế).",
        )


class TwoTierScalingEngine:
    """Synthesizes Pod capacity headroom and Node allocatable capacity to make optimal scaling decisions."""

    def __init__(self) -> None:
        self.pod_analyzer = PodCapacityAnalyzer()
        self.node_validator = NodeCapacityValidator()

    def evaluate_scaling(
        self,
        pods: list[PodInfo],
        nodes: list[NodeInfo],
        current_replicas: int,
        max_replicas: int = 5,
        requested_cpu_milli: float | None = None,
        requested_memory_bytes: int | None = None,
    ) -> TwoTierScalingResult:
        pod_assessment = self.pod_analyzer.analyze(pods)
        node_assessment = self.node_validator.validate(
            nodes,
            requested_cpu_milli=requested_cpu_milli,
            requested_memory_bytes=requested_memory_bytes,
        )

        base_rep = max(1, current_replicas)

        # CASE 1: INSUFFICIENT DATA -> FAIL-SAFE NO_ACTION
        if not pod_assessment.data_sufficient or not node_assessment.data_sufficient:
            reasons = []
            if not pod_assessment.data_sufficient:
                reasons.append(pod_assessment.reason)
            if not node_assessment.data_sufficient:
                reasons.append(node_assessment.reason)
            full_reason = (
                "Kích hoạt cơ chế an toàn (Fail-Safe): "
                + "; ".join(reasons)
                + " Hệ thống tạm dừng tự động Scale để tránh nguy cơ tạo Pod Pending. "
                "Khuyến nghị kỹ sư DevOps kiểm tra và phê duyệt thủ công."
            )
            return TwoTierScalingResult(
                decision="INSUFFICIENT_CAPACITY_DATA",
                recommended_action="NO_ACTION",
                target_replicas=base_rep,
                destination_node=None,
                reason=full_reason,
                pod_assessment=pod_assessment,
                node_assessment=node_assessment,
            )

        # CASE 2: TIER 1 - Check Pod Headroom
        if pod_assessment.has_headroom:
            return TwoTierScalingResult(
                decision="KEEP_CURRENT_REPLICAS",
                recommended_action="NO_ACTION",
                target_replicas=base_rep,
                destination_node=None,
                reason=pod_assessment.reason,
                pod_assessment=pod_assessment,
                node_assessment=node_assessment,
            )

        # CASE 3: Check Max Replicas Ceiling (Anti-Scale Loop Guard)
        if base_rep >= max_replicas:
            return TwoTierScalingResult(
                decision="MAX_REPLICAS_REACHED",
                recommended_action="NO_ACTION",
                target_replicas=base_rep,
                destination_node=None,
                reason=(
                    f"Dịch vụ đã đạt số lượng bản sao tối đa cho phép ({base_rep}/{max_replicas} Pods). "
                    f"Toàn bộ {pod_assessment.ready_count} Pods hiện có đang hoạt động hết công suất (Trung bình {pod_assessment.avg_cpu_pct:.1f}% CPU). "
                    f"Hệ thống tự động kích hoạt Circuit Breaker, giữ nguyên {base_rep} replicas để bảo toàn tài nguyên cụm."
                ),
                pod_assessment=pod_assessment,
                node_assessment=node_assessment,
            )

        # CASE 4: TIER 2 - Check Node Capacity when scaling is truly needed
        if node_assessment.can_fit_new_pod:
            new_rep = min(max_replicas, base_rep + 1)
            reason = (
                f"Đã đánh giá 2 lớp năng lực: Toàn bộ {pod_assessment.ready_count} Pod hiện có đều đã chạm ngưỡng năng lực "
                f"(Trung bình {pod_assessment.avg_cpu_pct:.1f}% CPU). "
                f"{node_assessment.reason} "
                f"Đề xuất Scale Up từ {base_rep} lên {new_rep} replicas để đảm bảo thông lượng và hạ độ trễ dịch vụ."
            )
            return TwoTierScalingResult(
                decision="SCALE_UP_APPROVED",
                recommended_action="SCALE_REPLICAS",
                target_replicas=new_rep,
                destination_node=node_assessment.best_node_name,
                reason=reason,
                pod_assessment=pod_assessment,
                node_assessment=node_assessment,
            )
        else:
            reason = (
                f"CẢNH BÁO TÀI NGUYÊN CỤM: Ứng dụng quá tải (toàn bộ {pod_assessment.ready_count} Pod bão hòa), "
                f"tuy nhiên Cluster không còn Node nào đủ tài nguyên trống ({node_assessment.reason}). "
                f"Hệ thống tự động ngăn chặn Scale Up để tránh tạo Pod rơi vào trạng thái 'Pending / FailedScheduling'. "
                f"Khuyến nghị bổ sung Node vật lý vào Cụm hoặc kiểm tra quota hạn mức."
            )
            return TwoTierScalingResult(
                decision="BLOCKED_CLUSTER_EXHAUSTED",
                recommended_action="NO_ACTION",
                target_replicas=base_rep,
                destination_node=None,
                reason=reason,
                pod_assessment=pod_assessment,
                node_assessment=node_assessment,
            )
