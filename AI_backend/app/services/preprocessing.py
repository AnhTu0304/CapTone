from __future__ import annotations

import numpy as np

from app.schemas.prediction import GRUMetricPoint


def prepare_sequence(
    sequence: list[GRUMetricPoint],
    feature_names: list[str],
    sequence_length: int,
) -> np.ndarray:
    """Build the canonical eight-feature tensor in checkpoint feature order."""
    rows: list[list[float]] = []
    if len(sequence) != sequence_length:
        raise ValueError(f"GRU sequence must contain exactly {sequence_length} timesteps")
    for point in sequence:
        values = point.model_dump()
        row = []
        for model_name in feature_names:
            row.append(float(values[model_name]))
        rows.append(row)

    return np.asarray(rows, dtype=np.float32)
