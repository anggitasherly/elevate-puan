
import { getAuthenticatedContext } from "@/lib/server/auth";
import { getGrowthInsightsData } from "@/lib/server/growth-insights";
import { ApiError, errorResponse, jsonResponse } from "@/lib/server/http";

import {
  computeEvidence,
  generateGrowthInsightsAnalysis,
  todayString,
  createGrowthInsightsFingerprint,
  GROWTH_INSIGHTS_PROMPT_VERSION,
} from "@/lib/ai/growth-insights";

export const dynamic = "force-dynamic";

function restoreCachedAnalysis(row, evidence, cacheStatus = "hit") {
  return {
    aiStatus: "available",
    cacheStatus,
    businessAnalysis: row.overall_analysis,
    diagnosis: {
      worked: row.working ?? [],
      didNotWork: row.not_working ?? [],
      possibleCauses: row.possible_causes ?? [],
    },
    learnings: row.learnings ?? [],
    evidence: {
      ...evidence,
      explanation:
        row.evidence_snapshot?.explanation ??
        "Bukti dihitung ulang berdasarkan data terbaru.",
    },
  };
}

function buildStoragePayload({
  businessId,
  data,
  analysis,
  fingerprint,
}) {
  const experimentIds = data.experiments.map((item) => item.id);

  return {
    business_id: businessId,
    confidence_level: analysis.evidence.confidence,
    working: analysis.diagnosis.worked,
    not_working: analysis.diagnosis.didNotWork,
    possible_causes: analysis.diagnosis.possibleCauses,
    overall_analysis: analysis.businessAnalysis,
    learnings: analysis.learnings,
    evidence_snapshot: analysis.evidence,
    source_experiment_id: experimentIds[0] ?? null,
    source_experiment_ids: experimentIds,
    data_fingerprint: fingerprint,
    prompt_version: GROWTH_INSIGHTS_PROMPT_VERSION,
    analysis_status: "valid",
  };
}

async function findCachedAnalysis(supabase, businessId, fingerprint) {
  const { data, error } = await supabase
    .from("growth_insights")
    .select("*")
    .eq("business_id", businessId)
    .eq("data_fingerprint", fingerprint)
    .eq("prompt_version", GROWTH_INSIGHTS_PROMPT_VERSION)
    .eq("analysis_status", "valid")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Kegagalan membaca cache bukan berarti cache miss.
  if (error) {
    console.error("Growth Insights cache lookup gagal:", error.message);
    throw error;
  }

  return data;
}

async function findPreviousAnalysis(supabase, businessId) {
  const { data, error } = await supabase
    .from("growth_insights")
    .select("*")
    .eq("business_id", businessId)
    .in("analysis_status", ["valid", "stale"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Growth Insights previous analysis lookup gagal:",
      error.message
    );
    throw error;
  }

  return data;
}

async function saveAnalysis(supabase, payload) {
  const { data: existing, error: lookupError } = await supabase
    .from("growth_insights")
    .select("id")
    .eq("business_id", payload.business_id)
    .eq("data_fingerprint", payload.data_fingerprint)
    .eq("prompt_version", payload.prompt_version)
    .limit(1)
    .maybeSingle();

  if (lookupError) throw lookupError;

  // Jika fingerprint yang sama sudah ada, perbarui baris tersebut.
  if (existing?.id) {
    const { error } = await supabase
      .from("growth_insights")
      .update(payload)
      .eq("id", existing.id);

    if (error) throw error;
    return existing.id;
  }

  const { data, error } = await supabase
    .from("growth_insights")
    .insert(payload)
    .select("id")
    .single();

  if (!error) return data.id;

  // Dua request dapat mencoba menyimpan fingerprint yang sama.
  // Unique index mencegah duplikasi; jika terjadi konflik,
  // gunakan baris yang sudah berhasil dibuat request lain.
  if (error.code === "23505") {
    const { data: concurrentRow, error: concurrentLookupError } =
      await supabase
        .from("growth_insights")
        .select("id")
        .eq("business_id", payload.business_id)
        .eq("data_fingerprint", payload.data_fingerprint)
        .eq("prompt_version", payload.prompt_version)
        .maybeSingle();

    if (concurrentLookupError) throw concurrentLookupError;
    if (!concurrentRow?.id) throw error;

    const { error: updateError } = await supabase
      .from("growth_insights")
      .update(payload)
      .eq("id", concurrentRow.id);

    if (updateError) throw updateError;

    return concurrentRow.id;
  }

  throw error;
}

