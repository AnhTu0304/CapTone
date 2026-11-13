from __future__ import annotations

from datetime import datetime, timezone, timedelta
import pytest

from app.rca.models import (
    EvidenceItem,
    EvidenceSource,
    EvidenceType,
    ValidationResult,
)
from app.rca.evidence_collector import EvidenceCollector
from app.rca.evidence_validator import EvidenceValidator
from app.schemas.kubernetes import KubernetesData, PodInfo, TerminationDetails, NodeInfo, NodeConditions
from app.schemas.metrics import MetricPoint
from app.schemas.rca import RCARequest


def _create_base_request(
    service_id="ecommerce-store-app",
    pod_id="pod-cur-111",
    pod_name="ecommerce-store-app-646f88ccfc-4srf6",
    ram=64.0,
    cpu=15.0,
    latency=150.0,
    logs=None,
    events=None,
    all_pods=None,
    nodes=None,
) -> RCARequest:
    return RCARequest(
        service_id=service_id,
        pod_id=pod_id,
        suspected_pod_name=pod_name,
        cluster_id="test-cluster-1",
        namespace="test-lab",
        metrics=MetricPoint(
            cpu=cpu,
            ram=ram,
            disk=45.0,
            request_rate=200.0,
            latency=latency,
            http_5xx_rate=0.5,
        ),
        logs=logs or [],
        kubernetes=KubernetesData(
            events=events or [],
            all_pods=all_pods or [],
            nodes=nodes or [],
        ),
    )


def test_1_oomkilled_of_old_pod():
    """1. OOMKilled của Pod cũ: Pod tiền nhiệm có termination OOMKilled được thu thập và thẩm định đúng."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    old_pod = PodInfo(
        pod_name="ecommerce-store-app-old-pod",
        pod_id="pod-old-999",
        status="Failed",
        ready=False,
        restart_count=1,
        termination=TerminationDetails(
            last_exit_code=137,
            reason="OOMKilled",
            container_name="ecommerce-app",
            finished_at="2026-11-11T20:30:00Z",
        ),
    )
    req = _create_base_request(all_pods=[old_pod])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    # Collector check
    oom_items = [e for e in evidences if e.evidence_type == EvidenceType.OOM_KILLED]
    assert len(oom_items) >= 1
    assert oom_items[0].target_uid == "pod-old-999"
    assert oom_items[0].reliability == 1.0

    # Validator check with historical pod tracking
    context = {
        "target_uid": "pod-cur-111",
        "historical_pod_uids": ["pod-old-999"],
        "cluster_id": "test-cluster-1",
        "incident_window_start": "2026-11-11T20:20:00Z",
        "has_metrics": True,
        "has_logs": True,
        "has_events": True,
    }
    val_res = validator.validate(evidences, context)
    assert not any(issue.issue_type == "MISMATCHED_POD_UID" for issue in val_res.issues)
    historical_oom = [e for e in val_res.valid_evidences if e.evidence_type == EvidenceType.OOM_KILLED]
    assert len(historical_oom) == 1
    assert historical_oom[0].metadata.get("is_historical_replaced_pod") is True


def test_2_new_pod_after_replace_pod_has_low_ram():
    """2. Pod mới sau REPLACE_POD có RAM thấp: Không coi RAM thấp của Pod mới là mâu thuẫn phủ nhận OOM cũ."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    old_pod = PodInfo(
        pod_name="ecommerce-store-app-old",
        pod_id="pod-old-999",
        status="Failed",
        ready=False,
        termination=TerminationDetails(last_exit_code=137, reason="OOMKilled", finished_at="2026-11-11T20:30:00Z"),
    )
    cur_pod = PodInfo(
        pod_name="ecommerce-store-app-new",
        pod_id="pod-cur-111",
        status="Running",
        ready=True,
    )
    req = _create_base_request(ram=35.0, all_pods=[old_pod, cur_pod])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    context = {
        "target_uid": "pod-cur-111",
        "historical_pod_uids": ["pod-old-999"],
        "cluster_id": "test-cluster-1",
        "incident_window_start": "2026-11-11T20:25:00Z",
        "previous_actions": ["REPLACE_POD"],
    }
    val_res = validator.validate(evidences, context)
    # Must identify POST_REPLACE_VERIFICATION_STATE instead of flagging conflict
    assert any(i.issue_type == "POST_REPLACE_VERIFICATION_STATE" for i in val_res.issues)
    assert len(val_res.conflicting_evidences) == 0


