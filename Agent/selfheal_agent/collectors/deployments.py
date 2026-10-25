"""Collector for Kubernetes Deployment resources, replica health, and rollout progress."""

from datetime import datetime, timezone
import logging
from typing import Any, Optional
from kubernetes import client
from kubernetes.client.rest import ApiException

from selfheal_agent.telemetry.schemas import AgentK8sEventData, K8sEventDetail

logger = logging.getLogger("selfheal_agent.collectors.deployments")


def _opt_str(val: Any) -> Optional[str]:
    return val if isinstance(val, str) and val != "" else None


def _opt_int(val: Any, default: int = 0) -> int:
    if isinstance(val, int) and not isinstance(val, bool):
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


class DeploymentSummary:
    """Summary of a Kubernetes Deployment's replica counts, generation, conditions, and health."""

    def __init__(
        self,
        name: str,
        namespace: str,
        uid: Optional[str] = None,
        desired_replicas: int = 1,
        replicas: int = 0,
        ready_replicas: int = 0,
        available_replicas: int = 0,
        updated_replicas: int = 0,
        unavailable_replicas: int = 0,
        generation: int = 1,
        observed_generation: int = 1,
        conditions: Optional[dict[str, dict[str, Optional[str]]]] = None,
        labels: Optional[dict[str, str]] = None,
        selector: Optional[dict[str, str]] = None,
        creation_timestamp: Optional[str] = None,
        observed_at: Optional[str] = None,
    ) -> None:
        self.name = name
        self.namespace = namespace
        self.uid = uid or name
        self.desired_replicas = max(0, desired_replicas)
        self.replicas = max(0, replicas)
        self.ready_replicas = max(0, ready_replicas)
        self.available_replicas = max(0, available_replicas)
        self.updated_replicas = max(0, updated_replicas)
        self.unavailable_replicas = max(0, unavailable_replicas)
        self.generation = max(1, generation)
        self.observed_generation = max(0, observed_generation)
        self.conditions = conditions if conditions is not None else {}
        self.labels = labels if labels is not None else {}
        self.selector = selector if selector is not None else {}
        self.creation_timestamp = creation_timestamp
        self.observed_at = observed_at or datetime.now(timezone.utc).isoformat()

        (
            self.status,
            self.is_healthy,
            self.rollout_in_progress,
            self.anomaly_reason,
            self.anomaly_message,
        ) = self._evaluate_health()

    def _evaluate_health(self) -> tuple[str, bool, bool, Optional[str], Optional[str]]:
        # 1. Intentional scale-to-zero (spec.replicas == 0) is healthy / ScaledToZero, NOT an error!
        if self.desired_replicas == 0:
            return ("ScaledToZero", True, False, None, None)

        prog_cond = self.conditions.get("Progressing") or {}
        avail_cond = self.conditions.get("Available") or {}
        rep_fail_cond = self.conditions.get("ReplicaFailure") or {}

        # 2. Check rollout deadline failure (ProgressDeadlineExceeded)
        if (
            prog_cond.get("status") == "False"
            and prog_cond.get("reason") == "ProgressDeadlineExceeded"
        ):
            msg = prog_cond.get("message") or (
                f"Deployment '{self.namespace}/{self.name}' exceeded its progress deadline "
                f"(ready={self.ready_replicas}/{self.desired_replicas}, available={self.available_replicas}/{self.desired_replicas})."
            )
            return ("ProgressDeadlineExceeded", False, False, "ProgressDeadlineExceeded", msg)

        # 3. Check ReplicaFailure condition
        if rep_fail_cond.get("status") == "True":
            msg = rep_fail_cond.get("message") or (
                f"Deployment '{self.namespace}/{self.name}' reported ReplicaFailure."
            )
            return ("ReplicaFailure", False, False, "ReplicaFailure", msg)

        # 4. Check generation lag (controller has not yet observed latest spec generation)
        if self.observed_generation < self.generation:
            has_min_avail = (
                self.ready_replicas >= self.desired_replicas
                and self.available_replicas >= self.desired_replicas
            )
            if has_min_avail:
                return ("Progressing", True, True, None, None)
            msg = (
                f"Deployment '{self.namespace}/{self.name}' rollout in progress with insufficient replicas "
                f"(observed_generation={self.observed_generation}<{self.generation}, "
                f"ready={self.ready_replicas}/{self.desired_replicas}, available={self.available_replicas}/{self.desired_replicas})."
            )
            return ("Progressing", False, True, "MinimumReplicasUnavailable", msg)

        # 5. Check replica mismatch / unavailable replicas
        if (
            self.ready_replicas < self.desired_replicas
            or self.available_replicas < self.desired_replicas
            or self.unavailable_replicas > 0
            or avail_cond.get("status") == "False"
        ):
            msg = avail_cond.get("message") or (
                f"Deployment '{self.namespace}/{self.name}' has insufficient available replicas "
                f"(desired={self.desired_replicas}, ready={self.ready_replicas}, "
                f"available={self.available_replicas}, unavailable={self.unavailable_replicas})."
            )
            return ("Degraded", False, False, "MinimumReplicasUnavailable", msg)

        # 6. Check if updated_replicas < desired_replicas during active rolling update
        if self.updated_replicas < self.desired_replicas:
            return ("Progressing", True, True, None, None)

        return ("Healthy", True, False, None, None)

    def to_detail_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "namespace": self.namespace,
            "kubernetes_uid": self.uid,
            "status": self.status,
            "is_healthy": self.is_healthy,
            "rollout_in_progress": self.rollout_in_progress,
            "desired_replicas": self.desired_replicas,
            "replicas": self.replicas,
            "ready_replicas": self.ready_replicas,
            "available_replicas": self.available_replicas,
            "updated_replicas": self.updated_replicas,
            "unavailable_replicas": self.unavailable_replicas,
            "generation": self.generation,
            "observed_generation": self.observed_generation,
            "conditions": self.conditions,
            "anomaly_reason": self.anomaly_reason,
            "anomaly_message": self.anomaly_message,
            "labels": self.labels,
            "selector": self.selector,
            "creation_timestamp": self.creation_timestamp,
            "observed_at": self.observed_at,
        }


