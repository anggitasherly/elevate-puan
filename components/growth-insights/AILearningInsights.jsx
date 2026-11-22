"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ShieldCheck,
  BookOpen,
  RefreshCw,
  AlertCircle,
  Target,
  CircleHelp,
  Lightbulb,
  TrendingUp,
  Search,
  ArrowRight,
} from "lucide-react";

import ExperimentAnalysis from "./ExperimentAnalysis";

function EvidenceCard({ evidence }) {
  const coverage =
    evidence?.checkinCoveragePct === null ||
    evidence?.checkinCoveragePct === undefined
      ? "Belum tersedia"
      : `${evidence.checkinCoveragePct}%`;

  return (
    <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-mint-soft p-3">
          <ShieldCheck size={22} className="text-emerald-700" />
        </div>
        <div>
          <h3 className="type-h2 text-ink-title">Evidence & Confidence</h3>
          <p className="type-caption text-ink-muted">
            Seberapa lengkap bukti yang mendukung analisis ini?
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <EvidenceMetric
          label="Eksperimen Dianalisis"
          value={evidence?.analyzedExperimentCount ?? 0}
          note={`Dari ${evidence?.experimentCount ?? 0} eksperimen tercatat.`}
        />
        <EvidenceMetric
          label="Eksperimen Dievaluasi"
          value={evidence?.evaluatedCount ?? 0}
          note="Eksperimen selesai dengan hasil evaluasi."
        />
        <div className="rounded-xl bg-sun-soft p-4">
          <p className="type-caption text-ink-muted">Check-in Coverage</p>
          <p className="mt-1 text-2xl font-bold text-honey-ink">{coverage}</p>
          <p className="type-caption mt-1 text-ink-muted">
            Kelengkapan pencatatan check-in pada periode yang dinilai.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-row-line p-4">
        <p className="type-caption text-ink-muted">Tingkat Confidence</p>
        <p className="mt-1 text-lg font-bold text-ink-title">
          {evidence?.confidence ?? "Belum tersedia"}
        </p>
        <p className="type-caption mt-1 text-ink-muted">
          Confidence menunjukkan kecukupan bukti untuk mendukung analisis,
          bukan peluang keberhasilan bisnis.
        </p>
      </div>

      {evidence?.explanation && (
        <p className="type-caption mt-4 text-ink-muted">
          {evidence.explanation}
        </p>
      )}
    </div>
  );
}

function EvidenceMetric({ label, value, note }) {
  return (
    <div className="rounded-xl bg-lav-pale/60 p-4">
      <p className="type-caption text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-ink-title">{value}</p>
      <p className="type-caption mt-1 text-ink-muted">{note}</p>
    </div>
  );
}

function EmptyList({ text }) {
  return <p className="type-caption text-ink-muted">{text}</p>;
}

