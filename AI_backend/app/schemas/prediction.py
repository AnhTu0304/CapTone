from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

RiskType = Literal[
    "CPU_OVERLOAD",
    "OOM",
    "DISK_FULL",
    "HIGH_LATENCY",
    "HTTP_5XX_SPIKE",
    "TRAFFIC_OVERLOAD",
]
RISK_TYPES = (
    "CPU_OVERLOAD",
    "OOM",
    "DISK_FULL",
    "HIGH_LATENCY",
    "HTTP_5XX_SPIKE",
    "TRAFFIC_OVERLOAD",
)

PREDICTION_POINT_EXAMPLE = {
    "cpu": 55,
    "ram": 60,
    "disk": 50,
    "request_rate": 250,
    "latency": 180,
    "http_5xx_rate": 1.2,
    "pod_restart_count": 0,
    "replica_count": 3,
}
class GRUMetricPoint(BaseModel):
    """One timestep in the canonical eight-feature GRU input."""

    model_config = ConfigDict(extra="forbid")

    cpu: float = Field(ge=0, le=100)
    ram: float = Field(ge=0, le=100)
    disk: float = Field(ge=0, le=100)
    request_rate: float = Field(ge=0)
    latency: float = Field(ge=0)
    http_5xx_rate: float = Field(ge=0)
    pod_restart_count: int = Field(ge=0)
    replica_count: int = Field(ge=1)


class PredictionRequest(BaseModel):
    """GRU request whose canonical model input is 12 timesteps x 8 features."""

    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [{
                "service_id": "payment-service",
                "sequence": [PREDICTION_POINT_EXAMPLE for _ in range(12)],
            }]
        },
    )

    service_id: str = Field(min_length=1, max_length=200)
    sequence: list[GRUMetricPoint] = Field(
        min_length=12,
        max_length=12,
        description=(
            "Exactly 12 time-ordered observations with all 8 model features present."
        ),
    )


class RiskScore(BaseModel):
    risk_type: RiskType
    confidence: float = Field(ge=0, le=1)


class HeadPrediction(BaseModel):
    confidence: float = Field(ge=0, le=1)


class PredictionResponse(BaseModel):
    model_config = ConfigDict(json_schema_extra={
        "examples": [{
            "service_id": "payment-service",
            "threshold": 0.79,
            "thresholds": {
                "CPU_OVERLOAD": 0.81,
                "OOM": 0.50,
                "DISK_FULL": 0.85,
                "HIGH_LATENCY": 0.62,
                "HTTP_5XX_SPIKE": 0.81,
                "TRAFFIC_OVERLOAD": 0.85,
            },
            "detected_risks": [
                {"risk_type": "CPU_OVERLOAD", "confidence": 0.92},
                {"risk_type": "HIGH_LATENCY", "confidence": 0.86},
            ],
            "risk_outputs": {
                "CPU_OVERLOAD": {"confidence": 0.92},
                "OOM": {"confidence": 0.15},
                "DISK_FULL": {"confidence": 0.06},
                "HIGH_LATENCY": {"confidence": 0.86},
                "HTTP_5XX_SPIKE": {"confidence": 0.21},
                "TRAFFIC_OVERLOAD": {"confidence": 0.74},
            },
        }]
    })

    service_id: str
    threshold: float = Field(ge=0, le=1)
    thresholds: dict[RiskType, float] | None = None
    detected_risks: list[RiskScore] = Field(default_factory=list)
    risk_outputs: dict[RiskType, HeadPrediction]
