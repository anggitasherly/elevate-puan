import { createBrowserClient } from "@supabase/ssr";

// Shared Supabase client untuk frontend.
// Memakai createBrowserClient (bukan createClient biasa) supaya sesi dibaca
// dari cookie yang sama dengan yang ditulis server saat login lewat /login.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);