import json
from pathlib import Path
import pytest

from app.agents.kubernetes_agent import KubernetesEventAgent
from app.agents.log_agent import LogAnalysisAgent
from app.agents.metrics_agent import MetricsAnalysisAgent
from app.agents.rca_agent import RootCauseAnalysisAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.schemas.kubernetes import KubernetesData
from app.schemas.metrics import MetricPoint
from app.schemas.rca import LLMRCAResult, RCARequest, RecommendationResult
from app.services.openai_rca_service import OpenAIRCAService


ROOT = Path(__file__).resolve().parents[2]
RCA_RESPONSE_FIELDS = {
    "service_id", "prediction", "root_cause", "evidence", "recommendation",
    "explanation", "historical_context_used", "similar_incident_ids",
    "workload_id", "namespace", "cluster_id", "incident_id", "request_id",
}


def test_rca_api_contract_without_gru_can_find_unhealthy_pod():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "pod_id": "payment-abc123",
        "metrics": {
            "cpu": 35, "ram": 50, "disk": 65, "request_rate": 500,
            "latency": 2500, "http_5xx_rate": 15,
        },
        "logs": ["ERROR Readiness probe failed while serving requests"],
        "kubernetes": {
            "pod_status": "Running", "restart_count": 2,
            "events": ["Readiness probe failed"],
            "desired_replicas": 3, "available_replicas": 3,
        },
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == RCA_RESPONSE_FIELDS
    assert body["root_cause"]["cause"] == "Unstable application pod"
    assert body["recommendation"]["action"] == "RESTART_POD"
    assert body["evidence"]
    assert body["historical_context_used"] is False
    assert body["similar_incident_ids"] == []
    assert body["explanation"]


def test_rca_does_not_run_gru_without_metric_history():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
            "latency": 100, "http_5xx_rate": 0,
        },
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["prediction"] is None


def test_rca_accepts_direct_risk_confidence_and_kubernetes_events():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "risk_type": "CPU_OVERLOAD",
        "confidence": 0.92,
        "metrics": {
            "cpu": 95, "ram": 70, "disk": 50, "request_rate": 1100,
            "latency": 720, "http_5xx_rate": 3.0,
            "pod_restart_count": 1, "replica_count": 2,
        },
        "logs": ["High CPU usage detected"],
        "kubernetes_events": ["Deployment has insufficient replicas"],
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["prediction"]["detected_risks"] == [
        {"risk_type": "CPU_OVERLOAD", "confidence": 0.92}
    ]
    assert body["root_cause"]["cause"] == "CPU saturation"


def test_rca_rejects_incomplete_supplied_prediction():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
            "latency": 100, "http_5xx_rate": 0,
        },
        "prediction": {
            "service_id": "payment-service",
            "threshold": 0.79,
            "detected_risks": [],
            "risk_outputs": {"CPU_OVERLOAD": {"confidence": 0.2}},
        },
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 422


