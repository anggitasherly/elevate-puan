/*
 * Helper bersama untuk route Daily / Hasil:
 *   - /api/experiments/detail
 *   - /api/experiments/[id]/checkin
 *   - /api/experiments/[id]/finish
 * Logika check-in dan evaluasi disalin dari halaman Daily
 * supaya hasilnya sama persis.
 */

import { NextResponse } from "next/server";
import {
  EXPERIMENT_DURATION_DAYS,
  parseJson,
} from "@/lib/experiments/server-helpers";

export const STATUS = {
  ACTIVE: "active",
  LEGACY_RUNNING: "running",
  COMPLETED: "completed",
  STOPPED: "stopped",
  EXPIRED: "expired",
};

// active = status sekarang, running = status lama (kompatibilitas)
export const ACTIVE_STATUSES = [STATUS.ACTIVE, STATUS.LEGACY_RUNNING];

export const FINAL_STATUSES = [
  STATUS.COMPLETED,
  STATUS.STOPPED,
  STATUS.EXPIRED,
];

export const MOODS = ["Lancar", "Lumayan", "Agak sulit"];

export function jsonError(message, status, extra = {}) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

/* Sama dengan toNumber di halaman Daily (angka biasa dari database). */
export function plainNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/* =========================================
   STATUS CHECK-IN
========================================= */

export function isNoteSaved(row) {
  if (!row) return false;

  const steps = parseJson(row.steps_done, []);

  return (
    Array.isArray(steps) &&
    steps.length > 0 &&
    row.progress_note !== null &&
    row.progress_note !== undefined &&
    row.mood !== null &&
    row.mood !== undefined
  );
}

export function isFinanceSaved(row) {
  return Boolean(
    row &&
      row.revenue_today !== null &&
      row.revenue_today !== undefined &&
      row.experiment_cost_today !== null &&
      row.experiment_cost_today !== undefined
  );
}

export function isDayComplete(row) {
  return isNoteSaved(row) && isFinanceSaved(row);
}

/* =========================================
   EVALUASI (experiment_results)
========================================= */

const clampInt = (value) =>
  Math.max(
    -2147483648,
    Math.min(2147483647, Math.round(Number(value) || 0))
  );

export function buildEvaluation(experiment, rows, margin, status) {
  const revenue = rows.reduce(
    (sum, r) => sum + plainNumber(r.revenue_today),
    0
  );

  const cost = rows.reduce(
    (sum, r) => sum + plainNumber(r.experiment_cost_today),
    0
  );

  const gross = revenue * margin;
  const net = gross - cost;

  const filledDays = rows.filter(isDayComplete).length;

  const target = plainNumber(experiment.target_value);

  let learnings = "";

  if (status === STATUS.COMPLETED) {
    learnings = `Eksperimen diselesaikan sampai Hari ${EXPERIMENT_DURATION_DAYS}. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  } else if (status === STATUS.STOPPED) {
    learnings = `Eksperimen dihentikan oleh pengguna sebelum selesai. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  } else {
    learnings = `Periode eksperimen berakhir sebelum selesai. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  }

  return {
    actual_value: Math.round(revenue),
    target_met: target > 0 && revenue >= target,
    checkin_completeness:
      Math.round((filledDays / EXPERIMENT_DURATION_DAYS) * 1000) / 10,
    cost_spent: clampInt(cost),
    additional_revenue: null, // diisi halaman Hasil: omzet aktual dikurangi baseline hari berjalan
    gross_profit: clampInt(gross),
    net_profit: clampInt(net),
    roi: cost > 0 ? Math.round((net / cost) * 10000) / 100 : null,
    learnings,
  };
}

/* =========================================
   KEPEMILIKAN DATA
========================================= */

/*
 * Mengembalikan { businessIds } atau { failure: { message, status } }.
 */
export async function getBusinessIds(supabase, userId) {
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .eq("user_id", userId);

  if (error) {
    console.error("[experiments] business:", error.code);
    return {
      failure: { message: "Gagal memeriksa data bisnis.", status: 500 },
    };
  }

  const businessIds = (data || []).map((b) => b.id);

  if (businessIds.length === 0) {
    return {
      failure: {
        message: "Bisnis tidak ditemukan untuk akun yang sedang login.",
        status: 404,
      },
    };
  }

  return { businessIds };
}

/*
 * Mengambil eksperimen berdasarkan id, hanya jika milik pengguna.
 * Mengembalikan { experiment } atau { failure: { message, status } }.
 */
export async function getOwnedExperiment(supabase, userId, experimentId) {
  const owned = await getBusinessIds(supabase, userId);

  if (owned.failure) return owned;

  const { data: experiment, error } = await supabase
    .from("experiments")
    .select("*")
    .eq("id", experimentId)
    .in("business_id", owned.businessIds)
    .maybeSingle();

  if (error) {
    console.error("[experiments] experiment:", error.code);
    return {
      failure: { message: "Gagal mengambil data eksperimen.", status: 500 },
    };
  }

  if (!experiment) {
    return {
      failure: { message: "Eksperimen tidak ditemukan.", status: 404 },
    };
  }

  return { experiment };
}
