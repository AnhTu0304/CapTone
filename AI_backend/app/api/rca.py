import logging

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from app.agents.historical_incident_agent import HistoricalIncidentAgent
from app.agents.kubernetes_agent import KubernetesEventAgent
from app.agents.log_agent import LogAnalysisAgent
from app.agents.metrics_agent import MetricsAnalysisAgent
from app.agents.rca_agent import RootCauseAnalysisAgent
from app.agents.recommendation_agent import RecommendationAgent
from app.api.dependencies import get_openai_rca_service, get_prediction_service
from app.schemas.rca import RCARequest, RCAResponse
from app.schemas.prediction import HeadPrediction, PredictionResponse, RiskScore
from app.services.prediction_service import PredictionService
from app.services.openai_rca_service import OpenAIRCAService


router = APIRouter(prefix="/api/v1", tags=["root-cause-analysis"])
logger = logging.getLogger(__name__)


@router.post("/rca", response_model=RCAResponse)
async def analyze_root_cause(
    payload: RCARequest,
    prediction_service: PredictionService = Depends(get_prediction_service),
    openai_rca_service: OpenAIRCAService | None = Depends(get_openai_rca_service),
) -> RCAResponse:
    # Prediction source precedence is deterministic:
    # 1) full /predict response, 2) direct risk_type + confidence,
    # 3) GRU inference from metric_sequence.
    prediction = payload.prediction
    if prediction is None and payload.risk_type is not None and payload.confidence is not None:
        confidence = payload.confidence
        risk_threshold = prediction_service.threshold_for_public_risk(payload.risk_type)
        detected = (
            [RiskScore(risk_type=payload.risk_type, confidence=confidence)]
            if confidence >= risk_threshold
            else []
        )
        prediction = PredictionResponse(
            service_id=payload.service_id,
            threshold=prediction_service.threshold,
            thresholds=prediction_service.public_thresholds,
            detected_risks=detected,
            risk_outputs={
                payload.risk_type: HeadPrediction(confidence=confidence)
            },
        )
    # A single current metric is not a time series. Only run GRU automatically
    # when the caller supplies metric history; otherwise RCA proceeds without it.
    if prediction is None and payload.metric_sequence:
        generated = await run_in_threadpool(
            prediction_service.predict,
            payload.service_id,
            payload.metric_sequence,
        )
        prediction = generated

    update_dict: dict[str, Any] = {
        "events": list(dict.fromkeys([
            *payload.kubernetes.events,
            *payload.kubernetes_events,
        ])),
    }
    if not payload.kubernetes.workload_name:
        update_dict["workload_name"] = payload.service_id
    if not payload.kubernetes.workload_id and payload.workload_id:
        update_dict["workload_id"] = payload.workload_id
    if not payload.kubernetes.workload_type and payload.workload_type:
        update_dict["workload_type"] = payload.workload_type
    if not payload.kubernetes.cluster_id and payload.cluster_id:
        update_dict["cluster_id"] = payload.cluster_id
    if not payload.kubernetes.namespace and payload.namespace:
        update_dict["namespace"] = payload.namespace

    effective_pod_name = payload.suspected_pod_name or payload.pod_id
    if not payload.kubernetes.all_pods and effective_pod_name:
        from app.schemas.kubernetes import PodInfo
        update_dict["all_pods"] = [
            PodInfo(
                pod_name=effective_pod_name,
                pod_id=payload.pod_id or effective_pod_name,
                status=payload.kubernetes.pod_status or "Running",
                ready=payload.kubernetes.pod_status == "Running",
                restart_count=payload.kubernetes.restart_count,
            )
        ]

    kubernetes_raw = payload.kubernetes.model_copy(update=update_dict)
    metrics = MetricsAnalysisAgent().analyze(payload.metrics, payload.metric_sequence)
    logs = LogAnalysisAgent().analyze(payload.logs)
    kubernetes = KubernetesEventAgent().analyze(kubernetes_raw)
    historical = HistoricalIncidentAgent().analyze(payload, metrics, logs, kubernetes)

    # Always derive a safe local recommendation. Besides providing the normal
    # fallback path, this gives the OpenAI guard an evidence-based alternative
    # when a requested action (for example IP blocking) is not permitted.
    conclusion = RootCauseAnalysisAgent().analyze(
        prediction,
        metrics,
        logs,
        kubernetes,
        kubernetes_raw,
        historical,
        payload.previous_action,
        payload.previous_action_result,
        payload.previous_rca_root_cause,
        payload.action_history,
    )
    recommendation = RecommendationAgent().recommend(
        conclusion,
        kubernetes_raw,
        historical,
        payload.previous_action,
        payload.previous_action_result,
        payload.action_history,
        kubernetes,
        payload.security,
        payload.security_policy,
    )

    if openai_rca_service is not None:
        try:
            llm_result = await openai_rca_service.analyze(
                payload,
                prediction,
                metrics,
                logs,
                kubernetes,
                historical,
                recommendation,
            )
            return RCAResponse(
                service_id=payload.service_id,
                prediction=prediction,
                root_cause=llm_result.root_cause,
                evidence=llm_result.evidence,
                recommendation=llm_result.recommendation,
                explanation=llm_result.explanation,
                historical_context_used=llm_result.historical_context_used,
                similar_incident_ids=llm_result.similar_incident_ids,
                workload_id=payload.workload_id,
                namespace=payload.namespace,
                cluster_id=payload.cluster_id,
                incident_id=payload.incident_id,
                request_id=payload.request_id,
            )
        except Exception as exc:
            # Availability of an external model must not make incident analysis unavailable.
            logger.warning("OpenAI RCA failed; using deterministic fallback: %s", type(exc).__name__)

    return RCAResponse(
        service_id=payload.service_id,
        prediction=prediction,
        root_cause=conclusion.result,
        evidence=conclusion.evidence,
        recommendation=recommendation,
        explanation=conclusion.explanation,
        historical_context_used=conclusion.historical_context_used,
        similar_incident_ids=conclusion.similar_incident_ids or [],
        workload_id=payload.workload_id,
        namespace=payload.namespace,
        cluster_id=payload.cluster_id,
        incident_id=payload.incident_id,
        request_id=payload.request_id,
    )
