import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/experiments/server-helpers";
import {
  ACTIVE_STATUSES,
  getBusinessIds,
  jsonError,
} from "@/lib/experiments/checkin-helpers";

/*
 * GET /api/experiments/detail?experimentId=<uuid>&pick=active|latest
 *
 * - experimentId ada  : ambil eksperimen itu (jika milik pengguna)
 * - pick=active       : eksperimen berstatus active/running terbaru
 * - pick=latest       : eksperimen terbaru dengan status apa pun
 *
 * Balasan: { experiment, checkins, finance, result }
 */
export async function GET(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonError("Silakan login terlebih dahulu.", 401);
    }

    const params = new URL(request.url).searchParams;

    const experimentId = params.get("experimentId")?.trim() || "";
    const pick = params.get("pick") || "active";

    if (!["active", "latest"].includes(pick)) {
      return jsonError("Nilai pick tidak valid.", 400);
    }

    if (experimentId && !isUuid(experimentId)) {
      return jsonError("ID eksperimen tidak valid.", 400);
    }

    const owned = await getBusinessIds(supabase, user.id);

    if (owned.failure) {
      return jsonError(owned.failure.message, owned.failure.status);
    }

    let query = supabase
      .from("experiments")
      .select("*")
      .in("business_id", owned.businessIds);

    if (experimentId) {
      query = query.eq("id", experimentId);
    } else if (pick === "active") {
      query = query
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: false })
        .limit(1);
    } else {
      query = query.order("created_at", { ascending: false }).limit(1);
    }

    const { data: experiment, error: experimentError } =
      await query.maybeSingle();

    if (experimentError) {
      console.error("[experiments/detail] experiment:", experimentError.code);
      return jsonError("Gagal mengambil data eksperimen.", 500);
    }

    if (!experiment) {
      return jsonError(
        pick === "active"
          ? "Eksperimen aktif tidak ditemukan. Pilih strategi dan jalankan eksperimen terlebih dahulu."
          : "Eksperimen tidak ditemukan.",
        404
      );
    }

    const { data: checkins, error: checkinError } = await supabase
      .from("experiment_checkins")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("checkin_date", { ascending: true });

    if (checkinError) {
      console.error("[experiments/detail] checkins:", checkinError.code);
      return jsonError("Gagal mengambil data check-in.", 500);
    }

    const { data: finance, error: financeError } = await supabase
      .from("financial_readiness")
      .select("*")
      .eq("business_id", experiment.business_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (financeError) {
      console.error("[experiments/detail] finance:", financeError.code);
      return jsonError("Gagal mengambil data keuangan.", 500);
    }

    const { data: result, error: resultError } = await supabase
      .from("experiment_results")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (resultError) {
      console.error("[experiments/detail] result:", resultError.code);
      return jsonError("Gagal mengambil hasil eksperimen.", 500);
    }

    return NextResponse.json({
      experiment,
      checkins: checkins || [],
      finance: finance ?? null,
      result: result ?? null,
    });
  } catch (err) {
    console.error("[experiments/detail] unexpected:", err?.name);
    return jsonError("Terjadi kesalahan pada server.", 500);
  }
}
