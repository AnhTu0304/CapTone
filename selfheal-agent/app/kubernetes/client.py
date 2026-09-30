"""Kubernetes Client Wrapper for SelfHeal Agent v0.1.

Integrates with the official Kubernetes Python client, supporting both LOCAL
kubeconfig development mode and IN_CLUSTER configuration. Provides safe
cluster connectivity detection and read-only resource discovery foundations.
"""

from typing import Any, Dict, List, Optional
from kubernetes import client, config
from kubernetes.client.exceptions import ApiException
from kubernetes.config.config_exception import ConfigException

from app.config.constants import KubernetesMode
from app.logging.logger import get_logger

logger = get_logger("selfheal.kubernetes.client")


class KubernetesConnectionError(Exception):
    """Raised when the agent fails to establish or verify connection with the Kubernetes API server."""
    pass


class KubernetesClient:
    """Encapsulates official Kubernetes Python client for cluster discovery and telemetry."""

    def __init__(
        self,
        mode: KubernetesMode = KubernetesMode.LOCAL,
        kubeconfig_path: Optional[str] = None,
    ):
        self.mode = mode
        self.kubeconfig_path = kubeconfig_path
        self._is_initialized = False

        self._core_v1: Optional[client.CoreV1Api] = None
        self._apps_v1: Optional[client.AppsV1Api] = None
        self._version_api: Optional[client.VersionApi] = None

    def initialize(self) -> bool:
        """Load Kubernetes configuration based on configured mode."""
        try:
            if self.mode == KubernetesMode.IN_CLUSTER:
                logger.info("Initializing Kubernetes client in IN_CLUSTER mode...")
                config.load_incluster_config()
            else:
                logger.info(
                    "Initializing Kubernetes client in LOCAL mode (kubeconfig: %s)...",
                    self.kubeconfig_path or "default (~/.kube/config)",
                )
                config.load_kube_config(config_file=self.kubeconfig_path)

            self._core_v1 = client.CoreV1Api()
            self._apps_v1 = client.AppsV1Api()
            self._version_api = client.VersionApi()
            self._is_initialized = True
            logger.info("Kubernetes configuration loaded successfully")
            return True

        except ConfigException as cfg_err:
            logger.warning(
                "Failed to load Kubernetes configuration for mode [%s]: %s",
                self.mode.value,
                cfg_err,
            )
            self._is_initialized = False
            return False
        except Exception as exc:
            logger.warning("Unexpected error during Kubernetes client initialization: %s", exc)
            self._is_initialized = False
            return False

    def check_connectivity(self) -> Dict[str, Any]:
        """Verify live connectivity with the Kubernetes API server."""
        if not self._is_initialized:
            # Attempt lazy initialization
            if not self.initialize():
                return {
                    "connected": False,
                    "mode": self.mode.value,
                    "error": "Configuration not loaded",
                }

        try:
            version_info = self._version_api.get_code()
            return {
                "connected": True,
                "mode": self.mode.value,
                "git_version": version_info.git_version,
                "major": version_info.major,
                "minor": version_info.minor,
                "platform": version_info.platform,
            }
        except ApiException as api_err:
            logger.warning("Kubernetes API error during connectivity check: HTTP %d %s", api_err.status, api_err.reason)
            return {
                "connected": False,
                "mode": self.mode.value,
                "error": f"API Error: {api_err.status} {api_err.reason}",
            }
        except Exception as exc:
            logger.warning("Kubernetes cluster connection check failed: %s", exc)
            return {
                "connected": False,
                "mode": self.mode.value,
                "error": str(exc),
            }

    def get_connectivity_status(self) -> Dict[str, Any]:
        """Quick status helper for inclusion in heartbeat telemetry."""
        return self.check_connectivity()

    # =========================================================================
    # Read-Only Kubernetes Discovery Capabilities (Agent v0.1 Foundation)
    # Destructive operations (patch, delete, scale, restart) are strictly omitted.
    # =========================================================================

    def list_nodes(self) -> List[Dict[str, Any]]:
        """List cluster worker and master nodes (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            node_list = self._core_v1.list_node()
            return [
                {
                    "name": node.metadata.name,
                    "status": [c.type for c in (node.status.conditions or []) if c.status == "True"],
                    "kubelet_version": getattr(node.status.node_info, "kubelet_version", "unknown"),
                    "os_image": getattr(node.status.node_info, "os_image", "unknown"),
                }
                for node in node_list.items
            ]
        except Exception as exc:
            logger.error("Failed to list Kubernetes nodes: %s", exc)
            raise KubernetesConnectionError(f"Could not list nodes: {exc}") from exc

    def list_namespaces(self) -> List[str]:
        """List all cluster namespaces (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            ns_list = self._core_v1.list_namespace()
            return [ns.metadata.name for ns in ns_list.items]
        except Exception as exc:
            logger.error("Failed to list Kubernetes namespaces: %s", exc)
            raise KubernetesConnectionError(f"Could not list namespaces: {exc}") from exc

    def list_pods(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """List pods in a namespace or across all namespaces (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            if namespace:
                pod_list = self._core_v1.list_namespaced_pod(namespace=namespace)
            else:
                pod_list = self._core_v1.list_pod_for_all_namespaces()

            return [
                {
                    "name": pod.metadata.name,
                    "namespace": pod.metadata.namespace,
                    "phase": pod.status.phase,
                    "pod_ip": pod.status.pod_ip,
                    "node_name": pod.spec.node_name,
                }
                for pod in pod_list.items
            ]
        except Exception as exc:
            logger.error("Failed to list Kubernetes pods: %s", exc)
            raise KubernetesConnectionError(f"Could not list pods: {exc}") from exc

    def list_deployments(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """List deployments in a namespace or across all namespaces (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            if namespace:
                dep_list = self._apps_v1.list_namespaced_deployment(namespace=namespace)
            else:
                dep_list = self._apps_v1.list_deployment_for_all_namespaces()

            return [
                {
                    "name": dep.metadata.name,
                    "namespace": dep.metadata.namespace,
                    "replicas": dep.spec.replicas,
                    "available_replicas": dep.status.available_replicas or 0,
                    "ready_replicas": dep.status.ready_replicas or 0,
                }
                for dep in dep_list.items
            ]
        except Exception as exc:
            logger.error("Failed to list Kubernetes deployments: %s", exc)
            raise KubernetesConnectionError(f"Could not list deployments: {exc}") from exc

    def list_services(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """List services in a namespace or across all namespaces (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            if namespace:
                svc_list = self._core_v1.list_namespaced_service(namespace=namespace)
            else:
                svc_list = self._core_v1.list_service_for_all_namespaces()

            return [
                {
                    "name": svc.metadata.name,
                    "namespace": svc.metadata.namespace,
                    "type": svc.spec.type,
                    "cluster_ip": svc.spec.cluster_ip,
                }
                for svc in svc_list.items
            ]
        except Exception as exc:
            logger.error("Failed to list Kubernetes services: %s", exc)
            raise KubernetesConnectionError(f"Could not list services: {exc}") from exc

    def list_events(self, namespace: Optional[str] = None) -> List[Dict[str, Any]]:
        """List cluster events (read-only)."""
        if not self._is_initialized and not self.initialize():
            raise KubernetesConnectionError("Kubernetes client is not initialized")

        try:
            if namespace:
                event_list = self._core_v1.list_namespaced_event(namespace=namespace)
            else:
                event_list = self._core_v1.list_event_for_all_namespaces()

            return [
                {
                    "name": ev.metadata.name,
                    "namespace": ev.metadata.namespace,
                    "type": ev.type,
                    "reason": ev.reason,
                    "message": ev.message,
                    "count": ev.count,
                }
                for ev in event_list.items[:50]  # capped to avoid payload bloat
            ]
        except Exception as exc:
            logger.error("Failed to list Kubernetes events: %s", exc)
            raise KubernetesConnectionError(f"Could not list events: {exc}") from exc
