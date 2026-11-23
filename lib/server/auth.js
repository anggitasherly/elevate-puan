
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ApiError } from "./http";

// Mengambil token dari header Authorization.
export function getBearerToken(request) {
  const header = request?.headers.get("authorization") ?? "";
  const match = header.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}

// Mendukung autentikasi Bearer Token dan cookie session.
// Supabase client tetap bekerja atas nama pengguna sehingga RLS aktif.
export async function getAuthenticatedContext(request) {
  const accessToken = getBearerToken(request);

  // Gunakan Bearer Token jika dikirim oleh frontend.
  if (accessToken) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new ApiError("Konfigurasi server belum lengkap.", 500);
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

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user) {
      throw new ApiError("Sesi login tidak valid.", 401);
    }

    return { supabase, user };
  }

  // Jika tidak ada Bearer Token, gunakan cookie session.
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new ApiError("Silakan login terlebih dahulu.", 401);
  }

  return { supabase, user };
}
