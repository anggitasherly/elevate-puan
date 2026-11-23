"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion } from "lucide-react";

const DIAGNOSIS_URL = "/api/diagnosis";
const MAX_ROUNDS = 2;

// Panel pertanyaan klarifikasi. Jawaban dikirim ke /api/diagnosis,
// lalu halaman dimuat ulang agar hasil terbaru tampil.
export default function ClarificationPanel({
  question,
  clarification,
  assessmentId,
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choices = Array.isArray(clarification?.choices)
    ? clarification.choices
    : [];
  const round = Number.isInteger(clarification?.round)
    ? clarification.round
    : 0;
  const canAnswer = Boolean(
    assessmentId && clarification?.field && choices.length > 0
  );

  async function answer(value) {
    if (busy || !canAnswer) return;
    setBusy(true);
    setError("");

    try {
      const res = await fetch(DIAGNOSIS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessmentId,
          clarification: { field: clarification.field, value },
        }),
      });

      if (!res.ok) {
        let message = "Jawabanmu belum bisa dikirim. Coba lagi sebentar lagi.";
        try {
          const data = await res.json();
          if (typeof data?.error === "string") message = data.error;
        } catch {
          // Biarkan pesan bawaan.
        }
        throw new Error(message);
      }

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Jawabanmu belum bisa dikirim. Coba lagi sebentar lagi."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="rounded-3xl border border-pink-line bg-lav-pale/40 p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <div className="shrink-0 rounded-2xl bg-white p-3 text-brand">
          <MessageCircleQuestion size={24} />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-ink-title">
            Boleh Cerita Sedikit Lagi?
          </h3>

          <p className="mt-3 leading-7 text-ink-muted">
            Ada satu hal yang ingin kami pahami lebih jauh supaya saran
            berikutnya lebih sesuai dengan usahamu.
          </p>

          <div className="mt-5 rounded-2xl border border-pink-line bg-white p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-brand">
              Pertanyaan {Math.min(round + 1, MAX_ROUNDS)} dari {MAX_ROUNDS}
            </p>

            <p className="mt-2 text-sm font-semibold leading-6 text-ink-title">
              {question ??
                "Boleh bantu kami melengkapi informasi tentang usahamu?"}
            </p>

            {canAnswer ? (
              <div className="mt-4 flex flex-col gap-2">
                {choices.map((choice) => (
                  <button
                    key={choice.value}
                    type="button"
                    disabled={busy}
                    onClick={() => answer(choice.value)}
                    className="rounded-xl border border-lav-line bg-white px-4 py-3 text-left text-sm font-medium text-ink-title transition hover:border-brand hover:bg-lav-pale disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {choice.label}
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-xs leading-5 text-ink-muted">
                Jawaban belum bisa dikirim dari halaman ini.{" "}
                <Link
                  href="/assessment"
                  className="font-semibold text-brand underline"
                >
                  Buka Assessment
                </Link>{" "}
                untuk melengkapi jawabanmu.
              </p>
            )}

            {busy && (
              <p className="mt-3 text-xs text-ink-muted" role="status">
                Mengirim jawabanmu...
              </p>
            )}

            {error && (
              <p className="mt-3 text-xs text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
