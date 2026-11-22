import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  addDays,
  calculateFinance,
  formatRupiah,
  isUuid,
  todayInJakarta,
  EXPERIMENT_DURATION_DAYS,
} from "@/lib/experiments/server-helpers";
import {
  ACTIVE_STATUSES,
  MOODS,
  getOwnedExperiment,
  isFinanceSaved,
  isNoteSaved,
  jsonError,
  plainNumber,
} from "@/lib/experiments/checkin-helpers";

const SECTION_CHECK = {
  note: isNoteSaved,
  finance: isFinanceSaved,
};

const MAX_TEXT = 2000;
const MAX_TASK_TEXT = 500;
const MAX_MONEY = 1_000_000_000_000;

function isRealDateString(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

function cleanText(value, max) {
  if (typeof value !== "string") return null;

  const text = value.trim();

  if (!text || text.length > max) return null;

  return text;
}

/*
 * POST /api/experiments/[id]/checkin
 *
 * Body catatan : { section: "note", checkinDate, tasks: [...],
 *                  progress, obstacle, mood }
 * Body keuangan: { section: "finance", checkinDate, revenue, cost }
 *
 * Satu baris per tanggal. Bagian yang sudah tersimpan tidak
 * pernah ditimpa lagi.
 * Balasan: { checkin }
 */
export async function POST(request, { params }) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Silakan login terlebih dahulu.", 401);
    }

    const { id } = await params;

    if (!isUuid(id)) {
      return jsonError("ID eksperimen tidak valid.", 400);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return jsonError("Format JSON tidak valid.", 400);
    }

    const section = body?.section;

    if (!Object.keys(SECTION_CHECK).includes(section)) {
      return jsonError("Bagian check-in tidak valid.", 400);
    }

    const checkinDate = body?.checkinDate;

    if (!isRealDateString(checkinDate)) {
      return jsonError("Tanggal check-in tidak valid.", 400);
    }

    /* EKSPERIMEN MILIK PENGGUNA DAN MASIH AKTIF */

    const owned = await getOwnedExperiment(supabase, user.id, id);

    if (owned.failure) {
      return jsonError(owned.failure.message, owned.failure.status);
    }

    const { experiment } = owned;

    if (!ACTIVE_STATUSES.includes(experiment.status)) {
      return jsonError("Eksperimen ini sudah tidak aktif.", 409, {
        code: "not_active",
      });
    }

    /* TANGGAL: hari ini (WIB) atau satu hari lebih awal di zona
       waktu timur (WITA/WIT), dan masih di dalam periode eksperimen. */

    const startDate = String(experiment.start_date || "").slice(0, 10);

    if (!isRealDateString(startDate)) {
      return jsonError("Tanggal mulai eksperimen tidak valid.", 422);
    }

    const endDate = addDays(startDate, EXPERIMENT_DURATION_DAYS - 1);

    const today = todayInJakarta();
    const allowedDates = [today, addDays(today, 1)];

    if (!allowedDates.includes(checkinDate)) {
      return jsonError(
        "Tanggal check-in tidak sesuai dengan hari ini.",
        400
      );
    }

    if (checkinDate < startDate || checkinDate > endDate) {
      return jsonError(
        "Hari ini berada di luar periode eksperimen.",
        422
      );
    }

    /* VALIDASI ISI (daftar putih kolom) */

    let fields;

    if (section === "note") {
      const tasks = Array.isArray(body.tasks) ? body.tasks : null;

      if (!tasks || tasks.length < 1 || tasks.length > 3) {
        return jsonError("Daftar tugas tidak valid.", 400);
      }

      const cleanTasks = tasks.map((t) => cleanText(t, MAX_TASK_TEXT));

      if (cleanTasks.some((t) => t === null)) {
        return jsonError("Daftar tugas tidak valid.", 400);
      }

      const progress = cleanText(body.progress, MAX_TEXT);
      const obstacle = cleanText(body.obstacle, MAX_TEXT);

      if (!progress || !obstacle) {
        return jsonError(
          "Perkembangan dan kendala wajib diisi (maksimal 2000 karakter).",
          400
        );
      }

      if (!MOODS.includes(body.mood)) {
        return jsonError("Perasaan yang dipilih tidak valid.", 400);
      }

      const savedAt = new Date().toISOString();

      fields = {
        steps_done: cleanTasks.map((task, index) => ({
          index,
          task,
          done: true,
          saved_at: savedAt,
        })),
        progress_note: progress,
        mood: body.mood,
        obstacle,
      };
    } else {
      const revenue = body.revenue;
      const cost = body.cost;

      const validMoney = (v) =>
        typeof v === "number" &&
        Number.isFinite(v) &&
        v >= 0 &&
        v <= MAX_MONEY;

      if (!validMoney(revenue) || !validMoney(cost)) {
        return jsonError(
          "Revenue dan biaya harus berupa angka tidak negatif.",
          400
        );
      }

      fields = {
        revenue_today: Math.round(revenue),
        experiment_cost_today: Math.round(cost),
      };
    }

    /* CHECK-IN YANG SUDAH ADA (semua tanggal, untuk cek biaya) */

    const { data: allRows, error: rowsError } = await supabase
      .from("experiment_checkins")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("created_at", { ascending: false });

    if (rowsError) {
      console.error("[experiments checkin] rows:", rowsError.code);
      return jsonError("Gagal memeriksa data check-in.", 500);
    }

    const existing =
      (allRows || []).find((r) => r.checkin_date === checkinDate) || null;

    // Bagian yang sudah tersimpan tidak boleh ditimpa
    if (existing && SECTION_CHECK[section](existing)) {
      return jsonError(
        "Bagian ini sudah tersimpan sebelumnya dan tidak dapat diubah lagi.",
        409,
        { code: "already_saved", checkin: existing }
      );
    }

    /* BATAS BIAYA EKSPERIMEN (dihitung ulang di server) */

    if (section === "finance") {
      const { data: financeRow, error: financeError } = await supabase
        .from("financial_readiness")
        .select("*")
        .eq("business_id", experiment.business_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (financeError) {
        console.error("[experiments checkin] finance:", financeError.code);
        return jsonError("Gagal mengambil data keuangan.", 500);
      }

      const budgetLimit = calculateFinance(financeRow)?.budget ?? 0;

      const spentOtherDays = (allRows || [])
        .filter(
          (r) => isFinanceSaved(r) && r.checkin_date !== checkinDate
        )
        .reduce((sum, r) => sum + plainNumber(r.experiment_cost_today), 0);

      const remaining = Math.max(0, budgetLimit - spentOtherDays);

      if (fields.experiment_cost_today > remaining) {
        return jsonError(
          `Biaya melebihi sisa biaya eksperimen. Maksimal hari ini ${formatRupiah(
            remaining
          )}.`,
          422
        );
      }
    }

    /* SIMPAN (update baris hari ini, atau buat baru) */

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("experiment_checkins")
        .update(fields)
        .eq("id", existing.id)
        .eq("experiment_id", experiment.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("[experiments checkin] update:", updateError.code);
        return jsonError("Check-in gagal disimpan. Silakan coba lagi.", 500);
      }

      return NextResponse.json({ checkin: updated });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("experiment_checkins")
      .insert({
        experiment_id: experiment.id,
        checkin_date: checkinDate,
        ...fields,
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("[experiments checkin] insert:", insertError.code);
      return jsonError("Check-in gagal disimpan. Silakan coba lagi.", 500);
    }

    return NextResponse.json({ checkin: inserted }, { status: 201 });
  } catch (err) {
    console.error("[experiments checkin] unexpected:", err?.name);
    return jsonError("Terjadi kesalahan pada server.", 500);
  }
}
