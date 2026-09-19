from __future__ import annotations

from dataclasses import dataclass

from app.agents.historical_incident_agent import HistoricalContext, normalize_cause
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.logs import LogAnalysisResult
from app.schemas.metrics import MetricsAnalysisResult
from app.schemas.prediction import PredictionResponse
from app.schemas.rca import RootCauseResult


@dataclass
class RCAConclusion:
    result: RootCauseResult
    evidence: list[str]
    cause_code: str
    explanation: str
    historical_context_used: bool = False
    similar_incident_ids: list[str] | None = None


class RootCauseAnalysisAgent:
    CAUSE_LABELS = {
        "memory_exhaustion": "Container memory exhausted",
        "storage_exhaustion": "Storage capacity exhausted",
        "cpu_saturation": "CPU saturation",
        "traffic_overload": "Traffic overload",
        "unstable_pod": "Unstable application pod",
        "deployment_failure": "Deployment failure",
        "dependency_failure": "Upstream dependency failure",
        "application_failure": "Application errors",
        "service_degradation": "Service performance degradation",
        "insufficient_replicas": "Insufficient available replicas",
        "scheduling_failure": "Kubernetes scheduling failure",
        "unknown": "UNKNOWN",
    }
    RISK_CAUSES = {
        "CPU_OVERLOAD": "cpu_saturation",
        "OOM": "memory_exhaustion",
        "DISK_FULL": "storage_exhaustion",
        "HIGH_LATENCY": "service_degradation",
        "HTTP_5XX_SPIKE": "application_failure",
        "TRAFFIC_OVERLOAD": "traffic_overload",
    }

    def analyze(
        self,
        prediction: PredictionResponse | None,
        metrics: MetricsAnalysisResult,
        logs: LogAnalysisResult,
        kubernetes: KubernetesAnalysisResult,
        kubernetes_raw: KubernetesData,
        historical: HistoricalContext | None = None,
        previous_action: str | None = None,
        previous_action_result: str | None = None,
        previous_rca_root_cause: str | None = None,
    ) -> RCAConclusion:
        historical = historical or HistoricalContext()
        scores: dict[str, float] = {}
        evidence_by_cause: dict[str, list[str]] = {}

        def add(cause: str, score: float, evidence: str) -> None:
            scores[cause] = scores.get(cause, 0.0) + score
            evidence_by_cause.setdefault(cause, []).append(evidence)

        for cause in metrics.suspected_causes:
            matching = [item for item in metrics.findings if self._finding_matches(cause, item)]
            add(cause, 0.30, matching[0] if matching else f"Metrics indicate {cause.replace('_', ' ')}")
        for cause in logs.suspected_causes:
            matching = self._matching_log(cause, logs.important_logs)
            add(cause, 0.35, matching or f"Application logs indicate {cause.replace('_', ' ')}")
        for cause in kubernetes.suspected_causes:
            matching = [item for item in kubernetes.findings if self._finding_matches(cause, item)]
            add(cause, 0.30, matching[0] if matching else f"Kubernetes events indicate {cause.replace('_', ' ')}")
        if prediction:
            for risk in prediction.detected_risks:
                cause = self.RISK_CAUSES[risk.risk_type]
                add(
                    cause,
                    0.40 * risk.confidence,
                    f"GRU predicted {risk.risk_type} ({risk.confidence:.1%})",
                )

        # A recent deployment plus application failures is stronger than either
        # signal alone. The agent still only recommends; it never performs rollback.
        deployment_text = " ".join(kubernetes_raw.events).lower()
        if ("deploy" in deployment_text or "rollout" in deployment_text) and (
            "application_failure" in scores or "unstable_pod" in scores
        ):
            add("deployment_failure", 0.55, "Failures appeared alongside a deployment/rollout event")

        # History can strengthen a cause only when current evidence already
        # supports that cause. Confirmed diagnoses carry more weight than
        # unconfirmed/predicted diagnoses.
        for incident in historical.incidents:
            source = "predicted"
            historical_cause = normalize_cause(incident.predicted_root_cause)
            weight = 0.05
            if incident.root_cause:
                source = "recorded"
                historical_cause = normalize_cause(incident.root_cause)
                weight = 0.10
            if incident.confirmed_root_cause:
                source = "confirmed"
                historical_cause = normalize_cause(incident.confirmed_root_cause)
                weight = 0.15
            if historical_cause not in scores:
                continue
            detail = (
                f"Similar incident {incident.incident_id} had {source} root cause "
                f"{incident.confirmed_root_cause or incident.root_cause or incident.predicted_root_cause}"
            )
            if incident.executed_action and incident.action_result:
                detail += f"; {incident.executed_action} result was {incident.action_result}"
            add(historical_cause, weight, detail)

        previous_failure_evidence = None
        if previous_action and previous_action_result in {"FAILED", "PARTIAL"}:
            previous_failure_evidence = (
                f"Previous {previous_action} action result was {previous_action_result}"
            )
            # A failed action triggers reassessment but does not by itself
            # disprove the old root cause or forbid the same action forever.

        if not scores:
            return RCAConclusion(
                result=RootCauseResult(cause=self.CAUSE_LABELS["unknown"], confidence=0.30, severity="LOW"),
                evidence=["insufficient_evidence"],
                cause_code="unknown",
                explanation=(
                    "Current metrics, logs, Kubernetes state, and GRU output do not provide "
                    "enough evidence for a safe root-cause recommendation."
                ),
                historical_context_used=False,
                similar_incident_ids=[],
            )

        cause_code = max(scores, key=scores.get)
        raw_score = scores[cause_code]
        confidence = min(0.99, 0.45 + raw_score / 2.0)
        evidence = list(dict.fromkeys(evidence_by_cause[cause_code]))
        if previous_failure_evidence:
            evidence.append(previous_failure_evidence)
        severity = self._severity(cause_code, confidence, prediction, kubernetes_raw)
        similar_ids = historical.similar_incident_ids
        explanation_parts = [
            f"Current incident evidence most strongly supports {self.CAUSE_LABELS.get(cause_code, cause_code)}."
        ]
        if previous_failure_evidence:
            explanation_parts.append(
                f"{previous_failure_evidence}, so the previous diagnosis and remediation were reassessed."
            )
        if similar_ids:
            explanation_parts.append(
                "Historical incidents " + ", ".join(similar_ids)
                + " were used only as supporting evidence after matching current signals."
            )
        return RCAConclusion(
            result=RootCauseResult(
                cause=self.CAUSE_LABELS.get(cause_code, cause_code.replace("_", " ").title()),
                confidence=round(confidence, 4),
                severity=severity,
            ),
            evidence=evidence,
            cause_code=cause_code,
            explanation=" ".join(explanation_parts),
            historical_context_used=bool(similar_ids),
            similar_incident_ids=similar_ids,
        )

    @staticmethod
    def _finding_matches(cause: str, finding: str) -> bool:
        words = {
            "memory_exhaustion": ("ram", "memory", "oom"),
            "storage_exhaustion": ("disk", "storage"),
            "cpu_saturation": ("cpu",),
            "traffic_overload": ("request rate", "traffic"),
            "unstable_pod": ("restart", "probe", "crash"),
            "application_failure": ("5xx", "application"),
            "service_degradation": ("latency", "timeout"),
            "insufficient_replicas": ("replica",),
        }.get(cause, tuple(cause.split("_")))
        lowered = finding.lower()
        return any(word in lowered for word in words)

    @staticmethod
    def _matching_log(cause: str, logs: list[str]) -> str | None:
        needles = {
            "memory_exhaustion": ("oom", "memory"),
            "storage_exhaustion": ("disk", "space left"),
            "dependency_failure": ("connection", "dependency"),
            "unstable_pod": ("crash", "probe", "fatal"),
            "service_degradation": ("timeout",),
        }.get(cause, tuple(cause.split("_")))
        return next((line for line in logs if any(word in line.lower() for word in needles)), None)

    @staticmethod
    def _severity(cause: str, confidence: float, prediction, kubernetes: KubernetesData):
        if cause == "deployment_failure" or kubernetes.available_replicas == 0:
            return "CRITICAL"
        if confidence >= 0.78 or cause in {
            "memory_exhaustion", "storage_exhaustion", "unstable_pod"
        }:
            return "HIGH"
        if prediction and any(
            risk.confidence >= 0.90 for risk in prediction.detected_risks
        ):
            return "HIGH"
        return "MEDIUM"
