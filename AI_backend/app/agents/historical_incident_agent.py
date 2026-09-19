from __future__ import annotations

import re
from dataclasses import dataclass, field

from app.schemas.kubernetes import KubernetesAnalysisResult
from app.schemas.logs import LogAnalysisResult
from app.schemas.metrics import MetricsAnalysisResult
from app.schemas.rca import HistoricalIncident, RCARequest


CAUSE_ALIASES = {
    "CPU_OVERLOAD": "cpu_saturation",
    "CPU_SATURATION": "cpu_saturation",
    "OOM": "memory_exhaustion",
    "MEMORY_EXHAUSTION": "memory_exhaustion",
    "DISK_FULL": "storage_exhaustion",
    "STORAGE_EXHAUSTION": "storage_exhaustion",
    "HIGH_LATENCY": "service_degradation",
    "SERVICE_DEGRADATION": "service_degradation",
    "HTTP_5XX_SPIKE": "application_failure",
    "APPLICATION_FAILURE": "application_failure",
    "TRAFFIC_OVERLOAD": "traffic_overload",
    "UNHEALTHY_POD": "unstable_pod",
    "UNSTABLE_POD": "unstable_pod",
    "UNSTABLE_APPLICATION_POD": "unstable_pod",
    "DEPLOYMENT_FAILURE": "deployment_failure",
    "INSUFFICIENT_REPLICAS": "insufficient_replicas",
}

SIGNAL_PATTERNS = {
    "readiness": ("readiness", "not ready", "unready"),
    "liveness": ("liveness",),
    "http_5xx": ("5xx", "server error", "http 500"),
    "latency": ("latency", "responding slowly", "slow response"),
    "timeout": ("timeout", "timed out"),
    "cpu": ("cpu",),
    "memory": ("memory", "ram", "oom"),
    "disk": ("disk", "storage"),
    "traffic": ("traffic", "request rate", "requests/s"),
    "restart": ("restart", "restarted"),
    "crash": ("crash", "fatal", "panic"),
}


def normalize_cause(value: str | None) -> str | None:
    if not value:
        return None
    key = re.sub(r"[^A-Z0-9]+", "_", value.upper()).strip("_")
    return CAUSE_ALIASES.get(key)


def _signals(texts: list[str]) -> set[str]:
    combined = " ".join(texts).lower()
    return {
        signal
        for signal, patterns in SIGNAL_PATTERNS.items()
        if any(pattern in combined for pattern in patterns)
    }


@dataclass
class HistoricalContext:
    incidents: list[HistoricalIncident] = field(default_factory=list)
    shared_signals: dict[str, list[str]] = field(default_factory=dict)

    @property
    def similar_incident_ids(self) -> list[str]:
        return [incident.incident_id for incident in self.incidents]


class HistoricalIncidentAgent:
    """Selects relevant external memory; it never treats history as ground truth by itself."""

    def analyze(
        self,
        payload: RCARequest,
        metrics: MetricsAnalysisResult,
        logs: LogAnalysisResult,
        kubernetes: KubernetesAnalysisResult,
    ) -> HistoricalContext:
        if not payload.historical_incidents:
            return HistoricalContext()

        current_text = [
            *payload.rule_engine,
            *metrics.findings,
            *logs.important_logs,
            *kubernetes.findings,
            *payload.kubernetes.events,
            str(payload.kubernetes.readiness_probe or ""),
            str(payload.kubernetes.liveness_probe or ""),
        ]
        current_signals = _signals(current_text)
        current_causes = set(metrics.suspected_causes)
        current_causes.update(logs.suspected_causes)
        current_causes.update(kubernetes.suspected_causes)

        ranked: list[tuple[float, HistoricalIncident, list[str]]] = []
        for incident in payload.historical_incidents:
            incident_text = [
                *incident.evidence,
                incident.operator_feedback or "",
                incident.root_cause or "",
                incident.predicted_root_cause or "",
                incident.confirmed_root_cause or "",
            ]
            shared = sorted(current_signals.intersection(_signals(incident_text)))
            confirmed_cause = normalize_cause(incident.confirmed_root_cause)
            fallback_cause = normalize_cause(incident.root_cause or incident.predicted_root_cause)
            cause_matches = confirmed_cause in current_causes or fallback_cause in current_causes
            if not shared and not cause_matches:
                continue

            score = 3.0 * len(shared)
            if cause_matches:
                score += 2.0 if confirmed_cause else 1.0
            if incident.service_id == payload.service_id:
                score += 0.5
            if incident.confirmed_root_cause:
                score += 0.5
            ranked.append((score, incident, shared))

        ranked.sort(key=lambda item: (-item[0], item[1].incident_id))
        selected = ranked[:10]
        return HistoricalContext(
            incidents=[item[1] for item in selected],
            shared_signals={item[1].incident_id: item[2] for item in selected},
        )
