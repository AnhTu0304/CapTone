"""Collector for Kubernetes Pod resources, container statuses, and CrashLoopBackOff detection."""

from datetime import datetime, timezone
import logging
from typing import Any, Optional
from kubernetes import client
from kubernetes.client.rest import ApiException

from selfheal_agent.telemetry.schemas import AgentK8sEventData, K8sEventDetail

logger = logging.getLogger("selfheal_agent.collectors.pods")

EXCLUDED_NAMESPACES = {"kube-system", "kube-public", "kube-node-lease", "selfheal-system"}


def _opt_str(val: Any) -> Optional[str]:
    return val if isinstance(val, str) and val != "" else None


def _opt_int(val: Any) -> Optional[int]:
    if isinstance(val, int) and not isinstance(val, bool):
        return val
    return None


def _opt_bool(val: Any, default: bool = False) -> bool:
    if isinstance(val, bool):
        return val
    return default


def _to_iso(dt_val: Any) -> Optional[str]:
    if dt_val is None:
        return None
    if hasattr(dt_val, "isoformat"):
        iso = dt_val.isoformat()
        return iso if isinstance(iso, str) else None
    if isinstance(dt_val, str):
        return dt_val
    return None


def parse_cpu_to_millicores(cpu_str: Optional[str]) -> float:
    """Parse k8s CPU quantity string into millicores."""
    if not cpu_str or not isinstance(cpu_str, (str, int, float)):
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
    if not mem_str or not isinstance(mem_str, (str, int, float)):
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
    if isinstance(labels, dict):
        for key in ("app", "app.kubernetes.io/name", "app.kubernetes.io/instance", "k8s-app"):
            val = labels.get(key)
            if isinstance(val, str) and val:
                return val

    parts = pod_name.split("-")
    if len(parts) >= 3 and len(parts[-1]) == 5 and len(parts[-2]) >= 5:
        return "-".join(parts[:-2])
    if len(parts) >= 2 and (parts[-1].isdigit() or len(parts[-1]) <= 5):
        return "-".join(parts[:-1])
    return pod_name


class ContainerStatusInfo:
    """Detailed status of a single container or init container inside a Pod."""

    def __init__(
        self,
        name: str,
        ready: bool = False,
        started: Optional[bool] = None,
        restart_count: int = 0,
        state: str = "unknown",
        image: Optional[str] = None,
        is_init: bool = False,
        waiting_reason: Optional[str] = None,
        waiting_message: Optional[str] = None,
        terminated_reason: Optional[str] = None,
        exit_code: Optional[int] = None,
        finished_at: Optional[str] = None,
        last_terminated_reason: Optional[str] = None,
        last_exit_code: Optional[int] = None,
        last_finished_at: Optional[str] = None,
    ) -> None:
        self.name = name
        self.ready = ready
        self.started = started
        self.restart_count = restart_count
        self.state = state
        self.image = image
        self.is_init = is_init
        self.waiting_reason = waiting_reason
        self.waiting_message = waiting_message
        self.terminated_reason = terminated_reason
        self.exit_code = exit_code
        self.finished_at = finished_at
        self.last_terminated_reason = last_terminated_reason
        self.last_exit_code = last_exit_code
        self.last_finished_at = last_finished_at

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "image": self.image,
            "is_init": self.is_init,
            "ready": self.ready,
            "started": self.started,
            "restart_count": self.restart_count,
            "state": self.state,
            "waiting_reason": self.waiting_reason,
            "waiting_message": self.waiting_message,
            "terminated_reason": self.terminated_reason,
            "exit_code": self.exit_code,
            "finished_at": self.finished_at,
            "last_terminated_reason": self.last_terminated_reason,
            "last_exit_code": self.last_exit_code,
            "last_finished_at": self.last_finished_at,
        }


