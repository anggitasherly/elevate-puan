from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def valid_payload():
    return {
        "mode": "initial",
        "business_context": {
            "business_id": "business-test-001",
            "business_category": "kuliner",
            "business_type": "ready_stock",
            "business_age": "1-3 tahun",
        },
        "constraints": {
            "hours_per_week": 10,
            "team_size": 1,
            "digital_skill": "medium",
        },
        "financial_readiness": {
            "recommended_budget": 100000,
        },
        "diagnosis": {
            "primary_problem": "Penjualan stagnan",
            "problem_labels": ["sales_conversion"],
        },
        "playbooks": [],
    }


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200
    assert response.json()["success"] is True


def test_health_endpoint():
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_recommendations_endpoint_returns_valid_empty_result():
    response = client.post("/recommendations", json=valid_payload())

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "initial"
    assert body["status"] == "no_eligible_candidates"
    assert body["recommendations"] == []
    assert body["returned_count"] == 0


def test_recommendations_endpoint_rejects_missing_initial_diagnosis():
    payload = valid_payload()
    payload.pop("diagnosis")

    response = client.post("/recommendations", json=payload)

    assert response.status_code == 422


def test_recommendations_endpoint_rejects_negative_budget():
    payload = valid_payload()
    payload["financial_readiness"]["recommended_budget"] = -1

    response = client.post("/recommendations", json=payload)

    assert response.status_code == 422


def test_recommendations_endpoint_returns_primary_and_alternatives(monkeypatch):
    from app import main as main_module

    playbook = {
        "id": "pb-test-001",
        "title": "Uji Strategi Penjualan",
        "problem_labels": ["sales_conversion"],
        "cost_estimated": 50000,
        "steps": ["Membuat materi promosi"],
    }
    expected = {
        "status": "success",
        "mode": "initial",
        "recommendations": [
            {
                "role": "primary",
                "playbook_id": "pb-test-001",
                "score": 85,
                "score_breakdown": {"problem_match": 35},
                "playbook": playbook,
            }
        ],
        "eligible_candidate_count": 1,
        "feasible_candidate_count": 1,
        "returned_count": 1,
        "diagnostics": {
            "total_playbooks": 1,
            "rejected_candidates": [],
            "feasibility_review": [],
            "time_scope_review": [],
        },
    }
    called = {}

    def fake_pipeline(request, max_results):
        called["mode"] = request.mode
        called["max_results"] = max_results
        return expected

    monkeypatch.setattr(
        main_module,
        "run_recommendation_pipeline",
        fake_pipeline,
    )
    payload = valid_payload()
    payload["playbooks"] = [playbook]

    response = client.post("/recommendations", json=payload)

    assert response.status_code == 200
    assert response.json()["status"] == "success"
    assert response.json()["recommendations"][0]["role"] == "primary"
    assert called == {"mode": "initial", "max_results": 3}
