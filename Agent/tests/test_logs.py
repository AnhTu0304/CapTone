"""Tests for container log severity inference (preventing NOERROR / routine JSON info false positives)."""

from selfheal_agent.collectors.logs import LogsCollector


def test_infer_level_does_not_misclassify_coredns_noerror_or_mongodb_info() -> None:
    collector = LogsCollector(core_v1=None)

    coredns_line = '[INFO] 10.244.0.12:47168 - 59467 "AAAA IN otel-collector.monitoring.svc.cluster.local. udp 40 false 512" NOERROR qr,aa,rd 78 0.00089'
    mongo_info_line = '{"t":{"$date":"2026-11-25T18:28:01.984+00:00"},"s":"I", "c":"EXECUTOR", "id":22988, "msg":"failed_ops counter info"}'

    assert collector._infer_level(coredns_line) == "info"
    assert collector._infer_level(mongo_info_line) == "info"


def test_infer_level_detects_real_errors_and_warnings() -> None:
    collector = LogsCollector(core_v1=None)

    assert collector._infer_level("2026-11-25 [ERROR] Database connection failed: ECONNREFUSED") == "error"
    assert collector._infer_level("Unhandled Exception: OOMKilled container") == "error"
    assert collector._infer_level("2026-11-25 [WARNING] Request timeout after 3000ms") == "warn"


def test_collect_pod_logs_filters_infra_info_false_warns_and_boundary_duplicates() -> None:
    from unittest.mock import MagicMock
    from selfheal_agent.collectors.pods import PodSummary

    mock_core = MagicMock()
    infra_pod = PodSummary(
        name="coredns-787d4945fb-abc",
        namespace="kube-system",
        uid="uid-coredns",
        service_id="coredns",
        phase="Running",
        restarts=0,
    )
    storage_pod = PodSummary(
        name="storage-provisioner",
        namespace="kube-system",
        uid="uid-storage",
        service_id="storage-provisioner",
        phase="Running",
        restarts=0,
    )
    agent_pod = PodSummary(
        name="selfheal-agent-xyz",
        namespace="selfheal-system",
        uid="uid-agent",
        service_id="selfheal-agent",
        phase="Running",
        restarts=0,
    )
    app_pod = PodSummary(
        name="ecommerce-store-app-1",
        namespace="test-lab",
        uid="uid-app",
        service_id="ecommerce-store-app",
        phase="Running",
        restarts=0,
    )

    def fake_read_logs(name: str, **_kwargs) -> str:
        if name == "coredns-787d4945fb-abc":
            return "DNS query OK NOERROR\n[ERROR] upstream resolver SERVFAIL error\n"
        if name == "storage-provisioner":
            return "volume retry loop slow sync complete\n[WARNING] persistent volume backoff\n"
        if name == "selfheal-agent-xyz":
            return "[INFO] heartbeat sent\n[WARNING] retry loop\n"
        return "GET /api/products 200 12ms\n[ERROR] Mongo timeout on checkout\n"

    mock_core.read_namespaced_pod_log.side_effect = fake_read_logs

    collector = LogsCollector(core_v1=mock_core, filter_infra_info=True, drop_all_info=False)
    pods = [infra_pod, storage_pod, agent_pod, app_pod]

    first_batch = collector.collect_pod_logs(pods)
    # coredns keeps only 1 ERROR; storage-provisioner ignores routine 'retry/slow' INFO and keeps genuine warning;
    # selfheal-agent drops own INFO/WARN; app keeps both INFO and ERROR
    assert [(item.service_id, item.level) for item in first_batch] == [
        ("coredns", "error"),
        ("storage-provisioner", "warn"),
        ("ecommerce-store-app", "info"),
        ("ecommerce-store-app", "error"),
    ]

    # Boundary overlap poll returning identical lines is deduplicated cleanly
    second_batch = collector.collect_pod_logs(pods)
    assert second_batch == []

    # Optional drop_all_info=True drops INFO even on user app workloads
    strict_collector = LogsCollector(core_v1=mock_core, filter_infra_info=True, drop_all_info=True)
    strict_batch = strict_collector.collect_pod_logs([app_pod])
    assert [(item.service_id, item.level) for item in strict_batch] == [
        ("ecommerce-store-app", "error"),
    ]
