import { assessmentSteps } from "@/lib/constants/assessment-questions";

// Peta label dibuat otomatis dari assessment-questions.js,
// jadi label di Profil selalu sama dengan label yang dilihat user saat assessment.
const OPTIONS_BY_QUESTION = {};

for (const step of assessmentSteps) {
  for (const question of step.questions) {
    if (Array.isArray(question.options)) {
      OPTIONS_BY_QUESTION[question.id] = question.options;
    }
  }
}

// Daftar opsi { value, label } untuk satu pertanyaan (dipakai di dropdown edit).
export function getOptions(questionId) {
  return OPTIONS_BY_QUESTION[questionId] ?? [];
}

// Ubah kode database (contoh: "gt_3y") menjadi label yang disepakati.
// Nilai boleh berupa teks tunggal, teks dipisah koma, atau array.
// Kode yang tidak dikenal ditampilkan apa adanya supaya data tidak hilang.
export function getOptionLabel(questionId, value) {
  if (value === null || value === undefined || value === "") return "";

  const labelByValue = Object.fromEntries(
    getOptions(questionId).map((option) => [option.value, option.label])
  );
  const items = Array.isArray(value) ? value : String(value).split(",");

  return items
    .map((item) => String(item).trim())
    .filter(Boolean)
    .map((item) => labelByValue[item] ?? item)
    .join(", ");
}

// Label Digital Skill sama dengan halaman Realistic Condition.
const DIGITAL_SKILL_LABELS = {
  rendah: "Pemula",
  sedang: "Cukup Memahami",
  tinggi: "Mahir",
};

export function getDigitalSkillLabel(value) {
  if (!value) return "";
  return DIGITAL_SKILL_LABELS[value] ?? value;
}

// Label ukuran tim dari angka yang tersimpan di database.
// Batas kategori: solo = 1, tim kecil = 2 sampai 5, tim besar = lebih dari 5.
export function getTeamLabel(size) {
  const number = Number(size);
  if (size === null || size === undefined || size === "" || !Number.isFinite(number) || number < 1) {
    return "";
  }
  if (number === 1) return "Solo (1 orang)";
  if (number <= 5) return "Tim Kecil (2 sampai 5 orang)";
  return "Tim Besar (lebih dari 5 orang)";
}
