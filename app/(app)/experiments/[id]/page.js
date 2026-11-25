import { redirect } from "next/navigation";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Tautan dari Experiment History: /experiments/<id>.
// Halaman Daily memuat eksperimen itu. Kalau eksperimen sudah selesai,
// halaman Daily otomatis mengalihkan ke halaman Hasil.
export default async function ExperimentDetailPage({ params }) {
  const { id } = await params;

  if (typeof id !== "string" || !UUID_PATTERN.test(id)) {
    redirect("/history");
  }

  redirect(`/experiments/daily?experimentId=${encodeURIComponent(id)}`);
}