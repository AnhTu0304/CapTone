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
