
import { checkNextGrowthEligibility } from "./cycle-eligibility.js";

const list = (value) => (Array.isArray(value) ? value : []);

function sortNewestFirst(a, b) {
  const dateA = new Date(a.created_at ?? 0).getTime();
  const dateB = new Date(b.created_at ?? 0).getTime();

  return dateB - dateA;
}

// Mengubah nama field menjadi label yang mudah dibaca.
function formatLabel(value) {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Meratakan teks dari string, array, maupun object JSONB.
// Ini mencegah isi overall_analysis hilang ketika bentuknya object.
function flattenText(value, prefix = "") {
  if (value === null || value === undefined) return [];

  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];

    return [prefix ? `${prefix}: ${text}` : text];
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return [prefix ? `${prefix}: ${value}` : String(value)];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenText(item, prefix));
  }

  if (typeof value === "object") {
    return Object.entries(value).flatMap(([key, item]) => {
      const label = formatLabel(key);
      const nextPrefix = prefix ? `${prefix} - ${label}` : label;

      return flattenText(item, nextPrefix);
    });
  }

  return [];
}

// Mengambil sinyal dari deepAnalysis.
// Mendukung bentuk string, array, maupun object.
function getDeepAnalysisSignals(overallAnalysis, signalKey) {
  const deepAnalysis = overallAnalysis?.deepAnalysis;

  if (!deepAnalysis || typeof deepAnalysis !== "object") {
    return [];
  }

  return flattenText(deepAnalysis[signalKey]);
}

// Menormalisasi Learning Summary agar sesuai dengan input engine.
function normalizeLearningSummary(insight) {
  const overallAnalysis = insight.overall_analysis;

  const unresolvedSignals = getDeepAnalysisSignals(
    overallAnalysis,
    "unresolvedProblemSignals"
  );

  const emergingOpportunities = getDeepAnalysisSignals(
    overallAnalysis,
    "emergingOpportunitySignals"
  );

  const primaryProblemType =
    overallAnalysis?.deepAnalysis?.primaryProblemType ?? null;

  // deepAnalysis signals disajikan sebagai field tersendiri agar tidak
  // terduplikasi ketika keseluruhan object diratakan menjadi narasi.
  const analysisWithoutSignals =
    overallAnalysis && typeof overallAnalysis === "object" &&
    !Array.isArray(overallAnalysis)
      ? Object.fromEntries(
          Object.entries(overallAnalysis).filter(([key]) => key !== "deepAnalysis")
        )
      : overallAnalysis;

  return {
    ...insight,
    working: flattenText(insight.working),
    not_working: flattenText(insight.not_working),
    possible_causes: flattenText(insight.possible_causes),
    overall_analysis: flattenText(analysisWithoutSignals),
    learnings: flattenText(insight.learnings),
    growth_opportunities: emergingOpportunities,
    unresolved_problem_signals: unresolvedSignals,
    primary_problem_type: primaryProblemType,
  };
}

export function buildHandoverDiagnosisContext(data) {
  if (!data || typeof data !== "object") {
    throw new TypeError("Data Next Growth tidak valid");
  }

  const businessId = data.business?.id;

  // 1. Periksa eligibility berdasarkan cycle dan Learning Summary.
  const gate = checkNextGrowthEligibility({
    businessId,
    cycles: data.cycles,
    links: data.cycleLinks,
    insights: data.insights,
  });

  if (!gate.allowed) {
    return {
      eligible: false,
      eligibility: gate,
    };
  }

  // 2. Pastikan eksperimen cycle terakhir benar-benar tersedia.
  const experiment = list(data.experiments).find(
    (item) =>
      item.id === gate.experimentId &&
      item.business_id === businessId
  );

  if (!experiment) {
    return {
      eligible: false,
      eligibility: {
        allowed: false,
        reason: "experiment_missing",
      },
    };
  }

  // 3. Ambil hasil evaluasi eksperimen.
  const results = list(data.results)
    .filter((item) => item.experiment_id === experiment.id)
    .sort(sortNewestFirst);

  const result = results[0] ?? null;

  if (!result) {
    return {
      eligible: false,
      eligibility: {
        allowed: false,
        reason: "evaluation_missing",
      },
    };
  }

  // 4. Normalisasi Learning Summary utama.
  const learning = normalizeLearningSummary(gate.learning);

  // 5. Riwayat diambil dari Learning Summary valid sebelumnya.
  // Tidak menggunakan cycle_id dan tidak membatasi agregasi berdasarkan cycle.
  const history = list(data.insights)
    .filter(
      (insight) =>
        insight.business_id === businessId &&
        insight.analysis_status === "valid" &&
        insight.id !== gate.learning.id
    )
    .sort(sortNewestFirst)
    .map((insight) => normalizeLearningSummary(insight));

  // 6. Ambil check-in eksperimen cycle terakhir.
  const checkins = list(data.checkins)
    .filter((item) => item.experiment_id === experiment.id)
    .sort((a, b) =>
      String(a.checkin_date ?? "").localeCompare(
        String(b.checkin_date ?? "")
      )
    );

  // 7. Validasi daftar sumber Learning Summary terhadap eksperimen
  // milik business yang berhasil dimuat dari relasi Growth Cycle.
  const knownExperimentIds = new Set(
    list(data.experiments)
      .filter((item) => item.business_id === businessId)
      .map((item) => item.id)
  );
  const declaredLearningSourceIds = Array.isArray(gate.learning.source_experiment_ids)
    ? gate.learning.source_experiment_ids
    : gate.learning.source_experiment_id
      ? [gate.learning.source_experiment_id]
      : [];
  const verifiedLearningSourceIds = [
    ...new Set(declaredLearningSourceIds.filter((id) => knownExperimentIds.has(id))),
  ];
  const unverifiedLearningSourceIds = [
    ...new Set(declaredLearningSourceIds.filter((id) => !knownExperimentIds.has(id))),
  ];

  // 8. Susun referensi sumber untuk keterlacakan evidence.
  return {
    eligible: true,

    business: data.business,
    assessment: data.assessment ?? null,

    sourceCycleId: gate.sourceCycleId,
    sourceCycleNumber: gate.sourceCycleNumber,

    learning,
    experiment,
    result,
    checkins,
    history,

    provenance: gate.provenance,

    sourceReferences: {
      business_id: businessId,
      cycle_id: gate.sourceCycleId,
      experiment_id: experiment.id,
      learning_id: gate.learning.id ?? null,
      learning_history_ids: history.map((item) => item.id).filter(Boolean),
      learning_source_experiment_ids: verifiedLearningSourceIds,
      unverified_learning_source_experiment_ids: unverifiedLearningSourceIds,
      result_id: result.id ?? null,
      checkin_ids: checkins.map((item) => item.id).filter(Boolean),
    },
  };
}
