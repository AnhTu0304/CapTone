"""Collector for container logs with level inference and secret redaction."""

from datetime import datetime, timezone
import logging
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


class LogsCollector:
    """Collects, classifies, and redacts pod container logs."""

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1
        self._last_read_times: dict[str, datetime] = {}

    def _infer_level(self, line: str) -> Literal["error", "warn", "info"]:
        # Routine MongoDB structured JSON info/debug entries ("s":"I") are informational even if metrics/query names match
        if _JSON_INFO_RE.search(line):
            return "info"
        # Word-boundary regex avoids false positives such as CoreDNS 'NOERROR' matching 'error'
        if _ERROR_LOG_RE.search(line):
            return "error"
        if _WARN_LOG_RE.search(line):
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

            last_time = self._last_read_times.get(pod.name)
            since_seconds = max(1, int((now - last_time).total_seconds())) if last_time else 15

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
                continue

            for raw_line in raw_logs.splitlines():
                line = raw_line.strip()
                if not line:
                    continue

                level = self._infer_level(line)
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
