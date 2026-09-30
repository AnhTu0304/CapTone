"""Constants and Enums for SelfHeal Agent v0.1."""

from enum import Enum


class KubernetesMode(str, Enum):
    """Kubernetes configuration mode."""
    LOCAL = "LOCAL"
    IN_CLUSTER = "IN_CLUSTER"


class AgentStatus(str, Enum):
    """Lifecycle and operational status of the agent."""
    STARTING = "STARTING"
    HEALTHY = "HEALTHY"
    DEGRADED = "DEGRADED"
    UNHEALTHY = "UNHEALTHY"
    STOPPING = "STOPPING"


DEFAULT_AGENT_VERSION = "0.1.0"
DEFAULT_HEARTBEAT_INTERVAL = 10
DEFAULT_CONNECT_TIMEOUT = 5.0
DEFAULT_REQUEST_TIMEOUT = 10.0
HEARTBEAT_ENDPOINT = "/api/v1/agents/heartbeat"
