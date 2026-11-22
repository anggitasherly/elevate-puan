import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ALLOWED_SOURCE_TYPES,
  EXPERIMENT_DURATION_DAYS,
  EXPERIMENT_STATUS,
  addDays,
  buildDailyPlanWithCapacity,
  calculateFinance,
  formatRupiah,
  getProposalChannels,
  hasCompleteSevenDayPlan,
  isUuid,
  normalizeDailyPlan,
  parseJson,
  parseWeeklyHours,
  toNumber,
  todayInJakarta,
} from "@/lib/experiments/server-helpers";

function jsonError(message, status) {
  return NextResponse.json({ error: message }, { status });
}

/*
 * POST /api/experiments
 * Body: { proposalId: uuid, target: number | null }
 *   target = null  -> pakai target rekomendasi dari keuangan terbaru
 *   target = angka -> target yang diedit pengguna
 * Balasan: { id, alreadyExisting }
 */
export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError(
        "Sesi login tidak ditemukan. Silakan login terlebih dahulu.",
        401
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError("Isi permintaan tidak valid.", 400);
    }

    const proposalId = body?.proposalId;

    if (!isUuid(proposalId)) {
      return jsonError("ID strategi tidak valid.", 400);
    }

    let targetOverride = null;

    if (body?.target !== null && body?.target !== undefined) {
      if (typeof body.target !== "number" || !Number.isFinite(body.target)) {
        return jsonError("Target omzet harus berupa angka.", 400);
      }
      targetOverride = Math.max(0, body.target);
    }

    /* STRATEGI + KEPEMILIKAN BISNIS */

    const { data: proposal, error: proposalError } = await supabase
      .from("solution_proposals")
      .select("*")
      .eq("id", proposalId)
      .maybeSingle();

    if (proposalError) {
      console.error("[experiments POST] proposal:", proposalError.code);
      return jsonError("Gagal mengambil data strategi.", 500);
    }

    if (!proposal) {
      return jsonError(
        "Strategi yang dipilih tidak ditemukan atau tidak lagi terhubung dengan bisnis ini. Silakan pilih ulang strategi.",
        404
      );
    }

    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", proposal.business_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (businessError) {
      console.error("[experiments POST] business:", businessError.code);
      return jsonError("Gagal memeriksa data bisnis.", 500);
    }

    if (!business) {
      return jsonError(
        "Bisnis tidak ditemukan atau bukan milik akun yang sedang login.",
        404
      );
    }

    if (!ALLOWED_SOURCE_TYPES.includes(proposal.source_type)) {
      return jsonError(
        "Asal strategi tidak valid. Strategi harus berasal dari Opportunity Library atau Growth Insight.",
        400
      );
    }

    /* CEK EKSPERIMEN AKTIF UNTUK STRATEGI YANG SAMA */

    const { data: existing, error: existingError } = await supabase
      .from("experiments")
      .select("id")
      .eq("business_id", business.id)
      .eq("proposal_id", proposal.id)
      .in("status", [
        EXPERIMENT_STATUS.ACTIVE,
        EXPERIMENT_STATUS.LEGACY_RUNNING,
      ])
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[experiments POST] existing:", existingError.code);
      return jsonError("Gagal memeriksa eksperimen yang sedang berjalan.", 500);
    }

    if (existing?.id) {
      return NextResponse.json({ id: existing.id, alreadyExisting: true });
    }

    /* KEUANGAN TERBARU (dibaca ulang di server) */

    const { data: financeRow, error: financeError } = await supabase
      .from("financial_readiness")
      .select("*")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (financeError) {
      console.error("[experiments POST] finance:", financeError.code);
      return jsonError("Gagal mengambil data keuangan.", 500);
    }

    if (!financeRow) {
      return jsonError(
        "Data Financial Readiness tidak ditemukan. Lengkapi data keuangan terlebih dahulu.",
        422
      );
    }

    const finance = calculateFinance(financeRow);

    if (
      !finance ||
      finance.omzet <= 0 ||
      finance.margin <= 0 ||
      finance.freeSurplus === null ||
      finance.freeSurplus < 0 ||
      finance.willingness === null ||
      finance.affordableLoss === null ||
      finance.budget === null
    ) {
      return jsonError(
        "Data Financial Readiness belum memenuhi persyaratan untuk menjalankan eksperimen.",
        422
      );
    }

    /* TARGET */

    const finalTarget =
      targetOverride !== null ? targetOverride : finance.estimatedTarget;

    if (!Number.isFinite(finalTarget) || finalTarget <= 0) {
      return jsonError(
        "Target omzet harus lebih besar dari nol. Silakan masukkan target secara manual atau periksa kembali data Financial Readiness.",
        422
      );
    }

    /* BIAYA */

    const experimentCost = Math.max(0, toNumber(proposal.est_cost));

    if (experimentCost > finance.budget) {
      return jsonError(
        `Estimasi biaya eksperimen (${formatRupiah(
          experimentCost
        )}) melebihi kemampuan budget (${formatRupiah(
          finance.budget
        )}). Strategi ini belum dapat dijalankan.`,
        422
      );
    }

    /* RENCANA HARIAN */

    const rawDailyPlan = parseJson(proposal.recommended_daily_plan, null);

    if (!hasCompleteSevenDayPlan(normalizeDailyPlan(rawDailyPlan))) {
      return jsonError(
        "Rencana harian belum lengkap. Strategi harus memiliki aktivitas untuk hari 1 sampai 7 pada recommended_daily_plan sebelum dapat dijalankan.",
        422
      );
    }

    /* KAPASITAS WAKTU */

    const { data: constraintRow, error: constraintError } = await supabase
      .from("constraints")
      .select("hours_per_week")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (constraintError) {
      console.error("[experiments POST] constraints:", constraintError.code);
      return jsonError("Gagal mengambil data kapasitas waktu.", 500);
    }

    const finalDailyPlan = buildDailyPlanWithCapacity(
      rawDailyPlan,
      parseWeeklyHours(constraintRow?.hours_per_week)
    );

    /* EKSPERIMEN SUMBER (Growth Insight) */

    let previousExperimentId = null;

    if (proposal.source_type === "growth_insight" && proposal.growth_insight_id) {
      const { data: insight, error: insightError } = await supabase
        .from("growth_insights")
        .select("source_experiment_id")
        .eq("id", proposal.growth_insight_id)
        .eq("business_id", business.id)
        .maybeSingle();

      if (insightError) {
        console.error("[experiments POST] insight:", insightError.code);
        return jsonError("Gagal membaca Growth Insight.", 500);
      }

      if (insight?.source_experiment_id) {
        const { data: sourceExperiment, error: sourceError } = await supabase
          .from("experiments")
          .select("id")
          .eq("id", insight.source_experiment_id)
          .eq("business_id", business.id)
          .maybeSingle();

        if (sourceError) {
          console.error("[experiments POST] source exp:", sourceError.code);
          return jsonError("Gagal membaca eksperimen sumber.", 500);
        }

        if (sourceExperiment?.id) previousExperimentId = sourceExperiment.id;
      }
    }

    /* TANGGAL (zona WIB) */

    const startDate = todayInJakarta();
    const endDate = addDays(startDate, EXPERIMENT_DURATION_DAYS - 1);

    /* PAYLOAD (daftar putih; tidak ada isi dari browser selain target) */

    const payload = {
      business_id: business.id,
      proposal_id: proposal.id,

      title: proposal.title || "Eksperimen tanpa judul",

      description:
        proposal.description ||
        proposal.problem_addressed ||
        proposal.rationale ||
        "Belum ada ringkasan eksperimen.",

      hypothesis:
        proposal.hypothesis || "Hipotesis eksperimen belum tersedia.",

      metric_name: `Total omzet usaha selama ${EXPERIMENT_DURATION_DAYS} hari`,

      baseline_value: Math.round(
        (toNumber(finance.omzet) / 30) * EXPERIMENT_DURATION_DAYS
      ),

      target_value: Math.round(finalTarget),
      budget_planned: experimentCost,

      growth_level:
        toNumber(proposal.growth_level) || toNumber(finance.growthLevel) || 1,

      start_date: startDate,
      end_date: endDate,

      success_criteria: parseJson(proposal.success_metrics, []),
      risks: parseJson(proposal.risks, []),
      daily_plan: finalDailyPlan,

      message_template: proposal.message_template || "",
      channels: getProposalChannels(proposal),

      status: EXPERIMENT_STATUS.ACTIVE,
    };

    if (previousExperimentId) {
      payload.previous_experiment_id = previousExperimentId;
    }

    const { data: result, error: rpcError } = await supabase.rpc(
      "create_experiment_with_growth_cycle",
      {
        p_experiment: payload,
      }
    );

    if (rpcError) {
      console.error("[experiments POST] RPC:", rpcError.code);

      // Kode error berasal dari fungsi database create_experiment_with_growth_cycle.
      // P0001 dan 23505: masih ada siklus atau eksperimen aktif yang belum selesai.
      if (rpcError.code === "P0001" || rpcError.code === "23505") {
        return jsonError(
          "Kamu masih punya eksperimen atau siklus yang belum selesai dievaluasi. Selesaikan dulu sebelum memulai eksperimen baru.",
          409
        );
      }

      // 42501: akses ditolak (bisnis atau strategi bukan milik akun ini).
      if (rpcError.code === "42501") {
        return jsonError(
          "Akses ditolak. Pastikan kamu login dengan akun pemilik bisnis ini.",
          403
        );
      }

      // 22023: data yang dikirim tidak valid.
      if (rpcError.code === "22023") {
        return jsonError(
          "Data eksperimen tidak valid. Silakan pilih ulang strategi.",
          400
        );
      }

      return jsonError(
        "Eksperimen dan growth cycle gagal disimpan. Silakan coba kembali.",
        500
      );
    }

    if (!result?.experiment_id || !result?.cycle_id) {
      return jsonError(
        "Eksperimen berhasil diproses, tetapi data growth cycle tidak lengkap.",
        500
      );
    }

    return NextResponse.json(
      {
        id: result.experiment_id,
        cycleId: result.cycle_id,
        cycleNumber: result.cycle_number,
        alreadyExisting: false,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[experiments POST] unexpected:", err?.name);
    return jsonError("Terjadi kesalahan pada server.", 500);
  }
}