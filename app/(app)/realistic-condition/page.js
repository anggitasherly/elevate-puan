
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  UsersRound,
  MonitorSmartphone,
  Sparkles,
  CheckCircle2,
  ArrowRight,
} from "lucide-react";

const STORAGE_KEY = "elevate_realistic_condition";

const questions = [
  {
    key: "availableTime",
    label: "Berapa banyak waktu yang bisa kamu luangkan tiap minggu?",
    icon: Clock3,
    options: ["<5 jam", "5–10 jam", ">10 jam"],
  },
  {
    key: "teamSupport",
    label: "Tim / Pendukung",
    icon: UsersRound,
    options: ["Saya Sendiri (Solo)", "Tim Kecil", "Tim Besar"],
  },
  {
    key: "digitalSkill",
    label: "Bagaimana kemampuan pemasaran digitalmu saat ini?",
    icon: MonitorSmartphone,
    options: ["Pemula", "Cukup Memahami", "Mahir"],
  },
];

const initialAnswers = {
  availableTime: "",
  teamSupport: "",
  digitalSkill: "",
};

export default function RealisticConditionPage() {
  const router = useRouter();

  const [answers, setAnswers] = useState(initialAnswers);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadConstraints() {
      try {
        const response = await fetch("/api/constraints", {
          method: "GET",
          cache: "no-store",
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.message || "Gagal memuat Constraints.");
        }

        const saved = result.constraints?.details?.realistic_condition;

        const timeMap = {
          under_5_hours: "<5 jam",
          "5_to_10_hours": "5–10 jam",
          over_10_hours: ">10 jam",
        };

        const teamMap = {
          solo: "Saya Sendiri (Solo)",
          small_team: "Tim Kecil",
          large_team: "Tim Besar",
        };

        const skillMap = {
          rendah: "Pemula",
          sedang: "Cukup Memahami",
          tinggi: "Mahir",
        };

        if (active && saved) {
          setAnswers({
            availableTime: timeMap[saved.available_time] || "",
            teamSupport: teamMap[saved.team_support] || "",
            digitalSkill: skillMap[saved.digital_skill] || "",
          });
        }
      } catch (err) {
        console.error("Gagal memuat Constraints:", err);

        if (active) {
          setError(err.message || "Gagal memuat kondisi usaha.");
        }
      } finally {
        if (active) setReady(true);
      }
    }

    loadConstraints();

    return () => {
      active = false;
    };
  }, []);

  const answeredCount = questions.filter(
    (question) => Boolean(answers[question.key])
  ).length;

  const isComplete = answeredCount === questions.length;

  function selectAnswer(key, value) {
    setAnswers((current) => ({
      ...current,
      [key]: value,
    }));

    setError("");
  }

  async function handleContinue() {
    if (!isComplete || saving) {
      if (!isComplete) {
        setError("Lengkapi ketiga pertanyaan terlebih dahulu.");
      }
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/constraints", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(answers),
      });

      const result = await response.json();

      if (!response.ok || !result.success || !result.persisted) {
        throw new Error(
          result.message || "Jawaban belum berhasil disimpan."
        );
      }

      router.push("/opportunity-library");
    } catch (err) {
      console.error("Gagal menyimpan Constraints:", err);
      setError(
        err.message || "Gagal menyimpan jawaban. Silakan coba lagi."
      );
    } finally {
      setSaving(false);
    }
  }
  if (!ready) {
    return (
      <div className="min-h-full space-y-6 text-ink">
        <div className="p-8 text-center text-ink-muted">
          Memuat kondisi usahamu...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-6 text-ink">
      {/*
        DashboardLayout sudah memiliki padding dan breadcrumb.

        -mt-3 mengurangi jarak bawaan breadcrumb.
        -mx-5 sm:-mx-7 menetralkan padding horizontal PageShell.
        w-full membuat panel mengikuti lebar area konten.
      */}
      <div className="relative space-y-6 pb-6">

        {/* DEKORASI LATAR BELAKANG */}
        <div className="pointer-events-none absolute -left-10 top-32 h-64 w-64 rounded-full bg-amber-100/40 blur-3xl" />
        <div className="pointer-events-none absolute -right-8 top-8 h-64 w-64 rounded-full bg-pink-100/50 blur-3xl" />

        {/* PANEL UTAMA */}
        <section className="relative w-full rounded-3xl border border-pink-line bg-white p-5 shadow-sm md:p-6">

          {/* JUDUL HALAMAN */}
          <header className="mb-8">
            <p className="mb-2 text-sm font-semibold text-pink-ink">
              KONDISI USAHA
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
              Kondisi Nyata Usahamu
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Ceritakan waktu, tenaga, dan kemampuan yang kamu punya saat ini
              agar rekomendasi eksperimen sesuai dengan kondisimu.
            </p>
          </header>

          {/* PERTANYAAN */}
          <div className="space-y-6">
            {questions.map((question) => {
              const QuestionIcon = question.icon;

              return (
                <section key={question.key}>
                  <h2 className="mb-3 flex items-center gap-2.5 text-sm font-bold text-ink-title">
                    <QuestionIcon
                      size={18}
                      strokeWidth={1.8}
                      className="shrink-0 text-pink-ink"
                      aria-hidden="true"
                    />
                    {question.label}
                  </h2>

                  <div className="grid gap-2 sm:grid-cols-3">
                    {question.options.map((option) => {
                      const selected =
                        answers[question.key] === option;

                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={selected}
                          onClick={() =>
                            selectAnswer(question.key, option)
                          }
                          className={`min-h-10 rounded-xl border px-3 py-2 text-center text-[13px] font-medium transition-all ${
                            selected
                              ? "border-pink-ink bg-pink-pale font-semibold text-pink-ink shadow-sm"
                              : "border-lav-line bg-white text-ink-muted hover:border-pink-line hover:bg-pink-pale/60"
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          {/* PEMBATAS */}
          <div className="my-9 flex items-center gap-4">
            <div className="h-px flex-1 bg-purple-100" />
            <Sparkles
              size={19}
              strokeWidth={1.6}
              className="text-purple-300"
              aria-hidden="true"
            />
            <div className="h-px flex-1 bg-purple-100" />
          </div>

          {/* CONSTRAINT SNAPSHOT */}
          <section className="rounded-3xl bg-gradient-to-br from-pink-50 via-white to-fuchsia-50 p-5 sm:p-7">

            <div className="mb-5 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-pink-100 text-pink-600">
                <Sparkles
                  size={24}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              </div>

              <div>
                <h2 className="text-2xl font-bold text-ink-title">
                  Constraint Snapshot
                </h2>

                <p className="mt-1 text-sm text-ink-muted">
                  Ringkasan kondisi dan keterbatasan utama
                  bisnismu saat ini.
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-dashed border-purple-200 bg-white/80 p-5">
              {!isComplete ? (
                <div className="py-4 text-center">
                  <p className="text-sm text-ink-muted">
                    Jawab seluruh pertanyaan untuk menampilkan
                    Constraint Snapshot.
                  </p>

                  <p className="mt-2 text-sm font-bold text-purple-700">
                    {answeredCount} dari 3 pertanyaan terisi
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-5 sm:grid-cols-3">
                    <SnapshotItem
                      icon={Clock3}
                      label="Waktu Tersedia"
                      value={answers.availableTime}
                    />

                    <SnapshotItem
                      icon={UsersRound}
                      label="Dukungan Tim"
                      value={answers.teamSupport}
                    />

                    <SnapshotItem
                      icon={MonitorSmartphone}
                      label="Kemampuan Digital"
                      value={answers.digitalSkill}
                    />
                  </div>

                  <div className="mt-6 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-xs font-bold text-emerald-700">
                      <CheckCircle2
                        size={15}
                        aria-hidden="true"
                      />
                      3 dari 3 pertanyaan terisi
                    </span>
                  </div>
                </>
              )}
            </div>
          </section>

          {/* PESAN ERROR */}
          {error && (
            <p
              role="alert"
              className="mt-5 rounded-xl bg-red-50 p-3 text-center text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {/* TOMBOL LANJUT */}
          <div className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={handleContinue}
              disabled={!isComplete || saving}
              className="flex w-full max-w-2xl items-center justify-center gap-2 rounded-full bg-gradient-to-r from-purple-400 via-fuchsia-400 to-pink-400 px-6 py-4 text-sm font-bold text-white shadow-lg shadow-purple-100 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50 sm:text-base"
            >
              Simpan dan Lanjut ke Rekomendasi Strategi AI
              <ArrowRight
                size={18}
                aria-hidden="true"
              />
            </button>
          </div>

        </section>
      </div>
    </div>
  );
}

function SnapshotItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-pink-50 text-pink-500">
        <Icon
          size={21}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </span>

      <div>
        <p className="text-xs text-ink-muted">
          {label}
        </p>

        <p className="mt-1 text-sm font-bold text-purple-800">
          {value}
        </p>
      </div>
    </div>
  );
}
