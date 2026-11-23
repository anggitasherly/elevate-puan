"use client";

import Link from "next/link";
import OverviewMetrics from "@/components/business-overview/OverviewMetrics";
import OverviewInsight from "@/components/business-overview/OverviewInsight";

import {
  adaptBusinessDiagnosis,
  buildOverviewMetrics,
} from "@/lib/business-overview-adapter";

export default function BusinessOverviewClient({
  rawDiagnosis = null,
  assessmentId = null,
}) {
  // Hasil diagnosis diterima dari Server Component melalui rawDiagnosis.
  // Jangan menggunakan data simulasi sebagai hasil pengguna.
  const diagnosis = rawDiagnosis
    ? adaptBusinessDiagnosis(rawDiagnosis)
    : null;

  const metrics = buildOverviewMetrics(diagnosis);

  return (
    <div className="min-h-full space-y-6 text-ink">
      {/* Page heading, selaras dengan Experiment History dan Growth Insights */}
      <header>
        <p className="mb-2 text-sm font-semibold text-pink-ink">
          GAMBARAN BISNIS
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
          Business Overview
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Lihat ringkasan kondisi bisnismu berdasarkan hasil diagnosis awal.
        </p>
      </header>

      {/* Narasi diagnosis menjadi fokus utama */}
      <OverviewInsight diagnosis={diagnosis} assessmentId={assessmentId} />

      {/* Ringkasan kondisi bisnis */}
      <section className="rounded-3xl border border-pink-line bg-white p-5 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-ink-title">
          Sekilas tentang Kondisi Usahamu
        </h2>

        <div className="mt-5">
          <OverviewMetrics metrics={metrics} />
        </div>
      </section>

      {/* Navigasi */}
      <nav
        aria-label="Navigasi Business Overview"
        className="flex flex-col gap-4 border-t border-pink-line pt-6 sm:flex-row sm:items-center sm:justify-between"
      >
        <Link
          href="/assessment"
          className="inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-deep"
        >
          <span aria-hidden="true" className="text-xl">
            ←
          </span>
          Kembali ke Assessment
        </Link>

        <Link
          href="/financial-readiness"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-linear-to-r from-cta-from to-cta-to px-6 text-[15px] font-bold text-white shadow-lg shadow-cta-to/30 transition hover:opacity-90"
        >
          Lanjut ke Kesiapan Finansial
          <span aria-hidden="true" className="text-xl">
            →
          </span>
        </Link>
      </nav>
    </div>
  );
}
