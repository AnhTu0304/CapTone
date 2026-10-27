"""Telemetry message schemas and protocol serialization models."""

from typing import Any, Literal, Optional, Union
from pydantic import BaseModel, Field


# ==========================================
# Telemetry Data Models
# ==========================================

class AgentMetricsData(BaseModel):
    """Metrics payload for pod/workload telemetry matching Main Backend schema."""
    service_id: str
    pod_id: str = "unknown-pod"
    namespace: Optional[str] = Field(default="default", description="Kubernetes namespace")
    timestamp: str
    cpu: float = Field(..., ge=0.0, description="CPU usage percentage")
    ram: float = Field(..., ge=0.0, description="RAM usage in MB")
    disk: float = Field(default=10.0, ge=0.0, description="Disk usage percentage")
    request_rate: float = Field(default=0.0, ge=0.0, description="Requests per second")
    latency: float = Field(default=0.0, ge=0.0, description="Latency in milliseconds")
    http_5xx_rate: float = Field(default=0.0, ge=0.0, description="HTTP 5xx error rate percentage")
    pod_restart_count: int = Field(default=0, ge=0, description="Container restart count")
    replica_count: int = Field(default=1, ge=0, description="Replicas count for the service")
    node_cpu_percent: Optional[float] = Field(default=None, description="Host/Node CPU usage percentage")
    node_ram_percent: Optional[float] = Field(default=None, description="Host/Node RAM usage percentage")
    node_cpu_cores: Optional[float] = Field(default=None, description="Host/Node CPU usage in cores")
    node_ram_gb: Optional[float] = Field(default=None, description="Host/Node RAM usage in GB")


class DiskFilesystemMetric(BaseModel):
    """Per-filesystem disk capacity and usage breakdown in bytes."""
    device: str
    mount_point: str
    fs_type: str = "unknown"
    total_bytes: int = Field(default=0, ge=0)
    used_bytes: int = Field(default=0, ge=0)
    available_bytes: int = Field(default=0, ge=0)
    usage_percent: float = Field(default=0.0, ge=0.0, le=100.0)


class NetworkInterfaceMetric(BaseModel):
    """Per-interface cumulative network counters and delta rates."""
    interface: str
    rx_bytes: int = Field(default=0, ge=0)
    tx_bytes: int = Field(default=0, ge=0)
    rx_packets: int = Field(default=0, ge=0)
    tx_packets: int = Field(default=0, ge=0)
    rx_errors: int = Field(default=0, ge=0)
    tx_errors: int = Field(default=0, ge=0)
    rx_bytes_per_sec: float = Field(default=0.0, ge=0.0)
    tx_bytes_per_sec: float = Field(default=0.0, ge=0.0)
    is_warmup: bool = False
    counter_reset: bool = False


class AgentNodeMetricsData(BaseModel):
    """Host/Node level hardware resource telemetry payload (Task 4.1 & 4.2)."""
    node_name: str
    timestamp: str
    cpu_usage_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    cpu_cores: int = Field(default=1, ge=1)
    ram_total_bytes: int = Field(default=0, ge=0)
    ram_used_bytes: int = Field(default=0, ge=0)
    ram_available_bytes: int = Field(default=0, ge=0)
    ram_usage_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    disk_total_bytes: int = Field(default=0, ge=0)
    disk_used_bytes: int = Field(default=0, ge=0)
    disk_available_bytes: int = Field(default=0, ge=0)
    disk_usage_percent: float = Field(default=0.0, ge=0.0, le=100.0)
    disk_filesystems: list[DiskFilesystemMetric] = Field(default_factory=list)
    net_rx_bytes: int = Field(default=0, ge=0)
    net_tx_bytes: int = Field(default=0, ge=0)
    net_rx_bytes_per_sec: float = Field(default=0.0, ge=0.0)
    net_tx_bytes_per_sec: float = Field(default=0.0, ge=0.0)
    net_interfaces: list[NetworkInterfaceMetric] = Field(default_factory=list)
    collection_status: Literal["OK", "WARMUP", "PARTIAL", "ERROR"] = "OK"
    collection_errors: dict[str, str] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentLogData(BaseModel):
    """Log payload for pod container logs."""
    service_id: str
    pod_id: str = "unknown-pod"
    namespace: Optional[str] = Field(default="default", description="Kubernetes namespace")
    timestamp: str
    level: Literal["error", "warn", "info"]
    message: str


