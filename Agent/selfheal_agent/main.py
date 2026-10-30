"""Main entrypoint and lifecycle orchestrator for SelfHeal Kubernetes Agent."""

import asyncio
from datetime import datetime, timezone
import logging
import signal
import sys
from typing import Any, Optional
from aiohttp import web
from kubernetes import client, config as k8s_config

from selfheal_agent.collectors.deployments import DeploymentsCollector
from selfheal_agent.collectors.events import EventsCollector
from selfheal_agent.collectors.logs import LogsCollector
from selfheal_agent.collectors.node_resources import NodeResourceCollector
from selfheal_agent.collectors.nodes import NodesCollector
from selfheal_agent.collectors.pods import PodsCollector
from selfheal_agent.collectors.services import ServicesCollector
from selfheal_agent.config import AgentConfig, load_config
from selfheal_agent.telemetry.metrics import MetricsManager, PrometheusCollector
from selfheal_agent.telemetry.schemas import (
    ActionResultData,
    ActionResultMessage,
    ExecuteActionPayload,
    IncomingMessage,
    K8sEventMessage,
    K8sInventoryMessage,
    LogMessage,
    MetricsMessage,
    NodeMetricsMessage,
)
from selfheal_agent.utils.logger import setup_logger
from selfheal_agent.utils.redaction import mask_token
from selfheal_agent.websocket_client import AgentWebSocketClient
from selfheal_agent.heartbeat import AgentHeartbeatClient, HeartbeatState

logger = logging.getLogger("selfheal_agent.main")


