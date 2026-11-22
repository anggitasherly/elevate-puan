import { createClient } from "@/lib/supabase/server";
import {
  ASSESSMENT_SELECT,
  BUSINESS_SELECT,
  parseDraft,
  toAnswers,
} from "@/lib/assessment-draft";

export const runtime = "nodejs";

function fail(message, status) {
  return Response.json({ error: message }, { status });
}

// Langkah yang dipakai GET dan POST: pastikan sudah login, lalu cari usaha milik pengguna.
async function getContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: fail("Silakan masuk terlebih dahulu.", 401) };

  // Diurutkan dari yang tertua supaya hasilnya pasti, walau (seharusnya) hanya ada satu usaha.
  const { data: business, error } = await supabase
    .from("businesses")
    .select(BUSINESS_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[assessment/draft] baca businesses:", error.message);
    return { error: fail("Data usaha belum bisa dibaca.", 500) };
  }
  if (!business) return { error: fail("Usaha tidak ditemukan.", 404) };

  return { supabase, business };
}

// Mencari baris assessment berstatus draft milik usaha ini (yang terbaru).
function findDraft(supabase, businessId) {
  return supabase
    .from("assessment")
    .select(ASSESSMENT_SELECT)
    .eq("business_id", businessId)
    .eq("status", "draft")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

// GET: memuat jawaban yang sudah tersimpan, supaya pengguna bisa melanjutkan.
export async function GET() {
  const ctx = await getContext();
  if (ctx.error) return ctx.error;

  const { data: draft, error } = await findDraft(ctx.supabase, ctx.business.id);
  if (error) {
    console.error("[assessment/draft] baca assessment:", error.message);
    return fail("Jawaban belum bisa dimuat.", 500);
  }

  return Response.json({
    ...toAnswers(ctx.business, draft),
    status: draft?.status ?? null,
  });
}

// POST: menyimpan jawaban (boleh sebagian) ke tabel businesses dan assessment.
export async function POST(request) {
  const ctx = await getContext();
  if (ctx.error) return ctx.error;
  const { supabase, business } = ctx;

  let body;
  try {
    body = await request.json();
  } catch {
    return fail("Permintaan tidak valid.", 400);
  }

  const parsed = parseDraft(body);
  if (parsed.error) return fail(parsed.error, 400);

  // 1) Isian profil usaha masuk ke tabel businesses.
  if (Object.keys(parsed.business).length > 0) {
    const { data, error } = await supabase
      .from("businesses")
      .update(parsed.business)
      .eq("id", business.id)
      .select("id")
      .maybeSingle();

    // Kalau policy menolak, update tidak error tetapi mengubah 0 baris. Itu dicek lewat data kosong.
    if (error || !data) {
      console.error(
        "[assessment/draft] simpan businesses:",
        error?.message ?? "0 baris berubah (cek policy UPDATE)"
      );
      return fail("Jawaban belum bisa disimpan.", 500);
    }
  }

  // 2) Isian lain masuk ke tabel assessment: perbarui draf yang ada, atau buat baru.
  if (Object.keys(parsed.assessment).length > 0) {
    const { data: draft, error: findError } = await findDraft(
      supabase,
      business.id
    );
    if (findError) {
      console.error("[assessment/draft] cari draf:", findError.message);
      return fail("Jawaban belum bisa disimpan.", 500);
    }

    let result = draft
      ? await supabase
          .from("assessment")
          .update({
            ...parsed.assessment,
            updated_at: new Date().toISOString(),
          })
          .eq("id", draft.id)
          .select("id")
          .maybeSingle()
      : await supabase
          .from("assessment")
          .insert({
            business_id: business.id,
            status: "draft",
            ...parsed.assessment,
          })
          .select("id")
          .maybeSingle();

    // Dua penyimpanan yang hampir bersamaan bisa sama-sama mencoba membuat draf.
    // Indeks unik menolak yang kedua (kode 23505), jadi kita cari draf itu lalu perbarui.
    if (!draft && result.error?.code === "23505") {
      const { data: existing } = await findDraft(supabase, business.id);
      if (existing) {
        result = await supabase
          .from("assessment")
          .update({
            ...parsed.assessment,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .select("id")
          .maybeSingle();
      }
    }

    if (result.error || !result.data) {
      console.error(
        "[assessment/draft] simpan assessment:",
        result.error?.message ?? "0 baris berubah (cek policy UPDATE)"
      );
      return fail("Jawaban belum bisa disimpan.", 500);
    }
  }

  return Response.json({ ok: true });
}