def test_rca_prefers_supplied_prediction_over_direct_risk_and_sequence():
    from fastapi.testclient import TestClient
    from app.main import app

    sample = json.loads(
        (ROOT / "trainGRU" / "sample_batch_8feature.json").read_text(encoding="utf-8")
    )
    names = sample["feature_order"]
    sequence = [dict(zip(names, row)) for row in sample["instances"][1]["sequence"]]
    supplied_prediction = {
        "service_id": "payment-service",
        "threshold": 0.79,
        "thresholds": {
            "CPU_OVERLOAD": 0.81,
            "OOM": 0.50,
            "DISK_FULL": 0.85,
            "HIGH_LATENCY": 0.62,
            "HTTP_5XX_SPIKE": 0.81,
            "TRAFFIC_OVERLOAD": 0.85,
        },
        "detected_risks": [
            {"risk_type": "DISK_FULL", "confidence": 0.91}
        ],
        "risk_outputs": {
            "CPU_OVERLOAD": {"confidence": 0.1},
            "OOM": {"confidence": 0.1},
            "DISK_FULL": {"confidence": 0.91},
            "HIGH_LATENCY": {"confidence": 0.1},
            "HTTP_5XX_SPIKE": {"confidence": 0.1},
            "TRAFFIC_OVERLOAD": {"confidence": 0.1},
        },
    }
    payload = {
        "service_id": "payment-service",
        "metrics": sequence[-1],
        "metric_sequence": sequence,
        "risk_type": "CPU_OVERLOAD",
        "confidence": 0.99,
        "prediction": supplied_prediction,
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["prediction"] == supplied_prediction


def test_rca_rejects_all_metrics_removed_from_scope():
    from fastapi.testclient import TestClient
    from app.main import app

    with TestClient(app) as client:
        for removed_metric in (
            "db_pool_usage", "network", "dependency_latency",
            "dependency_error_rate", "dependency_timeout_rate",
        ):
            metrics = {
                "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
                "latency": 100, "http_5xx_rate": 0, removed_metric: 1,
            }
            response = client.post("/api/v1/rca", json={
                "service_id": "payment-service",
                "metrics": metrics,
            })
            assert response.status_code == 422, removed_metric


def test_rca_rejects_removed_dependency_context():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
            "latency": 100, "http_5xx_rate": 0,
        },
        "dependencies": [{
            "name": "inventory-service",
            "latency": 900,
            "error_rate": 12,
        }],
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 422


def test_rca_rejects_main_backend_management_identifiers():
    from fastapi.testclient import TestClient
    from app.main import app

    base = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
            "latency": 100, "http_5xx_rate": 0,
        },
    }
    with TestClient(app) as client:
        for field in ("company_id", "billing_account_id", "tenant_id"):
            response = client.post("/api/v1/rca", json={**base, field: "external-id"})
            assert response.status_code == 422, field


def test_rca_uses_full_multi_label_gru_result_when_history_is_supplied():
    from fastapi.testclient import TestClient
    from app.main import app

    sample = json.loads(
        (ROOT / "trainGRU" / "sample_batch_8feature.json").read_text(encoding="utf-8")
    )
    names = sample["feature_order"]
    sequence = [dict(zip(names, row)) for row in sample["instances"][1]["sequence"]]
    payload = {
        "service_id": "payment-service",
        "metrics": sequence[-1],
        "metric_sequence": sequence,
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
        configured_threshold = app.state.prediction_service.threshold
    assert response.status_code == 200, response.text
    prediction = response.json()["prediction"]
    assert prediction["threshold"] == pytest.approx(configured_threshold, abs=1e-3)
    assert any(
        risk["risk_type"] == "HIGH_LATENCY"
        and risk["confidence"] >= configured_threshold
        for risk in prediction["detected_risks"]
    )


def test_openai_action_guard_rejects_rollback_without_deployment_evidence():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 100,
            "latency": 100, "http_5xx_rate": 0,
        },
    })
    result = LLMRCAResult.model_validate({
        "root_cause": {"cause": "Application failure", "confidence": 0.7, "severity": "HIGH"},
        "evidence": ["HTTP errors observed"],
        "recommendation": {
            "action": "ROLLBACK_DEPLOYMENT",
            "reason": "Rollback the deployment",
            "priority": "HIGH",
        },
        "explanation": "No deployment evidence supports rollback.",
        "historical_context_used": False,
        "similar_incident_ids": [],
    })
    guarded = OpenAIRCAService._enforce_action_evidence(result, payload)
    assert guarded.recommendation.action == "NO_ACTION"


def _temporary_ip_block_result():
    return LLMRCAResult.model_validate({
        "root_cause": {
            "cause": "Abusive traffic from a source IP",
            "confidence": 0.9,
            "severity": "HIGH",
        },
        "evidence": ["Abnormal request and authentication traffic observed"],
        "recommendation": {
            "action": "TEMPORARY_IP_BLOCK",
            "reason": "Temporarily block the abusive source",
            "priority": "HIGH",
        },
        "explanation": "Current security evidence identifies an abusive source IP.",
        "historical_context_used": False,
        "similar_incident_ids": [],
    })


