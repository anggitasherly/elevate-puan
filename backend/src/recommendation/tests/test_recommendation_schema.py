
import sys
import math
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT_DIR))

from pydantic import ValidationError
from app.schemas.recommendation import (
    FinancialReadiness,
    Constraints,
    RecommendationResponse,
)


# 1. Budget valid
FinancialReadiness(recommended_budget=500000)
FinancialReadiness(recommended_budget=0)

# 2. Budget tidak valid
for value in [float("nan"), float("inf"), float("-inf"), -100]:
    try:
        FinancialReadiness(recommended_budget=value)
        raise AssertionError(f"Budget seharusnya ditolak: {value}")
    except ValidationError:
        pass

# 3. Team size
Constraints(team_size=1)

try:
    Constraints(team_size=0)
    raise AssertionError("Team size 0 seharusnya ditolak.")
except ValidationError:
    pass

# 4. Response konsisten
response = RecommendationResponse(
    status="no_eligible_candidates",
    mode="initial",
    recommendations=[],
    eligible_candidate_count=0,
    feasible_candidate_count=0,
    returned_count=0,
)

assert response.returned_count == len(response.recommendations)

print("Semua pengujian schema berhasil.")
