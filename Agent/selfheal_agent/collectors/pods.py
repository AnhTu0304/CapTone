"""Collector for Kubernetes Pod resources and container specs."""

import logging
from typing import Optional
from kubernetes import client
from kubernetes.client.exceptions import ApiException

logger = logging.getLogger("selfheal_agent.collectors.pods")


def parse_cpu_to_millicores(cpu_str: Optional[str]) -> float:
    """Parse k8s CPU quantity string into millicores."""
    if not cpu_str:
        return 0.0
    s = str(cpu_str).strip()
    try:
        if s.endswith("n"):
            return float(s[:-1]) / 1_000_000.0
        if s.endswith("u"):
            return float(s[:-1]) / 1_000.0
        if s.endswith("m"):
            return float(s[:-1])
        return float(s) * 1000.0
    except (ValueError, TypeError):
        return 0.0


def parse_memory_to_bytes(mem_str: Optional[str]) -> float:
    """Parse k8s memory quantity string into bytes."""
    if not mem_str:
        return 0.0
    s = str(mem_str).strip()
    try:
        if s.endswith("Ki"):
            return float(s[:-2]) * 1024.0
        if s.endswith("Mi"):
            return float(s[:-2]) * 1024.0 * 1024.0
        if s.endswith("Gi"):
            return float(s[:-2]) * 1024.0 * 1024.0 * 1024.0
        if s.endswith("Ti"):
            return float(s[:-2]) * 1024.0 * 1024.0 * 1024.0 * 1024.0
        if s.endswith("m"):
            return float(s[:-1]) / 1000.0
        return float(s)
    except (ValueError, TypeError):
        return 0.0


def extract_service_id(pod_name: str, labels: Optional[dict[str, str]] = None) -> str:
    """Infer service identifier from Kubernetes labels or pod naming conventions."""
    if labels:
        for key in ("app", "app.kubernetes.io/name", "app.kubernetes.io/instance"):
            if key in labels and labels[key]:
                return labels[key]

    parts = pod_name.split("-")
    if len(parts) >= 3 and len(parts[-1]) == 5 and len(parts[-2]) >= 5:
        return "-".join(parts[:-2])
    if len(parts) >= 2 and (parts[-1].isdigit() or len(parts[-1]) <= 5):
        return "-".join(parts[:-1])
    return pod_name


class PodSummary:
    """Normalized pod workload descriptor."""

    def __init__(
        self,
        name: str,
        namespace: str,
        uid: str,
        service_id: str,
        phase: str,
        restarts: int,
        cpu_limit_millicores: float = 0.0,
        memory_limit_bytes: float = 0.0,
        node_name: Optional[str] = None,
    ) -> None:
        self.name = name
        self.namespace = namespace
        self.uid = uid
        self.service_id = service_id
        self.phase = phase
        self.restarts = restarts
        self.cpu_limit_millicores = cpu_limit_millicores
        self.memory_limit_bytes = memory_limit_bytes
        self.node_name = node_name


class PodsCollector:
    """Queries CoreV1Api for pod workloads."""

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1

    def list_pods(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[PodSummary]:
        if not self.core_v1:
            return []

        try:
            if monitor_all or not namespace:
                pod_list = self.core_v1.list_pod_for_all_namespaces()
            else:
                pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)

            results: list[PodSummary] = []
            for pod in pod_list.items:
                metadata = pod.metadata
                status = pod.status
                spec = pod.spec

                if not metadata or not metadata.name:
                    continue

                pod_name = metadata.name
                pod_ns = metadata.namespace or "default"
                pod_uid = metadata.uid or pod_name
                labels = metadata.labels or {}
                service_id = extract_service_id(pod_name, labels)
                phase = status.phase if status else "Unknown"

                restarts = 0
                if status and status.container_statuses:
                    for cs in status.container_statuses:
                        restarts += cs.restart_count

                cpu_limit = 0.0
                mem_limit = 0.0
                if spec and spec.containers:
                    for c in spec.containers:
                        if c.resources and c.resources.limits:
                            cpu_limit += parse_cpu_to_millicores(c.resources.limits.get("cpu"))
                            mem_limit += parse_memory_to_bytes(c.resources.limits.get("memory"))

                node_name = spec.node_name if spec else None

                results.append(
                    PodSummary(
                        name=pod_name,
                        namespace=pod_ns,
                        uid=pod_uid,
                        service_id=service_id,
                        phase=phase,
                        restarts=restarts,
                        cpu_limit_millicores=cpu_limit,
                        memory_limit_bytes=mem_limit,
                        node_name=node_name,
                    )
                )

            return results
        except ApiException as err:
            logger.error("Kubernetes API error querying pods: %s", err)
            return []
        except Exception as err:
            logger.error("Unexpected error collecting pods: %s", err)
            return []

    def list_pods_detail(self) -> list[dict]:
        if not self.core_v1:
            return []
        results = []
        try:
            pod_list = self.core_v1.list_pod_for_all_namespaces()
            for pod in pod_list.items:
                metadata = pod.metadata
                status = pod.status
                spec = pod.spec
                if not metadata or not metadata.name:
                    continue
                name = metadata.name
                namespace = metadata.namespace or "default"
                uid = metadata.uid or name
                node_name = spec.node_name if spec else None
                phase = status.phase if status else "Unknown"
                
                restarts = 0
                image = ""
                if status and status.container_statuses:
                    for cs in status.container_statuses:
                        restarts += cs.restart_count
                        if not image and cs.image:
                            image = cs.image
                if not image and spec and spec.containers:
                    image = spec.containers[0].image or ""
                
                started_at = None
                if status and status.start_time:
                    started_at = status.start_time.isoformat()

                results.append({
                    "name": name,
                    "namespace": namespace,
                    "node_name": node_name,
                    "kubernetes_uid": uid,
                    "status": phase,
                    "phase": phase,
                    "restart_count": restarts,
                    "image": image,
                    "labels": metadata.labels or {},
                    "started_at": started_at,
                })
        except Exception as err:
            logger.debug("Failed querying pods detail: %s", err)
        return results
