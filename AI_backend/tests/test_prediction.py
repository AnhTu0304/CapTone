import json
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app


ROOT = Path(__file__).resolve().parents[2]


def _payload_from_training_sample(instance_index=0):
    sample = json.loads((ROOT / "trainGRU" / "sample_batch_8feature.json").read_text(encoding="utf-8"))
    sequence = []
    names = sample["feature_order"]
    for row in sample["instances"][instance_index]["sequence"]:
        values = dict(zip(names, row))
        sequence.append({
            "cpu": values["cpu"], "ram": values["ram"], "disk": values["disk"],
            "request_rate": values["request_rate"], "latency": values["latency"],
            "http_5xx_rate": values["http_5xx_rate"],
            "pod_restart_count": values["pod_restart_count"],
            "replica_count": values["replica_count"],
        })
    return {"service_id": "payment-service", "sequence": sequence}


def test_health_and_real_checkpoint_prediction():
    with TestClient(app) as client:
        health = client.get("/health")
        assert health.status_code == 200
        assert health.json() == {
            "status": "healthy",
            "model_loaded": True,
            "model_type": "gru_multi_label_risk",
            "input_shape": [12, 8],
            "risk_count": 6,
            "rca_provider": "deterministic",
            "version": "2.0.0",
        }

        response = client.post("/api/v1/predict", json=_payload_from_training_sample())
        assert response.status_code == 200, response.text
        body = response.json()
        assert body["service_id"] == "payment-service"
        assert body["threshold"] == 0.79
        assert set(body["thresholds"]) == {
            "CPU_OVERLOAD", "OOM", "DISK_FULL", "HIGH_LATENCY",
            "HTTP_5XX_SPIKE", "TRAFFIC_OVERLOAD",
        }
        assert "risk_type" not in body
        assert set(body["risk_outputs"]) == {
            "CPU_OVERLOAD", "OOM", "DISK_FULL", "HIGH_LATENCY",
            "HTTP_5XX_SPIKE", "TRAFFIC_OVERLOAD",
        }
        for item in body["risk_outputs"].values():
            assert 0 <= item["confidence"] <= 1
            assert set(item) == {"confidence"}
        for risk in body["detected_risks"]:
            assert risk["confidence"] >= body["thresholds"][risk["risk_type"]]
            assert set(risk) == {"risk_type", "confidence"}


def test_prediction_validation_rejects_empty_sequence():
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json={"service_id": "svc", "sequence": []})
        assert response.status_code == 422


def test_prediction_returns_multi_label_detected_risks_with_confidence_only():
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=_payload_from_training_sample(1))
    assert response.status_code == 200, response.text
    body = response.json()
    high_latency = next(
        risk for risk in body["detected_risks"]
        if risk["risk_type"] == "HIGH_LATENCY"
    )
    assert high_latency["confidence"] >= body["thresholds"]["HIGH_LATENCY"]
    assert body["risk_outputs"]["HIGH_LATENCY"]["confidence"] == high_latency["confidence"]


def test_prediction_validation_requires_exactly_twelve_timesteps():
    payload = _payload_from_training_sample()
    payload["sequence"] = payload["sequence"][:11]
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 422


def test_prediction_rejects_thirteen_timesteps():
    payload = _payload_from_training_sample()
    payload["sequence"].append(dict(payload["sequence"][-1]))
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 422


def test_prediction_requires_both_kubernetes_count_features():
    payload = _payload_from_training_sample()
    payload["sequence"][0].pop("pod_restart_count")
    payload["sequence"][1].pop("replica_count")
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 422


def test_prediction_rejects_invalid_feature_datatype():
    payload = _payload_from_training_sample()
    payload["sequence"][0]["cpu"] = "not-a-number"
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=payload)
    assert response.status_code == 422


def test_prediction_can_return_no_detected_risks():
    with TestClient(app) as client:
        response = client.post("/api/v1/predict", json=_payload_from_training_sample(0))
    assert response.status_code == 200, response.text
    assert response.json()["detected_risks"] == []
