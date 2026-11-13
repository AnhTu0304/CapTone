from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any

from app.rca.models import EvidenceAttribution, EvidenceItem, EvidenceSource, EvidenceType
from app.schemas.kubernetes import KubernetesAnalysisResult, KubernetesData, PodInfo
from app.schemas.logs import LogAnalysisResult
from app.schemas.metrics import MetricsAnalysisResult
from app.schemas.rca import RCARequest


def _is_pod_belonging_to_workload(
    pod_name: str,
    pod_info: PodInfo | None,
    target_workload: str,
) -> bool:
    """Strictly checks whether a Pod belongs to target workload using controller hierarchy or strict prefix.
    Prevents prefix collisions (e.g., 'ecommerce-store-app' vs 'ecommerce-store')."""
    if not target_workload or not pod_name:
        return False
    tw = target_workload.lower()
    pname = pod_name.lower()

    if pod_info and pod_info.controller:
        c = pod_info.controller
        if c.workload_name and c.workload_name.lower() == tw:
            return True
        if c.owner_name:
            owner = c.owner_name.lower()
            if c.owner_kind == "ReplicaSet":
                if owner.rsplit("-", 1)[0] == tw:
                    return True
            elif c.owner_kind in ("Deployment", "StatefulSet", "DaemonSet"):
                if owner == tw:
                    return True

    # Fallback to pod naming convention with strict segment count check
    if pname == tw:
        return True
    if pname.startswith(f"{tw}-"):
        rem = pname[len(tw) + 1 :]
        parts = rem.split("-")
        # Deployment pod: <workload>-<rs-hash>-<pod-hash> (2 parts)
        # StatefulSet pod: <workload>-<ordinal> (1 part, numeric)
        if len(parts) == 1 and parts[0].isdigit():
            return True
        if len(parts) == 2 and all(len(p) >= 3 and p.isalnum() for p in parts):
            return True
        if len(parts) == 1 and parts[0].isalnum():
            return True
    return False


def _resolve_event_identity(
    event: Any,
    target_workload: str,
    target_res: str,
    target_uid: str | None,
    all_pods_map: dict[str, PodInfo],
    known_dependencies: list[str],
) -> tuple[str | None, str | None, EvidenceAttribution, str | None, bool]:
    """Extracts true pod identity, UID, attribution status, timestamp, and structured flag from event.
    Prioritizes structured involvedObject metadata over unstructured message text."""
    ev_text = ""
    event_timestamp: str | None = None
    extracted_pod: str | None = None
    extracted_uid: str | None = None
    has_structured_metadata = False

    if isinstance(event, dict):
        ev_text = str(event.get("message") or "")
        event_timestamp = event.get("timestamp") or event.get("first_timestamp") or event.get("last_timestamp")
        involved = event.get("involved_object") or event.get("regarding") or {}
        if isinstance(involved, dict):
            raw_name = involved.get("name")
            raw_uid = involved.get("uid")
            if raw_name:
                extracted_pod = str(raw_name)
                has_structured_metadata = True
            if raw_uid:
                extracted_uid = str(raw_uid)
                has_structured_metadata = True
    else:
        ev_text = str(event)
        # Parse ISO timestamp in bracket if present
        ts_match = re.search(r"\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)\]", ev_text)
        if ts_match:
            event_timestamp = ts_match.group(1)

    # 1. Structured metadata handling
    if has_structured_metadata:
        if extracted_pod:
            p_info = all_pods_map.get(extracted_pod)
            if _is_pod_belonging_to_workload(extracted_pod, p_info, target_workload):
                # H-01 / A03: If event has structured metadata for pod but lacks UID, do NOT forge it! Tag as UNATTRIBUTED.
                if not extracted_uid:
                    return extracted_pod, None, EvidenceAttribution.UNATTRIBUTED, event_timestamp, True
                return extracted_pod, extracted_uid, EvidenceAttribution.DIRECT, event_timestamp, True

            is_dep = any(dep in extracted_pod.lower() for dep in known_dependencies) or (
                p_info and p_info.mongodb_cluster_health is not None
            )
            if is_dep:
                return extracted_pod, extracted_uid, EvidenceAttribution.DEPENDENCY, event_timestamp, True
            return extracted_pod, extracted_uid, EvidenceAttribution.CONTEXTUAL, event_timestamp, True

        return None, None, EvidenceAttribution.UNATTRIBUTED, event_timestamp, True

    # 2. Unstructured string event handling
    pod_match = re.search(r"(?:Pod:\s*|in pod ['\"]?|pod ['\"]?)([a-z0-9][a-z0-9\-\.]*[a-z0-9])", ev_text, re.I)
    if pod_match:
        extracted_pod = pod_match.group(1)
        p_info = all_pods_map.get(extracted_pod)
        is_dep = any(dep in extracted_pod.lower() for dep in known_dependencies) or (
            p_info and p_info.mongodb_cluster_health is not None
        )
        if is_dep:
            # DEF-01: Foreign dependency pod (e.g. mongodb-0) in event string is isolated to DEPENDENCY
            return extracted_pod, (p_info.pod_id if p_info else None), EvidenceAttribution.DEPENDENCY, event_timestamp, False

        if _is_pod_belonging_to_workload(extracted_pod, p_info, target_workload):
            ext_uid = (p_info.pod_id if p_info else None) or target_uid
            return extracted_pod, ext_uid, EvidenceAttribution.DIRECT, event_timestamp, False

        return extracted_pod, None, EvidenceAttribution.CONTEXTUAL, event_timestamp, False

    # Check if unstructured event text explicitly mentions dependency
    if any(dep in ev_text.lower() for dep in known_dependencies):
        return None, None, EvidenceAttribution.DEPENDENCY, event_timestamp, False

    # Unstructured workload event for target (e.g. "Readiness probe failed", "ImagePullBackOff", "FailedScheduling")
    target_pod = target_res.replace("pod/", "") if target_res else target_workload
    return target_pod, target_uid, EvidenceAttribution.DIRECT, event_timestamp, False


