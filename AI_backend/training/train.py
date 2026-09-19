"""Compatibility entry point for the existing GRU trainer."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "trainGRU" / "GRU_Risk_Classification.py"
DEFAULT_MODEL = Path(__file__).resolve().parents[1] / "saved_models" / "gru_model_8feature.pth"
DEFAULT_DATA = ROOT / "trainGRU" / "dataset_risk_8feature"
DEFAULT_REPORT = ROOT / "trainGRU" / "risk_evaluation_report_8feature.json"


if __name__ == "__main__":
    arguments = sys.argv[1:]
    if "--output" not in arguments:
        arguments = [*arguments, "--output", str(DEFAULT_MODEL)]
    if "--dataset" not in arguments:
        arguments = [*arguments, "--dataset", str(DEFAULT_DATA)]
    if "--report" not in arguments:
        arguments = [*arguments, "--report", str(DEFAULT_REPORT)]
    raise SystemExit(subprocess.call([sys.executable, str(SCRIPT), *arguments]))