def test_openai_action_guard_allows_ip_block_with_complete_security_evidence():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 250,
            "latency": 100, "http_5xx_rate": 0,
        },
        "security": {
            "source_ip": "203.0.113.10",
            "request_rate": 250,
            "failed_auth_count": 45,
            "request_anomaly": True,
            "auth_anomaly": True,
        },
        "security_policy": {
            "request_threshold": 100,
            "failed_auth_threshold": 10,
            "failed_auth_window_seconds": 60,
        },
    })
    guarded = OpenAIRCAService._enforce_action_evidence(
        _temporary_ip_block_result(), payload
    )
    assert guarded.recommendation.action == "TEMPORARY_IP_BLOCK"


def test_openai_action_guard_uses_other_action_without_security_evidence():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 250,
            "latency": 100, "http_5xx_rate": 0,
        },
        "security": {
            "source_ip": "203.0.113.10",
            "request_rate": 250,
            "failed_auth_count": 45,
            "request_anomaly": False,
            "auth_anomaly": False,
        },
        "security_policy": {
            "request_threshold": 100,
            "failed_auth_threshold": 10,
            "failed_auth_window_seconds": 60,
        },
    })
    fallback = RecommendationResult(
        action="RESTART_POD",
        reason="Current pod health evidence supports a restart",
        priority="HIGH",
    )
    guarded = OpenAIRCAService._enforce_action_evidence(
        _temporary_ip_block_result(), payload, fallback
    )
    assert guarded.recommendation.action == "RESTART_POD"


def test_openai_action_guard_rejects_ip_block_without_source_ip():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "request_rate": 250,
            "latency": 100, "http_5xx_rate": 0,
        },
        "security": {
            "request_rate": 250,
            "failed_auth_count": 45,
            "request_anomaly": True,
            "auth_anomaly": True,
        },
        "security_policy": {
            "request_threshold": 100,
            "failed_auth_threshold": 10,
            "failed_auth_window_seconds": 60,
        },
    })
    guarded = OpenAIRCAService._enforce_action_evidence(
        _temporary_ip_block_result(), payload
    )
    assert guarded.recommendation.action == "NO_ACTION"


def test_openai_action_guard_respects_configured_security_thresholds():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 95, "ram": 40, "disk": 50, "request_rate": 250,
            "latency": 100, "http_5xx_rate": 0,
        },
        "security": {
            "source_ip": "203.0.113.10",
            "request_rate": 250,
            "failed_auth_count": 0,
            "request_anomaly": True,
            "auth_anomaly": False,
        },
        "security_policy": {
            "request_threshold": 300,
            "failed_auth_threshold": 10,
            "failed_auth_window_seconds": 60,
        },
    })
    fallback = RecommendationResult(
        action="SCALE_REPLICAS",
        reason="Current CPU evidence supports scaling",
        priority="HIGH",
    )
    guarded = OpenAIRCAService._enforce_action_evidence(
        _temporary_ip_block_result(),
        payload,
        fallback_recommendation=fallback,
    )
    assert guarded.recommendation.action == "SCALE_REPLICAS"


def test_openai_action_guard_requires_policy_supplied_by_main_backend():
    payload = RCARequest.model_validate({
        "service_id": "payment-service",
        "metrics": {
            "cpu": 95, "ram": 40, "disk": 50, "request_rate": 250,
            "latency": 100, "http_5xx_rate": 0,
        },
        "security": {
            "source_ip": "203.0.113.10",
            "request_rate": 250,
            "failed_auth_count": 45,
            "request_anomaly": True,
            "auth_anomaly": True,
        },
    })
    fallback = RecommendationResult(
        action="SCALE_REPLICAS",
        reason="Current CPU evidence supports scaling",
        priority="HIGH",
    )
    guarded = OpenAIRCAService._enforce_action_evidence(
        _temporary_ip_block_result(), payload, fallback
    )
    assert guarded.recommendation.action == "SCALE_REPLICAS"


