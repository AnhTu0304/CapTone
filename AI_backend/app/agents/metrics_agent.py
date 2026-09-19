from __future__ import annotations

from app.schemas.metrics import MetricPoint, MetricsAnalysisResult
from app.schemas.prediction import GRUMetricPoint


class MetricsAnalysisAgent:
    def analyze(
        self, current: MetricPoint, history: list[GRUMetricPoint] | None = None
    ) -> MetricsAnalysisResult:
        findings: list[str] = []
        causes: set[str] = set()

        checks = [
            (current.cpu >= 90, f"CPU usage is critically high ({current.cpu:.1f}%)", "cpu_saturation"),
            (current.ram >= 92, f"RAM usage is critically high ({current.ram:.1f}%)", "memory_exhaustion"),
            (current.disk >= 92, f"Disk usage is critically high ({current.disk:.1f}%)", "storage_exhaustion"),
            (current.latency >= 650, f"Latency is above normal ({current.latency:.1f} ms)", "service_degradation"),
            (current.http_5xx_rate >= 5, f"HTTP 5xx rate is high ({current.http_5xx_rate:.2f}%)", "application_failure"),
            (current.request_rate >= 900, f"Request rate is high ({current.request_rate:.1f})", "traffic_overload"),
        ]
        for condition, finding, cause in checks:
            if condition:
                findings.append(finding)
                causes.add(cause)

        if history and len(history) > 1:
            first = history[0]
            trends = [
                ("CPU", first.cpu, current.cpu, 15),
                ("RAM", first.ram, current.ram, 15),
                ("latency", first.latency, current.latency, 250),
                ("request rate", first.request_rate, current.request_rate, 250),
            ]
            for name, start, end, delta in trends:
                if end - start >= delta:
                    findings.append(f"{name} increased rapidly ({start:.1f} to {end:.1f})")

        return MetricsAnalysisResult(
            status="ABNORMAL" if findings else "NORMAL",
            findings=findings or ["Metrics are within configured thresholds"],
            suspected_causes=sorted(causes),
        )
