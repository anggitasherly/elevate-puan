import { redirect } from "next/navigation";

// Halaman daftar eksperimen belum ada. Alamat ini dialihkan ke eksperimen aktif
// (halaman Daily). Kalau belum ada eksperimen aktif, halaman Daily menampilkan
// ajakan untuk memilih strategi.
export default function ExperimentsPage() {
  redirect("/experiments/daily");
}