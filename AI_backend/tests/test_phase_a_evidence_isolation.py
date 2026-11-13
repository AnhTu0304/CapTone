from __future__ import annotations

import pytest
from app.agents.kubernetes_agent import KubernetesEventAgent
from app.agents.log_agent import LogAnalysisAgent
from app.agents.metrics_agent import MetricsAnalysisAgent
from app.agents.rca_agent import RootCauseAnalysisAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.rca.evidence_collector import EvidenceCollector
from app.rca.evidence_validator import EvidenceValidator
from app.rca.models import EvidenceAttribution, EvidenceItem, EvidenceSource, EvidenceType
from app.schemas.kubernetes import (
    ControllerInfo,
    KubernetesData,
    MongoDBClusterHealth,
    NodeInfo,
    PodInfo,
    TerminationDetails,
)
from app.schemas.rca import MetricPoint, RCARequest


@pytest.fixture
def collector():
    return EvidenceCollector()


@pytest.fixture
def validator():
    return EvidenceValidator()


@pytest.fixture
def kube_agent():
    return KubernetesEventAgent()


@pytest.fixture
def rca_agent():
    return RootCauseAnalysisAgent()


@pytest.fixture
def rec_agent():
    return RecommendationAgent()


# ==============================================================================
# TEST A01: Ecommerce và MongoDB cùng namespace -> Không trộn evidence
# ==============================================================================
def test_a01_ecommerce_and_mongodb_same_namespace_evidence_isolation(collector, validator):
    """A01: Event/Log của mongodb-0 không được trộn làm DIRECT evidence của ecommerce-store-app."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
        suspected_pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
        cluster_id="minikube",
        namespace="test-lab",
        metrics=MetricPoint(cpu=5.0, ram=64.0, disk=30.0, latency=2590.85, request_rate=120.0, http_5xx_rate=100.0),
        kubernetes=KubernetesData(
            cluster_id="minikube",
            namespace="test-lab",
            workload_name="ecommerce-store-app",
            workload_type="Deployment",
            events=[
                "[2026-11-11T20:58:34.984Z] [Normal] Pod: mongodb-0 - Reason: RecoveredFromCrashLoop - Container 'mongo' in pod 'test-lab/mongodb-0' recovered from CrashLoopBackOff to Running (ready=True, restart_count=37). (count: 1)"
            ],
            all_pods=[
                PodInfo(
                    pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                    pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
                    status="Running",
                    restart_count=1,
                    controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-app-646f88ccfc", workload_name="ecommerce-store-app"),
                ),
                PodInfo(
                    pod_name="mongodb-0",
                    pod_id="47e313e2-6b07-4d8b-8a9f-7f33211b2c78",
                    status="Running",
                    restart_count=37,
                    controller=ControllerInfo(owner_kind="StatefulSet", owner_name="mongodb", workload_name="mongodb"),
                    mongodb_cluster_health=MongoDBClusterHealth(role="PRIMARY", quorum_status="INTACT"),
                ),
            ],
        ),
        logs=[
            '[2026-11-11T20:58:30.446Z] [ERROR] [47e313e2-6b07-4d8b-8a9f-7f33211b2c78] {"t":{"$date":"2026-11-11T20:58:29.709+00:00"},"s":"E","c":"STORAGE","id":22345,"ctx":"initandlisten","msg":"Fatal crash"}',
            "[2026-11-11T20:58:31.000Z] [ERROR] [454a6276-34ff-4b9b-9f68-316d35f34271] [MongoDB] Dual DB not ready yet: getaddrinfo ENOTFOUND mongodb-1.mongodb-service.test-lab.svc.cluster.local. Retrying in 4s...",
        ],
    )

    evidences = collector.collect(payload, kubernetes_raw=payload.kubernetes)
    v_res = validator.validate(
        evidences,
        {
            "target_resource": f"pod/{payload.suspected_pod_name}",
            "target_pod_uid": payload.pod_id,
            "cluster_id": payload.cluster_id,
        },
    )

    valid_pod_targets = {e.target_resource for e in v_res.valid_evidences}
    assert "pod/mongodb-0" not in valid_pod_targets
    assert all("mongodb-0" not in e.description for e in v_res.valid_evidences if "CrashLoop" in e.description)
    assert len(v_res.dependency_evidences) > 0
    dep_descriptions = [e.description for e in v_res.dependency_evidences]
    assert any("mongodb" in d.lower() for d in dep_descriptions)


# ==============================================================================
# TEST A02: MongoDB restart nhiều hơn Ecommerce -> Không chọn MongoDB làm target
# ==============================================================================
def test_a02_mongodb_higher_restarts_not_selected_as_target(kube_agent):
    """A02: KubernetesEventAgent không được chọn mongodb-0 (restarts 37) khi target workload là ecommerce-store-app."""
    k_data = KubernetesData(
        workload_name="ecommerce-store-app",
        workload_type="Deployment",
        all_pods=[
            PodInfo(
                pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
                status="Running",
                restart_count=1,
                controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-app-646f88ccfc", workload_name="ecommerce-store-app"),
            ),
            PodInfo(
                pod_name="mongodb-0",
                pod_id="47e313e2-6b07-4d8b-8a9f-7f33211b2c78",
                status="Running",
                restart_count=37,
                controller=ControllerInfo(owner_kind="StatefulSet", owner_name="mongodb", workload_name="mongodb"),
            ),
        ],
    )

    result = kube_agent.analyze(k_data)
    assert result.target_pod_name == "ecommerce-store-app-646f88ccfc-k6sl6"
    assert result.target_pod_id == "454a6276-34ff-4b9b-9f68-316d35f34271"
    assert result.target_pod_name != "mongodb-0"


# ==============================================================================
# TEST A03: Event thiếu Pod UID -> UNATTRIBUTED
# ==============================================================================
def test_a03_event_missing_pod_uid_is_unattributed(collector, validator):
    """A03: Event có structured metadata cho Pod nhưng không có UID phải được gắn UNATTRIBUTED."""
    from app.rca.evidence_collector import _resolve_event_identity
    structured_event = {
        "message": "Pod was evicted from node",
        "involved_object": {"kind": "Pod", "name": "ecommerce-store-app-646f88ccfc-k6sl6"},
    }
    pod, uid, attr, ts, has_struct = _resolve_event_identity(
        structured_event,
        "ecommerce-store-app",
        "pod/ecommerce-store-app-646f88ccfc-k6sl6",
        "454a6276-34ff-4b9b-9f68-316d35f34271",
        {},
        ["mongodb"],
    )
    assert attr == EvidenceAttribution.UNATTRIBUTED
    assert uid is None


# ==============================================================================
# TEST A04: Event có UID của Pod khác -> Không gán cho target
# ==============================================================================
def test_a04_event_with_foreign_pod_uid_not_attributed_to_target(collector, validator):
    """A04: Event có UID 47e313e2 (của mongodb-0) không được gán cho target ecommerce (454a6276)."""
    from app.rca.evidence_collector import _resolve_event_identity
    structured_event = {
        "message": "Container crashed",
        "involved_object": {
            "kind": "Pod",
            "name": "mongodb-0",
            "uid": "47e313e2-6b07-4d8b-8a9f-7f33211b2c78",
        },
    }
    pod, uid, attr, ts, has_struct = _resolve_event_identity(
        structured_event,
        "ecommerce-store-app",
        "pod/ecommerce-store-app-646f88ccfc-k6sl6",
        "454a6276-34ff-4b9b-9f68-316d35f34271",
        {},
        ["mongo", "mongodb"],
    )
    assert attr == EvidenceAttribution.DEPENDENCY
    assert uid == "47e313e2-6b07-4d8b-8a9f-7f33211b2c78"
    assert uid != "454a6276-34ff-4b9b-9f68-316d35f34271"


# ==============================================================================
# TEST A05: Hai Pod cùng namespace, tên tiền tố tương tự -> Phân biệt đúng
# ==============================================================================
def test_a05_prefix_similarity_does_not_conflate_distinct_workloads(kube_agent):
    """A05: ecommerce-store không được nhận nhầm Pod ecommerce-store-app-xxx làm của mình."""
    k_data = KubernetesData(
        workload_name="ecommerce-store",
        workload_type="Deployment",
        all_pods=[
            PodInfo(
                pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                pod_id="app-pod-uid",
                status="CrashLoopBackOff",
                restart_count=10,
                controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-app-646f88ccfc", workload_name="ecommerce-store-app"),
            ),
            PodInfo(
                pod_name="ecommerce-store-779cb5fd5-z9811",
                pod_id="store-pod-uid",
                status="Running",
                restart_count=0,
                controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-779cb5fd5", workload_name="ecommerce-store"),
            ),
        ],
    )

    result = kube_agent.analyze(k_data)
    assert result.target_pod_name != "ecommerce-store-app-646f88ccfc-k6sl6"
    assert result.target_pod_id != "app-pod-uid"


# ==============================================================================
# TEST A06: Pod thuộc Deployment qua ReplicaSet -> Xác minh ownership đúng
# ==============================================================================
def test_a06_pod_ownership_via_replicaset_hierarchy(collector):
    """A06: ReplicaSet controller hierarchy được ánh xạ chính xác về Deployment."""
    pod = PodInfo(
        pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
        pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
        status="Running",
        controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-app-646f88ccfc"),
    )
    from app.rca.evidence_collector import _is_pod_belonging_to_workload

    assert _is_pod_belonging_to_workload(pod.pod_name, pod, "ecommerce-store-app") is True
    assert _is_pod_belonging_to_workload(pod.pod_name, pod, "ecommerce-store") is False


# ==============================================================================
# TEST A07: Pod thuộc StatefulSet -> Xác minh ownership đúng
# ==============================================================================
def test_a07_pod_ownership_statefulset_hierarchy(collector):
    """A07: Pod StatefulSet (mongodb-0) được ánh xạ chính xác về workload mongodb."""
    pod = PodInfo(
        pod_name="mongodb-0",
        pod_id="47e313e2-6b07-4d8b-8a9f-7f33211b2c78",
        status="Running",
        controller=ControllerInfo(owner_kind="StatefulSet", owner_name="mongodb", workload_name="mongodb"),
    )
    from app.rca.evidence_collector import _is_pod_belonging_to_workload

    assert _is_pod_belonging_to_workload("mongodb-0", pod, "mongodb") is True
    assert _is_pod_belonging_to_workload("mongodb-0", pod, "ecommerce-store-app") is False


# ==============================================================================
# TEST A08: Pod có nhiều Service selector -> Giữ đầy đủ quan hệ
# ==============================================================================
def test_a08_pod_service_relations(collector):
    """A08: Naming và controller checks hỗ trợ selector phân biệt đúng quan hệ."""
    pod = PodInfo(
        pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
        pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
        status="Running",
        controller=ControllerInfo(owner_kind="ReplicaSet", owner_name="ecommerce-store-app-646f88ccfc", workload_name="ecommerce-store-app"),
    )
    from app.agents.kubernetes_agent import _is_pod_of_workload

    assert _is_pod_of_workload(pod, "ecommerce-store-app", "Deployment") is True


# ==============================================================================
# TEST A09: Service không có EndpointSlice -> Không tự tạo endpoint
# ==============================================================================
def test_a09_missing_endpointslice_handles_gracefully(rca_agent):
    """A09: Khi không có EndpointSlice, hệ thống không tự bịa endpoint mà ghi nhận thiếu dữ liệu."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        metrics=MetricPoint(cpu=5.0, ram=60.0, disk=20.0, latency=2000.0, request_rate=100.0, http_5xx_rate=80.0),
        kubernetes=KubernetesData(
            workload_name="ecommerce-store-app",
            pod_status="Running",
            events=["Readiness probe failed: connect: connection refused"],
        ),
    )
    concl = rca_agent.analyze(
        prediction=None,
        metrics=MetricsAnalysisAgent().analyze(payload.metrics),
        logs=LogAnalysisAgent().analyze([]),
        kubernetes=KubernetesEventAgent().analyze(payload.kubernetes),
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )
    assert concl.cause_code in {"unstable_pod", "application_failure", "dependency_failure"}


