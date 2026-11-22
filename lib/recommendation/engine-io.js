// Penyusun data untuk mesin rekomendasi Python dan pembentuk jawaban ke frontend.
// Murni (tanpa akses database atau jaringan). Tidak menghitung ulang skor, ranking, atau Affordable Loss.

export const PROBLEM_CODES = [
  "low_awareness",
  "low_conversion",
  "weak_retention",
  "capacity_limit",
  "narrow_market",
  "inconsistent_promo",
  "product_stagnation",
  "weak_finance_habits",
];

const toNumber = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const textOrNull = (value) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

// Satu baris tabel playbooks (24 kolom) menjadi bentuk yang dibaca Python.
// problem_labels diambil dari problem_type (cocok untuk 61 dari 61 playbook di ekspor Anggita).
// steps disusun dari step_1 sampai step_7 apa adanya.

export function toEnginePlaybook(row) {
  const steps = [1, 2, 3, 4, 5, 6, 7]
    .map((index) => textOrNull(row?.[`step_${index}`]))
    .filter(Boolean);

  const problemType = textOrNull(row?.problem_type);

  // Ambil label dari relasi playbook_problem_labels.
  const relationLabels = Array.isArray(row?.problem_labels)
    ? row.problem_labels
    : [];

  const problemLabels = [
    ...new Set(
      relationLabels
        .map((label) => {
          if (typeof label === "string") return label;
          return textOrNull(label?.id);
        })
        .filter((label) => PROBLEM_CODES.includes(label))
    ),
  ];

  return {
    id: String(row?.id ?? ""),
    title: String(row?.title ?? ""),
    problem_type: problemType,
    problem_labels: problemLabels,
    business_stage: textOrNull(row?.business_stage),
    when_to_use: textOrNull(row?.when_to_use),
    when_not_to_use: textOrNull(row?.when_not_to_use),
    summary: textOrNull(row?.summary),
    steps,
    cost_level: toNumber(row?.cost_level),
    cost_estimated: toNumber(row?.cost_estimated),
    cost_note: textOrNull(row?.cost_note),
    time_needed: textOrNull(row?.time_needed),
    team_size: textOrNull(row?.team_size),
    skill_needed: textOrNull(row?.skill_needed),
    metric: textOrNull(row?.metric),
    risks: row?.risks ?? null,
    source: textOrNull(row?.source),
  };
}


// Mengembalikan { ok: true, payload } atau { ok: false, missing: [...] }.
export function buildEnginePayload({ businessId, assessment, constraints, financial, playbooks }) {
  const missing = [];

  const diagnosis = assessment?.ai_diagnosis ?? null;
  const primaryProblem = diagnosis?.primary_problem?.problem_type;
  const diagnosisReady =
    diagnosis?.diagnosis_status === "diagnosed" && PROBLEM_CODES.includes(primaryProblem);

  if (!assessment) missing.push("assessment");
  else if (!diagnosisReady) missing.push("diagnosis");

  // Kategori tim asli dari jawaban pengguna (bukan angka perkiraan).
  const hours = toNumber(constraints?.hours_per_week);
  const skill = textOrNull(constraints?.digital_skill);
  const storedTeamSize = toNumber(constraints?.team_size);
  // Angka tim (1, 2, 5) dikirim apa adanya agar cocok dengan mesin Python asli Anggita.
  const teamSize = storedTeamSize;

  if (hours === null || !skill || teamSize === null) {
    missing.push("constraints");
  }

  const recommendedBudget = toNumber(financial?.recommended_budget);
  if (recommendedBudget === null || recommendedBudget < 0) {
    missing.push("financial_readiness");
  }

  const enginePlaybooks = (Array.isArray(playbooks) ? playbooks : []).map(toEnginePlaybook);
  if (enginePlaybooks.length === 0) missing.push("playbooks");

  if (missing.length > 0) return { ok: false, missing };

  const confidence = diagnosis?.primary_problem?.confidence ?? diagnosis?.confidence ?? null;

  return {
    ok: true,
    payload: {
      mode: "initial",
      business_context: {
        business_id: String(businessId),
        // Tahap usaha belum ada di aplikasi dan tidak boleh diturunkan dari usia usaha.
        business_stage: null,
      },
      constraints: {
        hours_per_week: hours,
        team_size: teamSize,
        digital_skill: skill,
      },
      financial_readiness: {
        recommended_budget: recommendedBudget,
        affordable_loss: toNumber(financial?.affordable_loss),
        willingness_to_lose: toNumber(financial?.willingness_to_lose),
        risk_allowance_pct: toNumber(financial?.risk_allowance_pct),
        growth_level: toNumber(financial?.growth_level),
      },
      diagnosis: {
        primary_problem: primaryProblem,
        problem_labels: [primaryProblem],
        confidence: typeof confidence === "string" ? confidence : null,
        diagnosis_status: diagnosis.diagnosis_status,
      },
      experiment_history: [],
      playbooks: enginePlaybooks,
    },
  };
}

// Jawaban Python menjadi bentuk ringkas untuk frontend.
// Informasi internal (diagnostics lengkap) hanya disertakan bila includeDebug true.
export function shapeEngineResponse(result, { includeDebug = false } = {}) {
  const diagnostics = result?.diagnostics ?? {};
  const recommendations = (Array.isArray(result?.recommendations) ? result.recommendations : []).map((item) => {
    const playbook = item?.playbook ?? {};
    const scope = playbook.validated_time_scope ?? null;
    return {
      role: item?.role ?? null,
      playbook_id: item?.playbook_id ?? null,
      score: item?.score ?? null,
      title: playbook.title ?? null,
      summary: playbook.summary ?? null,
      when_to_use: playbook.when_to_use ?? null,
      problem_type: playbook.problem_type ?? null,
      cost_level: playbook.cost_level ?? null,
      cost_estimated: playbook.cost_estimated ?? null,
      cost_note: playbook.cost_note ?? null,
      time_needed: playbook.time_needed ?? null,
      skill_needed: playbook.skill_needed ?? null,
      team_size: playbook.team_size ?? null,
      metric: playbook.metric ?? null,
      risks: playbook.risks ?? null,
      source: playbook.source ?? null,
      steps: Array.isArray(scope?.steps) ? scope.steps : Array.isArray(playbook.steps) ? playbook.steps : [],
      scope: scope
        ? {
            status: scope.status ?? null,
            duration_days: scope.duration_days ?? null,
            metric: scope.metric ?? null,
            scope_source: scope.scope_source ?? null,
          }
        : null,
    };
  });

  const count = (key) => (Array.isArray(diagnostics[key]) ? diagnostics[key].length : 0);

  const shaped = {
    status: result?.status ?? "unknown",
    mode: result?.mode ?? "initial",
    counts: {
      eligible: result?.eligible_candidate_count ?? 0,
      feasible: result?.feasible_candidate_count ?? 0,
      returned: result?.returned_count ?? recommendations.length,
    },
    review_counts: {
      time_scope: count("time_scope_review"),
      feasibility: count("feasibility_review"),
      eligibility: count("eligibility_review"),
      rejected: count("rejected_candidates"),
    },
    recommendations,
  };

  if (includeDebug) shaped.debug = { diagnostics };
  return shaped;
}
