
import "server-only";

import { ApiError } from "./http";

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

// Membagi ID menjadi beberapa kelompok agar query .in() tetap terkendali.
function chunkArray(items, size = ID_BATCH_SIZE) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

// Mengambil seluruh halaman data dengan urutan yang konsisten.
async function fetchAllPages(createQuery) {
  const allRows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await createQuery().range(
      from,
      from + PAGE_SIZE - 1
    );

    if (error) throw error;

    const rows = data ?? [];
    allRows.push(...rows);

    if (rows.length < PAGE_SIZE) break;
  }

  return allRows;
}

// Mengambil data berdasarkan daftar ID dalam beberapa batch.
async function fetchRowsByIds({
  supabase,
  table,
  select,
  column,
  ids,
  orderBy = ["id"],
  ascending = true,
}) {
  if (!ids.length) return [];

  const batches = chunkArray(ids);

  const batchResults = await Promise.all(
    batches.map((batchIds) =>
      fetchAllPages(() => {
        let query = supabase
          .from(table)
          .select(select)
          .in(column, batchIds);

        for (const field of orderBy) {
          query = query.order(field, { ascending });
        }

        return query;
      })
    )
  );

  return batchResults.flat();
}

// Mengambil seluruh data yang dibutuhkan Next Growth Diagnosis.
// Semua query menggunakan Supabase client dari user yang sudah terautentikasi.
export async function getNextGrowthData(supabase, user) {
  if (!user?.id) {
    throw new ApiError("Sesi pengguna tidak valid.", 401);
  }

  // 1. Ambil bisnis milik pengguna.
  // Nama bisnis tidak diambil karena tidak dibutuhkan diagnosis.
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select(`
      id,
      category,
      business_age,
      business_type,
      city
    `)
    .eq("user_id", user.id)
    .limit(2);

  if (businessError) throw businessError;

  if (!businesses || businesses.length === 0) {
    return {
      business: null,
      assessment: null,
      cycles: [],
      cycleLinks: [],
      insights: [],
      experiments: [],
      checkins: [],
      results: [],
    };
  }

  if (businesses.length > 1) {
    throw new ApiError(
      "Ditemukan lebih dari satu bisnis pada akun ini. Data perlu diperiksa sebelum Next Growth dapat dijalankan.",
      409
    );
  }

  const business = businesses[0];
  const businessId = business.id;

  // 2. Ambil Assessment submitted terbaru berdasarkan waktu pembaruan.
  const { data: assessment, error: assessmentError } = await supabase
    .from("assessment")
    .select(`
      id,
      biggest_challenge,
      biggest_challenge_other,
      main_goal,
      main_goal_other,
      operational_obstacles,
      sales_sources,
      sales_trend_3m,
      ai_diagnosis,
      status,
      created_at,
      updated_at
    `)
    .eq("business_id", businessId)
    .eq("status", "submitted")
    .order("updated_at", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (assessmentError) throw assessmentError;

  // 3. Ambil seluruh Growth Cycle milik bisnis.
  const cycles = await fetchAllPages(() =>
    supabase
      .from("growth_cycles")
      .select(`
        id,
        business_id,
        cycle_number,
        status,
        started_at,
        completed_at,
        created_at
      `)
      .eq("business_id", businessId)
      .order("cycle_number", { ascending: true })
      .order("id", { ascending: true })
  );

  const cycleIds = cycles.map((cycle) => cycle.id);

  // 4. Ambil relasi cycle dengan eksperimen.
  const cycleLinks = await fetchRowsByIds({
    supabase,
    table: "growth_cycle_experiments",
    select: "id, cycle_id, experiment_id, created_at",
    column: "cycle_id",
    ids: cycleIds,
    orderBy: ["created_at", "id"],
    ascending: true,
  });

  // 5. Ambil Learning Summary valid untuk seluruh bisnis.
  // Tidak menggunakan cycle_id karena kolom tersebut tidak tersedia.
  // Summary tetap agregat lintas eksperimen dan lintas cycle.
  const insights = await fetchAllPages(() =>
    supabase
      .from("growth_insights")
      .select(`
        id,
        business_id,
        confidence_level,
        working,
        not_working,
        possible_causes,
        overall_analysis,
        learnings,
        evidence_snapshot,
        source_experiment_id,
        source_experiment_ids,
        analysis_status,
        created_at,
        updated_at
      `)
      .eq("business_id", businessId)
      .eq("analysis_status", "valid")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
  );

  // 6. Ambil eksperimen yang terhubung dengan Growth Cycle.
  const experimentIds = [
    ...new Set(cycleLinks.map((link) => link.experiment_id).filter(Boolean)),
  ];

  const experiments = await fetchRowsByIds({
    supabase,
    table: "experiments",
    select: `
      id,
      business_id,
      proposal_id,
      title,
      description,
      hypothesis,
      metric_name,
      baseline_value,
      target_value,
      budget_planned,
      growth_level,
      start_date,
      end_date,
      status,
      success_criteria,
      created_at
    `,
    column: "id",
    ids: experimentIds,
    orderBy: ["created_at", "id"],
    ascending: true,
  });

  // Pastikan eksperimen yang dibaca memang milik bisnis tersebut.
  const ownedExperiments = experiments.filter(
    (experiment) => experiment.business_id === businessId
  );

  const ownedExperimentIds = ownedExperiments.map(
    (experiment) => experiment.id
  );

  // 7. Ambil check-in dan evaluasi eksperimen.
  const [checkins, results] = await Promise.all([
    fetchRowsByIds({
      supabase,
      table: "experiment_checkins",
      select: `
        id,
        experiment_id,
        checkin_date,
        steps_done,
        progress_note,
        mood,
        obstacle,
        metric_value,
        revenue_today,
        experiment_cost_today,
        created_at
      `,
      column: "experiment_id",
      ids: ownedExperimentIds,
      orderBy: ["checkin_date", "id"],
      ascending: true,
    }),

    fetchRowsByIds({
      supabase,
      table: "experiment_results",
      select: `
        id,
        experiment_id,
        actual_value,
        target_met,
        checkin_completeness,
        cost_spent,
        additional_revenue,
        gross_profit,
        net_profit,
        roi,
        break_even_orders,
        learnings,
        user_rating,
        system_evaluation,
        created_at,
        evaluated_at
      `,
      column: "experiment_id",
      ids: ownedExperimentIds,
      orderBy: ["created_at", "id"],
      ascending: false,
    }),
  ]);

  // Data mentah untuk divalidasi dan dirangkai oleh context builder.
  return {
    business,
    assessment: assessment ?? null,
    cycles,
    cycleLinks,
    insights,
    experiments: ownedExperiments,
    checkins,
    results,
  };
}
