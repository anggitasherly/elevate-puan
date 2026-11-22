import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_SELECT,
  BUSINESS_SELECT,
  findMissing,
} from "@/lib/assessment-draft";

export const runtime = "nodejs";

function fail(message, status, extra = {}) {
  return Response.json({ error: message, ...extra }, { status });
}

// Pengiriman akhir: memastikan semua pertanyaan terjawab, lalu mengubah status draft
// menjadi submitted. Setelah itu route diagnosis bisa membaca jawaban ini.
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Silakan masuk terlebih dahulu.", 401);

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    console.error("[assessment/submit] baca businesses:", businessError.message);
    return fail("Data usaha belum bisa dibaca.", 500);
  }
  if (!business) return fail("Usaha tidak ditemukan.", 404);

  const { data: draft, error: draftError } = await supabase
    .from("assessment")
    .select(ASSESSMENT_SELECT)
    .eq("business_id", business.id)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (draftError) {
    console.error("[assessment/submit] baca assessment:", draftError.message);
    return fail("Jawaban belum bisa dibaca.", 500);
  }
  if (!draft) return fail("Belum ada jawaban yang tersimpan.", 404);

  // Server memeriksa ulang karena browser bisa dilewati.
  const missing = findMissing(business, draft);
  if (missing.length > 0) {
    return fail("Masih ada pertanyaan yang belum dijawab.", 400, { missing });
  }

  // .eq("status", "draft") memastikan hanya draf yang berubah, bukan baris yang sudah terkirim.
  const { data, error } = await supabase
    .from("assessment")
    .update({ status: "submitted", updated_at: new Date().toISOString() })
    .eq("id", draft.id)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  // Kalau policy menolak, update tidak error tetapi mengubah 0 baris. Itu dicek lewat data kosong.
  if (error || !data) {
    console.error(
      "[assessment/submit] ubah status:",
      error?.message ?? "0 baris berubah (cek policy UPDATE)"
    );
    return fail("Jawaban belum bisa dikirim.", 500);
  }

  return Response.json({ ok: true, assessment_id: data.id });
}