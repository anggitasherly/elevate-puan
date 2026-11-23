
"use client";

import { useCallback, useEffect, useState } from "react";

import { supabase } from "@/lib/supabase";

import ExperimentOverview from "@/components/growth-insights/ExperimentOverview";
import BusinessPerformance from "@/components/growth-insights/BusinessPerformance";
import BusinessConsistency from "@/components/growth-insights/BusinessConsistency";
import AILearningInsights from "@/components/growth-insights/AILearningInsights";
import BlobBackground from "@/components/layout/BlobBackground";

export default function InsightsPage() {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Fungsi ini hanya mengambil data. Tidak mengubah React state.
  const requestInsights = useCallback(async (signal) => {
  // Ambil session user dari Supabase.
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) throw sessionError;

  if (signal?.aborted) {
    throw new DOMException("Request dibatalkan.", "AbortError");
  }

  // Pastikan user sudah login.
  if (!session?.access_token) {
    throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
  }

  // Kirim token ke Route Handler API.
  const response = await fetch("/api/growth-insights", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
    cache: "no-store",
    signal,
  });

  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(
      result.message || "Gagal mengambil data Growth Insights."
    );
  }

  return result.data;
}, []);

  // Mengambil data ketika halaman pertama kali dibuka.
  useEffect(() => {
    const controller = new AbortController();

    requestInsights(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (err.name === "AbortError" || controller.signal.aborted) {
          return;
        }

        console.error("Growth Insights Error:", err);

        setError(
          err.message || "Terjadi kesalahan saat mengambil data."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [requestInsights]);

  // Retry dijalankan melalui interaksi tombol user.
  const handleRetry = async () => {
    setIsLoading(true);
    setError("");

    try {
      const result = await requestInsights();
      setData(result);
    } catch (err) {
      console.error("Growth Insights Error:", err);

      setError(
        err.message || "Terjadi kesalahan saat mengambil data."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <BlobBackground />

      <main className="relative isolate min-h-screen bg-transparent px-5 py-8 md:px-8 lg:px-10">
        <div className="mx-auto w-full max-w-7xl space-y-8">

          {/* Page Header */}
          <section className="space-y-2">
            <p className="type-micro uppercase tracking-wider text-brand">
              Business Growth
            </p>

            <h1 className="type-display text-ink-title">
              Growth Insights
            </h1>

            <p className="type-body max-w-2xl text-ink-muted">
              Pahami perkembangan bisnismu dan pelajari hasil eksperimen
              berdasarkan data serta aktivitas bisnismu.
            </p>
          </section>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
            </div>
          )}

          {/* Error State */}
          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6">
              <p className="font-semibold text-red-700">
                Data Growth Insights gagal dimuat.
              </p>

              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={handleRetry}
                className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {/* No Business State */}
          {!isLoading && !error && data && !data.business && (
            <div className="rounded-xl border border-lav-line bg-lav-pale/40 p-6">
              <p className="font-semibold text-ink-title">
                Data bisnis belum tersedia.
              </p>

              <p className="mt-2 text-sm text-ink-muted">
                Lengkapi data bisnis terlebih dahulu untuk melihat Growth Insights.
              </p>
            </div>
          )}

          {/* Growth Insights Content */}
          {!isLoading && !error && data?.business && (
            <>
              {/* Section 01: Experiment Overview */}
              <section
                id="experiment-overview"
                className="space-y-4"
              >
                <h2 className="type-h1 text-ink-title">
                  Experiment Overview
                </h2>

                <ExperimentOverview data={data} />
              </section>

              {/* Section 02: Business Performance */}
              <section
                id="business-performance"
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="type-h1 text-ink-title">
                    Business Performance
                  </h2>

                  <p className="type-body text-ink-muted">
                    Pahami perkembangan omzet dan kontribusi setiap eksperimen terhadap bisnismu.
                  </p>
                </div>

                <BusinessPerformance data={data} />
              </section>

              {/* Section 03: Business Consistency */}
              <section
                id="business-consistency"
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="type-h1 text-ink-title">
                    Business Consistency
                  </h2>

                  <p className="type-body text-ink-muted">
                    Pantau konsistensi pencatatan omzet dan aktivitas check-in bisnismu.
                  </p>
                </div>

                <BusinessConsistency data={data} />
              </section>

              {/* Section 04: AI Learning Insights */}
              <section
                id="ai-learning-insights"
                className="space-y-4"
              >
                <div className="space-y-1">
                  <h2 className="type-h1 text-ink-title">
                    AI Learning Insights
                  </h2>

                  <p className="type-body text-ink-muted">
                    Pelajari apa yang berhasil, apa yang belum berjalan sesuai harapan,
                    dan kemungkinan penyebabnya berdasarkan bukti eksperimen.
                  </p>
                </div>

                <AILearningInsights />
              </section>
            </>
          )}
        </div>
      </main>
    </>
  );
}
