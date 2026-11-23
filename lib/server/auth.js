import "server-only";
import { createClient } from "@supabase/supabase-js";
import { ApiError } from "./http";

// Mengambil token dari header "Authorization: Bearer <token>".
// "Bearer" tidak peka huruf besar/kecil; token kosong ditolak.
export function getBearerToken(request) {
  const header = request.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// Satu pintu autentikasi untuk semua API route.
// Mengembalikan client Supabase atas nama pengguna (RLS aktif) dan user yang sudah diverifikasi.
export async function getAuthenticatedContext(request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new ApiError("Konfigurasi server belum lengkap.", 500);
  }

  const accessToken = getBearerToken(request);

  if (!accessToken) {
    throw new ApiError("Sesi login tidak ditemukan.", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  });

  // Identitas diverifikasi ke Supabase Auth, bukan dipercaya dari frontend.
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(accessToken);

  if (error || !user) {
    throw new ApiError("Sesi login tidak valid.", 401);
  }

  return { supabase, user };
}