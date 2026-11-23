import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from app.engines.pipeline import _get_recommended_budget

# Data valid
assert _get_recommended_budget({"recommended_budget": 500000}) == 500000
assert _get_recommended_budget({"recommended_budget": 0}) == 0
assert _get_recommended_budget({"recommended_budget": "250000"}) == 250000

# Data tidak valid
invalid_values = [
    None,
    "abc",
    float("nan"),
    float("inf"),
    -100,
    True,
]

for value in invalid_values:
    try:
        _get_recommended_budget({"recommended_budget": value})
        print("GAGAL:", repr(value))
    except ValueError:
        print("LOLOS:", repr(value))

print("Semua pengujian selesai.")
