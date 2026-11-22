
const OPEN_STATUSES = new Set(["active", "pending_evaluation"]);

function sortNewestFirst(a, b) {
  const dateA = new Date(a.created_at ?? 0).getTime();
  const dateB = new Date(b.created_at ?? 0).getTime();

  return dateB - dateA;
}

export function checkNextGrowthEligibility({
  businessId,
  cycles,
  insights,
  links = [],
}) {
  if (!businessId) {
    return { allowed: false, reason: "business_missing" };
  }

  if (
    !Array.isArray(cycles) ||
    !Array.isArray(insights) ||
    !Array.isArray(links)
  ) {
    return { allowed: false, reason: "source_unavailable" };
  }

  // 1. Batasi cycle berdasarkan business yang sedang diproses.
  const ownedCycles = cycles.filter(
    (cycle) => cycle.business_id === businessId
  );

  if (ownedCycles.length === 0) {
    return { allowed: false, reason: "no_completed_cycle" };
  }

  // 2. Tolak jika masih ada cycle yang terbuka.
  if (ownedCycles.some((cycle) => OPEN_STATUSES.has(cycle.status))) {
    return { allowed: false, reason: "open_cycle" };
  }

  // 3. Periksa cycle terakhir, bukan sekadar cycle completed terbaru.
  const latestCycle = [...ownedCycles].sort(
    (a, b) => b.cycle_number - a.cycle_number
  )[0];

  if (latestCycle.status !== "completed") {
    return {
      allowed: false,
      reason: "latest_cycle_not_completed",
      sourceCycleId: latestCycle.id,
      sourceCycleNumber: latestCycle.cycle_number,
    };
  }

  // 4. Ambil eksperimen yang terhubung dengan cycle terakhir.
  const cycleExperimentIds = [
    ...new Set(
      links
        .filter((link) => link.cycle_id === latestCycle.id)
        .map((link) => link.experiment_id)
        .filter(Boolean)
    ),
  ];

  if (cycleExperimentIds.length !== 1) {
    return {
      allowed: false,
      reason: "cycle_experiment_link_missing",
      sourceCycleId: latestCycle.id,
    };
  }

  const experimentId = cycleExperimentIds[0];

  // 5. Learning Summary dipilih berdasarkan business dan status valid.
  // Tidak menggunakan cycle_id karena kolom tersebut tidak tersedia.
  const latestLearning = insights
    .filter(
      (insight) =>
        insight.business_id === businessId &&
        insight.analysis_status === "valid"
    )
    .sort(sortNewestFirst)[0];

  if (!latestLearning) {
    return {
      allowed: false,
      reason: "learning_summary_missing",
      sourceCycleId: latestCycle.id,
    };
  }

  // 6. Periksa provenance tanpa membatasi isi Learning Summary.
  // Summary tetap merupakan agregasi lintas eksperimen dan lintas cycle.
  const sourceExperimentIds = Array.isArray(
    latestLearning.source_experiment_ids
  )
    ? latestLearning.source_experiment_ids
    : [];

  const provenanceCovered =
    sourceExperimentIds.includes(experimentId) ||
    latestLearning.source_experiment_id === experimentId;

  return {
    allowed: true,

    sourceCycleId: latestCycle.id,
    sourceCycleNumber: latestCycle.cycle_number,
    experimentId,

    learning: latestLearning,

    provenance: {
      coversLatestCycleExperiment: provenanceCovered,
      warning: provenanceCovered
        ? null
        : "Learning Summary valid belum mencantumkan eksperimen dari cycle terakhir dalam daftar sumbernya. Periksa cakupan evidence sebelum menggunakan diagnosis.",
    },
  };
}
