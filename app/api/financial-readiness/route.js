import { createSupabaseServerClient } from "../../../lib/supabase/server";
import { calculateFinancialReadiness } from "../../../lib/financial-readiness-engine";
import { normalizeFinancialPeriod } from "../../../lib/financial-period-normalizer";

const RISK_ALLOWANCE_PCT = 15;
const MAX_DB_INTEGER = 2147483647;

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

    const affordableLoss = Math.round(
      Math.max(0, normalized.freeSurplus) *
        (RISK_ALLOWANCE_PCT / 100)
    );

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
          risk_allowance_pct: RISK_ALLOWANCE_PCT,
          business_profit: normalized.businessProfit,
          free_surplus: normalized.freeSurplus,
          affordable_loss: affordableLoss,
          recommended_budget: recommendedBudget,
          status,
          growth_level: null,
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
        riskAllowancePct: RISK_ALLOWANCE_PCT,
        affordableLoss,
        recommendedBudget,
        growthLevel: null,
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