async function markPreviousAnalysesStale(
  supabase,
  businessId,
  currentFingerprint
) {
  const { error } = await supabase
    .from("growth_insights")
    .update({ analysis_status: "stale" })
    .eq("business_id", businessId)
    .eq("analysis_status", "valid")
    .or(
      `data_fingerprint.is.null,data_fingerprint.neq.${currentFingerprint},prompt_version.is.null,prompt_version.neq.${GROWTH_INSIGHTS_PROMPT_VERSION}`
    );

  if (error) {
    console.error(
      "Growth Insights: gagal menandai analisis lama sebagai stale:",
      error.message
    );
    throw error;
  }
}

async function markOneAnalysisStale(supabase, analysisId) {
  if (!analysisId) return;

  const { error } = await supabase
    .from("growth_insights")
    .update({ analysis_status: "stale" })
    .eq("id", analysisId)
    .eq("analysis_status", "valid");

  if (error) {
    console.error(
      "Growth Insights: gagal memperbarui status fallback:",
      error.message
    );
  }
}

export async function POST(request) {
  try {
    const { supabase, user } = await getAuthenticatedContext(request);
    const data = await getGrowthInsightsData(supabase, user);

    if (!data.business) {
      throw new ApiError("Data bisnis belum tersedia.", 404);
    }

    if (data.experiments.length === 0) {
      throw new ApiError(
        "Belum ada data eksperimen yang cukup untuk dianalisis.",
        422
      );
    }

    const today = todayString();
    const evidence = computeEvidence(data, today);
    const fingerprint = createGrowthInsightsFingerprint(data, today);

    // 1. Gunakan cache jika data dan versi prompt masih sama.
    const cached = await findCachedAnalysis(
      supabase,
      data.business.id,
      fingerprint
    );

    if (cached) {
      return jsonResponse({
        success: true,
        data: restoreCachedAnalysis(cached, evidence),
      });
    }

    // 2. Simpan referensi analisis sebelumnya untuk fallback.
    const previous = await findPreviousAnalysis(
      supabase,
      data.business.id
    );

    try {
      // 3. Buat analisis baru hanya ketika cache tidak cocok.
      const analysis = await generateGrowthInsightsAnalysis(data, {
        today,
      });

      const storagePayload = buildStoragePayload({
        businessId: data.business.id,
        data,
        analysis,
        fingerprint,
      });

      let saved = false;

      try {
        await saveAnalysis(supabase, storagePayload);
        saved = true;
      } catch (storageError) {
        console.error(
          "Growth Insights: gagal menyimpan hasil AI:",
          storageError.message
        );
      }

      // 4. Setelah hasil baru tersimpan, tandai analisis lama stale.
      // Jika penyimpanan gagal, analisis lama tidak diubah.
      if (saved) {
        try {
          await markPreviousAnalysesStale(
            supabase,
            data.business.id,
            fingerprint
          );
        } catch {
          // Hasil baru tetap dapat digunakan walaupun pembaruan
          // status analisis lama gagal.
        }
      }

      return jsonResponse({
        success: true,
        data: {
          ...analysis,
          cacheStatus: "miss",
        },
      });
    } catch (aiError) {
      if (!(aiError instanceof ApiError) || ![502, 503].includes(aiError.status)) {
        throw aiError;
      }

      console.error(
        "Growth Insights AI tidak tersedia:",
        aiError.message
      );

      // 5. Jika AI gagal, tandai analisis sebelumnya stale.
      if (previous) {
        await markOneAnalysisStale(supabase, previous.id);

        return jsonResponse({
          success: true,
          data: {
            ...restoreCachedAnalysis(previous, evidence, "previous"),
            aiStatus: "stale",
            message:
              "Analisis terbaru belum berhasil dibuat. Analisis sebelumnya tetap ditampilkan; metrik dan bukti dihitung dari data terbaru.",
          },
        });
      }

      // 6. Jika belum pernah ada analisis, evidence tetap tersedia.
      return jsonResponse({
        success: true,
        data: {
          aiStatus: "unavailable",
          analysis: null,
          evidence,
          message:
            "Analisis AI belum tersedia saat ini. Data metrik dan bukti tetap dapat digunakan.",
        },
      });
    }
  } catch (error) {
    return errorResponse(error, "Gagal membuat AI Learning Insights.");
  }
}
