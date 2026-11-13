from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from app.rca.models import (
    EvidenceAttribution,
    EvidenceItem,
    EvidenceSource,
    EvidenceType,
    ValidationIssue,
    ValidationResult,
)


class EvidenceValidator:
    """Validates EvidenceItems for identity, time window, staleness, missing data, and contradictions."""

    def validate(
        self,
        evidences: list[EvidenceItem],
        incident_context: dict[str, Any],
    ) -> ValidationResult:
        valid: list[EvidenceItem] = []
        rejected: list[EvidenceItem] = []
        conflicts: list[tuple[EvidenceItem, EvidenceItem, str]] = []
        issues: list[ValidationIssue] = []
        missing_data: list[str] = []
        dependency_evidences: list[EvidenceItem] = []
        unattributed_evidences: list[EvidenceItem] = []

        target_pod_uid = incident_context.get("target_uid") or incident_context.get("target_pod_uid")
        historical_uids = set(incident_context.get("historical_pod_uids") or [])
        expected_cluster_id = incident_context.get("cluster_id")
        window_start = self._parse_dt(incident_context.get("incident_window_start"))
        window_end = self._parse_dt(incident_context.get("incident_window_end"))

        # ----------------------------------------------------
        # 1. Missing Data Check
        # ----------------------------------------------------
        if not incident_context.get("has_metrics", True):
            missing_data.append("Metrics viễn trắc chưa được cung cấp")
        if not incident_context.get("has_logs", True):
            missing_data.append("Nhật ký logs ứng dụng chưa được cung cấp")
        if not incident_context.get("has_events", True):
            missing_data.append("Kubernetes events chưa được cung cấp")

        # ----------------------------------------------------
        # 2. Deduplication and Identity/Temporal Validation
        # ----------------------------------------------------
        seen_keys: set[str] = set()

        for ev in evidences:
            # A. Deduplication check
            ev_key = f"{ev.source}:{ev.evidence_type}:{ev.target_resource}:{str(ev.value)}"
            if ev_key in seen_keys:
                issues.append(ValidationIssue(
                    issue_type="DUPLICATE_EVIDENCE",
                    evidence_item=ev,
                    reason=f"Bằng chứng '{ev.evidence_type}' bị trùng lặp trên cùng tài nguyên",
                ))
                continue
            seen_keys.add(ev_key)

            # B. Attribution Routing (DEF-01 / DEF-04 Isolation)
            if ev.attribution_status == EvidenceAttribution.DEPENDENCY:
                dependency_evidences.append(ev)
                continue
            if ev.attribution_status == EvidenceAttribution.UNATTRIBUTED:
                unattributed_evidences.append(ev)
                continue

            # C. Cluster Identity Check
            ev_cluster = ev.metadata.get("cluster_id")
            if expected_cluster_id and ev_cluster and ev_cluster != expected_cluster_id:
                rejected.append(ev)
                issues.append(ValidationIssue(
                    issue_type="MISMATCHED_CLUSTER",
                    evidence_item=ev,
                    reason=f"Bằng chứng thuộc cluster '{ev_cluster}', không khớp với cluster sự cố '{expected_cluster_id}'",
                ))
                continue

            # D. Resource Identity & Pod UID Check (DEF-01 / A03 / A04 / A14)
            if target_pod_uid:
                if ev.target_uid:
                    if ev.target_uid == target_pod_uid:
                        ev.metadata["is_current_pod"] = True
                    elif ev.target_uid in historical_uids:
                        # Old Pod that was replaced prior to current state (A14)
                        ev.metadata["is_current_pod"] = False
                        ev.metadata["is_historical_replaced_pod"] = True
                        ev.attribution_status = EvidenceAttribution.HISTORICAL
                    else:
                        # Pod UID does not belong to target or replaced pods (A04)
                        rejected.append(ev)
                        issues.append(ValidationIssue(
                            issue_type="MISMATCHED_POD_UID",
                            evidence_item=ev,
                            reason=f"Bằng chứng gắn với Pod UID '{ev.target_uid}', không khớp với Pod mục tiêu '{target_pod_uid}' hoặc Pod tiền nhiệm",
                        ))
                        continue
                else:
                    # Pod UID missing when target UID is expected -> UNATTRIBUTED (A03 / H-01)
                    # When event had structured metadata identifying a Pod but omitted the UID,
                    # isolate as UNATTRIBUTED so it cannot be forged into target evidence
                    if ev.source in (EvidenceSource.KUBERNETES_EVENT, EvidenceSource.CONTAINER_TERMINATION) and ev.resource_kind == "Pod":
                        if ev.metadata.get("has_structured_metadata"):
                            ev.attribution_status = EvidenceAttribution.UNATTRIBUTED
                            unattributed_evidences.append(ev)
                            issues.append(ValidationIssue(
                                issue_type="MISSING_POD_UID",
                                evidence_item=ev,
                                reason="Sự kiện thiếu Pod UID xác định, không thể làm bằng chứng trực tiếp cho Pod mục tiêu",
                            ))
                            continue

            # E. Timestamp & Time Window Check (A15)
            if ev.timestamp is None:
                issues.append(ValidationIssue(
                    issue_type="MISSING_TIMESTAMP",
                    evidence_item=ev,
                    reason=f"Bằng chứng '{ev.evidence_type}' không có timestamp xác định",
                ))
                ev.metadata["has_temporal_correlation"] = False
                ev.reliability = max(0.5, ev.reliability * 0.85)
            else:
                ev.metadata["has_temporal_correlation"] = True
                ev_dt = self._parse_dt(ev.timestamp)
                if ev_dt:
                    if window_start and (window_start - ev_dt).total_seconds() > 3600:
                        rejected.append(ev)
                        issues.append(ValidationIssue(
                            issue_type="STALE_EVIDENCE",
                            evidence_item=ev,
                            reason=f"Bằng chứng quá cũ (ghi nhận lúc {ev.timestamp}, trước thời điểm sự cố hơn 60 phút)",
                        ))
                        continue
                    if window_end and (ev_dt - window_end).total_seconds() > 3600:
                        rejected.append(ev)
                        issues.append(ValidationIssue(
                            issue_type="OUTSIDE_WINDOW",
                            evidence_item=ev,
                            reason=f"Bằng chứng xảy ra sau khi sự cố đã đóng hơn 60 phút ({ev.timestamp})",
                        ))
                        continue

            # F. Probe Timeout Distinction
            if ev.evidence_type in {
                EvidenceType.PROBE_TIMEOUT,
                EvidenceType.LIVENESS_PROBE_FAILED,
                EvidenceType.READINESS_PROBE_FAILED,
            }:
                ev.metadata["is_symptom"] = True
                ev.metadata["confirms_root_cause"] = False

            valid.append(ev)

        # ----------------------------------------------------
        # 3. Contradiction Engine (Conflicting Evidence Check)
        # ----------------------------------------------------
        has_oom_killed_current = any(
            e.evidence_type == EvidenceType.OOM_KILLED and e.metadata.get("is_current_pod", True)
            for e in valid
        )
        has_oom_killed_historical = any(
            e.evidence_type == EvidenceType.OOM_KILLED and e.metadata.get("is_historical_replaced_pod")
            for e in valid
        )
        has_exit_137_non_oom = any(e.evidence_type == EvidenceType.EXIT_CODE_137_NON_OOM for e in valid)
        has_normal_ram = any(e.evidence_type == EvidenceType.NORMAL_RAM_USAGE for e in valid)
        has_high_ram = any(e.evidence_type in {EvidenceType.HIGH_RAM_USAGE, EvidenceType.RAM_STEEP_INCREASE} for e in valid)
        has_no_mem_pressure = any(e.evidence_type == EvidenceType.NODE_NO_MEMORY_PRESSURE for e in valid)

        # Rule A: Exit code 137 without OOMKilled reason vs OOM Claim
        if has_exit_137_non_oom and not has_oom_killed_current and not has_oom_killed_historical:
            ev_137 = next(e for e in valid if e.evidence_type == EvidenceType.EXIT_CODE_137_NON_OOM)
            issues.append(ValidationIssue(
                issue_type="EXIT_CODE_137_DISTINCTION",
                evidence_item=ev_137,
                reason="Tiến trình nhận SIGKILL (exit 137) nhưng không có lý do OOMKilled; có thể do Liveness probe timeout hoặc kill từ bên ngoài",
            ))

        # Rule B: Genuine conflicting telemetry evidence check (e.g., normal completion vs crash/kill on same target)
        has_normal_term = any(e.evidence_type == EvidenceType.CONTAINER_NORMAL_TERMINATION for e in valid)
        if has_normal_term and (has_oom_killed_current or has_exit_137_non_oom):
            ev_norm = next(e for e in valid if e.evidence_type == EvidenceType.CONTAINER_NORMAL_TERMINATION)
            ev_bad = next(e for e in valid if e.evidence_type in {EvidenceType.OOM_KILLED, EvidenceType.EXIT_CODE_137_NON_OOM})
            conflicts.append((
                ev_norm,
                ev_bad,
                f"Mâu thuẫn dữ liệu viễn trắc thực tế: Một nguồn ghi nhận kết thúc bình thường (exitCode: 0) nhưng nguồn khác ghi nhận tiến trình bị tiêu diệt ({ev_bad.value.get('reason') or ev_bad.value.get('exit_code')})",
            ))

        # Check for contradictory simultaneous RAM readings
        if has_normal_ram and has_high_ram:
            ev_norm_ram = next(e for e in valid if e.evidence_type == EvidenceType.NORMAL_RAM_USAGE)
            ev_high_ram = next(e for e in valid if e.evidence_type in {EvidenceType.HIGH_RAM_USAGE, EvidenceType.RAM_STEEP_INCREASE})
            conflicts.append((
                ev_norm_ram,
                ev_high_ram,
                "Mâu thuẫn dữ liệu viễn trắc: Đồng thời ghi nhận mức RAM bình thường và mức RAM chạm ngưỡng quá tải trên cùng một tài nguyên",
            ))

        # Note GRU risk prediction strictly as contextual observation (never as conflict)
        gru_risks = incident_context.get("gru_predictions") or []
        gru_oom = next((r for r in gru_risks if str(r.get("risk_type", "")).upper() == "OOM"), None)
        if gru_oom and float(gru_oom.get("confidence", 0)) >= 0.80 and not has_oom_killed_current and has_normal_ram:
            issues.append(ValidationIssue(
                issue_type="PREDICTIVE_RISK_NOTE",
                evidence_item=None,
                reason=f"Mô hình học sâu GRU cảnh báo rủi ro OOM ({gru_oom.get('confidence', 0):.1%}); viễn trắc thời điểm hiện tại ghi nhận RAM an toàn",
            ))

        # Rule C: CPU usage normal (< 70%) while Latency is high (>= 650ms)
        has_normal_cpu = any(e.evidence_type == EvidenceType.NORMAL_CPU_USAGE for e in valid)
        has_high_latency = any(e.evidence_type == EvidenceType.HIGH_LATENCY for e in valid)
        if has_normal_cpu and has_high_latency:
            ev_cpu = next(e for e in valid if e.evidence_type == EvidenceType.NORMAL_CPU_USAGE)
            ev_lat = next(e for e in valid if e.evidence_type == EvidenceType.HIGH_LATENCY)
            issues.append(ValidationIssue(
                issue_type="LATENCY_NOT_CPU_SATURATION",
                evidence_item=ev_lat,
                reason=f"Độ trễ cao ({ev_lat.value.get('latency_ms')}ms) nhưng CPU ở mức bình thường ({ev_cpu.value.get('cpu_pct')}%), loại trừ nguyên nhân bão hòa CPU",
            ))

        # Rule D: Pod replaced history vs Low RAM on new Pod
        # If historical pod had OOMKilled, but new pod has normal RAM, this is an expected recovery state, NOT a conflict!
        if has_oom_killed_historical and has_normal_ram:
            issues.append(ValidationIssue(
                issue_type="POST_REPLACE_VERIFICATION_STATE",
                evidence_item=None,
                reason="Pod cũ từng bị OOMKilled trước khi thay thế (REPLACE_POD); Pod mới hiện có RAM bình thường",
            ))

        return ValidationResult(
            is_valid=len(rejected) == 0 and len(conflicts) == 0,
            valid_evidences=valid,
            rejected_evidences=rejected,
            conflicting_evidences=conflicts,
            issues=issues,
            missing_data=missing_data,
            dependency_evidences=dependency_evidences,
            unattributed_evidences=unattributed_evidences,
        )

    @staticmethod
    def _parse_dt(val: Any) -> datetime | None:
        if isinstance(val, datetime):
            return val if val.tzinfo else val.replace(tzinfo=timezone.utc)
        if isinstance(val, str) and val.strip():
            clean = val.strip().replace("Z", "+00:00")
            try:
                dt = datetime.fromisoformat(clean)
                return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
            except Exception:
                return None
        return None
