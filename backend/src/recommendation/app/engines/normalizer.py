import re
import math
from typing import Any


def clean_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip().lower()


def _number(value: str) -> float:
    return float(value.replace(",", "."))


def _range_match(text: str, unit_pattern: str):
    return re.search(
        rf"(?P<minimum>\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*(?P<maximum>\d+(?:[.,]\d+)?))?\s*{unit_pattern}",
        text,
        flags=re.IGNORECASE,
    )


def normalize_skill(value: Any) -> str:
    """Normalize skill labels to low, low_medium, medium, high, or unknown."""
    text = clean_text(value)
    if not text:
        return "unknown"

    normalized = text.replace("–", "-").replace("—", "-")
    normalized = re.sub(r"\s*-\s*", "-", normalized)

    if normalized in ("low", "rendah"):
        return "low"
    if normalized in (
        "low-medium", "low medium", "rendah-sedang", "rendah sedang",
    ):
        return "low_medium"
    if normalized in ("medium", "sedang", "intermediate"):
        return "medium"
    if normalized in ("high", "tinggi"):
        return "high"

    # Keep descriptive prose unknown; do not infer skill from arbitrary text.
    return "unknown"


def normalize_team_size(value: Any) -> list[str]:
    if value is None:
        return []
    raw_values = value if isinstance(value, list) else re.split(r"[;,]", str(value))
    mapping = {
        "one man show": "solo", "one-man show": "solo", "solo": "solo",
        "team kecil": "small", "tim kecil": "small", "small": "small",
        "team besar": "large", "tim besar": "large", "large": "large",
        "small team": "small",
        "large team": "large",
    }
    result = []
    for item in raw_values:
        normalized = mapping.get(clean_text(item), "unknown")
        if normalized != "unknown" and normalized not in result:
            result.append(normalized)
    return result


def normalize_business_stage(value: Any) -> list[str]:
    if value is None:
        return []
    raw_values = value if isinstance(value, list) else re.split(r"[;,]", str(value))
    result = []
    for item in raw_values:
        stage = clean_text(item)
        if stage and stage not in result:
            result.append(stage)
    return result


def normalize_time_needed(value: Any) -> dict:
    """Parse weekly workload, daily workload, calendar duration, and one-off effort.

    hours_per_week is the conservative upper end of an explicit weekly range.
    Daily-only estimates are converted using 7 calendar days and marked estimated.
    One-off preparation hours are kept separately and are never misrepresented as
    recurring weekly hours.
    """
    text = clean_text(value)
    result = {
        "raw": value,
        "hours_per_week": None,
        "min_hours_per_week": None,
        "max_hours_per_week": None,
        "duration_weeks_min": None,
        "duration_weeks_max": None,
        "one_time_hours_max": None,
        "status": "unknown",
        "basis": None,
    }
    if not text:
        return result

    # Calendar duration, including ranges separated by hyphen or en/em dash.
    week_matches = list(re.finditer(
        r"(?P<minimum>\d+)\s*(?:[-–—]\s*(?P<maximum>\d+))?\s*(?:minggu|weeks?)\b",
        text,
    ))
    if week_matches:
        # The first week range describes the overall duration in this catalogue.
        match = week_matches[0]
        result["duration_weeks_min"] = int(match.group("minimum"))
        result["duration_weeks_max"] = int(match.group("maximum") or match.group("minimum"))

        result["status"] = "parsed"
        result["basis"] = "calendar_duration"

    # Prefer an explicitly stated weekly workload when available.
    weekly = _range_match(
        text,
        r"(?:jam|hours?|hrs?)\s*(?:/|per\s+)?(?:minggu|week)\b",
    )
    if weekly:
        minimum = _number(weekly.group("minimum"))
        maximum = _number(weekly.group("maximum") or weekly.group("minimum"))
        result.update({
            "hours_per_week": maximum,
            "min_hours_per_week": minimum,
            "max_hours_per_week": maximum,
            "status": "parsed",
            "basis": "explicit_weekly",
        })
        return result

    # Daily-only minutes: use 7 calendar days, clearly marking it as an estimate.
        # Beban kerja harian dalam jam, dikonversi menjadi estimasi mingguan.
    daily_hours = _range_match(
        text,
        r"(?:jam|hours?|hrs?)\s*/?\s*(?:per\s*)?(?:hari|day)\b"
    )

    if daily_hours:
        minimum_hours = _number(daily_hours.group("minimum"))
        maximum_hours = _number(
            daily_hours.group("maximum") or daily_hours.group("minimum")
        )

        result.update({
            "hours_per_week": maximum_hours * 7,
            "min_hours_per_week": minimum_hours * 7,
            "max_hours_per_week": maximum_hours * 7,
            "status": "estimated",
            "basis": "daily_hours_x_7_calendar_days",
        })
        return result

    # Beban kerja harian dalam menit, dikonversi menjadi estimasi mingguan.
    daily = _range_match(
        text,
        r"(?:menit|minutes?|mins?)\s*/?\s*(?:per\s*)?(?:hari|day)\b"
    )

    if daily:
        minimum_minutes = _number(daily.group("minimum"))
        maximum_minutes = _number(
            daily.group("maximum") or daily.group("minimum")
        )

        result.update({
            "hours_per_week": maximum_minutes * 7 / 60,
            "min_hours_per_week": minimum_minutes * 7 / 60,
            "max_hours_per_week": maximum_minutes * 7 / 60,
            "status": "estimated",
            "basis": "daily_minutes_x_7_calendar_days",
        })
        return result

    # One-off planning/preparation hours are not weekly hours.
    one_off = re.search(
        r"(?P<minimum>\d+(?:[.,]\d+)?)\s*(?:[-–—]\s*(?P<maximum>\d+(?:[.,]\d+)?))?\s*(?:jam|hours?|hrs?)\b",
        text,
    )
    if one_off:
        maximum = _number(one_off.group("maximum") or one_off.group("minimum"))
        result["one_time_hours_max"] = maximum
        result["status"] = "partial"
        result["basis"] = "one_time_effort_only"

    return result


