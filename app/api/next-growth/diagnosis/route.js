
import { getAuthenticatedContext } from "@/lib/server/auth";
import {
  ApiError,
  errorResponse,
  jsonResponse,
} from "@/lib/server/http";

import { getNextGrowthData } from "@/lib/server/next-growth-data";
import { runNextGrowthDiagnosis } from "@/lib/diagnosis/unified-diagnosis";
import { saveNextGrowthDiagnosis } from "@/lib/next-growth/diagnosis-repository";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    // 1. Verifikasi sesi dan identitas user.
    const { supabase, user } = await getAuthenticatedContext(request);

    // 2. Ambil seluruh sumber data dari database.
    // business_id tidak diterima dari frontend.
    const sourceData = await getNextGrowthData(supabase, user);

    if (!sourceData.business) {
      throw new ApiError(
        "Data bisnis belum tersedia. Lengkapi profil bisnis terlebih dahulu.",
        404
      );
    }

    // 3. Jalankan diagnosis berdasarkan data database.
    const diagnosis = runNextGrowthDiagnosis(sourceData);

    // 4. Jika prasyarat belum terpenuhi, kembalikan alasan
    // tanpa menyimpan diagnosis yang belum memiliki sumber cycle valid.
    if (
      diagnosis.diagnosis_status === "blocked" ||
      !diagnosis.source_cycle_id
    ) {
      return jsonResponse(
        {
          success: false,
          message:
            "Next Growth belum dapat dijalankan karena prasyarat belum terpenuhi.",
          diagnosis,
        },
        409
      );
    }

    // 5. Simpan hasil diagnosis menggunakan session user.
    const savedDiagnosis = await saveNextGrowthDiagnosis(
      supabase,
      diagnosis
    );

    // 6. Kembalikan hasil dan ID record yang tersimpan.
    return jsonResponse(
      {
        success: true,
        message: "Next Growth Diagnosis berhasil dibuat.",
        diagnosis,
        saved: savedDiagnosis,
      },
      201
    );
  } catch (error) {
    return errorResponse(
      error,
      "Terjadi kesalahan saat memproses Next Growth Diagnosis."
    );
  }
}
