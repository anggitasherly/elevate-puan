import math
from typing import Any

from app.engines.normalizer import team_category_from_size

SKILL_RANK = {"low": 1, "low_medium": 2, "medium": 3, "high": 4}


def check_skill_fit(required_skill: str, user_skill: str) -> dict[str, Any]:
    required = SKILL_RANK.get(required_skill)
    actual = SKILL_RANK.get(user_skill)
    if required is None or actual is None:
        return {"status": "needs_review", "reason": "Level kemampuan belum dapat dipastikan.", "adaptation": None}
    if actual >= required:
        return {"status": "feasible", "reason": "Kemampuan pengguna sesuai kebutuhan Playbook.", "adaptation": None}
    if required - actual == 1:
        return {
            "status": "adaptable",
            "reason": "Playbook membutuhkan sedikit penyesuaian kemampuan.",
            "adaptation": "Gunakan panduan langkah demi langkah, mulai dari tugas paling sederhana, dan fokus pada satu aktivitas utama.",
        }
    return {"status": "not_feasible", "reason": "Kesenjangan kemampuan terlalu besar untuk eksperimen ini.", "adaptation": None}


# Tingkatan tim. Playbook menuliskan tim paling kecil yang bisa menjalankannya:
# - "solo"  : bisa dipakai semua kategori (solo, tim kecil, tim besar)
# - "small" : bisa dipakai tim kecil dan tim besar, tidak untuk solo
# - "large" : hanya untuk tim besar
# Kalau satu Playbook menuliskan beberapa kategori, yang paling kecil dipakai.
TEAM_RANK = {"solo": 1, "small": 2, "large": 3}


def check_team_fit(supported_team_sizes: list[str], user_team_category: str | int | None = None, user_team_size: int | None = None) -> dict[str, Any]:
    if not supported_team_sizes:
        return {"status": "needs_review", "reason": "Informasi kebutuhan tim Playbook belum tersedia."}
    required_ranks = [TEAM_RANK[item] for item in supported_team_sizes if item in TEAM_RANK]
    if not required_ranks:
        return {"status": "needs_review", "reason": "Informasi kebutuhan tim Playbook belum tersedia."}
    required_rank = min(required_ranks)
    if isinstance(user_team_category, int) and not isinstance(user_team_category, bool):
        user_team_size, user_team_category = user_team_category, None
    if user_team_size is not None:
        if not isinstance(user_team_size, int) or isinstance(user_team_size, bool) or user_team_size < 1:
            return {"status": "needs_review", "reason": "Jumlah anggota tim tidak valid."}
        user_team_category = team_category_from_size(user_team_size)
    user_rank = TEAM_RANK.get(user_team_category)
    if user_rank is None:
        return {"status": "needs_review", "reason": "Jumlah atau kategori ukuran tim belum dapat dipastikan."}
    if user_rank >= required_rank:
        return {"status": "feasible", "reason": "Ukuran tim sesuai dengan kebutuhan Playbook."}
    return {"status": "not_feasible", "reason": "Playbook membutuhkan tim yang lebih besar dari tim yang tersedia."}


def check_time_fit(
    required_hours: float | None,
    available_hours: float | None,
) -> dict[str, Any]:
    if required_hours is None or available_hours is None:
        return {
            "status": "needs_review",
            "reason": "Data kebutuhan atau ketersediaan waktu belum cukup untuk dibandingkan.",
        }

    try:
        required = float(required_hours)
        available = float(available_hours)
    except (TypeError, ValueError, OverflowError):
        return {
            "status": "needs_review",
            "reason": "Data waktu tidak valid.",
        }

    if (
        not math.isfinite(required)
        or not math.isfinite(available)
        or required < 0
        or available < 0
    ):
        return {
            "status": "needs_review",
            "reason": "Data waktu tidak valid.",
        }

    if required <= available:
        return {
            "status": "feasible",
            "reason": "Kebutuhan waktu sesuai dengan waktu yang tersedia.",
        }

    return {
        "status": "not_feasible",
        "reason": "Kebutuhan waktu Playbook melebihi waktu yang tersedia.",
    }



def evaluate_feasibility(playbook: dict, constraints: dict) -> dict[str, Any]:
    skill_result = check_skill_fit(playbook.get("skill_level", "unknown"), constraints.get("skill_level", "unknown"))
    team_result = check_team_fit(
        playbook.get("supported_team_sizes", []),
        user_team_size=constraints.get("team_size"),
        user_team_category=constraints.get("team_size_category"),
    )
    time_analysis = playbook.get("time_analysis") or {}
    # The maximum of a stated weekly range is used to avoid understating workload.
    required_hours = time_analysis.get("max_hours_per_week")
    if required_hours is None:
        required_hours = time_analysis.get("hours_per_week")
    time_result = check_time_fit(required_hours, constraints.get("hours_per_week"))

    results = {"skill": skill_result, "team": team_result, "time": time_result}
    statuses = [result["status"] for result in results.values()]
    if "not_feasible" in statuses:
        overall_status = "not_feasible"
    elif "needs_review" in statuses:
        overall_status = "needs_review"
    elif "adaptable" in statuses:
        overall_status = "adaptable"
    else:
        overall_status = "feasible"
    adaptations = [result["adaptation"] for result in results.values() if result.get("adaptation")]
    return {
        "playbook_id": playbook.get("id"),
        "status": overall_status,
        "is_feasible": overall_status in ("feasible", "adaptable"),
        "checks": results,
        "adaptations": adaptations,
    }
