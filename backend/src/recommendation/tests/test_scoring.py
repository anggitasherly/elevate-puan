
from app.engines.scoring import (
    score_candidate,
    score_problem_match,
    score_budget_efficiency,
    score_business_stage,
)


def sample_playbook():
    return {
        "id": "PB001",
        "problem_labels": ["sales_conversion", "marketing"],
        "business_stage": "early",
        "cost_estimated": 100_000,
    }


def sample_feasibility():
    return {
        "is_feasible": True,
        "checks": {
            "skill": {"status": "feasible"},
            "team": {"status": "feasible"},
            "time": {"status": "feasible"},
        },
    }


def test_problem_match_full():
    score = score_problem_match(
        ["sales_conversion", "marketing"],
        ["sales_conversion", "marketing"],
    )
    assert score == 1.0


def test_problem_match_partial():
    score = score_problem_match(
        ["sales_conversion", "marketing"],
        ["sales_conversion"],
    )
    assert score == 0.5


def test_problem_match_no_match():
    score = score_problem_match(
        ["sales_conversion"],
        ["financial_management"],
    )
    assert score == 0.0


def test_budget_efficiency():
    score = score_budget_efficiency(200_000, 100_000)
    assert score == 0.5


def test_budget_zero():
    assert score_budget_efficiency(0, 0) == 1.0
    assert score_budget_efficiency(0, 100_000) == 0.0


def test_infeasible_candidate_rejected():
    result = score_candidate(
        playbook=sample_playbook(),
        diagnosis_labels=["sales_conversion"],
        business_stage="early",
        recommended_budget=200_000,
        feasibility={"is_feasible": False},
        semantic_similarity=0.9,
    )

    assert result["eligible_for_ranking"] is False
    assert result["score"] == 0.0


def test_candidate_scoring():
    result = score_candidate(
        playbook=sample_playbook(),
        diagnosis_labels=["sales_conversion", "marketing"],
        business_stage="early",
        recommended_budget=200_000,
        feasibility=sample_feasibility(),
        semantic_similarity=0.8,
    )

    assert result["eligible_for_ranking"] is True
    assert result["score"] == 91.0
    assert result["breakdown"]["problem_match"] == 35.0
    assert result["breakdown"]["semantic_relevance"] == 16.0
    assert result["breakdown"]["budget_efficiency"] == 5.0


def test_missing_semantic_similarity_is_zero():
    result = score_candidate(
        playbook=sample_playbook(),
        diagnosis_labels=["sales_conversion", "marketing"],
        business_stage="early",
        recommended_budget=200_000,
        feasibility=sample_feasibility(),
    )

    assert result["breakdown"]["semantic_relevance"] == 0.0


def test_business_stage_matches_multiple_supported_stages():
    assert score_business_stage(
        "berkembang",
        "baru; berkembang; mapan",
    ) == 1.0


def test_business_stage_does_not_match():
    assert score_business_stage(
        "baru",
        "berkembang; mapan",
    ) == 0.0


def test_business_stage_missing():
    assert score_business_stage(
        None,
        "baru; berkembang; mapan",
    ) == 0.0



def test_business_stage_matches_comma_separated_catalog_values():
    assert score_business_stage(
        "berkembang",
        "baru, berkembang, mapan",
    ) == 1.0


def test_business_stage_matches_list_of_normalized_values():
    assert score_business_stage(
        "mapan",
        ["baru", "berkembang", "mapan"],
    ) == 1.0


def test_business_stage_only_scores_exact_supported_stage():
    assert score_business_stage("baru", "berkembang, mapan") == 0.0
    assert score_business_stage("berkembang", "berkembang, mapan") == 1.0
