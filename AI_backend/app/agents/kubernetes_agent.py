from __future__ import annotations

from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData


class KubernetesEventAgent:
    def analyze(self, data: KubernetesData) -> KubernetesAnalysisResult:
        findings: list[str] = []
        causes: set[str] = set()
        text = " ".join([data.pod_status or "", data.container_status or "", *data.events]).lower()
        if data.restart_count >= 3:
            findings.append(f"Pod restarted multiple times ({data.restart_count})")
            causes.add("unstable_pod")
        event_rules = [
            ("readiness probe failed", "Readiness probe is failing", "unstable_pod"),
            ("liveness probe failed", "Liveness probe is failing", "unstable_pod"),
            ("oomkilled", "Container was OOMKilled", "memory_exhaustion"),
            ("crashloopbackoff", "Pod is in CrashLoopBackOff", "unstable_pod"),
            ("imagepullbackoff", "Container image cannot be pulled", "deployment_failure"),
            ("pending", "Pod is pending", "scheduling_failure"),
        ]
        for needle, finding, cause in event_rules:
            if needle in text:
                findings.append(finding)
                causes.add(cause)
        desired = data.desired_replicas
        available = data.available_replicas
        if data.deployment:
            desired = data.deployment.desired_replicas if data.deployment.desired_replicas is not None else desired
            available = data.deployment.available_replicas if data.deployment.available_replicas is not None else available
        if desired is not None and available is not None and available < desired:
            findings.append(f"Available replicas ({available}) are lower than desired replicas ({desired})")
            causes.add("insufficient_replicas")
        return KubernetesAnalysisResult(findings=findings, suspected_causes=sorted(causes))
