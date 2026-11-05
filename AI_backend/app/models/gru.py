from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import torch
from torch import nn


@dataclass
class ModelConfig:
    input_size: int = 8
    hidden_size: int = 96
    num_layers: int = 2
    dropout: float = 0.20
    shared_size: int = 64
    num_risks: int = 6


class MultiHeadGRU(nn.Module):
    """Shared GRU encoder with one independent binary head per risk type."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config
        self.gru = nn.GRU(
            input_size=config.input_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.shared = nn.Sequential(
            nn.LayerNorm(config.hidden_size),
            nn.Linear(config.hidden_size, config.shared_size),
            nn.ReLU(),
            nn.Dropout(config.dropout),
        )
        self.risk_heads = nn.ModuleList([
            nn.Linear(config.shared_size, 1) for _ in range(config.num_risks)
        ])

    def forward(self, x):
        _, hidden = self.gru(x)
        features = self.shared(hidden[-1])
        return torch.cat([head(features) for head in self.risk_heads], dim=1)


class MultiHeadLSTM(nn.Module):
    """Shared LSTM encoder with one independent binary head per risk type."""

    def __init__(self, config: ModelConfig):
        super().__init__()
        self.config = config
        self.lstm = nn.LSTM(
            input_size=config.input_size,
            hidden_size=config.hidden_size,
            num_layers=config.num_layers,
            dropout=config.dropout if config.num_layers > 1 else 0.0,
            batch_first=True,
        )
        self.shared = nn.Sequential(
            nn.LayerNorm(config.hidden_size),
            nn.Linear(config.hidden_size, config.shared_size),
            nn.ReLU(),
            nn.Dropout(config.dropout),
        )
        self.risk_heads = nn.ModuleList([
            nn.Linear(config.shared_size, 1) for _ in range(config.num_risks)
        ])

    def forward(self, x):
        _, (hidden, _) = self.lstm(x)
        features = self.shared(hidden[-1])
        return torch.cat([head(features) for head in self.risk_heads], dim=1)


def build_risk_model(checkpoint: dict[str, Any]) -> nn.Module:
    """Auto-detect GRU vs LSTM from checkpoint state_dict or metadata and load weights."""
    config = ModelConfig(**checkpoint["model_config"])
    state_dict = checkpoint["model_state_dict"]
    is_lstm = (
        any(str(k).startswith("lstm.") for k in state_dict.keys())
        or "LSTM" in str(checkpoint.get("model_type", "")).upper()
        or "LSTM" in str(checkpoint.get("architecture", "")).upper()
    )
    model: nn.Module = MultiHeadLSTM(config) if is_lstm else MultiHeadGRU(config)
    model.load_state_dict(state_dict)
    model.eval()
    return model
