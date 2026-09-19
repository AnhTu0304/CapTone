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

    kubernetes_raw = payload.kubernetes.model_copy(update={
        "events": list(dict.fromkeys([
            *payload.kubernetes.events,
            *payload.kubernetes_events,
        ]))
    })
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
    )
    recommendation = RecommendationAgent().recommend(
        conclusion,
        kubernetes_raw,
        historical,
        payload.previous_action,
        payload.previous_action_result,
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
    )
