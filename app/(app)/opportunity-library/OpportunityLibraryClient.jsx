"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import OpportunityIcon from "@/components/opportunity-library/OpportunityIcon";
import {
  toStrategy,
  buildNarrative,
} from "@/lib/recommendation/strategy-adapter";

const EXPERIMENT_ROUTE = "/experiments/rancangan_experimen";
const EXPERIMENT_STORAGE_KEY =
  "elevate_selected_experiment_strategy";

// =====================================================
// KOMPONEN TAMPILAN
// =====================================================

function IconTile({ name, tone = "pink", size = 28 }) {
  const tones = {
    pink: "bg-pink-100 text-pink-500",
    purple: "bg-purple-100 text-purple-600",
    green: "bg-green-50 text-green-600",
  };

  return (
    <div
      className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
        tones[tone] || tones.pink
      }`}
    >
      <OpportunityIcon name={name} size={size} />
    </div>
  );
}

function StrategyMetrics({ strategy, muted = false }) {
  const metrics = [
    {
      label: "Durasi",
      value: strategy.duration,
      icon: "clock",
      tone: "pink",
    },
    {
      label: "Estimasi Biaya",
      value: strategy.cost,
      icon: "coins",
      tone: "purple",
    },
    {
      label: "Target",
      value: strategy.target,
      icon: "chart",
      tone: "pink",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {metrics.map((metric) => (
        <div
          key={metric.label}
          className={`flex items-center gap-3 rounded-2xl p-4 ${
            muted
              ? "border border-slate-100 bg-white"
              : "bg-gradient-to-br from-pink-50 to-purple-50/70"
          }`}
        >
          <div
            className={`shrink-0 ${
              metric.tone === "pink"
                ? "text-pink-500"
                : "text-purple-500"
            }`}
          >
            <OpportunityIcon name={metric.icon} size={32} />
          </div>

          <div className="min-w-0">
            <p className="text-xs text-slate-500">
              {metric.label}
            </p>
            <p className="mt-1 break-words text-sm font-bold text-ink">
              {metric.value}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StrategyActions({ onExperiment, muted = false }) {
  return (
    <div className="grid gap-3">
      <button
        type="button"
        onClick={onExperiment}
        className={`flex h-11 items-center justify-center gap-2 rounded-full px-6 text-center text-[15px] font-bold transition hover:opacity-90 ${
          muted
            ? "border border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100"
            : "bg-linear-to-r from-cta-from to-cta-to text-white shadow-lg shadow-cta-to/30"
        }`}
      >
        Lihat Detail &amp; Mulai Eksperimen
        <OpportunityIcon name="arrow" size={20} />
      </button>
    </div>
  );
}

// =====================================================
// FORMAT NARASI AI
// =====================================================

function FormattedText({ text }) {
  const lines = text.split("\n");

  function renderInline(value) {
    const parts = value.split(/(\*\*.*?\*\*|\*[^*]+\*)/g);

    return parts.map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong
            key={index}
            className="font-semibold text-ink-title"
          >
            {part.slice(2, -2)}
          </strong>
        );
      }

      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={index}>{part.slice(1, -1)}</em>;
      }

      return <span key={index}>{part}</span>;
    });
  }

  return (
    <div className="space-y-3 text-sm leading-7 text-slate-700">
      {lines.map((line, index) => {
        const cleanLine = line.trim();

        if (!cleanLine) return null;

        const isBullet = cleanLine.startsWith("*   ");

        if (isBullet) {
          return (
            <div key={index} className="flex gap-3 pl-2">
              <span className="shrink-0 text-pink-500">
                ✦
              </span>
              <p>{renderInline(cleanLine.slice(4))}</p>
            </div>
          );
        }

        return (
          <p
            key={index}
            className="whitespace-pre-wrap"
          >
            {renderInline(cleanLine)}
          </p>
        );
      })}
    </div>
  );
}

// =====================================================
// PANEL NARASI AI
// =====================================================

function AiNarrativePanel({ narrative, isExample }) {
  // Hanya menampilkan narasi asli sebelum rencana harian.
  // Kata-kata narasi tidak diubah.
  const introOnly = narrative
    .split(/Yuk, kita mulai dampingi/i)[0]
    .trim();

  return (
    <section className="rounded-2xl bg-lav-pale/40 p-4 sm:p-5">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-brand shadow-sm">
          <OpportunityIcon name="sparkle" size={22} />
        </div>

        <div>
          <h3 className="text-base font-bold text-ink-title">
            Yuk, Ketahui Dulu Kenapa Strategi Ini Cocok Untukmu!
          </h3>

          <p className="mt-1 text-xs leading-5 text-ink-muted">
            Pendampingan dan arahan strategi untuk membantu
            usahamu bertumbuh.
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-white p-4">
        <FormattedText text={introOnly} />
      </div>

      <p className="mt-3 text-xs leading-5 text-ink-muted">
        {isExample
          ? "✦ Alasan ini disusun otomatis dari data strategi dan kondisi usahamu (waktu, tim, keahlian, dan anggaran)."
          : "✦ Penjelasan ini dibuat AI dari hasil mesin rekomendasi dan kondisi usahamu."}
      </p>
    </section>
  );
}

// =====================================================
// PRATINJAU RENCANA 7 HARI
// =====================================================

function SevenDayPlan({ steps, onViewDetail }) {
  const [showAll, setShowAll] = useState(false);
  const visibleSteps = showAll ? steps : steps.slice(0, 3);

  return (
    <section className="rounded-2xl bg-lav-pale/40 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-ink-title">
          Rencana Langkah 7 Hari
        </h2>

        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="text-sm font-semibold text-brand hover:underline"
        >
          {showAll ? "Tampilkan 3 Hari" : "Lihat Semua"}
        </button>
      </div>

      <p className="mt-1 text-sm leading-6 text-ink-muted">
        Ikuti langkah praktis ini selama 7 hari untuk mulai
        menjalankan strategi.
      </p>

      <div className="mt-4 space-y-2">
        {visibleSteps.map((activity, index) => (
          <div
            key={index}
            className="grid grid-cols-[64px_1fr] items-center gap-3 rounded-xl border border-lav-line bg-white px-4 py-2.5 text-sm sm:grid-cols-[80px_1fr]"
          >
            <span className="font-bold text-brand">
              Hari {index + 1}
            </span>
            <span className="text-ink">{activity}</span>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowAll((value) => !value)}
          className="text-sm font-semibold text-brand hover:underline"
        >
          {showAll
            ? "Tampilkan lebih sedikit"
            : "Lihat Hari ke-4 s.d. 7 →"}
        </button>

        <button
          type="button"
          onClick={onViewDetail}
          className="rounded-full border border-lav-line bg-white px-4 py-2 text-sm font-bold text-brand hover:bg-lav-pale"
        >
          Lihat Detail Eksperimen
        </button>
      </div>
    </section>
  );
}

// =====================================================
// REKOMENDASI UTAMA
// =====================================================

function MainRecommendation({
  strategy: mainStrategy,
  onExperiment,
  narrative,
  isExample,
}) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-pink-line bg-white p-5 shadow-sm md:p-6">
      <div className="mb-4 flex justify-end">
        <span className="inline-flex items-center gap-2 rounded-full bg-pink-pale px-3 py-1.5 text-xs font-bold text-pink-ink">
          <OpportunityIcon name="sparkle" size={15} />
          Rekomendasi Utama
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <IconTile
          name={mainStrategy.icon}
          tone="pink"
          size={32}
        />

        <div>
          <h2 className="text-xl font-bold leading-tight text-ink-title md:text-2xl">
            {mainStrategy.title}
          </h2>

          <p className="mt-1.5 text-sm leading-6 text-ink-muted">
            {mainStrategy.description}
          </p>
        </div>
      </div>

      {/* NARASI AI */}
      <div className="mt-5">
        <AiNarrativePanel
          narrative={narrative}
          isExample={isExample}
        />
      </div>

      {/* RENCANA 7 HARI */}
      <div className="mt-4">
        <SevenDayPlan
          steps={mainStrategy.day_by_day_plan}
          onViewDetail={onExperiment}
        />
      </div>

      {/* METRIK STRATEGI */}
      <div className="mt-4">
        <StrategyMetrics strategy={mainStrategy} />
      </div>

      {/* TOMBOL AKSI */}
      <div className="mt-4">
        <StrategyActions onExperiment={onExperiment} />
      </div>
    </section>
  );
}

// =====================================================
// ALTERNATIF STRATEGI
// =====================================================

function AlternativeStrategy({
  strategy,
  isOpen,
  onToggle,
  onExperiment,
}) {
  return (
    <article className="overflow-hidden rounded-3xl border border-pink-line bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={`alternative-${strategy.id}`}
        className="flex w-full items-start gap-4 p-5 text-left transition hover:bg-purple-50/30"
      >
        <IconTile
          name={strategy.icon}
          tone="pink"
          size={27}
        />

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold text-ink sm:text-lg">
            {strategy.title}
          </h3>

          <p className="mt-1 line-clamp-2 text-sm text-ink-muted">
            {strategy.description}
          </p>
        </div>

        <span
          className={`mt-3 shrink-0 text-purple-600 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        >
          <OpportunityIcon name="chevron" size={24} />
        </span>
      </button>

      {isOpen && (
        <div
          id={`alternative-${strategy.id}`}
          className="space-y-4 border-t border-pink-line bg-[#FFFCFE] px-5 pb-5 pt-5"
        >
          <div className="rounded-2xl bg-gradient-to-r from-pink-50 to-purple-50 p-4">
            <h4 className="font-bold text-ink-title">
              Deskripsi Eksperimen ini:
            </h4>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              {strategy.description}
            </p>

            <p className="mt-3 text-sm leading-6 text-slate-700">
              <strong>Target:</strong> {strategy.target}
            </p>
          </div>

          <StrategyMetrics strategy={strategy} muted />

          <StrategyActions
            onExperiment={() => onExperiment(strategy)}
            muted
          />
        </div>
      )}
    </article>
  );
}

