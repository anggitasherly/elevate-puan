
import json
from pathlib import Path
from copy import deepcopy

from app.engines.pipeline import run_recommendation_pipeline
from app.engines.eligibility import check_time


DATASET_PATH = Path(__file__).parent / "playbook(1).txt"

LABELS = [
    "capacity_limit",
    "inconsistent_promo",
    "low_awareness",
    "low_conversion",
    "narrow_market",
    "product_stagnation",
    "weak_finance_habits",
    "weak_retention",
]


def load_playbooks():
    raw = json.loads(DATASET_PATH.read_text(encoding="utf-8"))

    if isinstance(raw, list) and len(raw) == 1:
        if "complete_playbooks" in raw[0]:
            raw = raw[0]["complete_playbooks"]

    if isinstance(raw, str):
        raw = json.loads(raw)

    if not isinstance(raw, list):
        raise ValueError("Format dataset tidak valid.")

    return raw


def prepare_scope_simulation(playbooks):
    result = deepcopy(playbooks)

    for playbook in result:
        valid, reason = check_time(playbook)

        if (
            valid
            and "perlu penyusunan cakupan eksperimen" in reason.lower()
        ):
            steps = playbook.get("steps") or []

            if steps:
                playbook["experiment_scope"] = {
                    "duration_days": 7,
                    "steps": [steps[0]],
                    "metric": playbook.get("metric"),
                }

    return result


def run_validation(playbooks, label, scenario):
    request = {
        "mode": "initial",
        "business_context": {
            "business_id": "validation-business",
            "business_stage": "berkembang",
        },
        "constraints": {
            "hours_per_week": 20,
            "team_size": 1,
            "digital_skill": "high",
        },
        "financial_readiness": {
            "recommended_budget": 1_000_000,
        },
        "diagnosis": {
            "primary_problem": label,
            "problem_labels": [label],
        },
        "playbooks": playbooks,
    }

    result = run_recommendation_pipeline(request)
    diagnostics = result["diagnostics"]

    print(f"\nTIME SCOPE REVIEW — {label}")

    for item in diagnostics["time_scope_review"]:
        print({
            "playbook_id": item.get("playbook_id"),
            "title": item.get("title"),
            "status": item.get("status"),
            "reason": item.get("reason"),
        })

    recommendation_items = result["recommendations"]

    # Ambil ID saja untuk ringkasan hasil validasi.
    recommendations = [
        item["playbook_id"]
        for item in recommendation_items
    ]

    # Tampilkan detail Playbook yang benar-benar direkomendasikan.
    for recommendation in recommendation_items:
        playbook = recommendation["playbook"]

        print({
            "playbook_id": recommendation["playbook_id"],
            "title": playbook.get("title"),
            "validated_time_scope": playbook.get(
                "validated_time_scope"
            ),
        })

    print(
        f"{scenario:12} | {label:22} | "
        f"eligible={result['eligible_candidate_count']:2} | "
        f"scored={result['feasible_candidate_count']:2} | "
        f"returned={result['returned_count']} | "
        f"eligibility_review={len(diagnostics['eligibility_review']):2} | "
        f"time_review={len(diagnostics['time_scope_review']):2} | "
        f"feasibility_review={len(diagnostics['feasibility_review']):2} | "
        f"rejected={len(diagnostics['rejected_candidates']):2} | "
        f"recommendations={recommendations}"
    )

    if scenario == "RAW" and label == "capacity_limit":
        print("\nDETAIL DIAGNOSTIK RAW - capacity_limit")

        for group in [
            "time_scope_review",
            "feasibility_review",
            "eligibility_review",
            "rejected_candidates",
        ]:
            print(f"\n--- {group} ---")

            for item in diagnostics.get(group, []):
                print(json.dumps(item, ensure_ascii=False, indent=2))

def main():
    playbooks = load_playbooks()

    ids = [item.get("id") for item in playbooks]

    if len(playbooks) != 61 or len(set(ids)) != 61:
        raise ValueError(
            f"Dataset harus berisi 61 ID unik. "
            f"Jumlah ditemukan: {len(playbooks)}"
        )

    print(f"\nDataset berhasil dibaca: {len(playbooks)} Playbook")
    print("=" * 180)

    for label in LABELS:
        run_validation(playbooks, label, "RAW")

    print("\n" + "=" * 180)
    print("SCOPE SIMULATION (khusus pengujian teknis)")
    print("=" * 180)

    scoped_playbooks = prepare_scope_simulation(playbooks)

    for label in LABELS:
        run_validation(scoped_playbooks, label, "SCOPE TEST")


if __name__ == "__main__":
    main()
