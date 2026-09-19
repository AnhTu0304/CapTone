from __future__ import annotations

import logging
from pathlib import Path

import numpy as np
import torch

from app.models.gru import ModelConfig, MultiHeadGRU
from app.schemas.prediction import GRUMetricPoint, HeadPrediction, PredictionResponse, RiskScore
from app.services.preprocessing import prepare_sequence


logger = logging.getLogger(__name__)

RISK_NAMES = [
    "cpu_overload",
    "oom",
    "disk_full",
    "high_latency",
    "http_5xx_spike",
    "traffic_overload",
]
PUBLIC_RISKS = {
    "cpu_overload": "CPU_OVERLOAD",
    "oom": "OOM",
    "disk_full": "DISK_FULL",
    "high_latency": "HIGH_LATENCY",
    "http_5xx_spike": "HTTP_5XX_SPIKE",
    "traffic_overload": "TRAFFIC_OVERLOAD",
}
class PredictionService:
    def __init__(self, model_path: Path, threshold_override: float | None = None):
        if not model_path.is_file():
            raise FileNotFoundError(f"GRU checkpoint not found: {model_path}")
        # weights_only avoids unpickling arbitrary Python objects. The current
        # checkpoint contains tensors plus primitive metadata and supports it.
        checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
        required = {
            "model_state_dict", "model_config", "feature_names", "risk_names",
            "scaler_mean", "scaler_std", "sequence_length", "risk_threshold",
        }
        missing = required.difference(checkpoint)
        if missing:
            raise ValueError(f"Invalid GRU checkpoint; missing: {sorted(missing)}")

        self.feature_names = list(checkpoint["feature_names"])
        self.risk_names = list(checkpoint["risk_names"])
        if self.risk_names != RISK_NAMES:
            raise ValueError("Checkpoint labels do not match the supported API mapping")
        self.sequence_length = int(checkpoint["sequence_length"])
        self.mean = np.asarray(checkpoint["scaler_mean"], dtype=np.float32)
        self.std = np.asarray(checkpoint["scaler_std"], dtype=np.float32)
        self.std[self.std < 1e-6] = 1.0
        self.threshold = float(
            threshold_override
            if threshold_override is not None
            else checkpoint["risk_threshold"]
        )
        checkpoint_thresholds = checkpoint.get("per_risk_thresholds", {})
        if threshold_override is not None:
            self.thresholds = {
                risk: float(threshold_override) for risk in self.risk_names
            }
        elif checkpoint_thresholds:
            if set(checkpoint_thresholds) != set(self.risk_names):
                raise ValueError("Checkpoint per-risk thresholds do not match risk_names")
            self.thresholds = {
                risk: float(checkpoint_thresholds[risk]) for risk in self.risk_names
            }
        else:
            self.thresholds = {risk: self.threshold for risk in self.risk_names}
        if any(not 0.0 <= value <= 1.0 for value in self.thresholds.values()):
            raise ValueError("Checkpoint per-risk thresholds must be between 0 and 1")
        self.public_thresholds = {
            PUBLIC_RISKS[risk]: round(self.thresholds[risk], 4)
            for risk in self.risk_names
        }
        config = ModelConfig(**checkpoint["model_config"])
        self.model = MultiHeadGRU(config)
        self.model.load_state_dict(checkpoint["model_state_dict"])
        self.model.eval()
        logger.info(
            "Loaded GRU checkpoint path=%s sequence_length=%d features=%d thresholds=%s",
            model_path,
            self.sequence_length,
            len(self.feature_names),
            self.public_thresholds,
        )

    def threshold_for_public_risk(self, public_risk: str) -> float:
        model_risk = next(
            risk for risk, public in PUBLIC_RISKS.items() if public == public_risk
        )
        return self.thresholds[model_risk]

    def predict(self, service_id: str, sequence: list[GRUMetricPoint]) -> PredictionResponse:
        values = prepare_sequence(sequence, self.feature_names, self.sequence_length)
        normalized = (values - self.mean) / self.std
        tensor = torch.from_numpy(normalized).unsqueeze(0)
        with torch.inference_mode():
            risk_logits = self.model(tensor)
            probabilities = torch.sigmoid(risk_logits)[0].cpu().numpy()

        detected: list[RiskScore] = []
        risk_outputs: dict[str, HeadPrediction] = {}
        for index, model_risk in enumerate(self.risk_names):
            confidence = float(probabilities[index])
            public_risk = PUBLIC_RISKS[model_risk]
            detected_risk = confidence >= self.thresholds[model_risk]
            risk_outputs[public_risk] = HeadPrediction(
                confidence=round(confidence, 6),
            )
            if not detected_risk:
                continue
            detected.append(RiskScore(
                risk_type=public_risk,
                confidence=round(confidence, 6),
            ))
        detected.sort(key=lambda item: item.confidence, reverse=True)
        return PredictionResponse(
            service_id=service_id,
            threshold=round(self.threshold, 4),
            thresholds=self.public_thresholds,
            detected_risks=detected,
            risk_outputs=risk_outputs,
        )
