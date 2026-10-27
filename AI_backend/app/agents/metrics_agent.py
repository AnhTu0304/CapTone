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
            (current.cpu >= 90, f"Mức sử dụng CPU ở ngưỡng nguy hiểm ({current.cpu:.1f}%)", "cpu_saturation"),
            (current.ram >= 92, f"Mức sử dụng RAM ở ngưỡng nguy hiểm ({current.ram:.1f}%)", "memory_exhaustion"),
            (current.disk >= 92, f"Mức sử dụng ổ đĩa ở ngưỡng nguy hiểm ({current.disk:.1f}%)", "storage_exhaustion"),
            (current.latency >= 650, f"Độ trễ xử lý cao hơn bình thường ({current.latency:.1f} ms)", "service_degradation"),
            (current.http_5xx_rate >= 5, f"Tỷ lệ lỗi HTTP 5xx ở mức cao ({current.http_5xx_rate:.2f}%)", "application_failure"),
            (current.request_rate >= 900, f"Lưu lượng yêu cầu (Request rate) tăng cao ({current.request_rate:.1f})", "traffic_overload"),
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
                ("Độ trễ (Latency)", first.latency, current.latency, 250),
                ("Lưu lượng truy cập", first.request_rate, current.request_rate, 250),
            ]
            for name, start, end, delta in trends:
                if end - start >= delta:
                    findings.append(f"{name} tăng nhanh đột biến ({start:.1f} lên {end:.1f})")

            # Fine-grained slope analysis for memory exhaustion
            if current.ram >= 90 and current.ram - first.ram >= 15:
                slope = (current.ram - first.ram) / len(history)
                slope_label = "STEEP_UPWARD (Dốc đứng)" if slope >= 2.0 else "STEADY_INCREASE (Tăng đều)"
                findings.append(
                    f"Xu hướng RAM tăng dốc {slope_label} (+{current.ram - first.ram:.1f}% "
                    f"qua {len(history)} mốc đo), chạm mức bão hòa ({current.ram:.1f}%)"
                )
                causes.add("memory_exhaustion")

        return MetricsAnalysisResult(
            status="ABNORMAL" if findings else "NORMAL",
            findings=findings or ["Các chỉ số viễn trắc nằm trong ngưỡng an toàn"],
            suspected_causes=sorted(causes),
        )
