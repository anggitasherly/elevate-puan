
import { createSupabaseServerClient } from "@/lib/supabase/server";
import BusinessOverviewClient from "./BusinessOverviewClient";

export default async function BusinessOverviewPage() {
  const supabase = await createSupabaseServerClient();

  // 1. Periksa pengguna yang sedang login.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return <BusinessOverviewClient rawDiagnosis={null} />;
  }

  // 2. Ambil bisnis milik pengguna.
  const { data: business, error: businessError } =
    await supabase
      .from("businesses")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (businessError || !business) {
    if (businessError) {
      console.error(
        "Business Overview: gagal mengambil bisnis",
        businessError.message
      );
    }

    return <BusinessOverviewClient rawDiagnosis={null} />;
  }

  // 3. Ambil hasil diagnosis terbaru yang sudah tersedia.
  const { data: assessment, error: assessmentError } =
    await supabase
      .from("assessment")
      .select("id, ai_diagnosis")
      .eq("business_id", business.id)
      .in("status", ["submitted", "completed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

  if (assessmentError) {
    console.error(
      "Business Overview: gagal mengambil diagnosis",
      assessmentError.message
    );
  }

  // 4. Kirim diagnosis ke komponen tampilan.
  return (
    <BusinessOverviewClient
      rawDiagnosis={assessment?.ai_diagnosis ?? null}
      assessmentId={assessment?.id ?? null}
    />
  );
}
