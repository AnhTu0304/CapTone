from __future__ import annotations

import asyncio
import hashlib
import hmac
import logging
import os
import re
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from starlette.concurrency import run_in_threadpool

from app.core.config import get_settings
from app.core.internal_auth import require_internal_auth
from app.services.evaluation_service import evaluate_checkpoint_file
from app.services.prediction_service import PredictionService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/model",
    tags=["model_management"],
    dependencies=[Depends(require_internal_auth)],
)

PROJECT_ROOT = Path(__file__).resolve().parents[2]
SAVED_MODELS_DIR = (PROJECT_ROOT / "saved_models").resolve()
SAVED_MODELS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_MODEL_EXTENSIONS = {".pth", ".pt"}
SAFE_FILENAME_RE = re.compile(r"^[A-Za-z0-9._-]+$")
UPLOAD_CHUNK_BYTES = 1024 * 1024
_MODEL_OP_LOCK = asyncio.Lock()


class SwitchModelRequest(BaseModel):
    filename: Optional[str] = Field(default=None, max_length=255)
    model_path: Optional[str] = Field(default=None, max_length=512)


class EvaluateModelRequest(BaseModel):
    filename: Optional[str] = Field(default=None, max_length=255)
    model_path: Optional[str] = Field(default=None, max_length=512)


def sanitize_model_filename(raw_filename: Optional[str]) -> str:
    if not raw_filename or not isinstance(raw_filename, str):
        raise HTTPException(status_code=400, detail="Invalid model filename")
    if "/" in raw_filename or "\\" in raw_filename or ".." in raw_filename:
        raise HTTPException(status_code=400, detail="Invalid model filename")
    name = Path(raw_filename).name.strip()
    if not name or name in {".", ".."} or not SAFE_FILENAME_RE.match(name):
        raise HTTPException(status_code=400, detail="Invalid model filename")
    if Path(name).suffix.lower() not in ALLOWED_MODEL_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only .pth or .pt files are supported")
    return name


def resolve_model_path(filename: Optional[str], model_path: Optional[str]) -> Path:
    if filename:
        safe_name = sanitize_model_filename(filename)
        raw_target = SAVED_MODELS_DIR / safe_name
        if raw_target.is_symlink():
            raise HTTPException(status_code=400, detail="Symbolic links are not allowed")
        candidate = raw_target.resolve()
    elif model_path:
        if ".." in model_path or "%2e" in model_path.lower() or "%2f" in model_path.lower() or "%5c" in model_path.lower():
            raise HTTPException(status_code=400, detail="Invalid model path traversal sequence")
        raw = Path(model_path)
        if raw.is_symlink():
            raise HTTPException(status_code=400, detail="Symbolic links are not allowed")
        if raw.is_absolute():
            candidate = raw.resolve()
        else:
            raw_joined = SAVED_MODELS_DIR / raw
            if raw_joined.is_symlink():
                raise HTTPException(status_code=400, detail="Symbolic links are not allowed")
            candidate = raw_joined.resolve()
        if candidate.suffix.lower() not in ALLOWED_MODEL_EXTENSIONS:
            raise HTTPException(status_code=400, detail="Only .pth or .pt files are supported")
    else:
        raise HTTPException(status_code=400, detail="Either filename or model_path must be provided")

    if not candidate.is_relative_to(SAVED_MODELS_DIR):
        raise HTTPException(status_code=400, detail="Model path outside saved_models directory is forbidden")
    return candidate


