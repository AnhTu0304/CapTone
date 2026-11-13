from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any


class EvidenceSource(str, Enum):
    METRICS = "METRICS"
    LOGS = "LOGS"
    KUBERNETES_EVENT = "KUBERNETES_EVENT"
    CONTAINER_TERMINATION = "CONTAINER_TERMINATION"
    NODE_CONDITION = "NODE_CONDITION"
    DEPLOYMENT = "DEPLOYMENT"
    SECURITY = "SECURITY"
    ACTION_HISTORY = "ACTION_HISTORY"


class EvidenceType(str, Enum):
    # Memory Evidence
    OOM_KILLED = "OOM_KILLED"
    EXIT_CODE_137_NON_OOM = "EXIT_CODE_137_NON_OOM"
    HIGH_RAM_USAGE = "HIGH_RAM_USAGE"
    NORMAL_RAM_USAGE = "NORMAL_RAM_USAGE"
    RAM_STEEP_INCREASE = "RAM_STEEP_INCREASE"
    NODE_MEMORY_PRESSURE = "NODE_MEMORY_PRESSURE"
    NODE_NO_MEMORY_PRESSURE = "NODE_NO_MEMORY_PRESSURE"

    # CPU Evidence
    HIGH_CPU_USAGE = "HIGH_CPU_USAGE"
    NORMAL_CPU_USAGE = "NORMAL_CPU_USAGE"
    CPU_THROTTLING = "CPU_THROTTLING"
    NODE_CPU_PRESSURE = "NODE_CPU_PRESSURE"

    # Latency & Traffic Evidence
    HIGH_LATENCY = "HIGH_LATENCY"
    NORMAL_LATENCY = "NORMAL_LATENCY"
    HIGH_REQUEST_RATE = "HIGH_REQUEST_RATE"
    HIGH_HTTP_5XX_RATE = "HIGH_HTTP_5XX_RATE"

    # Probes & Pod Stability Evidence
    PROBE_TIMEOUT = "PROBE_TIMEOUT"
    READINESS_PROBE_FAILED = "READINESS_PROBE_FAILED"
    LIVENESS_PROBE_FAILED = "LIVENESS_PROBE_FAILED"
    POD_RESTART_COUNT_HIGH = "POD_RESTART_COUNT_HIGH"
    CRASH_LOOP_BACKOFF = "CRASH_LOOP_BACKOFF"
    IMAGE_PULL_BACKOFF = "IMAGE_PULL_BACKOFF"
    FAILED_SCHEDULING = "FAILED_SCHEDULING"
    CONTAINER_NORMAL_TERMINATION = "CONTAINER_NORMAL_TERMINATION"

    # Storage Evidence
    STORAGE_CAPACITY_EXHAUSTED = "STORAGE_CAPACITY_EXHAUSTED"
    STORAGE_IO_ERROR = "STORAGE_IO_ERROR"
    NODE_DISK_PRESSURE = "NODE_DISK_PRESSURE"

    # Log Evidence
    LOG_OOM_PATTERN = "LOG_OOM_PATTERN"
    LOG_CRASH_PANIC = "LOG_CRASH_PANIC"
    LOG_CONNECTION_FAILURE = "LOG_CONNECTION_FAILURE"
    LOG_TIMEOUT = "LOG_TIMEOUT"
    LOG_DISK_FULL = "LOG_DISK_FULL"


class EvidenceAttribution(str, Enum):
    DIRECT = "DIRECT"
    DEPENDENCY = "DEPENDENCY"
    UNATTRIBUTED = "UNATTRIBUTED"
    HISTORICAL = "HISTORICAL"
    CONTEXTUAL = "CONTEXTUAL"


@dataclass
class EvidenceItem:
    source: EvidenceSource
    evidence_type: str
    target_resource: str
    target_uid: str | None
    timestamp: str | datetime | None
    value: Any
    description: str
    metadata: dict[str, Any] = field(default_factory=dict)
    reliability: float = 1.0
    attribution_status: EvidenceAttribution = EvidenceAttribution.DIRECT
    resource_kind: str | None = None
    resource_name: str | None = None


@dataclass
class ValidationIssue:
    issue_type: str
    evidence_item: EvidenceItem | None
    reason: str


@dataclass
class ValidationResult:
    is_valid: bool
    valid_evidences: list[EvidenceItem] = field(default_factory=list)
    rejected_evidences: list[EvidenceItem] = field(default_factory=list)
    conflicting_evidences: list[tuple[EvidenceItem, EvidenceItem, str]] = field(default_factory=list)
    issues: list[ValidationIssue] = field(default_factory=list)
    missing_data: list[str] = field(default_factory=list)
    dependency_evidences: list[EvidenceItem] = field(default_factory=list)
    unattributed_evidences: list[EvidenceItem] = field(default_factory=list)
