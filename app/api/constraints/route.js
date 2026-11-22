import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    const { data: businesses, error: businessError } = await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .limit(2);

    if (businessError) {
      return Response.json(
        { success: false, message: "Gagal mengambil data usaha." },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length !== 1) {
      return Response.json(
        {
          success: false,
          message: "Data usaha belum tersedia atau tidak unik.",
        },
        { status: 409 }
      );
    }

    const businessId = businesses[0].id;

    const { data: constraints, error: constraintsError } = await supabase
      .from("constraints")
      .select(
        "id, business_id, hours_per_week, digital_skill, team_size, details"
      )
      .eq("business_id", businessId)
      .limit(2);

    if (constraintsError) {
      console.error("GET Constraints:", constraintsError);

      return Response.json(
        { success: false, message: "Gagal mengambil data Constraints." },
        { status: 500 }
      );
    }

    if (constraints.length > 1) {
      return Response.json(
        {
          success: false,
          message: "Ditemukan lebih dari satu data Constraints untuk usaha ini.",
        },
        { status: 409 }
      );
    }

    return Response.json({
      success: true,
      available: constraints.length === 1,
      constraints: constraints[0] ?? null,
    });
  } catch (error) {
    console.error("Constraints API:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json(
        { success: false, message: "Silakan login terlebih dahulu." },
        { status: 401 }
      );
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return Response.json(
        { success: false, message: "Format JSON tidak valid." },
        { status: 400 }
      );
    }

    const timeMap = {
      "<5 jam": "under_5_hours",
      "5–10 jam": "5_to_10_hours",
      ">10 jam": "over_10_hours",
    };

    const teamMap = {
      "Saya Sendiri (Solo)": "solo",
      "Tim Kecil": "small_team",
      "Tim Besar": "large_team",
    };

    const skillMap = {
      Pemula: "rendah",
      "Cukup Memahami": "sedang",
      Mahir: "tinggi",
    };

    const availableTime = timeMap[body?.availableTime];
    const teamSupport = teamMap[body?.teamSupport];
    const digitalSkill = skillMap[body?.digitalSkill];

    if (!availableTime || !teamSupport || !digitalSkill) {
      return Response.json(
        {
          success: false,
          message: "Lengkapi ketiga pertanyaan dengan pilihan yang valid.",
        },
        { status: 400 }
      );
    }

    const { data: businesses, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(2);

    if (businessError) {
      return Response.json(
        { success: false, message: "Gagal mengambil data usaha." },
        { status: 500 }
      );
    }

    if (!businesses || businesses.length !== 1) {
      return Response.json(
        {
          success: false,
          message: "Data usaha belum tersedia atau tidak unik.",
        },
        { status: 409 }
      );
    }

    const businessId = businesses[0].id;

    const { data: existing, error: readError } =
      await supabase
        .from("constraints")
        .select("id, details")
        .eq("business_id", businessId)
        .limit(2);

    if (readError) {
      return Response.json(
        { success: false, message: "Gagal memeriksa data Constraints." },
        { status: 500 }
      );
    }

    if (existing.length > 1) {
      return Response.json(
        {
          success: false,
          message: "Terdapat data Constraints ganda. Hubungi pengelola.",
        },
        { status: 409 }
      );
    }

    const previousDetails =
      existing[0]?.details &&
      typeof existing[0].details === "object" &&
      !Array.isArray(existing[0].details)
        ? existing[0].details
        : {};

    const details = {
      ...previousDetails,
      realistic_condition: {
        ...(previousDetails.realistic_condition &&
        typeof previousDetails.realistic_condition === "object" &&
        !Array.isArray(previousDetails.realistic_condition)
          ? previousDetails.realistic_condition
          : {}),
        available_time: availableTime,
        team_support: teamSupport,
        digital_skill: digitalSkill,
      },
    };

    const hoursMap = {
      "<5 jam": 4,
      "5–10 jam": 8,
      ">10 jam": 12,
    };

    const teamSizeMap = {
      "Saya Sendiri (Solo)": 1,
      "Tim Kecil": 2,
      "Tim Besar": 5,
    };

    const payload = {
      hours_per_week: hoursMap[body.availableTime],
      digital_skill: digitalSkill,
      team_size: teamSizeMap[body.teamSupport],
      details,
    };

    const query = existing.length === 1
      ? supabase
          .from("constraints")
          .update(payload)
          .eq("id", existing[0].id)
          .eq("business_id", businessId)
      : supabase
          .from("constraints")
          .insert({
            business_id: businessId,
            ...payload,
          });

    const { data: saved, error: saveError } = await query
      .select("id, business_id, digital_skill, details")
      .single();

    if (saveError) {
      console.error("POST Constraints:", saveError);

      return Response.json(
        { success: false, message: "Gagal menyimpan Constraints." },
        { status: 500 }
      );
    }

    return Response.json({
      success: true,
      persisted: true,
      constraints: saved,
    });
  } catch (error) {
    console.error("POST Constraints API:", error);

    return Response.json(
      { success: false, message: "Terjadi kesalahan server." },
      { status: 500 }
    );
  }
}

