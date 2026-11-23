import { createClient } from "@supabase/supabase-js";

// Memastikan data personal tidak disimpan oleh cache. -> route ini dijalankan setiap reqquest dan tidak di cache. penting karena datanya personal per user
export const dynamic = "force-dynamic";

// Membuat Supabase client untuk request pengguna yang sedang login.
function createRequestSupabase(accessToken) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      auth: { /*di server tidak perlu menyimpan sesi, me-refresh token, atau membaca sesi dari URL.*/
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
      global: { /*semua query dikirim atas nama user tersebut, sehingga RLS (Row Level Security) di database aktif dan memakai identitas user itu.*/
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    }
  );
}

// Menyamakan status database agar mudah digunakan oleh UI.
function normalizeStatus(status) {
  const value = String(status ?? "").trim().toLowerCase(); //Mengubah status jadi string, menghapus spasi, dan menjadikannya huruf kecil. Kalau null/undefined jadi string kosong.

  const statusMap = { //jadi beberapa variasi kata yang digunakan itu outputnya ttp sama ongoing gt looo 
    active: "ongoing",
    ongoing: "ongoing",
    in_progress: "ongoing",
    "in-progress": "ongoing",

    completed: "completed",
    complete: "completed",
    finished: "completed",

    stopped: "stopped",
    cancelled: "stopped",
    canceled: "stopped",

    draft: "draft",
  };

  return statusMap[value] ?? (value || "unknown"); //Kalau ada di map, pakai hasil map. Kalau tidak, pakai nilai aslinya. Kalau kosong, jadi "unknown".
}

