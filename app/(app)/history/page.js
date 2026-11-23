
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  ChevronDown,
  FlaskConical,
  CircleCheck,
  Clock3,
} from "lucide-react";

import ExperimentRow, {
  GRID_COLS,
} from "@/components/experiment-history/ExperimentRow";

import { supabase } from "@/lib/supabase";


export default function ExperimentHistoryPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [category, setCategory] = useState("all");

  // Data eksperimen dari API.
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  // 1. Mengambil riwayat eksperimen dari API.
  useEffect(() => {
    let isMounted = true;

    async function fetchHistory() {
  try {
    setLoading(true);
    setError("");

    // Ambil session Supabase yang sedang login.
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    if (!session?.access_token) {
      throw new Error("Sesi login tidak ditemukan. Silakan login kembali.");
    }

    // Panggil API History menggunakan access token.
    const response = await fetch("/api/experiments/history", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
      cache: "no-store",
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(
        result.message ||
        result.error ||
        "Gagal mengambil riwayat eksperimen."
      );
    }

    if (isMounted) {
      setExperiments(
        Array.isArray(result.data?.experiments)
          ? result.data.experiments
          : []
      );
    }
  } catch (err) {
    console.error("History fetch error:", err);

    if (isMounted) {
      setError(
        err.message || "Terjadi kesalahan saat mengambil data eksperimen."
      );
      setExperiments([]);
    }
  } finally {
    if (isMounted) {
      setLoading(false);
    }
  }
}

    fetchHistory();

    return () => {
      isMounted = false;
    };
  }, [retry]);

  // 2. Menghitung ringkasan berdasarkan data API.
  const counts = useMemo(
    () => ({
      all: experiments.length,
      completed: experiments.filter((e) => e.status === "completed").length,
      ongoing: experiments.filter((e) => e.status === "ongoing").length,
    }),
    [experiments]
  );

  // 3. Mengambil kategori dari problem_addressed melalui API.
  const categories = useMemo(
    () => [
      ...new Set(
        experiments
          .map((e) => e.category || "Belum dikategorikan")
          .filter(Boolean)
      ),
    ],
    [experiments]
  );

  // 4. Filter pencarian, status, dan kategori.
  const filtered = useMemo(() => {
    return experiments.filter((e) => {
      const experimentName = (e.name || e.title || "").toLowerCase();

      const matchQuery = experimentName.includes(query.toLowerCase());

      const matchStatus =
        status === "all" || e.status === status;

      const experimentCategory =
        e.category || "Belum dikategorikan";

      const matchCategory =
        category === "all" || experimentCategory === category;

      return matchQuery && matchStatus && matchCategory;
    });
  }, [experiments, query, status, category]);

  // 5. Summary cards.
  const summary = [
    {
      key: "all",
      label: "Total Eksperimen",
      hint: "Semua eksperimen yang pernah kamu buat",
      Icon: FlaskConical,
      tint: "bg-pink-pale text-pink-ink",
    },
    {
      key: "completed",
      label: "Selesai",
      hint: "Eksperimen yang sudah selesai",
      Icon: CircleCheck,
      tint: "bg-pink-pale text-pink-ink",
    },
    {
      key: "ongoing",
      label: "Sedang Berjalan",
      hint: "Eksperimen yang masih berlangsung",
      Icon: Clock3,
      tint: "bg-pink-pale text-pink-ink",
    },
  ];

  return (
    <>

      <div className="min-h-full space-y-6 text-ink">
        {/* Page heading */}
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-semibold text-pink-ink">
              PERJALANAN BISNISMU
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
              Experiment History
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Lihat eksperimen yang pernah kamu lakukan, pelajari hasilnya,
              dan temukan langkah berikutnya untuk mengembangkan bisnismu.
            </p>
          </div>
        </header>

        {/* Summary cards */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {summary.map(({ key, label, hint, Icon, tint }) => {
            const active = status === key;

            return (
              <button
                key={key}
                type="button"
                onClick={() => setStatus(key)}
                aria-pressed={active}
                className={`min-h-[164px] rounded-2xl border p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  active
                    ? "border-pink-line bg-gradient-to-br from-pink-pale via-white to-blush-soft/50 shadow-sm"
                    : "border-pink-line bg-white hover:border-blush"
                }`}
              >
                <span
                  className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${tint}`}
                >
                  <Icon size={20} />
                </span>

                <p className="text-sm font-medium text-ink-muted">
                  {label}
                </p>

                <p className="mt-1 text-3xl font-bold text-ink-title">
                  {counts[key]}
                </p>

                <p className="mt-2 hidden text-xs text-ink-muted md:block">
                  {hint}
                </p>
              </button>
            );
          })}
        </section>

        {/* Experiment list */}
        <section className="rounded-3xl border border-pink-line bg-white p-5 shadow-sm md:p-6">
          <div>
            <h2 className="text-lg font-bold text-ink-title">
              Daftar Eksperimen
            </h2>

            <p className="mt-1 text-sm text-ink-muted">
              Cari eksperimen atau saring berdasarkan status dan kategori.
            </p>
          </div>

          {/* Search and filters */}
          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <label className="flex min-h-11 flex-1 items-center gap-2 rounded-xl border border-pink-line bg-white px-3 transition focus-within:border-pink-ink focus-within:ring-2 focus-within:ring-pink-ink/10">
              <Search size={17} className="shrink-0 text-ink-muted" />

              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari eksperimen..."
                aria-label="Cari eksperimen"
                className="h-11 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted/70"
              />
            </label>

            {/* Status filter */}
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Filter status"
                className="h-11 w-full appearance-none rounded-xl border border-pink-line bg-white pl-3 pr-10 text-sm text-ink outline-none transition focus:border-pink-ink focus:ring-2 focus:ring-pink-ink/10 lg:w-48"
              >
                <option value="all">Semua Status</option>
                <option value="completed">Selesai</option>
                <option value="ongoing">Berjalan</option>
                <option value="stopped">Dihentikan</option>
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-3.5 text-ink-muted"
              />
            </div>

            {/* Category filter */}
            <div className="relative">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter kategori"
                className="h-11 w-full appearance-none rounded-xl border border-border bg-white pl-3 pr-10 text-sm text-ink outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10 lg:w-52"
              >
                <option value="all">Semua Kategori</option>

                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <ChevronDown
                size={16}
                className="pointer-events-none absolute right-3 top-3.5 text-ink-muted"
              />
            </div>
          </div>

          {/* Table heading */}
          <div className="mb-3 mt-6 flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-ink-title">
              Riwayat Eksperimen
            </h3>

            <span className="rounded-full bg-pink-pale px-3 py-1 text-xs font-semibold text-pink-ink">
              {filtered.length} dari {experiments.length} eksperimen
            </span>
          </div>

          {/* Table columns */}
          <div
            className={`hidden rounded-xl border border-pink-line bg-pink-pale px-4 py-3 text-xs font-semibold text-ink-title md:grid md:items-center md:gap-4 ${GRID_COLS}`}
          >
            <span className="text-center">Nama Eksperimen</span>
            <span className="text-center">Kategori</span>
            <span className="text-center">Periode</span>
            <span className="text-center">Status</span>
            <span className="text-center">Evaluasi</span>
            <span aria-hidden="true" />
          </div>

          {/* Loading state */}
          {loading ? (
            <div className="flex flex-col items-center justify-center py-14">
              <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand/20 border-t-brand" />
              <p className="mt-4 text-sm text-ink-muted">
                Mengambil riwayat eksperimen...
              </p>
            </div>
          ) : error ? (
            /* Error state */
            <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-10 text-center">
              <p className="font-semibold text-red-700">
                Gagal memuat riwayat eksperimen
              </p>

              <p className="mt-2 text-sm text-red-600">
                {error}
              </p>

              <button
                type="button"
                onClick={() => setRetry((prev) => prev + 1)}
                className="mt-4 rounded-xl bg-pink-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-ink/90"
              >
                Coba Lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            /* Empty state */
            <div className="rounded-2xl border border-dashed border-border py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-pale text-pink-ink">
                <FlaskConical size={23} />
              </span>

              <p className="mt-4 font-semibold text-ink-title">
                {experiments.length === 0
                  ? "Belum ada eksperimen"
                  : "Tidak ada eksperimen yang cocok"}
              </p>

              <p className="mx-auto mt-1 max-w-sm px-4 text-sm text-ink-muted">
                {experiments.length === 0
                  ? "Mulai eksperimen pertamamu dari halaman Rekomendasi."
                  : "Coba kata kunci lain atau ubah filter yang kamu pilih."}
              </p>

              {(query || status !== "all" || category !== "all") && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setStatus("all");
                    setCategory("all");
                  }}
                  className="mt-4 rounded-xl bg-pink-ink px-4 py-2 text-sm font-semibold text-white transition hover:bg-pink-ink/90"
                >
                  Reset Filter
                </button>
              )}
            </div>
          ) : (
            /* Experiment rows */
            <div className="mt-3 flex flex-col gap-3 md:mt-0 md:gap-0">
              {filtered.map((exp) => (
                <ExperimentRow key={exp.id} experiment={exp} />
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-ink-muted">
            Data ditampilkan berdasarkan eksperimen yang tersedia.
          </p>
        </section>

        {/* Motivational banner */}
        <section className="relative overflow-hidden rounded-3xl border border-pink-line p-6 md:p-8">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-r from-pink-pale via-white to-lav-pale"
          />

          <div className="relative">
            <span className="inline-flex rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-pink-ink">
              Keep Growing
            </span>

            <p className="mt-3 text-lg font-bold text-ink-title md:text-xl">
              Setiap eksperimen adalah langkah kecil menuju bisnis yang lebih besar.
            </p>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Catat, pelajari, dan gunakan hasilnya untuk mencoba strategi
              berikutnya. Progres kecil tetap berarti.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
