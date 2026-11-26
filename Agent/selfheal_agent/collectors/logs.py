"""Collector for container logs with severity filtering, deduplication, and secret redaction."""

from collections import Counter
from datetime import datetime, timezone
import logging
import math
import re
from typing import Literal, Optional
from kubernetes import client

from selfheal_agent.collectors.pods import PodSummary
from selfheal_agent.telemetry.schemas import AgentLogData
from selfheal_agent.utils.redaction import redact_sensitive_data

logger = logging.getLogger("selfheal_agent.collectors.logs")

_JSON_INFO_RE = re.compile(r'"s"\s*:\s*"(?:I|D)"')
_ERROR_LOG_RE = re.compile(
    r"(?<![a-z0-9_])(error|fatal|exception|crash|oom|oomkilled|panic|failed|traceback|critical|err)(?![a-z0-9_])",
    re.IGNORECASE,
)
_WARN_LOG_RE = re.compile(
    r"(?<![a-z0-9_])(warn|warning|timeout|retry|slow|backoff|unhealthy)(?![a-z0-9_])",
    re.IGNORECASE,
)
# Stricter warning matcher for infra pods so routine status text ("retry"/"slow") isn't misclassified as WARN.
_INFRA_WARN_RE = re.compile(
    r"(?<![a-z0-9_])(warn|warning|backoff|unhealthy|evict|evicted)(?![a-z0-9_])",
    re.IGNORECASE,
)

_INFRA_NAMESPACES = {
    "kube-system",
    "kube-public",
    "kube-node-lease",
    "monitoring",
    "ingress-nginx",
    "local-path-storage",
    "selfheal-system",
}

_INFRA_NAME_PREFIXES = (
    "coredns",
    "kindnet",
    "storage-provisioner",
    "etcd",
    "kube-apiserver",
    "kube-controller-manager",
    "kube-scheduler",
    "kube-proxy",
    "metrics-server",
    "dashboard-metrics-scraper",
    "kubernetes-dashboard",
    "opentelemetry-collector",
    "otel-collector",
    "prometheus",
    "grafana",
    "loki",
    "selfheal-agent",
    "captone-main-backend",
    "captone-ai-backend",
    "captone-installer-service",
    "captone-postgres",
    "captone-redis",
    "selfheal-platform-web",
    "selfheal_platform_web",
    "nginx-proxy",
)


def is_infrastructure_pod(pod: PodSummary) -> bool:
    """Returns True for Kubernetes/platform infrastructure pods where INFO noise dominates DB bloat."""
    ns = (pod.namespace or "").strip().lower()
    if ns in _INFRA_NAMESPACES:
        return True
    pod_name = (pod.name or "").strip().lower()
    service_id = (pod.service_id or "").strip().lower()
    return any(
        pod_name.startswith(prefix) or service_id.startswith(prefix)
        for prefix in _INFRA_NAME_PREFIXES
    )


def _is_selfheal_agent_pod(pod: PodSummary) -> bool:
    pod_name = (pod.name or "").strip().lower()
    service_id = (pod.service_id or "").strip().lower()
    return pod_name.startswith("selfheal-agent") or service_id.startswith("selfheal-agent")


class LogsCollector:
    """Collects, filters, classifies, deduplicates, and redacts pod container logs."""

    def __init__(
        self,
        core_v1: Optional[client.CoreV1Api],
        filter_infra_info: bool = True,
        drop_all_info: bool = False,
    ) -> None:
        self.core_v1 = core_v1
        self.filter_infra_info = filter_infra_info
        self.drop_all_info = drop_all_info
        self._last_read_times: dict[str, datetime] = {}
        self._prev_line_counts: dict[str, Counter[str]] = {}

    def _infer_level(self, line: str, is_infra: bool = False) -> Literal["error", "warn", "info"]:
        # Routine MongoDB structured JSON info/debug entries ("s":"I") are informational even if metrics/query names match
        if _JSON_INFO_RE.search(line):
            return "info"
        # Word-boundary regex avoids false positives such as CoreDNS 'NOERROR' matching 'error'
        if _ERROR_LOG_RE.search(line):
            return "error"
        warn_re = _INFRA_WARN_RE if is_infra else _WARN_LOG_RE
        if warn_re.search(line):
            return "warn"
        return "info"

    def collect_pod_logs(self, pods: list[PodSummary]) -> list[AgentLogData]:
        if not self.core_v1 or not pods:
            return []

        now = datetime.now(timezone.utc)
        records: list[AgentLogData] = []

        for pod in pods:
            if pod.phase not in ("Running", "Failed"):
                continue

            is_infra = is_infrastructure_pod(pod)
            is_self_agent = _is_selfheal_agent_pod(pod)
            last_time = self._last_read_times.get(pod.name)
            since_seconds = max(1, math.ceil((now - last_time).total_seconds())) if last_time else 15

            try:
                raw_logs = self.core_v1.read_namespaced_pod_log(
                    name=pod.name,
                    namespace=pod.namespace,
                    since_seconds=since_seconds,
                    tail_lines=50,
                    _request_timeout=3,
                )
                self._last_read_times[pod.name] = now
            except Exception:
                continue

            if not raw_logs or not raw_logs.strip():
                self._prev_line_counts[pod.name] = Counter()
                continue

            lines = [raw.strip() for raw in raw_logs.splitlines() if raw.strip()]
            prev_counts = self._prev_line_counts.get(pod.name, Counter())
            overlap_budget = prev_counts.copy() if last_time else Counter()
            self._prev_line_counts[pod.name] = Counter(lines)

            for line in lines:
                if overlap_budget.get(line, 0) > 0:
                    overlap_budget[line] -= 1
                    continue

                level = self._infer_level(line, is_infra=is_infra)
                # Prevent selfheal-agent self-feedback loops for INFO/WARN and strip routine infra INFO noise
                if is_self_agent and level != "error":
                    continue
                if level == "info" and (self.drop_all_info or (self.filter_infra_info and is_infra)):
                    continue

                sanitized = redact_sensitive_data(line)[:1000]

                records.append(
                    AgentLogData(
                        service_id=pod.service_id,
                        pod_id=pod.uid,
                        namespace=pod.namespace,
                        timestamp=now.isoformat(),
                        level=level,
                        message=sanitized,
                    )
                )

        return records
