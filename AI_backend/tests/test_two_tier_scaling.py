import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import pytest
from app.agents.recommendation_agent import RecommendationAgent
from app.rca.capacity_evaluator import (
    NodeCapacityValidator,
    PodCapacityAnalyzer,
    TwoTierScalingEngine,
)
from app.schemas.kubernetes import KubernetesData, NodeConditions, NodeInfo, PodInfo
from app.schemas.rca import RootCauseResult
from app.agents.rca_agent import RCAConclusion


def test_pod_capacity_analyzer_headroom_detected():
    """Scenario 1: Pod 1 is at 90%, but Pod 2 is at 25% and Pod 3 is at 20%.

    Expected: Headroom is detected (has_headroom=True).
    """
    analyzer = PodCapacityAnalyzer()
    pods = [
        PodInfo(pod_name="order-svc-1", status="Running", ready=True, cpu_usage_pct=90.0, ram_usage_pct=60.0),
        PodInfo(pod_name="order-svc-2", status="Running", ready=True, cpu_usage_pct=25.0, ram_usage_pct=40.0),
        PodInfo(pod_name="order-svc-3", status="Running", ready=True, cpu_usage_pct=20.0, ram_usage_pct=35.0),
    ]
    assessment = analyzer.analyze(pods)
    assert assessment.has_headroom is True
    assert assessment.data_sufficient is True
    assert assessment.ready_count == 3
    assert assessment.idle_count == 2
    assert assessment.overloaded_count == 1
    assert assessment.imbalance_detected is True
    assert "tải tăng cục bộ" in assessment.reason


def test_pod_capacity_analyzer_multi_signal_healthy_latency_avoids_overload():
    """Scenario 2: Pod has 88% CPU, but latency is 65ms (<120ms) and request rate is 5 rps.

    Expected: Not flagged as bottleneck overload because service is performing normally.
    """
    analyzer = PodCapacityAnalyzer()
    pods = [
        PodInfo(pod_name="order-svc-1", status="Running", ready=True, cpu_usage_pct=88.0, latency_ms=65.0, request_rate=5.0),
        PodInfo(pod_name="order-svc-2", status="Running", ready=True, cpu_usage_pct=30.0, latency_ms=50.0),
    ]
    assessment = analyzer.analyze(pods)
    assert assessment.has_headroom is True
    assert assessment.overloaded_count == 0  # Not overloaded due to healthy latency


def test_pod_capacity_analyzer_all_overloaded_with_high_latency():
    """Scenario 3: All pods are overloaded (> 80% CPU with high latency).

    Expected: No headroom (has_headroom=False).
    """
    analyzer = PodCapacityAnalyzer()
    pods = [
        PodInfo(pod_name="order-svc-1", status="Running", ready=True, cpu_usage_pct=92.0, latency_ms=450.0),
        PodInfo(pod_name="order-svc-2", status="Running", ready=True, cpu_usage_pct=88.0, latency_ms=380.0),
        PodInfo(pod_name="order-svc-3", status="Running", ready=True, cpu_usage_pct=85.0, latency_ms=410.0),
    ]
    assessment = analyzer.analyze(pods)
    assert assessment.has_headroom is False
    assert assessment.ready_count == 3
    assert assessment.idle_count == 0
    assert assessment.overloaded_count == 3
    assert "Dư địa xử lý cạn kiệt" in assessment.reason


def test_node_capacity_validator_scheduling_formula_allocatable_minus_requested():
    """Scenario 4: Node has Allocatable 8GB, Requested 6GB -> Available = 2GB.

    If new pod needs 1GB: Fits.
    If new pod needs 3GB: Does not fit.
    """
    validator = NodeCapacityValidator()
    nodes = [
        NodeInfo(
            node_name="node-1",
            status="Ready",
            conditions=NodeConditions(Ready=True),
            allocatable_memory_bytes=8 * 1024 * 1024 * 1024,
            requested_memory_bytes=6 * 1024 * 1024 * 1024,
            ram_usage_pct=60.0,
        ),
    ]
    # Requesting 1GB -> Fits (Available is 2GB)
    res_fit = validator.validate(nodes, requested_memory_bytes=1024 * 1024 * 1024)
    assert res_fit.can_fit_new_pod is True
    assert "Đánh giá sơ bộ có khả năng lập lịch thành công" in res_fit.reason

    # Requesting 3GB -> Does not fit
    res_no_fit = validator.validate(nodes, requested_memory_bytes=3 * 1024 * 1024 * 1024)
    assert res_no_fit.can_fit_new_pod is False
    assert res_no_fit.cluster_resource_exhausted is True


