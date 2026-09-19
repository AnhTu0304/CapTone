from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

from app.schemas.kubernetes import KubernetesData
from app.schemas.metrics import MetricPoint
from app.schemas.prediction import GRUMetricPoint, PredictionResponse, RISK_TYPES, RiskType


Action = Literal[
    "RESTART_POD",
    "REPLACE_POD",
    "RESTART_DEPLOYMENT",
    "SCALE_REPLICAS",
    "ROLLBACK_DEPLOYMENT",
    "CLEANUP_STORAGE",
    "TEMPORARY_IP_BLOCK",
    "NO_ACTION",
]
Severity = Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
ActionResult = Literal["SUCCESS", "FAILED", "PARTIAL", "UNKNOWN"]
ActionResultSource = Literal["POST_ACTION_VERIFICATION"]
ConfirmationSource = Literal["DEVOPS", "MANUAL_INVESTIGATION", "VERIFIED_EVIDENCE"]


class HistoricalIncident(BaseModel):
    model_config = ConfigDict(extra="forbid")

    incident_id: str = Field(min_length=1, max_length=200)
    service_id: str | None = Field(default=None, max_length=200)
    root_cause: str | None = None
    predicted_root_cause: str | None = None
    confirmed_root_cause: str | None = None
    recommended_action: str | None = None
    executed_action: str | None = None
    action_result: ActionResult | None = None
    action_result_source: ActionResultSource | None = None
    confirmation_source: ConfirmationSource | None = None
    evidence: list[str] = Field(default_factory=list, max_length=100)
    operator_feedback: str | None = None

    @model_validator(mode="after")
    def require_trusted_sources(self):
        if self.confirmed_root_cause and self.confirmation_source is None:
            raise ValueError(
                "confirmed_root_cause requires confirmation_source=DEVOPS, "
                "MANUAL_INVESTIGATION, or VERIFIED_EVIDENCE"
            )
        if self.action_result and self.action_result_source is None:
            raise ValueError(
                "action_result requires action_result_source=POST_ACTION_VERIFICATION"
            )
        return self


class HealthCheckContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    status: str | bool | None = None
    checks: list[str] = Field(default_factory=list, max_length=100)


class DeploymentContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_version: str | None = None
    previous_version: str | None = None
    deployed_at: str | None = None
    status: str | None = None
    events: list[str] = Field(default_factory=list, max_length=100)


class SecurityContext(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_ip: str | None = None
    request_rate: float | None = Field(default=None, ge=0)
    failed_auth_count: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("failed_auth_count", "failed_login_count"),
    )
    request_anomaly: bool = False
    auth_anomaly: bool = False
    http_401_rate: float | None = Field(default=None, ge=0)
    http_403_rate: float | None = Field(default=None, ge=0)

    def supports_temporary_ip_block(
        self,
        security_request_threshold: float,
        failed_auth_threshold: int,
    ) -> bool:
        """Require an IP, an anomaly flag, and a matching abnormal signal."""
        abnormal_request = (
            self.request_anomaly
            and self.request_rate is not None
            and self.request_rate >= security_request_threshold
        )
        abnormal_auth = (
            self.auth_anomaly
            and self.failed_auth_count is not None
            and self.failed_auth_count >= failed_auth_threshold
        )
        return bool(self.source_ip and (abnormal_request or abnormal_auth))


class SecurityPolicyContext(BaseModel):
    """Official thresholds supplied and owned by Main Backend/Policy Engine."""

    model_config = ConfigDict(extra="forbid")

    request_threshold: float = Field(ge=0, description="Requests per second")
    failed_auth_threshold: int = Field(
        ge=0, description="Failed authentication attempts per aggregation window"
    )
    failed_auth_window_seconds: int = Field(
        gt=0, description="Aggregation window used for failed_auth_count"
    )


class RCARequest(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        json_schema_extra={
            "examples": [{
                "service_id": "payment-service",
                "risk_type": "CPU_OVERLOAD",
                "confidence": 0.92,
                "metrics": {
                    "cpu": 95, "ram": 70, "disk": 50,
                    "request_rate": 1100, "latency": 720,
                    "http_5xx_rate": 3.0,
                    "pod_restart_count": 1, "replica_count": 2,
                },
                "logs": ["High CPU usage detected"],
                "kubernetes_events": ["Deployment has insufficient replicas"],
            }]
        },
    )

    service_id: str = Field(min_length=1, max_length=200)
    risk_type: RiskType | None = None
    confidence: float | None = Field(default=None, ge=0, le=1)
    pod_id: str | None = Field(default=None, max_length=253)
    metrics: MetricPoint
    metric_sequence: list[GRUMetricPoint] | None = Field(default=None, min_length=12, max_length=12)
    logs: list[str] = Field(default_factory=list, max_length=1000)
    kubernetes: KubernetesData = Field(default_factory=KubernetesData)
    kubernetes_events: list[str] = Field(default_factory=list, max_length=500)
    prediction: PredictionResponse | None = None
    rule_engine: list[str] = Field(default_factory=list, max_length=100)
    health_check: HealthCheckContext | None = None
    deployment: DeploymentContext | None = None
    security: SecurityContext | None = None
    security_policy: SecurityPolicyContext | None = None
    previous_action: str | None = Field(default=None, max_length=100)
    previous_action_result: ActionResult | None = None
    previous_action_result_source: ActionResultSource | None = None
    previous_rca_root_cause: str | None = None
    historical_incidents: list[HistoricalIncident] = Field(default_factory=list, max_length=100)

    @model_validator(mode="after")
    def require_previous_action_verification(self):
        if (self.risk_type is None) != (self.confidence is None):
            raise ValueError("risk_type and confidence must be supplied together")
        if self.prediction is not None:
            actual_risks = set(self.prediction.risk_outputs)
            expected_risks = set(RISK_TYPES)
            if actual_risks != expected_risks:
                missing = sorted(expected_risks - actual_risks)
                extra = sorted(actual_risks - expected_risks)
                raise ValueError(
                    "prediction.risk_outputs must contain exactly all 6 risks; "
                    f"missing={missing}, extra={extra}"
                )
        if self.previous_action_result and self.previous_action_result_source is None:
            raise ValueError(
                "previous_action_result must come from POST_ACTION_VERIFICATION"
            )
        return self


class RootCauseResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    cause: str
    confidence: float = Field(ge=0, le=1)
    severity: Severity


class RecommendationResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    action: Action
    reason: str
    priority: Severity


class RCAResponse(BaseModel):
    service_id: str
    prediction: PredictionResponse | None
    root_cause: RootCauseResult
    evidence: list[str]
    recommendation: RecommendationResult
    explanation: str
    historical_context_used: bool
    similar_incident_ids: list[str]


class LLMRCAResult(BaseModel):
    """Strict OpenAI Structured Output; service and prediction are added by the API."""

    model_config = ConfigDict(extra="forbid")

    root_cause: RootCauseResult
    evidence: list[str] = Field(min_length=1, max_length=50)
    recommendation: RecommendationResult
    explanation: str
    historical_context_used: bool
    similar_incident_ids: list[str] = Field(default_factory=list, max_length=20)
