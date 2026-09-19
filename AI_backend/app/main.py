from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from app.api.prediction import router as prediction_router
from app.api.rca import router as rca_router
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services.prediction_service import PredictionService
from app.services.openai_rca_service import OpenAIRCAService


settings = get_settings()
configure_logging(settings.log_level)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.prediction_service = PredictionService(
        settings.model_path, settings.risk_threshold
    )
    app.state.openai_rca_service = (
        OpenAIRCAService(
            settings.openai_api_key,
            settings.openai_model,
            settings.openai_timeout_seconds,
        )
        if settings.openai_api_key
        else None
    )
    logger.info(
        "RCA provider=%s model=%s",
        "openai" if app.state.openai_rca_service else "deterministic",
        settings.openai_model if app.state.openai_rca_service else "none",
    )
    app.state.started_at = time.time()
    yield
    app.state.prediction_service = None
    if app.state.openai_rca_service is not None:
        await app.state.openai_rca_service.client.close()
    app.state.openai_rca_service = None


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "GRU multi-label risk classification and explainable root-cause analysis. "
        "This service only recommends actions; it never changes Kubernetes resources."
    ),
    lifespan=lifespan,
)
app.include_router(prediction_router)
app.include_router(rca_router)


@app.middleware("http")
async def request_logging(request: Request, call_next):
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    started = time.perf_counter()
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request_id=%s method=%s path=%s status=%d duration_ms=%.2f",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
        (time.perf_counter() - started) * 1000,
    )
    return response


@app.exception_handler(RuntimeError)
async def runtime_error_handler(request: Request, exc: RuntimeError):
    logger.exception("Runtime failure on %s", request.url.path)
    return JSONResponse(status_code=503, content={"detail": "AI service is temporarily unavailable"})


@app.exception_handler(Exception)
async def unexpected_error_handler(request: Request, exc: Exception):
    logger.exception("Unexpected failure on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal AI service error"})


@app.get("/health", tags=["operations"])
async def health(request: Request):
    service = getattr(request.app.state, "prediction_service", None)
    return {
        "status": "healthy" if service is not None else "not_ready",
        "model_loaded": service is not None,
        "model_type": "gru_multi_label_risk",
        "input_shape": [service.sequence_length, len(service.feature_names)] if service else [12, 8],
        "risk_count": len(service.risk_names) if service else 6,
        "rca_provider": "openai" if getattr(request.app.state, "openai_rca_service", None) else "deterministic",
        "version": settings.app_version,
    }