function InsightCard({ item, index }) {
  if (!item) return null;

  return (
    <article className="rounded-xl border border-row-line bg-white p-4 transition-all duration-200 hover:border-pink-line hover:bg-pink-pale/20 hover:shadow-sm md:p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-pale text-sm font-semibold text-pink-ink">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="type-body font-medium text-ink-title">{item.insight}</p>

          {item.experimentRefs?.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {item.experimentRefs.map((ref) => (
                <span
                  key={ref}
                  className="rounded-full bg-pink-pale px-2.5 py-1 text-xs font-medium text-pink-ink"
                >
                  {ref}
                </span>
              ))}
            </div>
          )}

          {item.evidence?.length > 0 && (
            <div className="rounded-lg bg-lav-pale/40 p-3">
              <p className="type-caption mb-2 font-semibold text-ink-title">
                Bukti yang mendukung
              </p>
              <ul className="space-y-1.5">
                {item.evidence.map((evidence, evidenceIndex) => (
                  <li
                    key={`${index}-${evidenceIndex}`}
                    className="type-caption flex gap-2 text-ink-muted"
                  >
                    <span className="text-pink-ink">•</span>
                    <span>{evidence}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {item.limitation && (
            <p className="type-caption text-ink-muted">
              <span className="font-semibold text-ink-title">Batasan bukti: </span>
              {item.limitation}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}

function InsightGroup({ title, description, items, icon: Icon, emptyText }) {
  return (
    <section className="space-y-3">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="rounded-xl bg-pink-pale p-2.5">
            <Icon size={19} className="text-pink-ink" />
          </div>
        )}
        <div>
          <h4 className="type-h2 text-ink-title">{title}</h4>
          {description && (
            <p className="type-caption mt-1 text-ink-muted">{description}</p>
          )}
        </div>
      </div>

      {items?.length > 0 ? (
        <div className="space-y-3">
          {items.map((item, index) => (
            <InsightCard key={`${title}-${index}`} item={item} index={index} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-row-line p-4">
          <EmptyList text={emptyText} />
        </div>
      )}
    </section>
  );
}

function OverallAnalysis({ item }) {
  if (!item) return null;

  return (
    <div className="rounded-xl border border-lav-line bg-lav-pale/30 p-4 md:p-5">
      <p className="type-body font-medium text-ink-title">{item.insight}</p>
      {item.experimentRefs?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.experimentRefs.map((ref) => (
            <span
              key={ref}
              className="rounded-full bg-pink-pale px-2.5 py-1 text-xs font-medium text-pink-ink"
            >
              {ref}
            </span>
          ))}
        </div>
      )}
      {item.evidence?.length > 0 && (
        <div className="mt-4">
          <p className="type-caption mb-2 font-semibold text-ink-title">
            Dasar analisis
          </p>
          <ul className="space-y-1.5">
            {item.evidence.map((evidence, index) => (
              <li key={index} className="type-caption flex gap-2 text-ink-muted">
                <span className="text-pink-ink">•</span>
                <span>{evidence}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {item.limitation && (
        <p className="type-caption mt-3 text-ink-muted">
          <span className="font-semibold text-ink-title">Batasan analisis: </span>
          {item.limitation}
        </p>
      )}
    </div>
  );
}

export default function AILearningInsights() {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const [isStarting, setIsStarting] = useState(false);
  const [startError, setStartError] = useState("");

  const loadAnalysis = useCallback(async (signal) => {
    try {
      setIsLoading(true);
      setError("");

      // Login dibaca server dari cookie, jadi browser tidak perlu mengirim token.
      const response = await fetch("/api/growth-insights/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        signal,
      });

      const responseData = await response.json();
      if (!response.ok || !responseData.success) {
        throw new Error(
          responseData.message || "Gagal membuat AI Learning Insights."
        );
      }

      if (!signal?.aborted) setResult(responseData.data);
    } catch (err) {
      if (err.name === "AbortError" || signal?.aborted) return;
      console.error("AI Learning Insights Error:", err);
      setError(err.message || "Terjadi kesalahan saat membuat analisis.");
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    loadAnalysis(controller.signal);
    return () => controller.abort();
  }, [loadAnalysis]);

  const startNextGrowth = useCallback(async () => {
    try {
      setIsStarting(true);
      setStartError("");

      const response = await fetch("/api/next-growth/diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));

      if (response.status === 201 && data.success) {
        router.push("/business-overview");
        return; // tombol tetap nonaktif sampai halaman berpindah
      }

      setStartError(
        data.message || "Next Growth belum bisa dimulai. Coba lagi nanti."
      );
    } catch (err) {
      console.error("Next Growth Error:", err);
      setStartError("Terjadi kesalahan. Periksa koneksi lalu coba lagi.");
    }
    setIsStarting(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-lav-line bg-white py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
        <p className="type-caption mt-4 text-ink-muted">
          Sedang menganalisis pembelajaran eksperimenmu...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-5" role="alert">
        <div className="flex items-start gap-3">
          <AlertCircle size={22} className="shrink-0 text-red-600" />
          <div>
            <p className="font-semibold text-red-700">
              Analisis belum berhasil dimuat.
            </p>
            <p className="type-caption mt-1 text-red-600">{error}</p>
            <button
              type="button"
              onClick={() => loadAnalysis()}
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cta-from to-cta-to px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-pink-ink/20 transition-all duration-200 hover:brightness-105 hover:shadow-md"
            >
              <RefreshCw size={16} /> Coba Lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!result) return null;

  const isAIUnavailable = result.aiStatus === "unavailable";
  const isAIStale = result.aiStatus === "stale";
  const businessAnalysis = result.businessAnalysis;
  const diagnosis = result.diagnosis;
  const deepAnalysis = businessAnalysis?.deepAnalysis;
  const learnings = result.learnings ?? [];
  const evidence = result.evidence;

  return (
    <section className="space-y-6">
      {/* Overall Business Analysis */}
      {businessAnalysis && (
        <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-lav-pale p-3">
              <Sparkles size={22} className="text-pink-ink" />
            </div>
            <div>
              <p className="type-micro uppercase tracking-wider text-brand">
                AI Business Analysis
              </p>
              <h3 className="type-h2 text-ink-title">
                {businessAnalysis.headline}
              </h3>
            </div>
          </div>
          <p className="type-body mt-5 text-ink-muted">
            {businessAnalysis.summary}
          </p>
          {businessAnalysis.highlights?.length > 0 && (
            <div className="mt-5 rounded-xl bg-lav-pale/60 p-4">
              <p className="type-body font-semibold text-ink-title">
                Hal yang perlu diperhatikan
              </p>
              <ul className="mt-3 space-y-3">
                {businessAnalysis.highlights.map((item, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="mt-1 text-brand">•</span>
                    <span className="type-body text-ink-muted">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deepAnalysis?.overallBusinessAnalysis && (
            <div className="mt-5 space-y-3">
              <h4 className="type-h2 text-ink-title">
                Analisis Kondisi Bisnis
              </h4>
              <OverallAnalysis item={deepAnalysis.overallBusinessAnalysis} />
            </div>
          )}
        </div>
      )}

      {(isAIUnavailable || isAIStale) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="font-semibold text-amber-800">
            {isAIStale
              ? "Analisis terbaru belum tersedia."
              : "Analisis AI sementara belum tersedia."}
          </p>
          <p className="type-caption mt-1 text-amber-800">
            {result.message ||
              "Data metrik dan bukti tetap tersedia. Kamu dapat mencoba analisis kembali nanti."}
          </p>
          <button
            type="button"
            onClick={() => loadAnalysis()}
            className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-cta-from to-cta-to px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-pink-ink/20 transition-all duration-200 hover:brightness-105 hover:shadow-md"
          >
            <RefreshCw size={16} /> Coba Analisis Lagi
          </button>
        </div>
      )}

      {/* Deep analysis from the new API response */}
      {deepAnalysis ? (
        <div className="space-y-6">
          <InsightGroup
            title="What Worked"
            description="Hal positif yang terlihat dari hasil dan bukti eksperimen."
            items={deepAnalysis.whatWorked}
            icon={TrendingUp}
            emptyText="Belum ada hasil positif yang cukup didukung oleh bukti."
          />
          <InsightGroup
            title="What Didn't Work"
            description="Hasil yang belum sesuai target atau hambatan yang tercatat."
            items={deepAnalysis.whatDidNotWork}
            icon={Target}
            emptyText="Belum ada bukti yang cukup untuk menyimpulkan bagian ini."
          />
          <InsightGroup
            title="Why It Might Have Happened"
            description="Kemungkinan penjelasan berdasarkan hubungan antara hipotesis, aktivitas, hambatan, dan hasil."
            items={deepAnalysis.whyItMightHaveHappened}
            icon={CircleHelp}
            emptyText="Data saat ini belum cukup untuk menjelaskan kemungkinan penyebab."
          />
          <InsightGroup
            title="Unresolved Problem Signals"
            description="Masalah yang masih terlihat atau belum terjawab dari bukti yang tersedia."
            items={deepAnalysis.unresolvedProblemSignals}
            icon={Search}
            emptyText="Belum ada sinyal masalah berulang yang dapat disimpulkan."
          />
          <InsightGroup
            title="Emerging Opportunity Signals"
            description="Sinyal positif atau peluang yang mulai terlihat, bukan rekomendasi tindakan."
            items={deepAnalysis.emergingOpportunitySignals}
            icon={Lightbulb}
            emptyText="Belum ada sinyal peluang yang cukup didukung oleh data."
          />
        </div>
      ) : (
        /* Backward compatibility for the previous API response shape */
        diagnosis && (
          <div className="space-y-4">
            <div>
              <h3 className="type-h2 text-ink-title">
                Analisis Hasil Eksperimen
              </h3>
              <p className="type-caption mt-1 text-ink-muted">
                Memahami hasil yang terlihat, hal yang belum berjalan sesuai
                harapan, dan kemungkinan penyebabnya berdasarkan bukti.
              </p>
            </div>
            <ExperimentAnalysis
              worked={diagnosis.worked ?? []}
              didNotWork={diagnosis.didNotWork ?? []}
              possibleCauses={diagnosis.possibleCauses ?? []}
            />
          </div>
        )
      )}

      {evidence && <EvidenceCard evidence={evidence} />}

      {/* Key Business Learnings */}
      <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sun-soft p-3">
            <BookOpen size={22} className="text-honey-ink" />
          </div>
          <div>
            <h3 className="type-h2 text-ink-title">Key Business Learnings</h3>
            <p className="type-caption text-ink-muted">
              Pelajaran penting dari perjalanan eksperimen bisnismu.
            </p>
          </div>
        </div>
        <div className="mt-5 space-y-4">
          {learnings.length > 0 ? (
            learnings.map((item, index) => (
              <div key={index} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pink-pale text-sm font-semibold text-pink-ink">
                  {index + 1}
                </div>
                <p className="type-body text-ink-muted">{item}</p>
              </div>
            ))
          ) : (
            <EmptyList text="Belum ada pembelajaran yang cukup didukung oleh data." />
          )}
        </div>
      </div>

      <p className="type-caption text-ink-muted">
        Analisis merupakan interpretasi dari data yang tersedia, bukan jaminan
        hasil bisnis di masa depan. Tingkat confidence menunjukkan kecukupan
        bukti, bukan kepastian keberhasilan.
      </p>

      {/* Tombol visual saja. Integrasi siklus Next Growth dikerjakan terpisah. */}
      <div className="flex flex-col items-start gap-2 rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between md:p-6">
        <div>
          <h3 className="type-h2 text-ink-title">Siap melanjutkan pertumbuhan bisnis?</h3>
          <p className="type-caption mt-1 text-ink-muted">
            Mulai siklus pertumbuhan berikutnya setelah evaluasi kondisi bisnis diperbarui.
          </p>
        </div>
        <div className="flex flex-col items-start gap-2 md:items-end">
          <button
            type="button"
            onClick={startNextGrowth}
            disabled={isStarting}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-cta-from to-cta-to px-6 py-3 text-sm font-semibold text-white shadow-md shadow-pink-ink/20 transition-all duration-200 hover:brightness-105 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isStarting ? "Memproses..." : "Next Growth"}
            <ArrowRight size={17} />
          </button>
          {startError && (
            <p role="alert" className="type-caption max-w-xs text-red-600 md:text-right">
              {startError}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
