from __future__ import annotations

import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from pydantic import BaseModel

from app.services.evaluation_service import evaluate_checkpoint_file
from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/model", tags=["model_management"])

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAVED_MODELS_DIR = PROJECT_ROOT / "saved_models"
SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)


class SwitchModelRequest(BaseModel):
    filename: Optional[str] = None
    model_path: Optional[str] = None


class EvaluateModelRequest(BaseModel):
    filename: Optional[str] = None
    model_path: Optional[str] = None


def resolve_model_path(filename: Optional[str], model_path: Optional[str]) -> Path:
    if model_path:
        p = Path(model_path)
        if not p.is_absolute():
            p = PROJECT_ROOT / p
        return p
    if filename:
        return SAVED_MODELS_DIR / filename
    raise HTTPException(status_code=400, detail="Either filename or model_path must be provided")


@router.post("/upload")
async def upload_model(file: UploadFile = File(...)):
    """
    Upload a new PyTorch model checkpoint (.pth), save to saved_models,
    and immediately run evaluation benchmark against test dataset.
    """
    if not file.filename.endswith((".pth", ".pt", ".onnx")):
        raise HTTPException(status_code=400, detail="Only .pth, .pt, or .onnx files are supported")

    dest_path = SAVED_MODELS_DIR / file.filename
    try:
        with dest_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
    except Exception as e:
        logger.exception("Failed to save uploaded model")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")

    logger.info(f"Model saved to {dest_path}, starting benchmark evaluation...")

    # Run evaluation
    try:
        eval_result = evaluate_checkpoint_file(dest_path)
    except Exception as e:
        logger.warning(f"Model saved but evaluation failed: {e}")
        eval_result = {"evaluated": False, "error": str(e)}

    return {
        "success": True,
        "message": f"Mô hình {file.filename} đã được lưu và kiểm chuẩn thành công",
        "filename": file.filename,
        "file_path": str(dest_path),
        "file_size_bytes": dest_path.stat().st_size,
        "metrics": eval_result,
    }


@router.post("/evaluate")
async def evaluate_model(payload: EvaluateModelRequest):
    """
    Evaluate an existing model checkpoint on disk against the holdout test dataset.
    """
    target_path = resolve_model_path(payload.filename, payload.model_path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"Model file not found: {target_path}")

    try:
        eval_result = evaluate_checkpoint_file(target_path)
        return {
            "success": True,
            "filename": target_path.name,
            "metrics": eval_result,
        }
    except Exception as e:
        logger.exception("Evaluation failed")
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.post("/switch")
async def switch_model(request: Request, payload: SwitchModelRequest):
    """
    Hot-reload active AI prediction service with the new model checkpoint.
    Zero-downtime memory replacement.
    """
    target_path = resolve_model_path(payload.filename, payload.model_path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail=f"Model file not found: {target_path}")

    try:
        new_service = PredictionService(target_path)
        request.app.state.prediction_service = new_service
        request.app.state.active_model_path = str(target_path)
        logger.info(f"Hot-swapped AI model to: {target_path}")

        return {
            "success": True,
            "message": f"Đã chuyển đổi thành công sang mô hình {target_path.name}",
            "active_model": target_path.name,
            "active_model_path": str(target_path),
            "input_shape": [new_service.sequence_length, len(new_service.feature_names)],
            "risk_count": len(new_service.risk_names),
            "feature_names": new_service.feature_names,
            "risk_names": new_service.risk_names,
            "threshold": new_service.threshold,
        }
    except Exception as e:
        logger.exception("Failed to hot-reload model")
        raise HTTPException(status_code=500, detail=f"Hot-reload failed: {str(e)}")


@router.get("/active")
async def get_active_model(request: Request):
    """
    Get current active in-memory model status.
    """
    service = getattr(request.app.state, "prediction_service", None)
    active_path = getattr(request.app.state, "active_model_path", os.getenv("GRU_MODEL_PATH", "saved_models/gru_model_8feature.pth"))
    return {
        "status": "healthy" if service is not None else "not_ready",
        "model_loaded": service is not None,
        "active_model_path": active_path,
        "active_filename": Path(active_path).name,
        "input_shape": [service.sequence_length, len(service.feature_names)] if service else [12, 8],
        "risk_count": len(service.risk_names) if service else 7,
    }
