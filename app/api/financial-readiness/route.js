import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { calculateFinancialReadiness } from "../../../lib/financial-readiness-engine";
import { normalizeFinancialPeriod } from "../../../lib/financial-period-normalizer";
import { determineGrowthLevel } from "../../../lib/growth-level";

const MAX_DB_INTEGER = 2147483647;

// Riwayat eksperimen selesai milik satu usaha, dari yang paling lama ke yang
// paling baru. Dipakai untuk menentukan level pertumbuhan dan risk allowance.
// Kalau riwayat gagal dibaca, kembalikan daftar kosong (Level 1, 15%) supaya
// perhitungan tetap tersimpan dengan aturan paling hati-hati.
async function loadCompletedHistory(supabase, businessId) {
  const { data: experiments, error: experimentError } = await supabase
    .from("experiments")
    .select("id, created_at")
    .eq("business_id", businessId)
    .eq("status", "completed")
    .order("end_date", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (experimentError) {
    console.error("Financial history error:", experimentError.message);
    return [];
  }

  if (!experiments || experiments.length === 0) return [];

  const { data: results, error: resultError } = await supabase
    .from("experiment_results")
    .select("experiment_id, net_profit, created_at")
    .in(
      "experiment_id",
      experiments.map((item) => item.id)
    )
    .order("created_at", { ascending: true });

  if (resultError) {
    console.error("Financial history result error:", resultError.message);
    return [];
  }

  // Ambil hasil terbaru untuk tiap eksperimen.
  const latestResult = {};
  for (const row of results ?? []) {
    latestResult[row.experiment_id] = row;
  }

  return experiments.map((item) => ({
    id: item.id,
    net_profit: latestResult[item.id]?.net_profit ?? null,
  }));
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    let input;

    try {
      input = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Format JSON tidak valid." },
        { status: 400 }
      );
    }

    let analysis;
    let normalized;

    try {
      analysis = calculateFinancialReadiness(input);
      normalized = normalizeFinancialPeriod(analysis);
    } catch (error) {
      return Response.json(
        { success: false, message: error.message },
        { status: 400 }
      );
    }

    const { data: businesses, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(2);

    if (businessError) {
      console.error("Business lookup error:", businessError);

      return Response.json(
        { success: false, message: "Gagal memeriksa data usaha." },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length !== 1) {
      return Response.json(
        {
          success: false,
          message:
            businesses?.length > 1
              ? "Ditemukan lebih dari satu usaha. Hubungi pengelola."
              : "Lengkapi profil usaha terlebih dahulu.",
        },
        { status: 409 }
      );
    }

    // Level pertumbuhan dan risk allowance mengikuti riwayat eksperimen selesai
    // (aturan lengkap di lib/growth-level.js): Level 1 = 15%, Level 2 = 20%,
    // Level 3 = 25%.
    const history = await loadCompletedHistory(
      supabase,
      businesses[0].id
    );

    const {
      growthLevel,
      riskAllowancePct,
      safeLimit: affordableLoss,
    } = determineGrowthLevel({
      marginFilled: Number.isFinite(normalized.productMarginPct),
      freeSurplus: normalized.freeSurplus,
      history,
    });

    const recommendedBudget = Math.min(
      affordableLoss,
      normalized.experimentBudget
    );

    if (
      !Number.isSafeInteger(affordableLoss) ||
      !Number.isSafeInteger(recommendedBudget) ||
      affordableLoss > MAX_DB_INTEGER ||
      recommendedBudget > MAX_DB_INTEGER ||
      normalized.experimentBudget > MAX_DB_INTEGER
    ) {
      return Response.json(
        {
          success: false,
          message: "Nominal melebihi batas penyimpanan database.",
        },
        { status: 400 }
      );
    }

    const status =
      normalized.freeSurplus <= 0
        ? "not_recommended"
        : normalized.experimentBudget <= affordableLoss
          ? "within_range"
          : "above_recommended";

    const { data: saved, error: saveError } =
      await supabase
        .from("financial_readiness")
        .insert({
          business_id: businesses[0].id,
          monthly_revenue: normalized.monthlyRevenue,
          monthly_operating_cost: normalized.monthlyOperatingCost,
          household_need: normalized.monthlyHouseholdNeed,
          product_margin_pct: normalized.productMarginPct,
          willingness_to_lose: normalized.experimentBudget,
          risk_allowance_pct: riskAllowancePct,
          business_profit: normalized.businessProfit,
          free_surplus: normalized.freeSurplus,
          affordable_loss: affordableLoss,
          recommended_budget: recommendedBudget,
          status,
          growth_level: growthLevel,
        })
        .select("id, created_at")
        .single();

    if (saveError) {
      console.error("Financial save error:", saveError);

      return Response.json(
        {
          success: false,
          message: "Perhitungan berhasil, tetapi penyimpanan database gagal.",
        },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      analysis,
      financialGate: {
        status,
        riskAllowancePct,
        affordableLoss,
        recommendedBudget,
        growthLevel,
      },
      normalized,
      persisted: true,
      recordId: saved.id,
      createdAt: saved.created_at,
      message: "Perhitungan berhasil disimpan ke Supabase.",
    });
  } catch (error) {
    console.error("Financial Readiness API error:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
