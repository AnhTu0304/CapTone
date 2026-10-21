"""Collector for Kubernetes Service resources."""

import logging
from typing import Any, Optional
from kubernetes import client

logger = logging.getLogger("selfheal_agent.collectors.services")


class ServiceSummary:
    """Summary of a Kubernetes Service."""

    def __init__(
        self,
        name: str,
        namespace: str,
        service_type: str,
        cluster_ip: Optional[str] = None,
        ports: Optional[list[int]] = None,
        selector: Optional[dict[str, str]] = None,
    ) -> None:
        self.name = name
        self.namespace = namespace
        self.service_type = service_type
        self.cluster_ip = cluster_ip
        self.ports = ports or []
        self.selector = selector or {}


class ServicesCollector:
    """Queries CoreV1Api for cluster services."""

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1

    def list_services(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[ServiceSummary]:
        if not self.core_v1:
            return []

        results: list[ServiceSummary] = []
        try:
            if monitor_all or not namespace:
                svc_list = self.core_v1.list_service_for_all_namespaces()
            else:
                svc_list = self.core_v1.list_namespaced_service(namespace=namespace)

            for svc in svc_list.items:
                if not svc.metadata or not svc.metadata.name:
                    continue

                ports = [p.port for p in (svc.spec.ports or []) if p.port]
                results.append(
                    ServiceSummary(
                        name=svc.metadata.name,
                        namespace=svc.metadata.namespace or "default",
                        service_type=svc.spec.type or "ClusterIP",
                        cluster_ip=svc.spec.cluster_ip,
                        ports=ports,
                        selector=svc.spec.selector or {},
                    )
                )
        except Exception as err:
            logger.debug("Failed querying services: %s", err)

        return results
