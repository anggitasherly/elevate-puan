import { isProblemType } from "./problem-taxonomy.js";

// Kontrak lintas-mode. Field khusus Next Growth hanya ditambahkan pada mode
// tersebut agar struktur dan perilaku Initial Diagnosis tetap tidak berubah.
export function toUnifiedDiagnosis(mode, raw) {
  if (!["initial", "next_growth"].includes(mode)) {
    throw new Error("Mode diagnosis tidak dikenal");
  }
  if (!raw || typeof raw !== "object") {
    throw new TypeError("Hasil diagnosis tidak valid");
  }

  const problem = raw.primary_problem?.problem_type;
  const common = {
    diagnosis_mode: mode,
    diagnosis_status: raw.diagnosis_status ?? "undetermined",
    primary_problem: isProblemType(problem) ? raw.primary_problem : null,
    contributing_problems: Array.isArray(raw.contributing_problems)
      ? raw.contributing_problems
      : [],
    confidence: raw.confidence ?? "none",
    evidence:
      mode === "initial"
        ? raw.primary_problem?.evidence ?? []
        : raw.evidence ?? [],
    opportunities:
      mode === "initial"
        ? Array.isArray(raw.opportunities)
          ? raw.opportunities
          : []
        : Array.isArray(raw.opportunities)
          ? raw.opportunities
          : Array.isArray(raw.growth_opportunities)
            ? raw.growth_opportunities
            : [],
    clarification:
      mode === "initial"
        ? {
            needs_clarification: raw.needs_clarification === true,
            question: raw.clarification_question ?? null,
            options: raw.clarification_options ?? [],
            field: raw.clarification_field ?? null,
            round: raw.clarification_round ?? 0,
          }
        : null,
    changes: mode === "next_growth" ? raw.changes ?? null : null,
    source_ids:
      mode === "next_growth"
        ? [
            ...new Set([
              ...(Array.isArray(raw.source_experiment_ids)
                ? raw.source_experiment_ids
                : []),
              ...(Array.isArray(raw.evaluated_experiment_ids)
                ? raw.evaluated_experiment_ids
                : []),
            ]),
          ]
        : [],
    raw,
  };

  if (mode === "initial") return common;

  return {
    ...common,
    business_id: raw.business_id ?? null,
    source_cycle_id: raw.source_cycle_id ?? null,
    source_cycle_number: raw.source_cycle_number ?? null,
    direction: raw.direction ?? null,
    direction_rationale: raw.direction_rationale ?? null,
    persistent_problems: Array.isArray(raw.persistent_problems)
      ? raw.persistent_problems
      : [],
    possible_causes: Array.isArray(raw.possible_causes)
      ? raw.possible_causes
      : [],
    source_references: raw.source_references ?? null,
    provenance: raw.provenance ?? null,
    eligibility: raw.eligibility ?? null,
    limitations: Array.isArray(raw.limitations) ? raw.limitations : [],
    history_summary_count: raw.history_summary_count ?? 0,
    generated_at: raw.generated_at ?? null,
  };
}
