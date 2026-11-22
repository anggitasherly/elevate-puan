
from app.engines.ranking import rank_candidates


def sample_playbooks():
    return [
        {"id": "PB001", "title": "Playbook Satu"},
        {"id": "PB002", "title": "Playbook Dua"},
        {"id": "PB003", "title": "Playbook Tiga"},
        {"id": "PB004", "title": "Playbook Empat"},
    ]


def sample_scores():
    return [
        {
            "playbook_id": "PB001",
            "score": 80,
            "eligible_for_ranking": True,
            "breakdown": {"problem_match": 35},
        },
        {
            "playbook_id": "PB002",
            "score": 95,
            "eligible_for_ranking": True,
            "breakdown": {"problem_match": 35},
        },
        {
            "playbook_id": "PB003",
            "score": 70,
            "eligible_for_ranking": True,
            "breakdown": {"problem_match": 25},
        },
        {
            "playbook_id": "PB004",
            "score": 99,
            "eligible_for_ranking": False,
            "breakdown": {},
        },
    ]


def test_highest_score_becomes_primary():
    result = rank_candidates(sample_scores(), sample_playbooks())

    assert result["recommendations"][0]["playbook_id"] == "PB002"
    assert result["recommendations"][0]["role"] == "primary"


def test_remaining_candidates_become_alternatives():
    result = rank_candidates(sample_scores(), sample_playbooks())

    assert result["recommendations"][1]["role"] == "alternative"
    assert result["recommendations"][2]["role"] == "alternative"


def test_maximum_three_recommendations():
    result = rank_candidates(sample_scores(), sample_playbooks())

    assert result["returned_count"] == 3
    assert len(result["recommendations"]) == 3


def test_ineligible_candidate_is_excluded():
    result = rank_candidates(sample_scores(), sample_playbooks())

    ids = [
        item["playbook_id"]
        for item in result["recommendations"]
    ]

    assert "PB004" not in ids


def test_no_eligible_candidates():
    result = rank_candidates(
        [
            {
                "playbook_id": "PB001",
                "score": 90,
                "eligible_for_ranking": False,
            }
        ],
        sample_playbooks(),
    )

    assert result["status"] == "no_eligible_candidates"
    assert result["recommendations"] == []
    assert result["returned_count"] == 0


def test_missing_playbook_is_excluded():
    result = rank_candidates(
        [
            {
                "playbook_id": "PB999",
                "score": 90,
                "eligible_for_ranking": True,
            }
        ],
        sample_playbooks(),
    )

    assert result["status"] == "no_eligible_candidates"


def test_tie_breaking_is_deterministic():
    result = rank_candidates(
        [
            {
                "playbook_id": "PB002",
                "score": 90,
                "eligible_for_ranking": True,
            },
            {
                "playbook_id": "PB001",
                "score": 90,
                "eligible_for_ranking": True,
            },
        ],
        sample_playbooks(),
    )

    assert result["recommendations"][0]["playbook_id"] == "PB001"


def test_custom_result_limit_cannot_exceed_three():
    result = rank_candidates(
        sample_scores(),
        sample_playbooks(),
        max_results=10,
    )

    assert result["returned_count"] == 3


def test_zero_result_limit_is_rejected():
    try:
        rank_candidates(
            sample_scores(),
            sample_playbooks(),
            max_results=0,
        )
        assert False, "Expected ValueError"
    except ValueError:
        assert True
