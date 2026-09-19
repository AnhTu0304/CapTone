from fastapi import APIRouter, Depends
from starlette.concurrency import run_in_threadpool

from app.api.dependencies import get_prediction_service
from app.schemas.prediction import PredictionRequest, PredictionResponse
from app.services.prediction_service import PredictionService


router = APIRouter(prefix="/api/v1", tags=["prediction"])


@router.post("/predict", response_model=PredictionResponse)
async def predict(
    payload: PredictionRequest,
    service: PredictionService = Depends(get_prediction_service),
) -> PredictionResponse:
    return await run_in_threadpool(service.predict, payload.service_id, payload.sequence)
