from __future__ import annotations

from dataclasses import dataclass

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
