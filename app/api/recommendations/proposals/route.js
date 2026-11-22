import { createSupabaseServerClient } from "@/lib/supabase/server";

const invalid = (message, status = 400) =>
  Response.json({ success: false, message }, { status });

function validatePlan(plan) {
  if (
    !plan ||
    !Array.isArray(plan.days) ||
    plan.days.length !== 7
  ) {
    return false;
  }

  const checklistIds = new Set();

  return plan.days.every((day, index) => {
    if (
      day.day !== index + 1 ||
      !Array.isArray(day.checklists) ||
      day.checklists.length < 1 ||
      day.checklists.length > 3
    ) {
      return false;
    }

    return day.checklists.every((item) => {
      if (
        !item ||
        typeof item.id !== "string" ||
        !item.id.trim() ||
        typeof item.activity !== "string" ||
        !item.activity.trim() ||
        checklistIds.has(item.id)
      ) {
        return false;
      }

      checklistIds.add(item.id);
      return true;
    });
  });
}

export async function POST(request) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return invalid("Silakan login terlebih dahulu.", 401);
    }

    const body = await request.json();
    const proposals = body?.proposals;

    if (!Array.isArray(proposals) || proposals.length !== 3) {
      return invalid("Harus ada tepat tiga rekomendasi.");
    }

    for (const proposal of proposals) {
      if (
        !proposal ||
        typeof proposal.title !== "string" ||
        !proposal.title.trim() ||
        typeof proposal.description !== "string" ||
        !proposal.description.trim() ||
        !validatePlan(proposal.recommended_daily_plan)
      ) {
        return invalid(
          "Data rekomendasi atau rencana eksperimen 7 hari tidak valid."
        );
      }
    }

    const { data: businesses, error: businessError } =
      await supabase
        .from("businesses")
        .select("id")
        .eq("user_id", user.id)
        .limit(2);

    if (businessError) {
      return invalid("Gagal mengambil data usaha.", 500);
    }

    if (!businesses || businesses.length !== 1) {
      return invalid("Data usaha belum tersedia atau tidak unik.", 409);
    }

    const businessId = businesses[0].id;

    const rows = proposals.map((proposal, index) => ({
      business_id: businessId,
      title: proposal.title.trim(),
      description: proposal.description.trim(),
      rationale:
        typeof proposal.rationale === "string"
          ? proposal.rationale.trim()
          : null,
      recommended_daily_plan: proposal.recommended_daily_plan,
      source_type: "opportunity_library",
      role: index === 0 ? "primary" : "alternative",
      est_days: 7,
      status: "proposed",
    }));

    const { data, error } = await supabase
      .from("solution_proposals")
      .insert(rows)
      .select("id, title, source_type, recommended_daily_plan");

    if (error) {
      console.error("Save recommendation proposals:", error);
      return invalid("Gagal menyimpan rekomendasi.", 500);
    }

    return Response.json(
      {
        success: true,
        proposals: data.map((proposal) => ({
          ...proposal,
          proposal_id: proposal.id,
        })),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Recommendation proposals API:", error);

    return invalid("Terjadi kesalahan server.", 500);
  }
}
