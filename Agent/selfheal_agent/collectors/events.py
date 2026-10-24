"""Collector for Kubernetes cluster warning events and pod lifecycle anomalies."""

from datetime import datetime, timezone
import logging
from typing import Literal, Optional
from kubernetes import client

from selfheal_agent.collectors.pods import extract_service_id
from selfheal_agent.telemetry.schemas import AgentK8sEventData, AgentK8sEventDetail

logger = logging.getLogger("selfheal_agent.collectors.events")


class EventsCollector:
    """Collects and deduplicates Kubernetes cluster events."""

    def __init__(self, core_v1: Optional[client.CoreV1Api]) -> None:
        self.core_v1 = core_v1
        self._seen_events: set[str] = set()

    def collect_events(
        self, namespace: Optional[str] = None, monitor_all: bool = False
    ) -> list[AgentK8sEventData]:
        if not self.core_v1:
            return []

        try:
            if monitor_all or not namespace:
                raw_events = self.core_v1.list_event_for_all_namespaces().items
            else:
                raw_events = self.core_v1.list_namespaced_event(namespace=namespace).items
        except Exception as err:
            logger.error("Failed querying cluster events: %s", err)
            return []

        results: list[AgentK8sEventData] = []
        now_iso = datetime.now(timezone.utc).isoformat()

        for item in raw_events:
            metadata = getattr(item, "metadata", None)
            uid = getattr(metadata, "uid", None) or getattr(metadata, "name", "")
            if not uid or uid in self._seen_events:
                continue

            involved = getattr(item, "involved_object", None)
            kind = getattr(involved, "kind", "") if involved else ""
            inv_ns = getattr(involved, "namespace", "") or ""
            if monitor_all and inv_ns in {"kube-system", "kube-public", "kube-node-lease", "selfheal-system"}:
                continue
            if kind not in ("Pod", "Deployment"):
                continue

            pod_name = getattr(involved, "name", "unknown-pod")
            pod_uid = getattr(involved, "uid", None) or pod_name
            service_id = extract_service_id(pod_name)

            raw_type = getattr(item, "type", "Normal")
            event_type: Literal["Warning", "Normal"] = (
                "Warning" if raw_type == "Warning" else "Normal"
            )
            reason = getattr(item, "reason", "Unknown")
            raw_msg = getattr(item, "message", "") or ""

            # Infer workload health status
            lower_msg = raw_msg.lower()
            lower_reason = reason.lower()
            if "oom" in lower_msg or "oom" in lower_reason:
                status = "CrashLoopBackOff"
            elif "backoff" in lower_reason or "crash" in lower_reason:
                status = "CrashLoopBackOff"
            elif "failed" in lower_reason or "unhealthy" in lower_reason:
                status = "Degraded"
            else:
                status = "Running"

            last_ts = getattr(item, "last_timestamp", None)
            timestamp = (
                last_ts.isoformat()
                if last_ts and hasattr(last_ts, "isoformat")
                else now_iso
            )

            self._seen_events.add(uid)
            results.append(
                AgentK8sEventData(
                    service_id=service_id,
                    pod_id=pod_uid,
                    pod_name=pod_name,
                    status=status,
                    timestamp=timestamp,
                    event=AgentK8sEventDetail(
                        type=event_type,
                        reason=reason,
                        message=raw_msg[:1000],
                    ),
                )
            )

        # Evict cache if too large to prevent memory growth
        if len(self._seen_events) > 5000:
            self._seen_events.clear()

        return results