def test_node_capacity_validator_empty_nodes_failsafe():
    """Scenario 5: When node list is empty, validator does NOT assume cluster capacity.

    Expected: can_fit_new_pod=False, data_sufficient=False.
    """
    validator = NodeCapacityValidator()
    res = validator.validate([])
    assert res.can_fit_new_pod is False
    assert res.data_sufficient is False
    assert "Thiếu thông tin danh sách Node" in res.reason


def test_two_tier_scaling_decision_insufficient_data():
    """Scenario 6: When only 1 pod is provided, TwoTierScalingEngine enters Fail-Safe NO_ACTION."""
    engine = TwoTierScalingEngine()
    pods = [
        PodInfo(pod_name="cart-1", status="Running", ready=True, cpu_usage_pct=95.0),
    ]
    nodes = [
        NodeInfo(node_name="worker-1", status="Ready", conditions=NodeConditions(Ready=True), free_memory_bytes=4 * 1024 * 1024 * 1024),
    ]
    res = engine.evaluate_scaling(pods=pods, nodes=nodes, current_replicas=1)
    assert res.decision == "INSUFFICIENT_CAPACITY_DATA"
    assert res.recommended_action == "NO_ACTION"
    assert "Kích hoạt cơ chế an toàn" in res.reason


def test_two_tier_scaling_decision_scale_up_approved():
    """Scenario 7: When all pods are exhausted and node has space, Scale Up is approved."""
    engine = TwoTierScalingEngine()
    pods = [
        PodInfo(pod_name="cart-1", status="Running", ready=True, cpu_usage_pct=92.0),
        PodInfo(pod_name="cart-2", status="Running", ready=True, cpu_usage_pct=88.0),
        PodInfo(pod_name="cart-3", status="Running", ready=True, cpu_usage_pct=85.0),
    ]
    nodes = [
        NodeInfo(
            node_name="worker-1",
            status="Ready",
            conditions=NodeConditions(Ready=True),
            free_memory_bytes=4 * 1024 * 1024 * 1024,
        ),
    ]
    res = engine.evaluate_scaling(pods=pods, nodes=nodes, current_replicas=3)
    assert res.decision == "SCALE_UP_APPROVED"
    assert res.recommended_action == "SCALE_REPLICAS"
    assert res.target_replicas == 4
    assert res.destination_node == "worker-1"
    assert "Scale Up" in res.reason


def test_recommendation_agent_insufficient_data_safety_blocks_scaling():
    """Scenario 8: If telemetry has fewer than 2 pods, RecommendationAgent does NOT blindly scale.

    Must return NO_ACTION and caution reason.
    """
    agent = RecommendationAgent()
    root_result = RootCauseResult(
        cause="Traffic overload",
        confidence=0.92,
        severity="HIGH",
        evidence_status="CONFIRMED",
    )
    rca = RCAConclusion(
        result=root_result,
        evidence=["Traffic surge detected"],
        cause_code="traffic_overload",
        explanation="Traffic surge detected",
    )
    # Only 1 pod supplied
    k8s = KubernetesData(
        desired_replicas=1,
        available_replicas=1,
        all_pods=[
            PodInfo(pod_name="api-1", status="Running", ready=True, cpu_usage_pct=95.0),
        ],
        nodes=[
            NodeInfo(node_name="node-1", status="Ready", conditions=NodeConditions(Ready=True), free_memory_bytes=6 * 1024 * 1024 * 1024),
        ],
    )
    rec = agent.recommend(conclusion=rca, kubernetes=k8s)
    assert rec.action == "NO_ACTION"
    assert "Kích hoạt cơ chế an toàn" in rec.reason


def test_recommendation_agent_two_tier_headroom_integration():
    """Scenario 9: Sibling headroom leads to NO_ACTION even under traffic overload alert."""
    agent = RecommendationAgent()
    root_result = RootCauseResult(
        cause="Traffic overload",
        confidence=0.92,
        severity="HIGH",
        evidence_status="CONFIRMED",
    )
    rca = RCAConclusion(
        result=root_result,
        evidence=["Traffic surge detected"],
        cause_code="traffic_overload",
        explanation="Traffic surge detected",
    )
    # 3 pods where 2 are idle
    k8s = KubernetesData(
        desired_replicas=3,
        available_replicas=3,
        all_pods=[
            PodInfo(pod_name="api-1", status="Running", ready=True, cpu_usage_pct=95.0),
            PodInfo(pod_name="api-2", status="Running", ready=True, cpu_usage_pct=30.0),
            PodInfo(pod_name="api-3", status="Running", ready=True, cpu_usage_pct=25.0),
        ],
        nodes=[
            NodeInfo(node_name="node-1", status="Ready", conditions=NodeConditions(Ready=True), free_memory_bytes=6 * 1024 * 1024 * 1024),
        ],
    )
    rec = agent.recommend(conclusion=rca, kubernetes=k8s)
    assert rec.action == "NO_ACTION"
    assert "tải tăng cục bộ" in rec.reason


