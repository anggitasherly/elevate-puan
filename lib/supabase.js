
import { createClient } from "@supabase/supabase-js";

// Client Supabase untuk Elevate Puan.
// URL dan publishable key dibaca dari environment variables.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Shared Supabase client untuk frontend.
export const supabase = createClient(
  supabaseUrl,
  supabaseKey
);
