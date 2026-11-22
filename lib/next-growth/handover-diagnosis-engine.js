import { PROBLEM_TYPES } from "../diagnosis/shared/problem-taxonomy.js";
import { buildHandoverDiagnosisContext } from "./build-diagnosis-context.js";

const valid = new Set(PROBLEM_TYPES);
const nonempty = (value) =>
  typeof value === "string" && value.trim().length > 0;
const extract = (value) =>
  Array.isArray(value)
    ? value.filter(nonempty).map((item) => item.trim())
    : nonempty(value)
      ? [value.trim()]
      : [];

function addEvidence(target, source, field, value, referenceId) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value) && value.length === 0) return;
  if (typeof value === "string" && !value.trim()) return;

  target.push({
    source,
    field,
    value,
    reference_id: referenceId ?? null,
  });
}


function normalizeSignal(value) {
  return String(value ?? "")
    .trim()
    .toLocaleLowerCase("id-ID")
    .replace(/\s+/g, " ");
}

function parseBaseline(value) {
  if (typeof value !== "string") return value ?? null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function determineDirection({
  working,
  notWorking,
  unresolved,
  obstacles,
  result,
  repeatedNegativeSignals,
}) {
  const hasWorking = working.length > 0;
  const hasNegative =
    notWorking.length > 0 || unresolved.length > 0 || obstacles.length > 0;
  const targetMet = result.target_met;
  const netProfit = Number(result.net_profit);
  const hasNetProfit =
    result.net_profit !== null &&
    result.net_profit !== undefined &&
    result.net_profit !== "" &&
    Number.isFinite(netProfit);

  // Change hanya dipertimbangkan jika sinyal negatif berulang lintas
  // Learning Summary, tidak ada sinyal yang bekerja, dan target terbaru
  // tidak tercapai. Satu eksperimen yang gagal tidak cukup.
  if (
    !hasWorking &&
    repeatedNegativeSignals.length > 0 &&
    targetMet === false
  ) {
    return {
      value: "change",
      reason:
        "Sinyal negatif yang sama muncul kembali pada Learning Summary sebelumnya, tidak ada sinyal pendekatan yang bekerja pada ringkasan terbaru, dan target eksperimen terakhir tidak tercapai.",
      evidence_refs: ["growth_insights", "experiment_results"],
    };
  }

  // Improve berarti ada bagian pendekatan yang bekerja, tetapi masih ada
  // hambatan, sinyal yang belum terselesaikan, atau target yang belum tercapai.
  if (
    hasWorking &&
    (hasNegative || targetMet === false)
  ) {
    return {
      value: "improve",
      reason:
        "Ada bagian pendekatan yang menunjukkan hasil positif, tetapi masih terdapat hambatan atau target yang belum tercapai.",
      evidence_refs: ["growth_insights", "experiment_results", "experiment_checkins"],
    };
  }

  // Continue membutuhkan bukti positif dari Learning Summary dan evaluasi,
  // tanpa sinyal negatif aktif. Profit harus tersedia dan tidak negatif.
  if (
    hasWorking &&
    !hasNegative &&
    targetMet === true &&
    hasNetProfit &&
    netProfit >= 0
  ) {
    return {
      value: "continue",
      reason:
        "Learning Summary menunjukkan pendekatan yang bekerja dan evaluasi mencatat target tercapai dengan net profit tidak negatif, tanpa sinyal hambatan aktif.",
      evidence_refs: ["growth_insights", "experiment_results"],
    };
  }

  return {
    value: null,
    reason:
      "Bukti yang tersedia belum cukup konsisten untuk menentukan apakah pendekatan perlu dilanjutkan, diperbaiki, atau diganti.",
    evidence_refs: [],
  };
}

// Analisis konservatif: narasi bebas menjadi bukti, bukan label taxonomy otomatis.
export function diagnoseHandoverNextGrowth(data) {
  const ctx = buildHandoverDiagnosisContext(data);

  if (!ctx.eligible) {
    return {
      diagnosis_mode: "next_growth",
      diagnosis_status: "blocked",
      eligibility: ctx.eligibility,
      direction: null,
      primary_problem: null,
      evidence: [],
      source_references: null,
      limitations: [
        "Diagnosis tidak dijalankan karena prasyarat cycle, eksperimen, Learning Summary, atau evaluasi belum terpenuhi.",
      ],
    };
  }

  const learning = ctx.learning;
  const evidence = [];

  for (const field of [
    "working",
    "not_working",
    "possible_causes",
    "overall_analysis",
    "unresolved_problem_signals",
    "growth_opportunities",
    "learnings",
  ]) {
    const values = learning[field];
    if (extract(values).length) {
      addEvidence(evidence, "growth_insights", field, values, learning.id);
    }
  }

  if (learning.evidence_snapshot != null) {
    addEvidence(
      evidence,
      "growth_insights",
      "evidence_snapshot",
      learning.evidence_snapshot,
      learning.id
    );
  }

  for (const field of [
    "target_met",
    "actual_value",
    "net_profit",
    "checkin_completeness",
    "learnings",
    "system_evaluation",
  ]) {
    addEvidence(
      evidence,
      "experiment_results",
      field,
      ctx.result[field],
      ctx.result.id
    );
  }

  for (const checkin of ctx.checkins) {
    for (const field of ["obstacle", "metric_value", "progress_note", "steps_done"]) {
      addEvidence(
        evidence,
        "experiment_checkins",
        field,
        checkin[field],
        checkin.id
      );
    }
  }

  // History adalah konteks sekunder. Ia tidak menggantikan Learning Summary
  // terbaru dan tidak boleh menaikkan label taxonomy dari narasi bebas.
  for (const previous of ctx.history) {
    for (const field of [
      "working",
      "not_working",
      "unresolved_problem_signals",
      "possible_causes",
    ]) {
      const values = previous[field];
      if (extract(values).length) {
        addEvidence(
          evidence,
          "growth_insights_history",
          field,
          values,
          previous.id
        );
      }
    }
  }

  const baseline = parseBaseline(ctx.assessment?.ai_diagnosis);
  const baselineProblem = baseline?.primary_problem?.problem_type ?? null;

  // Klasifikasi hanya dari kode eksplisit yang lolos taxonomy.
  const explicitProblem =
    learning.problem_type ?? learning.primary_problem_type ?? null;
  const problem = valid.has(explicitProblem) ? explicitProblem : null;

  const currentWorking = extract(learning.working);
  const currentNotWorking = extract(learning.not_working);
  const currentUnresolved = extract(learning.unresolved_problem_signals);
  const currentObstacles = ctx.checkins
    .map((item) => item.obstacle)
    .filter(nonempty);

  const currentNegative = [
    ...currentNotWorking,
    ...currentUnresolved,
    ...currentObstacles,
  ];

  const historicalNegative = new Set(
    ctx.history.flatMap((previous) => [
      ...extract(previous.not_working),
      ...extract(previous.unresolved_problem_signals),
    ]).map(normalizeSignal)
  );

  const repeatedNegativeSignals = [
    ...new Set(
      currentNegative.filter((signal) =>
        historicalNegative.has(normalizeSignal(signal))
      )
    ),
  ];

  const directionResult = determineDirection({
    working: currentWorking,
    notWorking: currentNotWorking,
    unresolved: currentUnresolved,
    obstacles: currentObstacles,
    result: ctx.result,
    repeatedNegativeSignals,
  });

  const historyProblemTypes = ctx.history
    .map((item) => item.problem_type ?? item.primary_problem_type ?? null)
    .filter((item) => valid.has(item));

  const persistentProblems = problem
    ? [
        ...new Set([
          ...(baselineProblem === problem ? [problem] : []),
          ...(historyProblemTypes.includes(problem) ? [problem] : []),
        ]),
      ]
    : [];

  const causes = extract(learning.possible_causes).map((description) => ({
    description,
    status: "hypothesis",
    evidence_refs: evidence
      .filter(
        (item) =>
          item.source === "growth_insights" &&
          item.field === "possible_causes"
      )
      .map((item) => item.reference_id)
      .filter(Boolean),
  }));

  const opportunities = extract(learning.growth_opportunities).map(
    (description) => ({
      description,
      status: "candidate_area",
      source: "growth_insights",
      evidence_refs: [learning.id].filter(Boolean),
    })
  );

  const hasLearningEvidence = evidence.some(
    (item) => item.source === "growth_insights"
  );
  const hasEvaluationEvidence = evidence.some(
    (item) => item.source === "experiment_results"
  );
  const hasCheckinEvidence = evidence.some(
    (item) => item.source === "experiment_checkins"
  );

  // Riwayat hanya dihitung jika benar-benar memiliki evidence relevan.
const hasRelevantHistoryEvidence = ctx.history.some((item) =>
  [
    ...extract(item.working),
    ...extract(item.not_working),
    ...extract(item.unresolved_problem_signals),
    ...extract(item.possible_causes),
  ].length > 0
);

let confidenceLevel = "low";

if (!hasLearningEvidence) {
  confidenceLevel = "insufficient";
} else if (
  hasEvaluationEvidence &&
  hasCheckinEvidence &&
  (hasRelevantHistoryEvidence || problem !== null)
) {
  confidenceLevel = "medium";
}

  const confidence = {
    level: confidenceLevel,
    explanation:
      confidenceLevel === "insufficient"
        ? "Learning Summary tidak menyediakan bukti yang dapat dianalisis."
        : confidenceLevel === "medium"
          ? "Bukti berasal dari Learning Summary, evaluasi eksperimen, dan check-in atau riwayat pembelajaran. Tingkat ini menunjukkan kecukupan bukti, bukan probabilitas keberhasilan."
          : "Learning Summary tersedia, tetapi cakupan bukti pendukung atau verifikasi kategori masalah masih terbatas. Tingkat ini bukan probabilitas keberhasilan.",
  };

  const diagnosisStatus = !hasLearningEvidence
    ? "insufficient_data"
    : problem && directionResult.value
      ? "indications_found"
      : "learning_review_required";

  const sourceExperimentIds = [
    ...new Set([
      ...(ctx.sourceReferences.learning_source_experiment_ids ?? []),
      ctx.experiment.id,
    ]),
  ];

  return {
    diagnosis_mode: "next_growth",
    diagnosis_status: diagnosisStatus,
    business_id: ctx.business.id,
    source_cycle_id: ctx.sourceCycleId,
    source_cycle_number: ctx.sourceCycleNumber,

    primary_problem: problem
      ? {
          problem_type: problem,
          evidence: evidence.filter(
            (item) =>
              item.source === "growth_insights" ||
              item.source === "experiment_results" ||
              item.source === "experiment_checkins"
          ),
        }
      : null,
    contributing_problems: [],
    persistent_problems: persistentProblems,

    direction: directionResult.value,
    direction_rationale: directionResult.reason,

    possible_causes: causes,
    opportunities,
    growth_opportunities: opportunities,

    evidence,
    confidence,
    changes: {
      baseline_problem: valid.has(baselineProblem) ? baselineProblem : null,
      persistent_problems: persistentProblems,
      repeated_negative_signals: repeatedNegativeSignals,
      comparison:
        "Perubahan kondisi hanya disimpulkan dari sinyal yang dapat dibandingkan; narasi yang tidak sebanding tidak dianggap sebagai bukti perbaikan atau kemunduran.",
    },

    evaluated_experiment_ids: [ctx.experiment.id],
    source_experiment_ids: sourceExperimentIds,
    source_references: ctx.sourceReferences,
    provenance: ctx.provenance,

    history_summary_count: ctx.history.length,
    generated_at: new Date().toISOString(),

    limitations: [
      "Teks bebas tidak dipetakan otomatis ke delapan problem taxonomy.",
      "Possible causes adalah hipotesis, bukan fakta.",
      "Opportunity adalah area yang perlu ditinjau, bukan rekomendasi eksperimen.",
      "Direction hanya diberikan jika pola bukti memenuhi aturan konservatif; hasil eksperimen tunggal tidak otomatis menentukan arah.",
      "Riwayat Learning Summary merupakan konteks sekunder dan tidak menggantikan Learning Summary terbaru.",
    ],

    raw_context_summary: {
      checkin_count: ctx.checkins.length,
      history_summary_count: ctx.history.length,
      repeated_negative_signal_count: repeatedNegativeSignals.length,
    },
  };
}