def test_3_exit_code_137_without_oomkilled_reason():
    """3. Exit code 137 nhưng không có reason OOMKilled: Phải phân biệt rõ SIGKILL/Timeout với OOM."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    pod = PodInfo(
        pod_name="ecommerce-store-app-646f88ccfc-4srf6",
        pod_id="pod-cur-111",
        status="Running",
        ready=True,
        termination=TerminationDetails(
            last_exit_code=137,
            reason="Error",  # NOT OOMKilled (e.g. killed by timeout or user)
            finished_at="2026-11-11T21:00:00Z",
        ),
    )
    req = _create_base_request(all_pods=[pod])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    exit_137_items = [e for e in evidences if e.evidence_type == EvidenceType.EXIT_CODE_137_NON_OOM]
    assert len(exit_137_items) == 1
    assert "không có lý do OOMKilled" in exit_137_items[0].description

    val_res = validator.validate(evidences, {"target_uid": "pod-cur-111", "incident_window_start": "2026-11-11T20:50:00Z"})
    assert any(i.issue_type == "EXIT_CODE_137_DISTINCTION" for i in val_res.issues)


def test_4_gru_predicts_oom_99_pct_without_oom_evidence():
    """4. GRU dự đoán OOM 99% nhưng không có bằng chứng OOM: Phân biệt Prediction với Bằng chứng, không coi là xung đột viễn trắc."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    node = NodeInfo(
        node_name="minikube",
        node_id="node-1",
        ram_usage_pct=46.0,
        conditions=NodeConditions(MemoryPressure=False),
    )
    req = _create_base_request(ram=64.0, nodes=[node])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    context = {
        "target_uid": "pod-cur-111",
        "cluster_id": "test-cluster-1",
        "gru_predictions": [{"risk_type": "OOM", "confidence": 0.99}],
        "has_metrics": True,
        "has_logs": True,
        "has_events": True,
    }
    val_res = validator.validate(evidences, context)
    # GRU prediction is not telemetry evidence, must NOT create conflicting_evidences
    assert len(val_res.conflicting_evidences) == 0
    # Must record a predictive risk note
    assert any(i.issue_type == "PREDICTIVE_RISK_NOTE" for i in val_res.issues)


def test_5_probe_timeout_identified_as_symptom():
    """5. Probe Timeout: Xác nhận probe thất bại là triệu chứng (Symptom), không tự động biến thành Root Cause."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    req = _create_base_request(
        events=["Liveness probe failed: context deadline exceeded", "Readiness probe failed: connection refused"]
    )
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    probe_evs = [
        e for e in evidences
        if e.evidence_type in {EvidenceType.LIVENESS_PROBE_FAILED, EvidenceType.READINESS_PROBE_FAILED}
    ]
    assert len(probe_evs) == 2

    val_res = validator.validate(evidences, {"target_uid": "pod-cur-111"})
    for ev in val_res.valid_evidences:
        if ev.evidence_type in {EvidenceType.LIVENESS_PROBE_FAILED, EvidenceType.READINESS_PROBE_FAILED}:
            assert ev.metadata.get("is_symptom") is True
            assert ev.metadata.get("confirms_root_cause") is False


def test_6_low_cpu_usage_with_high_latency():
    """6. CPU usage thấp nhưng Latency cao: Thẩm định loại trừ nguyên nhân bão hòa CPU."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    req = _create_base_request(cpu=12.0, latency=1850.0)
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    val_res = validator.validate(evidences, {"target_uid": "pod-cur-111"})
    assert any(i.issue_type == "LATENCY_NOT_CPU_SATURATION" for i in val_res.issues)


def test_7_node_memory_pressure_collected():
    """7. Node MemoryPressure: Thu thập chính xác áp lực tài nguyên host node và phân biệt với container."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    node = NodeInfo(
        node_name="worker-node-1",
        node_id="node-worker-1",
        ram_usage_pct=94.0,
        conditions=NodeConditions(MemoryPressure=True),
    )
    req = _create_base_request(nodes=[node])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    node_mem_ev = [e for e in evidences if e.evidence_type == EvidenceType.NODE_MEMORY_PRESSURE]
    assert len(node_mem_ev) == 1
    assert node_mem_ev[0].target_resource == "node/worker-node-1"
    assert node_mem_ev[0].value.get("MemoryPressure") is True


def test_8_evidence_without_timestamp():
    """8. Evidence không có timestamp: Validator gắn cờ MISSING_TIMESTAMP và hiệu chỉnh độ tin cậy."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    req = _create_base_request(ram=95.0)
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)
    ram_ev = next(e for e in evidences if e.evidence_type == EvidenceType.HIGH_RAM_USAGE)
    assert ram_ev.timestamp is None

    initial_rel = ram_ev.reliability
    val_res = validator.validate(evidences, {"target_uid": "pod-cur-111"})
    assert any(i.issue_type == "MISSING_TIMESTAMP" for i in val_res.issues)
    assert ram_ev.reliability < initial_rel


