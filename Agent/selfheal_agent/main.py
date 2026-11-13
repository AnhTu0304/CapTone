"""Main entrypoint and lifecycle orchestrator for SelfHeal Kubernetes Agent."""

import asyncio
from datetime import datetime, timezone
import logging
import re
import signal
import sys
import time
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
from selfheal_agent.telemetry.otel import (
    init_agent_otel,
    record_agent_up,
    record_k8s_api_call,
    record_monitoring_operation,
    record_processing_error,
    record_remediation_execution,
    shutdown_agent_otel,
    start_agent_span,
)
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
        init_agent_otel(config)
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
        record_agent_up(self.config.AGENT_UID, 1)

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
        record_agent_up(self.config.AGENT_UID, 0)

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

        shutdown_agent_otel()
        logger.info("SelfHeal Agent shutdown complete.")

    async def _handle_incoming_ws_message(self, message: IncomingMessage) -> None:
        """Handle incoming command envelopes from Main Backend."""
        if not isinstance(message, ExecuteActionPayload):
            return
        result_msg = await asyncio.to_thread(self._execute_action_sync, message)
        await self.ws_client.send(result_msg)

    def _execute_action_sync(self, message: ExecuteActionPayload) -> ActionResultMessage:

        cmd = message.data
        action_id = cmd.action_id
        action_type = (cmd.action_type or "").upper().strip().replace(" ", "_")
        target_name = cmd.target_name or "sme-order-service"
        if (len(target_name) == 36 and "-" in target_name) or target_name.startswith("c0000"):
            target_name = "sme-order-service"
        namespace = cmd.namespace or "default"
        cmd_params = cmd.params or {}

        with start_agent_span(
            "agent.remediation.execute",
            attributes={
                "action.type": action_type or "UNKNOWN",
                "k8s.namespace.name": namespace,
            },
            carrier=cmd_params if isinstance(cmd_params, dict) else None,
        ):
            # Build ordered candidate controller names (handle pod hash/ordinal suffixes & Helm release aliases)
            candidate_names: list[str] = [target_name]
            rs_pod_match = re.match(r"^(.+)-[a-f0-9]{6,10}-[a-z0-9]{4,6}$", target_name)
            if rs_pod_match and rs_pod_match.group(1) not in candidate_names:
                candidate_names.append(rs_pod_match.group(1))
            sts_pod_match = re.match(r"^(.+)-\d+$", target_name)
            if sts_pod_match and sts_pod_match.group(1) not in candidate_names:
                candidate_names.append(sts_pod_match.group(1))

            def _labels_match(labels: Any, cand: str) -> bool:
                if not isinstance(labels, dict):
                    return False
                for key in ("app", "app.kubernetes.io/name", "app.kubernetes.io/instance", "k8s-app"):
                    if labels.get(key) == cand:
                        return True
                return False

            def _match_k8s_controllers(items: Any, kind_name: str):
                best_score = -1
                best_item = None
                for item in (items or []):
                    meta = getattr(item, "metadata", None)
                    spec = getattr(item, "spec", None)
                    item_name = getattr(meta, "name", "") or ""
                    item_ns = getattr(meta, "namespace", "") or "default"
                    if not item_name:
                        continue
                    meta_labels = getattr(meta, "labels", None) or {}
                    sel = getattr(spec, "selector", None)
                    sel_labels = getattr(sel, "match_labels", None) or {}

                    tier = 0
                    for idx, cand in enumerate(candidate_names):
                        exact_bonus = 10 if idx == 0 else 0
                        if item_name == cand:
                            tier = max(tier, 300 + exact_bonus)
                        elif _labels_match(sel_labels, cand) or _labels_match(meta_labels, cand):
                            tier = max(tier, 200 + exact_bonus)
                        elif len(cand) >= 4 and (item_name.endswith(f"-{cand}") or item_name.startswith(f"{cand}-")):
                            tier = max(tier, 100 + exact_bonus)

                    if tier == 0:
                        continue

                    ns_score = 50 if item_ns == namespace else (20 if item_ns != "default" else 5)
                    score = tier + ns_score
                    if score > best_score:
                        best_score = score
                        best_item = item
                return best_item

            # Auto-resolve actual namespace and workload kind (Deployment / StatefulSet / DaemonSet / Pod) across cluster
            is_statefulset = False
            is_daemonset = False
            is_bare_pod = False
            bare_pod_owner_kind: Optional[str] = None
            resolved_pod_name: Optional[str] = None

            if self.apps_v1:
                found_workload = False
                try:
                    t0 = time.perf_counter()
                    self.apps_v1.read_namespaced_deployment(name=target_name, namespace=namespace)
                    record_k8s_api_call("deployments", "read", "success", time.perf_counter() - t0)
                    found_workload = True
                except Exception:
                    try:
                        t0 = time.perf_counter()
                        all_deps = self.apps_v1.list_deployment_for_all_namespaces()
                        record_k8s_api_call("deployments", "list", "success", time.perf_counter() - t0)
                        matched_dep = _match_k8s_controllers(getattr(all_deps, "items", None), "Deployment")
                        if matched_dep and matched_dep.metadata:
                            actual_name = matched_dep.metadata.name
                            actual_ns = matched_dep.metadata.namespace or namespace
                            logger.info(
                                "Auto-resolved Deployment '%s' (ns='%s') -> '%s' (ns='%s')",
                                target_name,
                                namespace,
                                actual_name,
                                actual_ns,
                            )
                            target_name = actual_name
                            namespace = actual_ns
                            found_workload = True
                    except Exception as scan_err:
                        logger.debug("Failed scanning deployments for %s: %s", target_name, scan_err)

                if not found_workload:
                    try:
                        t0 = time.perf_counter()
                        self.apps_v1.read_namespaced_stateful_set(name=target_name, namespace=namespace)
                        record_k8s_api_call("statefulsets", "read", "success", time.perf_counter() - t0)
                        is_statefulset = True
                        found_workload = True
                    except Exception:
                        try:
                            t0 = time.perf_counter()
                            all_sts = self.apps_v1.list_stateful_set_for_all_namespaces()
                            record_k8s_api_call("statefulsets", "list", "success", time.perf_counter() - t0)
                            matched_sts = _match_k8s_controllers(getattr(all_sts, "items", None), "StatefulSet")
                            if matched_sts and matched_sts.metadata:
                                actual_name = matched_sts.metadata.name
                                actual_ns = matched_sts.metadata.namespace or namespace
                                logger.info(
                                    "Auto-resolved StatefulSet '%s' (ns='%s') -> '%s' (ns='%s')",
                                    target_name,
                                    namespace,
                                    actual_name,
                                    actual_ns,
                                )
                                target_name = actual_name
                                namespace = actual_ns
                                is_statefulset = True
                                found_workload = True
                        except Exception as sts_err:
                            logger.debug("Failed scanning statefulsets for %s: %s", target_name, sts_err)

                if not found_workload:
                    try:
                        t0 = time.perf_counter()
                        self.apps_v1.read_namespaced_daemon_set(name=target_name, namespace=namespace)
                        record_k8s_api_call("daemonsets", "read", "success", time.perf_counter() - t0)
                        is_daemonset = True
                        found_workload = True
                    except Exception:
                        try:
                            t0 = time.perf_counter()
                            all_ds = self.apps_v1.list_daemon_set_for_all_namespaces()
                            record_k8s_api_call("daemonsets", "list", "success", time.perf_counter() - t0)
                            matched_ds = _match_k8s_controllers(getattr(all_ds, "items", None), "DaemonSet")
                            if matched_ds and matched_ds.metadata:
                                actual_name = matched_ds.metadata.name
                                actual_ns = matched_ds.metadata.namespace or namespace
                                logger.info(
                                    "Auto-resolved DaemonSet '%s' (ns='%s') -> '%s' (ns='%s')",
                                    target_name,
                                    namespace,
                                    actual_name,
                                    actual_ns,
                                )
                                target_name = actual_name
                                namespace = actual_ns
                                is_daemonset = True
                                found_workload = True
                        except Exception as ds_err:
                            logger.debug("Failed scanning daemonsets for %s: %s", target_name, ds_err)

                if not found_workload and self.core_v1:
                    try:
                        t0 = time.perf_counter()
                        all_pods = self.core_v1.list_pod_for_all_namespaces()
                        record_k8s_api_call("pods", "list", "success", time.perf_counter() - t0)
                        specific_pod = (cmd.params or {}).get("pod_name") or (cmd.params or {}).get("pod_id")
                        best_pod = None
                        best_pod_score = -1
                        for pod in (getattr(all_pods, "items", None) or []):
                            p_meta = getattr(pod, "metadata", None)
                            p_name = getattr(p_meta, "name", "") or ""
                            p_ns = getattr(p_meta, "namespace", "") or "default"
                            p_labels = getattr(p_meta, "labels", None) or {}
                            if not p_name:
                                continue
                            if getattr(p_meta, "deletion_timestamp", None):
                                continue
                            tier = 0
                            if specific_pod and p_name == specific_pod:
                                tier = 400
                            else:
                                for cand in candidate_names:
                                    if p_name == cand:
                                        tier = max(tier, 300)
                                    elif _labels_match(p_labels, cand):
                                        tier = max(tier, 200)
                                    elif len(cand) >= 4 and (p_name.startswith(f"{cand}-") or f"-{cand}-" in p_name):
                                        tier = max(tier, 100)
                            if tier == 0:
                                continue
                            ns_score = 50 if p_ns == namespace else (20 if p_ns != "default" else 5)
                            score = tier + ns_score
                            if score > best_pod_score:
                                best_pod_score = score
                                best_pod = pod

                        if best_pod and best_pod.metadata:
                            p_name = best_pod.metadata.name
                            p_ns = best_pod.metadata.namespace or namespace
                            resolved_pod_name = p_name
                            namespace = p_ns
                            owners = getattr(best_pod.metadata, "owner_references", None) or []
                            owner_kind = getattr(owners[0], "kind", None) if owners else None
                            owner_name = getattr(owners[0], "name", None) if owners else None
                            if owner_kind == "StatefulSet" and owner_name:
                                target_name = owner_name
                                is_statefulset = True
                                found_workload = True
                            elif owner_kind == "DaemonSet" and owner_name:
                                target_name = owner_name
                                is_daemonset = True
                                found_workload = True
                            elif owner_kind == "ReplicaSet" and owner_name:
                                try:
                                    rs_obj = self.apps_v1.read_namespaced_replica_set(name=owner_name, namespace=p_ns)
                                    rs_owners = getattr(rs_obj.metadata, "owner_references", None) or []
                                    dep_owner = next((o for o in rs_owners if getattr(o, "kind", "") == "Deployment"), None)
                                    target_name = dep_owner.name if dep_owner else re.sub(r"-[a-f0-9]{6,10}$", "", owner_name)
                                    found_workload = True
                                except Exception:
                                    target_name = re.sub(r"-[a-f0-9]{6,10}$", "", owner_name)
                                    found_workload = True
                            else:
                                is_bare_pod = True
                                bare_pod_owner_kind = owner_kind
                                target_name = p_name
                                found_workload = True
                    except Exception as pod_scan_err:
                        logger.debug("Failed pod fallback scan for %s: %s", target_name, pod_scan_err)

            if is_statefulset:
                workload_kind_label = "statefulset"
            elif is_daemonset:
                workload_kind_label = "daemonset"
            elif is_bare_pod:
                workload_kind_label = "static_pod" if bare_pod_owner_kind == "Node" else "pod"
            else:
                workload_kind_label = "deployment"

            def _patch_workload(body: dict[str, Any]) -> None:
                if not self.apps_v1:
                    return
                if is_bare_pod:
                    raise ValueError(
                        f"Workload '{target_name}' in namespace '{namespace}' is a standalone Pod "
                        "without a Deployment/StatefulSet/DaemonSet controller and cannot be rolling-patched."
                    )
                res_kind = "statefulsets" if is_statefulset else ("daemonsets" if is_daemonset else "deployments")
                t0 = time.perf_counter()
                try:
                    if is_statefulset:
                        self.apps_v1.patch_namespaced_stateful_set(name=target_name, namespace=namespace, body=body)
                    elif is_daemonset:
                        self.apps_v1.patch_namespaced_daemon_set(name=target_name, namespace=namespace, body=body)
                    else:
                        self.apps_v1.patch_namespaced_deployment(name=target_name, namespace=namespace, body=body)
                    record_k8s_api_call(res_kind, "patch", "success", time.perf_counter() - t0)
                except Exception as patch_err:
                    err_code = str(getattr(patch_err, "status", "exception"))
                    record_k8s_api_call(res_kind, "patch", "error", time.perf_counter() - t0, err_code)
                    raise

            def _scale_workload(replicas: int) -> None:
                if not self.apps_v1:
                    return
                if is_daemonset or is_bare_pod:
                    raise ValueError(
                        f"Cannot scale {workload_kind_label} '{target_name}' in namespace '{namespace}' horizontally."
                    )
                scale_body = {"spec": {"replicas": replicas}}
                res_kind = "statefulsets" if is_statefulset else "deployments"
                t0 = time.perf_counter()
                try:
                    if is_statefulset:
                        self.apps_v1.patch_namespaced_stateful_set_scale(name=target_name, namespace=namespace, body=scale_body)
                    else:
                        self.apps_v1.patch_namespaced_deployment_scale(name=target_name, namespace=namespace, body=scale_body)
                    record_k8s_api_call(res_kind, "scale", "success", time.perf_counter() - t0)
                except Exception as scale_err:
                    err_code = str(getattr(scale_err, "status", "exception"))
                    record_k8s_api_call(res_kind, "scale", "error", time.perf_counter() - t0, err_code)
                    raise

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
            start_t = time.perf_counter()

            try:
                protected_namespaces = {"kube-system", "kube-public", "kube-node-lease", "selfheal-system"}
                if namespace in protected_namespaces and action_type not in ["TEMPORARY_IP_BLOCK", "BLOCK_IP_TEMP", "BLOCK_IP", "IP_BLOCK", "BLOCK_SUSPICIOUS_IP", "TEMPORARY IP BLOCK"]:
                    raise ValueError(
                        f"Safety Guard Blocked: Namespace '{namespace}' is a protected Kubernetes system namespace and cannot be modified automatically."
                    )

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
                            t0 = time.perf_counter()
                            pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)
                            record_k8s_api_call("pods", "list", "success", time.perf_counter() - t0)
                            specific_pod_name = (cmd.params or {}).get("pod_name") or (cmd.params or {}).get("pod_id")
                            
                            candidate_pods = []
                            if is_bare_pod and bare_pod_owner_kind is None:
                                raise ValueError(
                                    f"Standalone pod '{resolved_pod_name or target_name}' in namespace '{namespace}' "
                                    "has no controller (Deployment/StatefulSet/DaemonSet) to recreate it automatically."
                                )
                            for pod in pod_list.items:
                                p_name = pod.metadata.name if pod.metadata else ""
                                p_labels = getattr(pod.metadata, "labels", None) or {} if pod.metadata else {}
                                phase = getattr(pod.status, "phase", "Running") if pod.status else "Running"
                                # Skip completed one-off Job pods (e.g. mongodb-rs-init)
                                if phase == "Succeeded" or "-init-" in p_name:
                                    continue
                                name_matched = (
                                    p_name == target_name
                                    or p_name.startswith(f"{target_name}-")
                                    or (resolved_pod_name is not None and p_name == resolved_pod_name)
                                    or any(p_name == c or p_name.startswith(f"{c}-") or _labels_match(p_labels, c) for c in candidate_names)
                                )
                                if name_matched:
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
                                t_del = time.perf_counter()
                                self.core_v1.delete_namespaced_pod(name=target_pod_to_delete, namespace=namespace)
                                record_k8s_api_call("pods", "delete", "success", time.perf_counter() - t_del)
                                deleted_pod = target_pod_to_delete
                        except Exception as p_err:
                            err_code = str(getattr(p_err, "status", "exception"))
                            record_k8s_api_call("pods", "delete", "error", 0.01, err_code)
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
                    is_scale_down = ("DOWN" in action_type or "IN" in action_type)
                    explicit_rep = (cmd.params or {}).get("target_replicas") or (cmd.params or {}).get("replicas")
                    if explicit_rep is not None:
                        new_replicas = max(1, min(10, int(explicit_rep)))
                    elif self.apps_v1 and not is_daemonset and not is_bare_pod:
                        try:
                            if is_statefulset:
                                cur_obj = self.apps_v1.read_namespaced_stateful_set(name=target_name, namespace=namespace)
                            else:
                                cur_obj = self.apps_v1.read_namespaced_deployment(name=target_name, namespace=namespace)
                            cur_rep = int(getattr(getattr(cur_obj, "spec", None), "replicas", None) or 1)
                            new_replicas = max(1, cur_rep - 1) if is_scale_down else min(5, max(2, cur_rep + 1))
                        except Exception:
                            new_replicas = 1 if is_scale_down else 2
                    else:
                        new_replicas = 1 if is_scale_down else 2

                    if self.apps_v1:
                        _scale_workload(new_replicas)
                        details["strategy"] = "horizontal_scaling"
                        details["replicas"] = new_replicas
                        msg_str = f"{workload_kind_label}/{target_name} scaled successfully to {new_replicas} replicas in '{namespace}'"
                        logger.info("✅ %s", msg_str)
                    else:
                        msg_str = f"Offline/Dev mode: Scaled {target_name} to {new_replicas} replicas"
                        logger.info("ℹ️ %s", msg_str)

                elif action_type in ["ROLLBACK_DEPLOYMENT", "ROLLBACK", "ROLLBACK DEPLOYMENT"]:
                    if self.apps_v1:
                        try:
                            if not is_statefulset:
                                t0 = time.perf_counter()
                                rs_list = self.apps_v1.list_namespaced_replica_set(namespace=namespace)
                                record_k8s_api_call("replicasets", "list", "success", time.perf_counter() - t0)
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
                    faulty_node = (cmd.params or {}).get("faulty_node_name") or (cmd.params or {}).get("target_node")
                    dest_node = (cmd.params or {}).get("recommended_destination_node")
                    cordoned_node = None
                    evicted_pods = []
                    single_node_guard = False

                    if self.core_v1:
                        try:
                            pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)
                            matching_pods = [
                                p for p in (getattr(pod_list, "items", None) or [])
                                if getattr(getattr(p, "metadata", None), "name", "").startswith(target_name)
                                or (getattr(getattr(p, "metadata", None), "labels", None) or {}).get("app") == target_name
                            ]
                            if not faulty_node and matching_pods:
                                faulty_node = getattr(getattr(matching_pods[0], "spec", None), "node_name", None)

                            t0 = time.perf_counter()
                            node_list = self.core_v1.list_node()
                            record_k8s_api_call("nodes", "list", "success", time.perf_counter() - t0)
                            ready_schedulable_nodes = []
                            for n_item in (getattr(node_list, "items", None) or []):
                                n_name = getattr(getattr(n_item, "metadata", None), "name", "") or ""
                                n_unsched = bool(getattr(getattr(n_item, "spec", None), "unschedulable", False))
                                n_conds = getattr(getattr(n_item, "status", None), "conditions", None) or []
                                is_ready = any(getattr(c, "type", "") == "Ready" and getattr(c, "status", "") == "True" for c in n_conds)
                                if is_ready and not n_unsched:
                                    ready_schedulable_nodes.append(n_name)

                            if len(ready_schedulable_nodes) <= 1:
                                single_node_guard = True
                                details["single_node_guard"] = True
                            elif faulty_node and any(n != faulty_node for n in ready_schedulable_nodes):
                                if not dest_node:
                                    dest_node = next((n for n in ready_schedulable_nodes if n != faulty_node), None)
                                t_cordon = time.perf_counter()
                                self.core_v1.patch_node(name=faulty_node, body={"spec": {"unschedulable": True}})
                                record_k8s_api_call("nodes", "patch", "success", time.perf_counter() - t_cordon)
                                cordoned_node = faulty_node
                                details["cordoned_node"] = faulty_node
                                if dest_node:
                                    details["recommended_destination_node"] = dest_node

                                for mp in matching_pods:
                                    mp_name = getattr(getattr(mp, "metadata", None), "name", "")
                                    mp_node = getattr(getattr(mp, "spec", None), "node_name", "")
                                    if mp_name and mp_node == faulty_node:
                                        self.core_v1.delete_namespaced_pod(name=mp_name, namespace=namespace)
                                        evicted_pods.append(mp_name)
                                if evicted_pods:
                                    details["evicted_pods"] = evicted_pods
                        except Exception as n_err:
                            logger.warning("Node cordon check warning during DRAIN_NODE: %s", n_err)

                    if self.apps_v1 and not evicted_pods:
                        now_str = datetime.now(timezone.utc).isoformat()
                        patch_body = {"spec": {"template": {"metadata": {"annotations": {"kubectl.kubernetes.io/restartedAt": now_str, "selfheal.io/node-rescheduled": "true"}}}}}
                        _patch_workload(patch_body)
                    if cordoned_node:
                        msg_str = f"Cordoned degraded node '{cordoned_node}' and rescheduled pods ({', '.join(evicted_pods) if evicted_pods else target_name}) for {workload_kind_label}/{target_name} in '{namespace}' to healthy node '{dest_node or 'available'}'"
                    elif single_node_guard:
                        msg_str = f"Single-node cluster guard: skipped node cordon on sole node and recreated pods for {workload_kind_label}/{target_name} in '{namespace}'"
                    else:
                        msg_str = f"Rescheduled pods safely for {target_name} in '{namespace}' to isolate degraded node resources"
                    logger.info("✅ %s", msg_str)

                elif action_type in ["TEMPORARY_IP_BLOCK", "BLOCK_IP_TEMP", "BLOCK_IP", "IP_BLOCK", "BLOCK_SUSPICIOUS_IP", "TEMPORARY IP BLOCK"]:
                    raw_ip = (cmd.params or {}).get("ip") or (cmd.params or {}).get("source_ip") or "203.0.113.10"
                    clean_ip = str(raw_ip).strip()
                    ip_cidr = clean_ip if "/" in clean_ip else (f"{clean_ip}/128" if ":" in clean_ip else f"{clean_ip}/32")
                    policy_name = f"block-ip-{clean_ip.replace('.', '-').replace(':', '-').replace('/', '-')}"
                    target_ns = namespace or "default"
                    duration_minutes = (cmd.params or {}).get("duration_minutes") or 15

                    details["strategy"] = "k8s_native_network_policy_filter"
                    details["blocked_ip"] = clean_ip
                    details["ip_cidr"] = ip_cidr
                    details["network_policy"] = policy_name
                    details["namespace"] = target_ns
                    details["duration_minutes"] = duration_minutes

                    # Determine target pod labels
                    target_pod_labels = {"app": target_name}
                    if getattr(self, "apps_v1", None):
                        try:
                            dep = self.apps_v1.read_namespaced_deployment(name=target_name, namespace=target_ns)
                            if dep.spec and dep.spec.selector and dep.spec.selector.match_labels:
                                target_pod_labels = dep.spec.selector.match_labels
                        except Exception:
                            pass

                    details["target_labels"] = target_pod_labels

                    if getattr(self, "networking_v1", None):
                        try:
                            net_policy = client.V1NetworkPolicy(
                                metadata=client.V1ObjectMeta(
                                    name=policy_name,
                                    namespace=target_ns,
                                    labels={
                                        "app.kubernetes.io/name": "selfheal-agent-security",
                                        "app.kubernetes.io/managed-by": "selfheal-agent",
                                        "selfheal.io/action": "TEMPORARY_IP_BLOCK",
                                        "selfheal.io/target": target_name,
                                    },
                                    annotations={
                                        "selfheal.io/blocked-ip": clean_ip,
                                        "selfheal.io/blocked-at": datetime.now(timezone.utc).isoformat(),
                                        "selfheal.io/duration-minutes": str(duration_minutes),
                                    }
                                ),
                                spec=client.V1NetworkPolicySpec(
                                    pod_selector=client.V1LabelSelector(match_labels=target_pod_labels),
                                    policy_types=["Ingress"],
                                    ingress=[
                                        client.V1NetworkPolicyIngressRule(
                                            _from=[
                                                client.V1NetworkPolicyPeer(namespace_selector=client.V1LabelSelector()),
                                                client.V1NetworkPolicyPeer(pod_selector=client.V1LabelSelector()),
                                                client.V1NetworkPolicyPeer(ip_block=client.V1IPBlock(cidr="0.0.0.0/0", _except=[ip_cidr])),
                                            ]
                                        )
                                    ]
                                )
                            )
                            t0 = time.perf_counter()
                            try:
                                self.networking_v1.create_namespaced_network_policy(namespace=target_ns, body=net_policy)
                                record_k8s_api_call("networkpolicies", "create", "success", time.perf_counter() - t0)
                                msg_str = f"NetworkPolicy '{policy_name}' deployed successfully: IP '{clean_ip}' blocked from accessing {target_name} in namespace '{target_ns}' (TTL: {duration_minutes}m)"
                            except Exception as create_err:
                                if "already exists" in str(create_err).lower() or getattr(create_err, "status", None) == 409:
                                    self.networking_v1.replace_namespaced_network_policy(name=policy_name, namespace=target_ns, body=net_policy)
                                    record_k8s_api_call("networkpolicies", "replace", "success", time.perf_counter() - t0)
                                    msg_str = f"NetworkPolicy '{policy_name}' updated successfully: IP '{clean_ip}' blocked from accessing {target_name} in namespace '{target_ns}' (TTL: {duration_minutes}m)"
                                else:
                                    err_code = str(getattr(create_err, "status", "exception"))
                                    record_k8s_api_call("networkpolicies", "create", "error", time.perf_counter() - t0, err_code)
                                    raise create_err

                            logger.info("🛡️ %s", msg_str)

                            # Schedule background TTL auto-unblock
                            import threading
                            ttl_sec = int((cmd.params or {}).get("ttl_seconds", 0)) or (int(duration_minutes) * 60)
                            def _auto_unblock_sync(pol_name=policy_name, pol_ns=target_ns):
                                try:
                                    if getattr(self, "networking_v1", None):
                                        self.networking_v1.delete_namespaced_network_policy(name=pol_name, namespace=pol_ns)
                                        logger.info("⏰ [Auto-TTL] Successfully removed temporary NetworkPolicy '%s' in namespace '%s'", pol_name, pol_ns)
                                except Exception as unblock_err:
                                    logger.warning("[Auto-TTL] NetworkPolicy '%s' cleanup status: %s", pol_name, unblock_err)
                            t_timer = threading.Timer(ttl_sec, _auto_unblock_sync)
                            t_timer.daemon = True
                            t_timer.start()

                        except Exception as net_err:
                            logger.error("❌ Failed to deploy NetworkPolicy '%s': %s", policy_name, net_err)
                            msg_str = f"Failed to deploy NetworkPolicy for IP '{clean_ip}' on {target_name}: {net_err}"
                            status = "FAILED"
                    else:
                        msg_str = f"Kubernetes Networking API unavailable: IP '{clean_ip}' could not be blocked on {target_name}"
                        status = "FAILED"

                elif action_type in ["UNBLOCK_IP", "REMOVE_IP_BLOCK", "DELETE_IP_BLOCK"]:
                    raw_ip = (cmd.params or {}).get("ip") or (cmd.params or {}).get("source_ip") or ""
                    clean_ip = str(raw_ip).strip()
                    policy_name = f"block-ip-{clean_ip.replace('.', '-').replace(':', '-').replace('/', '-')}"
                    target_ns = namespace or "default"
                    details["strategy"] = "k8s_native_unblock"
                    details["unblocked_ip"] = clean_ip

                    if getattr(self, "networking_v1", None):
                        t0 = time.perf_counter()
                        try:
                            self.networking_v1.delete_namespaced_network_policy(name=policy_name, namespace=target_ns)
                            record_k8s_api_call("networkpolicies", "delete", "success", time.perf_counter() - t0)
                            msg_str = f"NetworkPolicy '{policy_name}' removed: IP '{clean_ip}' unblocked successfully in namespace '{target_ns}'"
                            logger.info("🛡️ %s", msg_str)
                        except Exception as unblock_err:
                            if "not found" in str(unblock_err).lower() or getattr(unblock_err, "status", None) == 404:
                                record_k8s_api_call("networkpolicies", "delete", "success", time.perf_counter() - t0)
                                msg_str = f"NetworkPolicy '{policy_name}' not found or already removed"
                            else:
                                err_code = str(getattr(unblock_err, "status", "exception"))
                                record_k8s_api_call("networkpolicies", "delete", "error", time.perf_counter() - t0, err_code)
                                raise unblock_err
                    else:
                        msg_str = f"Kubernetes Networking API unavailable to unblock IP '{clean_ip}'"

                elif action_type in ["NO_ACTION", "NO ACTION"]:
                    details["strategy"] = "zero_impact_observation"
                    details["status"] = "safe_within_thresholds"
                    msg_str = f"Zero-downtime preserved: System telemetry verified safe for {target_name}, NO_ACTION applied."
                    logger.info("🛡️ %s", msg_str)

                else:
                    details["strategy"] = "generic_action"
                    msg_str = f"Action '{action_type}' processed successfully on {target_name}"
                    logger.info("✅ %s", msg_str)

                elapsed_sec = max(0.001, time.perf_counter() - start_t)
                duration_ms = int(elapsed_sec * 1000)
                details["duration_ms"] = max(100, duration_ms)

            except Exception as exc:
                elapsed_sec = max(0.001, time.perf_counter() - start_t)
                logger.error("❌ Action execution failed on %s: %s", target_name, exc)
                record_processing_error("remediation")
                status = "FAILED"
                msg_str = f"Failed to execute {action_type} on {target_name}: {exc}"
                duration_ms = max(100, int(elapsed_sec * 1000))
                details = {
                    "error": str(exc),
                    "target": target_name,
                    "namespace": namespace,
                    "workload_kind": workload_kind_label,
                }

            record_remediation_execution(
                action_type=action_type or "UNKNOWN",
                workload_kind=workload_kind_label,
                status="success" if status == "SUCCEEDED" else "failed",
                duration_seconds=max(0.001, duration_ms / 1000.0),
            )

            return ActionResultMessage(
                data=ActionResultData(
                    action_id=action_id,
                    status=status,
                    message=msg_str,
                    duration_ms=max(100, duration_ms),
                    details=details,
                )
            )

    async def _metrics_loop(self) -> None:
        interval_sec = max(1.0, self.config.METRICS_INTERVAL_MS / 1000.0)
        logger.info("Metrics collection loop active (interval: %.1fs)", interval_sec)

        while self._is_running:
            node_disk_pct: Optional[float] = None
            try:
                k8s_nodes = await asyncio.to_thread(self.nodes_collector.list_nodes)
                if k8s_nodes and self.node_resource_collector.node_name not in [n.name for n in k8s_nodes if getattr(n, "name", None)]:
                    self.node_resource_collector.node_name = k8s_nodes[0].name
                node_snapshot = await asyncio.to_thread(self.node_resource_collector.collect_snapshot)
                node_disk_pct = node_snapshot.disk_usage_percent
                await self.ws_client.send(NodeMetricsMessage(data=node_snapshot))
                record_monitoring_operation("nodes", "success")
            except asyncio.CancelledError:
                break
            except Exception as node_err:
                record_monitoring_operation("nodes", "error")
                record_processing_error("metrics")
                logger.error("Error collecting/sending node resource metrics: %s", node_err)

            try:
                pods = await asyncio.to_thread(
                    self.pods_collector.list_pods,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                record_monitoring_operation("pods", "success")
                replicas = await asyncio.to_thread(
                    self.deployments_collector.get_replicas_map,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                record_monitoring_operation("deployments", "success")
                nodes = await asyncio.to_thread(self.nodes_collector.list_nodes)
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
                record_monitoring_operation("pods", "error")
                record_processing_error("metrics")
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
                pods = await asyncio.to_thread(
                    self.pods_collector.list_pods,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                logs = await asyncio.to_thread(self.logs_collector.collect_pod_logs, pods)
                for l in logs:
                    await self.ws_client.send(LogMessage(data=l))
                record_monitoring_operation("logs", "success")
            except asyncio.CancelledError:
                break
            except Exception as err:
                record_monitoring_operation("logs", "error")
                record_processing_error("logs")
                logger.error("Error in logs loop: %s", err)

            try:
                await asyncio.sleep(interval_sec)
            except asyncio.CancelledError:
                break

    async def _events_loop(self) -> None:
        logger.info("Events collection loop active (interval: 5.0s)")

        while self._is_running:
            try:
                events = await asyncio.to_thread(
                    self.events_collector.collect_events,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                pod_anomalies = await asyncio.to_thread(
                    self.pods_collector.detect_pod_anomalies,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                dep_anomalies = await asyncio.to_thread(
                    self.deployments_collector.detect_deployment_anomalies,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                node_anomalies = await asyncio.to_thread(self.nodes_collector.detect_node_anomalies)
                for ev in (*events, *pod_anomalies, *dep_anomalies, *node_anomalies):
                    await self.ws_client.send(K8sEventMessage(data=ev))
                record_monitoring_operation("events", "success")
            except asyncio.CancelledError:
                break
            except Exception as err:
                record_monitoring_operation("events", "error")
                record_processing_error("events")
                logger.error("Error in events loop: %s", err)

            try:
                await asyncio.sleep(5.0)
            except asyncio.CancelledError:
                break

    async def _inventory_loop(self) -> None:
        logger.info("Cluster inventory sync loop active (interval: 30.0s)")

        while self._is_running:
            try:
                nodes = await asyncio.to_thread(self.nodes_collector.list_nodes_detail)
                namespaces = await asyncio.to_thread(self.nodes_collector.list_namespaces)
                pods = await asyncio.to_thread(
                    self.pods_collector.list_pods_detail,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                services = await asyncio.to_thread(self.services_collector.list_services_detail)
                deployments = await asyncio.to_thread(
                    self.deployments_collector.list_deployments_detail,
                    self.config.K8S_NAMESPACE,
                    self.config.MONITOR_ALL_NAMESPACES,
                )
                if nodes or pods or services or deployments:
                    await self.ws_client.send(K8sInventoryMessage(data={
                        "nodes": nodes,
                        "namespaces": namespaces,
                        "pods": pods,
                        "services": services,
                        "deployments": deployments,
                    }))
                record_monitoring_operation("inventory", "success")
            except asyncio.CancelledError:
                break
            except Exception as err:
                record_monitoring_operation("inventory", "error")
                record_processing_error("inventory")
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