def test_rca_api_uses_configured_openai_service():
    from fastapi.testclient import TestClient
    from app.main import app

    class FakeOpenAIRCAService:
        async def analyze(
            self,
            payload,
            prediction,
            metrics,
            logs,
            kubernetes,
            historical,
            fallback_recommendation,
        ):
            return LLMRCAResult.model_validate({
                "root_cause": {
                    "cause": "Payment service is responding slowly and returning server errors",
                    "confidence": 0.86,
                    "severity": "HIGH",
                },
                "evidence": ["Latency reached 2500ms", "HTTP 5xx rate reached 15%"],
                "recommendation": {
                    "action": "NO_ACTION",
                    "reason": "The pod is unhealthy and service errors are increasing",
                    "priority": "HIGH",
                },
                "explanation": "Current latency and HTTP errors explain the recommendation.",
                "historical_context_used": False,
                "similar_incident_ids": [],
            })

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 35, "ram": 50, "disk": 65, "request_rate": 500,
            "latency": 2500, "http_5xx_rate": 15,
        },
        "logs": ["ERROR Readiness probe failed while serving requests"],
    }
    with TestClient(app) as client:
        original = app.state.openai_rca_service
        app.state.openai_rca_service = FakeOpenAIRCAService()
        try:
            response = client.post("/api/v1/rca", json=payload)
        finally:
            app.state.openai_rca_service = original
    assert response.status_code == 200, response.text
    body = response.json()
    assert set(body) == RCA_RESPONSE_FIELDS
    assert body["evidence"] == [
        "Latency reached 2500ms", "HTTP 5xx rate reached 15%"
    ]


def test_historical_memory_reassesses_failed_action_and_uses_confirmed_success():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "pod_id": "payment-abc123",
        "metrics": {
            "cpu": 92, "ram": 75, "disk": 60, "latency": 1800,
            "request_rate": 950, "http_5xx_rate": 12,
        },
        "logs": ["ERROR request timeout", "WARNING readiness probe failed"],
        "rule_engine": ["HIGH_LATENCY detected", "HTTP 5xx rate is high"],
        "kubernetes": {
            "pod_status": "Running", "container_status": "Running",
            "restart_count": 3, "readiness_probe": "Failed",
            "liveness_probe": "Passed", "events": ["Readiness probe failed"],
            "desired_replicas": 3, "available_replicas": 3,
        },
        "previous_action": "SCALE_REPLICAS",
        "previous_action_result": "FAILED",
        "previous_action_result_source": "POST_ACTION_VERIFICATION",
        "previous_rca_root_cause": "TRAFFIC_OVERLOAD",
        "historical_incidents": [
            {
                "incident_id": "INC-105", "service_id": "payment-service",
                "predicted_root_cause": "TRAFFIC_OVERLOAD",
                "executed_action": "SCALE_REPLICAS", "action_result": "FAILED",
                "action_result_source": "POST_ACTION_VERIFICATION",
                "confirmed_root_cause": "UNHEALTHY_POD",
                "confirmation_source": "DEVOPS",
                "evidence": ["Readiness probe failed", "HTTP 5xx rate increased"],
                "operator_feedback": "Scaling did not fix the problem",
            },
            {
                "incident_id": "INC-106", "service_id": "payment-service",
                "root_cause": "UNHEALTHY_POD",
                "confirmed_root_cause": "UNHEALTHY_POD",
                "executed_action": "RESTART_POD", "action_result": "SUCCESS",
                "action_result_source": "POST_ACTION_VERIFICATION",
                "confirmation_source": "VERIFIED_EVIDENCE",
                "evidence": ["Readiness probe failed", "Pod became healthy after restart"],
            },
        ],
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["root_cause"]["cause"] == "Unstable application pod"
    # Current restart_count=3 selects REPLACE_POD. A historical RESTART_POD
    # success is context only and must not mechanically override current policy.
    assert body["recommendation"]["action"] == "REPLACE_POD"
    assert body["historical_context_used"] is True
    assert set(body["similar_incident_ids"]) == {"INC-105", "INC-106"}
    assert any(
        "Previous SCALE_REPLICAS action result was FAILED" in item
        for item in body["evidence"]
    )
    assert any("INC-106" in item for item in body["evidence"])
    assert body["explanation"]


