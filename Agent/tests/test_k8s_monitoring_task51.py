"""Comprehensive tests for Task 5.1: Kubernetes Node, Pod, CrashLoopBackOff, and Deployment Monitoring."""

from datetime import datetime, timezone
from unittest.mock import MagicMock
import pytest
from kubernetes.client.rest import ApiException

from selfheal_agent.collectors.nodes import NodesCollector, NodeSummary
from selfheal_agent.collectors.pods import PodsCollector, PodSummary
from selfheal_agent.collectors.deployments import DeploymentsCollector, DeploymentSummary
from selfheal_agent.collectors.events import EventsCollector
from selfheal_agent.telemetry.schemas import K8sInventoryMessage, K8sEventMessage


# =====================================================================
# HELPERS FOR MOCK K8S OBJECTS
# =====================================================================

def _make_node(
    name: str = "node-1",
    uid: str = "node-uid-1",
    ready_status: str | None = "True",
    ready_reason: str = "KubeletReady",
    ready_message: str = "kubelet is posting ready status",
    memory_pressure: str = "False",
    disk_pressure: str = "False",
    pid_pressure: str = "False",
    network_unavailable: str | None = None,
    capacity: dict | None = None,
    allocatable: dict | None = None,
    labels: dict | None = None,
    taints: list | None = None,
    unschedulable: bool = False,
):
    node = MagicMock()
    node.metadata.name = name
    node.metadata.uid = uid
    node.metadata.labels = labels if labels is not None else {"node-role.kubernetes.io/worker": ""}
    node.metadata.creation_timestamp = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)
    node.spec.unschedulable = unschedulable
    node.spec.taints = taints or []

    conditions = []
    if ready_status is not None:
        c_ready = MagicMock()
        c_ready.type = "Ready"
        c_ready.status = ready_status
        c_ready.reason = ready_reason
        c_ready.message = ready_message
        c_ready.last_heartbeat_time = datetime(2026, 10, 25, 8, 0, 0, tzinfo=timezone.utc)
        c_ready.last_transition_time = datetime(2026, 10, 20, 8, 0, 0, tzinfo=timezone.utc)
        conditions.append(c_ready)

    for c_type, c_val in [
        ("MemoryPressure", memory_pressure),
        ("DiskPressure", disk_pressure),
        ("PIDPressure", pid_pressure),
        ("NetworkUnavailable", network_unavailable),
    ]:
        if c_val is not None:
            c = MagicMock()
            c.type = c_type
            c.status = c_val
            c.reason = f"{c_type}Reason"
            c.message = f"{c_type} is {c_val}"
            conditions.append(c)

    node.status.conditions = conditions
    node.status.capacity = capacity or {
        "cpu": "4",
        "memory": "8Gi",
        "ephemeral-storage": "50Gi",
        "pods": "110",
    }
    node.status.allocatable = allocatable or {
        "cpu": "3800m",
        "memory": "7Gi",
        "ephemeral-storage": "45Gi",
        "pods": "110",
    }
    node.status.node_info.kubelet_version = "v1.31.0"
    node.status.node_info.os_image = "Ubuntu 22.04.5 LTS"
    node.status.node_info.operating_system = "linux"
    node.status.node_info.architecture = "amd64"
    node.status.node_info.container_runtime_version = "containerd://1.7.22"
    return node


