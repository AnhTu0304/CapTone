import json

from app.agents.historical_incident_agent import HistoricalContext
from app.agents.rca_agent import RCAConclusion, RootCauseResult
from app.agents.recommendation_agent import (
    RecommendationAgent,
    _extract_latest_failure_detail,
)
from app.schemas.kubernetes import KubernetesData
from app.schemas.metrics import MetricPoint
from app.schemas.rca import ActionHistoryContext, ActionHistoryItem, RCARequest


def test_extract_latest_failure_detail_prefers_specific_error_and_verification_result():
    history = ActionHistoryContext(
        consecutive_failures=2,
        circuit_breaker_tripped=True,
        blocked_actions=["RESTART_POD"],
        history=[
            ActionHistoryItem(
                action_id="act-2",
                action="RESTART_POD",
                result="FAILED",
                failure_reason="EXECUTION_FAILED",
                verification_result=json.dumps(
                    {
                        "error": 'Deployment.apps "kube-state-metrics" not found in namespace "default"',
                        "message": "Agent execution failed",
                    }
                ),
            )
        ],
    )

    detail = _extract_latest_failure_detail(history)
    assert detail is not None
    assert 'Deployment.apps "kube-state-metrics" not found' in detail


def test_recommendation_agent_includes_latest_error_detail_in_circuit_breaker_reason():
    agent = RecommendationAgent()
    conclusion = RCAConclusion(
        cause_code="unstable_pod",
        result=RootCauseResult(
            cause="Unstable application pod",
            confidence=0.9,
            severity="CRITICAL",
        ),
        evidence=["Exit code 137 detected"],
        explanation="Pod repeatedly OOMKilled",
    )
    k8s = KubernetesData(
        workload_name="prometheus-kube-state-metrics",
        pod_status="CrashLoopBackOff",
        restart_count=4,
    )
    history = ActionHistoryContext(
        consecutive_failures=2,
        circuit_breaker_tripped=True,
        blocked_actions=["RESTART_POD", "REPLACE_POD"],
        history=[
            ActionHistoryItem(
                action="REPLACE_POD",
                result="FAILED",
                failure_reason="OOMKilled (exitCode 137)",
            )
        ],
    )

    rec = agent.recommend(
        conclusion=conclusion,
        kubernetes=k8s,
        historical=HistoricalContext(),
        action_history=history,
    )
    assert rec.action == "NO_ACTION"
    assert "Circuit Breaker" in rec.reason
    assert "Lỗi gần nhất: OOMKilled (exitCode 137)." in rec.reason



def test_three_tier_escalation_restart_to_replace_to_drain_or_no_action():
    from app.schemas.kubernetes import KubernetesAnalysisResult

    agent = RecommendationAgent()
    conclusion = RCAConclusion(
        cause_code="memory_exhaustion",
        result=RootCauseResult(
            cause="Container memory exhausted",
            confidence=0.92,
            severity="HIGH",
        ),
        evidence=["RAM usage is critically high (99%)", "OOMKilled"],
        explanation="Pod memory exhausted",
    )
    k8s = KubernetesData(
        namespace="test-lab",
        workload_name="sme-order-service",
        workload_type="Deployment",
        pod_status="Running",
        restart_count=3,
    )

    # Cấp 1: Lần đầu phát hiện lỗi (consecutive_failures == 0, kể cả khi restart_count == 3) -> RESTART_POD
    rec_tier1 = agent.recommend(
        conclusion=conclusion,
        kubernetes=k8s,
        historical=HistoricalContext(),
    )
    assert rec_tier1.action == "RESTART_POD"

    # Cấp 2: RESTART_POD thất bại hậu kiểm (consecutive_failures == 1) -> REPLACE_POD
    hist_tier2 = ActionHistoryContext(
        consecutive_failures=1,
        circuit_breaker_tripped=False,
        blocked_actions=["RESTART_POD"],
        history=[
            ActionHistoryItem(
                action="RESTART_POD",
                result="FAILED",
                failure_reason="Hậu kiểm thất bại: RAM vẫn 85%",
            )
        ],
    )
    rec_tier2 = agent.recommend(
        conclusion=conclusion,
        kubernetes=k8s,
        historical=HistoricalContext(),
        previous_action="RESTART_POD",
        previous_action_result="FAILED",
        action_history=hist_tier2,
    )
    assert rec_tier2.action == "REPLACE_POD"
    assert "Cấp 2" in rec_tier2.reason

    # Cấp 3A: REPLACE_POD cũng thất bại + Node bị suy thoái & có Node dự phòng khỏe -> DRAIN_NODE
    hist_tier3 = ActionHistoryContext(
        consecutive_failures=2,
        circuit_breaker_tripped=False,
        blocked_actions=["RESTART_POD", "REPLACE_POD"],
        history=[
            ActionHistoryItem(action="REPLACE_POD", result="FAILED", failure_reason="Node MemoryPressure"),
            ActionHistoryItem(action="RESTART_POD", result="FAILED", failure_reason="RAM high"),
        ],
    )
    k8s_analysis_multinode = KubernetesAnalysisResult(
        findings=["Host node 'worker-1' is experiencing MemoryPressure"],
        suspected_causes=["memory_exhaustion"],
        target_pod_name="sme-order-service-abc",
        target_node_name="worker-1",
        target_node_pressure=True,
        recommended_destination_node="worker-2",
        is_primary_database=False,
    )
    rec_tier3_drain = agent.recommend(
        conclusion=conclusion,
        kubernetes=k8s,
        historical=HistoricalContext(),
        previous_action="REPLACE_POD",
        previous_action_result="FAILED",
        action_history=hist_tier3,
        kubernetes_analysis=k8s_analysis_multinode,
    )
    assert rec_tier3_drain.action == "DRAIN_NODE"
    assert "worker-2" in rec_tier3_drain.reason

    # Cấp 3B: REPLACE_POD thất bại trên cụm 1 Node (minikube) hoặc không phải lỗi Node -> NO_ACTION + Playbook 3 bước
    k8s_analysis_singlenode = KubernetesAnalysisResult(
        findings=[],
        suspected_causes=["memory_exhaustion"],
        target_pod_name="sme-order-service-abc",
        target_node_name="minikube",
        target_node_pressure=False,
        recommended_destination_node=None,
        is_primary_database=False,
    )
    rec_tier3_cb = agent.recommend(
        conclusion=conclusion,
        kubernetes=k8s,
        historical=HistoricalContext(),
        previous_action="REPLACE_POD",
        previous_action_result="FAILED",
        action_history=hist_tier3,
        kubernetes_analysis=k8s_analysis_singlenode,
    )
    assert rec_tier3_cb.action == "NO_ACTION"
    assert rec_tier3_cb.action_parameters.circuit_breaker_tripped is True
    assert len(rec_tier3_cb.action_parameters.manual_playbook) == 3
    assert "sme-order-service-abc" in rec_tier3_cb.action_parameters.manual_playbook[0]
