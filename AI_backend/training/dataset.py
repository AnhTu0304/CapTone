"""Entry point for preparing a risk-only eight-feature CSV dataset."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "trainGRU" / "prepare_risk_dataset.py"


if __name__ == "__main__":
    raise SystemExit(subprocess.call([sys.executable, str(SCRIPT), *sys.argv[1:]]))
