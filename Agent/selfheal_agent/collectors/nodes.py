"""Collector for Kubernetes Node resources and cluster capacity."""

from datetime import datetime, timezone
import logging
from typing import Any, Optional
from kubernetes import client
from kubernetes.client.rest import ApiException

from selfheal_agent.telemetry.schemas import AgentK8sEventData, K8sEventDetail

logger = logging.getLogger("selfheal_agent.collectors.nodes")


def parse_k8s_cpu_millicores(cpu_str: str) -> float:
    """Parse Kubernetes CPU string (e.g. '2', '2000m', '500000n') to millicores."""
    val = str(cpu_str or "0").strip()
    try:
        if val.endswith("n"):
            return float(val[:-1]) / 1_000_000.0
        if val.endswith("u"):
            return float(val[:-1]) / 1_000.0
        if val.endswith("m"):
            return float(val[:-1])
        return float(val) * 1000.0
    except ValueError:
        return 0.0


def parse_k8s_memory_bytes(mem_str: str) -> int:
    """Parse Kubernetes memory string (e.g. '8Gi', '8192Mi', '8046580Ki') to bytes."""
    val = str(mem_str or "0").strip()
    multipliers = {
        "Ki": 1024,
        "Mi": 1024**2,
        "Gi": 1024**3,
        "Ti": 1024**4,
        "Pi": 1024**5,
        "K": 1000,
        "M": 1000**2,
        "G": 1000**3,
        "T": 1000**4,
    }
    try:
        for suffix, mult in multipliers.items():
            if val.endswith(suffix):
                return int(float(val[: -len(suffix)]) * mult)
        return int(float(val))
    except ValueError:
        return 0


def parse_k8s_int(val_str: Any, default: int = 0) -> int:
    """Safely parse integer quantity such as pod capacity."""
    if val_str is None:
        return default
    try:
        return int(str(val_str).strip())
    except (ValueError, TypeError):
        return default


def _to_iso(dt_val: Any) -> Optional[str]:
    if dt_val is None:
        return None
    if hasattr(dt_val, "isoformat"):
        return dt_val.isoformat()
    return str(dt_val)


class NodeSummary:
    """Summary of a Kubernetes Node's status, conditions, capacity, and allocatable resources."""

    def __init__(
        self,
        name: str,
        ready: bool,
        cpu_allocatable_millicores: Optional[float] = None,
        memory_allocatable_bytes: Optional[int] = None,
        *,
        status: Optional[str] = None,
        uid: Optional[str] = None,
        cpu_capacity_millicores: Optional[float] = None,
        memory_capacity_bytes: Optional[int] = None,
        disk_capacity_bytes: Optional[int] = None,
        disk_allocatable_bytes: Optional[int] = None,
        pods_capacity: Optional[int] = None,
        pods_allocatable: Optional[int] = None,
        conditions: Optional[dict[str, str]] = None,
        active_pressures: Optional[list[str]] = None,
        ready_reason: Optional[str] = None,
        ready_message: Optional[str] = None,
        kubelet_version: Optional[str] = None,
        os_image: Optional[str] = None,
        operating_system: Optional[str] = None,
        architecture: Optional[str] = None,
        container_runtime_version: Optional[str] = None,
        roles: Optional[list[str]] = None,
        labels: Optional[dict[str, str]] = None,
        taints: Optional[list[dict[str, Any]]] = None,
        unschedulable: bool = False,
        creation_timestamp: Optional[str] = None,
        observed_at: Optional[str] = None,
    ) -> None:
        self.name = name
        self.ready = ready
        self.status = status if status is not None else ("Ready" if ready else "NotReady")
        self.uid = uid or name
        self.cpu_allocatable_millicores = cpu_allocatable_millicores
        self.memory_allocatable_bytes = memory_allocatable_bytes
        self.cpu_capacity_millicores = cpu_capacity_millicores
        self.memory_capacity_bytes = memory_capacity_bytes
        self.disk_capacity_bytes = disk_capacity_bytes
        self.disk_allocatable_bytes = disk_allocatable_bytes
        self.pods_capacity = pods_capacity
        self.pods_allocatable = pods_allocatable
        self.conditions = conditions if conditions is not None else {"Ready": "True" if ready else "False"}
        self.active_pressures = active_pressures if active_pressures is not None else []
        self.ready_reason = ready_reason
        self.ready_message = ready_message
        self.kubelet_version = kubelet_version
        self.os_image = os_image
        self.operating_system = operating_system
        self.architecture = architecture
        self.container_runtime_version = container_runtime_version
        self.roles = roles if roles is not None else ["worker"]
        self.labels = labels if labels is not None else {}
        self.taints = taints if taints is not None else []
        self.unschedulable = unschedulable
        self.creation_timestamp = creation_timestamp
        self.observed_at = observed_at or datetime.now(timezone.utc).isoformat()

    def to_detail_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "kubernetes_uid": self.uid,
            "status": self.status,
            "ready": self.ready,
            "cpu_capacity_millicores": int(self.cpu_capacity_millicores or 0),
            "cpu_allocatable_millicores": int(self.cpu_allocatable_millicores or 0),
            "memory_capacity_bytes": int(self.memory_capacity_bytes or 0),
            "memory_allocatable_bytes": int(self.memory_allocatable_bytes or 0),
            "disk_capacity_bytes": int(self.disk_capacity_bytes or 0),
            "disk_allocatable_bytes": int(self.disk_allocatable_bytes or 0),
            "pods_capacity": int(self.pods_capacity or 0),
            "pods_allocatable": int(self.pods_allocatable or 0),
            "kubelet_version": self.kubelet_version or "v1.31.0",
            "os_image": self.os_image,
            "operating_system": self.operating_system,
            "architecture": self.architecture,
            "container_runtime_version": self.container_runtime_version,
            "roles": self.roles,
            "labels": self.labels,
            "taints": self.taints,
            "unschedulable": self.unschedulable,
            "conditions": self.conditions,
            "active_pressures": self.active_pressures,
            "ready_reason": self.ready_reason,
            "ready_message": self.ready_message,
            "creation_timestamp": self.creation_timestamp,
            "observed_at": self.observed_at,
        }


