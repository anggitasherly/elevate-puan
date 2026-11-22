import math
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator


class BaseSchema(BaseModel):
    model_config = ConfigDict(extra="allow")


# =========================================================
# BUSINESS CONTEXT
# Data bisnis yang sudah diverifikasi oleh Next.js
# =========================================================

class BusinessContext(BaseSchema):
    business_id: str
    business_category: str | None = None
    business_type: str | None = None
    business_age: str | None = None
    # Tahap usaha terpisah dari usia usaha. Jangan diturunkan
    # otomatis dari business_age atau financial growth_level.
    business_stage: str | None = None


# =========================================================
# DIAGNOSIS
# Hasil diagnosis yang sudah tersedia, bukan diagnosis ulang
# oleh Recommendation Engine.
# =========================================================

class Diagnosis(BaseSchema):
    primary_problem: str
    problem_labels: list[str] = Field(default_factory=list)
    diagnosis_summary: str | None = None
    evidence: list[Any] = Field(default_factory=list)
    confidence: str | None = None
    diagnosis_status: str | None = None


class NextGrowthDiagnosis(BaseSchema):
    direction: str | None = None
    persistent_problems: list[str] = Field(default_factory=list)
    possible_causes: list[str] = Field(default_factory=list)
    diagnosis_summary: str | None = None
    source_references: dict[str, Any] = Field(default_factory=dict)
    primary_problem: str | None = None
    problem_labels: list[str] = Field(default_factory=list)


# =========================================================
# USER CONSTRAINTS
# Hanya tiga field dari tabel constraints.
# =========================================================

class Constraints(BaseSchema):
    hours_per_week: int | str | None = None
    team_size: int | None = Field(default=None, ge=1)
    digital_skill: str | None = None


# =========================================================
# FINANCIAL READINESS
# Python hanya memakai recommended_budget sebagai batas.
# Perhitungan Affordable Loss tetap di sistem sebelumnya.
# =========================================================


class FinancialReadiness(BaseSchema):
    recommended_budget: float = Field(ge=0)
    affordable_loss: float | None = Field(default=None, ge=0)
    willingness_to_lose: float | None = Field(default=None, ge=0)
    risk_allowance_pct: float | None = None
    growth_level: int | None = None

    @field_validator("recommended_budget")
    @classmethod
    def validate_recommended_budget(cls, value):
        if not math.isfinite(value):
            raise ValueError(
                "recommended_budget harus berupa angka finite."
            )
        return value

# =========================================================
# EXPERIMENT HISTORY
# Riwayat eksperimen yang sudah selesai/dievaluasi.
# =========================================================

class ExperimentHistoryItem(BaseSchema):
    experiment_id: str
    status: str | None = None
    outcome: str | None = None
    learnings: str | None = None
    net_profit: float | None = None


# =========================================================
# GROWTH INSIGHTS
# Mengikuti struktur JSONB aktual di Supabase.
# =========================================================

class OverallAnalysis(BaseSchema):
    summary: str | None = None
    headline: str | None = None
    highlights: list[Any] = Field(default_factory=list)
    deepAnalysis: dict[str, Any] = Field(default_factory=dict)


class EvidenceSnapshot(BaseSchema):
    confidence: str | None = None
    explanation: str | None = None
    evaluatedCount: int | None = None
    experimentCount: int | None = None
    checkinCoveragePct: float | None = None
    analyzedExperimentCount: int | None = None


class LearningSummary(BaseSchema):
    overall_analysis: OverallAnalysis = Field(
        default_factory=OverallAnalysis
    )
    evidence_snapshot: EvidenceSnapshot = Field(
        default_factory=EvidenceSnapshot
    )
    working: list[str] = Field(default_factory=list)
    learnings: list[str] = Field(default_factory=list)
    not_working: list[Any] = Field(default_factory=list)
    possible_causes: list[str] = Field(default_factory=list)
    source_experiment_ids: list[str] = Field(default_factory=list)
    confidence_level: str | None = None
    analysis_status: str = "valid"


