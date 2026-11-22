import { createSupabaseServerClient } from "../../../../lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, message: "Silakan login." },
        { status: 401 }
      );
    }

    const { data: businesses, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(2);

    if (businessError) {
      return Response.json(
        { success: false, message: "Gagal mengambil usaha." },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length !== 1) {
      return Response.json(
        {
          success: false,
          message: "Data usaha belum tersedia atau tidak unik.",
        },
        { status: 409 }
      );
    }

    const { data: financial, error: financialError } =
      await supabase
        .from("financial_readiness")
        .select(
          "id, monthly_revenue, monthly_operating_cost, household_need, willingness_to_lose, product_margin_pct, business_profit, free_surplus, affordable_loss, recommended_budget, risk_allowance_pct, status, growth_level, created_at"
        )
        .eq("business_id", businesses[0].id)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (financialError) {
      return Response.json(
        { success: false, message: "Gagal mengambil data keuangan." },
        { status: 500 }
      );
    }

    if (!financial) {
      return Response.json({
        success: true,
        available: false,
        financialContext: null,
        message: "Isi Financial Readiness terlebih dahulu.",
      });
    }

    const financialContext = {
      period: "Bulanan",
      revenue: financial.monthly_revenue,
      expenses: financial.monthly_operating_cost,
      householdNeed: financial.household_need,
      experimentBudget: financial.willingness_to_lose,
      willingnessToLose: financial.willingness_to_lose,
      productMargin: financial.product_margin_pct,
      profit: financial.business_profit,
      surplus: financial.free_surplus,
      remaining: financial.free_surplus - financial.willingness_to_lose,
      budgetRatio:
        financial.free_surplus > 0
          ? (financial.willingness_to_lose / financial.free_surplus) * 100
          : null,
      affordableLoss: financial.affordable_loss,
      recommendedBudget: financial.recommended_budget,
      riskAllowancePct: financial.risk_allowance_pct,
      financialGate: financial.status,
      financialGateApproved: financial.status === "within_range",
      growthLevel: financial.growth_level,
      calculatedAt: financial.created_at,
    };
    return Response.json({
      success: true,
      available: true,
      financialContext,
    });
  } catch (error) {
    console.error("Financial recommendation context:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
