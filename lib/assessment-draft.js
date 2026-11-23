import { assessmentSteps } from "@/lib/constants/assessment-questions";

// Isian yang disimpan di tabel businesses. Isian lain disimpan di tabel assessment.
// Kiri: id pertanyaan di formulir. Kanan: nama kolom di tabel businesses.
const BUSINESS_COLUMNS = {
  business_category: "category",
  business_age: "business_age",
  business_description: "business_description",
};

// Batas panjang teks. Sesuaikan kalau kolom teks di formulir punya batas berbeda.
const MAX_TEXT = 500;
const MAX_STORY = 2000;

// Semua pertanyaan dikumpulkan dari file pertanyaan, jadi pilihan yang sah
// selalu mengikuti assessment-questions.js (satu sumber kebenaran).
const QUESTIONS = new Map(
  assessmentSteps.flatMap((step) => step.questions).map((q) => [q.id, q])
);

// Kolom yang dibaca dari database saat memuat jawaban lama.
export const BUSINESS_SELECT = ["id", ...Object.values(BUSINESS_COLUMNS)].join(",");
export const ASSESSMENT_SELECT = [
  "id",
  "status",
  "story_text",
  ...[...QUESTIONS.keys()].filter((id) => !BUSINESS_COLUMNS[id]),
].join(",");

function fail(message) {
  return { error: message };
}

// Memeriksa satu jawaban dan mengubahnya ke bentuk yang disimpan di database.
function cleanAnswer(question, raw) {
  const allowed = (question.options ?? []).map((o) => o.value);

  if (question.type === "select") {
    if (raw === null || raw === "") return { value: null };
    if (typeof raw !== "string" || !allowed.includes(raw))
      return fail("Pilihan tidak valid.");
    return { value: raw };
  }

  if (question.type === "chips") {
    if (raw === null) return { value: null };
    if (!Array.isArray(raw)) return fail("Pilihan tidak valid.");
    const unique = [...new Set(raw)];
    if (unique.some((v) => typeof v !== "string" || !allowed.includes(v)))
      return fail("Pilihan tidak valid.");
    const exclusive = question.exclusive ?? [];
    if (unique.length > 1 && unique.some((v) => exclusive.includes(v)))
      return fail("Pilihan tidak valid.");
    // Pilihan ganda disimpan sebagai teks dipisah koma, contoh: pre_order,custom_order
    return { value: unique.length ? unique.join(",") : null };
  }

  if (question.type === "text") {
    if (raw === null) return { value: null };
    if (typeof raw !== "string") return fail("Isian tidak valid.");
    const text = raw.trim().slice(0, MAX_TEXT);
    return { value: text || null };
  }

  return fail("Pertanyaan tidak didukung.");
}

// Menerima isi permintaan dari browser: { answers: {...}, story: "..." }
// Hanya isian yang dikirim yang diproses, jadi draf sebagian aman.
// Hasil: { business, assessment } berisi kolom yang siap ditulis, atau { error }.
export function parseDraft(body) {
  if (!body || typeof body !== "object") return fail("Permintaan tidak valid.");

  const answers = body.answers ?? {};
  if (typeof answers !== "object" || Array.isArray(answers))
    return fail("Permintaan tidak valid.");

  const business = {};
  const assessment = {};

  for (const [id, raw] of Object.entries(answers)) {
    const question = QUESTIONS.get(id);
    if (!question) return fail("Pertanyaan tidak dikenal.");

    const result = cleanAnswer(question, raw);
    if (result.error) return result;

    if (BUSINESS_COLUMNS[id]) business[BUSINESS_COLUMNS[id]] = result.value;
    else assessment[id] = result.value;
  }

  if (body.story !== undefined) {
    if (body.story !== null && typeof body.story !== "string")
      return fail("Cerita tidak valid.");
    const story = (body.story ?? "").trim().slice(0, MAX_STORY);
    assessment.story_text = story || null;
  }

  return { business, assessment };
}

// Mengubah satu nilai dari database ke bentuk state formulir.
// Nilai yang tidak dikenal (misalnya data lama berupa teks label) dianggap belum dijawab.
function fromStored(question, stored) {
  const allowed = (question.options ?? []).map((o) => o.value);

  if (question.type === "chips") {
    return stored ? stored.split(",").filter((v) => allowed.includes(v)) : [];
  }
  if (question.type === "text") return stored ?? "";
  return allowed.includes(stored) ? stored : null;
}

// Membentuk jawaban untuk formulir dari baris businesses dan baris assessment (draf).
export function toAnswers(businessRow, draftRow) {
  const answers = {};
  for (const [id, question] of QUESTIONS) {
    const column = BUSINESS_COLUMNS[id];
    const stored = column ? businessRow?.[column] : draftRow?.[id];
    answers[id] = fromStored(question, stored);
  }
  return { answers, story: draftRow?.story_text ?? "" };
}

// Daftar id pertanyaan yang belum terjawab. Dipakai sebelum pengiriman akhir.
// Nilai lama yang tidak dikenal (misalnya label teks) ikut dihitung belum terjawab.
export function findMissing(businessRow, draftRow) {
  const { answers } = toAnswers(businessRow, draftRow);
  return [...QUESTIONS.values()]
    .filter((q) => {
      const value = answers[q.id];
      if (q.type === "chips") return value.length === 0;
      if (q.type === "text") return !value || !value.trim();
      return !value;
    })
    .map((q) => q.id);
}