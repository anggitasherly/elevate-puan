import { createClient } from "@supabase/supabase-js";

// Shared Supabase client untuk frontend.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
);