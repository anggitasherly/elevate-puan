import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth-errors";

export const runtime = "nodejs";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().slice(0, 254) : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!/^\S+@\S+\.\S+$/.test(email) || !password) {
    return Response.json(
      { error: "Email atau password salah." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return Response.json(
      { error: authErrorMessage(error) },
      { status: error.status === 429 ? 429 : 400 }
    );
  }

  return Response.json({ ok: true });
}