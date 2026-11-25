from typing import Any

from app.engines.normalizer import normalize_time_needed

MAX_EXPERIMENT_DAYS = 7


# Level pertumbuhan (keputusan tim):
# Level 1 = playbook gratis, Level 2 = biaya sampai Rp300.000, Level 3 = di atas Rp300.000.
# Pengguna baru berada di Level 1. Playbook hanya boleh direkomendasikan kalau
# level pertumbuhan pengguna sama atau lebih tinggi dari level biaya playbook.
# cost_level 0 dan 1 sama-sama berarti Level 1 (gratis).
DEFAULT_GROWTH_LEVEL = 1


def required_growth_level(playbook: dict) -> int:
    raw = playbook.get("cost_level")
    if isinstance(raw, bool) or not isinstance(raw, (int, float)):
        return 1
    return max(1, int(raw))


def check_growth_level(playbook: dict, growth_level: int | None) -> tuple[bool, str]:
    user_level = (
        int(growth_level)
        if isinstance(growth_level, (int, float))
        and not isinstance(growth_level, bool)
        and growth_level >= 1
        else DEFAULT_GROWTH_LEVEL
    )
    required = required_growth_level(playbook)
    if user_level >= required:
        return True, "Level pertumbuhan sesuai dengan level biaya Playbook."
    return False, (
        f"Level pertumbuhan {user_level} belum mencukupi; "
        f"Playbook ini membutuhkan Level {required}."
    )


def check_label_match(playbook: dict, diagnosis_labels: list[str]) -> bool:
    playbook_labels = set(playbook.get("problem_labels") or [])
    diagnosis_labels = set(diagnosis_labels or [])
    return bool(playbook_labels & diagnosis_labels)


def check_budget(playbook: dict, recommended_budget: float) -> tuple[bool, str]:
    cost = playbook.get("cost_estimated")
    if cost is None:
        return False, "Biaya Playbook belum diketahui."
    try:
        cost = float(cost)
        budget = float(recommended_budget)
    except (TypeError, ValueError):
        return False, "Data biaya atau anggaran tidak valid."
    if cost < 0 or budget < 0:
        return False, "Biaya atau anggaran tidak boleh negatif."
    if cost > budget:
        return False, "Biaya melebihi recommended budget."
    return True, "Biaya sesuai anggaran."



def requires_time_scope(
    playbook: dict,
    max_days: int = MAX_EXPERIMENT_DAYS
) -> bool:
    """
    Menentukan apakah Playbook memerlukan penyusunan cakupan
    eksperimen karena durasi keseluruhannya melebihi batas.
    """
    analysis = normalize_time_needed(playbook.get("time_needed"))

    duration_weeks = analysis.get("duration_weeks_max")

    if duration_weeks is None:
        return False

    return duration_weeks * 7 > max_days


def check_time(
    playbook: dict,
    max_days: int = MAX_EXPERIMENT_DAYS
) -> tuple[bool, str]:
    analysis = normalize_time_needed(playbook.get("time_needed"))

    status = analysis.get("status")

    if status == "unknown":
        return False, "Format kebutuhan waktu belum dapat dikenali."

    if status == "partial":
        return False, (
            "Informasi kebutuhan waktu hanya parsial; "
            "beban kerja mingguan belum dapat dipastikan."
        )

    if status not in ("parsed", "estimated"):
        return False, "Status informasi waktu tidak valid."

    if requires_time_scope(playbook, max_days):
        return True, (
            f"Durasi keseluruhan lebih dari {max_days} hari; "
            f"perlu penyusunan cakupan eksperimen {max_days} hari."
        )

    return True, "Informasi kebutuhan waktu tersedia."

def evaluate_playbook(playbook: dict, diagnosis_labels: list[str], recommended_budget: float, growth_level: int | None = None) -> dict[str, Any]:
    reasons = []
    label_match = check_label_match(playbook, diagnosis_labels)
    if not label_match:
        reasons.append("Tidak memiliki kecocokan problem label.")
    budget_ok, budget_reason = check_budget(playbook, recommended_budget)
    if not budget_ok:
        reasons.append(budget_reason)
    level_ok, level_reason = check_growth_level(playbook, growth_level)
    if not level_ok:
        reasons.append(level_reason)
    time_ok, time_reason = check_time(playbook)
    requires_scope = requires_time_scope(playbook)
    if not time_ok:
        reasons.append(time_reason)
    return {
        "playbook_id": playbook.get("id"),
        "title": playbook.get("title"),
        "eligible": label_match and budget_ok and level_ok and time_ok,
        "requires_time_scope": requires_scope,
        "checks": {"label_match": label_match, "budget": budget_ok, "growth_level": level_ok, "time": time_ok},
        "reasons": reasons,
        "notes": [budget_reason, level_reason, time_reason],
    }


def filter_eligible_playbooks(
    playbooks: list[dict],
    diagnosis_labels: list[str],
    recommended_budget: float,
    growth_level: int | None = None,
) -> dict[str, list]:

    eligible = []
    rejected = []
    needs_review = []

    for playbook in playbooks:
        result = evaluate_playbook(
            playbook,
            diagnosis_labels,
            recommended_budget,
            growth_level,
        )

        if result["eligible"]:
            eligible.append({
                **playbook,
                "eligibility": result,
            })

        elif (
            result["checks"]["label_match"]
            and result["checks"]["budget"]
            and result["checks"]["growth_level"]
            and not result["checks"]["time"]
        ):
            needs_review.append(result)

        else:
            rejected.append(result)

    return {
        "eligible": eligible,
        "rejected": rejected,
        "needs_review": needs_review,
    }