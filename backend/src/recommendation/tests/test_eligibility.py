

from app.engines.eligibility import (
    check_growth_level,
    check_label_match,
    check_budget,
    check_time,
    evaluate_playbook,
    filter_eligible_playbooks,
)


def sample_playbook():
    return {
        "id": "pb-001",
        "title": "Optimasi Konten Instagram",
        "problem_labels": ["low_awareness"],
        "cost_estimated": 100000,
        "time_needed": "5 jam/minggu",
    }


def test_label_match():
    playbook = sample_playbook()

    assert check_label_match(
        playbook,
        ["low_awareness"],
    )


def test_budget_passed():
    assert check_budget(
        sample_playbook(),
        150000,
    )[0]


def test_budget_rejected():
    assert not check_budget(
        sample_playbook(),
        50000,
    )[0]



def test_time_within_limit():
    assert check_time(
        sample_playbook()
    )[0]


def test_time_exceeds_limit():
    playbook = sample_playbook()
    playbook["time_needed"] = "2-3 minggu"

    is_valid, message = check_time(playbook)

    assert is_valid is True
    assert "cakupan eksperimen 7 hari" in message


def test_evaluate_playbook():
    result = evaluate_playbook(
        sample_playbook(),
        ["low_awareness"],
        150000,
    )

    assert result["eligible"] is True


def test_filter_eligible_playbooks():
    result = filter_eligible_playbooks(
        [sample_playbook()],
        ["low_awareness"],
        150000,
    )

    assert len(result["eligible"]) == 1
    assert len(result["rejected"]) == 0


def test_free_playbook_allowed_for_level_one():
    playbook = {"cost_level": 0, "cost_estimated": 0}

    assert check_growth_level(playbook, 1)[0] is True


def test_cost_level_one_is_also_free_level():
    playbook = {"cost_level": 1, "cost_estimated": 0}

    assert check_growth_level(playbook, 1)[0] is True


def test_paid_playbook_blocked_for_level_one():
    playbook = {"cost_level": 2, "cost_estimated": 115500}

    allowed, reason = check_growth_level(playbook, 1)

    assert allowed is False
    assert "Level 2" in reason


def test_paid_playbook_allowed_for_level_two():
    playbook = {"cost_level": 2, "cost_estimated": 300000}

    assert check_growth_level(playbook, 2)[0] is True


def test_level_three_playbook_blocked_for_level_two():
    playbook = {"cost_level": 3, "cost_estimated": 500000}

    assert check_growth_level(playbook, 2)[0] is False
    assert check_growth_level(playbook, 3)[0] is True


def test_missing_growth_level_defaults_to_level_one():
    paid = {"cost_level": 2, "cost_estimated": 115500}
    free = {"cost_level": 0, "cost_estimated": 0}

    assert check_growth_level(paid, None)[0] is False
    assert check_growth_level(free, None)[0] is True


def test_missing_cost_level_does_not_block():
    assert check_growth_level({"cost_estimated": 100000}, 1)[0] is True


def test_filter_rejects_paid_playbook_for_level_one_user():
    paid = {
        "id": "pb-paid",
        "title": "Berbayar",
        "problem_labels": ["low_awareness"],
        "cost_level": 2,
        "cost_estimated": 115500,
        "time_needed": "5 jam/minggu",
    }
    free = {
        "id": "pb-free",
        "title": "Gratis",
        "problem_labels": ["low_awareness"],
        "cost_level": 0,
        "cost_estimated": 0,
        "time_needed": "5 jam/minggu",
    }

    result = filter_eligible_playbooks(
        [paid, free],
        ["low_awareness"],
        500000,
        growth_level=1,
    )

    assert [item["id"] for item in result["eligible"]] == ["pb-free"]
    assert any(
        "Level pertumbuhan" in reason
        for item in result["rejected"]
        for reason in item["reasons"]
    )

    result_level_two = filter_eligible_playbooks(
        [paid, free],
        ["low_awareness"],
        500000,
        growth_level=2,
    )

    assert len(result_level_two["eligible"]) == 2

