from app.engines.eligibility import check_time
from app.engines.normalizer import (
    normalize_skill,
    normalize_team_size,
    normalize_time_needed,
    normalize_playbook,
    normalize_constraints,
    normalize_business_stage,
)

def test_normalize_skill():
    assert normalize_skill("low") == "low"
    assert normalize_skill("rendah") == "low"
    assert normalize_skill("low–medium") == "low_medium"
    assert normalize_skill("sedang") == "medium"
    assert normalize_skill(None) == "unknown"

def test_normalize_team_size():
    result = normalize_team_size(
        "one man show; team kecil; team besar"
    )

    assert result == ["solo", "small", "large"]

def test_normalize_time_needed():
    result = normalize_time_needed("10-15 menit/hari")

    assert result["status"] == "estimated"
    assert result["hours_per_week"] is not None

def test_normalize_playbook():
    result = normalize_playbook({
        "id": "pb-001",
        "skill_needed": "low",
        "team_size": "one man show; team kecil",
        "time_needed": "5 jam/minggu",
    })

    assert result["skill_level"] == "low"
    assert result["supported_team_sizes"] == ["solo", "small"]
    assert result["time_analysis"]["hours_per_week"] == 5

def test_normalize_constraints():
    result = normalize_constraints({
        "hours_per_week": 10,
        "team_size": 2,
        "digital_skill": "rendah",
    })

    assert result["hours_per_week"] == 10
    assert result["skill_level"] == "low"
    assert result["team_size_category"] == "small"


def test_normalize_business_stage():
    result = normalize_business_stage(
        "baru; berkembang; mapan"
    )

    assert result == ["baru", "berkembang", "mapan"]


def test_normalize_business_stage_removes_duplicates():
    result = normalize_business_stage(
        "Baru; berkembang; baru"
    )

    assert result == ["baru", "berkembang"]


def test_normalize_business_stage_missing():
    assert normalize_business_stage(None) == []


def test_normalize_actual_playbook_skill_variants():
    assert normalize_skill("low - medium") == "low_medium"
    assert normalize_skill("rendah–sedang") == "low_medium"
    assert normalize_skill("medium") == "medium"


def test_normalize_time_needed_with_plus_sign():
    result = normalize_time_needed("11+ jam/minggu")

    assert result["status"] == "parsed"
    assert result["max_hours_per_week"] == 11
    assert result["hours_per_week"] == 11


def test_time_needed_with_plus_sign_is_accepted_by_eligibility():
    time_ok, _ = check_time({"time_needed": "11+ jam/minggu"})

    assert time_ok is True


def test_time_needed_plain_range_still_parsed():
    result = normalize_time_needed("5-10 jam/minggu")

    assert result["status"] == "parsed"
    assert result["max_hours_per_week"] == 10