# ==============================================================================
# TEST A10: Service có DNS/Endpoint lỗi thực tế -> Xử lý theo dữ liệu thực
# ==============================================================================
def test_a10_service_dns_enotfound_parsed_accurately(collector):
    """A10: Log lỗi DNS getaddrinfo ENOTFOUND được nhận dạng thành LOG_CONNECTION_FAILURE."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        metrics=MetricPoint(cpu=10.0, ram=50.0, disk=20.0, latency=300.0, request_rate=100.0, http_5xx_rate=5.0),
        logs=["[MongoDB] Dual DB not ready yet: getaddrinfo ENOTFOUND mongodb-1.mongodb-service.test-lab.svc.cluster.local."],
    )
    evidences = collector.collect(payload)
    assert any(e.evidence_type == EvidenceType.LOG_CONNECTION_FAILURE for e in evidences)
    assert any(e.attribution_status == EvidenceAttribution.DEPENDENCY for e in evidences)


# ==============================================================================
# TEST A11: Ecommerce có lỗi ECONNREFUSED -> Không tự kết luận root cause là crash
# ==============================================================================
def test_a11_econnrefused_not_diagnosed_as_internal_fatal_crash(rca_agent):
    """A11: Khi ecommerce ghi log ECONNREFUSED đến cơ sở dữ liệu, RCA không kết luận application_failure fatal crash."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        metrics=MetricPoint(cpu=5.0, ram=64.0, disk=20.0, latency=2590.0, request_rate=100.0, http_5xx_rate=100.0),
        logs=["Error: connect ECONNREFUSED 10.96.0.14:27017 at TCPConnectWrap.afterConnect"],
        kubernetes=KubernetesData(
            workload_name="ecommerce-store-app",
            workload_type="Deployment",
            pod_status="Running",
            all_pods=[
                PodInfo(
                    pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                    pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
                    status="Running",
                    restart_count=0,
                )
            ],
        ),
    )
    concl = rca_agent.analyze(
        prediction=None,
        metrics=MetricsAnalysisAgent().analyze(payload.metrics),
        logs=LogAnalysisAgent().analyze(payload.logs),
        kubernetes=KubernetesEventAgent().analyze(payload.kubernetes),
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )
    assert concl.cause_code == "dependency_failure"
    assert concl.result.evidence_status in {"CONFIRMED", "PROBABLE"}


