from __future__ import annotations

from pydantic import AliasChoices, BaseModel, ConfigDict, Field


class MetricPoint(BaseModel):
    """Current incident metrics used by RCA; Kubernetes counts remain optional."""

    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    cpu: float = Field(ge=0, le=100, allow_inf_nan=False)
    ram: float = Field(ge=0, le=100, allow_inf_nan=False)
    disk: float = Field(ge=0, le=100, allow_inf_nan=False)
    request_rate: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)
    latency: float = Field(ge=0, le=1_000_000, allow_inf_nan=False)
    http_5xx_rate: float = Field(
        ge=0, le=100, allow_inf_nan=False, validation_alias=AliasChoices("http_5xx_rate", "http5xx")
    )
    pod_restart_count: int | None = Field(default=None, ge=0, le=100_000)
    replica_count: int | None = Field(default=None, ge=1, le=10_000)
class MetricsAnalysisResult(BaseModel):
    agent: str = "metrics_analysis"
    status: str
    findings: list[str]
    suspected_causes: list[str]
