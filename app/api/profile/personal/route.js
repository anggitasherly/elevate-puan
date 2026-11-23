
import { createClient } from "@supabase/supabase-js";

// Temporary Supabase client.
// Nantinya bagian ini bisa diganti dengan shared server client.
function createRequestSupabase(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

export async function PATCH(request) {
  try {
    // 1. Pastikan konfigurasi tersedia.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      return Response.json(
        { success: false, message: "Konfigurasi Supabase belum tersedia." },
        { status: 500 }
      );
    }

    // 2. Ambil access token dari Authorization Header.
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return Response.json(
        { success: false, message: "Sesi login tidak ditemukan." },
        { status: 401 }
      );
    }

    // 3. Verifikasi identitas user.
    const supabase = createRequestSupabase(accessToken);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return Response.json(
        { success: false, message: "Sesi login tidak valid." },
        { status: 401 }
      );
    }

    // 4. Baca data yang dikirim frontend.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { success: false, message: "Format data tidak valid." },
        { status: 400 }
      );
    }

    // 5. Siapkan field yang boleh diperbarui.
    const updates = {};

    if (Object.prototype.hasOwnProperty.call(body, "full_name")) {
      if (
        typeof body.full_name !== "string" ||
        !body.full_name.trim() ||
        body.full_name.trim().length > 100
      ) {
        return Response.json(
          { success: false, message: "Nama lengkap wajib diisi (maksimal 100 karakter)." },
          { status: 400 }
        );
      }

      updates.full_name = body.full_name.trim();
    }

    if (Object.prototype.hasOwnProperty.call(body, "phone")) {
      if (
        body.phone !== null &&
        (typeof body.phone !== "string" || body.phone.trim().length > 30)
      ) {
        return Response.json(
          { success: false, message: "Format nomor HP tidak valid." },
          { status: 400 }
        );
      }

      // Nomor HP kosong disimpan sebagai null.
      updates.phone =
        typeof body.phone === "string" && body.phone.trim()
          ? body.phone.trim()
          : null;
    }

    // Validasi lokasi file avatar milik user yang sedang login.
    if (Object.prototype.hasOwnProperty.call(body, "avatar_path")) {
      const avatarPath = body.avatar_path;

      if (
        typeof avatarPath !== "string" ||
        !avatarPath.startsWith(`${user.id}/`) ||
        avatarPath.includes("..") ||
        avatarPath.length > 500
      ) {
        return Response.json(
          { success: false, message: "Lokasi foto profil tidak valid." },
          { status: 400 }
        );
      }

      updates.avatar_path = avatarPath;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { success: false, message: "Tidak ada data profil yang diperbarui." },
        { status: 400 }
      );
    }

    // 6. Update hanya baris milik user yang sudah terverifikasi.
    const { data: updatedProfile, error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id)
      .select("id, full_name, email, phone, avatar_path")
      .maybeSingle();

    if (updateError) {
      console.error("Personal profile update error:", updateError);

      return Response.json(
        {
          success: false,
          message:
            updateError.code === "42501"
              ? "Kamu tidak memiliki izin untuk memperbarui profil."
              : "Gagal memperbarui data profil.",
        },
        { status: updateError.code === "42501" ? 403 : 500 }
      );
    }

    if (!updatedProfile) {
      return Response.json(
        {
          success: false,
          message: "Profil tidak ditemukan atau tidak dapat diperbarui.",
        },
        { status: 404 }
      );
    }

    // 7. Kirim data profil terbaru.
    return Response.json({
      success: true,
      message: "Informasi personal berhasil diperbarui.",
      data: {
        profile: updatedProfile,
      },
    });
  } catch (error) {
    console.error("PATCH /api/profile/personal error:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}