@router.post("/upload")
async def upload_model(request: Request, file: UploadFile = File(...)):
    """
    Upload a new PyTorch model checkpoint (.pth/.pt), save securely inside saved_models,
    and immediately run evaluation benchmark against test dataset.
    """
    safe_original_name = sanitize_model_filename(file.filename)
    stored_name = f"{uuid.uuid4().hex[:12]}_{safe_original_name}"
    dest_path = (SAVED_MODELS_DIR / stored_name).resolve()
    if not dest_path.is_relative_to(SAVED_MODELS_DIR):
        raise HTTPException(status_code=400, detail="Invalid destination path")

    max_bytes = get_settings().max_model_upload_bytes
    expected_sha256 = getattr(request.state, "expected_upload_sha256", None)
    chunk_hasher = hashlib.sha256()
    total_bytes = 0
    try:
        with dest_path.open("wb") as buffer:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                total_bytes += len(chunk)
                if total_bytes > max_bytes:
                    raise HTTPException(status_code=413, detail="Uploaded model exceeds maximum allowed size")
                chunk_hasher.update(chunk)
                buffer.write(chunk)
        if total_bytes == 0:
            raise HTTPException(status_code=400, detail="Uploaded model file is empty")
        if expected_sha256 and not hmac.compare_digest(chunk_hasher.hexdigest(), expected_sha256):
            raise HTTPException(status_code=401, detail="Request body digest mismatch")
    except HTTPException:
        dest_path.unlink(missing_ok=True)
        raise
    except Exception:
        dest_path.unlink(missing_ok=True)
        logger.exception("Failed to save uploaded model")
        raise HTTPException(status_code=500, detail="Failed to save uploaded model")

    logger.info("Model saved to %s (%d bytes), starting benchmark evaluation...", dest_path.name, total_bytes)

    async with _MODEL_OP_LOCK:
        try:
            eval_result = await run_in_threadpool(evaluate_checkpoint_file, dest_path)
        except Exception as e:
            logger.warning("Model saved but evaluation failed: %s", type(e).__name__)
            eval_result = {"evaluated": False, "error": "Model evaluation failed"}

    return {
        "success": True,
        "message": f"Mô hình {stored_name} đã được lưu và kiểm chuẩn thành công",
        "filename": stored_name,
        "file_path": stored_name,
        "file_size_bytes": total_bytes,
        "metrics": eval_result,
    }


@router.post("/evaluate")
async def evaluate_model(payload: EvaluateModelRequest):
    """
    Evaluate an existing model checkpoint on disk against the holdout test dataset.
    """
    target_path = resolve_model_path(payload.filename, payload.model_path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Model file not found")

    async with _MODEL_OP_LOCK:
        try:
            eval_result = await run_in_threadpool(evaluate_checkpoint_file, target_path)
            return {
                "success": True,
                "filename": target_path.name,
                "metrics": eval_result,
            }
        except Exception:
            logger.exception("Evaluation failed")
            raise HTTPException(status_code=500, detail="Model evaluation failed")


@router.post("/switch")
async def switch_model(request: Request, payload: SwitchModelRequest):
    """
    Hot-reload active AI prediction service with the new model checkpoint.
    Zero-downtime memory replacement.
    """
    target_path = resolve_model_path(payload.filename, payload.model_path)
    if not target_path.is_file():
        raise HTTPException(status_code=404, detail="Model file not found")

    async with _MODEL_OP_LOCK:
        try:
            new_service = await run_in_threadpool(PredictionService, target_path)
            request.app.state.prediction_service = new_service
            request.app.state.active_model_path = target_path.name
            logger.info("Hot-swapped AI model to: %s", target_path.name)

            return {
                "success": True,
                "message": f"Đã chuyển đổi thành công sang mô hình {target_path.name}",
                "active_model": target_path.name,
                "active_model_path": target_path.name,
                "input_shape": [new_service.sequence_length, len(new_service.feature_names)],
                "risk_count": len(new_service.risk_names),
                "feature_names": new_service.feature_names,
                "risk_names": new_service.risk_names,
                "threshold": new_service.threshold,
            }
        except Exception:
            logger.exception("Failed to hot-reload model")
            raise HTTPException(status_code=500, detail="Model hot-reload failed")


@router.get("/active")
async def get_active_model(request: Request):
    """
    Get current active in-memory model status.
    """
    service = getattr(request.app.state, "prediction_service", None)
    active_name = Path(
        getattr(request.app.state, "active_model_path", os.getenv("GRU_MODEL_PATH", "gru_model_8feature.pth"))
    ).name
    return {
        "status": "healthy" if service is not None else "not_ready",
        "model_loaded": service is not None,
        "active_model_path": active_name,
        "active_filename": active_name,
        "input_shape": [service.sequence_length, len(service.feature_names)] if service else [12, 8],
        "risk_count": len(service.risk_names) if service else 7,
    }