class EvidenceCollector:
    """Collects structured EvidenceItems from raw Metrics, Logs, Kubernetes Data, and Node state."""

    OOM_LOG_PATTERN = re.compile(r"oomkilled|out of memory|outofmemory|\boom\b|cannot allocate memory", re.I)
    DISK_LOG_PATTERN = re.compile(r"no space left|disk full", re.I)
    CONN_LOG_PATTERN = re.compile(
        r"connection refused|connection reset|dependency.*(fail|timeout)|getaddrinfo ENOTFOUND|not ready yet|ECONNREFUSED|ETIMEDOUT|ConnectionRefused",
        re.I,
    )
    TIMEOUT_LOG_PATTERN = re.compile(r"timeout|timed out|context deadline exceeded", re.I)
    CRASH_LOG_PATTERN = re.compile(r"crash|fatal|panic|segmentation fault", re.I)

    def collect(
        self,
        payload: RCARequest,
        metrics_result: MetricsAnalysisResult | None = None,
        log_result: LogAnalysisResult | None = None,
        kubernetes_result: KubernetesAnalysisResult | None = None,
        kubernetes_raw: KubernetesData | None = None,
    ) -> list[EvidenceItem]:
        evidences: list[EvidenceItem] = []
        target_workload = (
            (kubernetes_raw and kubernetes_raw.workload_name)
            or payload.service_id
            or (payload.suspected_pod_name or "").split("-")[0]
        )

        k_data = kubernetes_raw or payload.kubernetes
        all_pods: list[PodInfo] = getattr(k_data, "all_pods", []) or []
        all_pods_map: dict[str, PodInfo] = {p.pod_name: p for p in all_pods if p.pod_name}
        known_dependencies = ["mongo", "mongodb", "redis", "postgres", "mysql", "database", "elasticsearch", "kafka"]

        target_uid = payload.pod_id or (kubernetes_result and kubernetes_result.target_pod_id)
        if not target_uid and all_pods:
            matching_pods = [
                p for p in all_pods
                if _is_pod_belonging_to_workload(p.pod_name, p, target_workload) and p.pod_id
            ]
            if matching_pods:
                target_uid = matching_pods[0].pod_id

        target_res = f"pod/{payload.suspected_pod_name or (kubernetes_result and kubernetes_result.target_pod_name) or target_uid or payload.service_id}"

        # ----------------------------------------------------
        # 1. METRICS EVIDENCE
        # ----------------------------------------------------
        m = payload.metrics
        if m:
            if m.ram >= 90.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.HIGH_RAM_USAGE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"ram_pct": m.ram},
                    description=f"Mức sử dụng RAM ở ngưỡng rất cao ({m.ram:.1f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id, "namespace": payload.namespace},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            elif m.ram < 80.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.NORMAL_RAM_USAGE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"ram_pct": m.ram},
                    description=f"Mức sử dụng RAM trong giới hạn an toàn ({m.ram:.1f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id, "namespace": payload.namespace},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

            if payload.metric_sequence and len(payload.metric_sequence) > 1:
                first = payload.metric_sequence[0]
                if m.ram >= 90.0 and m.ram - first.ram >= 15.0:
                    evidences.append(EvidenceItem(
                        source=EvidenceSource.METRICS,
                        evidence_type=EvidenceType.RAM_STEEP_INCREASE,
                        target_resource=target_res,
                        target_uid=target_uid,
                        timestamp=None,
                        value={"start_ram": first.ram, "end_ram": m.ram, "delta": m.ram - first.ram},
                        description=f"RAM tăng vọt trong chuỗi viễn trắc (tăng {m.ram - first.ram:.1f}% từ {first.ram:.1f}% lên {m.ram:.1f}%)",
                        reliability=0.90,
                        metadata={"cluster_id": payload.cluster_id},
                        attribution_status=EvidenceAttribution.DIRECT,
                        resource_kind="Pod",
                        resource_name=payload.suspected_pod_name or payload.service_id,
                    ))

            if m.cpu >= 90.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.HIGH_CPU_USAGE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"cpu_pct": m.cpu},
                    description=f"Mức sử dụng CPU chạm ngưỡng bão hòa ({m.cpu:.1f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            elif m.cpu < 70.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.NORMAL_CPU_USAGE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"cpu_pct": m.cpu},
                    description=f"Mức sử dụng CPU ở mức bình thường ({m.cpu:.1f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

            if m.latency >= 650.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.HIGH_LATENCY,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"latency_ms": m.latency},
                    description=f"Độ trễ xử lý tăng cao ({m.latency:.1f}ms)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            elif m.latency < 500.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.NORMAL_LATENCY,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"latency_ms": m.latency},
                    description=f"Độ trễ xử lý ở ngưỡng an toàn ({m.latency:.1f}ms)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

            if m.http_5xx_rate >= 5.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.HIGH_HTTP_5XX_RATE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"http_5xx_rate": m.http_5xx_rate},
                    description=f"Tỷ lệ lỗi HTTP 5xx tăng cao ({m.http_5xx_rate:.2f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

            if m.request_rate >= 900.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.HIGH_REQUEST_RATE,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"request_rate": m.request_rate},
                    description=f"Lưu lượng yêu cầu cao đột biến ({m.request_rate:.1f} rps)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

            if m.disk >= 90.0:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.METRICS,
                    evidence_type=EvidenceType.STORAGE_CAPACITY_EXHAUSTED,
                    target_resource=target_res,
                    target_uid=target_uid,
                    timestamp=None,
                    value={"disk_pct": m.disk},
                    description=f"Dung lượng lưu trữ gần cạn kiệt ({m.disk:.1f}%)",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

        # ----------------------------------------------------
        # 2. KUBERNETES POD TERMINATION & STATUS EVIDENCE
        # ----------------------------------------------------
        for p in all_pods:
            p_res = f"pod/{p.pod_name}"
            p_uid = p.pod_id
            is_target_pod = _is_pod_belonging_to_workload(p.pod_name, p, target_workload)
            is_dep_pod = any(dep in p.pod_name.lower() for dep in known_dependencies)
            attr = (
                EvidenceAttribution.DIRECT
                if is_target_pod
                else (EvidenceAttribution.DEPENDENCY if is_dep_pod else EvidenceAttribution.CONTEXTUAL)
            )

            if p.restart_count >= 3:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.KUBERNETES_EVENT,
                    evidence_type=EvidenceType.POD_RESTART_COUNT_HIGH,
                    target_resource=p_res,
                    target_uid=p_uid,
                    timestamp=None,
                    value={"restart_count": p.restart_count},
                    description=f"Pod '{p.pod_name}' khởi động lại nhiều lần ({p.restart_count} lần)",
                    reliability=0.90,
                    metadata={"cluster_id": payload.cluster_id, "node_name": p.node_name},
                    attribution_status=attr,
                    resource_kind="Pod",
                    resource_name=p.pod_name,
                ))

            term = p.termination
            if term:
                term_time = term.finished_at
                if term.reason == "OOMKilled":
                    evidences.append(EvidenceItem(
                        source=EvidenceSource.CONTAINER_TERMINATION,
                        evidence_type=EvidenceType.OOM_KILLED,
                        target_resource=p_res,
                        target_uid=p_uid,
                        timestamp=term_time,
                        value={"reason": "OOMKilled", "exit_code": term.last_exit_code, "container": term.container_name},
                        description=f"Container trên Pod '{p.pod_name}' bị Linux Kernel OOM-Killer tiêu diệt (OOMKilled, exitCode: {term.last_exit_code})",
                        reliability=1.0,
                        metadata={"cluster_id": payload.cluster_id, "container_name": term.container_name},
                        attribution_status=attr,
                        resource_kind="Pod",
                        resource_name=p.pod_name,
                    ))
                elif term.last_exit_code == 137:
                    evidences.append(EvidenceItem(
                        source=EvidenceSource.CONTAINER_TERMINATION,
                        evidence_type=EvidenceType.EXIT_CODE_137_NON_OOM,
                        target_resource=p_res,
                        target_uid=p_uid,
                        timestamp=term_time,
                        value={"reason": term.reason, "exit_code": 137, "container": term.container_name},
                        description=f"Tiến trình trên Pod '{p.pod_name}' kết thúc với exitCode 137 (SIGKILL/Timeout) nhưng không có lý do OOMKilled ({term.reason or 'Unspecified'})",
                        reliability=0.90,
                        metadata={"cluster_id": payload.cluster_id, "container_name": term.container_name},
                        attribution_status=attr,
                        resource_kind="Pod",
                        resource_name=p.pod_name,
                    ))
                elif term.reason == "Completed" or term.last_exit_code == 0:
                    evidences.append(EvidenceItem(
                        source=EvidenceSource.CONTAINER_TERMINATION,
                        evidence_type=EvidenceType.CONTAINER_NORMAL_TERMINATION,
                        target_resource=p_res,
                        target_uid=p_uid,
                        timestamp=term_time,
                        value={"reason": "Completed", "exit_code": 0},
                        description=f"Container trên Pod '{p.pod_name}' kết thúc bình thường (exitCode: 0, reason: Completed)",
                        reliability=0.95,
                        metadata={"cluster_id": payload.cluster_id},
                        attribution_status=attr,
                        resource_kind="Pod",
                        resource_name=p.pod_name,
                    ))

        # ----------------------------------------------------
        # 3. KUBERNETES EVENTS EVIDENCE (STRICT ISOLATION)
        # ----------------------------------------------------
        combined_events = list(dict.fromkeys([
            *(k_data.events or []),
            *(payload.kubernetes_events or []),
        ]))

        for ev in combined_events:
            real_pod, real_uid, attribution, ev_ts, has_struct = _resolve_event_identity(
                ev, target_workload, target_res, target_uid, all_pods_map, known_dependencies
            )
            ev_str = ev if isinstance(ev, str) else str(ev.get("message", ""))
            ev_lower = ev_str.lower()
            ev_res = f"pod/{real_pod}" if real_pod else target_res
            ev_uid = real_uid

            ev_mapping = [
                ("oomkilled", EvidenceType.OOM_KILLED, "Kubernetes Event xác nhận container bị tiêu diệt do tràn bộ nhớ (OOMKilled)", 1.0),
                ("liveness probe failed", EvidenceType.LIVENESS_PROBE_FAILED, "Kiểm tra tính sống còn (Liveness probe) thất bại", 0.95),
                ("readiness probe failed", EvidenceType.READINESS_PROBE_FAILED, "Kiểm tra tính sẵn sàng (Readiness probe) thất bại", 0.95),
                ("crashloopbackoff", EvidenceType.CRASH_LOOP_BACKOFF, "Pod rơi vào vòng lặp sập liên tục (CrashLoopBackOff)", 0.95),
                ("imagepullbackoff", EvidenceType.IMAGE_PULL_BACKOFF, "Lỗi tải container image (ImagePullBackOff)", 0.95),
                ("failedscheduling", EvidenceType.FAILED_SCHEDULING, "Lỗi lập lịch điều phối Pod (FailedScheduling)", 0.95),
            ]

            for keyword, ev_type, desc_prefix, rel in ev_mapping:
                if keyword in ev_lower:
                    evidences.append(EvidenceItem(
                        source=EvidenceSource.KUBERNETES_EVENT,
                        evidence_type=ev_type,
                        target_resource=ev_res,
                        target_uid=ev_uid,
                        timestamp=ev_ts,
                        value={"event_text": ev_str},
                        description=f"{desc_prefix}: '{ev_str}'",
                        reliability=rel,
                        metadata={
                            "cluster_id": payload.cluster_id,
                            "raw_event": ev,
                            "pod_name": real_pod,
                            "has_structured_metadata": has_struct,
                        },
                        attribution_status=attribution,
                        resource_kind="Pod" if real_pod else "Event",
                        resource_name=real_pod or "unattributed-event",
                    ))

        # ----------------------------------------------------
        # 4. NODE CONDITIONS EVIDENCE
        # ----------------------------------------------------
        nodes = getattr(k_data, "nodes", []) or []
        for n in nodes:
            node_res = f"node/{n.node_name}"
            node_uid = n.node_id
            conds = n.conditions if isinstance(n.conditions, dict) else n.conditions.model_dump()
            is_mem_pressure = bool(conds.get("MemoryPressure")) or (n.ram_usage_pct is not None and n.ram_usage_pct >= 90.0)

            if is_mem_pressure:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.NODE_CONDITION,
                    evidence_type=EvidenceType.NODE_MEMORY_PRESSURE,
                    target_resource=node_res,
                    target_uid=node_uid,
                    timestamp=None,
                    value={"MemoryPressure": True, "ram_usage_pct": n.ram_usage_pct},
                    description=f"Host Node '{n.node_name}' đang ghi nhận MemoryPressure (áp lực bộ nhớ)",
                    reliability=0.95,
                    metadata={"cluster_id": payload.cluster_id, "node_name": n.node_name},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Node",
                    resource_name=n.node_name,
                ))
            else:
                evidences.append(EvidenceItem(
                    source=EvidenceSource.NODE_CONDITION,
                    evidence_type=EvidenceType.NODE_NO_MEMORY_PRESSURE,
                    target_resource=node_res,
                    target_uid=node_uid,
                    timestamp=None,
                    value={"MemoryPressure": False, "ram_usage_pct": n.ram_usage_pct},
                    description=f"Host Node '{n.node_name}' không có MemoryPressure",
                    reliability=0.95,
                    metadata={"cluster_id": payload.cluster_id, "node_name": n.node_name},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Node",
                    resource_name=n.node_name,
                ))

            if bool(conds.get("DiskPressure")):
                evidences.append(EvidenceItem(
                    source=EvidenceSource.NODE_CONDITION,
                    evidence_type=EvidenceType.NODE_DISK_PRESSURE,
                    target_resource=node_res,
                    target_uid=node_uid,
                    timestamp=None,
                    value={"DiskPressure": True},
                    description=f"Host Node '{n.node_name}' đang ghi nhận DiskPressure",
                    reliability=0.95,
                    metadata={"cluster_id": payload.cluster_id, "node_name": n.node_name},
                    attribution_status=EvidenceAttribution.DIRECT,
                    resource_kind="Node",
                    resource_name=n.node_name,
                ))

        # ----------------------------------------------------
        # 5. LOG EVIDENCE (STRICT ATTRIBUTION)
        # ----------------------------------------------------
        raw_logs = payload.logs or []
        for line in raw_logs[:100]:
            # Extract pod UID from line prefix if format is [timestamp] [level] [pod_uid] message
            log_uid_match = re.search(r"\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]", line)
            extracted_log_uid = log_uid_match.group(1) if log_uid_match else None

            # Detect whether log explicitly mentions dependency or belongs to dependency UID
            is_dep_log = False
            log_attr = EvidenceAttribution.DIRECT
            log_res = target_res
            log_target_uid = target_uid

            if extracted_log_uid:
                if target_uid and extracted_log_uid != target_uid:
                    # Log carries a different pod UID
                    is_dep_uid = any(
                        p.pod_id == extracted_log_uid and any(d in p.pod_name.lower() for d in known_dependencies)
                        for p in all_pods
                    )
                    log_attr = EvidenceAttribution.DEPENDENCY if is_dep_uid else EvidenceAttribution.CONTEXTUAL
                    log_target_uid = extracted_log_uid
                    is_dep_log = True

            if any(d in line.lower() for d in ["mongodb", "mongo-service", "redis-service", "postgres"]):
                if not is_dep_log:
                    # Log from target mentioning dependency failure
                    log_attr = EvidenceAttribution.DEPENDENCY
                    is_dep_log = True

            if self.OOM_LOG_PATTERN.search(line):
                evidences.append(EvidenceItem(
                    source=EvidenceSource.LOGS,
                    evidence_type=EvidenceType.LOG_OOM_PATTERN,
                    target_resource=log_res,
                    target_uid=log_target_uid,
                    timestamp=None,
                    value={"log_snippet": line[:500]},
                    description=f"Nhật ký container ghi nhận lỗi tràn bộ nhớ: '{line[:120]}'",
                    reliability=0.90,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=log_attr,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            if self.DISK_LOG_PATTERN.search(line):
                evidences.append(EvidenceItem(
                    source=EvidenceSource.LOGS,
                    evidence_type=EvidenceType.LOG_DISK_FULL,
                    target_resource=log_res,
                    target_uid=log_target_uid,
                    timestamp=None,
                    value={"log_snippet": line[:500]},
                    description=f"Nhật ký container ghi nhận đầy ổ đĩa: '{line[:120]}'",
                    reliability=0.90,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=log_attr,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            if self.CONN_LOG_PATTERN.search(line):
                evidences.append(EvidenceItem(
                    source=EvidenceSource.LOGS,
                    evidence_type=EvidenceType.LOG_CONNECTION_FAILURE,
                    target_resource=log_res,
                    target_uid=log_target_uid,
                    timestamp=None,
                    value={"log_snippet": line[:500]},
                    description=f"Nhật ký ghi nhận lỗi kết nối phụ thuộc: '{line[:120]}'",
                    reliability=0.85,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=EvidenceAttribution.DEPENDENCY,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            if self.TIMEOUT_LOG_PATTERN.search(line):
                evidences.append(EvidenceItem(
                    source=EvidenceSource.LOGS,
                    evidence_type=EvidenceType.LOG_TIMEOUT,
                    target_resource=log_res,
                    target_uid=log_target_uid,
                    timestamp=None,
                    value={"log_snippet": line[:500]},
                    description=f"Nhật ký ghi nhận timeout yêu cầu: '{line[:120]}'",
                    reliability=0.80,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=log_attr,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))
            if self.CRASH_LOG_PATTERN.search(line):
                # A12 & DEF-01: Crash logs belonging to dependency must NOT be direct evidence for target
                evidences.append(EvidenceItem(
                    source=EvidenceSource.LOGS,
                    evidence_type=EvidenceType.LOG_CRASH_PANIC,
                    target_resource=log_res,
                    target_uid=log_target_uid,
                    timestamp=None,
                    value={"log_snippet": line[:500]},
                    description=f"Nhật ký ghi nhận ứng dụng bị sập nghiêm trọng: '{line[:120]}'",
                    reliability=0.90,
                    metadata={"cluster_id": payload.cluster_id},
                    attribution_status=log_attr,
                    resource_kind="Pod",
                    resource_name=payload.suspected_pod_name or payload.service_id,
                ))

        return evidences