class PodSummary:
    """Normalized pod workload descriptor with container-level state analysis."""

    def __init__(
        self,
        name: str,
        namespace: str,
        uid: str = "",
        service_id: str = "",
        phase: str = "Running",
        restarts: int = 0,
        cpu_limit_millicores: float = 0.0,
        memory_limit_bytes: float = 0.0,
        node_name: Optional[str] = None,
        pod_ip: Optional[str] = None,
        port: int = 8080,
        health_path: str = "/health",
        *,
        restart_count: Optional[int] = None,
        status: Optional[str] = None,
        is_healthy: Optional[bool] = None,
        host_ip: Optional[str] = None,
        qos_class: Optional[str] = None,
        image: Optional[str] = None,
        labels: Optional[dict[str, str]] = None,
        creation_timestamp: Optional[str] = None,
        started_at: Optional[str] = None,
        deletion_timestamp: Optional[str] = None,
        containers: Optional[list[ContainerStatusInfo]] = None,
        init_containers: Optional[list[ContainerStatusInfo]] = None,
    ) -> None:
        self.name = name
        self.namespace = namespace
        self.uid = uid or name
        self.service_id = service_id or extract_service_id(name, labels)
        self.phase = phase
        effective_restarts = restart_count if restart_count is not None else restarts
        self.restarts = effective_restarts
        self.restart_count = effective_restarts
        self.cpu_limit_millicores = cpu_limit_millicores
        self.memory_limit_bytes = memory_limit_bytes
        self.node_name = node_name
        self.pod_ip = pod_ip
        self.port = port
        self.health_path = health_path
        self.host_ip = host_ip
        self.qos_class = qos_class
        self.image = image or ""
        self.labels = labels if labels is not None else {}
        self.creation_timestamp = creation_timestamp
        self.started_at = started_at
        self.deletion_timestamp = deletion_timestamp
        self.containers = containers if containers is not None else []
        self.init_containers = init_containers if init_containers is not None else []

        computed_status, computed_healthy = self._derive_effective_status()
        self.status = status if status is not None else computed_status
        self.is_healthy = is_healthy if is_healthy is not None else computed_healthy

    def _derive_effective_status(self) -> tuple[str, bool]:
        if self.deletion_timestamp:
            return ("Terminating", False)

        all_containers = list(self.init_containers) + list(self.containers)

        # 1. Check critical waiting reasons first (CrashLoopBackOff, ImagePullBackOff, etc.)
        for c in all_containers:
            if c.state == "waiting" and c.waiting_reason:
                if c.waiting_reason == "CrashLoopBackOff":
                    return ("CrashLoopBackOff", False)
                if c.waiting_reason in (
                    "ImagePullBackOff",
                    "ErrImagePull",
                    "CreateContainerConfigError",
                    "CreateContainerError",
                    "InvalidImageName",
                ):
                    return (c.waiting_reason, False)

        # 2. Check terminated container errors (OOMKilled, Error, non-zero exit code)
        for c in all_containers:
            if c.state == "terminated":
                if c.terminated_reason == "OOMKilled":
                    return ("OOMKilled", False)
                if c.terminated_reason == "Error" or (c.exit_code is not None and c.exit_code != 0):
                    return ("Error", False)

        # 3. Check remaining waiting reasons (e.g., ContainerCreating, PodInitializing)
        for c in all_containers:
            if c.state == "waiting" and c.waiting_reason:
                if self.phase == "Pending":
                    return ("Pending", False)
                return (c.waiting_reason, False)

        # 4. Evaluate Pod phase combined with container readiness
        if self.phase == "Running":
            if self.containers:
                if all(c.ready for c in self.containers):
                    return ("Running", True)
                return ("NotReady", False)
            return ("Running", True)

        if self.phase == "Succeeded":
            return ("Succeeded", True)

        if self.phase in ("Pending", "Failed", "Unknown"):
            return (self.phase, False)

        return (self.phase or "Unknown", False)

    def to_detail_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "namespace": self.namespace,
            "service_id": self.service_id,
            "node_name": self.node_name,
            "kubernetes_uid": self.uid,
            "status": self.status,
            "phase": self.phase,
            "is_healthy": self.is_healthy,
            "restart_count": self.restart_count,
            "pod_ip": self.pod_ip,
            "host_ip": self.host_ip,
            "qos_class": self.qos_class,
            "image": self.image,
            "labels": self.labels,
            "creation_timestamp": self.creation_timestamp,
            "started_at": self.started_at,
            "deletion_timestamp": self.deletion_timestamp,
            "containers": [c.to_dict() for c in self.containers],
            "init_containers": [c.to_dict() for c in self.init_containers],
        }


