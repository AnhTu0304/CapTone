from __future__ import annotations

from app.rca.models import EvidenceItem, EvidenceType
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData
from app.schemas.metrics import MetricPoint
from app.schemas.rca import Severity, WorkloadSLOContext


class SeverityEvaluator:
    """Evaluates incident Severity based strictly on service availability and business/SLO impact,
    completely independent of RCA confidence, GRU predictions, or consecutive action failures."""

    def evaluate(
        self,
        valid_evidences: list[EvidenceItem],
        kubernetes_raw: KubernetesData | None = None,
        kubernetes_analysis: KubernetesAnalysisResult | None = None,
        metrics: MetricPoint | None = None,
        cause_code: str = "unknown",
        is_primary_database: bool = False,
        workload_slo: WorkloadSLOContext | None = None,
    ) -> Severity:
        # ----------------------------------------------------
        # 0. INTENTIONAL SCALE-TO-ZERO CHECK
        # ----------------------------------------------------
        desired = getattr(kubernetes_raw, "desired_replicas", None)
        available = getattr(kubernetes_raw, "available_replicas", None)
        if kubernetes_raw and kubernetes_raw.deployment:
            desired = kubernetes_raw.deployment.desired_replicas if kubernetes_raw.deployment.desired_replicas is not None else desired
            available = kubernetes_raw.deployment.available_replicas if kubernetes_raw.deployment.available_replicas is not None else available

        # desired_replicas == 0 is an intentional scale-down/maintenance; NEVER CRITICAL!
        if desired is not None and desired == 0:
            return "LOW"

        # ----------------------------------------------------
        # 1. CRITICAL: Total outage, Primary Database compromised, or massive error rate with sufficient sample
        # ----------------------------------------------------
        # A. Primary Database role compromised
        if is_primary_database or (kubernetes_analysis and kubernetes_analysis.is_primary_database):
            return "CRITICAL"

        # B. Total service unavailability (0 available replicas when desired > 0)
        if desired is not None and available is not None and desired > 0 and available == 0:
            return "CRITICAL"

        # C. Catastrophic error rate (HTTP 5xx >= 20% with sufficient traffic sample >= 20 req/s)
        if metrics and metrics.http_5xx_rate >= 20.0 and (metrics.request_rate or 0) >= 20.0:
            return "CRITICAL"

        # D. Deployment rollout complete failure where all replicas are down
        if cause_code == "deployment_failure" and desired is not None and desired > 0 and available == 0:
            return "CRITICAL"

        # ----------------------------------------------------
        # 2. HIGH: Partial outage, significant SLO breach, or host node failure
        # ----------------------------------------------------
        # Replica deficit
        if desired is not None and available is not None and available < desired:
            return "HIGH"

        # Deployment failure with surviving pods is HIGH, not CRITICAL
        if cause_code == "deployment_failure":
            return "HIGH"

        # HTTP 5xx high (Audit 6: distinguish high traffic vs small sample rate)
        if metrics and metrics.http_5xx_rate >= 15.0:
            if (metrics.request_rate or 0) < 5.0 and metrics.http_5xx_rate < 30.0:
                return "MEDIUM"
            return "HIGH"
        if metrics and metrics.http_5xx_rate >= 5.0 and (metrics.request_rate or 0) >= 20.0:
            return "HIGH"

        # Latency evaluation respecting Workload SLO
        slo_latency = 2000.0
        has_custom_slo = bool(workload_slo and workload_slo.latency_threshold_ms)
        if has_custom_slo:
            slo_latency = workload_slo.latency_threshold_ms

        if metrics:
            if has_custom_slo:
                if metrics.latency > slo_latency * 1.5:
                    return "HIGH"
                elif metrics.latency > slo_latency:
                    return "MEDIUM"
            else:
                if metrics.latency >= 2000.0:
                    return "HIGH"

        if kubernetes_analysis and kubernetes_analysis.target_node_pressure:
            return "HIGH"

        ev_types = {e.evidence_type for e in valid_evidences}
        if (
            EvidenceType.OOM_KILLED in ev_types
            or EvidenceType.CRASH_LOOP_BACKOFF in ev_types
            or EvidenceType.STORAGE_CAPACITY_EXHAUSTED in ev_types
        ):
            return "HIGH"

        # ----------------------------------------------------
        # 3. MEDIUM: Elevated latency, high resource usage without service disruption
        # ----------------------------------------------------
        if metrics:
            if not has_custom_slo and metrics.latency >= 650.0:
                return "MEDIUM"
            if metrics.cpu >= 90.0 or metrics.ram >= 90.0:
                return "MEDIUM"

        if cause_code in {"service_degradation", "traffic_overload", "unstable_pod"}:
            return "MEDIUM"

        # ----------------------------------------------------
        # 4. LOW: Minor warnings, underutilized, or unknown without impact
        # ----------------------------------------------------
        return "LOW"
