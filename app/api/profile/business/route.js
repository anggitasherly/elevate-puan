
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      return Response.json(
        {
          success: false,
          message: "Konfigurasi Supabase belum tersedia.",
        },
        { status: 500 }
      );
    }

    // 1. Ambil access token dari request.
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return Response.json(
        { success: false, message: "Sesi login tidak ditemukan." },
        { status: 401 }
      );
    }

    const supabase = createRequestSupabase(accessToken);

    // 2. Pastikan token benar-benar milik user yang valid.
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

    // 3. Baca dan validasi request body.
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return Response.json(
        { success: false, message: "Format data tidak valid." },
        { status: 400 }
      );
    }

    const allowedFields = [
      "name",
      "category",
      "business_age",
      "business_type",
      "city",
      "description",
    ];

    const unknownFields = Object.keys(body).filter(
      (field) => !allowedFields.includes(field)
    );

    if (unknownFields.length > 0) {
      return Response.json(
        { success: false, message: "Terdapat field yang tidak diizinkan." },
        { status: 400 }
      );
    }

    const updates = {};

    for (const field of allowedFields) {
      if (!Object.prototype.hasOwnProperty.call(body, field)) {
        continue;
      }

      const value = body[field];

      if (value !== null && typeof value !== "string") {
        return Response.json(
          {
            success: false,
            message: `Format ${field} tidak valid.`,
          },
          { status: 400 }
        );
      }

      const normalizedValue =
        typeof value === "string" ? value.trim() || null : null;

      // Nama usaha tidak boleh kosong jika sedang diperbarui.
      if (field === "name" && !normalizedValue) {
        return Response.json(
          { success: false, message: "Nama usaha wajib diisi." },
          { status: 400 }
        );
      }

      // Description mengikuti batas textarea di Profile UI.
      if (field === "description" && normalizedValue?.length > 500) {
        return Response.json(
          {
            success: false,
            message: "Deskripsi usaha maksimal 500 karakter.",
          },
          { status: 400 }
        );
      }

      // Sesuaikan nama field frontend dengan kolom database.
      const databaseField =
        field === "description" ? "business_description" : field;

      updates[databaseField] = normalizedValue;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        {
          success: false,
          message: "Tidak ada data usaha yang diperbarui.",
        },
        { status: 400 }
      );
    }

    // 4. Cari usaha terbaru milik user yang sedang login.
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (businessError) {
      console.error("Business lookup error:", businessError);

      return Response.json(
        { success: false, message: "Gagal mengambil data usaha." },
        { status: 500 }
      );
    }

    if (!business) {
      return Response.json(
        { success: false, message: "Data usaha tidak ditemukan." },
        { status: 404 }
      );
    }

    // 5. Update hanya usaha tersebut, bukan seluruh usaha user.
    const { data: updatedBusiness, error: updateError } = await supabase
      .from("businesses")
      .update(updates)
      .eq("id", business.id)
      .eq("user_id", user.id)
      .select(
        "id, name, category, business_age, business_type, city, business_description"
      )
      .maybeSingle();

    if (updateError) {
      console.error("Business update error:", updateError);

      return Response.json(
        {
          success: false,
          message:
            updateError.code === "42501"
              ? "Kamu tidak memiliki izin untuk memperbarui data usaha."
              : "Gagal memperbarui data usaha.",
        },
        { status: updateError.code === "42501" ? 403 : 500 }
      );
    }

    if (!updatedBusiness) {
      return Response.json(
        { success: false, message: "Data usaha tidak dapat diperbarui." },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      message: "Informasi usaha berhasil diperbarui.",
      data: {
        business: updatedBusiness,
      },
    });
  } catch (error) {
    console.error("PATCH /api/profile/business error:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}
