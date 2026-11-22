
import "server-only";
import { ApiError } from "@/lib/server/http";

// Menyimpan diagnosis Next Growth.
// Satu bisnis hanya memiliki satu diagnosis untuk setiap Growth Cycle.
export async function saveNextGrowthDiagnosis(supabase, diagnosis) {
  // Validasi hasil diagnosis sebelum menyimpan.
  if (
    diagnosis?.diagnosis_mode !== "next_growth" ||
    diagnosis?.diagnosis_status === "blocked" ||
    !diagnosis?.business_id ||
    !diagnosis?.source_cycle_id
  ) {
    throw new ApiError(
      "Hasil diagnosis tidak memiliki referensi bisnis atau Growth Cycle yang valid.",
      422
    );
  }

  const payload = {
    business_id: diagnosis.business_id,
    source_cycle_id: diagnosis.source_cycle_id,
    diagnosis_payload: diagnosis,
    source_references: diagnosis.source_references ?? {},
    generated_at: diagnosis.generated_at ?? new Date().toISOString(),
  };

  // UPSERT: update diagnosis jika bisnis dan cycle sudah memiliki record.
  const { data, error } = await supabase
    .from("next_growth_diagnoses")
    .upsert(payload, {
      onConflict: "business_id,source_cycle_id",
    })
    .select("id, business_id, source_cycle_id, generated_at, created_at")
    .single();

  if (error) {
    console.error("Gagal menyimpan Next Growth Diagnosis:", error);

    throw new ApiError(
      "Diagnosis berhasil diproses, tetapi hasilnya gagal disimpan.",
      500
    );
  }

  return data;
}
