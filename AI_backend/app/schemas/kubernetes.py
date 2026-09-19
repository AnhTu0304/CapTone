from __future__ import annotations

from pydantic import BaseModel, ConfigDict, Field


class DeploymentInfo(BaseModel):
    model_config = ConfigDict(extra="forbid")

    desired_replicas: int | None = Field(default=None, ge=0)
    available_replicas: int | None = Field(default=None, ge=0)
    version: str | None = None
    previous_version: str | None = None
    deployed_at: str | None = None


class KubernetesData(BaseModel):
    model_config = ConfigDict(extra="forbid")

    pod_status: str | None = None
    container_status: str | None = None
    restart_count: int = Field(default=0, ge=0)
    events: list[str] = Field(default_factory=list, max_length=500)
    desired_replicas: int | None = Field(default=None, ge=0)
    available_replicas: int | None = Field(default=None, ge=0)
    readiness_probe: str | bool | None = None
    liveness_probe: str | bool | None = None
    deployment: DeploymentInfo | None = None


class KubernetesAnalysisResult(BaseModel):
    agent: str = "kubernetes_event_analysis"
    findings: list[str]
    suspected_causes: list[str]