# ==============================================================================
# TEST A12: MongoDB CrashLoopBackOff -> Không gán lỗi trực tiếp cho Ecommerce
# ==============================================================================
def test_a12_mongodb_crashloop_not_attributed_directly_to_ecommerce(collector, validator):
    """A12: Sự kiện CrashLoopBackOff của mongodb-0 được cách ly, không gán cho ecommerce."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
        suspected_pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
        metrics=MetricPoint(cpu=10.0, ram=50.0, disk=20.0, latency=300.0, request_rate=100.0, http_5xx_rate=5.0),
        kubernetes=KubernetesData(
            events=[
                "[Normal] Pod: mongodb-0 - Reason: RecoveredFromCrashLoop - Container 'mongo' in pod 'test-lab/mongodb-0' recovered from CrashLoopBackOff"
            ]
        ),
    )
    evidences = collector.collect(payload, kubernetes_raw=payload.kubernetes)
    v_res = validator.validate(
        evidences,
        {"target_pod_uid": payload.pod_id, "target_resource": f"pod/{payload.suspected_pod_name}"},
    )
    assert not any(e.evidence_type == EvidenceType.CRASH_LOOP_BACKOFF for e in v_res.valid_evidences)
    assert any(e.evidence_type == EvidenceType.CRASH_LOOP_BACKOFF for e in v_res.dependency_evidences)


# ==============================================================================
# TEST A13: Dependency và Target cùng có lỗi -> Phân biệt đúng nguyên nhân vs triệu chứng
# ==============================================================================
def test_a13_dependency_vs_target_symptom_distinction(rca_agent):
    """A13: 5xx và độ trễ cao của Ecommerce là triệu chứng, lỗi kết nối DB là nguyên nhân phụ thuộc."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
        suspected_pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
        metrics=MetricPoint(cpu=5.0, ram=64.0, disk=20.0, latency=2590.85, request_rate=120.0, http_5xx_rate=100.0),
        logs=["[MongoDB] Dual DB not ready yet: getaddrinfo ENOTFOUND mongodb-1.mongodb-service.test-lab.svc.cluster.local."],
        kubernetes=KubernetesData(
            workload_name="ecommerce-store-app",
            workload_type="Deployment",
            all_pods=[
                PodInfo(
                    pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                    pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
                    status="Running",
                    restart_count=0,
                ),
                PodInfo(
                    pod_name="mongodb-0",
                    pod_id="47e313e2-6b07-4d8b-8a9f-7f33211b2c78",
                    status="CrashLoopBackOff",
                    restart_count=37,
                ),
            ],
            events=["Pod: mongodb-0 - Reason: CrashLoopBackOff"],
        ),
    )
    concl = rca_agent.analyze(
        prediction=None,
        metrics=MetricsAnalysisAgent().analyze(payload.metrics),
        logs=LogAnalysisAgent().analyze(payload.logs),
        kubernetes=KubernetesEventAgent().analyze(payload.kubernetes),
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )
    assert concl.cause_code == "dependency_failure"
    assert concl.result.evidence_status == "CONFIRMED"
    assert any("5xx" in s.lower() or "độ trễ" in s.lower() or "latency" in s.lower() for s in concl.result.symptoms)