def _make_container_status(
    name: str = "app",
    ready: bool = True,
    started: bool = True,
    restart_count: int = 0,
    state_type: str = "running",
    waiting_reason: str | None = None,
    waiting_message: str | None = None,
    terminated_reason: str | None = None,
    exit_code: int | None = None,
    finished_at: datetime | None = None,
    last_terminated_reason: str | None = None,
    last_exit_code: int | None = None,
    last_finished_at: datetime | None = None,
):
    cs = MagicMock()
    cs.name = name
    cs.ready = ready
    cs.started = started
    cs.restart_count = restart_count
    cs.image = f"registry.local/{name}:v1"

    cs.state.running = None
    cs.state.waiting = None
    cs.state.terminated = None

    if state_type == "running":
        cs.state.running = MagicMock()
        cs.state.running.started_at = datetime(2026, 10, 25, 7, 0, 0, tzinfo=timezone.utc)
    elif state_type == "waiting":
        cs.state.waiting = MagicMock()
        cs.state.waiting.reason = waiting_reason
        cs.state.waiting.message = waiting_message
    elif state_type == "terminated":
        cs.state.terminated = MagicMock()
        cs.state.terminated.reason = terminated_reason
        cs.state.terminated.exit_code = exit_code
        cs.state.terminated.finished_at = finished_at or datetime(2026, 10, 25, 7, 30, 0, tzinfo=timezone.utc)

    if last_terminated_reason is not None or last_exit_code is not None:
        cs.last_state = MagicMock()
        cs.last_state.terminated = MagicMock()
        cs.last_state.terminated.reason = last_terminated_reason
        cs.last_state.terminated.exit_code = last_exit_code
        cs.last_state.terminated.finished_at = last_finished_at or datetime(
            2026, 10, 25, 7, 29, 0, tzinfo=timezone.utc
        )
    else:
        cs.last_state = MagicMock()
        cs.last_state.terminated = None

    return cs


def _make_pod(
    name: str = "order-svc-abc-123",
    namespace: str = "default",
    uid: str = "pod-uid-1",
    phase: str = "Running",
    node_name: str = "node-1",
    pod_ip: str = "10.244.0.15",
    labels: dict | None = None,
    container_statuses: list | None = None,
    init_container_statuses: list | None = None,
    deletion_timestamp: datetime | None = None,
):
    pod = MagicMock()
    pod.metadata.name = name
    pod.metadata.namespace = namespace
    pod.metadata.uid = uid
    pod.metadata.labels = labels if labels is not None else {"app": "order-svc"}
    pod.metadata.creation_timestamp = datetime(2026, 10, 25, 6, 0, 0, tzinfo=timezone.utc)
    pod.metadata.deletion_timestamp = deletion_timestamp
    pod.metadata.owner_references = None

    pod.spec.node_name = node_name
    c_spec = MagicMock()
    c_spec.name = "app"
    c_spec.image = "registry.local/order-svc:v1"
    pod.spec.containers = [c_spec]

    pod.status.phase = phase
    pod.status.pod_ip = pod_ip
    pod.status.host_ip = "192.168.49.2"
    pod.status.qos_class = "Burstable"
    pod.status.start_time = datetime(2026, 10, 25, 6, 0, 5, tzinfo=timezone.utc)
    pod.status.container_statuses = container_statuses
    pod.status.init_container_statuses = init_container_statuses
    return pod


def _make_deployment(
    name: str = "order-svc",
    namespace: str = "default",
    uid: str = "dep-uid-1",
    desired_replicas: int | None = 3,
    replicas: int | None = 3,
    ready_replicas: int | None = 3,
    available_replicas: int | None = 3,
    updated_replicas: int | None = 3,
    unavailable_replicas: int | None = 0,
    generation: int = 2,
    observed_generation: int | None = 2,
    conditions: list | None = None,
):
    dep = MagicMock()
    dep.metadata.name = name
    dep.metadata.namespace = namespace
    dep.metadata.uid = uid
    dep.metadata.generation = generation
    dep.metadata.labels = {"app": name}
    dep.metadata.creation_timestamp = datetime(2026, 10, 1, 0, 0, 0, tzinfo=timezone.utc)

    dep.spec.replicas = desired_replicas
    dep.spec.selector.match_labels = {"app": name}

    dep.status.replicas = replicas
    dep.status.ready_replicas = ready_replicas
    dep.status.available_replicas = available_replicas
    dep.status.updated_replicas = updated_replicas
    dep.status.unavailable_replicas = unavailable_replicas
    dep.status.observed_generation = observed_generation

    if conditions is None:
        c_avail = MagicMock()
        c_avail.type = "Available"
        c_avail.status = "True"
        c_avail.reason = "MinimumReplicasAvailable"
        c_avail.message = "Deployment has minimum availability."

        c_prog = MagicMock()
        c_prog.type = "Progressing"
        c_prog.status = "True"
        c_prog.reason = "NewReplicaSetAvailable"
        c_prog.message = "ReplicaSet has successfully progressed."
        dep.status.conditions = [c_avail, c_prog]
    else:
        dep.status.conditions = conditions

    return dep


