
import "server-only";

import { ApiError } from "./http";

// Menyamakan variasi penulisan status dari database.
export function normalizeStatus(status) {
  const value = String(status ?? "").trim().toLowerCase();

  const statusMap = {
    active: "ongoing",
    ongoing: "ongoing",
    in_progress: "ongoing",
    "in-progress": "ongoing",

    completed: "completed",
    complete: "completed",
    finished: "completed",

    stopped: "stopped",
    cancelled: "stopped",
    canceled: "stopped",

    draft: "draft",
    planned: "planned",
  };

  return statusMap[value] ?? "unknown";
}

// Hanya eksperimen yang sudah benar-benar masuk siklus pelaksanaan.
const ANALYZABLE_STATUSES = new Set([
  "completed",
  "ongoing",
  "stopped",
]);

const PAGE_SIZE = 500;
const ID_BATCH_SIZE = 100;

function createSummary() {
  return {
    total: 0,
    completed: 0,
    ongoing: 0,
    stopped: 0,
    unknown: 0,
  };
}

function emptyData(business = null, assessment = null) {
  return {
    business,
    assessment,
    experiments: [],
    checkins: [],
    results: [],
    proposals: [],
    summary: createSummary(),
  };
}

// Membagi daftar ID agar query .in() tidak menerima daftar terlalu besar.
function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

// Mengambil seluruh halaman data secara bertahap.
// Urutan query harus deterministik agar pagination tidak melewatkan baris.
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

// Mengambil data terkait berdasarkan kumpulan ID secara bertahap.
async function fetchRowsByIds({
  supabase,
  table,
  select,
  column,
  ids,
  orderBy,
  ascending = true,
}) {
  if (!ids.length) return [];

  const batches = chunkArray(ids, ID_BATCH_SIZE);

  const batchResults = await Promise.all(
    batches.map((batchIds) =>
      fetchAllPages(() => {
        let query = supabase
          .from(table)
          .select(select)
          .in(column, batchIds);

        for (const order of orderBy) {
          query = query.order(order, {
            ascending,
          });
        }

        return query;
      })
    )
  );

  return batchResults.flat();
}

// Mengambil seluruh data Growth Insights milik pengguna yang login.
// Semua query menggunakan client terautentikasi sehingga RLS tetap berlaku.
export async function getGrowthInsightsData(supabase, user) {
  // 1. Validasi aturan satu akun memiliki satu bisnis.
  // Ambil maksimal dua baris agar duplikasi bisa dideteksi.
  const { data: businesses, error: businessError } = await supabase
    .from("businesses")
    .select(`
      id,
      name,
      category,
      business_age,
      business_type,
      city,
      business_description
    `)
    .eq("user_id", user.id)
    .limit(2);

  if (businessError) throw businessError;

  if (!businesses || businesses.length === 0) {
    return emptyData();
  }

  if (businesses.length > 1) {
    throw new ApiError(
      "Ditemukan lebih dari satu data bisnis pada akun ini. Data perlu diperiksa sebelum Growth Insights dapat dimuat.",
      409
    );
  }

  const business = businesses[0];

  // Ambil assessment terbaru milik bisnis yang sedang dianalisis.
const { data: assessment, error: assessmentError } = await supabase
  .from("assessment")
  .select(`
    story_text,
    biggest_challenge,
    biggest_challenge_other,
    main_goal,
    main_goal_other,
    sales_sources,
    sales_sources_other,
    ai_diagnosis,
    status,
    created_at
  `)
  .eq("business_id", business.id)
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (assessmentError) throw assessmentError;

  // 2. Ambil seluruh eksperimen milik bisnis tersebut.
  const rawExperiments = await fetchAllPages(() =>
    supabase
      .from("experiments")
      .select(`
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
      `)
      .eq("business_id", business.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
  );

  // Draft, planned, dan status tidak dikenal tidak masuk analisis.
  const experiments = rawExperiments.filter((item) =>
    ANALYZABLE_STATUSES.has(normalizeStatus(item.status))
  );

  if (experiments.length === 0) {
    return emptyData(business, assessment);
  }

  const experimentIds = experiments.map((item) => item.id);

  const proposalIds = [
    ...new Set(
      experiments
        .map((item) => item.proposal_id)
        .filter(Boolean)
    ),
  ];

  // 3. Ambil check-in, hasil evaluasi, dan proposal secara paralel.
  // Hanya mengambil kolom yang memang digunakan oleh Growth Insights.
  const [checkins, results, proposals] = await Promise.all([
    fetchRowsByIds({
      supabase,
      table: "experiment_checkins",
      select: `
        id,
        experiment_id,
        checkin_date,
        obstacle,
        revenue_today,
        experiment_cost_today,
        created_at
      `,
      column: "experiment_id",
      ids: experimentIds,
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
        cost_spent,
        additional_revenue,
        gross_profit,
        net_profit,
        roi,
        break_even_orders,
        learnings,
        created_at
      `,
      column: "experiment_id",
      ids: experimentIds,
      orderBy: ["created_at", "id"],
      ascending: false,
    }),

    fetchRowsByIds({
      supabase,
      table: "solution_proposals",
      select: "id, problem_addressed",
      column: "id",
      ids: proposalIds,
      orderBy: ["id"],
      ascending: true,
    }),
  ]);

  // 4. Ringkasan dihitung sistem, bukan AI.
  const summary = createSummary();

  for (const experiment of experiments) {
    const status = normalizeStatus(experiment.status);

    summary.total += 1;
    summary[status] += 1;
  }

  const unknownCount = rawExperiments.filter(
    (item) => normalizeStatus(item.status) === "unknown"
  ).length;

  if (unknownCount > 0) {
    console.warn(
      `Growth Insights: ${unknownCount} eksperimen berstatus tidak dikenal dan dikecualikan.`
    );
  }

  return {
    business,
    assessment: assessment ?? null,
    experiments,
    checkins,
    results,
    proposals,
    summary,
  };
}