def test_recommendation_agent_staircase_scale_out_vs_escalation():
    """Scenario 10: Re-RCA distinguishes climbing staircase load (scale 3->4) from latency/403/5xx (escalate RESTART_POD)."""
    from app.agents.historical_incident_agent import HistoricalContext
    from app.schemas.metrics import MetricPoint
    from app.schemas.rca import ActionHistoryContext, ActionHistoryItem

    agent = RecommendationAgent()
    k8s_3pods = KubernetesData(
        namespace="test-lab",
        workload_name="ecommerce-store-app",
        workload_type="Deployment",
        desired_replicas=3,
        available_replicas=3,
        pod_status="Running",
        restart_count=0,
        all_pods=[
            PodInfo(pod_name="eco-1", status="Running", ready=True, cpu_usage_pct=85.0, request_rate=48.0),
            PodInfo(pod_name="eco-2", status="Running", ready=True, cpu_usage_pct=84.0, request_rate=46.0),
            PodInfo(pod_name="eco-3", status="Running", ready=True, cpu_usage_pct=82.0, request_rate=45.0),
        ],
        nodes=[
            NodeInfo(node_name="minikube-m02", status="Ready", conditions=NodeConditions(Ready=True), free_memory_bytes=6 * 1024 * 1024 * 1024),
        ],
    )
    hist_one_scale = ActionHistoryContext(
        consecutive_failures=1,
        circuit_breaker_tripped=False,
        blocked_actions=[],
        history=[ActionHistoryItem(action="SCALE_REPLICAS", result="FAILED", failure_reason="Hậu kiểm thất bại: CPU/RPS vẫn cao")],
    )

    # 10a. Staircase traffic flood (140 RPS, 0% 5xx, 1 prior scale) -> continues scaling 3 -> 4
    rca_traffic = RCAConclusion(
        result=RootCauseResult(cause="Traffic overload", confidence=0.88, severity="HIGH", evidence_status="CONFIRMED"),
        evidence=["RPS reached 140/s", "All 3 pods at 84% CPU"],
        cause_code="traffic_overload",
        explanation="Staircase traffic continues climbing",
    )
    rec_scale_next = agent.recommend(
        conclusion=rca_traffic,
        kubernetes=k8s_3pods,
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=hist_one_scale,
        metrics=MetricPoint(cpu=84.0, ram=45.0, disk=10.0, latency=350.0, request_rate=140.0, http_5xx_rate=0.0, pod_restart_count=0, replica_count=3),
    )
    assert rec_scale_next.action == "SCALE_REPLICAS"
    assert rec_scale_next.action_parameters.target_replicas == 4

    # 10b. Low-load pure latency bug (19 RPS, CPU 5%) -> escalates to RESTART_POD instead of scaling further
    rca_latency = RCAConclusion(
        result=RootCauseResult(cause="Service performance degradation", confidence=0.82, severity="HIGH", evidence_status="CONFIRMED"),
        evidence=["Latency 3000ms", "Low CPU"],
        cause_code="service_degradation",
        explanation="Fixed latency bug",
    )
    k8s_low_load = k8s_3pods.model_copy(
        update={
            "all_pods": [
                PodInfo(pod_name="eco-1", status="Running", ready=True, cpu_usage_pct=5.0, latency_ms=3000.0, request_rate=10.0),
                PodInfo(pod_name="eco-2", status="Running", ready=True, cpu_usage_pct=4.0, latency_ms=3000.0, request_rate=9.0),
            ]
        }
    )
    rec_escalate = agent.recommend(
        conclusion=rca_latency,
        kubernetes=k8s_low_load,
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=hist_one_scale,
        metrics=MetricPoint(cpu=5.0, ram=45.0, disk=10.0, latency=3000.0, request_rate=19.0, http_5xx_rate=0.0, pod_restart_count=0, replica_count=3),
    )
    assert rec_escalate.action == "RESTART_POD"

    # 10c. After 2 failed scale-outs -> stops scaling and escalates to RESTART_POD
    hist_two_scales = ActionHistoryContext(
        consecutive_failures=2,
        circuit_breaker_tripped=False,
        blocked_actions=[],
        history=[
            ActionHistoryItem(action="SCALE_REPLICAS", result="FAILED", failure_reason="Hậu kiểm thất bại"),
            ActionHistoryItem(action="SCALE_REPLICAS", result="FAILED", failure_reason="Hậu kiểm thất bại"),
        ],
    )
    rec_after_two = agent.recommend(
        conclusion=rca_traffic,
        kubernetes=k8s_3pods,
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=hist_two_scales,
        metrics=MetricPoint(cpu=84.0, ram=45.0, disk=10.0, latency=350.0, request_rate=200.0, http_5xx_rate=0.0, pod_restart_count=0, replica_count=4),
    )
    assert rec_after_two.action == "RESTART_POD"