class PodsCollector:
    """Queries CoreV1Api for Pod states, container statuses, and stateful CrashLoopBackOff anomalies."""

    ANOMALY_WAITING_REASONS = (
        "CrashLoopBackOff",
        "ImagePullBackOff",
        "ErrImagePull",
        "CreateContainerConfigError",
        "CreateContainerError",
        "InvalidImageName",
    )

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1
        self.last_collection_status: str = "OK"
        self.last_error: Optional[str] = None
        self.active_incidents: dict[tuple[str, str], dict[str, Any]] = {}
        self.known_pods: dict[str, str] = {}

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

    def _parse_container_status(self, cs: Any, is_init: bool = False) -> ContainerStatusInfo:
        c_name = _opt_str(getattr(cs, "name", None)) or "container"
        c_image = _opt_str(getattr(cs, "image", None))
        c_ready = _opt_bool(getattr(cs, "ready", None), default=True)
        c_started = getattr(cs, "started", None)
        if not isinstance(c_started, bool):
            c_started = None
        c_restarts = _opt_int(getattr(cs, "restart_count", None)) or 0

        state_obj = getattr(cs, "state", None)
        state_type = "unknown"
        waiting_reason: Optional[str] = None
        waiting_message: Optional[str] = None
        terminated_reason: Optional[str] = None
        exit_code: Optional[int] = None
        finished_at: Optional[str] = None

        if state_obj is not None:
            waiting = getattr(state_obj, "waiting", None)
            terminated = getattr(state_obj, "terminated", None)
            running = getattr(state_obj, "running", None)

            w_reason = _opt_str(getattr(waiting, "reason", None)) if waiting is not None else None
            w_msg = _opt_str(getattr(waiting, "message", None)) if waiting is not None else None
            t_reason = _opt_str(getattr(terminated, "reason", None)) if terminated is not None else None
            t_code = _opt_int(getattr(terminated, "exit_code", None)) if terminated is not None else None
            t_fin = _to_iso(getattr(terminated, "finished_at", None)) if terminated is not None else None

            if w_reason is not None or w_msg is not None:
                state_type = "waiting"
                waiting_reason = w_reason
                waiting_message = w_msg
            elif t_reason is not None or t_code is not None:
                state_type = "terminated"
                terminated_reason = t_reason
                exit_code = t_code
                finished_at = t_fin
            elif running is not None:
                state_type = "running"

        last_state_obj = getattr(cs, "last_state", None)
        last_term = getattr(last_state_obj, "terminated", None) if last_state_obj is not None else None
        last_term_reason = _opt_str(getattr(last_term, "reason", None)) if last_term is not None else None
        last_exit_code = _opt_int(getattr(last_term, "exit_code", None)) if last_term is not None else None
        last_finished_at = _to_iso(getattr(last_term, "finished_at", None)) if last_term is not None else None

        return ContainerStatusInfo(
            name=c_name,
            ready=c_ready,
            started=c_started,
            restart_count=c_restarts,
            state=state_type,
            image=c_image,
            is_init=is_init,
            waiting_reason=waiting_reason,
            waiting_message=waiting_message,
            terminated_reason=terminated_reason,
            exit_code=exit_code,
            finished_at=finished_at,
            last_terminated_reason=last_term_reason,
            last_exit_code=last_exit_code,
            last_finished_at=last_finished_at,
        )

    def _parse_pod(self, pod: Any) -> Optional[PodSummary]:
        metadata = getattr(pod, "metadata", None)
        if not metadata or not _opt_str(getattr(metadata, "name", None)):
            return None

        name = str(metadata.name)
        ns = _opt_str(getattr(metadata, "namespace", None)) or "default"
        uid = _opt_str(getattr(metadata, "uid", None)) or name
        raw_labels = getattr(metadata, "labels", None)
        labels = dict(raw_labels) if isinstance(raw_labels, dict) else {}
        creation_ts = _to_iso(getattr(metadata, "creation_timestamp", None))
        deletion_ts = _to_iso(getattr(metadata, "deletion_timestamp", None))

        service_id = extract_service_id(name, labels)

        spec = getattr(pod, "spec", None)
        node_name = _opt_str(getattr(spec, "node_name", None)) if spec else None
        image = ""
        cpu_limit = 0.0
        mem_limit = 0.0
        port = 8080
        health_path = "/health"

        spec_containers = getattr(spec, "containers", None) if spec else None
        if spec_containers:
            for idx, c in enumerate(spec_containers):
                if idx == 0:
                    image = _opt_str(getattr(c, "image", None)) or ""
                resources = getattr(c, "resources", None)
                limits = getattr(resources, "limits", None) if resources else None
                if isinstance(limits, dict):
                    cpu_limit += parse_cpu_to_millicores(limits.get("cpu"))
                    mem_limit += parse_memory_to_bytes(limits.get("memory"))
                ports = getattr(c, "ports", None)
                if ports and len(ports) > 0:
                    cp = _opt_int(getattr(ports[0], "container_port", None))
                    if cp:
                        port = cp
                for probe_attr in ("liveness_probe", "readiness_probe"):
                    probe = getattr(c, probe_attr, None)
                    http_get = getattr(probe, "http_get", None) if probe else None
                    p_path = _opt_str(getattr(http_get, "path", None)) if http_get else None
                    if p_path:
                        health_path = p_path
                        p_port = _opt_int(getattr(http_get, "port", None))
                        if p_port:
                            port = p_port
                        break

        status_obj = getattr(pod, "status", None)
        if status_obj is None:
            phase = "Unknown"
            pod_ip = None
            host_ip = None
            qos_class = None
            started_at = None
            raw_cs = []
            raw_init_cs = []
        else:
            phase = _opt_str(getattr(status_obj, "phase", None)) or "Unknown"
            pod_ip = _opt_str(getattr(status_obj, "pod_ip", None))
            host_ip = _opt_str(getattr(status_obj, "host_ip", None))
            qos_class = _opt_str(getattr(status_obj, "qos_class", None))
            started_at = _to_iso(getattr(status_obj, "start_time", None))
            raw_cs = getattr(status_obj, "container_statuses", None) or []
            raw_init_cs = getattr(status_obj, "init_container_statuses", None) or []

        containers = [self._parse_container_status(cs, is_init=False) for cs in raw_cs]
        init_containers = [self._parse_container_status(cs, is_init=True) for cs in raw_init_cs]
        restarts = sum(c.restart_count for c in containers) + sum(c.restart_count for c in init_containers)

        if not image and containers and containers[0].image:
            image = containers[0].image

        return PodSummary(
            name=name,
            namespace=ns,
            uid=uid,
            service_id=service_id,
            phase=phase,
            restarts=restarts,
            cpu_limit_millicores=cpu_limit,
            memory_limit_bytes=mem_limit,
            node_name=node_name,
            pod_ip=pod_ip,
            port=port,
            health_path=health_path,
            host_ip=host_ip,
            qos_class=qos_class,
            image=image,
            labels=labels,
            creation_timestamp=creation_ts,
            started_at=started_at,
            deletion_timestamp=deletion_ts,
            containers=containers,
            init_containers=init_containers,
        )

    def list_pods(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[PodSummary]:
        """Return list of PodSummary objects from cluster API."""
        if not self.core_v1:
            self.last_collection_status = "OFFLINE"
            self.last_error = "Kubernetes CoreV1Api is not initialized"
            return []

        results: list[PodSummary] = []
        try:
            if monitor_all or not namespace:
                pod_list = self.core_v1.list_pod_for_all_namespaces()
            else:
                pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)

            self.last_collection_status = "OK"
            self.last_error = None
            for pod in getattr(pod_list, "items", None) or []:
                parsed = self._parse_pod(pod)
                if not parsed:
                    continue
                if monitor_all and parsed.namespace in EXCLUDED_NAMESPACES:
                    continue
                results.append(parsed)
        except Exception as err:
            self._record_api_error(err, "list_pods")
            return []

        return results

    def list_pods_detail(
        self, namespace: Optional[str] = None, monitor_all: bool = True
    ) -> list[dict[str, Any]]:
        """Return detailed pod and container state dictionaries for cluster inventory sync."""
        if not self.core_v1:
            self.last_collection_status = "OFFLINE"
            return []

        results: list[dict[str, Any]] = []
        try:
            if monitor_all or not namespace:
                pod_list = self.core_v1.list_pod_for_all_namespaces()
            else:
                pod_list = self.core_v1.list_namespaced_pod(namespace=namespace)

            self.last_collection_status = "OK"
            self.last_error = None
            for pod in getattr(pod_list, "items", None) or []:
                parsed = self._parse_pod(pod)
                if parsed:
                    results.append(parsed.to_detail_dict())
        except Exception as err:
            self._record_api_error(err, "list_pods_detail")
            return []

        return results

    def detect_pod_anomalies(
        self, namespace: Optional[str] = None, monitor_all: bool = True
    ) -> list[AgentK8sEventData]:
        """Detect CrashLoopBackOff, ImagePullBackOff, OOMKilled, and container recovery transitions."""
        pods = self.list_pods(namespace=namespace, monitor_all=monitor_all)
        if self.last_collection_status != "OK":
            return []

        events: list[AgentK8sEventData] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        seen_pod_uids: set[str] = set()

        for pod in pods:
            pod_uid = pod.uid or pod.name
            seen_pod_uids.add(pod_uid)
            self.known_pods[pod_uid] = pod.name

            for c in list(pod.init_containers) + list(pod.containers):
                key = (pod_uid, c.name)
                anomaly_reason: Optional[str] = None
                anomaly_details: list[str] = []

                if c.state == "waiting" and c.waiting_reason in self.ANOMALY_WAITING_REASONS:
                    anomaly_reason = c.waiting_reason
                    anomaly_details.append(
                        f"Container '{c.name}' in pod '{pod.namespace}/{pod.name}' is in {c.waiting_reason} "
                        f"(restart_count={c.restart_count})"
                    )
                    if c.waiting_message:
                        anomaly_details.append(f"waiting_message={c.waiting_message}")
                    if c.last_terminated_reason:
                        anomaly_details.append(f"last_terminated_reason={c.last_terminated_reason}")
                    if c.last_exit_code is not None:
                        anomaly_details.append(f"exit_code={c.last_exit_code}")
                    if c.last_finished_at:
                        anomaly_details.append(f"finished_at={c.last_finished_at}")

                elif c.state == "terminated":
                    if c.terminated_reason == "OOMKilled":
                        anomaly_reason = "OOMKilled"
                    elif c.terminated_reason == "Error" or (c.exit_code is not None and c.exit_code != 0):
                        anomaly_reason = "Error"

                    if anomaly_reason:
                        anomaly_details.append(
                            f"Container '{c.name}' in pod '{pod.namespace}/{pod.name}' terminated with {anomaly_reason} "
                            f"(exit_code={c.exit_code}, restart_count={c.restart_count})"
                        )

                if anomaly_reason:
                    prev = self.active_incidents.get(key)
                    if prev is None or prev.get("reason") != anomaly_reason:
                        self.active_incidents[key] = {
                            "pod_uid": pod_uid,
                            "pod_name": pod.name,
                            "namespace": pod.namespace,
                            "service_id": pod.service_id,
                            "node_name": pod.node_name,
                            "container_name": c.name,
                            "reason": anomaly_reason,
                            "restart_count": c.restart_count,
                            "last_terminated_reason": c.last_terminated_reason or c.terminated_reason,
                            "last_exit_code": c.last_exit_code if c.last_exit_code is not None else c.exit_code,
                            "first_detected_at": now_iso,
                            "last_observed_at": now_iso,
                        }
                        events.append(
                            AgentK8sEventData(
                                service_id=pod.service_id,
                                pod_id=pod_uid,
                                pod_name=pod.name,
                                status=anomaly_reason,
                                timestamp=now_iso,
                                event=K8sEventDetail(
                                    type="Warning",
                                    reason=anomaly_reason,
                                    message="; ".join(anomaly_details),
                                ),
                            )
                        )
                    else:
                        prev["restart_count"] = c.restart_count
                        prev["last_observed_at"] = now_iso

                elif c.state == "running" and c.ready and key in self.active_incidents:
                    prev = self.active_incidents.pop(key)
                    prev_reason = prev.get("reason", "Anomaly")
                    rec_reason = (
                        "RecoveredFromCrashLoop"
                        if prev_reason == "CrashLoopBackOff"
                        else "ContainerRecovered"
                    )
                    events.append(
                        AgentK8sEventData(
                            service_id=pod.service_id,
                            pod_id=pod_uid,
                            pod_name=pod.name,
                            status="Running",
                            timestamp=now_iso,
                            event=K8sEventDetail(
                                type="Normal",
                                reason=rec_reason,
                                message=(
                                    f"Container '{c.name}' in pod '{pod.namespace}/{pod.name}' recovered "
                                    f"from {prev_reason} to Running (ready=True, restart_count={c.restart_count})."
                                ),
                            ),
                        )
                    )

        # Clean up incidents for deleted pods
        for stale_pod_uid in list(self.known_pods.keys()):
            if stale_pod_uid not in seen_pod_uids:
                self.known_pods.pop(stale_pod_uid, None)
                stale_keys = [k for k in self.active_incidents if k[0] == stale_pod_uid]
                for k in stale_keys:
                    self.active_incidents.pop(k, None)

        return events
