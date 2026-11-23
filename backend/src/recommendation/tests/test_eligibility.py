

from app.engines.eligibility import (
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