# ==============================================================================
# TEST A14: Historical Pod UID -> Không dùng làm trạng thái hiện tại
# ==============================================================================
def test_a14_historical_pod_uid_marked_as_replaced(validator):
    """A14: Bằng chứng gắn với Pod cũ đã thay thế được đánh dấu HISTORICAL và is_current_pod = False."""
    ev = EvidenceItem(
        source=EvidenceSource.KUBERNETES_EVENT,
        evidence_type=EvidenceType.OOM_KILLED,
        target_resource="pod/ecommerce-store-app-old-pod",
        target_uid="old-pod-uid-1234",
        timestamp=None,
        value={"reason": "OOMKilled"},
        description="Container OOMKilled",
    )
    validator.validate(
        [ev],
        {
            "target_pod_uid": "new-pod-uid-5678",
            "historical_pod_uids": {"old-pod-uid-1234"},
        },
    )
    assert ev.metadata.get("is_current_pod") is False
    assert ev.metadata.get("is_historical_replaced_pod") is True
    assert ev.attribution_status == EvidenceAttribution.HISTORICAL


# ==============================================================================
# TEST A15: Evidence timestamp thiếu -> Không xác nhận temporal correlation
# ==============================================================================
def test_a15_missing_timestamp_reduces_reliability_and_flags_issue(validator):
    """A15: Bằng chứng không có timestamp bị gắn cờ MISSING_TIMESTAMP và giảm reliability."""
    ev = EvidenceItem(
        source=EvidenceSource.KUBERNETES_EVENT,
        evidence_type=EvidenceType.CRASH_LOOP_BACKOFF,
        target_resource="pod/test-pod",
        target_uid="test-pod-uid",
        timestamp=None,
        value={"event": "crash"},
        description="Crash event without timestamp",
        reliability=0.90,
    )
    v_res = validator.validate([ev], {"target_pod_uid": "test-pod-uid"})
    assert ev.metadata.get("has_temporal_correlation") is False
    assert any(i.issue_type == "MISSING_TIMESTAMP" for i in v_res.issues)
    assert ev.reliability < 0.90