# =====================================================================
# PHASE 3: NODE MONITORING TESTS
# =====================================================================

class TestNodeMonitoringTask51:
    def test_node_ready_with_capacity_allocatable_and_pressures(self):
        core_v1 = MagicMock()
        core_v1.list_node.return_value.items = [_make_node(name="worker-1", ready_status="True")]

        collector = NodesCollector(core_v1)
        summaries = collector.list_nodes()
        assert len(summaries) == 1
        n = summaries[0]
        assert n.name == "worker-1"
        assert n.ready is True
        assert n.status == "Ready"
        assert n.cpu_capacity_millicores == 4000
        assert n.cpu_allocatable_millicores == 3800
        assert n.memory_capacity_bytes == 8 * 1024**3
        assert n.memory_allocatable_bytes == 7 * 1024**3
        assert n.pods_allocatable == 110
        assert collector.last_collection_status == "OK"

        details = collector.list_nodes_detail()
        assert len(details) == 1
        d = details[0]
        assert d["status"] == "Ready"
        assert d["cpu_allocatable_millicores"] == 3800
        assert d["memory_allocatable_bytes"] == 7 * 1024**3
        assert d["conditions"]["MemoryPressure"] == "False"
        assert d["conditions"]["DiskPressure"] == "False"
        assert d["conditions"]["PIDPressure"] == "False"
        assert d["active_pressures"] == []

    def test_node_not_ready_and_unknown_distinction(self):
        core_v1 = MagicMock()
        node_not_ready = _make_node(
            name="node-notready",
            uid="uid-nr",
            ready_status="False",
            ready_reason="KubeletNotReady",
            ready_message="container runtime network not ready",
        )
        node_unknown = _make_node(
            name="node-unknown",
            uid="uid-unk",
            ready_status="Unknown",
            ready_reason="NodeStatusUnknown",
            ready_message="Kubelet stopped posting node status.",
        )
        node_missing_cond = _make_node(
            name="node-nocond",
            uid="uid-nocond",
            ready_status=None,
        )
        node_missing_cond.status.conditions = []

        core_v1.list_node.return_value.items = [node_not_ready, node_unknown, node_missing_cond]
        collector = NodesCollector(core_v1)

        summaries = {n.name: n for n in collector.list_nodes()}
        assert summaries["node-notready"].ready is False
        assert summaries["node-notready"].status == "NotReady"

        assert summaries["node-unknown"].ready is False
        assert summaries["node-unknown"].status == "Unknown"

        assert summaries["node-nocond"].ready is False
        assert summaries["node-nocond"].status == "Unknown"

        details = {d["name"]: d for d in collector.list_nodes_detail()}
        assert details["node-notready"]["status"] == "NotReady"
        assert details["node-unknown"]["status"] == "Unknown"
        assert details["node-nocond"]["status"] == "Unknown"

    def test_node_pressure_conditions_and_anomaly_deduplication_and_recovery(self):
        core_v1 = MagicMock()
        node_pressured = _make_node(
            name="node-pressured",
            uid="uid-p1",
            ready_status="False",
            memory_pressure="True",
            disk_pressure="True",
        )
        core_v1.list_node.return_value.items = [node_pressured]
        collector = NodesCollector(core_v1)

        # First poll: emits anomaly events for NotReady and Pressure
        events_1 = collector.detect_node_anomalies()
        assert len(events_1) >= 1
        reasons_1 = {e.event.reason for e in events_1}
        assert "NodeNotReady" in reasons_1

        # Second poll with identical state: deduplicated (0 new events)
        events_2 = collector.detect_node_anomalies()
        assert len(events_2) == 0

        # Third poll: Node recovers to Ready with no pressure
        core_v1.list_node.return_value.items = [
            _make_node(name="node-pressured", uid="uid-p1", ready_status="True", memory_pressure="False", disk_pressure="False")
        ]
        events_3 = collector.detect_node_anomalies()
        assert any(e.event.reason == "NodeReady" and e.event.type == "Normal" for e in events_3)

    def test_node_api_forbidden_and_error_do_not_fabricate_not_ready(self):
        core_v1 = MagicMock()
        core_v1.list_node.side_effect = ApiException(status=403, reason="Forbidden")

        collector = NodesCollector(core_v1)
        nodes = collector.list_nodes()
        assert nodes == []
        assert collector.last_collection_status == "FORBIDDEN"
        assert "403" in (collector.last_error or "") or "Forbidden" in (collector.last_error or "")