def test_failed_previous_action_is_not_repeated_without_new_evidence():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 40, "ram": 45, "disk": 50, "latency": 200,
            "request_rate": 950, "http_5xx_rate": 0.5,
        },
        "previous_action": "SCALE_REPLICAS",
        "previous_action_result": "FAILED",
        "previous_action_result_source": "POST_ACTION_VERIFICATION",
        "previous_rca_root_cause": "TRAFFIC_OVERLOAD",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recommendation"]["action"] == "NO_ACTION"
    assert "failed" in body["recommendation"]["reason"].lower()


def test_partial_previous_action_triggers_root_cause_and_recommendation_reassessment():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 40, "ram": 45, "disk": 50, "latency": 200,
            "request_rate": 950, "http_5xx_rate": 0.5,
        },
        "previous_action": "SCALE_REPLICAS",
        "previous_action_result": "PARTIAL",
        "previous_action_result_source": "POST_ACTION_VERIFICATION",
        "previous_rca_root_cause": "TRAFFIC_OVERLOAD",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recommendation"]["action"] == "NO_ACTION"
    assert any(
        "Previous SCALE_REPLICAS action result was PARTIAL" in item
        for item in body["evidence"]
    )
    assert "partial" in body["recommendation"]["reason"].lower()


def test_failed_action_can_be_recommended_again_with_strong_new_evidence():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 40, "ram": 45, "disk": 50, "latency": 200,
            "request_rate": 950, "http_5xx_rate": 0.5,
        },
        "prediction": {
            "service_id": "payment-service",
            "threshold": 0.5,
            "detected_risks": [{
                "risk_type": "TRAFFIC_OVERLOAD",
                "confidence": 0.99,
            }],
            "risk_outputs": {
                "CPU_OVERLOAD": {"confidence": 0.1},
                "OOM": {"confidence": 0.1},
                "DISK_FULL": {"confidence": 0.1},
                "HIGH_LATENCY": {"confidence": 0.1},
                "HTTP_5XX_SPIKE": {"confidence": 0.1},
                "TRAFFIC_OVERLOAD": {"confidence": 0.99},
            },
        },
        "previous_action": "SCALE_REPLICAS",
        "previous_action_result": "FAILED",
        "previous_action_result_source": "POST_ACTION_VERIFICATION",
        "previous_rca_root_cause": "TRAFFIC_OVERLOAD",
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["recommendation"]["action"] == "SCALE_REPLICAS"
    assert "strong current signals" in body["recommendation"]["reason"]


def test_historical_action_result_is_strict_enum():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "latency": 100,
            "request_rate": 100, "http_5xx_rate": 0,
        },
        "historical_incidents": [
            {
                "incident_id": "INC-bad", "action_result": "MAYBE",
                "action_result_source": "POST_ACTION_VERIFICATION",
            }
        ],
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 422


def test_confirmed_cause_and_previous_result_require_trusted_sources():
    from fastapi.testclient import TestClient
    from app.main import app

    base = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "latency": 100,
            "request_rate": 100, "http_5xx_rate": 0,
        },
    }
    with TestClient(app) as client:
        missing_confirmation_source = client.post("/api/v1/rca", json={
            **base,
            "historical_incidents": [{
                "incident_id": "INC-unverified",
                "confirmed_root_cause": "UNHEALTHY_POD",
            }],
        })
        missing_result_source = client.post("/api/v1/rca", json={
            **base,
            "previous_action": "RESTART_POD",
            "previous_action_result": "SUCCESS",
        })
        invalid_confirmation_source = client.post("/api/v1/rca", json={
            **base,
            "historical_incidents": [{
                "incident_id": "INC-wrong-source",
                "confirmed_root_cause": "UNHEALTHY_POD",
                "confirmation_source": "POST_ACTION_VERIFICATION",
            }],
        })
    assert missing_confirmation_source.status_code == 422
    assert missing_result_source.status_code == 422
    assert invalid_confirmation_source.status_code == 422


