from app.agents.historical_incident_agent import HistoricalContext
from app.agents.rca_agent import RCAConclusion, RootCauseResult
from app.agents.recommendation_agent import RecommendationAgent
from app.schemas.kubernetes import DeploymentInfo, KubernetesData
from app.schemas.metrics import MetricPoint
from app.schemas.rca import (
    ActionHistoryContext,
    ActionHistoryItem,
    LLMRCAResult,
    RCARequest,
    RecommendationResult,
)
from app.services.openai_rca_service import OpenAIRCAService


def _make_5xx_conclusion() -> RCAConclusion:
    return RCAConclusion(
        cause_code="deployment_failure",
        result=RootCauseResult(
            cause="Deployment failure",
            confidence=0.95,
            severity="CRITICAL",
        ),
        evidence=["Phát hiện lỗi hồi quy HTTP 5xx (100.0%) ngay trên bản triển khai mới 'v1.2.1-faulty'"],
        explanation="HTTP 5xx regression after deployment",
    )


def _make_k8s_with_versions() -> KubernetesData:
    return KubernetesData(
        namespace="test-lab",
        workload_name="ecommerce-store-app",
        workload_type="Deployment",
        pod_status="Running",
        restart_count=0,
        deployment=DeploymentInfo(
            desired_replicas=4,
            available_replicas=3,
            version="v1.2.1-faulty",
            previous_version="v1.2.0-stable",
        ),
    )


def test_untried_rollback_not_suppressed_by_unrelated_circuit_breaker():
    agent = RecommendationAgent()
    history = ActionHistoryContext(
        consecutive_failures=6,
        circuit_breaker_tripped=True,
        blocked_actions=["SCALE_REPLICAS", "RESTART_POD"],
        history=[
            ActionHistoryItem(action="RESTART_POD", result="FAILED", failure_reason="Hậu kiểm thất bại"),
            ActionHistoryItem(action="SCALE_REPLICAS", result="FAILED", failure_reason="Hậu kiểm thất bại"),
        ],
    )

    rec = agent.recommend(
        conclusion=_make_5xx_conclusion(),
        kubernetes=_make_k8s_with_versions(),
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=history,
    )

    assert rec.action == "ROLLBACK_DEPLOYMENT"
    assert rec.action_parameters.circuit_breaker_tripped is False
    assert rec.target_type == "DEPLOYMENT"
    assert rec.target_name == "ecommerce-store-app"


def test_untried_rollback_not_hijacked_by_single_tier1_failure():
    agent = RecommendationAgent()
    history = ActionHistoryContext(
        consecutive_failures=1,
        circuit_breaker_tripped=False,
        blocked_actions=["SCALE_REPLICAS"],
        history=[ActionHistoryItem(action="SCALE_REPLICAS", result="FAILED", failure_reason="Latency high")],
    )

    rec = agent.recommend(
        conclusion=_make_5xx_conclusion(),
        kubernetes=_make_k8s_with_versions(),
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=history,
    )

    assert rec.action == "ROLLBACK_DEPLOYMENT"
    assert rec.action_parameters.circuit_breaker_tripped is False


def test_blocked_rollback_still_trips_circuit_breaker_to_prevent_loop():
    agent = RecommendationAgent()
    history = ActionHistoryContext(
        consecutive_failures=3,
        circuit_breaker_tripped=True,
        blocked_actions=["ROLLBACK_DEPLOYMENT", "SCALE_REPLICAS"],
        history=[
            ActionHistoryItem(action="ROLLBACK_DEPLOYMENT", result="FAILED", failure_reason="5xx persists"),
        ],
    )

    rec = agent.recommend(
        conclusion=_make_5xx_conclusion(),
        kubernetes=_make_k8s_with_versions(),
        historical=HistoricalContext(),
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        action_history=history,
    )

    assert rec.action == "NO_ACTION"
    assert rec.action_parameters.circuit_breaker_tripped is True


def test_openai_guard_accepts_kubernetes_deployment_fallback_and_keeps_untried_rollback():
    payload = RCARequest(
        service_id="ecommerce-store-app",
        namespace="test-lab",
        workload_type="Deployment",
        metrics=MetricPoint(
            cpu=4.0,
            ram=29.0,
            disk=12.0,
            latency=1100.0,
            request_rate=15.0,
            http_5xx_rate=100.0,
            pod_restart_count=0,
            replica_count=4,
        ),
        kubernetes=_make_k8s_with_versions(),
        deployment=None,
        previous_action="SCALE_REPLICAS",
        previous_action_result="FAILED",
        previous_action_result_source="POST_ACTION_VERIFICATION",
        action_history=ActionHistoryContext(
            consecutive_failures=3,
            circuit_breaker_tripped=True,
            blocked_actions=["SCALE_REPLICAS", "RESTART_POD"],
        ),
    )

    llm_raw = LLMRCAResult(
        root_cause=RootCauseResult(cause="Deployment failure", confidence=0.95, severity="CRITICAL"),
        evidence=["HTTP 5xx 100% on v1.2.1-faulty"],
        recommendation=RecommendationResult(
            action="ROLLBACK_DEPLOYMENT",
            reason="Rollback v1.2.1-faulty -> v1.2.0-stable",
            priority="HIGH",
        ),
        explanation="Regression after rollout",
        historical_context_used=False,
        similar_incident_ids=[],
    )
    fallback_rec = RecommendationResult(
        action="ROLLBACK_DEPLOYMENT",
        reason="Rollback to v1.2.0-stable",
        priority="CRITICAL",
    )

    enforced = OpenAIRCAService._enforce_action_evidence(llm_raw, payload, fallback_rec)
    assert enforced.recommendation.action == "ROLLBACK_DEPLOYMENT"

    no_deploy_payload = payload.model_copy(
        update={
            "kubernetes": KubernetesData(workload_name="ecommerce-store-app", pod_status="Running"),
            "deployment": None,
        }
    )
    enforced_missing = OpenAIRCAService._enforce_action_evidence(
        llm_raw.model_copy(deep=True),
        no_deploy_payload,
        RecommendationResult(action="NO_ACTION", reason="No deployment evidence", priority="LOW"),
    )
    assert enforced_missing.recommendation.action == "NO_ACTION"
