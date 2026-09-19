from pathlib import Path

import torch

from app.models.gru import ModelConfig, MultiHeadGRU


MODEL_PATH = Path(__file__).resolve().parents[1] / "saved_models" / "gru_model_8feature.pth"


def test_checkpoint_contract_is_twelve_by_eight_with_six_independent_risks():
    checkpoint = torch.load(MODEL_PATH, map_location="cpu", weights_only=True)
    assert checkpoint["sequence_length"] == 12
    assert checkpoint["feature_names"] == [
        "cpu", "ram", "disk", "request_rate", "latency", "http_5xx_rate",
        "pod_restart_count", "replica_count",
    ]
    assert checkpoint["risk_names"] == [
        "cpu_overload", "oom", "disk_full", "high_latency",
        "http_5xx_spike", "traffic_overload",
    ]


def test_each_risk_has_separate_binary_risk_head_only():
    model = MultiHeadGRU(ModelConfig())
    assert len(model.risk_heads) == 6
    assert len({id(head.weight) for head in model.risk_heads}) == 6
    assert not hasattr(model, "risk_head")

    risk_logits = model(torch.randn(2, 12, 8))
    assert risk_logits.shape == (2, 6)

    risk_probabilities = torch.sigmoid(risk_logits)
    assert torch.all((risk_probabilities >= 0) & (risk_probabilities <= 1))