def test_unrelated_history_cannot_create_a_root_cause_without_current_evidence():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 30, "ram": 40, "disk": 50, "latency": 100,
            "request_rate": 100, "http_5xx_rate": 0,
        },
        "historical_incidents": [
            {
                "incident_id": "INC-unrelated",
                "confirmed_root_cause": "UNHEALTHY_POD",
                "confirmation_source": "DEVOPS",
                "executed_action": "RESTART_POD",
                "action_result": "SUCCESS",
                "action_result_source": "POST_ACTION_VERIFICATION",
                "evidence": ["Readiness probe failed"],
            }
        ],
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["root_cause"]["cause"] == "UNKNOWN"
    assert body["recommendation"]["action"] == "NO_ACTION"
    assert body["evidence"] == ["insufficient_evidence"]
    assert body["historical_context_used"] is False
    assert body["similar_incident_ids"] == []


def test_unhealthy_pod_is_explainable_and_only_recommended():
    metric = MetricPoint(
        cpu=35, ram=50, disk=65, request_rate=500, latency=2500,
        http_5xx_rate=15,
    )
    kube_raw = KubernetesData(
        pod_status="Running", restart_count=2,
        events=["Readiness probe failed"], desired_replicas=3, available_replicas=3,
    )
    metrics = MetricsAnalysisAgent().analyze(metric)
    logs = LogAnalysisAgent().analyze(["ERROR Readiness probe failed while serving requests"])
    kube = KubernetesEventAgent().analyze(kube_raw)
    conclusion = RootCauseAnalysisAgent().analyze(None, metrics, logs, kube, kube_raw)
    recommendation = RecommendationAgent().recommend(conclusion, kube_raw)

    assert conclusion.result.cause == "Unstable application pod"
    assert conclusion.result.confidence >= 0.75
    assert any("Readiness" in item or "readiness" in item for item in conclusion.evidence)
    assert recommendation.action == "RESTART_POD"


def test_log_agent_deduplicates_relevant_logs():
    result = LogAnalysisAgent().analyze([
        "INFO request received",
        "ERROR Readiness probe failed while serving requests",
        "ERROR Readiness probe failed while serving requests",
    ])
    assert result.important_logs == ["ERROR Readiness probe failed while serving requests"]
    assert "unstable_pod" in result.suspected_causes