def test_9_evidence_with_wrong_pod_uid():
    """9. Evidence sai Pod UID: Validator loại bỏ bằng chứng không khớp UID và gắn cờ MISMATCHED_POD_UID."""
    collector = EvidenceCollector()
    validator = EvidenceValidator()

    alien_pod = PodInfo(
        pod_name="unrelated-daemonset-pod",
        pod_id="alien-uid-8888",
        status="Failed",
        restart_count=5,
    )
    req = _create_base_request(all_pods=[alien_pod])
    evidences = collector.collect(req, kubernetes_raw=req.kubernetes)

    context = {
        "target_uid": "pod-cur-111",
        "historical_pod_uids": ["pod-old-999"],
    }
    val_res = validator.validate(evidences, context)
    assert any(i.issue_type == "MISMATCHED_POD_UID" for i in val_res.issues)
    assert any(e.target_uid == "alien-uid-8888" for e in val_res.rejected_evidences)


def test_10_evidence_outside_incident_time_window():
    """10. Evidence nằm ngoài Incident time window: Loại bỏ bằng chứng quá cũ (stale)."""
    validator = EvidenceValidator()

    # Evidence timestamp 4 hours prior to incident start
    stale_ev = EvidenceItem(
        source=EvidenceSource.CONTAINER_TERMINATION,
        evidence_type=EvidenceType.OOM_KILLED,
        target_resource="pod/ecommerce-store-app",
        target_uid="pod-cur-111",
        timestamp="2026-11-11T15:00:00Z",
        value={"exit_code": 137},
        description="OOMKilled quá khứ từ 4 tiếng trước",
    )
    context = {
        "target_uid": "pod-cur-111",
        "incident_window_start": "2026-11-11T20:00:00Z",
        "incident_window_end": "2026-11-11T21:00:00Z",
    }
    val_res = validator.validate([stale_ev], context)
    assert any(i.issue_type == "STALE_EVIDENCE" for i in val_res.issues)
    assert len(val_res.rejected_evidences) == 1


def test_11_conflicting_evidence_detected():
    """11. Evidence mâu thuẫn: Phát hiện xung đột trực tiếp giữa hai nguồn telemetry thực tế (ví dụ: Exit 0 vs OOMKilled)."""
    validator = EvidenceValidator()

    norm_term = EvidenceItem(
        source=EvidenceSource.CONTAINER_TERMINATION,
        evidence_type=EvidenceType.CONTAINER_NORMAL_TERMINATION,
        target_resource="pod/ecommerce-store-app",
        target_uid="pod-cur-111",
        timestamp=datetime.now(timezone.utc).isoformat(),
        value={"exit_code": 0, "reason": "Completed"},
        description="Container hoàn tất bình thường exit 0",
    )
    oom_term = EvidenceItem(
        source=EvidenceSource.CONTAINER_TERMINATION,
        evidence_type=EvidenceType.OOM_KILLED,
        target_resource="pod/ecommerce-store-app",
        target_uid="pod-cur-111",
        timestamp=datetime.now(timezone.utc).isoformat(),
        value={"exit_code": 137, "reason": "OOMKilled"},
        description="Container bị tiêu diệt do OOMKilled",
    )
    context = {
        "target_uid": "pod-cur-111",
    }
    val_res = validator.validate([norm_term, oom_term], context)
    assert len(val_res.conflicting_evidences) == 1
    assert "Mâu thuẫn" in val_res.conflicting_evidences[0][2]


def test_12_missing_metrics_or_logs():
    """12. Thiếu Metrics hoặc Logs: Ghi nhận danh sách missing_data minh bạch."""
    validator = EvidenceValidator()

    context = {
        "target_uid": "pod-cur-111",
        "has_metrics": False,
        "has_logs": False,
        "has_events": True,
    }
    val_res = validator.validate([], context)
    assert "Metrics viễn trắc chưa được cung cấp" in val_res.missing_data
    assert "Nhật ký logs ứng dụng chưa được cung cấp" in val_res.missing_data
    assert "Kubernetes events chưa được cung cấp" not in val_res.missing_data
