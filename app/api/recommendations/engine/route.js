import { getAuthenticatedContext } from "@/lib/server/auth";
import { ApiError, errorResponse, jsonResponse } from "@/lib/server/http";
import { loadPlaybookCatalog } from "@/lib/recommendation/playbook-catalog";
import { buildEnginePayload, shapeEngineResponse } from "@/lib/recommendation/engine-io";
import { callRecommendationEngine } from "@/lib/recommendation/engine-client";
import { generateRecommendationNarratives } from "@/lib/recommendation/narrative";
import { saveRecommendationProposals } from "@/lib/recommendation/proposal-store";

export const dynamic = "force-dynamic";

// Rekomendasi dari mesin Python, dijelaskan AI, lalu disimpan ke solution_proposals di server.
export async function GET(request) {
  try {
    const { supabase, user } = await getAuthenticatedContext();

    const { data: businesses, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(2);

    if (businessError) {
      console.error("Rekomendasi: gagal membaca usaha:", businessError);
      throw new ApiError("Gagal mengambil data usaha.", 500);
    }
    if (!businesses || businesses.length !== 1) {
      throw new ApiError("Data usaha belum tersedia atau tidak unik.", 409);
    }

    const businessId = businesses[0].id;

    const [assessmentResult, constraintsResult, financialResult] = await Promise.all([
      supabase
        .from("assessment")
        .select("id, status, ai_diagnosis, created_at")
        .eq("business_id", businessId)
        .eq("status", "submitted")
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("constraints")
        .select("id, hours_per_week, digital_skill, team_size, details, created_at")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("financial_readiness")
        .select(
          "id, willingness_to_lose, affordable_loss, recommended_budget, risk_allowance_pct, status, growth_level, created_at"
        )
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (assessmentResult.error || constraintsResult.error || financialResult.error) {
      console.error("Rekomendasi: gagal membaca konteks:", {
        assessment: assessmentResult.error,
        constraints: constraintsResult.error,
        financial: financialResult.error,
      });
      throw new ApiError("Gagal mengambil konteks rekomendasi.", 500);
    }

    let playbooks;
    try {
      playbooks = await loadPlaybookCatalog(supabase);
    } catch (error) {
      console.error("Rekomendasi: gagal membaca katalog:", error);
      throw new ApiError("Gagal mengambil katalog strategi.", 500);
    }

    const built = buildEnginePayload({
      businessId,
      assessment: assessmentResult.data,
      constraints: constraintsResult.data,
      financial: financialResult.data,
      playbooks,
    });

    if (!built.ok) {
      return jsonResponse(
        {
          success: false,
          ready: false,
          missing: built.missing,
          message: "Data belum lengkap untuk menyusun rekomendasi.",
        },
        409
      );
    }

    const result = await callRecommendationEngine(built.payload);

    const includeDebug =
      process.env.NODE_ENV !== "production" &&
      new URL(request.url).searchParams.get("debug") === "1";

    const shaped = shapeEngineResponse(result, { includeDebug });

    // Narasi dibuat Gemini dari hasil mesin. Bila gagal, tampilan memakai teks cadangan.
    const narrative = await generateRecommendationNarratives({
      recommendations: shaped.recommendations,
      diagnosis: built.payload.diagnosis,
      constraints: built.payload.constraints,
      financial: built.payload.financial_readiness,
    });
    shaped.recommendations = shaped.recommendations.map((item) => ({
      ...item,
      narrative: narrative.byId[item.playbook_id] ?? null,
    }));

    // Simpan hasilnya di server agar halaman Rancangan bisa membacanya lewat proposal_id.
    let proposalIds = {};
    try {
      proposalIds = await saveRecommendationProposals({
        supabase,
        businessId,
        recommendations: shaped.recommendations,
      });
    } catch (error) {
      console.error("Rekomendasi: gagal menyimpan proposal:", error?.message);
    }
    shaped.recommendations = shaped.recommendations.map((item) => ({
      ...item,
      proposal_id: proposalIds[item.playbook_id] ?? null,
    }));

    return jsonResponse({
      success: true,
      ...shaped,
      narrative_source: narrative.source,
      meta: { financial_status: financialResult.data?.status ?? null },
    });
  } catch (error) {
    return errorResponse(error, "Terjadi kesalahan saat menyusun rekomendasi.");
  }
}
