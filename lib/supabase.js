import { createClient } from "@supabase/supabase-js";

// "Kabel" dari website ke database Supabase.
// Nilainya dibaca dari .env.local.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);