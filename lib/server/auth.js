import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "./http";

// Satu pintu autentikasi untuk semua API route Growth Insights.
// Login dibaca dari cookie sesi (sama seperti route eksperimen),
// bukan dari token yang dikirim browser.
// Mengembalikan client Supabase atas nama pengguna (RLS aktif)
// dan user yang sudah diverifikasi.
export async function getAuthenticatedContext() {
  const supabase = await createSupabaseServerClient();

  // Identitas diverifikasi ke Supabase Auth, bukan dipercaya dari frontend.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("Silakan login terlebih dahulu.", 401);
  }

  return { supabase, user };
}
