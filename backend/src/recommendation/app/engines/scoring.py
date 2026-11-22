
from typing import Any


WEIGHTS = {
    "problem_match": 35,
    "semantic_relevance": 20,
    "business_stage": 10,
    "time_fit": 15,
    "skill_team_fit": 10,
    "budget_efficiency": 10,
}


def _normalize_text(value: Any) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip().casefold()


def _score_status(status: str | None) -> float:
    """
    Mengubah hasil feasibility menjadi nilai:
    feasible = 1.0
    adaptable = 0.5
    needs_review / not_feasible / unknown = 0.0
    """
    if status == "feasible":
        return 1.0
    if status == "adaptable":
        return 0.5
    return 0.0


def score_problem_match(
    diagnosis_labels: list[str],
    playbook_labels: list[str],
) -> float:
    if not diagnosis_labels or not playbook_labels:
        return 0.0

    diagnosis_set = {
        _normalize_text(label)
        for label in diagnosis_labels
        if _normalize_text(label)
    }
    playbook_set = {
        _normalize_text(label)
        for label in playbook_labels
        if _normalize_text(label)
    }

    if not diagnosis_set:
        return 0.0

    matched = diagnosis_set.intersection(playbook_set)
    return len(matched) / len(diagnosis_set)



def score_business_stage(
    business_stage: str | None,
    playbook_stage: str | list[str] | None,
) -> float:
    """
    Memberi skor hanya jika tahap usaha pengguna cocok persis
    dengan salah satu tahap yang didukung Playbook.

    Katalog memuat pemisah titik koma maupun koma. Keduanya
    diperlakukan setara; business_age tidak digunakan sebagai pengganti.
    """
    user_stage = _normalize_text(business_stage)

    if not user_stage or not playbook_stage:
        return 0.0

    if isinstance(playbook_stage, list):
        raw_stages = playbook_stage
    else:
        import re
        raw_stages = re.split(r"[;,]", playbook_stage)

    supported_stages = {
        _normalize_text(stage)
        for stage in raw_stages
        if _normalize_text(stage)
    }

    return 1.0 if user_stage in supported_stages else 0.0

def score_budget_efficiency(
    recommended_budget: float,
    estimated_cost: float | None,
) -> float:
    if estimated_cost is None or estimated_cost < 0:
        return 0.0

    if recommended_budget < 0:
        return 0.0

    if recommended_budget == 0:
        return 1.0 if estimated_cost == 0 else 0.0

    if estimated_cost > recommended_budget:
        return 0.0

    # Biaya yang lebih kecil dibanding batas anggaran
    # mendapat nilai efisiensi lebih tinggi.
    return 1.0 - (estimated_cost / recommended_budget)


def score_candidate(
    playbook: dict[str, Any],
    diagnosis_labels: list[str],
    business_stage: str | None,
    recommended_budget: float,
    feasibility: dict[str, Any],
    semantic_similarity: float | None = None,
) -> dict[str, Any]:
    """
    Menghitung skor kandidat Playbook setelah eligibility
    dan feasibility.

    semantic_similarity harus berupa nilai 0 sampai 1
    dari proses semantic retrieval. Jika belum tersedia,
    nilainya 0 dan tidak dianggap sebagai bukti relevansi.
    """

    if not feasibility.get("is_feasible", False):
        return {
            "playbook_id": playbook.get("id"),
            "score": 0.0,
            "eligible_for_ranking": False,
            "reason": "Kandidat tidak lolos feasibility.",
            "breakdown": {},
        }

    if semantic_similarity is None:
        semantic_score = 0.0
    else:
        semantic_score = max(0.0, min(1.0, semantic_similarity))

    checks = feasibility.get("checks", {})

    skill_score = _score_status(
        checks.get("skill", {}).get("status")
    )
    team_score = _score_status(
        checks.get("team", {}).get("status")
    )
    time_score = _score_status(
        checks.get("time", {}).get("status")
    )

    skill_team_score = (skill_score + team_score) / 2

    normalized_components = {
        "problem_match": score_problem_match(
            diagnosis_labels,
            playbook.get("problem_labels", []),
        ),
        "semantic_relevance": semantic_score,
        "business_stage": score_business_stage(
            business_stage,
            playbook.get("business_stage"),
        ),
        "time_fit": time_score,
        "skill_team_fit": skill_team_score,
        "budget_efficiency": score_budget_efficiency(
            recommended_budget,
            playbook.get("cost_estimated"),
        ),
    }

    breakdown = {
        name: round(value * WEIGHTS[name], 2)
        for name, value in normalized_components.items()
    }

    total_score = round(sum(breakdown.values()), 2)

    return {
        "playbook_id": playbook.get("id"),
        "score": total_score,
        "eligible_for_ranking": True,
        "reason": None,
        "breakdown": breakdown,
    }