// =====================================================
// HEADER ILUSTRASI
// REVISI: JARAK ATAS DITAMBAHKAN
// =====================================================

function RecommendationHeader() {
  return (
    <header>
      <p className="mb-2 text-sm font-semibold text-pink-ink">
        REKOMENDASI STRATEGI
      </p>

      <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
        Strategi yang Paling Cocok Untukmu
      </h1>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
        Pilihan strategi eksperimen yang disesuaikan dengan kondisi usahamu.
      </p>
    </header>
  );
}

// =====================================================
// HALAMAN UTAMA
// =====================================================

export default function OpportunityLibraryClient() {
  const router = useRouter();
  const [state, setState] = useState({
    loading: true,
    error: "",
    notReady: null,
    data: null,
  });
  const [openedAlternatives, setOpenedAlternatives] =
    useState({});
  const [experimentNotice, setExperimentNotice] =
    useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          "/api/recommendations/engine",
          { cache: "no-store", signal: controller.signal }
        );
        const result = await response.json();

        if (response.status === 409 && result.ready === false) {
          if (!controller.signal.aborted) {
            setState({
              loading: false,
              error: "",
              notReady: result,
              data: null,
            });
          }
          return;
        }

        if (!response.ok || !result.success) {
          throw new Error(
            result.message || "Gagal memuat rekomendasi."
          );
        }

        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: "",
            notReady: null,
            data: result,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({
            loading: false,
            error: error.message,
            notReady: null,
            data: null,
          });
        }
      }
    }

    load();

    return () => controller.abort();
  }, []);

  function toggleAlternative(id) {
    setOpenedAlternatives((previous) => ({
      ...previous,
      [id]: !previous[id],
    }));
  }

  // Strategi sudah disimpan oleh server saat halaman dimuat.
  // Tombol hanya membuka halaman Rancangan untuk strategi yang dipilih.
  function handleExperiment(selected) {
    const target =
      selected && typeof selected === "object" && "id" in selected
        ? selected
        : main;

    const proposalId = target?.raw?.proposal_id;

    if (!proposalId) {
      setExperimentNotice(
        "Strategi ini belum tersimpan. Muat ulang halaman ini lalu coba lagi."
      );
      return;
    }

    router.push(
      `${EXPERIMENT_ROUTE}?proposalId=${encodeURIComponent(proposalId)}`
    );
  }

  const MISSING_LABELS = {
    assessment: "Assessment",
    diagnosis: "Diagnosis usaha",
    constraints: "Realistic Condition",
    financial_readiness: "Financial Readiness",
    playbooks: "Katalog strategi",
  };

  const recommendations = state.data?.recommendations ?? [];
  const main = recommendations[0]
    ? toStrategy(recommendations[0])
    : null;
  const alternatives = recommendations.slice(1).map(toStrategy);

  let body;

  if (state.loading) {
    body = (
      <section className="rounded-3xl border border-pink-line bg-white p-7 shadow-sm">
        <p className="text-sm text-ink-muted">
          Menyusun strategi untuk usahamu...
        </p>
      </section>
    );
  } else if (state.error) {
    body = (
      <section
        role="alert"
        className="rounded-3xl border border-amber-200 bg-amber-50 p-7 text-sm leading-7 text-amber-950"
      >
        <h2 className="text-lg font-semibold">
          Strategi belum dapat dimuat
        </h2>
        <p className="mt-2">{state.error}</p>
      </section>
    );
  } else if (state.notReady) {
    const missing = (state.notReady.missing || []).map(
      (key) => MISSING_LABELS[key] || key
    );
    body = (
      <section className="rounded-3xl border border-pink-line bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-ink-title">
          Lengkapi datamu dulu
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Kami membutuhkan data berikut sebelum bisa menyusun
          strategi untukmu
          {missing.length > 0 ? `: ${missing.join(", ")}.` : "."}
        </p>
      </section>
    );
  } else if (!main) {
    body = (
      <section className="rounded-3xl border border-pink-line bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-ink-title">
          Belum ada strategi yang cocok
        </h2>
        <p className="mt-3 text-sm leading-7 text-ink-muted">
          Dengan waktu, tim, keahlian digital, dan anggaran yang
          kamu isi saat ini, belum ada strategi di katalog kami
          yang memenuhi semua syarat. Kamu bisa memperbarui
          Realistic Condition atau Financial Readiness, lalu
          melihat halaman ini lagi.
        </p>
      </section>
    );
  } else {
    body = (
      <>
        <MainRecommendation
          strategy={main}
          onExperiment={() => handleExperiment(main)}
          narrative={buildNarrative(main.raw)}
          isExample={main.narrativeSource !== "gemini"}
        />

        {experimentNotice && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-purple-200 bg-purple-50 p-5 text-sm leading-6 text-ink-title"
          >
            <OpportunityIcon name="info" size={22} />

            <div className="flex-1">{experimentNotice}</div>

            <button
              type="button"
              onClick={() => setExperimentNotice("")}
              className="font-bold text-purple-700 underline"
            >
              Tutup
            </button>
          </div>
        )}

        {alternatives.length > 0 && (
          <section>
            <h2 className="mb-4 text-lg font-bold text-ink-title">
              Alternatif Strategi Lainnya ({alternatives.length})
            </h2>

            <div className="space-y-3">
              {alternatives.map((strategy) => (
                <AlternativeStrategy
                  key={strategy.id}
                  strategy={strategy}
                  isOpen={Boolean(
                    openedAlternatives[strategy.id]
                  )}
                  onToggle={() => toggleAlternative(strategy.id)}
                  onExperiment={handleExperiment}
                />
              ))}
            </div>
          </section>
        )}
      </>
    );
  }

  return (
    <div className="min-h-full space-y-6 text-ink">
      <RecommendationHeader />

      <div className="mx-auto max-w-6xl space-y-7 text-ink">
        {body}
      </div>
    </div>
  );
}
