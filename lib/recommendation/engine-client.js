import "server-only";
import { ApiError } from "@/lib/server/http";

// Memanggil mesin rekomendasi Python (server ke server).
// Tidak pernah membuat rekomendasi pengganti bila Python gagal.
export async function callRecommendationEngine(payload) {
  const baseUrl = (process.env.RECOMMENDATION_ENGINE_URL || "").trim().replace(/\/+$/, "");

  if (!baseUrl) {
    console.error("RECOMMENDATION_ENGINE_URL belum diatur.");
    throw new ApiError("Layanan rekomendasi belum dikonfigurasi.", 503);
  }

  const headers = { "Content-Type": "application/json" };
  const token = (process.env.ENGINE_TOKEN || "").trim();
  if (token) headers["X-Engine-Token"] = token;

  let response;
  try {
    response = await fetch(`${baseUrl}/recommendations`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
  } catch (error) {
    console.error("Mesin rekomendasi tidak dapat dihubungi:", error?.name, error?.message);
    throw new ApiError(
      "Layanan rekomendasi sedang tidak dapat dihubungi. Coba lagi sebentar lagi.",
      503
    );
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Mesin rekomendasi menolak permintaan:", response.status, detail.slice(0, 500));

    if (response.status === 400) {
      throw new ApiError("Data usaha belum cukup untuk diproses mesin rekomendasi.", 422);
    }
    throw new ApiError("Mesin rekomendasi gagal memproses permintaan.", 502);
  }

  return response.json();
}
