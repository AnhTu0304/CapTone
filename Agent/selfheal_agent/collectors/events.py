"""Collector for Kubernetes Events with deduplication and accurate status classification."""

from datetime import datetime, timezone
import logging
from typing import Literal, Optional
from kubernetes import client
from kubernetes.client.rest import ApiException

from selfheal_agent.collectors.pods import EXCLUDED_NAMESPACES, extract_service_id
from selfheal_agent.telemetry.schemas import AgentK8sEventData, AgentK8sEventDetail

logger = logging.getLogger("selfheal_agent.collectors.events")


def _classify_event_status(reason: str, message: str, ev_type: str) -> str:
    """Classify Kubernetes Event into accurate workload/pod status."""
    lower_reason = (reason or "").lower()
    lower_msg = (message or "").lower()

    if (
        "imagepullbackoff" in lower_reason
        or "errimagepull" in lower_reason
        or "imagepullbackoff" in lower_msg
        or "errimagepull" in lower_msg
        or "pulling image" in lower_msg
        or "failed to pull image" in lower_msg
    ):
        return "ImagePullBackOff"

    if (
        "createcontainerconfigerror" in lower_reason
        or "createcontainerconfigerror" in lower_msg
        or "createcontainererror" in lower_reason
    ):
        return "CreateContainerConfigError"

    if "oom" in lower_msg or "oom" in lower_reason:
        return "OOMKilled"

    if (
        "crashloopbackoff" in lower_reason
        or "crashloopbackoff" in lower_msg
        or "backoff" in lower_reason
        or "crash" in lower_reason
        or "restarting failed container" in lower_msg
    ):
        return "CrashLoopBackOff"

    if "progressdeadlineexceeded" in lower_reason:
        return "ProgressDeadlineExceeded"

    if "notready" in lower_reason:
        return "NotReady"

    if "failed" in lower_reason or "unhealthy" in lower_reason:
        return "Degraded"

    return "Running"


class EventsCollector:
    """Collects and deduplicates Kubernetes cluster events."""

    MAX_SEEN_CACHE = 5000

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1
        self._seen_events: set[str] = set()
        self.last_collection_status: str = "OK"
        self.last_error: Optional[str] = None

    def collect_events(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[AgentK8sEventData]:
        """Collect new Kubernetes events from the cluster."""
        if not self.core_v1:
            self.last_collection_status = "OFFLINE"
            self.last_error = "Kubernetes CoreV1Api is not initialized"
            return []

        results: list[AgentK8sEventData] = []
        now_iso = datetime.now(timezone.utc).isoformat()
        try:
            if monitor_all or not namespace:
                raw_events = self.core_v1.list_event_for_all_namespaces().items
            else:
                raw_events = self.core_v1.list_namespaced_event(namespace=namespace).items

            self.last_collection_status = "OK"
            self.last_error = None

            for item in raw_events or []:
                metadata = getattr(item, "metadata", None)
                uid = getattr(metadata, "uid", None) or getattr(metadata, "name", "")
                if not isinstance(uid, str) or not uid or uid in self._seen_events:
                    continue

                involved = getattr(item, "involved_object", None)
                kind = getattr(involved, "kind", "") if involved else ""
                inv_ns = getattr(involved, "namespace", "") if involved else ""
                if isinstance(inv_ns, str) and monitor_all and inv_ns in EXCLUDED_NAMESPACES:
                    continue
                if kind not in ("Pod", "Node", "Deployment", "ReplicaSet", None, ""):
                    continue

                raw_pod_name = getattr(involved, "name", None) if involved else None
                pod_name = raw_pod_name if isinstance(raw_pod_name, str) and raw_pod_name else "unknown-pod"
                raw_pod_uid = getattr(involved, "uid", None) if involved else None
                pod_uid = raw_pod_uid if isinstance(raw_pod_uid, str) and raw_pod_uid else pod_name
                service_id = extract_service_id(pod_name)

                raw_type = getattr(item, "type", "Normal")
                event_type: Literal["Warning", "Normal"] = (
                    "Warning" if raw_type == "Warning" else "Normal"
                )
                raw_reason = getattr(item, "reason", None)
                reason = raw_reason if isinstance(raw_reason, str) and raw_reason else "Unknown"
                raw_msg_val = getattr(item, "message", None)
                raw_msg = raw_msg_val if isinstance(raw_msg_val, str) else ""

                status = _classify_event_status(reason, raw_msg, event_type)

                last_ts = getattr(item, "last_timestamp", None)
                timestamp = (
                    last_ts.isoformat()
                    if last_ts and hasattr(last_ts, "isoformat") and isinstance(last_ts.isoformat(), str)
                    else now_iso
                )

                self._seen_events.add(uid)
                results.append(
                    AgentK8sEventData(
                        service_id=service_id[:100],
                        pod_id=pod_uid[:255],
                        pod_name=pod_name[:255],
                        status=status,
                        timestamp=timestamp,
                        event=AgentK8sEventDetail(
                            type=event_type,
                            reason=reason[:100],
                            message=raw_msg[:10000],
                        ),
                    )
                )
        except ApiException as err:
            self.last_collection_status = "FORBIDDEN" if err.status in (401, 403) else "UNAVAILABLE"
            self.last_error = f"HTTP {err.status}: {err.reason}"
            logger.warning("K8s API error querying events (%s): %s", self.last_collection_status, self.last_error)
            return []
        except Exception as err:
            self.last_collection_status = "UNAVAILABLE"
            self.last_error = str(err)
            logger.error("Failed querying cluster events: %s", err)
            return []

        if len(self._seen_events) > self.MAX_SEEN_CACHE:
            self._seen_events.clear()

        return results
