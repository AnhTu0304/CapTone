from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class MetricPoint(BaseModel):
    """Current incident metrics used by RCA; Kubernetes counts remain optional."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    cpu: float = Field(ge=0, le=100)
    ram: float = Field(ge=0, le=100)
    disk: float = Field(ge=0, le=100)
    request_rate: float = Field(ge=0)
    latency: float = Field(ge=0)
    http_5xx_rate: float = Field(
        ge=0, validation_alias=AliasChoices("http_5xx_rate", "http5xx")
    )
    pod_restart_count: int | None = Field(default=None, ge=0)
    replica_count: int | None = Field(default=None, ge=1)
class MetricsAnalysisResult(BaseModel):
    agent: str = "metrics_analysis"
    status: str
    findings: list[str]
    suspected_causes: list[str]
