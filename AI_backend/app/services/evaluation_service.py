from __future__ import annotations

import csv
import logging
import time
from pathlib import Path
from typing import Any, Dict

import numpy as np
import torch
from torch.utils.data import DataLoader, TensorDataset

from app.models.gru import ModelConfig, MultiHeadGRU

logger = logging.getLogger(__name__)

FEATURES = [
    "cpu", "ram", "disk", "request_rate", "latency",
    "http_5xx_rate", "pod_restart_count", "replica_count"
]

DEFAULT_TEST_CSV = Path(__file__).resolve().parents[1] / "data" / "test.csv"


def safe_div(num: float, den: float) -> float:
    return float(num / den) if den > 0 else 0.0


def evaluate_checkpoint_file(
    model_path: Path,
    test_csv_path: Path = DEFAULT_TEST_CSV,
    batch_size: int = 128,
) -> Dict[str, Any]:
    """
    Evaluates a PyTorch GRU checkpoint on benchmark holdout test data.
    Computes Accuracy, Precision, Recall, F1, FPR, and Latency.
    """
    if not model_path.is_file():
        raise FileNotFoundError(f"Model file not found: {model_path}")

    checkpoint = torch.load(model_path, map_location="cpu", weights_only=True)
    required = {"model_state_dict", "model_config", "feature_names", "risk_names", "scaler_mean", "scaler_std"}
    missing = required.difference(checkpoint)
    if missing:
        raise ValueError(f"Invalid checkpoint missing fields: {sorted(missing)}")

    model_config = ModelConfig(**checkpoint["model_config"])
    model = MultiHeadGRU(model_config)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    total_params = sum(p.numel() for p in model.parameters())
    feature_names = list(checkpoint["feature_names"])
    risk_names = list(checkpoint["risk_names"])
    threshold = float(checkpoint.get("risk_threshold", 0.79))
    sequence_length = int(checkpoint.get("sequence_length", 12))

    mean = np.asarray(checkpoint["scaler_mean"], dtype=np.float32)
    std = np.asarray(checkpoint["scaler_std"], dtype=np.float32)
    std[std < 1e-6] = 1.0

    if not test_csv_path.is_file():
        logger.warning(f"Test CSV not found at {test_csv_path}, trying fallback")
        return {
            "evaluated": False,
            "error": f"Test dataset not found at {test_csv_path}",
            "model_path": str(model_path),
            "parameters_count": total_params,
            "feature_names": feature_names,
            "risk_names": risk_names,
            "threshold": threshold,
        }

    # Load sequences and available labels
    sequences = []
    labels = []
    with test_csv_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            seq = [
                [float(row[f"t{step:02d}_{feat}"]) for feat in feature_names]
                for step in range(1, sequence_length + 1)
            ]
            # Match risks from test.csv
            row_labels = [
                float(row[f"label_{risk}"]) if f"label_{risk}" in row else 0.0
                for risk in risk_names
            ]
            sequences.append(seq)
            labels.append(row_labels)

    x_test = np.asarray(sequences, dtype=np.float32)
    y_test = np.asarray(labels, dtype=np.float32)

    # Scale inputs
    x_test = (x_test - mean) / std

    # Measure inference time
    dataset = TensorDataset(torch.from_numpy(x_test))
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False)

    outputs = []
    start_time = time.perf_counter()
    with torch.inference_mode():
        for (batch_x,) in loader:
            logits = model(batch_x)
            probs = torch.sigmoid(logits)
            outputs.append(probs.cpu().numpy())
    total_time = time.perf_counter() - start_time
    avg_latency_ms = (total_time / len(x_test)) * 1000

    probabilities = np.concatenate(outputs, axis=0)
    predictions = probabilities >= threshold
    truth = y_test.astype(bool)

    # Calculate overall & per-risk metrics
    per_risk = {}
    total_tp = 0
    total_fp = 0
    total_tn = 0
    total_fn = 0

    for idx, risk in enumerate(risk_names):
        tp = int(np.logical_and(predictions[:, idx], truth[:, idx]).sum())
        fp = int(np.logical_and(predictions[:, idx], ~truth[:, idx]).sum())
        tn = int(np.logical_and(~predictions[:, idx], ~truth[:, idx]).sum())
        fn = int(np.logical_and(~predictions[:, idx], truth[:, idx]).sum())

        prec = safe_div(tp, tp + fp)
        rec = safe_div(tp, tp + fn)
        f1 = safe_div(2 * prec * rec, prec + rec)
        fpr = safe_div(fp, fp + tn)
        acc = safe_div(tp + tn, tp + fp + tn + fn)

        total_tp += tp
        total_fp += fp
        total_tn += tn
        total_fn += fn

        per_risk[risk] = {
            "accuracy": round(acc * 100, 2),
            "precision": round(prec * 100, 2),
            "recall": round(rec * 100, 2),
            "f1_score": round(f1, 4),
            "false_positive_rate": round(fpr * 100, 2),
            "support": int(truth[:, idx].sum()),
        }

    overall_acc = safe_div(total_tp + total_tn, total_tp + total_fp + total_tn + total_fn)
    overall_prec = safe_div(total_tp, total_tp + total_fp)
    overall_rec = safe_div(total_tp, total_tp + total_fn)
    overall_f1 = safe_div(2 * overall_prec * overall_rec, overall_prec + overall_rec)
    overall_fpr = safe_div(total_fp, total_fp + total_tn)

    return {
        "evaluated": True,
        "sample_count": len(x_test),
        "parameters_count": total_params,
        "overall": {
            "accuracy": round(overall_acc * 100, 2),
            "precision": round(overall_prec * 100, 2),
            "recall": round(overall_rec * 100, 2),
            "f1_score": round(overall_f1, 4),
            "false_positive_rate": round(overall_fpr * 100, 2),
            "latency_ms": round(avg_latency_ms, 2),
        },
        "per_risk": per_risk,
        "threshold": threshold,
        "dataset_name": test_csv_path.name,
    }