class AgentK8sEventDetail(BaseModel):
    """Kubernetes event object."""
    type: Literal["Warning", "Normal"]
    reason: str
    message: str


K8sEventDetail = AgentK8sEventDetail


class AgentK8sEventData(BaseModel):
    """Kubernetes cluster lifecycle and error anomaly event payload."""
    service_id: str
    pod_id: str = "unknown-pod"
    pod_name: str = "unknown-pod"
    status: str
    timestamp: str
    event: AgentK8sEventDetail


# ==========================================
# Outgoing Message Envelopes
# ==========================================

class AuthMessage(BaseModel):
    """Explicit auth message envelope."""
    type: Literal["auth"] = "auth"
    token: str


class MetricsMessage(BaseModel):
    """Metrics envelope sent over WebSocket."""
    type: Literal["metrics"] = "metrics"
    data: AgentMetricsData


class NodeMetricsMessage(BaseModel):
    """Node/Host resource metrics envelope sent over WebSocket."""
    type: Literal["node_metrics"] = "node_metrics"
    data: AgentNodeMetricsData


class LogMessage(BaseModel):
    """Log envelope sent over WebSocket."""
    type: Literal["log"] = "log"
    data: AgentLogData


class K8sEventMessage(BaseModel):
    """Kubernetes event envelope sent over WebSocket."""
    type: Literal["k8s_event"] = "k8s_event"
    data: AgentK8sEventData


class AgentK8sInventoryData(BaseModel):
    """Kubernetes cluster topology and inventory payload."""
    nodes: list[dict[str, Any]] = Field(default_factory=list)
    namespaces: list[dict[str, Any]] = Field(default_factory=list)
    pods: list[dict[str, Any]] = Field(default_factory=list)
    services: list[dict[str, Any]] = Field(default_factory=list)
    deployments: list[dict[str, Any]] = Field(default_factory=list)


class K8sInventoryMessage(BaseModel):
    """Kubernetes inventory envelope sent over WebSocket."""
    type: Literal["k8s_inventory"] = "k8s_inventory"
    data: AgentK8sInventoryData


class ActionResultData(BaseModel):
    """Result of an executed self-healing action reported back to Backend."""
    action_id: str
    action_type: Optional[str] = None
    status: Literal["SUCCEEDED", "FAILED"]
    message: Optional[str] = None
    duration_ms: Optional[int] = 1000
    details: Optional[dict[str, Any]] = None


class ActionResultMessage(BaseModel):
    """Action result envelope sent over WebSocket."""
    type: Literal["action_result"] = "action_result"
    data: ActionResultData


OutgoingEnvelope = Union[
    AuthMessage,
    MetricsMessage,
    NodeMetricsMessage,
    LogMessage,
    K8sEventMessage,
    K8sInventoryMessage,
    ActionResultMessage,
]


# ==========================================
# Incoming Message Models (from Main Backend)
# ==========================================

class AuthenticatedPayload(BaseModel):
    status: Literal["authenticated"]
    message: str
    agent: Optional[dict[str, Any]] = None
    timestamp: Optional[str] = None


class AckPayload(BaseModel):
    status: Literal["ack"]
    type: Optional[str] = None
    record_id: Optional[Union[str, int]] = None
    service_id: Optional[str] = None
    timestamp: Optional[str] = None


class ErrorPayload(BaseModel):
    status: Literal["error"]
    message: str
    errors: Optional[Any] = None


class ExecuteActionData(BaseModel):
    """Payload instructing the Agent to execute a remediation action."""
    action_id: str
    action_type: str
    target_name: str
    namespace: Optional[str] = "default"
    params: Optional[dict[str, Any]] = Field(default_factory=dict)


class ExecuteActionPayload(BaseModel):
    """Incoming command envelope to execute a self-healing action."""
    type: Literal["execute_action"]
    data: ExecuteActionData


IncomingMessage = Union[AuthenticatedPayload, AckPayload, ErrorPayload, ExecuteActionPayload]
