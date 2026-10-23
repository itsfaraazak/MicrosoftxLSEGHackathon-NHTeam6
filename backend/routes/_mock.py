import json
import os
from pathlib import Path

from flask import jsonify

MOCKS = Path(__file__).parent.parent / "mocks"


def use_mocks() -> bool:
    return os.getenv("USE_MOCKS", "1") == "1"


def mock(name: str):
    return jsonify(json.loads((MOCKS / f"{name}.json").read_text()))
