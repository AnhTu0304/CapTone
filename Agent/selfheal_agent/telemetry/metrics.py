"""Metrics collection and aggregation for CPU, RAM, Disk, Replicas, and Prometheus."""

import asyncio
from datetime import datetime, timezone
import logging
import re
import time
from typing import Optional
import aiohttp
from kubernetes import client

from selfheal_agent.collectors.pods import PodSummary, parse_cpu_to_millicores, parse_memory_to_bytes
from selfheal_agent.telemetry.schemas import AgentMetricsData

logger = logging.getLogger("selfheal_agent.telemetry.metrics")

HTTP_LOG_PATTERN = re.compile(
    r'(?:GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+\S+(?:\s+HTTP\/[0-9.]+)?["\s]+(\d{3})',
    re.IGNORECASE,
)


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
    """Combines pod metadata, Metrics Server API, Prometheus, and Active Probes into protocol metrics."""

    def __init__(
        self,
        custom_objects: Optional[client.CustomObjectsApi],
        prom_collector: Optional[PrometheusCollector] = None,
        core_v1: Optional[client.CoreV1Api] = None,
    ) -> None:
        self.custom_objects = custom_objects
        self.prom_collector = prom_collector
        self.core_v1 = core_v1
        self._http_session: Optional[aiohttp.ClientSession] = None
        self._last_log_times: dict[str, datetime] = {}

    async def _get_http_session(self) -> aiohttp.ClientSession:
        if self._http_session is None or self._http_session.closed:
            self._http_session = aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=2.5))
        return self._http_session

    async def close(self) -> None:
        if self._http_session and not self._http_session.closed:
            await self._http_session.close()

    async def probe_pod_http(self, pod: PodSummary) -> dict[str, float]:
        """Actively probe pod HTTP endpoint and calculate real latency, request rate, and 5xx rate."""
        if not pod.pod_ip or pod.phase != "Running":
            return {"request_rate": 0.0, "latency": 0.0, "http_5xx_rate": 0.0}

        url = f"http://{pod.pod_ip}:{pod.port}{pod.health_path}"
        t0 = time.perf_counter()
        probe_latency = 0.0
        probe_status = 200
        telemetry_stats: dict[str, float] = {}

        try:
            session = await self._get_http_session()
            async with session.get(url, timeout=aiohttp.ClientTimeout(total=2.0)) as resp:
                elapsed = (time.perf_counter() - t0) * 1000.0
                probe_latency = round(elapsed, 2)
                probe_status = resp.status
                if resp.status == 200:
                    try:
                        data = await resp.json()
                        if isinstance(data, dict):
                            telemetry_stats = data.get("telemetry", {}) or data.get("metrics", {})
                            active_stress = data.get("activeStress", {})
                            if active_stress and active_stress.get("cpuActive"):
                                telemetry_stats["simulated_cpu"] = float(active_stress.get("cpuLoadPercent", 0.0))
                            if active_stress and active_stress.get("ramActive"):
                                telemetry_stats["simulated_ram_mb"] = float(active_stress.get("ramAllocatedMb", 0.0))
                    except Exception:
                        pass
        except asyncio.TimeoutError:
            probe_latency = 2000.0
            probe_status = 504
        except Exception as err:
            logger.debug("Active probe error for %s (%s): %s", pod.name, url, err)
            probe_latency = 0.0
            probe_status = 500

        # Read recent logs to count requests and 5xx errors
        requests_in_log = 0
        errors_5xx_in_log = 0
        now = datetime.now(timezone.utc)
        last_time = self._last_log_times.get(pod.name)
        since_sec = max(2, min(10, int((now - last_time).total_seconds()))) if last_time else 5
        self._last_log_times[pod.name] = now

        if self.core_v1:
            try:
                raw_logs = self.core_v1.read_namespaced_pod_log(
                    name=pod.name,
                    namespace=pod.namespace,
                    since_seconds=since_sec,
                    tail_lines=150,
                )
                if raw_logs:
                    for raw_line in raw_logs.splitlines():
                        line = raw_line.strip()
                        if not line:
                            continue
                        m = HTTP_LOG_PATTERN.search(line)
                        if m:
                            code = int(m.group(1))
                            requests_in_log += 1
                            if 500 <= code < 600:
                                errors_5xx_in_log += 1
                        elif any(
                            k in line.lower()
                            for k in (
                                "error 500",
                                "status: 500",
                                "http 500",
                                "500 internal",
                                "status 502",
                                "status 503",
                            )
                        ):
                            requests_in_log += 1
                            errors_5xx_in_log += 1
            except Exception as log_err:
                logger.debug("Log read error for %s: %s", pod.name, log_err)

        # Combine telemetry from /health endpoint, logs, and probe
        reqs_in_w = telemetry_stats.get("requestsInWindow") or telemetry_stats.get("requestsLast5s") or 0
        if telemetry_stats and (reqs_in_w > 0 or float(telemetry_stats.get("rps", 0.0)) > 0):
            request_rate = float(telemetry_stats.get("rps", 0.0))
            http_5xx_rate = float(telemetry_stats.get("http5xxRate", 0.0))
        elif requests_in_log > 0:
            request_rate = round(requests_in_log / float(since_sec), 2)
            http_5xx_rate = round((errors_5xx_in_log / requests_in_log) * 100.0, 2)
        else:
            # Baseline when idle (health probe activity)
            request_rate = 0.2
            http_5xx_rate = 100.0 if probe_status >= 500 else 0.0

        return {
            "request_rate": max(0.0, request_rate),
            "latency": max(0.0, probe_latency),
            "http_5xx_rate": max(0.0, min(100.0, http_5xx_rate)),
            "simulated_cpu": telemetry_stats.get("simulated_cpu"),
            "simulated_ram_mb": telemetry_stats.get("simulated_ram_mb"),
        }

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

    def get_node_metrics(self) -> dict[str, tuple[float, float]]:
        """Query /apis/metrics.k8s.io/v1beta1 for real-time host/node CPU & memory usage."""
        if not self.custom_objects:
            return {}

        node_dict: dict[str, tuple[float, float]] = {}
        try:
            raw = self.custom_objects.list_cluster_custom_object(
                group="metrics.k8s.io",
                version="v1beta1",
                plural="nodes",
            )
            items = raw.get("items", []) if isinstance(raw, dict) else []
            for item in items:
                metadata = item.get("metadata", {})
                node_name = metadata.get("name")
                usage = item.get("usage", {})
                if not node_name or not usage:
                    continue

                total_cpu = parse_cpu_to_millicores(usage.get("cpu"))
                total_mem = parse_memory_to_bytes(usage.get("memory"))
                node_dict[node_name] = (total_cpu, total_mem)
        except Exception as err:
            logger.debug("Metrics server node query error: %s", err)

        return node_dict

    async def aggregate_metrics(
        self,
        pods: list[PodSummary],
        replicas_map: dict[str, int],
        namespace: Optional[str] = None,
        monitor_all: bool = False,
        node_disk_percent: Optional[float] = None,
        node_summaries: Optional[list] = None,
    ) -> list[AgentMetricsData]:
        """Construct AgentMetricsData for all monitored pods and cluster nodes."""
        if not pods:
            return []

        metrics_map = self.get_pod_metrics(namespace, monitor_all)
        node_metrics_map = self.get_node_metrics()
        prom_data = (
            await self.prom_collector.collect_http_metrics(namespace)
            if self.prom_collector
            else {}
        )

        # Fallback to active HTTP probe and in-cluster log parsing for pods without Prometheus
        pods_to_probe = [pod for pod in pods if pod.name not in prom_data]
        if pods_to_probe:
            probe_results = await asyncio.gather(
                *[self.probe_pod_http(p) for p in pods_to_probe],
                return_exceptions=True,
            )
            for pod, res in zip(pods_to_probe, probe_results):
                if isinstance(res, dict):
                    prom_data[pod.name] = res
                else:
                    prom_data[pod.name] = {"request_rate": 0.0, "latency": 0.0, "http_5xx_rate": 0.0}

        now_iso = datetime.now(timezone.utc).isoformat()
        results: list[AgentMetricsData] = []
        disk_pct = (
            round(max(0.0, min(100.0, float(node_disk_percent))), 2)
            if node_disk_percent is not None and node_disk_percent > 0.0
            else 10.0
        )

        # Total cluster node metrics
        total_node_cpu_milli = sum(u[0] for u in node_metrics_map.values()) if node_metrics_map else 0.0
        total_node_mem_bytes = sum(u[1] for u in node_metrics_map.values()) if node_metrics_map else 0.0

        # Calculate capacity
        capacity_cpu_milli = 12000.0
        capacity_mem_bytes = 8163262464.0
        if node_summaries:
            c_cpu = sum(getattr(n, 'cpu_allocatable_millicores', 0.0) or getattr(n, 'cpu_capacity_millicores', 0.0) for n in node_summaries)
            c_mem = sum(getattr(n, 'memory_allocatable_bytes', 0.0) or getattr(n, 'memory_capacity_bytes', 0.0) for n in node_summaries)
            if c_cpu > 0:
                capacity_cpu_milli = float(c_cpu)
            if c_mem > 0:
                capacity_mem_bytes = float(c_mem)

        node_cpu_cores = round(total_node_cpu_milli / 1000.0, 2)
        node_ram_gb = round(total_node_mem_bytes / (1024.0 * 1024.0 * 1024.0), 2)
        node_cpu_percent = round((total_node_cpu_milli / capacity_cpu_milli) * 100.0, 2) if capacity_cpu_milli > 0 else 0.0
        node_ram_percent = round((total_node_mem_bytes / capacity_mem_bytes) * 100.0, 2) if capacity_mem_bytes > 0 else 0.0

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

            sim_cpu = http_stats.get("simulated_cpu")
            if sim_cpu is not None and sim_cpu > cpu_percent:
                cpu_percent = sim_cpu

            sim_ram = http_stats.get("simulated_ram_mb")
            if sim_ram is not None:
                ram_mb += sim_ram

            record = AgentMetricsData(
                service_id=pod.service_id,
                pod_id=pod.uid,
                namespace=pod.namespace,
                timestamp=now_iso,
                cpu=max(0.0, cpu_percent),
                ram=max(0.0, ram_mb),
                disk=disk_pct,
                request_rate=max(0.0, http_stats.get("request_rate", 0.0)),
                latency=max(0.0, http_stats.get("latency", 0.0)),
                http_5xx_rate=max(0.0, http_stats.get("http_5xx_rate", 0.0)),
                pod_restart_count=pod.restarts,
                replica_count=max(1, replica_count),
                node_cpu_percent=node_cpu_percent,
                node_ram_percent=node_ram_percent,
                node_cpu_cores=node_cpu_cores,
                node_ram_gb=node_ram_gb,
            )
            results.append(record)

        return results
