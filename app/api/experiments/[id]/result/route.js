import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid, parseJson } from "@/lib/experiments/server-helpers";
import {
  FINAL_STATUSES,
  getOwnedExperiment,
  jsonError,
} from "@/lib/experiments/checkin-helpers";

const INT_MIN = -2147483648;
const INT_MAX = 2147483647;
const MAX_VALUE = 1_000_000_000_000;
const MAX_ROI = 1_000_000_000;
const MAX_LEARNINGS = 10000;
const MAX_EVALUATION_JSON = 50000;

// Daftar putih kolom angka experiment_results yang boleh dikirim browser
const NUMERIC_FIELDS = {
  actual_value: { int: false, min: -MAX_VALUE, max: MAX_VALUE },
  checkin_completeness: { int: false, min: 0, max: 100 },
  cost_spent: { int: true, min: INT_MIN, max: INT_MAX },
  additional_revenue: { int: true, min: INT_MIN, max: INT_MAX },
  gross_profit: { int: true, min: INT_MIN, max: INT_MAX },
  net_profit: { int: true, min: INT_MIN, max: INT_MAX },
  roi: { int: false, min: -MAX_ROI, max: MAX_ROI },
  break_even_orders: { int: true, min: 0, max: INT_MAX },
};

const isPlainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

/*
 * Mengembalikan { fields } atau { error }.
 * Hanya kolom pada daftar putih yang dibaca. experiment_id dan
 * evaluated_at TIDAK diambil dari isi permintaan.
 */
function parseResultFields(body) {
  const fields = {};

  for (const [key, rule] of Object.entries(NUMERIC_FIELDS)) {
    const value = body[key];

    if (value === undefined) continue;

    if (value === null) {
      fields[key] = null;
      continue;
    }

    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (rule.int && !Number.isInteger(value)) ||
      value < rule.min ||
      value > rule.max
    ) {
      return { error: `Nilai ${key} tidak valid.` };
    }

    fields[key] = value;
  }

  if (body.target_met !== undefined) {
    if (body.target_met !== null && typeof body.target_met !== "boolean") {
      return { error: "Nilai target_met tidak valid." };
    }

    fields.target_met = body.target_met;
  }

  if (body.learnings !== undefined) {
    if (
      body.learnings !== null &&
      (typeof body.learnings !== "string" ||
        body.learnings.length > MAX_LEARNINGS)
    ) {
      return { error: "Catatan pembelajaran tidak valid." };
    }

    fields.learnings = body.learnings;
  }

  const evaluation = body.system_evaluation;

  if (!isPlainObject(evaluation)) {
    return { error: "Evaluasi sistem tidak valid." };
  }

  let evaluationSize = 0;

  try {
    evaluationSize = JSON.stringify(evaluation).length;
  } catch {
    return { error: "Evaluasi sistem tidak valid." };
  }

  if (evaluationSize > MAX_EVALUATION_JSON) {
    return { error: "Evaluasi sistem terlalu besar." };
  }

  fields.system_evaluation = evaluation;

  return { fields };
}

/*
 * PUT /api/experiments/[id]/result
 *
 * Body: kolom hasil (daftar putih di atas) + system_evaluation.
 * Hanya untuk eksperimen berstatus completed / stopped / expired.
 *
 * - Kalau baris hasil sudah ada: dilengkapi (update berdasarkan id).
 * - Kalau belum ada: dibuat (insert).
 * - Kalau evaluasi versi yang sama sudah tersimpan: tidak ditimpa.
 * Balasan: { result } (selalu baris paling awal)
 */
export async function PUT(request, { params }) {
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

    if (!isPlainObject(body)) {
      return jsonError("Isi permintaan tidak valid.", 400);
    }

    const parsed = parseResultFields(body);

    if (parsed.error) {
      return jsonError(parsed.error, 400);
    }

    const owned = await getOwnedExperiment(supabase, user.id, id);

    if (owned.failure) {
      return jsonError(owned.failure.message, owned.failure.status);
    }

    const { experiment } = owned;

    if (!FINAL_STATUSES.includes(experiment.status)) {
      return jsonError(
        "Eksperimen belum selesai, hasil belum dapat disimpan.",
        409,
        { code: "not_final" }
      );
    }

    /* HASIL YANG SUDAH ADA (paling awal) */

    const { data: existing, error: existingError } = await supabase
      .from("experiment_results")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("[experiments result] existing:", existingError.code);
      return jsonError("Gagal memeriksa hasil eksperimen.", 500);
    }

    // Evaluasi versi yang sama yang sudah tersimpan tidak ditimpa lagi
    if (existing?.evaluated_at) {
      const storedEvaluation = parseJson(existing.system_evaluation, null);

      if (
        isPlainObject(storedEvaluation) &&
        storedEvaluation.version === parsed.fields.system_evaluation.version
      ) {
        return NextResponse.json({ result: existing });
      }
    }

    const fields = {
      ...parsed.fields,
      evaluated_at: new Date().toISOString(),
    };

    /* SIMPAN */

    if (existing) {
      const { data: updated, error: updateError } = await supabase
        .from("experiment_results")
        .update(fields)
        .eq("id", existing.id)
        .eq("experiment_id", experiment.id)
        .select("*")
        .single();

      if (updateError) {
        console.error("[experiments result] update:", updateError.code);
        return jsonError("Hasil eksperimen gagal disimpan.", 500);
      }

      return NextResponse.json({ result: updated });
    }

    const { data: inserted, error: insertError } = await supabase
      .from("experiment_results")
      .insert({ experiment_id: experiment.id, ...fields })
      .select("*")
      .single();

    if (insertError) {
      console.error("[experiments result] insert:", insertError.code);
      return jsonError("Hasil eksperimen gagal disimpan.", 500);
    }

    // Jika ada baris lain yang masuk bersamaan, kembalikan yang paling awal
    const { data: earliest } = await supabase
      .from("experiment_results")
      .select("*")
      .eq("experiment_id", experiment.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      { result: earliest || inserted },
      { status: 201 }
    );
  } catch (err) {
    console.error("[experiments result] unexpected:", err?.name);
    return jsonError("Terjadi kesalahan pada server.", 500);
  }
}