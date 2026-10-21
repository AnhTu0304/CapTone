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
    timestamp: str
    cpu: float = Field(..., ge=0.0, description="CPU usage percentage")
    ram: float = Field(..., ge=0.0, description="RAM usage in MB")
    disk: float = Field(default=10.0, ge=0.0, description="Disk usage percentage")
    request_rate: float = Field(default=0.0, ge=0.0, description="Requests per second")
    latency: float = Field(default=0.0, ge=0.0, description="Latency in milliseconds")
    http_5xx_rate: float = Field(default=0.0, ge=0.0, description="HTTP 5xx error rate percentage")
    pod_restart_count: int = Field(default=0, ge=0, description="Container restart count")
    replica_count: int = Field(default=1, ge=0, description="Replicas count for the service")


class AgentLogData(BaseModel):
    """Log payload for pod container logs."""
    service_id: str
    pod_id: str = "unknown-pod"
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


OutgoingEnvelope = Union[AuthMessage, MetricsMessage, LogMessage, K8sEventMessage]


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


IncomingMessage = Union[AuthenticatedPayload, AckPayload, ErrorPayload]