# =====================================================================
# PHASE 4 & 5: POD & CRASHLOOPBACKOFF MONITORING TESTS
# =====================================================================

class TestPodAndCrashLoopMonitoringTask51:
    def test_pod_running_healthy_vs_running_unready_container(self):
        core_v1 = MagicMock()
        healthy_pod = _make_pod(
            name="web-healthy",
            uid="uid-h1",
            phase="Running",
            container_statuses=[_make_container_status(name="web", ready=True, state_type="running", restart_count=0)],
        )
        unready_pod = _make_pod(
            name="web-unready",
            uid="uid-u1",
            phase="Running",
            container_statuses=[_make_container_status(name="web", ready=False, started=False, state_type="running", restart_count=0)],
        )
        core_v1.list_pod_for_all_namespaces.return_value.items = [healthy_pod, unready_pod]

        collector = PodsCollector(core_v1)
        pods = {p.name: p for p in collector.list_pods(monitor_all=True)}

        assert pods["web-healthy"].phase == "Running"
        assert pods["web-healthy"].status == "Running"
        assert pods["web-healthy"].is_healthy is True

        # Phase is Running, but container is NOT ready -> must NOT be considered healthy Running
        assert pods["web-unready"].phase == "Running"
        assert pods["web-unready"].status == "NotReady"
        assert pods["web-unready"].is_healthy is False

    def test_pod_phases_pending_succeeded_failed_unknown_and_missing_status(self):
        core_v1 = MagicMock()
        p_pending = _make_pod(
            name="pod-pending",
            uid="u-pend",
            phase="Pending",
            container_statuses=[
                _make_container_status(
                    name="app", ready=False, started=False, state_type="waiting", waiting_reason="ContainerCreating"
                )
            ],
        )
        p_succeeded = _make_pod(
            name="job-done",
            uid="u-succ",
            phase="Succeeded",
            container_statuses=[
                _make_container_status(
                    name="job", ready=False, started=False, state_type="terminated", terminated_reason="Completed", exit_code=0
                )
            ],
        )
        p_failed = _make_pod(
            name="pod-failed",
            uid="u-fail",
            phase="Failed",
            container_statuses=[
                _make_container_status(
                    name="app", ready=False, started=False, state_type="terminated", terminated_reason="Error", exit_code=1
                )
            ],
        )
        p_unknown = _make_pod(name="pod-unknown", uid="u-unk", phase="Unknown", container_statuses=None)
        p_no_status = _make_pod(name="pod-nostatus", uid="u-nostat")
        p_no_status.status = None

        core_v1.list_pod_for_all_namespaces.return_value.items = [
            p_pending, p_succeeded, p_failed, p_unknown, p_no_status
        ]
        collector = PodsCollector(core_v1)
        pods = {p.name: p for p in collector.list_pods(monitor_all=True)}

        assert pods["pod-pending"].phase == "Pending"
        assert pods["pod-pending"].is_healthy is False

        assert pods["job-done"].phase == "Succeeded"
        assert pods["job-done"].status == "Succeeded"

        assert pods["pod-failed"].phase == "Failed"
        assert pods["pod-failed"].is_healthy is False

        assert pods["pod-unknown"].phase == "Unknown"
        assert pods["pod-nostatus"].phase == "Unknown"

    def test_crashloopbackoff_single_and_multicontainer_and_missing_last_state(self):
        core_v1 = MagicMock()
        # 1. Single container in CrashLoopBackOff with OOMKilled last_state
        pod_clbo_oom = _make_pod(
            name="payment-svc-1",
            uid="uid-clbo-1",
            phase="Running",
            container_statuses=[
                _make_container_status(
                    name="payment",
                    ready=False,
                    started=False,
                    restart_count=6,
                    state_type="waiting",
                    waiting_reason="CrashLoopBackOff",
                    waiting_message="back-off 5m0s restarting failed container=payment pod=payment-svc-1",
                    last_terminated_reason="OOMKilled",
                    last_exit_code=137,
                )
            ],
        )
        # 2. Multi-container pod: sidecar Running+ready, main container in CrashLoopBackOff WITHOUT last_state.terminated
        pod_multi_clbo = _make_pod(
            name="checkout-svc-2",
            uid="uid-clbo-2",
            phase="Running",
            container_statuses=[
                _make_container_status(name="istio-proxy", ready=True, state_type="running", restart_count=0),
                _make_container_status(
                    name="checkout",
                    ready=False,
                    started=False,
                    restart_count=3,
                    state_type="waiting",
                    waiting_reason="CrashLoopBackOff",
                    waiting_message="back-off 40s restarting failed container",
                    last_terminated_reason=None,
                    last_exit_code=None,
                ),
            ],
        )

        core_v1.list_pod_for_all_namespaces.return_value.items = [pod_clbo_oom, pod_multi_clbo]
        collector = PodsCollector(core_v1)

        details = {d["name"]: d for d in collector.list_pods_detail()}
        assert details["payment-svc-1"]["status"] == "CrashLoopBackOff"
        assert details["payment-svc-1"]["phase"] == "Running"
        assert details["payment-svc-1"]["restart_count"] == 6
        assert details["payment-svc-1"]["containers"][0]["waiting_reason"] == "CrashLoopBackOff"
        assert details["payment-svc-1"]["containers"][0]["last_terminated_reason"] == "OOMKilled"
        assert details["payment-svc-1"]["containers"][0]["last_exit_code"] == 137

        assert details["checkout-svc-2"]["status"] == "CrashLoopBackOff"
        assert details["checkout-svc-2"]["restart_count"] == 3

    def test_distinguish_crashloop_from_imagepull_oom_and_recovered_high_restarts(self):
        core_v1 = MagicMock()
        # Container with restart_count > 0 but currently Running and Ready -> MUST be Running (NOT CrashLoopBackOff!)
        pod_recovered = _make_pod(
            name="api-recovered",
            uid="uid-rec",
            phase="Running",
            container_statuses=[
                _make_container_status(
                    name="api",
                    ready=True,
                    started=True,
                    restart_count=12,
                    state_type="running",
                    last_terminated_reason="Error",
                    last_exit_code=1,
                )
            ],
        )
        # Container in ImagePullBackOff -> MUST be ImagePullBackOff (NOT CrashLoopBackOff!)
        pod_imgpull = _make_pod(
            name="api-imgpull",
            uid="uid-img",
            phase="Pending",
            container_statuses=[
                _make_container_status(
                    name="api",
                    ready=False,
                    started=False,
                    restart_count=0,
                    state_type="waiting",
                    waiting_reason="ImagePullBackOff",
                    waiting_message="Back-off pulling image 'bad:tag'",
                )
            ],
        )
        # Container in CreateContainerConfigError -> CreateContainerConfigError
        pod_cfg_err = _make_pod(
            name="api-cfgerr",
            uid="uid-cfg",
            phase="Pending",
            container_statuses=[
                _make_container_status(
                    name="api",
                    ready=False,
                    started=False,
                    restart_count=0,
                    state_type="waiting",
                    waiting_reason="CreateContainerConfigError",
                    waiting_message="secret 'missing-secret' not found",
                )
            ],
        )

        core_v1.list_pod_for_all_namespaces.return_value.items = [pod_recovered, pod_imgpull, pod_cfg_err]
        collector = PodsCollector(core_v1)
        details = {d["name"]: d for d in collector.list_pods_detail()}

        assert details["api-recovered"]["status"] == "Running"
        assert details["api-recovered"]["is_healthy"] is True
        assert details["api-recovered"]["restart_count"] == 12

        assert details["api-imgpull"]["status"] == "ImagePullBackOff"
        assert details["api-cfgerr"]["status"] == "CreateContainerConfigError"

    def test_crashloop_deduplication_recovery_and_deleted_pod_cleanup(self):
        core_v1 = MagicMock()
        pod_crashing = _make_pod(
            name="cart-svc-1",
            uid="uid-cart-1",
            phase="Running",
            container_statuses=[
                _make_container_status(
                    name="cart",
                    ready=False,
                    started=False,
                    restart_count=4,
                    state_type="waiting",
                    waiting_reason="CrashLoopBackOff",
                    waiting_message="back-off 1m20s restarting failed container",
                    last_terminated_reason="Error",
                    last_exit_code=1,
                )
            ],
        )
        core_v1.list_pod_for_all_namespaces.return_value.items = [pod_crashing]
        collector = PodsCollector(core_v1)

        # Poll 1: detects CrashLoopBackOff and emits 1 Warning event
        ev1 = collector.detect_pod_anomalies(monitor_all=True)
        assert len(ev1) == 1
        assert ev1[0].status == "CrashLoopBackOff"
        assert ev1[0].event.type == "Warning"
        assert ev1[0].event.reason == "CrashLoopBackOff"
        assert "exit_code=1" in ev1[0].event.message or "Error" in ev1[0].event.message
        assert ("uid-cart-1", "cart") in collector.active_incidents

        # Poll 2: identical CrashLoopBackOff state -> deduplicated, 0 events emitted
        ev2 = collector.detect_pod_anomalies(monitor_all=True)
        assert len(ev2) == 0

        # Poll 3: container recovers to Running (ready=True) -> emits Normal recovery event & clears active incident
        pod_healthy = _make_pod(
            name="cart-svc-1",
            uid="uid-cart-1",
            phase="Running",
            container_statuses=[
                _make_container_status(name="cart", ready=True, started=True, restart_count=5, state_type="running")
            ],
        )
        core_v1.list_pod_for_all_namespaces.return_value.items = [pod_healthy]
        ev3 = collector.detect_pod_anomalies(monitor_all=True)
        assert len(ev3) == 1
        assert ev3[0].status == "Running"
        assert ev3[0].event.type == "Normal"
        assert ev3[0].event.reason == "RecoveredFromCrashLoop"
        assert ("uid-cart-1", "cart") not in collector.active_incidents

        # Poll 4: Another pod enters CrashLoopBackOff, then gets deleted on Poll 5 -> purged from active_incidents
        pod_temp = _make_pod(
            name="temp-pod",
            uid="uid-temp",
            phase="Running",
            container_statuses=[
                _make_container_status(
                    name="temp",
                    ready=False,
                    restart_count=2,
                    state_type="waiting",
                    waiting_reason="CrashLoopBackOff",
                )
            ],
        )
        core_v1.list_pod_for_all_namespaces.return_value.items = [pod_temp]
        ev4 = collector.detect_pod_anomalies(monitor_all=True)
        assert len(ev4) == 1
        assert ("uid-temp", "temp") in collector.active_incidents

        # Poll 5: temp-pod is deleted from cluster
        core_v1.list_pod_for_all_namespaces.return_value.items = []
        collector.detect_pod_anomalies(monitor_all=True)
        assert ("uid-temp", "temp") not in collector.active_incidents


