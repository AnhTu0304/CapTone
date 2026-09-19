import json
from pathlib import Path

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
        for field in ("company_id", "cluster_id", "incident_id"):
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
    assert prediction["threshold"] == configured_threshold
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