def _normalize_available_hours(value: Any) -> tuple[float | None, str, str | None]:
    """Convert Assessment bands to conservative minimum available hours."""

    if value is None:
        return None, "missing", None

    if isinstance(value, bool):
        return None, "invalid", None

    if isinstance(value, (int, float)):
        number = float(value)

        if not math.isfinite(number) or number < 0:
            return None, "invalid", None

        return number, "numeric", None

    text = clean_text(value).replace("–", "-").replace("—", "-")
    compact = re.sub(r"\s+", "", text)

    if re.search(r"(?:<|kurangdari|dibawah)5", compact) or "kurang dari 5" in text:
        return None, "needs_review", "under_5"

    if re.search(r"5-10", compact):
        return 5.0, "band_minimum", "5_to_10"

    if re.search(r"(?:>|lebihdari|diatas)10", compact) or "lebih dari 10" in text:
        return 10.0, "band_minimum", "over_10"

    try:
        number = float(text.replace(",", "."))

        if not math.isfinite(number) or number < 0:
            return None, "invalid", None

        return number, "numeric_string", None

    except ValueError:
        return None, "needs_review", "unrecognized_band"


def normalize_playbook(playbook: dict) -> dict:
    normalized = dict(playbook)
    normalized["skill_level"] = normalize_skill(playbook.get("skill_needed"))
    normalized["supported_team_sizes"] = normalize_team_size(playbook.get("team_size"))
    normalized["time_analysis"] = normalize_time_needed(playbook.get("time_needed"))
    normalized["supported_business_stages"] = normalize_business_stage(playbook.get("business_stage"))
    normalized["normalized"] = True
    return normalized



def normalize_constraints(constraints: dict) -> dict:
    """Normalize user constraints without inventing team-size categories."""
    normalized = dict(constraints)

    # 1. Normalize digital skill.
    normalized["skill_level"] = normalize_skill(
        constraints.get("digital_skill")
    )

    # 2. Preserve original team-size input for diagnostics.
    raw_team_size = constraints.get("team_size")
    normalized["team_size_raw"] = raw_team_size

    # 3. Convert valid integer representations consistently.
    team_size = None
    team_size_status = "missing"

    if isinstance(raw_team_size, bool):
        team_size_status = "invalid"

    elif isinstance(raw_team_size, int):
        if raw_team_size >= 1:
            team_size = raw_team_size
            team_size_status = "valid"
        else:
            team_size_status = "invalid"

    elif isinstance(raw_team_size, float):
        if raw_team_size >= 1 and raw_team_size.is_integer():
            team_size = int(raw_team_size)
            team_size_status = "valid"
        else:
            team_size_status = "invalid"

    elif isinstance(raw_team_size, str):
        raw_text = raw_team_size.strip()

        if not raw_text:
            team_size_status = "missing"
        elif re.fullmatch(r"\d+", raw_text):
            parsed_size = int(raw_text)

            if parsed_size >= 1:
                team_size = parsed_size
                team_size_status = "valid"
            else:
                team_size_status = "invalid"
        else:
            team_size_status = "invalid"

    # Feasibility currently only has a confirmed category for solo.
    # Do not invent thresholds for small and large teams.
    normalized["team_size"] = team_size
    normalized["team_size_category"] = (
        "solo" if team_size == 1 else "unknown"
    )
    normalized["team_size_status"] = team_size_status

    # 4. Normalize available experiment hours.
    hours, status, band = _normalize_available_hours(
        constraints.get("hours_per_week")
    )

    normalized["hours_per_week"] = hours
    normalized["hours_per_week_status"] = status
    normalized["hours_per_week_band"] = band

    return normalized
