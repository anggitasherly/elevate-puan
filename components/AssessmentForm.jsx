"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import AssessmentHeader from "@/components/assessment/AssessmentHeader";
import InfoCard from "@/components/assessment/InfoCard";
import QuestionField from "@/components/assessment/QuestionField";
import Stepper from "@/components/assessment/Stepper";
import StoryBox from "@/components/assessment/StoryBox";
import { assessmentSteps, assessmentUi } from "@/lib/constants/assessment-questions";

const DRAFT_URL = "/api/assessment/draft";
const SUBMIT_URL = "/api/assessment/submit";
const DIAGNOSIS_URL = "/api/diagnosis";
const ANALYZING_TEXT = "Menganalisis jawabanmu...";
const ANALYZING_NOTE =
  "Sedang menganalisis jawabanmu. Mohon tunggu sebentar dan jangan tutup halaman ini.";
const DIAGNOSIS_FAILED =
  "Jawabanmu sudah tersimpan, tapi analisisnya belum berhasil. Coba lagi sebentar lagi.";
const RETRY_TEXT = "Coba analisis lagi";

// Nilai awal: pilihan ganda berupa daftar kosong, teks berupa "", pilihan tunggal null.
const initialAnswers = Object.fromEntries(
  assessmentSteps
    .flatMap((s) => s.questions)
    .map((q) => [q.id, q.type === "chips" ? [] : q.type === "text" ? "" : null])
);

function toggleChip(question, current, val) {
  const exclusive = question.exclusive ?? [];
  if (current.includes(val)) return current.filter((v) => v !== val);
  if (exclusive.includes(val)) return [val];
  return [...current.filter((v) => !exclusive.includes(v)), val];
}

// Satu aturan "belum dijawab" untuk semua jenis pertanyaan.
function isEmpty(question, value) {
  if (question.type === "chips") return !value || value.length === 0;
  if (question.type === "text") return !value || !String(value).trim();
  return !value;
}

// Langkah pertama yang masih punya pertanyaan kosong. Kalau semua terjawab: langkah terakhir.
function firstOpenStep(answers) {
  const index = assessmentSteps.findIndex((s) =>
    s.questions.some((q) => isEmpty(q, answers[q.id]))
  );
  return index === -1 ? assessmentSteps.length - 1 : index;
}