# =====================================================================
# PHASE 6: DEPLOYMENT MONITORING TESTS
# =====================================================================

class TestDeploymentMonitoringTask51:
    def test_deployment_healthy_vs_scale_to_zero(self):
        apps_v1 = MagicMock()
        dep_healthy = _make_deployment(
            name="auth-svc",
            uid="dep-1",
            desired_replicas=3,
            replicas=3,
            ready_replicas=3,
            available_replicas=3,
            updated_replicas=3,
            unavailable_replicas=0,
        )
        dep_zero = _make_deployment(
            name="batch-worker",
            uid="dep-zero",
            desired_replicas=0,
            replicas=0,
            ready_replicas=0,
            available_replicas=0,
            updated_replicas=0,
            unavailable_replicas=0,
        )
        apps_v1.list_deployment_for_all_namespaces.return_value.items = [dep_healthy, dep_zero]

        collector = DeploymentsCollector(apps_v1)
        deps = {d.name: d for d in collector.list_deployments(monitor_all=True)}

        assert deps["auth-svc"].desired_replicas == 3
        assert deps["auth-svc"].ready_replicas == 3
        assert deps["auth-svc"].available_replicas == 3
        assert deps["auth-svc"].status == "Healthy"
        assert deps["auth-svc"].is_healthy is True

        # Intentional scale-to-zero must NOT be treated as an error/degraded
        assert deps["batch-worker"].desired_replicas == 0
        assert deps["batch-worker"].ready_replicas == 0
        assert deps["batch-worker"].status == "ScaledToZero"
        assert deps["batch-worker"].is_healthy is True

        replicas_map = collector.get_replicas_map(monitor_all=True)
        assert replicas_map["auth-svc"] == 3
        assert replicas_map["batch-worker"] == 0

        # No anomalies emitted for healthy or scaled-to-zero deployments
        anomalies = collector.detect_deployment_anomalies(monitor_all=True)
        assert anomalies == []

    def test_deployment_insufficient_replicas_and_generation_lag_and_progress_deadline_exceeded(self):
        apps_v1 = MagicMock()
        # 1. Degraded: desired=3, ready=1, available=1, unavailable=2
        dep_degraded = _make_deployment(
            name="order-svc",
            uid="dep-deg",
            desired_replicas=3,
            replicas=3,
            ready_replicas=1,
            available_replicas=1,
            updated_replicas=3,
            unavailable_replicas=2,
            generation=4,
            observed_generation=4,
        )
        # 2. Generation lag: observed_generation (2) < generation (3)
        dep_gen_lag = _make_deployment(
            name="catalog-svc",
            uid="dep-lag",
            desired_replicas=2,
            replicas=2,
            ready_replicas=2,
            available_replicas=2,
            updated_replicas=1,
            unavailable_replicas=0,
            generation=3,
            observed_generation=2,
        )
        # 3. Rollout failed: ProgressDeadlineExceeded
        c_avail = MagicMock()
        c_avail.type = "Available"
        c_avail.status = "False"
        c_avail.reason = "MinimumReplicasUnavailable"
        c_avail.message = "Deployment does not have minimum availability."

        c_prog = MagicMock()
        c_prog.type = "Progressing"
        c_prog.status = "False"
        c_prog.reason = "ProgressDeadlineExceeded"
        c_prog.message = 'ReplicaSet "payment-svc-7d9" has timed out progressing.'

        dep_failed_rollout = _make_deployment(
            name="payment-svc",
            uid="dep-fail",
            desired_replicas=2,
            replicas=2,
            ready_replicas=0,
            available_replicas=0,
            updated_replicas=2,
            unavailable_replicas=2,
            generation=5,
            observed_generation=5,
            conditions=[c_avail, c_prog],
        )

        apps_v1.list_deployment_for_all_namespaces.return_value.items = [
            dep_degraded,
            dep_gen_lag,
            dep_failed_rollout,
        ]
        collector = DeploymentsCollector(apps_v1)
        deps = {d.name: d for d in collector.list_deployments(monitor_all=True)}

        assert deps["order-svc"].status == "Degraded"
        assert deps["order-svc"].is_healthy is False
        assert deps["order-svc"].unavailable_replicas == 2

        assert deps["catalog-svc"].status == "Progressing"
        assert deps["catalog-svc"].rollout_in_progress is True

        assert deps["payment-svc"].status == "ProgressDeadlineExceeded"
        assert deps["payment-svc"].is_healthy is False

        # Detect anomalies & test deduplication + recovery
        ev1 = collector.detect_deployment_anomalies(monitor_all=True)
        reasons = {e.service_id: e.event.reason for e in ev1}
        assert reasons["order-svc"] == "MinimumReplicasUnavailable"
        assert reasons["payment-svc"] == "ProgressDeadlineExceeded"

        # Poll 2: no duplicate events
        ev2 = collector.detect_deployment_anomalies(monitor_all=True)
        assert ev2 == []

        # Poll 3: order-svc recovers to 3/3 ready & available
        dep_recovered = _make_deployment(
            name="order-svc",
            uid="dep-deg",
            desired_replicas=3,
            replicas=3,
            ready_replicas=3,
            available_replicas=3,
            updated_replicas=3,
            unavailable_replicas=0,
            generation=4,
            observed_generation=4,
        )
        apps_v1.list_deployment_for_all_namespaces.return_value.items = [dep_recovered]
        ev3 = collector.detect_deployment_anomalies(monitor_all=True)
        assert len(ev3) == 1
        assert ev3[0].service_id == "order-svc"
        assert ev3[0].event.type == "Normal"
        assert ev3[0].event.reason == "DeploymentRecovered"
        assert "dep-fail" not in collector.active_anomalies


