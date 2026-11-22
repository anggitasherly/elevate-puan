import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
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

    const { data: businesses, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(2);

    if (businessError) {
      console.error("Recommendation business:", businessError);
      return Response.json(
        { success: false, message: "Gagal mengambil data usaha." },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length !== 1) {
      return Response.json(
        { success: false, message: "Data usaha belum tersedia atau tidak unik." },
        { status: 409 }
      );
    }

    const businessId = businesses[0].id;

    const [assessmentResult, constraintsResult, financialResult] =
      await Promise.all([
        supabase
          .from("assessment")
          .select("id, status, ai_diagnosis, created_at, updated_at")
          .eq("business_id", businessId)
          .eq("status", "submitted")
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("constraints")
          .select(
            "id, hours_per_week, digital_skill, team_size, details, created_at"
          )
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("financial_readiness")
          .select(
            "id, monthly_revenue, monthly_operating_cost, household_need, willingness_to_lose, business_profit, free_surplus, affordable_loss, recommended_budget, risk_allowance_pct, status, growth_level, created_at"
          )
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    if (
      assessmentResult.error ||
      constraintsResult.error ||
      financialResult.error
    ) {
      console.error("Recommendation context query:", {
        assessment: assessmentResult.error,
        constraints: constraintsResult.error,
        financial: financialResult.error,
      });

      return Response.json(
        { success: false, message: "Gagal mengambil konteks rekomendasi." },
        { status: 500 }
      );
    }

    const assessment = assessmentResult.data;
    const constraints = constraintsResult.data;
    const financial = financialResult.data;

    const diagnosis = assessment?.ai_diagnosis ?? null;

    const diagnosisReady =
      diagnosis?.diagnosis_status === "diagnosed" &&
      typeof diagnosis?.primary_problem?.problem_type === "string";

    const constraintsReady =
      constraints?.hours_per_week != null &&
      constraints?.digital_skill != null &&
      constraints?.team_size != null;

    const financialReady =
      financial?.status != null &&
      financial?.recommended_budget != null;

    const missing = [];

    if (!assessment) {
      missing.push("assessment");
    } else if (!diagnosisReady) {
      missing.push("diagnosis");
    }

    if (!constraintsReady) {
      missing.push("constraints");
    }

    if (!financialReady) {
      missing.push("financial_readiness");
    }

    return Response.json({
      success: true,
      ready: missing.length === 0,
      missing,
      businessId,
      context: {
        assessment: assessment
          ? {
              id: assessment.id,
              status: assessment.status,
              createdAt: assessment.created_at,
              updatedAt: assessment.updated_at,
            }
          : null,
        diagnosis,
        constraints,
        financial,
      },
    });
  } catch (error) {
    console.error("Recommendation context API:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}
