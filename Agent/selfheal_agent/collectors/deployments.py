"""Collector for Kubernetes Deployment workloads and replica counts."""

import logging
from typing import Optional
from kubernetes import client

logger = logging.getLogger("selfheal_agent.collectors.deployments")


class DeploymentsCollector:
    """Queries AppsV1Api for deployment specifications and replica counts."""

    def __init__(self, apps_v1: Optional[client.AppsV1Api]) -> None:
        self.apps_v1 = apps_v1

    def get_replicas_map(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> dict[str, int]:
        """Fetch replica count mapped by deployment name and service identifier."""
        if not self.apps_v1:
            return {}

        replicas_map: dict[str, int] = {}
        try:
            if monitor_all or not namespace:
                deps = self.apps_v1.list_deployment_for_all_namespaces()
            else:
                deps = self.apps_v1.list_namespaced_deployment(namespace=namespace)

            for dep in deps.items:
                if not dep.metadata or not dep.metadata.name:
                    continue
                name = dep.metadata.name
                count = (
                    dep.status.available_replicas
                    if dep.status and dep.status.available_replicas is not None
                    else (dep.spec.replicas if dep.spec and dep.spec.replicas is not None else 1)
                )
                replicas_map[name] = max(1, count)
        except Exception as err:
            logger.debug("Failed querying deployments for replica counts: %s", err)

        return replicas_map