def test_rca_enterprise_mongodb_circuit_breaker_and_node_correlation():
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "request_id": "req-20261026-9ea1db42-7524",
        "incident_id": "inc-20261026-01265dc8-7e77",
        "cluster_id": "9ea1db42-7524-4238-8716-315cbe0d0b39",
        "namespace": "test-lab",
        "service_id": "mongodb",
        "workload_id": "wl-7788-99aa-bbcc-ddeeff001122",
        "workload_type": "StatefulSet",
        "suspected_pod_name": "mongodb-0",
        "risk_type": "OOM",
        "confidence": 0.94,
        "metrics": {
            "cpu": 45.2, "ram": 98.7, "disk": 34.0, "request_rate": 420.5,
            "latency": 850.0, "http_5xx_rate": 6.8, "pod_restart_count": 3, "replica_count": 3,
        },
        "metric_sequence": [
            {"cpu": 38.5, "ram": 70.2, "disk": 34.0, "request_rate": 410.0, "latency": 115.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 39.0, "ram": 72.8, "disk": 34.0, "request_rate": 412.0, "latency": 120.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 40.2, "ram": 75.4, "disk": 34.0, "request_rate": 415.0, "latency": 125.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 41.0, "ram": 78.1, "disk": 34.0, "request_rate": 418.0, "latency": 140.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 41.8, "ram": 81.3, "disk": 34.0, "request_rate": 420.0, "latency": 160.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 42.5, "ram": 84.6, "disk": 34.0, "request_rate": 422.0, "latency": 190.0, "http_5xx_rate": 0.0, "pod_restart_count": 0, "replica_count": 3},
            {"cpu": 43.1, "ram": 87.9, "disk": 34.0, "request_rate": 425.0, "latency": 240.0, "http_5xx_rate": 0.5, "pod_restart_count": 1, "replica_count": 3},
            {"cpu": 43.8, "ram": 90.5, "disk": 34.0, "request_rate": 424.0, "latency": 320.0, "http_5xx_rate": 1.2, "pod_restart_count": 1, "replica_count": 3},
            {"cpu": 44.2, "ram": 93.1, "disk": 34.0, "request_rate": 423.0, "latency": 450.0, "http_5xx_rate": 2.5, "pod_restart_count": 2, "replica_count": 3},
            {"cpu": 44.9, "ram": 95.8, "disk": 34.0, "request_rate": 421.0, "latency": 610.0, "http_5xx_rate": 4.1, "pod_restart_count": 2, "replica_count": 3},
            {"cpu": 45.0, "ram": 97.4, "disk": 34.0, "request_rate": 422.0, "latency": 730.0, "http_5xx_rate": 5.4, "pod_restart_count": 3, "replica_count": 3},
            {"cpu": 45.2, "ram": 98.7, "disk": 34.0, "request_rate": 420.5, "latency": 850.0, "http_5xx_rate": 6.8, "pod_restart_count": 3, "replica_count": 3},
        ],
        "kubernetes": {
            "cluster_id": "9ea1db42-7524-4238-8716-315cbe0d0b39",
            "namespace": "test-lab",
            "workload_id": "wl-7788-99aa-bbcc-ddeeff001122",
            "workload_type": "StatefulSet",
            "workload_name": "mongodb",
            "desired_replicas": 3,
            "available_replicas": 2,
            "events": [
                "Pod mongodb-0 container mongod terminated with exitCode 137 (OOMKilled)",
            ],
            "nodes": [
                {
                    "node_id": "node-worker-01-uuid",
                    "node_name": "worker-node-01",
                    "status": "Ready",
                    "conditions": {"Ready": True, "MemoryPressure": True},
                    "free_memory_bytes": 104857600,
                },
                {
                    "node_id": "node-worker-02-uuid",
                    "node_name": "worker-node-02",
                    "status": "Ready",
                    "conditions": {"Ready": True, "MemoryPressure": False},
                    "free_memory_bytes": 5347737600,
                },
            ],
            "all_pods": [
                {
                    "pod_id": "c72b8f80-9289-4b47-b2eb-67055c5df389",
                    "pod_name": "mongodb-0",
                    "node_name": "worker-node-01",
                    "status": "Running",
                    "ready": False,
                    "restart_count": 3,
                    "termination": {
                        "last_state": "Terminated",
                        "last_exit_code": 137,
                        "reason": "OOMKilled",
                        "container_name": "mongod",
                    },
                    "mongodb_cluster_health": {
                        "role": "PRIMARY",
                        "healthy_members": 2,
                        "total_members": 3,
                        "replication_lag_seconds": 0.0,
                        "quorum_status": "INTACT",
                    },
                    "storage_pvc": {
                        "pvc_name": "datadir-mongodb-0",
                        "mount_status": "Mounted",
                        "used_percent": 34.0,
                        "io_errors": 0,
                    },
                    "memory_config": {
                        "container_limit_bytes": 1073741824,
                        "wiredtiger_cache_size_bytes": 536870912,
                    },
                },
                {
                    "pod_id": "pod-worker-02-uuid",
                    "pod_name": "mongodb-1",
                    "node_name": "worker-node-02",
                    "status": "Running",
                    "ready": True,
                    "restart_count": 0,
                    "mongodb_cluster_health": {
                        "role": "SECONDARY",
                        "healthy_members": 2,
                        "total_members": 3,
                        "replication_lag_seconds": 0.0,
                        "quorum_status": "INTACT",
                    },
                },
                {
                    "pod_id": "pod-worker-03-uuid",
                    "pod_name": "mongodb-2",
                    "node_name": "worker-node-02",
                    "status": "Running",
                    "ready": True,
                    "restart_count": 0,
                    "mongodb_cluster_health": {
                        "role": "SECONDARY",
                        "healthy_members": 2,
                        "total_members": 3,
                        "replication_lag_seconds": 0.0,
                        "quorum_status": "INTACT",
                    },
                },
            ],
        },
        "logs": [
            "[2026-10-26T16:08:10Z] [QUERY] slow query on collection orders planSummary: COLLSCAN keysExamined:0 docsExamined:250000 1250ms",
            "[2026-10-26T16:08:11Z] [FATAL] Out of memory: unable to allocate 16777216 bytes in cache bucket",
        ],
        "action_history": {
            "total_actions_recorded": 2,
            "consecutive_failures": 2,
            "circuit_breaker_tripped": True,
            "blocked_actions": ["RESTART_POD", "REPLACE_POD"],
            "history": [
                {
                    "action_id": "act-20261026-001",
                    "action": "RESTART_POD",
                    "target_type": "POD",
                    "target_name": "mongodb-0",
                    "result": "FAILED",
                    "failure_reason": "OOMKilled_137",
                },
                {
                    "action_id": "act-20261026-002",
                    "action": "REPLACE_POD",
                    "target_type": "POD",
                    "target_name": "mongodb-0",
                    "result": "FAILED",
                    "failure_reason": "OOMKilled_137",
                },
            ],
        },
    }

    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()

    # Scope & Identity
    assert body["service_id"] == "mongodb"
    assert body["workload_id"] == "wl-7788-99aa-bbcc-ddeeff001122"
    assert body["namespace"] == "test-lab"
    assert body["cluster_id"] == "9ea1db42-7524-4238-8716-315cbe0d0b39"
    assert body["incident_id"] == "inc-20261026-01265dc8-7e77"
    assert body["request_id"] == "req-20261026-9ea1db42-7524"

    # Root Cause & Severity
    assert body["root_cause"]["cause"] == "Container memory exhausted"
    assert body["root_cause"]["severity"] == "CRITICAL"
    assert body["root_cause"]["confidence"] >= 0.90

    # Evidence checks
    evidence_text = " ".join(body["evidence"])
    assert "exitCode 137" in evidence_text or "137" in evidence_text
    assert "consecutive failure" in evidence_text

    # Recommendation & Circuit Breaker Enforcement
    rec = body["recommendation"]
    assert rec["action"] == "NO_ACTION"
    assert rec["priority"] == "CRITICAL"
    assert "Circuit Breaker" in rec["reason"]
    assert rec["target_type"] == "POD"
    assert rec["target_name"] == "mongodb-0"
    assert rec["target_id"] == "c72b8f80-9289-4b47-b2eb-67055c5df389"
    assert rec["target_node"] == "worker-node-01"

    # Action Parameters & Playbook
    params = rec["action_parameters"]
    assert params is not None
    assert params["faulty_pod_id"] == "c72b8f80-9289-4b47-b2eb-67055c5df389"
    assert params["faulty_pod_name"] == "mongodb-0"
    assert params["faulty_node_id"] == "node-worker-01-uuid"
    assert params["faulty_node_name"] == "worker-node-01"
    assert params["recommended_destination_node"] == "worker-node-02"
    assert params["destination_node_id"] == "node-worker-02-uuid"
    assert params["consecutive_failures"] == 2
    assert params["circuit_breaker_tripped"] is True
    assert len(params["manual_playbook"]) == 3
    assert any("rs.stepDown(60)" in step for step in params["manual_playbook"])