// Membuat response JSON tanpa menyimpan data ke cache.
function jsonResponse(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

// Response ketika pengguna belum memiliki eksperimen.
function emptyHistoryResponse() {
  return jsonResponse({
    success: true,
    data: {
      summary: {
        total: 0,
        completed: 0,
        ongoing: 0,
        stopped: 0,
      },
      experiments: [],
    },
  });
}

export async function GET(request) { //fungsi utama GET 
  try {
    // 1. Periksa konfigurasi Supabase.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabasePublishableKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabasePublishableKey) {
      return jsonResponse(
        {
          success: false,
          message: "Konfigurasi Supabase belum tersedia.",
        },
        500
      );
    }

    // 2. Ambil access token dari Authorization Header.
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.+)$/i)?.[1];

    if (!accessToken) {
      return jsonResponse(
        {
          success: false,
          message: "Sesi login tidak ditemukan.",
        },
        401
      );
    }

    // 3. Buat client dan verifikasi identitas pengguna.
    const supabase = createRequestSupabase(accessToken);

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(accessToken);

    if (authError || !user) {
      return jsonResponse(
        {
          success: false,
          message: "Sesi login tidak valid.",
        },
        401
      );
    }

    // 4. Ambil seluruh usaha milik pengguna yang sedang login.
    // user.id berasal dari Supabase Auth, bukan dari frontend.
    const { data: businesses, error: businessError } = await supabase
      .from("businesses")
      .select("id, name, category")
      .eq("user_id", user.id);

    if (businessError) {
      console.error("History business query error:", businessError);

      return jsonResponse(
        {
          success: false,
          message: "Gagal mengambil data usaha.",
        },
        500
      );
    }

    const businessIds = (businesses ?? []).map((business) => business.id);

    // Jika pengguna belum memiliki usaha, tidak ada eksperimen yang perlu diambil.
    if (businessIds.length === 0) {
      return emptyHistoryResponse();
    }

    // 5. Ambil eksperimen yang terhubung dengan usaha milik pengguna.
    // RLS pada tabel experiments tetap melakukan pemeriksaan kepemilikan.
    
    const { data: experimentRows, error: experimentError } = await supabase
      .from("experiments")
      .select(`
        id,
        business_id,
        proposal_id,
        previous_experiment_id,
        title,
        metric_name,
        baseline_value,
        target_value,
        budget_planned,
        growth_level,
        start_date,
        end_date,
        status,
        created_at,
        description,
        hypothesis,
        solution_proposals (
          title,
          problem_addressed,
          description,
          rationale
        )
      `)
      .in("business_id", businessIds)
      .order("created_at", { ascending: false });

    if (experimentError) {
      console.error("History experiment query error:", experimentError);

      return jsonResponse(
        {
          success: false,
          message: "Gagal mengambil riwayat eksperimen.",
        },
        500
      );
    }

    // Draft tidak ditampilkan dalam History.
    const visibleExperiments = (experimentRows ?? []).filter(
      (experiment) => normalizeStatus(experiment.status) !== "draft"
    );

    if (visibleExperiments.length === 0) {
      return emptyHistoryResponse();
    }

    const experimentIds = visibleExperiments.map(
      (experiment) => experiment.id
    );

    // 6. Ambil jumlah check-in dan hasil evaluasi setiap eksperimen.
    const [checkinsResult, resultsResult] = await Promise.all([
      supabase
        .from("experiment_checkins")
        .select("id, experiment_id")
        .in("experiment_id", experimentIds),

      supabase
        .from("experiment_results")
        .select(`
          id,
          experiment_id,
          actual_value,
          target_met,
          checkin_completeness,
          cost_spent,
          additional_revenue,
          gross_profit,
          net_profit,
          roi,
          break_even_orders,
          learnings,
          user_rating,
          created_at
        `)
        .in("experiment_id", experimentIds)
        .order("created_at", { ascending: false }),
    ]);

    if (checkinsResult.error) {
      console.error(
        "History checkins query error:",
        checkinsResult.error
      );

      return jsonResponse(
        {
          success: false,
          message: "Gagal mengambil aktivitas eksperimen.",
        },
        500
      );
    }

    if (resultsResult.error) {
      console.error(
        "History results query error:",
        resultsResult.error
      );

      return jsonResponse(
        {
          success: false,
          message: "Gagal mengambil hasil evaluasi eksperimen.",
        },
        500
      );
    }

    // 7. Siapkan lookup data usaha berdasarkan business_id.
    const businessById = new Map(
      (businesses ?? []).map((business) => [business.id, business])
    );

    // Hitung jumlah check-in untuk setiap eksperimen.
    const checkinCountByExperiment = new Map();

    for (const checkin of checkinsResult.data ?? []) {
      const currentCount =
        checkinCountByExperiment.get(checkin.experiment_id) ?? 0;

      checkinCountByExperiment.set(
        checkin.experiment_id,
        currentCount + 1
      );
    }

    // Ambil hasil evaluasi terbaru untuk setiap eksperimen.
    const latestResultByExperiment = new Map();

    for (const result of resultsResult.data ?? []) {
      if (!latestResultByExperiment.has(result.experiment_id)) {
        latestResultByExperiment.set(result.experiment_id, result);
      }
    }

    // 8. Gabungkan data eksperimen, usaha, check-in, dan hasil evaluasi.
    const experiments = visibleExperiments.map((experiment) => {
      const business = businessById.get(experiment.business_id);
      const result =
        latestResultByExperiment.get(experiment.id) ?? null;

      const proposal = Array.isArray(experiment.solution_proposals)
        ? experiment.solution_proposals[0] ?? null
        : experiment.solution_proposals ?? null;

      const status = normalizeStatus(experiment.status);

      let evaluationStatus = null;

      if (result?.target_met === true) {
        evaluationStatus = "successful";
      } else if (result?.target_met === false) {
        evaluationStatus = "underperformed";
      }

      return {
        id: experiment.id,
        name: experiment.title,
        title: experiment.title,

        business_id: experiment.business_id,
        business_name: business?.name ?? null,
        business_category: business?.category ?? null,

        proposal_id: experiment.proposal_id,
        previous_experiment_id: experiment.previous_experiment_id,

        category:
          proposal?.problem_addressed?.trim() ||
          "Belum dikategorikan",

        status,
        raw_status: experiment.status,

        objective: experiment.description,
        description: experiment.description,
        hypothesis: experiment.hypothesis,

        metric_name: experiment.metric_name,
        baseline_value: experiment.baseline_value,
        target_value: experiment.target_value,
        budget_planned: experiment.budget_planned,
        growth_level: experiment.growth_level,

        start_date: experiment.start_date,
        end_date: experiment.end_date,
        created_at: experiment.created_at,

        checkin_count:
          checkinCountByExperiment.get(experiment.id) ?? 0,

        final_review_id: result?.id ?? null,
        evaluation_status: evaluationStatus,

        result: result
          ? {
              id: result.id,
              actual_value: result.actual_value,
              target_met: result.target_met,
              checkin_completeness: result.checkin_completeness,
              cost_spent: result.cost_spent,
              additional_revenue: result.additional_revenue,
              gross_profit: result.gross_profit,
              net_profit: result.net_profit,
              roi: result.roi,
              break_even_orders: result.break_even_orders,
              learnings: result.learnings,
              user_rating: result.user_rating,
              created_at: result.created_at,
            }
          : null,
      };
    });

    // 9. Hitung ringkasan berdasarkan eksperimen yang ditampilkan.
    const summary = {
      total: experiments.length,
      completed: experiments.filter(
        (experiment) => experiment.status === "completed"
      ).length,
      ongoing: experiments.filter(
        (experiment) => experiment.status === "ongoing"
      ).length,
      stopped: experiments.filter(
        (experiment) => experiment.status === "stopped"
      ).length,
    };

    // 10. Kirim data History ke frontend.
    return jsonResponse({
      success: true,
      data: {
        summary,
        experiments,
      },
    });
  } catch (error) {
    console.error("GET /api/experiments/history error:", error);

    return jsonResponse(
      {
        success: false,
        message: "Terjadi kesalahan pada server.",
      },
      500
    );
  }
}