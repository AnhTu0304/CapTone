from __future__ import annotations

import re

from app.schemas.logs import LogAnalysisResult


class LogAnalysisAgent:
    PATTERNS = [
        (re.compile(r"oomkilled|out of memory|cannot allocate memory", re.I), "out_of_memory", "memory_exhaustion"),
        (re.compile(r"no space left|disk full", re.I), "disk_full", "storage_exhaustion"),
        (re.compile(r"connection refused|connection reset|dependency.*(fail|timeout)", re.I), "dependency_connection_failure", "dependency_failure"),
        (re.compile(r"readiness probe failed", re.I), "readiness_probe_failed", "unstable_pod"),
        (re.compile(r"liveness probe failed", re.I), "liveness_probe_failed", "unstable_pod"),
        (re.compile(r"timeout|timed out", re.I), "timeout", "service_degradation"),
        (re.compile(r"crash|fatal|panic", re.I), "application_crash", "unstable_pod"),
    ]
    LEVEL = re.compile(r"\b(error|warning|warn|critical|fatal|oomkilled)\b", re.I)

    def analyze(self, logs: list[str]) -> LogAnalysisResult:
        important: list[str] = []
        seen: set[str] = set()
        errors: set[str] = set()
        causes: set[str] = set()
        for raw in logs:
            line = raw.strip()
            if not line:
                continue
            matched = False
            for pattern, error, cause in self.PATTERNS:
                if pattern.search(line):
                    matched = True
                    errors.add(error)
                    causes.add(cause)
            if (matched or self.LEVEL.search(line)) and line not in seen:
                important.append(line[:4000])
                seen.add(line)
            if len(important) >= 100:
                break
        return LogAnalysisResult(
            important_logs=important,
            detected_errors=sorted(errors),
            suspected_causes=sorted(causes),
        )
