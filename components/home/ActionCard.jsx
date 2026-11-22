import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const flowSteps = ["Assessment", "Diagnosis", "Finansial", "Rekomendasi", "Eksperimen"];

const ASSESSMENT_HINT =
  "Kondisi usahamu berubah sejak assessment terakhir? Isi assessment baru supaya strategi eksperimen berikutnya sesuai kondisi terkini. Jawaban sebelumnya tetap tersimpan.";

// state: "none" (belum ada jawaban), "draft" (ada draf), "submitted" (sudah dikirim),
// "completed" (eksperimen sudah selesai).
// currentStep: indeks langkah aktif di indikator (0 = Assessment, 1 = Diagnosis).
// Kalau sama dengan jumlah langkah, semua langkah dianggap selesai.
// stepHint: penjelasan singkat langkah aktif, tampil di bawah indikator.
const CONTENT = {
  none: {
    title: "Mulai dari assessment",
    text: "Jawab beberapa pertanyaan tentang usahamu. Dari sini Elevate Puan menyusun diagnosis dan langkah kecil yang realistis.",
    cta: "Mulai Assessment",
    href: "/assessment",
    currentStep: 0,
    stepHint: "Pertanyaan singkat untuk mengenali kondisi usahamu.",
  },
  draft: {
    title: "Lanjutkan assessment-mu",
    text: "Jawabanmu sudah tersimpan. Lanjutkan dari pertanyaan yang belum diisi.",
    cta: "Lanjutkan Assessment",
    href: "/assessment",
    currentStep: 0,
    stepHint: "Pertanyaan singkat untuk mengenali kondisi usahamu.",
  },
  submitted: {
    title: "Lihat diagnosis usahamu",
    text: "Assessment sudah terkirim. Lihat hasil diagnosisnya untuk tahu langkah selanjutnya.",
    cta: "Lihat Diagnosis",
    href: "/business-overview",
    currentStep: 1,
    stepHint: "Gambaran kondisi usahamu dari jawaban assessment.",
  },
  completed: {
    title: "Eksperimenmu sudah berakhir",
    text: "Hasilnya ada di kartu Hasil terakhir. Kalau kondisi usahamu berubah, perbarui gambaranmu lewat assessment baru.",
    cta: "Assessment Baru",
    href: "/assessment",
    currentStep: flowSteps.length,
    stepHint: "Pilih eksperimen berikutnya di Growth Insights.",
  },
};

// Bubble penjelasan saat kursor di atas (atau fokus keyboard pada) tombol.
function HoverHint({ id, children }) {
  return (
    <div className="group relative">
      {children}
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-10 mt-2 w-64 rounded-xl border border-pink-line bg-white p-3 text-left text-xs leading-relaxed text-ink-muted opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 sm:left-auto sm:right-0"
      >
        {ASSESSMENT_HINT}
      </span>
    </div>
  );
}

export default function ActionCard({ state = "none" }) {
  const content = CONTENT[state] ?? CONTENT.none;
  const { currentStep } = content;
  const allDone = currentStep >= flowSteps.length;

  return (
    <Card className="gap-0 rounded-3xl border border-pink-line bg-linear-to-br from-pink-pale to-white py-0 shadow-[0_24px_60px_-28px_rgba(216,31,138,0.25)] ring-0">
      <CardContent className="p-5 sm:px-8 sm:py-6.5">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-pink-ink">
              Langkah berikutnya
            </p>
            <h2 className="mt-1.5 text-xl font-extrabold leading-tight text-ink-title sm:text-[21px]">
              {content.title}
            </h2>
            <p className="mt-1.5 max-w-lg text-sm leading-relaxed text-ink-muted">
              {content.text}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-2.5 sm:items-center">
            {state === "completed" ? (
              <>
                <HoverHint id="hint-assessment-baru">
                  <Link
                    href={content.href}
                    aria-describedby="hint-assessment-baru"
                    className={cn(
                      buttonVariants({ variant: "default" }),
                      "h-12 gap-2.5 rounded-full bg-linear-to-r from-cta-from to-cta-to px-6 text-[15px] font-bold shadow-lg shadow-cta-to/30 hover:opacity-90"
                    )}
                  >
                    {content.cta}
                    <ArrowRight className="size-4.5" />
                  </Link>
                </HoverHint>
                <p className="text-[13px] font-medium text-ink-muted">
                  Kondisi usahamu berubah?
                </p>
              </>
            ) : (
              <>
                <Link
                  href={content.href}
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "h-12 gap-2.5 rounded-full bg-linear-to-r from-cta-from to-cta-to px-6 text-[15px] font-bold shadow-lg shadow-cta-to/30 hover:opacity-90"
                  )}
                >
                  {content.cta}
                  <ArrowRight className="size-4.5" />
                </Link>
                {state === "submitted" && (
                  <HoverHint id="hint-assessment-baru-link">
                    <Link
                      href="/assessment"
                      aria-describedby="hint-assessment-baru-link"
                      className="text-[13px] font-bold text-pink-ink underline-offset-4 hover:underline"
                    >
                      Assessment Baru
                    </Link>
                  </HoverHint>
                )}
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-pink-line pt-5">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-ink-muted">
            Alur Elevate Puan
          </p>
          <p className="text-[13px] font-bold text-ink-muted">
            {allDone
              ? "Semua langkah selesai"
              : `Langkah ${currentStep + 1} dari ${flowSteps.length}`}
          </p>
        </div>

        <ol aria-label="Alur Elevate Puan" className="mt-4 flex items-center">
          {flowSteps.map((label, i) => {
            const done = i < currentStep;
            const current = i === currentStep;
            const isLast = i === flowSteps.length - 1;
            return (
              <li
                key={label}
                aria-current={current ? "step" : undefined}
                className={cn("flex items-center", !isLast && "flex-1")}
              >
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-extrabold",
                    done && "border-brand-deep bg-brand-deep text-white",
                    current && "border-cta-to bg-cta-to text-white ring-4 ring-blush-soft",
                    !done && !current && "border-lav-line bg-white text-ink-muted"
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "ml-2 whitespace-nowrap text-[13px] font-bold",
                    done || current ? "text-ink-title" : "text-ink-muted",
                    !current && "hidden md:inline"
                  )}
                >
                  {label}
                </span>
                {!isLast && (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "mx-2.5 h-0.5 min-w-3 flex-1 rounded-full",
                      done ? "bg-brand-deep" : "bg-track"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>

        <p className="mt-4 text-[13px] leading-relaxed text-ink-muted">
          <span className="font-extrabold text-pink-ink">
            {allDone
              ? "Satu putaran selesai."
              : `Kamu di sini: ${flowSteps[currentStep]}.`}
          </span>{" "}
          {content.stepHint}
        </p>
      </CardContent>
    </Card>
  );
}