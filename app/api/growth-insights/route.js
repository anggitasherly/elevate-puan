import { getAuthenticatedContext } from "@/lib/server/auth";
import { getGrowthInsightsData } from "@/lib/server/growth-insights";
import { errorResponse, jsonResponse } from "@/lib/server/http";

export const dynamic = "force-dynamic"; // Selalu dijalankan setiap request, tidak di-cache.

export async function GET(request) {
  try {
    const { supabase, user } = await getAuthenticatedContext(request);
    const data = await getGrowthInsightsData(supabase, user);

    return jsonResponse({ success: true, data });
  } catch (error) {
    return errorResponse(error, "Gagal memuat data Growth Insights.");
  }
}