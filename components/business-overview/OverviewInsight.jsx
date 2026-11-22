
import {
  ArrowRight,
  BadgeCheck,
  CircleHelp,
  ClipboardList,
//  Lightbulb,
  MessageCircleQuestion,
  Sparkles,
  Target,
} from "lucide-react";
import ClarificationPanel from "./ClarificationPanel";
import UndeterminedPanel from "./UndeterminedPanel";


const confidenceLabels = {
  high: "Cukup Yakin",
  medium: "Mulai Terlihat",
  low: "Masih Perlu Dipastikan",
  none: "Belum Bisa Dinilai",
};

const statusLabels = {
  diagnosed: "Hasilnya Sudah Siap",
  needs_clarification: "Butuh Sedikit Informasi Lagi",
  undetermined: "Masih Perlu Dilengkapi",
};

export default function OverviewInsight({ diagnosis, assessmentId = null }) {
  const needsClarification =
    diagnosis?.status === "needs_clarification";

  if (!diagnosis) {
    return (
      <section className="rounded-3xl border border-pink-line bg-white p-6 sm:p-8">
        <h2 className="text-2xl font-bold text-ink-title">
          Kondisi Usahamu Belum Bisa Kami Rangkum
        </h2>

        <p className="mt-4 leading-7 text-ink-muted">
          Setelah kamu menyelesaikan Assessment, kami akan bantu merangkum hal-hal yang perlu diperhatikan dalam usahamu.
        </p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="hasil-diagnosis-title"
      className="space-y-5"
    >
      {/* HEADER HASIL DIAGNOSIS */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-brand">
          <Sparkles size={17} />
          Hasil Analisis Bisnismu
        </div>

        <h2
          id="hasil-diagnosis-title"
          className="text-2xl font-bold text-ink-title sm:text-3xl"
        >
          Mari Kenali Kondisi Usahamu
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">
            {statusLabels[diagnosis.status]}
          </span>
        </div>
      </div>

      {/* PANEL 1 â€” FOKUS UTAMA */}
      <article className="rounded-3xl border border-pink-line bg-white p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="shrink-0 rounded-2xl bg-purple-100 p-3 text-brand">
            <Target size={24} />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-ink-title">
              Yang Perlu Kamu Perhatikan Lebih Dulu
            </h3>

            <p className="mt-4 text-lg font-semibold text-ink-title">
              {diagnosis.primaryProblem.title}
            </p>

            <p className="mt-3 leading-7 text-ink-muted">
              {diagnosis.primaryProblem.description}
            </p>
          </div>
        </div>
      </article>

      {/* PANEL 2 â€” TINGKAT KEYAKINAN */}
      <article className="rounded-3xl border border-pink-line bg-white p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <BadgeCheck
            className="shrink-0 text-brand"
            size={22}
          />

          <h3 className="text-lg font-bold text-ink-title">
            Seberapa Yakin Kami dengan Hasil Ini?
          </h3>
        </div>

        <span className="mt-5 inline-flex rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800">
          {confidenceLabels[diagnosis.confidence.level]}
        </span>

        <p className="mt-4 leading-7 text-ink-muted">
          {diagnosis.confidence.reason}
        </p>

        <div className="mt-5 flex items-start gap-2 border-t border-purple-50 pt-4 text-xs leading-5 text-ink-muted">
          <CircleHelp
            size={16}
            className="mt-0.5 shrink-0"
          />
          <p>
            Penilaian ini menunjukkan seberapa kuat jawabanmu mendukung hasilnya, bukan angka kepastian yang mutlak.
          </p>
        </div>
      </article>

      {/* PANEL 3 â€” BUKTI UTAMA */}
      <article className="rounded-3xl border border-pink-line bg-white p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <ClipboardList
            className="shrink-0 text-brand"
            size={22}
          />

          <h3 className="text-lg font-bold text-ink-title">
            Apa yang Kami Temukan dari Jawabanmu
          </h3>
        </div>

        <p className="mt-3 text-sm leading-6 text-ink-muted">
          Beberapa jawabanmu membantu kami memahami apa yang sedang terjadi dalam usahamu. Ini hal-hal yang paling berkaitan dengan hasil analisis tadi.
        </p>

        {diagnosis.evidence.length === 0 && (
          <p className="mt-4 text-sm leading-6 text-ink-muted">Belum ada rincian jawaban yang bisa kami tampilkan di bagian ini.</p>
        )}
        <ul className="mt-5 space-y-4">
          {diagnosis.evidence.map((item, index) => (
            <li
              key={index}
              className="flex items-start gap-3 text-sm leading-7 text-ink-muted"
            >
              <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-purple-400" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </article>

      {/* PANEL 4 â€” PELUANG BISNIS
      <article className="rounded-3xl border border-pink-line bg-white p-6 sm:p-7">
        <div className="flex items-center gap-3">
          <Lightbulb
            className="shrink-0 text-pink-500"
            size={23}
          />

          <h3 className="text-lg font-bold text-ink-title">
            Peluang yang Bisa Kamu Pertimbangkan
          </h3>
        </div>

        <p className="mt-3 text-sm leading-7 text-ink-muted">
          {diagnosis.opportunities.length > 0 ? "Dari kondisi usahamu saat ini, ada beberapa peluang yang bisa kamu pertimbangkan secara bertahap." : "Untuk saat ini, kami belum punya cukup informasi untuk menyarankan peluang yang tepat. Kita mulai dari memahami kondisi usahamu dulu, ya."}
        </p>

        <div className="mt-5 flex flex-col gap-4">
          {diagnosis.opportunities.map(
            (opportunity, index) => (
              <div
                key={opportunity.title}
                className="rounded-2xl border border-pink-line bg-[#FFFBFD] p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-pink-100 text-sm font-semibold text-pink-700">
                    {index + 1}
                  </span>

                  <div>
                    <h4 className="font-semibold text-ink-title">
                      {opportunity.title}
                    </h4>

                    <p className="mt-2 text-sm leading-6 text-ink-muted">
                      {opportunity.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      </article>
    */}

      {/* PANEL 5 â€” KLARIFIKASI */}
      {needsClarification && (
        <ClarificationPanel
          question={diagnosis.clarificationQuestion}
          clarification={diagnosis.clarification}
          assessmentId={assessmentId}
        />
      )}

      {diagnosis.status === "undetermined" && (
        <UndeterminedPanel
          missingInformation={diagnosis.missingInformation}
          otherProblems={diagnosis.otherProblems}
        />
      )}

      {/* KETERANGAN SUMBER HASIL DIAGNOSIS */}
      <p className="flex items-start gap-2 text-xs leading-5 text-slate-400">
        <ArrowRight size={14} className="mt-0.5 shrink-0" />
        <span>
          Ringkasan ini dibuat dari jawaban yang kamu berikan saat Assessment, bukan dari perkiraan tentang usahamu.
          

        </span>
      </p>
    </section>
  );
}


