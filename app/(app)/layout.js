import DashboardLayout from "@/components/layout/DashboardLayout";
import { createClient } from "@/lib/supabase/server";

// Mengambil nama depan pengguna yang login di server, lalu dikirim ke layout.
async function getFirstName() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "";

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (error) console.error("[layout] baca profil:", error.message);

  return (profile?.full_name ?? "").trim().split(/\s+/)[0];
}

export default async function AppLayout({ children }) {
  const firstName = await getFirstName();
  return <DashboardLayout userName={firstName}>{children}</DashboardLayout>;
}