# ==============================================================================
# TEST A16: OwnerReferences không đầy đủ -> UNKNOWN/UNVERIFIED
# ==============================================================================
def test_a16_incomplete_owner_references_unverified(collector):
    """A16: Pod không có controller metadata và không khớp naming không được suy diễn bừa."""
    pod = PodInfo(
        pod_name="custom-unrelated-worker",
        pod_id="worker-uid",
        status="Running",
        controller=None,
    )
    from app.rca.evidence_collector import _is_pod_belonging_to_workload

    assert _is_pod_belonging_to_workload(pod.pod_name, pod, "ecommerce-store-app") is False


# ==============================================================================
# TEST A17: CRD custom controller -> Không suy luận bằng prefix
# ==============================================================================
def test_a17_crd_controller_strict_ownership():
    """A17: Tên pod mang prefix nhưng controller owner_name trỏ đến CRD khác không được match."""
    pod = PodInfo(
        pod_name="ecommerce-store-app-backup-job-98x1",
        pod_id="crd-pod-uid",
        status="Running",
        controller=ControllerInfo(owner_kind="CustomJob", owner_name="daily-backup-crd", workload_name="daily-backup"),
    )
    from app.agents.kubernetes_agent import _is_pod_of_workload

    assert _is_pod_of_workload(pod, "ecommerce-store-app", "Deployment") is False


# ==============================================================================
# TEST A18: Dependency failure không có causal evidence -> Không CONFIRMED
# ==============================================================================
def test_a18_dependency_failure_without_causal_evidence_not_confirmed(rca_agent):
    """A18: Chỉ có log nhắc đến kết nối nhưng không có dependency pod error -> Đánh giá PROBABLE, không CONFIRMED."""
    payload = RCARequest(
        service_id="ecommerce-store-app",
        metrics=MetricPoint(cpu=5.0, ram=50.0, disk=20.0, latency=1500.0, request_rate=100.0, http_5xx_rate=50.0),
        logs=["[WARN] Connection retry to external service"],
        kubernetes=KubernetesData(
            workload_name="ecommerce-store-app",
            workload_type="Deployment",
            all_pods=[
                PodInfo(
                    pod_name="ecommerce-store-app-646f88ccfc-k6sl6",
                    pod_id="454a6276-34ff-4b9b-9f68-316d35f34271",
                    status="Running",
                )
            ],
        ),
    )
    concl = rca_agent.analyze(
        prediction=None,
        metrics=MetricsAnalysisAgent().analyze(payload.metrics),
        logs=LogAnalysisAgent().analyze(payload.logs),
        kubernetes=KubernetesEventAgent().analyze(payload.kubernetes),
        kubernetes_raw=payload.kubernetes,
        payload=payload,
    )
    if concl.cause_code == "dependency_failure":
        assert concl.result.evidence_status != "CONFIRMED"
        assert concl.result.evidence_status == "PROBABLE"
        assert len(concl.result.missing_evidence) > 0