# =====================================================================
# PHASE 5 & 8: EVENTS CLASSIFICATION & INVENTORY CONTRACT TESTS
# =====================================================================

class TestEventsAndInventoryContractTask51:
    def test_events_collector_distinguishes_imagepullbackoff_oom_and_crashloop(self):
        core_v1 = MagicMock()

        def _make_ev(uid: str, name: str, reason: str, message: str, ev_type: str = "Warning"):
            ev = MagicMock()
            ev.metadata.uid = uid
            ev.metadata.creation_timestamp = datetime.now(timezone.utc)
            ev.last_timestamp = datetime.now(timezone.utc)
            ev.involved_object.kind = "Pod"
            ev.involved_object.name = name
            ev.involved_object.uid = f"pod-{uid}"
            ev.reason = reason
            ev.message = message
            ev.type = ev_type
            return ev

        core_v1.list_event_for_all_namespaces.return_value.items = [
            _make_ev("e1", "img-pod-123-abc", "BackOff", "Back-off pulling image 'nginx:nonexistent'"),
            _make_ev("e2", "crash-pod-123-abc", "BackOff", "Back-off restarting failed container app in pod crash-pod"),
            _make_ev("e3", "oom-pod-123-abc", "OOMKilling", "Memory cgroup out of memory: Killed process 1234"),
        ]

        collector = EventsCollector(core_v1)
        events = {e.pod_name: e for e in collector.collect_events(monitor_all=True)}

        assert events["img-pod-123-abc"].status == "ImagePullBackOff"
        assert events["crash-pod-123-abc"].status == "CrashLoopBackOff"
        assert events["oom-pod-123-abc"].status == "OOMKilled"

    def test_k8s_inventory_message_includes_deployments_detail(self):
        apps_v1 = MagicMock()
        apps_v1.list_deployment_for_all_namespaces.return_value.items = [
            _make_deployment(name="order-svc", desired_replicas=2, ready_replicas=2, available_replicas=2)
        ]
        dep_collector = DeploymentsCollector(apps_v1)
        deployments_detail = dep_collector.list_deployments_detail(monitor_all=True)

        msg = K8sInventoryMessage(
            data={
                "nodes": [],
                "namespaces": [],
                "pods": [],
                "services": [],
                "deployments": deployments_detail,
            }
        )
        assert len(msg.data.deployments) == 1
        assert msg.data.deployments[0]["name"] == "order-svc"
        assert msg.data.deployments[0]["status"] == "Healthy"
