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
