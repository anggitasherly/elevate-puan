
import { createClient } from "@supabase/supabase-js";

// Membuat Supabase client sementara untuk setiap request.
// Access token dikirim dari browser melalui Authorization Header.
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

export async function GET(request) {
  try {
    // 1. Pastikan konfigurasi Supabase tersedia.
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

    // 3. Buat client dan verifikasi identitas user ke Supabase Auth.
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

    // 4. Ambil data personal dari profiles.
    // ID user selalu berasal dari hasil verifikasi Auth,
    // bukan dari request frontend.
    const { data: profileRow, error: profileError } = await supabase
      .from("profiles")
      .select("id, full_name, business_name, email, phone, avatar_path")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Profile query error:", profileError);
      return Response.json(
        { success: false, message: "Gagal mengambil data profil." },
        { status: 500 }
      );
    }

    // Membuat signed URL untuk foto profil dari private bucket.
    let avatarUrl = null;

    if (profileRow?.avatar_path) {
      const { data: avatarData, error: avatarError } = await supabase
        .storage
        .from("profile-avatars")
        .createSignedUrl(profileRow.avatar_path, 60 * 60);

      if (avatarError) {
        console.error("Avatar signed URL error:", avatarError);
      } else {
        avatarUrl = avatarData?.signedUrl ?? null;
      }
    }

    // 5. Ambil data usaha milik user yang sedang login.
    const { data: business, error: businessError } = await supabase
      .from("businesses")
      .select(
        "id, name, category, business_age, business_type, city, business_description, created_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (businessError) {
      console.error("Business query error:", businessError);
      return Response.json(
        { success: false, message: "Gagal mengambil data usaha." },
        { status: 500 }
      );
    }

    // 6. Siapkan data tambahan.
    // Data ini hanya diambil jika user sudah memiliki business.
    let assessment = null;
    let financialReadiness = null;
    let constraints = null;

    if (business?.id) {
      const [assessmentResult, financialResult, constraintsResult] =
        await Promise.all([
          supabase
            .from("assessment")
            .select(
              "story_text, biggest_challenge, biggest_challenge_other, main_goal, main_goal_other, sales_sources, sales_sources_other, status, created_at, ai_diagnosis"
            )
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("financial_readiness")
            .select(
              "monthly_revenue, monthly_operating_cost, household_need, product_margin_pct, willingness_to_lose, cash_reserve, risk_allowance_pct, business_profit, free_surplus, affordable_loss, recommended_budget, status, growth_level, ai_narrative, created_at"
            )
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),

          supabase
            .from("constraints")
            .select("hours_per_week, digital_skill, team_size, created_at")
            .eq("business_id", business.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

      // Periksa error dari ketiga query tambahan.
      const relatedError =
        assessmentResult.error ||
        financialResult.error ||
        constraintsResult.error;

      if (relatedError) {
        console.error("Related profile data query error:", relatedError);
        return Response.json(
          { success: false, message: "Gagal mengambil data pendukung profil." },
          { status: 500 }
        );
      }

      assessment = assessmentResult.data;
      financialReadiness = financialResult.data;
      constraints = constraintsResult.data;
    }

    // 7. Kirim seluruh data Profile ke frontend.
    return Response.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          full_name: profileRow?.full_name ?? null,
          business_name: profileRow?.business_name ?? null,
          email: profileRow?.email ?? user.email ?? null,
          phone: profileRow?.phone ?? null,
          avatar_path: profileRow?.avatar_path ?? null,
          avatar_url: avatarUrl,
        },
        business,
        assessment,
        financialReadiness,
        constraints,
      },
    });
  } catch (error) {
    console.error("GET /api/profile error:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan pada server." },
      { status: 500 }
    );
  }
}