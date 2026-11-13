from __future__ import annotations

import pytest
from app.agents.kubernetes_agent import KubernetesEventAgent
from app.agents.log_agent import LogAnalysisAgent
from app.agents.metrics_agent import MetricsAnalysisAgent
from app.agents.rca_agent import RootCauseAnalysisAgent
from app.schemas.kubernetes import (
    KubernetesData,
    NodeConditions,
    NodeInfo,
    PodInfo,
    TerminationDetails,
)
from app.schemas.metrics import MetricPoint
from app.schemas.prediction import HeadPrediction, PredictionResponse, RiskScore
from app.schemas.rca import (
    ActionHistoryContext,
    ActionHistoryItem,
    RCARequest,
    WorkloadSLOContext,
)


@pytest.fixture
def agent():
    return RootCauseAnalysisAgent()


@pytest.fixture
def metrics_agent():
    return MetricsAnalysisAgent()


@pytest.fixture
def log_agent():
    return LogAnalysisAgent()


@pytest.fixture
def kube_agent():
    return KubernetesEventAgent()


# ==============================================================================
# TEST CASE 1: GRU OOM 99% + RAM 64% + KHÔNG CÓ OOM EVENT -> INSUFFICIENT_EVIDENCE
# ==============================================================================
def test_case_1_gru_oom_high_without_evidence(agent, metrics_agent, log_agent, kube_agent):
    """1. GRU OOM 99% + RAM 64% + không có OOM event -> INSUFFICIENT_EVIDENCE.
    Phân biệt dự báo rủi ro với bằng chứng thực tế; không tạo mâu thuẫn giả tạo."""
    prediction = PredictionResponse(
        service_id="payment-service",
        threshold=0.5,
        detected_risks=[RiskScore(risk_type="OOM", confidence=0.99)],
        risk_outputs={
            "OOM": HeadPrediction(confidence=0.99),
            "CPU_OVERLOAD": HeadPrediction(confidence=0.05),
            "DISK_FULL": HeadPrediction(confidence=0.05),
            "HIGH_LATENCY": HeadPrediction(confidence=0.05),
            "HTTP_5XX_SPIKE": HeadPrediction(confidence=0.05),
            "TRAFFIC_OVERLOAD": HeadPrediction(confidence=0.05),
        },
    )
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-safe-ram-789",
        metrics=MetricPoint(cpu=15, ram=64, disk=40, latency=90, request_rate=100, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=0,
            desired_replicas=1,
            available_replicas=1,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=prediction,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Must be UNKNOWN with INSUFFICIENT_EVIDENCE, confidence = 0.30
    assert conclusion.cause_code == "unknown"
    assert conclusion.result.cause == "UNKNOWN"
    assert conclusion.result.confidence == 0.30
    assert conclusion.result.evidence_status == "INSUFFICIENT_EVIDENCE"
    # GRU prediction is cleanly in related_risks
    assert any(r.risk_type == "OOM" and r.confidence == 0.99 for r in conclusion.result.related_risks)
    # GRU is NOT in evidence_for or evidence_against
    assert not any("GRU" in e for e in conclusion.result.evidence_for)
    assert not any("GRU" in e for e in conclusion.result.evidence_against)


# ==============================================================================
# TEST CASE 2: GRU OOM 99% + OOMKILLED EVENT CỦA POD CŨ (REPLACED POD)
# ==============================================================================
def test_case_2_gru_oom_old_pod_oom_new_pod_low_ram(agent, metrics_agent, log_agent, kube_agent):
    """2. GRU OOM 99% + OOMKilled event của Pod cũ -> đánh giá theo Pod UID và thời gian.
    Pod mới đã thay thế có RAM an toàn, không bị gắn OOM sai."""
    action_history = ActionHistoryContext(
        consecutive_failures=0,
        history=[
            ActionHistoryItem(
                action="REPLACE_POD",
                result="SUCCESS",
                target_id="old-terminated-pod-uid",
                target_name="payment-service-old",
            )
        ],
    )
    payload = RCARequest(
        service_id="payment-service",
        pod_id="new-active-pod-uid",
        suspected_pod_name="payment-service-new",
        metrics=MetricPoint(cpu=20, ram=40, disk=30, latency=80, request_rate=50, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=0,
            desired_replicas=1,
            available_replicas=1,
        ),
        action_history=action_history,
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        action_history=action_history,
        payload=payload,
    )

    assert conclusion.cause_code != "memory_exhaustion"
    assert conclusion.result.evidence_status == "INSUFFICIENT_EVIDENCE"


# ==============================================================================
# TEST CASE 3: PROBE TIMEOUT ĐƠN ĐỘC -> UNKNOWN (SYMPTOM ONLY, NOT UNSTABLE_POD)
# ==============================================================================
def test_case_3_isolated_probe_timeout(agent, metrics_agent, log_agent, kube_agent):
    """3. Probe Timeout đơn độc -> UNKNOWN, không phải unstable_pod.
    Ghi nhận Probe Timeout là triệu chứng quan sát được và yêu cầu bằng chứng bổ sung."""
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-probe-timeout",
        metrics=MetricPoint(cpu=25, ram=55, disk=30, latency=150, request_rate=80, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=0,
            events=["Liveness probe failed: Get http://10.244.0.5:8080/healthz: context deadline exceeded"],
            liveness_probe="Failed",
            desired_replicas=1,
            available_replicas=1,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Must NOT conclude unstable_pod
    assert conclusion.cause_code == "unknown"
    assert conclusion.result.cause == "UNKNOWN"
    assert conclusion.result.confidence == 0.30
    assert conclusion.result.evidence_status == "INSUFFICIENT_EVIDENCE"
    # Recorded in symptoms and evidence_for
    assert any("probe failed" in s.lower() or "timeout" in s.lower() for s in conclusion.result.symptoms)
    assert any("probe failed" in e.lower() or "timeout" in e.lower() for e in conclusion.result.evidence_for)
    # Required missing evidence items
    expected_missing = [
        "Application health endpoint response",
        "Probe configuration",
        "Application logs",
        "CPU throttling metrics",
        "Historical latency",
    ]
    for m in expected_missing:
        assert m in conclusion.result.missing_evidence


# ==============================================================================
# TEST CASE 4: PROBE TIMEOUT + CPU THROTTLING + LATENCY TĂNG -> BẰNG CHỨNG THỰC TẾ
# ==============================================================================
def test_case_4_probe_timeout_with_cpu_throttling(agent, metrics_agent, log_agent, kube_agent):
    """4. Probe Timeout + CPU throttling + latency tăng -> đánh giá nguyên nhân dựa trên bằng chứng thực tế."""
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-cpu-probe-123",
        metrics=MetricPoint(cpu=96, ram=55, disk=30, latency=2200, request_rate=120, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=0,
            events=["Liveness probe failed: context deadline exceeded"],
            liveness_probe="Failed",
            desired_replicas=2,
            available_replicas=2,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Diagnosed as cpu_saturation based on real evidence
    assert conclusion.cause_code == "cpu_saturation"
    assert conclusion.result.confidence >= 0.75
    # Probe Timeout is captured as symptom
    assert any("probe failed" in s.lower() or "timeout" in s.lower() for s in conclusion.result.symptoms)


# ==============================================================================
# TEST CASE 5: EXIT CODE 137 ĐƠN ĐỘC -> UNKNOWN
# ==============================================================================
def test_case_5_isolated_exit_code_137(agent, metrics_agent, log_agent, kube_agent):
    """5. Exit Code 137 đơn độc -> UNKNOWN.
    SIGKILL alone does not prove OOM, unstable_pod, or node failure."""
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-sigkill-isolated",
        metrics=MetricPoint(cpu=20, ram=45, disk=30, latency=80, request_rate=60, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=1,
            all_pods=[
                PodInfo(
                    pod_name="payment-service-xyz",
                    pod_id="pod-sigkill-isolated",
                    status="Running",
                    restart_count=1,
                    termination=TerminationDetails(
                        last_exit_code=137,
                        reason="Error",
                        finished_at="2026-11-11T12:00:00Z",
                    ),
                )
            ],
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Must be UNKNOWN with INSUFFICIENT_EVIDENCE
    assert conclusion.cause_code == "unknown"
    assert conclusion.result.cause == "UNKNOWN"
    assert conclusion.result.confidence == 0.30
    assert conclusion.result.evidence_status == "INSUFFICIENT_EVIDENCE"
    assert any("137" in e for e in conclusion.result.evidence_for)


# ==============================================================================
# TEST CASE 6: EXIT CODE 137 + OOMKILLED XÁC NHẬN -> MEMORY_EXHAUSTION
# ==============================================================================
def test_case_6_exit_code_137_with_confirmed_oomkilled(agent, metrics_agent, log_agent, kube_agent):
    """6. Exit Code 137 + OOMKilled xác nhận -> MEMORY_EXHAUSTION."""
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-oom-direct-123",
        metrics=MetricPoint(cpu=10, ram=92, disk=40, latency=100, request_rate=50, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=1,
            all_pods=[
                PodInfo(
                    pod_name="payment-service-abc",
                    pod_id="pod-oom-direct-123",
                    status="Running",
                    restart_count=1,
                    termination=TerminationDetails(
                        last_exit_code=137,
                        reason="OOMKilled",
                        finished_at="2026-11-11T12:00:00Z",
                    ),
                )
            ],
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    assert conclusion.cause_code == "memory_exhaustion"
    assert conclusion.result.evidence_status == "CONFIRMED"
    assert conclusion.result.confidence >= 0.90


# ==============================================================================
# TEST CASE 7: EXIT CODE 137 + NODE MEMORYPRESSURE -> ĐÁNH GIÁ NODE EVIDENCE
# ==============================================================================
def test_case_7_exit_code_137_with_node_memory_pressure(agent, metrics_agent, log_agent, kube_agent):
    """7. Exit Code 137 + Node MemoryPressure -> đánh giá Node-level evidence, không suy diễn máy móc."""
    node = NodeInfo(
        node_name="node-worker-1",
        conditions=NodeConditions(MemoryPressure=True),
    )
    payload = RCARequest(
        service_id="payment-service",
        pod_id="pod-sigkill-node-press",
        metrics=MetricPoint(cpu=20, ram=45, disk=30, latency=80, request_rate=60, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            restart_count=1,
            all_pods=[
                PodInfo(
                    pod_name="payment-service-xyz",
                    pod_id="pod-sigkill-node-press",
                    status="Running",
                    restart_count=1,
                    termination=TerminationDetails(
                        last_exit_code=137,
                        reason="Error",
                        finished_at="2026-11-11T12:00:00Z",
                    ),
                )
            ],
            nodes=[node],
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Identifies node pressure evidence and notes missing kernel dmesg
    assert any("MemoryPressure" in e for e in conclusion.result.evidence_for)
    assert any("dmesg" in m for m in conclusion.result.missing_evidence)


# ==============================================================================
# TEST CASE 8: IMAGEPULLBACKOFF -> XÁC NHẬN LỖI KÉO IMAGE
# ==============================================================================
def test_case_8_image_pull_backoff(agent, metrics_agent, log_agent, kube_agent):
    """8. ImagePullBackOff -> xác nhận lỗi kéo Image, không tự kết luận nguyên nhân Registry."""
    payload = RCARequest(
        service_id="frontend",
        metrics=MetricPoint(cpu=0, ram=0, disk=0, latency=0, request_rate=0, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Pending",
            events=["Failed to pull image 'registry.local/frontend:v2': ImagePullBackOff"],
            all_pods=[
                PodInfo(
                    pod_name="frontend-abc",
                    pod_id="frontend-uid-1",
                    status="Pending",
                    restart_count=0,
                )
            ],
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    assert conclusion.cause_code == "deployment_failure"
    assert conclusion.result.evidence_status == "CONFIRMED"
    assert any("ImagePullBackOff" in e for e in conclusion.result.evidence_for)
    assert any("Registry" in m for m in conclusion.result.missing_evidence)


# ==============================================================================
# TEST CASE 9: FAILEDSCHEDULING: INSUFFICIENT MEMORY -> PHÂN BIỆT VỚI OOM
# ==============================================================================
def test_case_9_failed_scheduling_insufficient_memory(agent, metrics_agent, log_agent, kube_agent):
    """9. FailedScheduling: Insufficient memory -> phân biệt scheduler event với nguyên nhân gốc của Incident."""
    payload = RCARequest(
        service_id="heavy-service",
        metrics=MetricPoint(cpu=0, ram=0, disk=0, latency=0, request_rate=0, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Pending",
            events=["FailedScheduling: 0/1 nodes are available: 1 Insufficient memory."],
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    assert conclusion.cause_code == "deployment_failure"
    assert conclusion.cause_code != "memory_exhaustion"


# ==============================================================================
# TEST CASE 10: DESIRED_REPLICAS = 0 -> KHÔNG TỰ ĐỘNG CRITICAL
# ==============================================================================
def test_case_10_desired_replicas_zero_not_critical(agent, metrics_agent, log_agent, kube_agent):
    """10. desired_replicas = 0 -> không tự động CRITICAL."""
    payload = RCARequest(
        service_id="maintenance-service",
        metrics=MetricPoint(cpu=0, ram=0, disk=10, latency=0, request_rate=0, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Completed",
            desired_replicas=0,
            available_replicas=0,
            restart_count=0,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    assert conclusion.result.severity != "CRITICAL"
    assert conclusion.result.severity == "LOW"


# ==============================================================================
# TEST CASE 11: AVAILABLE_REPLICAS = 0 VÀ DESIRED_REPLICAS > 0 -> CRITICAL
# ==============================================================================
def test_case_11_available_zero_desired_positive_critical(agent, metrics_agent, log_agent, kube_agent):
    """11. available_replicas = 0 và desired_replicas > 0 -> CRITICAL."""
    payload = RCARequest(
        service_id="critical-api",
        metrics=MetricPoint(cpu=10, ram=20, disk=30, latency=50, request_rate=10, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="CrashLoopBackOff",
            desired_replicas=3,
            available_replicas=0,
            restart_count=5,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    assert conclusion.result.severity == "CRITICAL"


# ==============================================================================
# TEST CASE 12: HTTP 5XX CAO NHƯNG REQUEST COUNT QUÁ THẤP -> KHÔNG KẾT LUẬN CRITICAL
# ==============================================================================
def test_case_12_high_5xx_low_traffic_not_critical(agent, metrics_agent, log_agent, kube_agent):
    """12. HTTP 5xx cao nhưng request count quá thấp -> không kết luận CRITICAL."""
    payload = RCARequest(
        service_id="low-traffic-service",
        metrics=MetricPoint(
            cpu=10, ram=30, disk=20, latency=100,
            request_rate=2.0,  # Only 2 req/s (insufficient sample volume)
            http_5xx_rate=50.0,  # 50% errors (e.g. 1 probe ping failed)
        ),
        kubernetes=KubernetesData(
            pod_status="Running",
            desired_replicas=2,
            available_replicas=2,
            restart_count=0,
        ),
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # Must NOT be CRITICAL because request volume is small
    assert conclusion.result.severity != "CRITICAL"


# ==============================================================================
# TEST CASE 13: LATENCY VƯỢT 2000MS NHƯNG WORKLOAD SLO CHO PHÉP -> ĐÁNH GIÁ THEO SLO
# ==============================================================================
def test_case_13_latency_exceeds_default_but_within_slo(agent, metrics_agent, log_agent, kube_agent):
    """13. Latency vượt 2000ms nhưng SLO workload khác -> đánh giá theo SLO."""
    payload = RCARequest(
        service_id="batch-report-service",
        metrics=MetricPoint(cpu=30, ram=50, disk=30, latency=2500, request_rate=50, http_5xx_rate=0),
        kubernetes=KubernetesData(
            pod_status="Running",
            desired_replicas=2,
            available_replicas=2,
            restart_count=0,
        ),
        workload_slo=WorkloadSLOContext(latency_threshold_ms=5000.0),  # Allowed up to 5000ms
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )

    # 2500ms is well within 5000ms SLO -> must NOT be HIGH or CRITICAL
    assert conclusion.result.severity in {"LOW", "MEDIUM"}


# ==============================================================================
# TEST CASE 14: ACTION FAILURES >= 3 NHƯNG DỊCH VỤ VẪN KHỎE -> KHÔNG TỰ ĐỘNG CRITICAL
# ==============================================================================
def test_case_14_action_failures_high_service_healthy_not_critical(agent, metrics_agent, log_agent, kube_agent):
    """14. Action failures >= 3 nhưng dịch vụ vẫn khỏe -> không tự động CRITICAL."""
    action_history = ActionHistoryContext(
        consecutive_failures=3,
        circuit_breaker_tripped=True,
        history=[
            ActionHistoryItem(action="RESTART_POD", result="FAILED"),
            ActionHistoryItem(action="REPLACE_POD", result="FAILED"),
            ActionHistoryItem(action="RESTART_DEPLOYMENT", result="FAILED"),
        ],
    )
    payload = RCARequest(
        service_id="payment-service",
        metrics=MetricPoint(cpu=20, ram=45, disk=30, latency=80, request_rate=60, http_5xx_rate=0.1),
        kubernetes=KubernetesData(
            pod_status="Running",
            desired_replicas=3,
            available_replicas=3,
            restart_count=1,
        ),
        action_history=action_history,
    )
    metrics_res = metrics_agent.analyze(payload.metrics)
    logs_res = log_agent.analyze(payload.logs or [])
    kube_res = kube_agent.analyze(payload.kubernetes)

    conclusion = agent.analyze(
        prediction=None,
        metrics=metrics_res,
        logs=logs_res,
        kubernetes=kube_res,
        kubernetes_raw=payload.kubernetes,
        action_history=action_history,
        payload=payload,
    )

    assert conclusion.result.severity != "CRITICAL"
    assert conclusion.result.severity in {"LOW", "MEDIUM"}


# ==============================================================================
# TEST CASE 15: NESTED RCA VÀ TOP-LEVEL EVIDENCE FIELDS PHẢI GIỐNG NHAU
# ==============================================================================
def test_case_15_nested_and_top_level_evidence_fields_identical():
    """15. Nested RCA và top-level evidence fields phải giống nhau."""
    from fastapi.testclient import TestClient
    from app.main import app

    payload = {
        "service_id": "payment-service",
        "metrics": {
            "cpu": 95, "ram": 70, "disk": 50, "request_rate": 200,
            "latency": 300, "http_5xx_rate": 0,
        },
        "kubernetes": {
            "pod_status": "Running",
            "desired_replicas": 2,
            "available_replicas": 2,
            "events": ["Liveness probe failed: timeout"],
        },
    }
    with TestClient(app) as client:
        response = client.post("/api/v1/rca", json=payload)
    assert response.status_code == 200, response.text
    body = response.json()

    # Verify single canonical source consistency
    assert body["evidence_status"] == body["root_cause"]["evidence_status"]
    assert body["evidence_for"] == body["root_cause"]["evidence_for"]
    assert body["evidence_against"] == body["root_cause"]["evidence_against"]
    assert body["missing_evidence"] == body["root_cause"]["missing_evidence"]
    assert body["related_risks"] == body["root_cause"]["related_risks"]
    assert body["symptoms"] == body["root_cause"]["symptoms"]
