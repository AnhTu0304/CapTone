"""Collector for Kubernetes cluster Node resources."""

import logging
from typing import Optional
from kubernetes import client

logger = logging.getLogger("selfheal_agent.collectors.nodes")


class NodeSummary:
    """Summary of a Kubernetes Node."""

    def __init__(
        self,
        name: str,
        ready: bool,
        cpu_allocatable_millicores: float = 0.0,
        memory_allocatable_bytes: float = 0.0,
    ) -> None:
        self.name = name
        self.ready = ready
        self.cpu_allocatable_millicores = cpu_allocatable_millicores
        self.memory_allocatable_bytes = memory_allocatable_bytes


class NodesCollector:
    """Queries CoreV1Api for node status and allocatable resources."""

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1

    def list_nodes(self) -> list[NodeSummary]:
        if not self.core_v1:
            return []

        results: list[NodeSummary] = []
        try:
            node_list = self.core_v1.list_node()
            for node in node_list.items:
                if not node.metadata or not node.metadata.name:
                    continue

                is_ready = False
                for cond in (node.status.conditions or []):
                    if cond.type == "Ready" and cond.status == "True":
                        is_ready = True
                        break

                results.append(
                    NodeSummary(
                        name=node.metadata.name,
                        ready=is_ready,
                    )
                )
        except Exception as err:
            logger.debug("Failed querying nodes (RBAC may restrict node listing): %s", err)

        return results

    def list_namespaces(self) -> list[dict]:
        if not self.core_v1:
            return []
        results = []
        try:
            ns_list = self.core_v1.list_namespace()
            for ns in ns_list.items:
                if not ns.metadata or not ns.metadata.name:
                    continue
                results.append({
                    "name": ns.metadata.name,
                    "kubernetes_uid": ns.metadata.uid or ns.metadata.name,
                    "status": ns.status.phase if ns.status else "Active",
                    "labels": ns.metadata.labels or {},
                })
        except Exception as err:
            logger.debug("Failed querying namespaces: %s", err)
        return results

    def list_nodes_detail(self) -> list[dict]:
        if not self.core_v1:
            return []
        results = []
        try:
            from selfheal_agent.collectors.pods import parse_cpu_to_millicores, parse_memory_to_bytes
            node_list = self.core_v1.list_node()
            for node in node_list.items:
                if not node.metadata or not node.metadata.name:
                    continue
                name = node.metadata.name
                uid = node.metadata.uid or name
                is_ready = False
                for cond in (node.status.conditions or []):
                    if cond.type == "Ready" and cond.status == "True":
                        is_ready = True
                        break
                status = "Ready" if is_ready else "NotReady"
                
                capacity = node.status.capacity or {}
                cpu_milli = int(parse_cpu_to_millicores(capacity.get("cpu", "4")))
                mem_bytes = int(parse_memory_to_bytes(capacity.get("memory", "8Gi")))
                disk_bytes = int(parse_memory_to_bytes(capacity.get("ephemeral-storage", "50Gi")))
                
                kubelet = ""
                if node.status.node_info:
                    kubelet = node.status.node_info.kubelet_version or ""
                
                labels = node.metadata.labels or {}
                roles = []
                for k in labels.keys():
                    if k.startswith("node-role.kubernetes.io/"):
                        role = k.split("/", 1)[1]
                        if role:
                            roles.append(role)
                if not roles:
                    roles = ["control-plane"] if "node-role.kubernetes.io/control-plane" in labels else ["worker"]
                
                results.append({
                    "name": name,
                    "kubernetes_uid": uid,
                    "status": status,
                    "cpu_capacity_millicores": cpu_milli,
                    "memory_capacity_bytes": mem_bytes,
                    "disk_capacity_bytes": disk_bytes,
                    "kubelet_version": kubelet,
                    "roles": roles,
                    "labels": labels,
                })
        except Exception as err:
            logger.debug("Failed querying nodes detail: %s", err)
        return results
