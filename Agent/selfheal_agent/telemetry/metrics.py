"""Metrics collection and aggregation for CPU, RAM, Disk, Replicas, and Prometheus."""

from datetime import datetime, timezone
import logging
from typing import Optional
import aiohttp
from kubernetes import client

from selfheal_agent.collectors.pods import PodSummary, parse_cpu_to_millicores, parse_memory_to_bytes
from selfheal_agent.telemetry.schemas import AgentMetricsData

logger = logging.getLogger("selfheal_agent.telemetry.metrics")


class PrometheusCollector:
    """Client for pulling real application and ingress telemetry from Prometheus."""

    def __init__(self, prometheus_url: Optional[str] = None) -> None:
        self.prometheus_url = prometheus_url.rstrip("/") if prometheus_url else None
        self._session: Optional[aiohttp.ClientSession] = None
        self._warned_unconfigured = False

    async def _get_session(self) -> aiohttp.ClientSession:
        if self._session is None or self._session.closed:
            self._session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=4.0))
        return self._session

    async def close(self) -> None:
        if self._session and not self._session.closed:
            await self._session.close()

    async def query_vector(self, query: str) -> dict[str, float]:
        """Execute instant query and return {pod_name: value}."""
        if not self.prometheus_url:
            return {}

        results: dict[str, float] = {}
        url = f"{self.prometheus_url}/api/v1/query"

        try:
            session = await self._get_session()
            async with session.get(url, params={"query": query}) as resp:
                if resp.status == 200:
                    data = await resp.json()
                    for item in data.get("data", {}).get("result", []):
                        labels = item.get("metric", {})
                        pod_name = labels.get("pod") or labels.get("instance")
                        val = item.get("value", [])
                        if pod_name and len(val) >= 2:
                            results[pod_name] = max(0.0, float(val[1]))
        except Exception as err:
            logger.debug("Prometheus query error: %s", err)

        return results

    async def collect_http_metrics(
        self, namespace: Optional[str] = None
    ) -> dict[str, dict[str, float]]:
        """Fetch request rate, latency, and 5xx percentage."""
        if not self.prometheus_url:
            if not self._warned_unconfigured:
                logger.info(
                    "PROMETHEUS_URL is not set. HTTP request_rate, latency, and 5xx telemetry "
                    "will report 0.0 until Prometheus is configured in Helm values."
                )
                self._warned_unconfigured = True
            return {}

        ns_filter = f'namespace="{namespace}", ' if namespace else ""

        rps_map = await self.query_vector(f'sum by (pod) (rate(http_requests_total{{{ns_filter}}}[1m]))')
        latency_map = await self.query_vector(
            f'(sum by (pod) (rate(http_request_duration_seconds_sum{{{ns_filter}}}[1m])) / '
            f'sum by (pod) (rate(http_request_duration_seconds_count{{{ns_filter}}}[1m]))) * 1000'
        )
        err_map = await self.query_vector(
            f'(sum by (pod) (rate(http_requests_total{{{ns_filter}status=~"5.."}}[1m])) / '
            f'sum by (pod) (rate(http_requests_total{{{ns_filter}}}[1m]))) * 100'
        )

        all_pods = set(rps_map.keys()) | set(latency_map.keys()) | set(err_map.keys())
        combined: dict[str, dict[str, float]] = {}
        for pod in all_pods:
            combined[pod] = {
                "request_rate": round(rps_map.get(pod, 0.0), 2),
                "latency": round(latency_map.get(pod, 0.0), 2),
                "http_5xx_rate": round(err_map.get(pod, 0.0), 2),
            }

        return combined


class MetricsManager:
    """Combines pod metadata, Metrics Server API, and Prometheus into protocol metrics."""

    def __init__(
        self,
        custom_objects: Optional[client.CustomObjectsApi],
        prom_collector: Optional[PrometheusCollector] = None,
    ) -> None:
        self.custom_objects = custom_objects
        self.prom_collector = prom_collector

    def get_pod_metrics(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> dict[str, tuple[float, float]]:
        """Query /apis/metrics.k8s.io/v1beta1 for real-time CPU & memory usage."""
        if not self.custom_objects:
            return {}

        metrics_dict: dict[str, tuple[float, float]] = {}
        try:
            if monitor_all or not namespace:
                raw = self.custom_objects.list_cluster_custom_object(
                    group="metrics.k8s.io",
                    version="v1beta1",
                    plural="pods",
                )
            else:
                raw = self.custom_objects.list_namespaced_custom_object(
                    group="metrics.k8s.io",
                    version="v1beta1",
                    namespace=namespace,
                    plural="pods",
                )

            items = raw.get("items", []) if isinstance(raw, dict) else []
            for item in items:
                metadata = item.get("metadata", {})
                pod_name = metadata.get("name")
                if not pod_name:
                    continue

                total_cpu = 0.0
                total_mem = 0.0
                for c in item.get("containers", []):
                    usage = c.get("usage", {})
                    total_cpu += parse_cpu_to_millicores(usage.get("cpu"))
                    total_mem += parse_memory_to_bytes(usage.get("memory"))

                metrics_dict[pod_name] = (total_cpu, total_mem)
        except Exception as err:
            logger.debug("Metrics server not responding (fallback baseline used): %s", err)

        return metrics_dict

    async def aggregate_metrics(
        self,
        pods: list[PodSummary],
        replicas_map: dict[str, int],
        namespace: Optional[str] = None,
        monitor_all: bool = False,
        node_disk_percent: Optional[float] = None,
    ) -> list[AgentMetricsData]:
        """Construct AgentMetricsData for all monitored pods."""
        if not pods:
            return []

        metrics_map = self.get_pod_metrics(namespace, monitor_all)
        prom_data = (
            await self.prom_collector.collect_http_metrics(namespace)
            if self.prom_collector
            else {}
        )

        now_iso = datetime.now(timezone.utc).isoformat()
        results: list[AgentMetricsData] = []
        disk_pct = (
            round(max(0.0, min(100.0, float(node_disk_percent))), 2)
            if node_disk_percent is not None and node_disk_percent > 0.0
            else 10.0
        )

        for pod in pods:
            usage = metrics_map.get(pod.name)
            if usage is not None:
                cpu_m, mem_b = usage
                if pod.cpu_limit_millicores > 0:
                    cpu_percent = round((cpu_m / pod.cpu_limit_millicores) * 100.0, 2)
                else:
                    cpu_percent = round((cpu_m / 1000.0) * 100.0, 2)
                ram_mb = round(mem_b / (1024.0 * 1024.0), 2)
            else:
                # Baseline when cluster has no Metrics Server
                cpu_percent = 5.0
                ram_mb = 64.0

            replica_count = (
                replicas_map.get(pod.service_id)
                or replicas_map.get(pod.name.split("-")[0])
                or 1
            )

            http_stats = prom_data.get(pod.name, {})

            record = AgentMetricsData(
                service_id=pod.service_id,
                pod_id=pod.uid,
                timestamp=now_iso,
                cpu=max(0.0, cpu_percent),
                ram=max(0.0, ram_mb),
                disk=disk_pct,
                request_rate=max(0.0, http_stats.get("request_rate", 0.0)),
                latency=max(0.0, http_stats.get("latency", 0.0)),
                http_5xx_rate=max(0.0, http_stats.get("http_5xx_rate", 0.0)),
                pod_restart_count=pod.restarts,
                replica_count=max(1, replica_count),
            )
            results.append(record)

        return results
