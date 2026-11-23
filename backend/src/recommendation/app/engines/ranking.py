# Modul yang mengubah hasil scoring menjadi urutan rekomendasi yang siap dipakai pipeline.

# Aturannya kita kunci:
# - Hanya kandidat eligible_for_ranking=True yang boleh masuk.
# - Skor tertinggi menjadi primary.
# - Kandidat berikutnya menjadi alternative.
# - Maksimal tiga rekomendasi.
# - Jika tidak ada kandidat layak, status no_eligible_candidates.
# - Jika skor sama, urutkan berdasarkan ID Playbook agar hasil konsisten.

import math
from typing import Any


MAX_RECOMMENDATIONS = 3


def rank_candidates(
    scored_candidates: list[dict[str, Any]],
    playbooks: list[dict[str, Any]],
    max_results: int = MAX_RECOMMENDATIONS,
) -> dict[str, Any]:
    """
    Mengurutkan kandidat yang sudah dinilai oleh scoring engine.

    Hanya kandidat yang lolos feasibility dan ditandai
    eligible_for_ranking yang dapat masuk hasil rekomendasi.
    """

    if max_results < 1:
        raise ValueError("max_results minimal 1.")

    # Batas rekomendasi selalu maksimal 3.
    result_limit = min(max_results, MAX_RECOMMENDATIONS)

    playbook_map = {
        playbook["id"]: playbook
        for playbook in playbooks
        if playbook.get("id")
    }

    eligible_candidates = []

    for candidate in scored_candidates:
        if not candidate.get("eligible_for_ranking", False):
            continue

        playbook_id = candidate.get("playbook_id")
        playbook = playbook_map.get(playbook_id)

        # Jangan menghasilkan rekomendasi tanpa data Playbook.
        if not playbook:
            continue

        raw_score = candidate.get("score")

        if isinstance(raw_score, bool):
            continue

        try:
            score = float(raw_score)
        except (TypeError, ValueError, OverflowError):
            continue

        if not math.isfinite(score) or not 0 <= score <= 100:
            continue

        eligible_candidates.append({
            "playbook_id": playbook_id,
            "score": score,
            "breakdown": candidate.get("breakdown", {}),
            "playbook": playbook,
        })

    # Urutan deterministik: skor tertinggi, lalu ID.
    eligible_candidates.sort(
        key=lambda item: (-item["score"], item["playbook_id"])
    )

    selected_candidates = eligible_candidates[:result_limit]

    recommendations = []

    for index, candidate in enumerate(selected_candidates):
        recommendations.append({
            "role": "primary" if index == 0 else "alternative",
            "playbook_id": candidate["playbook_id"],
            "score": candidate["score"],
            "score_breakdown": candidate["breakdown"],
            "playbook": candidate["playbook"],
        })

    return {
        "status": (
            "success"
            if recommendations
            else "no_eligible_candidates"
        ),
        "recommendations": recommendations,
        "eligible_candidate_count": len(eligible_candidates),
        "returned_count": len(recommendations),
    }
