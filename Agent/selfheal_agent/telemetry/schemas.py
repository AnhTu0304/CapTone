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


class K8sInventoryMessage(BaseModel):
    """Kubernetes inventory envelope sent over WebSocket."""
    type: Literal["k8s_inventory"] = "k8s_inventory"
    data: AgentK8sInventoryData


class ActionResultData(BaseModel):
    """Result of an executed self-healing action reported back to Backend."""
    action_id: str
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