class DeploymentsCollector:
    """Queries AppsV1Api for deployment replica statuses, rollout conditions, and anomalies."""

    def __init__(self, apps_v1: Optional[client.AppsV1Api]) -> None:
        self.apps_v1 = apps_v1
        self.last_collection_status: str = "OK"
        self.last_error: Optional[str] = None
        self.active_anomalies: dict[str, str] = {}
        self.known_deployments: dict[str, tuple[str, str]] = {}

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

    def _parse_deployment(self, dep: Any, observed_at: str) -> Optional[DeploymentSummary]:
        metadata = getattr(dep, "metadata", None)
        if not metadata or not _opt_str(getattr(metadata, "name", None)):
            return None

        name = str(metadata.name)
        ns = _opt_str(getattr(metadata, "namespace", None)) or "default"
        uid = _opt_str(getattr(metadata, "uid", None)) or f"{ns}/{name}"
        generation = _opt_int(getattr(metadata, "generation", None), default=1)
        raw_labels = getattr(metadata, "labels", None)
        labels = dict(raw_labels) if isinstance(raw_labels, dict) else {}
        creation_ts = _to_iso(getattr(metadata, "creation_timestamp", None))

        spec = getattr(dep, "spec", None)
        raw_desired = getattr(spec, "replicas", None) if spec is not None else None
        # Note: spec.replicas == 0 is valid (scale-to-zero); default to 1 only if None
        desired_replicas = _opt_int(raw_desired, default=1) if raw_desired is not None else 1

        selector_obj = getattr(spec, "selector", None) if spec is not None else None
        raw_match_labels = getattr(selector_obj, "match_labels", None) if selector_obj is not None else None
        selector = dict(raw_match_labels) if isinstance(raw_match_labels, dict) else {}

        status_obj = getattr(dep, "status", None)
        if status_obj is None:
            replicas = 0
            ready_replicas = 0
            available_replicas = 0
            updated_replicas = 0
            unavailable_replicas = 0
            observed_generation = generation
            raw_conditions = []
        else:
            replicas = _opt_int(getattr(status_obj, "replicas", None), default=0)
            ready_replicas = _opt_int(getattr(status_obj, "ready_replicas", None), default=0)
            available_replicas = _opt_int(getattr(status_obj, "available_replicas", None), default=0)
            updated_replicas = _opt_int(getattr(status_obj, "updated_replicas", None), default=0)
            unavailable_replicas = _opt_int(getattr(status_obj, "unavailable_replicas", None), default=0)
            obs_gen_raw = getattr(status_obj, "observed_generation", None)
            observed_generation = _opt_int(obs_gen_raw, default=generation) if obs_gen_raw is not None else generation
            raw_conditions = getattr(status_obj, "conditions", None) or []

        conditions_map: dict[str, dict[str, Optional[str]]] = {}
        for cond in raw_conditions:
            c_type = _opt_str(getattr(cond, "type", None))
            if not c_type:
                continue
            conditions_map[c_type] = {
                "status": _opt_str(getattr(cond, "status", None)) or "Unknown",
                "reason": _opt_str(getattr(cond, "reason", None)),
                "message": _opt_str(getattr(cond, "message", None)),
            }

        return DeploymentSummary(
            name=name,
            namespace=ns,
            uid=uid,
            desired_replicas=desired_replicas,
            replicas=replicas,
            ready_replicas=ready_replicas,
            available_replicas=available_replicas,
            updated_replicas=updated_replicas,
            unavailable_replicas=unavailable_replicas,
            generation=generation,
            observed_generation=observed_generation,
            conditions=conditions_map,
            labels=labels,
            selector=selector,
            creation_timestamp=creation_ts,
            observed_at=observed_at,
        )

    def list_deployments(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[DeploymentSummary]:
        """Return list of DeploymentSummary objects from cluster API."""
        if not self.apps_v1:
            self.last_collection_status = "OFFLINE"
            self.last_error = "Kubernetes AppsV1Api is not initialized"
            return []

        results: list[DeploymentSummary] = []
        observed_at = datetime.now(timezone.utc).isoformat()
        try:
            if monitor_all or not namespace:
                deps = self.apps_v1.list_deployment_for_all_namespaces()
            else:
                deps = self.apps_v1.list_namespaced_deployment(namespace=namespace)

            self.last_collection_status = "OK"
            self.last_error = None
            for dep in getattr(deps, "items", None) or []:
                parsed = self._parse_deployment(dep, observed_at)
                if parsed:
                    results.append(parsed)
        except Exception as err:
            self._record_api_error(err, "list_deployments")
            return []

        return results

    def list_deployments_detail(
        self, namespace: Optional[str] = None, monitor_all: bool = True
    ) -> list[dict[str, Any]]:
        """Return detailed deployment status dictionaries for cluster inventory sync."""
        deps = self.list_deployments(namespace=namespace, monitor_all=monitor_all)
        return [d.to_detail_dict() for d in deps]

    def get_replicas_map(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> dict[str, int]:
        """Return mapping of deployment name -> desired replica count (preserving 0 when scaled to zero)."""
        deps = self.list_deployments(namespace=namespace, monitor_all=monitor_all)
        return {d.name: d.desired_replicas for d in deps}

    def detect_deployment_anomalies(
        self, namespace: Optional[str] = None, monitor_all: bool = True
    ) -> list[AgentK8sEventData]:
        """Detect Deployment rollout failure, replica unavailability, and recovery transitions."""
        deps = self.list_deployments(namespace=namespace, monitor_all=monitor_all)
        if self.last_collection_status != "OK":
            return []

        events: list[AgentK8sEventData] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        seen_uids: set[str] = set()

        for dep in deps:
            uid = dep.uid or f"{dep.namespace}/{dep.name}"
            seen_uids.add(uid)
            self.known_deployments[uid] = (dep.namespace, dep.name)

            if not dep.is_healthy and dep.anomaly_reason:
                prev_reason = self.active_anomalies.get(uid)
                if prev_reason != dep.anomaly_reason:
                    self.active_anomalies[uid] = dep.anomaly_reason
                    events.append(
                        AgentK8sEventData(
                            service_id=dep.name,
                            pod_id=uid,
                            pod_name=dep.name,
                            status=dep.status,
                            timestamp=now_iso,
                            event=K8sEventDetail(
                                type="Warning",
                                reason=dep.anomaly_reason,
                                message=dep.anomaly_message
                                or f"Deployment '{dep.namespace}/{dep.name}' is {dep.status}.",
                            ),
                        )
                    )
            elif dep.is_healthy and uid in self.active_anomalies:
                prev_reason = self.active_anomalies.pop(uid)
                events.append(
                    AgentK8sEventData(
                        service_id=dep.name,
                        pod_id=uid,
                        pod_name=dep.name,
                        status="Running" if dep.desired_replicas > 0 else "ScaledToZero",
                        timestamp=now_iso,
                        event=K8sEventDetail(
                            type="Normal",
                            reason="DeploymentRecovered",
                            message=(
                                f"Deployment '{dep.namespace}/{dep.name}' recovered from {prev_reason} "
                                f"to {dep.status} (ready={dep.ready_replicas}/{dep.desired_replicas}, "
                                f"available={dep.available_replicas}/{dep.desired_replicas})."
                            ),
                        ),
                    )
                )

        # Clean up deleted deployments from cache
        for stale_uid in list(self.known_deployments.keys()):
            if stale_uid not in seen_uids:
                self.known_deployments.pop(stale_uid, None)
                self.active_anomalies.pop(stale_uid, None)

        return events
