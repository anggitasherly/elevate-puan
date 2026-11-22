
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.engines.pipeline import _validate_semantic_scores


# Data valid
assert _validate_semantic_scores(None) == {}
assert _validate_semantic_scores({"PB-001": 0.75}) == {
    "PB-001": 0.75
}
assert _validate_semantic_scores({"PB-001": 0}) == {
    "PB-001": 0.0
}
assert _validate_semantic_scores({"PB-001": None}) == {
    "PB-001": None
}

# Data tidak valid
invalid_values = [
    [],
    "0.75",
    {"PB-001": True},
    {"PB-001": float("nan")},
    {"PB-001": float("inf")},
    {"PB-001": -0.1},
    {"PB-001": 1.5},
    {"": 0.5},
]

for value in invalid_values:
    try:
        _validate_semantic_scores(value)
        print("GAGAL:", repr(value))
    except ValueError:
        print("LOLOS:", repr(value))

print("Semua pengujian semantic_scores selesai.")