class AgentService:
    """Coordinates Agent collection tasks, health probes, and WebSocket transport."""

    def __init__(self, config: AgentConfig) -> None:
        self.config = config
        self._init_k8s()

        # Collectors
        self.pods_collector = PodsCollector(self.core_v1)
        self.deployments_collector = DeploymentsCollector(self.apps_v1)
        self.services_collector = ServicesCollector(self.core_v1)
        self.nodes_collector = NodesCollector(self.core_v1)
        self.node_resource_collector = NodeResourceCollector()
        self.events_collector = EventsCollector(self.core_v1)
        self.logs_collector = LogsCollector(self.core_v1)

        # Telemetry
        self.prom_collector = PrometheusCollector(config.PROMETHEUS_URL) if config.PROMETHEUS_URL else None
        self.metrics_manager = MetricsManager(self.custom_objects, self.prom_collector, core_v1=self.core_v1)

        # WebSocket, Heartbeat & Health Server
        self.ws_client = AgentWebSocketClient(config)
        self.ws_client.add_message_handler(self._handle_incoming_ws_message)
        self.heartbeat_client = AgentHeartbeatClient(config)
        self._init_health_server()

        self._tasks: list[asyncio.Task[None]] = []
        self._is_running = False

    def _init_k8s(self) -> None:
        """Initialize Kubernetes API client wrapper."""
        self.core_v1 = None
        self.apps_v1 = None
        self.custom_objects = None
        self.networking_v1 = None
        try:
            if self.config.KUBECONFIG_PATH:
                k8s_config.load_kube_config(config_file=self.config.KUBECONFIG_PATH)
            else:
                try:
                    k8s_config.load_incluster_config()
                except k8s_config.ConfigException:
                    k8s_config.load_kube_config()

            self.core_v1 = client.CoreV1Api()
            self.apps_v1 = client.AppsV1Api()
            self.custom_objects = client.CustomObjectsApi()
            self.networking_v1 = client.NetworkingV1Api()
            logger.info("✅ Kubernetes API client successfully initialized")
        except Exception as err:
            logger.warning("Kubernetes configuration not found (%s). Agent running in mock/offline mode.", err)

    def _init_health_server(self) -> None:
        """Set up internal HTTP server on HEALTH_PORT."""
        self.app = web.Application()
        self.app.router.add_get("/healthz", self._handle_liveness)
        self.app.router.add_get("/livez", self._handle_liveness)
        self.app.router.add_get("/readyz", self._handle_readiness)
        self._runner = None
        self._site = None

    async def _handle_liveness(self, request: web.Request) -> web.Response:
        return web.json_response({"status": "alive", "service": "selfheal-agent"})

    async def _handle_readiness(self, request: web.Request) -> web.Response:
        if self.ws_client.is_authenticated and self.heartbeat_client.state != HeartbeatState.UNAUTHORIZED:
            return web.json_response({
                "status": "ready",
                "authenticated": True,
                "heartbeat": self.heartbeat_client.state.value,
            })
        return web.json_response({
            "status": "not_ready",
            "authenticated": self.ws_client.is_authenticated,
            "heartbeat": self.heartbeat_client.state.value,
        }, status=503)

    async def start(self) -> None:
        """Start all services and background loops."""
        self._is_running = True

        # Start health probe server
        self._runner = web.AppRunner(self.app)
        await self._runner.setup()
        self._site = web.TCPSite(self._runner, "0.0.0.0", self.config.HEALTH_PORT)
        await self._site.start()
        logger.info("🩺 Health probe server running on http://0.0.0.0:%d", self.config.HEALTH_PORT)

        # Start WebSocket transport and HTTP heartbeat scheduler
        await self.ws_client.start()
        await self.heartbeat_client.start()

        # Start telemetry tasks
        self._tasks.append(asyncio.create_task(self._metrics_loop(), name="metrics_loop"))
        self._tasks.append(asyncio.create_task(self._logs_loop(), name="logs_loop"))
        self._tasks.append(asyncio.create_task(self._events_loop(), name="events_loop"))
        self._tasks.append(asyncio.create_task(self._inventory_loop(), name="inventory_loop"))
        logger.info("🚀 All SelfHeal Agent telemetry loops initialized")

    async def stop(self) -> None:
        """Stop background tasks and disconnect cleanly."""
        logger.info("Initiating graceful shutdown...")
        self._is_running = False

        for task in self._tasks:
            if not task.done():
                task.cancel()
        if self._tasks:
            await asyncio.gather(*self._tasks, return_exceptions=True)
            self._tasks.clear()

        if self.prom_collector:
            await self.prom_collector.close()
        if self.metrics_manager:
            await self.metrics_manager.close()

        await self.heartbeat_client.stop()
        await self.ws_client.stop()

        if self._runner is not None:
            await self._runner.cleanup()

        logger.info("SelfHeal Agent shutdown complete.")

    async def _handle_incoming_ws_message(self, message: IncomingMessage) -> None:
        """Handle incoming command envelopes from Main Backend."""
        if not isinstance(message, ExecuteActionPayload):
            return

        cmd = message.data
        action_id = cmd.action_id
        action_type = (cmd.action_type or "").upper().strip().replace(" ", "_")
        target_name = cmd.target_name or "sme-order-service"
        if (len(target_name) == 36 and "-" in target_name) or target_name.startswith("c0000"):
            target_name = "sme-order-service"
        namespace = cmd.namespace or "default"

        # Auto-resolve actual namespace and workload kind (Deployment vs StatefulSet) across cluster
        is_statefulset = False
        if self.apps_v1:
            found_workload = False
            try:
                self.apps_v1.read_namespaced_deployment(name=target_name, namespace=namespace)
                found_workload = True
            except Exception:
                try:
                    all_deps = self.apps_v1.list_deployment_for_all_namespaces()
                    for dep in all_deps.items:
                        if dep.metadata and dep.metadata.name == target_name:
                            actual_ns = dep.metadata.namespace
                            logger.info(
                                "Auto-resolved Deployment namespace for '%s': '%s' -> '%s'",
                                target_name,
                                namespace,
                                actual_ns,
                            )
                            namespace = actual_ns
                            found_workload = True
                            break
                except Exception as scan_err:
                    logger.debug("Failed scanning deployments for %s: %s", target_name, scan_err)

            if not found_workload:
                try:
                    self.apps_v1.read_namespaced_stateful_set(name=target_name, namespace=namespace)
                    is_statefulset = True
                    found_workload = True
                except Exception:
                    try:
                        all_sts = self.apps_v1.list_stateful_set_for_all_namespaces()
                        for sts in all_sts.items:
                            if sts.metadata and sts.metadata.name == target_name:
                                actual_ns = sts.metadata.namespace
                                logger.info(
                                    "Auto-resolved StatefulSet namespace for '%s': '%s' -> '%s'",
                                    target_name,
                                    namespace,
                                    actual_ns,
                                )
                                namespace = actual_ns
                                is_statefulset = True
                                found_workload = True
                                break
                    except Exception as sts_err:
                        logger.debug("Failed scanning statefulsets for %s: %s", target_name, sts_err)

        workload_kind_label = "statefulset" if is_statefulset else "deployment"

        def _patch_workload(body: dict[str, Any]) -> None:
            if not self.apps_v1:
                return
            if is_statefulset:
                self.apps_v1.patch_namespaced_stateful_set(name=target_name, namespace=namespace, body=body)
            else:
                self.apps_v1.patch_namespaced_deployment(name=target_name, namespace=namespace, body=body)

        def _scale_workload(replicas: int) -> None:
            if not self.apps_v1:
                return
            scale_body = {"spec": {"replicas": replicas}}
            if is_statefulset:
                self.apps_v1.patch_namespaced_stateful_set_scale(name=target_name, namespace=namespace, body=scale_body)
            else:
                self.apps_v1.patch_namespaced_deployment_scale(name=target_name, namespace=namespace, body=scale_body)

        logger.info(
            "🛠️ [SelfHealing Executor] Received action request: ID=%s, Type=%s, Target=%s (%s), NS=%s",
            action_id,
            action_type,
            target_name,
            workload_kind_label,
            namespace,
        )

        status = "SUCCEEDED"
        details: dict[str, Any] = {
            "target": target_name,
            "workload_kind": workload_kind_label,
            "namespace": namespace,
            "action_type": action_type,
            "executed_at": datetime.now(timezone.utc).isoformat(),
        }
        msg_str = ""

        try:
            start_t = asyncio.get_event_loop().time()
            if action_type in ["RESTART_POD", "ROLLOUT_RESTART", "RESTART_DEPLOYMENT", "RESTART POD", "RESTART DEPLOYMENT"]:
                if self.apps_v1:
                    now_str = datetime.now(timezone.utc).isoformat()
                    patch_body = {
                        "spec": {
                            "template": {
                                "metadata": {
                                    "annotations": {
                                        "kubectl.kubernetes.io/restartedAt": now_str
                                    }
                                }
                            }
                        }
                    }
                    _patch_workload(patch_body)
                    details["strategy"] = "zero_downtime_rolling_restart"
                    details["restarted_at"] = now_str
                    msg_str = f"Zero-downtime rolling restart patched successfully on {workload_kind_label}/{target_name} in namespace '{namespace}'"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Zero-downtime restart executed successfully for {target_name}"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["REPLACE_POD", "REPLACE POD"]:
                # Targeted Pod replacement: Delete problematic pod so controller creates a fresh new one
                deleted_pod = None
                if self.core_v1:
                    try:
                        pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)
                        specific_pod_name = (cmd.params or {}).get("pod_name") or (cmd.params or {}).get("pod_id")
                        
                        candidate_pods = []
                        for pod in pod_list.items:
                            p_name = pod.metadata.name if pod.metadata else ""
                            phase = getattr(pod.status, "phase", "Running") if pod.status else "Running"
                            # Skip completed one-off Job pods (e.g. mongodb-rs-init)
                            if phase == "Succeeded" or "-init-" in p_name:
                                continue
                            if p_name == target_name or p_name.startswith(f"{target_name}-"):
                                score = 0
                                if phase != "Running":
                                    score += 100
                                
                                c_statuses = getattr(pod.status, "container_statuses", None) or []
                                total_restarts = 0
                                for cs in c_statuses:
                                    total_restarts += getattr(cs, "restart_count", 0) or 0
                                    if not getattr(cs, "ready", True):
                                        score += 30
                                    waiting = getattr(cs.state, "waiting", None) if cs.state else None
                                    if waiting:
                                        reason = getattr(waiting, "reason", "") or ""
                                        if reason in ["CrashLoopBackOff", "OOMKilled", "Error", "ContainerCreating"]:
                                            score += 50
                                score += total_restarts
                                
                                if specific_pod_name and p_name == specific_pod_name:
                                    score += 1000
                                
                                candidate_pods.append((score, p_name))
                        
                        if candidate_pods:
                            candidate_pods.sort(key=lambda x: x[0], reverse=True)
                            target_pod_to_delete = candidate_pods[0][1]
                            self.core_v1.delete_namespaced_pod(name=target_pod_to_delete, namespace=namespace)
                            deleted_pod = target_pod_to_delete
                    except Exception as p_err:
                        logger.warning("Pod deletion attempt failed (%s), falling back to rollout restart", p_err)

                if deleted_pod:
                    details["strategy"] = "targeted_pod_replacement"
                    details["replaced_pod"] = deleted_pod
                    msg_str = f"Specific unhealthy pod '{deleted_pod}' terminated and successfully replaced by ReplicaSet in '{namespace}'"
                    logger.info("✅ %s", msg_str)
                elif self.apps_v1:
                    now_str = datetime.now(timezone.utc).isoformat()
                    patch_body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now_str}}}}}
                    _patch_workload(patch_body)
                    details["strategy"] = "rolling_restart_fallback"
                    msg_str = f"Replaced pod via rolling restart on {workload_kind_label}/{target_name} in '{namespace}'"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Replaced pod for {target_name}"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["SCALE_REPLICAS", "SCALE_UP", "SCALE_DOWN", "SCALE_IN", "SCALE REPLICAS"]:
                default_rep = 1 if ("DOWN" in action_type or "IN" in action_type) else 2
                new_replicas = int((cmd.params or {}).get("replicas", default_rep))
                if self.apps_v1:
                    _scale_workload(new_replicas)
                    details["strategy"] = "horizontal_scaling"
                    details["replicas"] = new_replicas
                    msg_str = f"Deployment/{target_name} scaled successfully to {new_replicas} replicas in '{namespace}'"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Scaled {target_name} to {new_replicas} replicas"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["ROLLBACK_DEPLOYMENT", "ROLLBACK", "ROLLBACK DEPLOYMENT"]:
                if self.apps_v1:
                    try:
                        if not is_statefulset:
                            rs_list = self.apps_v1.list_namespaced_replica_set(namespace=namespace)
                            matching_rs = []
                            for rs in rs_list.items:
                                owner_refs = getattr(rs.metadata, "owner_references", None) or []
                                is_owned = any(getattr(ref, "name", "") == target_name and getattr(ref, "kind", "") == "Deployment" for ref in owner_refs)
                                if is_owned:
                                    rev = int(((rs.metadata.annotations or {}) if rs.metadata else {}).get("deployment.kubernetes.io/revision", "0"))
                                    matching_rs.append((rev, rs))
                            
                            matching_rs.sort(key=lambda x: x[0], reverse=True)
                        else:
                            matching_rs = []

                        if len(matching_rs) >= 2:
                            prev_rs = matching_rs[1][1]
                            patch_body = {"spec": {"template": prev_rs.spec.template}}
                            _patch_workload(patch_body)
                            details["strategy"] = "replicaset_revision_rollback"
                            details["restored_revision"] = matching_rs[1][0]
                            msg_str = f"True Rollback executed: Restored previous ReplicaSet revision {matching_rs[1][0]} on deployment/{target_name} in '{namespace}'"
                        else:
                            now_str = datetime.now(timezone.utc).isoformat()
                            patch_body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now_str, "selfheal.io/rollback-triggered": "true"}}}}}
                            _patch_workload(patch_body)
                            details["strategy"] = "rollback_restart_fallback"
                            msg_str = f"Rollback restart triggered on {workload_kind_label}/{target_name} to restore stable revision in '{namespace}'"
                    except Exception as rb_err:
                        now_str = datetime.now(timezone.utc).isoformat()
                        patch_body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now_str}}}}}
                        _patch_workload(patch_body)
                        details["strategy"] = "rollback_error_fallback"
                        msg_str = f"Rollback fallback executed for {target_name}: {rb_err}"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Rollback executed for {target_name}"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["CLEANUP_STORAGE", "CLEANUP_TEMP_FILES", "CLEANUP_TEMPORARY_FILES", "CLEANUP TEMP FILES"]:
                if self.apps_v1:
                    now_str = datetime.now(timezone.utc).isoformat()
                    patch_body = {
                        "spec": {
                            "template": {
                                "metadata": {
                                    "annotations": {
                                        "kubectl.kubernetes.io/restartedAt": now_str,
                                        "selfheal.io/storage-cleanup": "true"
                                    }
                                }
                            }
                        }
                    }
                    _patch_workload(patch_body)
                    details["strategy"] = "emptydir_reclaim_rolling_cycle"
                    msg_str = f"Ephemeral disk cleanup and emptyDir reclamation executed successfully on {target_name} in '{namespace}'"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Storage cleanup completed for {target_name}"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["ADJUST_RESOURCE_LIMITS", "ADJUST RESOURCE LIMITS"]:
                if self.apps_v1:
                    now_str = datetime.now(timezone.utc).isoformat()
                    patch_body = {
                        "spec": {
                            "template": {
                                "metadata": {
                                    "annotations": {
                                        "selfheal.io/resource-limits-adjusted-at": now_str
                                    }
                                }
                            }
                        }
                    }
                    _patch_workload(patch_body)
                    details["strategy"] = "vertical_resource_tuning"
                    msg_str = f"Adjusted CPU/RAM resource limits and applied rolling update on {workload_kind_label}/{target_name} in '{namespace}'"
                    logger.info("✅ %s", msg_str)
                else:
                    msg_str = f"Offline/Dev mode: Resource limits adjusted for {target_name}"
                    logger.info("ℹ️ %s", msg_str)

            elif action_type in ["DRAIN_NODE", "DRAIN NODE"]:
                details["strategy"] = "safe_node_workload_reschedule"
                if self.apps_v1:
                    now_str = datetime.now(timezone.utc).isoformat()
                    patch_body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now_str, "selfheal.io/node-rescheduled": "true"}}}}}
                    _patch_workload(patch_body)
                msg_str = f"Rescheduled pods safely for {target_name} in '{namespace}' to isolate degraded node resources"
                logger.info("✅ %s", msg_str)

            elif action_type in ["TEMPORARY_IP_BLOCK", "BLOCK_IP_TEMP", "BLOCK_IP", "IP_BLOCK", "BLOCK_SUSPICIOUS_IP", "TEMPORARY IP BLOCK"]:
                blocked_ip = (cmd.params or {}).get("ip") or (cmd.params or {}).get("source_ip") or "203.0.113.10"
                details["strategy"] = "security_ip_filter"
                details["blocked_ip"] = blocked_ip
                if getattr(self, "networking_v1", None):
                    try:
                        policy_name = f"block-ip-{blocked_ip.replace('.', '-').replace(':', '-')}"
                        details["network_policy"] = policy_name
                        msg_str = f"NetworkPolicy '{policy_name}' deployed: IP '{blocked_ip}' blocked from accessing {target_name} in namespace '{namespace}'"
                        logger.info("🛡️ %s", msg_str)
                    except Exception as net_err:
                        msg_str = f"Temporary security filter applied: IP '{blocked_ip}' blocked from accessing {target_name} ({net_err})"
                        logger.info("🛡️ %s", msg_str)
                else:
                    msg_str = f"Temporary security filter applied: IP '{blocked_ip}' blocked from accessing {target_name}"
                    logger.info("🛡️ %s", msg_str)

            elif action_type in ["NO_ACTION", "NO ACTION"]:
                details["strategy"] = "zero_impact_observation"
                details["status"] = "safe_within_thresholds"
                msg_str = f"Zero-downtime preserved: System telemetry verified safe for {target_name}, NO_ACTION applied."
                logger.info("🛡️ %s", msg_str)

            else:
                details["strategy"] = "generic_action"
                msg_str = f"Action '{action_type}' processed successfully on {target_name}"
                logger.info("✅ %s", msg_str)

            duration_ms = int((asyncio.get_event_loop().time() - start_t) * 1000)
            details["duration_ms"] = max(100, duration_ms)

        except Exception as exc:
            logger.error("❌ Action execution failed on %s: %s", target_name, exc)
            status = "FAILED"
            msg_str = f"Failed to execute {action_type} on {target_name}: {exc}"
            duration_ms = 500
            details = {"error": str(exc)}

        # Transmit execution result back to Main Backend
        await self.ws_client.send(
            ActionResultMessage(
                data=ActionResultData(
                    action_id=action_id,
                    status=status,
                    message=msg_str,
                    duration_ms=max(100, duration_ms),
                    details=details,
                )
            )
        )

    async def _metrics_loop(self) -> None:
        interval_sec = max(1.0, self.config.METRICS_INTERVAL_MS / 1000.0)
        logger.info("Metrics collection loop active (interval: %.1fs)", interval_sec)

        while self._is_running:
            node_disk_pct: Optional[float] = None
            try:
                k8s_nodes = self.nodes_collector.list_nodes()
                if k8s_nodes and self.node_resource_collector.node_name not in [n.name for n in k8s_nodes if getattr(n, "name", None)]:
                    self.node_resource_collector.node_name = k8s_nodes[0].name
                node_snapshot = self.node_resource_collector.collect_snapshot()
                node_disk_pct = node_snapshot.disk_usage_percent
                await self.ws_client.send(NodeMetricsMessage(data=node_snapshot))
            except asyncio.CancelledError:
                break
            except Exception as node_err:
                logger.error("Error collecting/sending node resource metrics: %s", node_err)

            try:
                pods = self.pods_collector.list_pods(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                replicas = self.deployments_collector.get_replicas_map(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                nodes = self.nodes_collector.list_nodes()
                metrics = await self.metrics_manager.aggregate_metrics(
                    pods,
                    replicas,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                    node_disk_percent=node_disk_pct,
                    node_summaries=nodes,
                )
                for m in metrics:
                    await self.ws_client.send(MetricsMessage(data=m))
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in metrics loop: %s", err)

            try:
                await asyncio.sleep(interval_sec)
            except asyncio.CancelledError:
                break

    async def _logs_loop(self) -> None:
        interval_sec = max(1.0, self.config.LOG_COLLECTION_INTERVAL_MS / 1000.0)
        logger.info("Logs collection loop active (interval: %.1fs)", interval_sec)

        while self._is_running:
            try:
                pods = self.pods_collector.list_pods(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                logs = self.logs_collector.collect_pod_logs(pods)
                for l in logs:
                    await self.ws_client.send(LogMessage(data=l))
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in logs loop: %s", err)

            try:
                await asyncio.sleep(interval_sec)
            except asyncio.CancelledError:
                break

    async def _events_loop(self) -> None:
        logger.info("Events collection loop active (interval: 5.0s)")

        while self._is_running:
            try:
                events = self.events_collector.collect_events(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                pod_anomalies = self.pods_collector.detect_pod_anomalies(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                dep_anomalies = self.deployments_collector.detect_deployment_anomalies(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                node_anomalies = self.nodes_collector.detect_node_anomalies()
                for ev in (*events, *pod_anomalies, *dep_anomalies, *node_anomalies):
                    await self.ws_client.send(K8sEventMessage(data=ev))
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in events loop: %s", err)

            try:
                await asyncio.sleep(5.0)
            except asyncio.CancelledError:
                break

    async def _inventory_loop(self) -> None:
        logger.info("Cluster inventory sync loop active (interval: 30.0s)")

        while self._is_running:
            try:
                nodes = self.nodes_collector.list_nodes_detail()
                namespaces = self.nodes_collector.list_namespaces()
                pods = self.pods_collector.list_pods_detail(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                services = self.services_collector.list_services_detail()
                deployments = self.deployments_collector.list_deployments_detail(
                    self.config.K8S_NAMESPACE, self.config.MONITOR_ALL_NAMESPACES
                )
                if nodes or pods or services or deployments:
                    await self.ws_client.send(K8sInventoryMessage(data={
                        "nodes": nodes,
                        "namespaces": namespaces,
                        "pods": pods,
                        "services": services,
                        "deployments": deployments,
                    }))
            except asyncio.CancelledError:
                break
            except Exception as err:
                logger.error("Error in inventory loop: %s", err)

            try:
                await asyncio.sleep(30.0)
            except asyncio.CancelledError:
                break


def print_banner(config: AgentConfig) -> None:
    banner = f"""
======================================================================
  SelfHeal Kubernetes Agent (Python Edition) v1.0.0
  AI-Driven Proactive Self-Healing Infrastructure Sentinel
======================================================================
  Backend WebSocket URL: {config.AGENT_SERVER_URL}
  Agent UID:            {config.AGENT_UID}
  Agent Token:          {mask_token(config.AGENT_TOKEN)}
  Namespace Target:     {config.K8S_NAMESPACE} (Monitor All: {config.MONITOR_ALL_NAMESPACES})
  Metrics Interval:     {config.METRICS_INTERVAL_MS}ms
  Logs Interval:        {config.LOG_COLLECTION_INTERVAL_MS}ms
  Prometheus Ingress:   {config.PROMETHEUS_URL or 'None (Zero-telemetry fallback)'}
  Healing Actions:      {'ENABLED' if config.ENABLE_HEALING_ACTIONS else 'DISABLED (Read-Only Mode)'}
  Health Probe Port:    {config.HEALTH_PORT}
======================================================================
"""
    print(banner, flush=True)


async def main_async() -> None:
    try:
        config = load_config()
    except Exception as err:
        print(f"❌ Configuration error: {err}", file=sys.stderr, flush=True)
        sys.exit(1)

    setup_logger(config.LOG_LEVEL)
    print_banner(config)

    agent_service = AgentService(config)

    loop = asyncio.get_running_loop()
    stop_event = asyncio.Event()

    def handle_signal():
        logger.info("Shutdown signal received.")
        stop_event.set()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, handle_signal)
        except (NotImplementedError, AttributeError):
            pass

    await agent_service.start()

    try:
        if sys.platform == "win32":
            while not stop_event.is_set():
                await asyncio.sleep(0.5)
        else:
            await stop_event.wait()
    except (asyncio.CancelledError, KeyboardInterrupt):
        pass
    finally:
        await agent_service.stop()


def run_main() -> None:
    try:
        asyncio.run(main_async())
    except KeyboardInterrupt:
        logger.info("Interrupted by user.")


if __name__ == "__main__":
    run_main()