export default function AssessmentForm() {
  const router = useRouter();
  const [loadState, setLoadState] = useState("loading"); // loading | ready | error
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState(initialAnswers);
  const [story, setStory] = useState("");
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [submittedId, setSubmittedId] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);

  const step = assessmentSteps[stepIndex];

  // Memuat jawaban yang sudah tersimpan, lalu lanjut dari langkah yang masih kosong.
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        const res = await fetch(DRAFT_URL);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.json();
        if (ignore) return;

        const merged = { ...initialAnswers, ...data.answers };
        setAnswers(merged);
        setStory(data.story ?? "");
        setStepIndex(firstOpenStep(merged));
        setLoadState("ready");
      } catch {
        if (!ignore) setLoadState("error");
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, []);

  function handleChange(question, val) {
    const next =
      question.type === "chips"
        ? toggleChip(question, answers[question.id], val)
        : val;
    setAnswers((prev) => ({ ...prev, [question.id]: next }));
    setErrors((prev) => {
      if (!prev[question.id]) return prev;
      const rest = { ...prev };
      delete rest[question.id];
      return rest;
    });
  }

  function validateStep() {
    const found = {};
    for (const q of step.questions) {
      if (!isEmpty(q, answers[q.id])) continue;
      if (q.type === "select") found[q.id] = "Pilih salah satu jawaban.";
      if (q.type === "chips") found[q.id] = "Pilih minimal satu jawaban.";
      if (q.type === "text") found[q.id] = "Isian ini wajib diisi.";
    }
    return found;
  }

  function goToStep(i) {
    setStepIndex(i);
    setErrors({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Menyimpan jawaban langkah yang sedang tampil. Hanya langkah ini yang dikirim,
  // supaya jawaban di langkah lain tidak tertimpa. Hasil: true kalau berhasil.
  async function saveStep(targetStep) {
    if (saving) return false;
    setSaving(true);
    setSaveError("");
    try {
      const payload = { answers: {} };
      for (const q of targetStep.questions) payload.answers[q.id] = answers[q.id];
      if (targetStep.hasStory) payload.story = story;

      const res = await fetch(DRAFT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(String(res.status));
      return true;
    } catch {
      setSaveError(assessmentUi.saveFailed);
      return false;
    } finally {
      setSaving(false);
    }
  }

  // Pengiriman akhir: server memeriksa semua pertanyaan sudah terisi, lalu mengubah
  // status dari draft menjadi submitted. Hasil: id assessment kalau berhasil, null kalau gagal.
  async function submitAssessment() {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(SUBMIT_URL, { method: "POST" });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (!data.assessment_id) throw new Error("assessment_id kosong");
      return data.assessment_id;
    } catch {
      setSaveError(assessmentUi.submitFailed);
      return null;
    } finally {
      setSaving(false);
    }
  }

  // Meminta server menganalisis jawaban yang sudah terkirim. Hasil: true kalau berhasil.
  // Kalau berhasil, status "menganalisis" sengaja dibiarkan menyala sampai halaman pindah.
  async function runDiagnosis(assessmentId) {
    setAnalyzing(true);
    setSaveError("");
    try {
      const res = await fetch(DIAGNOSIS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assessment_id: assessmentId }),
      });
      if (!res.ok) throw new Error(String(res.status));
      return true;
    } catch {
      setSaveError(DIAGNOSIS_FAILED);
      setAnalyzing(false);
      return false;
    }
  }

  async function handleNext() {
    // Assessment sudah terkirim tapi diagnosis gagal: cukup ulangi diagnosisnya.
    if (submittedId) {
      if (await runDiagnosis(submittedId)) router.push("/business-overview");
      return;
    }

    const found = validateStep();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      const firstId = step.questions.find((q) => found[q.id]).id;
      document
        .getElementById(`q-${firstId}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (!(await saveStep(step))) return;

    if (stepIndex === assessmentSteps.length - 1) {
      const id = await submitAssessment();
      if (!id) return;
      setSubmittedId(id);
      if (!(await runDiagnosis(id))) return;
      router.push("/business-overview");
      return;
    }
    goToStep(stepIndex + 1);
  }

  async function handleBack() {
    if (!(await saveStep(step))) return;
    goToStep(stepIndex - 1);
  }

  async function handleSaveExit() {
    if (analyzing) return;
    if (submittedId) {
      router.push("/home");
      return;
    }
    if (!(await saveStep(step))) return;
    router.push("/home");
  }

  // Header dan formulir baru tampil setelah jawaban lama selesai dimuat,
  // supaya tombol "Simpan & keluar" tidak menyimpan formulir kosong.
  if (loadState === "loading") {
    return (
      <p className="py-24 text-center text-sm text-ink-muted">
        {assessmentUi.loading}
      </p>
    );
  }

  if (loadState === "error") {
    return (
      <div className="py-24 text-center">
        <p className="text-sm text-ink-muted">{assessmentUi.loadFailed}</p>
        <Button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-4 h-11 rounded-full bg-linear-to-r from-cta-from to-cta-to px-6 text-[15px] font-bold hover:opacity-90"
        >
          {assessmentUi.reload}
        </Button>
      </div>
    );
  }

  return (
    <>
      <AssessmentHeader onSaveExit={handleSaveExit} />

      <div className="mx-auto max-w-307 px-4 pb-10 sm:px-6">
        <div className="py-5">
          <Stepper steps={assessmentSteps} current={stepIndex} />
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18.5rem] lg:items-start lg:gap-x-14">
          <div className="lg:col-start-1 lg:row-start-1 lg:max-w-2xl">
            <h1 className="text-[28px] font-extrabold leading-tight tracking-tight text-ink-title sm:text-[32px]">
              {step.title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-muted">{step.subtitle}</p>
          </div>

          <aside className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <InfoCard text={step.why} />
          </aside>

          <div className="lg:col-start-1 lg:row-start-2 lg:max-w-2xl">
            <div className="space-y-5">
              {step.questions.map((q) => (
                <QuestionField
                  key={q.id}
                  question={q}
                  value={answers[q.id]}
                  onChange={(val) => handleChange(q, val)}
                  error={errors[q.id]}
                />
              ))}
            </div>

            {step.hasStory && (
              <div className="mt-6">
                <StoryBox value={story} onChange={setStory} />
              </div>
            )}

            {saveError && (
              <p role="alert" className="mt-5 text-sm font-medium text-destructive">
                {saveError}
              </p>
            )}

            {analyzing && (
              <p role="status" className="mt-5 text-sm text-ink-muted">
                {ANALYZING_NOTE}
              </p>
            )}

            <div className="mt-6 flex items-center justify-between border-t border-brand-soft pt-5">
              {stepIndex > 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving || analyzing || !!submittedId}
                  onClick={handleBack}
                  className="h-11 rounded-full border-lav-line bg-white px-6 text-[15px] font-bold text-brand-deep hover:bg-lav-pale"
                >
                  {assessmentUi.back}
                </Button>
              ) : (
                <span />
              )}
              <Button
                type="button"
                disabled={saving || analyzing}
                onClick={handleNext}
                className="h-11 gap-2 rounded-full bg-linear-to-r from-cta-from to-cta-to px-6 text-[15px] font-bold shadow-lg shadow-cta-to/30 hover:opacity-90"
              >
                {analyzing ? ANALYZING_TEXT : submittedId ? RETRY_TEXT : step.next}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}