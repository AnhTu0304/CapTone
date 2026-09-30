"""Transport Data Models for SelfHeal Agent v0.1.

Defines Pydantic schemas for HTTP requests and responses to the SelfHeal Backend.
"""

from datetime import datetime, timezone
from typing import Any, Dict, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.config.constants import AgentStatus


class HeartbeatPayload(BaseModel):
    """Payload sent by the agent in periodic heartbeat notifications."""

    model_config = ConfigDict(
        populate_by_name=True,
        use_enum_values=True,
    )

    agent_id: str = Field(..., alias="agentId", description="Unique Agent identifier")
    agent_version: str = Field(..., alias="agentVersion", description="Agent release version")
    status: AgentStatus = Field(..., alias="status", description="Current agent health status")
    reported_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc),
        alias="reportedAt",
        description="UTC timestamp when heartbeat was recorded",
    )
    metadata: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional telemetry metadata, e.g. K8s connectivity status",
    )


class HeartbeatResponse(BaseModel):
    """Response returned by the backend upon receiving a heartbeat."""

    status: str = Field(default="ACK", description="Acknowledgement status")
    acknowledged: bool = Field(default=True, description="Whether backend accepted heartbeat")
    server_time: Optional[datetime] = Field(default=None, alias="serverTime")