# =========================================================
# PLAYBOOK
# Data berasal dari playbooks + problem label relation.
# steps merupakan hasil normalisasi step_1 sampai step_7.
# =========================================================

class ExperimentScope(BaseSchema):
    duration_days: int = Field(ge=1, le=7)
    steps: list[str] = Field(min_length=1)
    metric: str

class Playbook(BaseSchema):
    id: str
    title: str
    problem_type: str | None = None
    problem_labels: list[str] = Field(default_factory=list)

    business_stage: str | None = None
    when_to_use: str | None = None
    when_not_to_use: str | None = None
    summary: str | None = None

    steps: list[str] = Field(default_factory=list)

    cost_level: int | None = None
    cost_estimated: float | None = Field(default=None, ge=0)
    cost_note: str | None = None

    time_needed: str | None = None
    team_size: str | None = None
    skill_needed: str | None = None

    metric: str | None = None
    risks: Any = None
    source: str | None = None

    experiment_scope: ExperimentScope | None = None


# =========================================================
# MAIN REQUEST
# Satu engine, dua mode input.
# =========================================================

class RecommendationRequest(BaseSchema):
    mode: Literal["initial", "next_growth"]

    business_context: BusinessContext
    constraints: Constraints
    financial_readiness: FinancialReadiness

    # Wajib untuk initial, tidak digunakan sebagai diagnosis
    # ulang pada mode next_growth.
    diagnosis: Diagnosis | None = None

    # Wajib untuk next_growth.
    learning_summary: LearningSummary | None = None
    next_growth_diagnosis: NextGrowthDiagnosis | None = None

    experiment_history: list[ExperimentHistoryItem] = Field(
        default_factory=list
    )

    playbooks: list[Playbook] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_mode_requirements(self):
        if self.mode == "initial":
            if self.diagnosis is None:
                raise ValueError(
                    "diagnosis wajib tersedia untuk mode initial."
                )

        if self.mode == "next_growth":
            if self.learning_summary is None:
                raise ValueError(
                    "learning_summary wajib tersedia untuk mode next_growth."
                )

            if self.next_growth_diagnosis is None:
                raise ValueError(
                    "next_growth_diagnosis wajib tersedia untuk mode next_growth."
                )

            if self.learning_summary.analysis_status != "valid":
                raise ValueError(
                    "Learning Summary harus berstatus valid."
                )

        return self


# =========================================================
# MAIN RESPONSE
# Kontrak output Recommendation Engine.
# =========================================================

class RecommendationResponse(BaseSchema):
    status: Literal["success", "no_eligible_candidates"]
    mode: Literal["initial", "next_growth"]

    recommendations: list[dict[str, Any]] = Field(
        default_factory=list
    )

    eligible_candidate_count: int = Field(default=0, ge=0)
    feasible_candidate_count: int = Field(default=0, ge=0)
    returned_count: int = Field(default=0, ge=0)

    diagnostics: dict[str, Any] = Field(
        default_factory=dict
    )

    @model_validator(mode="after")
    def validate_response_counts(self):
        actual_count = len(self.recommendations)

        if self.returned_count != actual_count:
            raise ValueError(
                "returned_count harus sama dengan jumlah recommendations."
            )

        if self.returned_count > self.feasible_candidate_count:
            raise ValueError(
                "returned_count tidak boleh melebihi feasible_candidate_count."
            )

        if self.feasible_candidate_count > self.eligible_candidate_count:
            raise ValueError(
                "feasible_candidate_count tidak boleh melebihi eligible_candidate_count."
            )

        if self.status == "success" and actual_count == 0:
            raise ValueError(
                "Status success harus memiliki minimal satu rekomendasi."
            )

        if self.status == "no_eligible_candidates" and actual_count != 0:
            raise ValueError(
                "Status no_eligible_candidates tidak boleh memiliki rekomendasi."
            )

        return self
