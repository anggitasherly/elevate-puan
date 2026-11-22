import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { runInitialDiagnosis } from "@/lib/diagnosis/unified-diagnosis";

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    // 1. Verifikasi pengguna
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    // 2. Validasi assessment_id
    let body;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Format JSON tidak valid." },
        { status: 400 }
      );
    }

    const assessmentId = body?.assessment_id;

    const uuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (
      typeof assessmentId !== "string" ||
      !uuidPattern.test(assessmentId)
    ) {
      return NextResponse.json(
        { error: "assessment_id tidak valid." },
        { status: 400 }
      );
    }

    // 3. Cari bisnis pengguna
    const { data: business, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

    if (businessError) {
      console.error("Diagnosis business lookup:", businessError);
      return NextResponse.json(
        { error: "Gagal memeriksa data bisnis." },
        { status: 500 }
      );
    }

    if (!business) {
      return NextResponse.json(
        { error: "Bisnis pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // 4. Ambil Assessment milik bisnis pengguna
    const { data: assessment, error: assessmentError } =
      await supabase
        .from("assessment")
        .select("*")
        .eq("id", assessmentId)
        .eq("business_id", business.id)
        .maybeSingle();

    if (assessmentError) {
      console.error("Diagnosis assessment lookup:", assessmentError);
      return NextResponse.json(
        { error: "Gagal mengambil Assessment." },
        { status: 500 }
      );
    }

    if (!assessment) {
      return NextResponse.json(
        { error: "Assessment tidak ditemukan." },
        { status: 404 }
      );
    }

    if (assessment.status !== "submitted") {
      return NextResponse.json(
        {
          error:
            "Diagnosis hanya dapat dijalankan pada Assessment berstatus submitted.",
        },
        { status: 409 }
      );
    }

    // 5. Jalankan Diagnosis Engine
    // Normalisasi kolom multi-pilihan dari Supabase (text).
    function toArray(value) {
      if (Array.isArray(value)) {
        return value.filter(
          (item) => typeof item === "string" && item.trim()
        );
      }

      if (typeof value !== "string" || !value.trim()) {
        return [];
      }

      const trimmed = value.trim();

      if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
        try {
          const parsed = JSON.parse(trimmed);
          return Array.isArray(parsed)
            ? parsed.filter(
                (item) => typeof item === "string" && item.trim()
              )
            : [];
        } catch {
          return [];
        }
      }

      return trimmed.split(",").map((item) => item.trim()).filter(Boolean);
    }

    const normalizedAssessment = {
      ...assessment,
      main_customers: toArray(assessment.main_customers),
      sales_sources: toArray(assessment.sales_sources),
      operational_obstacles: toArray(assessment.operational_obstacles),
    };

    // Klarifikasi hanya menerima field dan opsi yang sebelumnya diberikan engine.
    // Jawaban tersimpan dalam ai_diagnosis agar tidak memerlukan migrasi tabel.
    const previous = assessment.ai_diagnosis && typeof assessment.ai_diagnosis === "object"
      ? assessment.ai_diagnosis : {};
    const priorAnswers = previous.clarification_answers && typeof previous.clarification_answers === "object"
      ? previous.clarification_answers : {};
    const clarification = body?.clarification;
    let answers = { ...priorAnswers };
    let rounds = Number.isInteger(previous.clarification_round)
      ? Math.min(2, Math.max(0, previous.clarification_round)) : 0;

    if (clarification !== undefined) {
      if (!clarification || typeof clarification !== "object" || Array.isArray(clarification)
        || previous.diagnosis_status !== "needs_clarification" || rounds >= 2
        || clarification.field !== previous.clarification_field
        || typeof clarification.value !== "string"
        || !Array.isArray(previous.clarification_options)
        || !previous.clarification_options.includes(clarification.value)) {
        return NextResponse.json({ error: "Jawaban klarifikasi tidak valid atau tidak diperlukan." }, { status: 400 });
      }
      answers[clarification.field] = clarification.value;
      rounds += 1;
    } else if (body?.priority_problem_type !== undefined) {
      return NextResponse.json({ error: "Gunakan jawaban klarifikasi terstruktur, bukan priority_problem_type." }, { status: 400 });
    }

    // Lewat pintu masuk terpadu. Yang disimpan tetap hasil mentah engine,
    // jadi bentuk ai_diagnosis tidak berubah (dibaca Business Overview dan Recommendation).
    const unified = runInitialDiagnosis({
      ...normalizedAssessment,
      ...answers,
      clarification_answers: answers,
      clarification_round: rounds,
    });

    const engineResult = { ...unified.raw };
    delete engineResult.opportunities;

    const diagnosis = {
      ...engineResult,
      clarification_answers: answers,
      clarification_round: rounds,
    };

    // 6. Simpan hasil diagnosis
    const { data: saved, error: saveError } =
      await supabase
        .from("assessment")
        .update({ ai_diagnosis: diagnosis })
        .eq("id", assessment.id)
        .eq("business_id", business.id)
        .eq("status", "submitted")
        .select("id, ai_diagnosis")
        .maybeSingle();

    if (saveError) {
      console.error("Diagnosis save:", saveError);
      return NextResponse.json(
        { error: "Gagal menyimpan hasil diagnosis." },
        { status: 500 }
      );
    }

    if (!saved) {
      return NextResponse.json(
        {
          error:
            "Assessment berubah atau tidak dapat diperbarui.",
        },
        { status: 409 }
      );
    }

    return NextResponse.json({
      success: true,
      assessment_id: saved.id,
      diagnosis: saved.ai_diagnosis,
    });
  } catch (error) {
    console.error("Diagnosis API:", error);

    return NextResponse.json(
      { error: "Terjadi kesalahan pada Diagnosis API." },
      { status: 500 }
    );
  }
}

