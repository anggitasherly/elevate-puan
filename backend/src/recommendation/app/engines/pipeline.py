# Menyatukan modul Recommendation Engine:
# Normalizer -> Eligibility -> Feasibility -> Scoring -> Ranking

import math
from typing import Any

from app.engines.normalizer import (
    normalize_playbook,
    normalize_constraints,
)
from app.engines.eligibility import filter_eligible_playbooks
from app.engines.feasibility import evaluate_feasibility
from app.engines.scoring import score_candidate
from app.engines.ranking import rank_candidates
from app.schemas.recommendation import RecommendationResponse


def _to_dict(value: Any) -> dict:
    """Menerima payload berupa dict maupun Pydantic model."""
    if hasattr(value, "model_dump"):
        return value.model_dump()

    if isinstance(value, dict):
        return value

    raise TypeError("Request harus berupa dict atau Pydantic model.")


def _get_diagnosis_labels(request: dict) -> list[str]:
    """Mengambil ID problem label sesuai mode rekomendasi."""
    mode = request.get("mode")

    if mode == "initial":
        diagnosis = request.get("diagnosis") or {}
        return diagnosis.get("problem_labels") or []

    if mode == "next_growth":
        diagnosis = request.get("next_growth_diagnosis") or {}
        return diagnosis.get("problem_labels") or []

    return []


def _get_recommended_budget(financial):
    """
    Mengambil recommended_budget dengan validasi.
    Nilai harus berupa angka finite dan tidak negatif.
    """

    raw_budget = financial.get("recommended_budget")

    if isinstance(raw_budget, bool) or raw_budget is None:
        raise ValueError("Recommended budget tidak valid.")

    try:
        budget = float(raw_budget)
    except (TypeError, ValueError, OverflowError):
        raise ValueError("Recommended budget harus berupa angka.")

    if not math.isfinite(budget) or budget < 0:
        raise ValueError("Recommended budget tidak boleh negatif atau non-finite.")

    return budget


def _validate_semantic_scores(semantic_scores):
    """
    Memastikan semantic_scores berupa dict dengan skor
    numerik finite dalam rentang 0 sampai 1.
    None berarti skor belum tersedia.
    """

    if semantic_scores is None:
        return {}

    if not isinstance(semantic_scores, dict):
        raise ValueError("semantic_scores harus berupa dictionary.")

    validated = {}

    for playbook_id, raw_score in semantic_scores.items():

        if not isinstance(playbook_id, str) or not playbook_id.strip():
            raise ValueError("ID Playbook pada semantic_scores tidak valid.")

        if raw_score is None:
            validated[playbook_id] = None
            continue

        if isinstance(raw_score, bool):
            raise ValueError("Semantic score harus berupa angka.")

        try:
            score = float(raw_score)
        except (TypeError, ValueError, OverflowError):
            raise ValueError("Semantic score harus berupa angka.")

        if not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError("Semantic score harus berada pada rentang 0 sampai 1.")

        validated[playbook_id] = score

    return validated


def run_recommendation_pipeline(
    request: Any,
    semantic_scores: dict[str, float] | None = None,
    max_results: int = 3,
) -> dict[str, Any]:
    """Menjalankan keseluruhan Recommendation Engine."""

    payload = _to_dict(request)

    if payload.get("mode") not in ("initial", "next_growth"):
        raise ValueError("Mode rekomendasi tidak valid.")

    if (
        isinstance(max_results, bool)
        or not isinstance(max_results, int)
        or max_results < 1
    ):
        raise ValueError("max_results harus berupa integer minimal 1.")

    semantic_scores = _validate_semantic_scores(semantic_scores)

    # =========================================
    # 1. AMBIL DATA INPUT
    # =========================================

    business_context = payload.get("business_context") or {}
    constraints_input = payload.get("constraints") or {}
    financial = payload.get("financial_readiness") or {}

    diagnosis_labels = _get_diagnosis_labels(payload)

    recommended_budget = _get_recommended_budget(financial)

    # =========================================
    # 2. NORMALISASI
    # =========================================

    constraints = normalize_constraints(constraints_input)

    playbooks = [
        normalize_playbook(playbook)
        for playbook in payload.get("playbooks", [])
    ]

    # =========================================
    # 3. ELIGIBILITY
    # =========================================

    eligibility_result = filter_eligible_playbooks(
        playbooks=playbooks,
        diagnosis_labels=diagnosis_labels,
        recommended_budget=recommended_budget,
        growth_level=financial.get("growth_level"),
    )

    eligible_playbooks = eligibility_result["eligible"]
    rejected_candidates = list(eligibility_result["rejected"])
    eligibility_review = eligibility_result["needs_review"]

    # =========================================
    # 4. FEASIBILITY & SCORING
    # =========================================

    scored_candidates = []
    validated_playbooks = []
    feasibility_review = []

    for playbook in eligible_playbooks:

        # -------------------------------------
        # 4A. FEASIBILITY
        # -------------------------------------

        feasibility = evaluate_feasibility(
            playbook=playbook,
            constraints=constraints,
        )

        if feasibility["status"] == "needs_review":
            feasibility_review.append({
                "playbook_id": playbook.get("id"),
                "title": playbook.get("title"),
                "status": "needs_review",
                "checks": feasibility["checks"],
            })
            continue

        if not feasibility["is_feasible"]:
            rejected_candidates.append({
                "playbook_id": playbook.get("id"),
                "title": playbook.get("title"),
                "eligible": True,
                "feasible": False,
                "reasons": [
                    check["reason"]
                    for check in feasibility["checks"].values()
                    if check.get("reason")
                    and check.get("status") == "not_feasible"
                ],
            })
            continue

        # Hanya simpan kandidat yang lolos Feasibility.
        validated_playbooks.append(playbook)

        # -------------------------------------
        # 4B. SCORING
        # -------------------------------------

        score_result = score_candidate(
            playbook=playbook,
            diagnosis_labels=diagnosis_labels,
            business_stage=business_context.get("business_stage"),
            recommended_budget=recommended_budget,
            feasibility=feasibility,
            semantic_similarity=semantic_scores.get(
                playbook.get("id")
            ),
        )

        scored_candidates.append(score_result)

    # =========================================
    # 5. RANKING
    # =========================================

    ranking_result = rank_candidates(
        scored_candidates=scored_candidates,
        playbooks=validated_playbooks,
        max_results=max_results,
    )

    # =========================================
    # 6. OUTPUT
    # =========================================

    # Validasi kontrak output sebelum hasil dikirim ke pemanggil.
    response_payload = {
        "status": ranking_result["status"],
        "mode": payload["mode"],
        "recommendations": ranking_result["recommendations"],
        "eligible_candidate_count": len(eligible_playbooks),
        "feasible_candidate_count": len(scored_candidates),
        "returned_count": ranking_result["returned_count"],
        "diagnostics": {
            "total_playbooks": len(playbooks),
            "rejected_candidates": rejected_candidates,
            "feasibility_review": feasibility_review,
            "eligibility_review": eligibility_review,
        },
    }

    return RecommendationResponse.model_validate(
        response_payload
    ).model_dump()