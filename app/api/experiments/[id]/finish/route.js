
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateFinance, isUuid } from "@/lib/experiments/server-helpers";
import {
  ACTIVE_STATUSES,
  FINAL_STATUSES,
  buildEvaluation,
  getOwnedExperiment,
  jsonError,
} from "@/lib/experiments/checkin-helpers";

/*
 * Menutup Growth Cycle setelah hasil evaluasi eksperimen tersedia.
 * Tidak mengubah status eksperimen: stopped tetap stopped.
 */
async function completeLinkedGrowthCycle(supabase, experiment) {
  // Cari cycle yang terhubung dengan eksperimen ini.
  const { data: link, error: linkError } = await supabase
    .from("growth_cycle_experiments")
    .select("cycle_id")
    .eq("experiment_id", experiment.id)
    .maybeSingle();

  if (linkError) {
    console.error("[experiments finish] cycle link:", linkError.code);
    throw new Error("Gagal memeriksa Growth Cycle eksperimen.");
  }

  // Eksperimen lama yang belum terhubung ke cycle tidak dipaksakan.
  if (!link?.cycle_id) return null;

  // Tutup cycle hanya jika masih aktif atau menunggu evaluasi.
  const { data: cycle, error: cycleError } = await supabase
    .from("growth_cycles")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", link.cycle_id)
    .in("status", ["active", "pending_evaluation"])
    .select("id, status, completed_at")
    .maybeSingle();

  if (cycleError) {
    console.error("[experiments finish] cycle update:", cycleError.code);
    throw new Error("Gagal memperbarui status Growth Cycle.");
  }

  // Jika sudah completed, tidak perlu diperbarui lagi.
  if (cycle) return cycle;

  const { data: existingCycle, error: readError } = await supabase
    .from("growth_cycles")
    .select("id, status, completed_at")
    .eq("id", link.cycle_id)
    .maybeSingle();

  if (readError || !existingCycle) {
    console.error("[experiments finish] cycle reread:", readError?.code);
    throw new Error("Gagal memeriksa status akhir Growth Cycle.");
  }

  if (existingCycle.status !== "completed") {
    throw new Error(
      `Growth Cycle tidak dapat ditutup dari status ${existingCycle.status}.`
    );
  }

  return existingCycle;
}

/*
 * POST /api/experiments/[id]/finish
 * Body: { status: "completed" | "stopped" | "expired" }
 *
 * - Status eksperimen hanya diubah jika masih active/running.
 * - Evaluasi dibuat satu kali.
 * - Growth Cycle ditutup setelah experiment_results tersedia.
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

    const newStatus = body?.status;

    if (!FINAL_STATUSES.includes(newStatus)) {
      return jsonError("Status akhir tidak valid.", 400);
    }

    const owned = await getOwnedExperiment(supabase, user.id, id);

    if (owned.failure) {
      return jsonError(owned.failure.message, owned.failure.status);
    }

    let experiment = owned.experiment;

    /* UBAH STATUS EKSPERIMEN */

    if (ACTIVE_STATUSES.includes(experiment.status)) {
      const { data: updatedRows, error: statusError } = await supabase
        .from("experiments")
        .update({ status: newStatus })
        .eq("id", experiment.id)
        .in("status", ACTIVE_STATUSES)
        .select("*");

      if (statusError) {
        console.error("[experiments finish] status:", statusError.code);
        return jsonError(
          "Status eksperimen gagal diperbarui. Silakan coba lagi.",
          500
        );
      }

      if (updatedRows && updatedRows.length > 0) {
        experiment = updatedRows[0];
      } else {
        const { data: reread, error: rereadError } = await supabase
          .from("experiments")
          .select("*")
          .eq("id", experiment.id)
          .maybeSingle();

        if (rereadError || !reread) {
          return jsonError(
            "Status eksperimen gagal diperbarui. Silakan coba lagi.",
            500
          );
        }

        experiment = reread;
      }
    }

    if (!FINAL_STATUSES.includes(experiment.status)) {
      return jsonError(
        "Status eksperimen saat ini tidak dapat diselesaikan.",
        409
      );
    }

    /* PERIKSA HASIL EVALUASI */

    const { data: existingResult, error: existingError } = await supabase
      .from("experiment_results")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[experiments finish] result:", existingError.code);
      return jsonError("Gagal memeriksa hasil eksperimen.", 500);
    }

    // Jika hasil sudah ada, tetap pastikan Growth Cycle ikut ditutup.
    if (existingResult) {
      await completeLinkedGrowthCycle(supabase, experiment);
      return NextResponse.json({
        experiment,
        result: existingResult,
      });
    }

    /* BUAT EVALUASI */

    const { data: rows, error: rowsError } = await supabase
      .from("experiment_checkins")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("checkin_date", { ascending: true });

    if (rowsError) {
      console.error("[experiments finish] rows:", rowsError.code);
      return jsonError("Gagal mengambil data check-in.", 500);
    }

    const { data: financeRow, error: financeError } = await supabase
      .from("financial_readiness")
      .select("*")
      .eq("business_id", experiment.business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (financeError) {
      console.error("[experiments finish] finance:", financeError.code);
      return jsonError("Gagal mengambil data keuangan.", 500);
    }

    const margin = calculateFinance(financeRow)?.margin ?? 0;

    const evaluation = buildEvaluation(
      experiment,
      rows || [],
      margin,
      experiment.status
    );

    const { data: result, error: insertError } = await supabase
      .from("experiment_results")
      .insert({ experiment_id: experiment.id, ...evaluation })
      .select("*")
      .single();

    if (insertError) {
      console.error("[experiments finish] insert:", insertError.code);
      return jsonError("Hasil eksperimen gagal disimpan.", 500);
    }

    // Hasil evaluasi sudah tersimpan. Sekarang tutup Growth Cycle.
    await completeLinkedGrowthCycle(supabase, experiment);

    return NextResponse.json({ experiment, result }, { status: 201 });
  } catch (err) {
    console.error("[experiments finish] unexpected:", err?.message);
    return jsonError(
      err?.message === "Gagal memperbarui status Growth Cycle."
        ? err.message
        : "Terjadi kesalahan pada server.",
      500
    );
  }
}
