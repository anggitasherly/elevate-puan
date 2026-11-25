
from app.engines.normalizer import team_category_from_size
from app.engines.feasibility import (
    check_skill_fit,
    check_team_fit,
    check_time_fit,
    evaluate_feasibility,
)


def sample_playbook():
    return {
        "id": "pb-001",
        "skill_level": "low",
        "supported_team_sizes": ["solo", "small"],
        "time_analysis": {
            "hours_per_week": 5,
            "status": "parsed",
        },
    }


def sample_constraints():
    return {
        "skill_level": "low",
        "team_size_category": "solo",
        "hours_per_week": 10,
    }


def test_skill_fit():
    result = check_skill_fit("low", "medium")

    assert result["status"] == "feasible"


def test_skill_adaptable():
    result = check_skill_fit("medium", "low_medium")

    assert result["status"] == "adaptable"
    assert result["adaptation"] is not None


def test_skill_needs_review():
    result = check_skill_fit("unknown", "low")

    assert result["status"] == "needs_review"


def test_team_fit():
    result = check_team_fit(
        ["solo", "small"],
        "solo",
    )

    assert result["status"] == "feasible"


def test_team_needs_review():
    result = check_team_fit(
        ["solo", "small"],
        "unknown",
    )

    assert result["status"] == "needs_review"


def test_time_fit():
    result = check_time_fit(5, 10)

    assert result["status"] == "feasible"


def test_time_not_feasible():
    result = check_time_fit(12, 5)

    assert result["status"] == "not_feasible"


def test_evaluate_feasibility():
    result = evaluate_feasibility(
        sample_playbook(),
        sample_constraints(),
    )

    assert result["status"] == "feasible"
    assert result["is_feasible"] is True


def test_evaluate_needs_review():
    constraints = sample_constraints()
    constraints["team_size_category"] = "unknown"

    result = evaluate_feasibility(
        sample_playbook(),
        constraints,
    )

    assert result["status"] == "needs_review"
    assert result["is_feasible"] is False


def test_team_fit_all_categories_with_numeric_team_size():
    result = check_team_fit(
        ["solo", "small", "large"],
        user_team_size=5,
    )

    assert result["status"] == "feasible"


def test_team_fit_solo_only_with_one_member():
    result = check_team_fit(
        ["solo"],
        user_team_size=1,
    )

    assert result["status"] == "feasible"


def test_team_fit_solo_playbook_usable_by_small_team():
    result = check_team_fit(
        ["solo"],
        user_team_size=3,
    )

    assert result["status"] == "feasible"


def test_team_fit_solo_playbook_usable_by_large_team():
    result = check_team_fit(
        ["solo"],
        user_team_size=8,
    )

    assert result["status"] == "feasible"


def test_team_fit_small_playbook_usable_by_small_team():
    result = check_team_fit(
        ["small", "large"],
        user_team_size=3,
    )

    assert result["status"] == "feasible"


def test_team_fit_small_playbook_not_for_solo():
    result = check_team_fit(
        ["small", "large"],
        user_team_size=1,
    )

    assert result["status"] == "not_feasible"


def test_team_fit_large_only_not_for_small_team():
    result = check_team_fit(
        ["large"],
        user_team_size=5,
    )

    assert result["status"] == "not_feasible"


def test_team_fit_large_only_for_large_team():
    result = check_team_fit(
        ["large"],
        user_team_size=6,
    )

    assert result["status"] == "feasible"


def test_team_fit_boundaries_between_categories():
    assert team_category_from_size(1) == "solo"
    assert team_category_from_size(2) == "small"
    assert team_category_from_size(5) == "small"
    assert team_category_from_size(6) == "large"
    assert team_category_from_size(0) == "unknown"


def test_team_fit_solo_small_with_multiple_members():
    result = check_team_fit(
        ["solo", "small"],
        user_team_size=3,
    )

    assert result["status"] == "feasible"


def test_team_fit_invalid_team_size():
    result = check_team_fit(
        ["solo", "small", "large"],
        user_team_size=0,
    )

    assert result["status"] == "needs_review"
