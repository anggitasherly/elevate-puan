import { createClient } from "@/lib/supabase/server";
import { authErrorMessage } from "@/lib/auth-errors";
import { termsVersion } from "@/lib/legal-content";

export const runtime = "nodejs";

function clean(value, max) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Permintaan tidak valid." }, { status: 400 });
  }

  const fullName = clean(body.fullName, 100);
  const businessName = clean(body.businessName, 100);
  const email = clean(body.email, 254);
  const phone = clean(body.phone, 20);
  const password = typeof body.password === "string" ? body.password : "";
  const agree = body.agree === true;

  if (!fullName) return fail("Nama lengkap wajib diisi.");
  if (!businessName) return fail("Nama usaha wajib diisi.");
  if (!/^\S+@\S+\.\S+$/.test(email)) return fail("Format email belum benar.");
  const digits = phone.replace(/\D/g, "");
  if (phone && (digits.length < 8 || digits.length > 13))
    return fail("Nomor HP belum benar.");
  if (password.length < 8) return fail("Password minimal 8 karakter.");
  if (password.length > 72) return fail("Password terlalu panjang.");
  if (!agree) return fail("Centang persetujuan untuk melanjutkan.");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        business_name: businessName,
        phone,
        terms_version: termsVersion,
      },
    },
  });

  if (error) {
    console.error("[signup]", error.code, error.message);
    return Response.json(
      { error: authErrorMessage(error) },
      { status: error.status === 429 ? 429 : 400 }
    );
  }

  if (!data.session) {
    return Response.json(
      {
        error:
          "Akun terbuat, tetapi masih menunggu konfirmasi email. Matikan Confirm email di Supabase untuk sementara.",
      },
      { status: 400 }
    );
  }

  return Response.json({ ok: true });
}

function fail(message) {
  return Response.json({ error: message }, { status: 400 });
}