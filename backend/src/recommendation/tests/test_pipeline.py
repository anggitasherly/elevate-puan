
from app.engines.pipeline import run_recommendation_pipeline
from app.engines import pipeline as pipeline_module


def make_request():
    return {
        "mode": "initial",
        "business_context": {
            "business_id": "business-1",
            "business_stage": None,
        },
        "constraints": {
            "hours_per_week": 20,
            "team_size": 1,
            "digital_skill": "low",
        },
        "financial_readiness": {
            "recommended_budget": 500000,
        },
        "diagnosis": {
            "primary_problem": "sales",
            "problem_labels": ["sales"],
        },
        "playbooks": [],
    }


def test_pipeline_returns_no_candidates_when_playbooks_empty():
    result = run_recommendation_pipeline(make_request())

    assert result["status"] == "no_eligible_candidates"
    assert result["returned_count"] == 0


def test_pipeline_limits_recommendations_to_three():
    request = make_request()

    result = run_recommendation_pipeline(
        request,
        max_results=3,
    )

    assert result["returned_count"] <= 3


def test_pipeline_rejects_invalid_mode():
    request = make_request()
    request["mode"] = "invalid"

    try:
        run_recommendation_pipeline(request)
        assert False, "Seharusnya ValueError"
    except ValueError:
        assert True


def test_pipeline_rejects_zero_max_results():
    try:
        run_recommendation_pipeline(
            make_request(),
            max_results=0,
        )
        assert False, "Seharusnya ValueError"
    except ValueError:
        assert True


def test_pipeline_does_not_modify_original_request():
    request = make_request()
    original_playbooks = list(request["playbooks"])

    run_recommendation_pipeline(request)

    assert request["playbooks"] == original_playbooks

def make_multieweek_playbook():
    return {
        "id": "pb-test-001",
        "title": "Uji Strategi Penjualan",
        "problem_labels": ["sales"],
        "cost_estimated": 100000,
        "time_needed": "2 minggu",
        "skill_needed": "low",
        "team_size": "one man show; team kecil; team besar",
        "metric": "Jumlah pesanan",
        "step_1": "Membuat materi promosi",
        "step_2": "Mempublikasikan promosi",
    }


def test_multieweek_playbook_with_valid_scope_can_enter_scoring(
    monkeypatch,
):
    request = make_request()

    playbook = make_multieweek_playbook()

    playbook["experiment_scope"] = {
        "duration_days": 7,
        "steps": [
            "Membuat materi promosi",
            "Mempublikasikan promosi",
        ],
        "metric": "Jumlah pesanan",
    }

    request["playbooks"] = [playbook]

    scoring_called = []

    monkeypatch.setattr(
        pipeline_module,
        "evaluate_feasibility",
        lambda **kwargs: {
            "status": "feasible",
            "is_feasible": True,
            "checks": {},
        },
    )

    monkeypatch.setattr(
        pipeline_module,
        "score_candidate",
        lambda **kwargs: (
            scoring_called.append(kwargs)
            or {
                "playbook_id": "pb-test-001",
                "score": 80,
                "eligible_for_ranking": True,
                "reason": "Test recommendation",
                "breakdown": {},
            }
        ),
    )

    monkeypatch.setattr(
        pipeline_module,
        "rank_candidates",
        lambda **kwargs: {
            "status": "success",
            "recommendations": [{
                "role": "primary",
                "playbook_id": "pb-test-001",
                "score": 80.0,
                "score_breakdown": {},
                "playbook": {
                    "id": "pb-test-001",
                    "title": "Uji Strategi Penjualan",
                },
            }],
            "returned_count": 1,
        },
    )

    result = run_recommendation_pipeline(request)

    assert len(scoring_called) == 1
    assert result["feasible_candidate_count"] == 1


def test_partial_time_playbook_goes_to_eligibility_review():
    request = make_request()

    playbook = make_multieweek_playbook()
    playbook["time_needed"] = "sekitar 2 jam untuk persiapan awal"

    request["playbooks"] = [playbook]

    result = run_recommendation_pipeline(request)

    assert len(result["diagnostics"]["eligibility_review"]) == 1
    assert result["feasible_candidate_count"] == 0
    assert result["returned_count"] == 0


def test_eligibility_review_playbook_does_not_enter_scoring(monkeypatch):
    request = make_request()

    playbook = make_multieweek_playbook()
    playbook["time_needed"] = "sekitar 2 jam untuk persiapan awal"

    request["playbooks"] = [playbook]

    scoring_called = []

    monkeypatch.setattr(
        pipeline_module,
        "score_candidate",
        lambda **kwargs: scoring_called.append(kwargs),
    )

    result = run_recommendation_pipeline(request)

    assert len(result["diagnostics"]["eligibility_review"]) == 1
    assert scoring_called == []