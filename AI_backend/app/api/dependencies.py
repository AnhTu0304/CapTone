from fastapi import Request

from app.services.prediction_service import PredictionService
from app.services.openai_rca_service import OpenAIRCAService


def get_prediction_service(request: Request) -> PredictionService:
    service = getattr(request.app.state, "prediction_service", None)
    if service is None:
        raise RuntimeError("Prediction model is not initialized")
    return service


def get_openai_rca_service(request: Request) -> OpenAIRCAService | None:
    return getattr(request.app.state, "openai_rca_service", None)
