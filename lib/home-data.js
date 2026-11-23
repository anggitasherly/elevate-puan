import { createClient } from "@/lib/supabase/server";

// Kolom jawaban assessment. Draf dihitung "ada" hanya kalau salah satunya terisi.
const ANSWER_COLUMNS = [
  "purchase_methods",
  "main_customers",
  "repeat_frequency",
  "viewer_behavior",
  "sales_sources",
  "sales_trend_3m",
  "order_surge",
  "operational_obstacles",
  "biggest_challenge",
  "acquisition_activities",
  "financial_recording_habit",
  "money_separation",
  "main_goal",
  "story_text",
];

// Status eksperimen (disepakati dengan tim): planned, active, completed, stopped, expired.
const ACTIVE_STATUS = "active";
const FINISHED_STATUSES = ["completed", "stopped", "expired"];
const DEFAULT_TOTAL_DAYS = 7;

function hasAnswers(row) {
  return ANSWER_COLUMNS.some((col) => String(row[col] ?? "").trim() !== "");
}

function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
}

function dayNumber(dateString) {
  const [y, m, d] = String(dateString).slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / 86400000;
}

// Hari ke-N dari M, dihitung dari start_date dan end_date.
function buildProgress(startDate, endDate) {
  if (!startDate) return { day: 1, totalDays: DEFAULT_TOTAL_DAYS };
  const start = dayNumber(startDate);
  const totalDays = endDate ? Math.max(1, dayNumber(endDate) - start + 1) : DEFAULT_TOTAL_DAYS;
  const day = Math.min(Math.max(dayNumber(todayInJakarta()) - start + 1, 1), totalDays);
  return { day, totalDays };
}

// Dibaca di server, jadi browser tidak berhubungan langsung dengan database.
export async function getHomeData() {
  const result = { firstName: "", actionState: "none", experiment: null, lastResult: null };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return result;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) console.error("[home] baca profil:", profileError.message);
  result.firstName = (profile?.full_name ?? "").trim().split(/\s+/)[0];

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (businessError) console.error("[home] baca usaha:", businessError.message);
  if (!business) return result;

  const [assessmentRes, activeRes, finishedRes] = await Promise.all([
    supabase
      .from("assessment")
      .select(["status", "created_at", "updated_at", ...ANSWER_COLUMNS].join(", "))
      .eq("business_id", business.id),
    supabase
      .from("experiments")
      .select("id, title, start_date, end_date")
      .eq("business_id", business.id)
      .eq("status", ACTIVE_STATUS)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("experiments")
      .select("id, title, status, metric_name, target_value, created_at")
      .eq("business_id", business.id)
      .in("status", FINISHED_STATUSES)
      .order("end_date", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (assessmentRes.error) console.error("[home] baca assessment:", assessmentRes.error.message);
  if (activeRes.error) console.error("[home] baca eksperimen aktif:", activeRes.error.message);
  if (finishedRes.error) console.error("[home] baca eksperimen selesai:", finishedRes.error.message);

  // Kondisi assessment: draf hanya dihitung kalau sudah ada jawaban.
  const rows = assessmentRes.data ?? [];
  let assessmentState = "none";
  if (rows.some((r) => r.status === "draft" && hasAnswers(r))) {
    assessmentState = "draft";
  } else if (rows.some((r) => r.status !== "draft")) {
    assessmentState = "submitted";
  }
  const lastSubmittedAt = rows
    .filter((r) => r.status !== "draft")
    .map((r) => new Date(r.updated_at ?? r.created_at).getTime())
    .reduce((max, t) => Math.max(max, t), 0);

  // Kartu "Eksperimen berjalan".
  const active = activeRes.data;
  if (active) {
    result.experiment = {
      id: active.id,
      title: active.title ?? "Eksperimen tanpa judul",
      ...buildProgress(active.start_date, active.end_date),
    };
  }

  // Kartu "Hasil terakhir": eksperimen terakhir yang berakhir beserta evaluasinya.
  const finished = finishedRes.data;
  let finishedAt = 0;
  if (finished) {
    const { data: evaluation, error: evalError } = await supabase
      .from("experiment_results")
      .select("actual_value, target_met, net_profit, created_at")
      .eq("experiment_id", finished.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (evalError) console.error("[home] baca hasil eksperimen:", evalError.message);

    finishedAt = new Date(evaluation?.created_at ?? finished.created_at).getTime();
    result.lastResult = {
      title: finished.title ?? "Eksperimen tanpa judul",
      status: finished.status,
      metricName: finished.metric_name,
      targetValue: finished.target_value,
      actualValue: evaluation?.actual_value ?? null,
      targetMet: evaluation?.target_met ?? null,
      netProfit: evaluation?.net_profit ?? null,
    };
  }

  // Kartu "Langkah berikutnya".
  const showEnded =
    !active && finished && assessmentState !== "draft" && lastSubmittedAt < finishedAt;
  result.actionState = showEnded ? "completed" : assessmentState;

  return result;
}