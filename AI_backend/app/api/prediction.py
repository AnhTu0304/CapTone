import time

from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from app.api.dependencies import get_prediction_service
from app.core.otel import record_ai_prediction
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.prediction_service import PredictionService


router = APIRouter(prefix="/api/v1", tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
async def predict(
    payload: PredictionRequest,
    service: PredictionService = Depends(get_prediction_service),
) -> PredictionResponse:
    started = time.perf_counter()
    try:
        result = await run_in_threadpool(service.predict, payload.service_id, payload.sequence)
        record_ai_prediction(
            risk_detected=bool(result.detected_risks),
            status="success",
            duration_s=time.perf_counter() - started,
        )
        return result
    except Exception:
        record_ai_prediction(
            risk_detected=False,
            status="error",
            duration_s=time.perf_counter() - started,
        )
        raise
