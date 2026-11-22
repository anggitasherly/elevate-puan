import Link from "next/link";
import { ClipboardList } from "lucide-react";

// Nama bidang Assessment yang ramah dibaca. Kode yang tidak dikenal dilewati.
const FIELD_LABELS = {
  viewer_behavior: "Apa yang biasanya dilakukan calon pembeli setelah melihat produkmu",
  repeat_frequency: "Seberapa sering pelanggan membeli lagi",
  order_surge: "Apa yang terjadi saat pesanan meningkat",
  main_customers: "Siapa pelanggan utamamu",
  sales_sources: "Dari mana penjualanmu berasal",
  financial_recording_habit: "Kebiasaan mencatat keuangan usaha",
  money_separation: "Pemisahan uang usaha dan uang pribadi",
  biggest_challenge: "Tantangan terbesar usahamu saat ini",
};

// Ditampilkan saat diagnosis belum bisa ditentukan: menjelaskan informasi yang
// belum tersedia dan dugaan awal, tanpa menyebutnya sebagai hasil pasti.
export default function UndeterminedPanel({ missingInformation, otherProblems }) {
  const missing = (Array.isArray(missingInformation) ? missingInformation : [])
    .map((code) => FIELD_LABELS[code])
    .filter(Boolean);
  const guesses = (Array.isArray(otherProblems) ? otherProblems : []).filter(
    (item) => item && typeof item.title === "string"
  );

  return (
    <article className="rounded-3xl border border-pink-line bg-white p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-2xl bg-brand-soft p-3 text-brand">
          <ClipboardList size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-ink-title">
            Yang Belum Cukup Jelas
          </h3>

          <p className="mt-3 leading-7 text-ink-muted">
            Kamu tetap bisa melanjutkan ke langkah berikutnya. Hasilnya akan
            kami anggap belum pasti, dan saran yang muncul nanti akan lebih
            berhati-hati.
          </p>

          {guesses.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink-title">
                Hal yang mulai terlihat, tetapi buktinya belum cukup
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-muted">
                {guesses.map((item) => (
                  <li key={item.code ?? item.title}>{item.title}</li>
                ))}
              </ul>
            </div>
          )}

          {missing.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-semibold text-ink-title">
                Informasi yang masih kurang
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-ink-muted">
                {missing.map((label) => (
                  <li key={label}>{label}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/assessment"
            className="mt-5 inline-flex text-sm font-semibold text-brand underline"
          >
            Lengkapi Assessment
          </Link>
        </div>
      </div>
    </article>
  );
}