class NodesCollector:
    """Queries CoreV1Api for cluster nodes, conditions, capacity, and anomaly transitions."""

    PRESSURE_CONDITION_TYPES = (
        "MemoryPressure",
        "DiskPressure",
        "PIDPressure",
        "NetworkUnavailable",
    )

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1
        self.last_collection_status: str = "OK"
        self.last_error: Optional[str] = None
        self.active_anomalies: dict[str, str] = {}
        self.known_nodes: dict[str, str] = {}

    def _record_api_error(self, err: Exception, operation: str) -> None:
        if isinstance(err, ApiException):
            if err.status in (401, 403):
                self.last_collection_status = "FORBIDDEN"
            elif err.status == 404:
                self.last_collection_status = "NOT_FOUND"
            else:
                self.last_collection_status = "UNAVAILABLE"
            self.last_error = f"HTTP {err.status}: {err.reason}"
            logger.warning("K8s API error during %s (%s): %s", operation, self.last_collection_status, self.last_error)
        else:
            self.last_collection_status = "UNAVAILABLE"
            self.last_error = str(err)
            logger.debug("Failed %s: %s", operation, err)

    def _parse_node(self, node: Any, observed_at: str) -> Optional[NodeSummary]:
        if not getattr(node, "metadata", None) or not getattr(node.metadata, "name", None):
            return None

        name = str(node.metadata.name)
        uid = str(getattr(node.metadata, "uid", None) or name)
        raw_labels = getattr(node.metadata, "labels", None)
        labels = dict(raw_labels) if isinstance(raw_labels, dict) else {}
        creation_ts = _to_iso(getattr(node.metadata, "creation_timestamp", None))

        # Parse roles from standard Kubernetes node labels
        roles: list[str] = []
        for k, v in labels.items():
            if k.startswith("node-role.kubernetes.io/"):
                role = k.split("/", 1)[1].strip()
                if role and role not in roles:
                    roles.append(role)
            elif k == "kubernetes.io/role" and v and str(v) not in roles:
                roles.append(str(v))
        if not roles:
            roles.append("worker")

        # Parse spec taints & unschedulable
        unschedulable = bool(getattr(getattr(node, "spec", None), "unschedulable", False))
        taints: list[dict[str, Any]] = []
        raw_taints = getattr(getattr(node, "spec", None), "taints", None) or []
        for t in raw_taints:
            taints.append({
                "key": getattr(t, "key", ""),
                "value": getattr(t, "value", None),
                "effect": getattr(t, "effect", ""),
            })

        # Parse status conditions (Ready, MemoryPressure, DiskPressure, PIDPressure, NetworkUnavailable)
        status_obj = getattr(node, "status", None)
        raw_conditions = getattr(status_obj, "conditions", None) if status_obj else None

        conditions_map: dict[str, str] = {}
        active_pressures: list[str] = []
        ready_cond_status: Optional[str] = None
        ready_reason: Optional[str] = None
        ready_message: Optional[str] = None

        if raw_conditions:
            for cond in raw_conditions:
                c_type = getattr(cond, "type", None)
                c_status = str(getattr(cond, "status", "Unknown") or "Unknown")
                if not c_type:
                    continue
                conditions_map[c_type] = c_status
                if c_type == "Ready":
                    ready_cond_status = c_status
                    ready_reason = getattr(cond, "reason", None)
                    ready_message = getattr(cond, "message", None)
                elif c_type in self.PRESSURE_CONDITION_TYPES and c_status == "True":
                    active_pressures.append(c_type)

        if ready_cond_status == "True":
            ready = True
            node_status = "Ready"
        elif ready_cond_status == "False":
            ready = False
            node_status = "NotReady"
        else:
            # Missing Ready condition or status == "Unknown" -> Unknown (never conflate with confirmed Ready)
            ready = False
            node_status = "Unknown"
            conditions_map.setdefault("Ready", "Unknown")

        # Parse capacity & allocatable
        cap = getattr(status_obj, "capacity", None) or {}
        alloc = getattr(status_obj, "allocatable", None) or {}
        if not isinstance(cap, dict):
            cap = {}
        if not isinstance(alloc, dict):
            alloc = {}

        cpu_cap = parse_k8s_cpu_millicores(cap.get("cpu", "0"))
        cpu_alloc = parse_k8s_cpu_millicores(alloc.get("cpu", cap.get("cpu", "0")))
        mem_cap = parse_k8s_memory_bytes(cap.get("memory", "0"))
        mem_alloc = parse_k8s_memory_bytes(alloc.get("memory", cap.get("memory", "0")))
        disk_cap = parse_k8s_memory_bytes(cap.get("ephemeral-storage", "0"))
        disk_alloc = parse_k8s_memory_bytes(alloc.get("ephemeral-storage", cap.get("ephemeral-storage", "0")))
        pods_cap = parse_k8s_int(cap.get("pods"), 0)
        pods_alloc = parse_k8s_int(alloc.get("pods", cap.get("pods")), 0)

        node_info = getattr(status_obj, "node_info", None)
        kubelet_ver = getattr(node_info, "kubelet_version", None) if node_info else None
        if not isinstance(kubelet_ver, str):
            kubelet_ver = "v1.31.0"
        os_image = getattr(node_info, "os_image", None) if node_info else None
        operating_system = getattr(node_info, "operating_system", None) if node_info else None
        architecture = getattr(node_info, "architecture", None) if node_info else None
        runtime_ver = getattr(node_info, "container_runtime_version", None) if node_info else None

        return NodeSummary(
            name=name,
            ready=ready,
            cpu_allocatable_millicores=cpu_alloc,
            memory_allocatable_bytes=mem_alloc,
            status=node_status,
            uid=uid,
            cpu_capacity_millicores=cpu_cap,
            memory_capacity_bytes=mem_cap,
            disk_capacity_bytes=disk_cap,
            disk_allocatable_bytes=disk_alloc,
            pods_capacity=pods_cap,
            pods_allocatable=pods_alloc,
            conditions=conditions_map,
            active_pressures=active_pressures,
            ready_reason=ready_reason if isinstance(ready_reason, str) else None,
            ready_message=ready_message if isinstance(ready_message, str) else None,
            kubelet_version=kubelet_ver,
            os_image=os_image if isinstance(os_image, str) else None,
            operating_system=operating_system if isinstance(operating_system, str) else None,
            architecture=architecture if isinstance(architecture, str) else None,
            container_runtime_version=runtime_ver if isinstance(runtime_ver, str) else None,
            roles=roles,
            labels=labels,
            taints=taints,
            unschedulable=unschedulable,
            creation_timestamp=creation_ts,
            observed_at=observed_at,
        )

    def list_nodes(self) -> list[NodeSummary]:
        """Return list of NodeSummary objects from cluster API."""
        if not self.core_v1:
            self.last_collection_status = "OFFLINE"
            self.last_error = "Kubernetes CoreV1Api is not initialized"
            return []

        results: list[NodeSummary] = []
        observed_at = datetime.now(timezone.utc).isoformat()
        try:
            node_list = self.core_v1.list_node()
            self.last_collection_status = "OK"
            self.last_error = None
            for node in getattr(node_list, "items", None) or []:
                parsed = self._parse_node(node, observed_at)
                if parsed:
                    results.append(parsed)
        except Exception as err:
            self._record_api_error(err, "list_node")
            return []

        return results

    def list_nodes_detail(self) -> list[dict[str, Any]]:
        """Return detailed node metadata and conditions for cluster inventory sync."""
        summaries = self.list_nodes()
        return [n.to_detail_dict() for n in summaries]

    def detect_node_anomalies(self) -> list[AgentK8sEventData]:
        """Detect Node NotReady/Unknown or resource pressure transitions with stateful deduplication."""
        nodes = self.list_nodes()
        if self.last_collection_status != "OK":
            return []

        events: list[AgentK8sEventData] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        seen_uids: set[str] = set()

        for node in nodes:
            uid = node.uid or node.name
            seen_uids.add(uid)
            self.known_nodes[uid] = node.name

            anomaly_parts: list[str] = []
            if node.status in ("NotReady", "Unknown"):
                anomaly_parts.append(f"NodeStatus={node.status}")
            if node.active_pressures:
                anomaly_parts.append(f"Pressures={','.join(sorted(node.active_pressures))}")

            if anomaly_parts:
                signature = "|".join(anomaly_parts)
                if self.active_anomalies.get(uid) != signature:
                    self.active_anomalies[uid] = signature
                    reason = "NodeNotReady" if node.status in ("NotReady", "Unknown") else "NodePressure"
                    msg_details = [f"Node '{node.name}' is {node.status}"]
                    if node.ready_reason:
                        msg_details.append(f"reason={node.ready_reason}")
                    if node.ready_message:
                        msg_details.append(f"message={node.ready_message}")
                    if node.active_pressures:
                        msg_details.append(f"active_pressures={','.join(node.active_pressures)}")

                    events.append(
                        AgentK8sEventData(
                            service_id="cluster-node",
                            pod_id=uid,
                            pod_name=node.name,
                            status=node.status,
                            timestamp=now_iso,
                            event=K8sEventDetail(
                                type="Warning",
                                reason=reason,
                                message="; ".join(msg_details),
                            ),
                        )
                    )
            elif uid in self.active_anomalies:
                # Node recovered to Ready with no pressures
                del self.active_anomalies[uid]
                events.append(
                    AgentK8sEventData(
                        service_id="cluster-node",
                        pod_id=uid,
                        pod_name=node.name,
                        status="Ready",
                        timestamp=now_iso,
                        event=K8sEventDetail(
                            type="Normal",
                            reason="NodeReady",
                            message=f"Node '{node.name}' recovered to Ready state with no resource pressures.",
                        ),
                    )
                )

        # Clean up deleted nodes from cache
        for stale_uid in list(self.known_nodes.keys()):
            if stale_uid not in seen_uids:
                self.known_nodes.pop(stale_uid, None)
                self.active_anomalies.pop(stale_uid, None)

        return events

    def list_namespaces(self) -> list[dict[str, Any]]:
        """Return cluster namespaces for inventory sync."""
        if not self.core_v1:
            return []
        results: list[dict[str, Any]] = []
        try:
            ns_list = self.core_v1.list_namespace()
            for ns in getattr(ns_list, "items", None) or []:
                if not getattr(ns, "metadata", None) or not getattr(ns.metadata, "name", None):
                    continue
                phase = getattr(getattr(ns, "status", None), "phase", None) or "Active"
                raw_labels = getattr(ns.metadata, "labels", None)
                results.append({
                    "name": ns.metadata.name,
                    "kubernetes_uid": getattr(ns.metadata, "uid", None) or ns.metadata.name,
                    "status": phase,
                    "labels": dict(raw_labels) if isinstance(raw_labels, dict) else {},
                })
        except Exception as err:
            self._record_api_error(err, "list_namespace")
        return results
