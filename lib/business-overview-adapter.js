//import { mapBusinessOpportunities } from './business-opportunity-mapper.js';
import { explainDiagnosis } from './diagnosis-explanation.js';
import { buildClarificationChoices } from "@/lib/diagnosis-clarification";

const PROBLEM_LABELS = {
  low_awareness: "Kesadaran Calon Pelanggan Masih Rendah",
  low_conversion: "Konversi Penjualan Rendah",
  weak_retention: "Pembelian Ulang Pelanggan Masih Rendah",
  capacity_limit: "Kapasitas Operasional Terbatas",
  narrow_market: "Jangkauan Pasar Terbatas",
  inconsistent_promo: "Promosi Belum Konsisten",
  product_stagnation: "Pengembangan Produk Belum Optimal",
  weak_finance_habits: "Pengelolaan Keuangan Perlu Diperbaiki",
};

const CONFIDENCE_REASONS = {
  high: "Beberapa jawaban saling mendukung hasil diagnosis ini.",
  medium: "Ada indikasi masalah, tetapi bukti yang tersedia masih terbatas.",
  low: "Informasi yang tersedia belum cukup kuat untuk memastikan masalah utama.",
  none: "Belum tersedia cukup informasi untuk menentukan tingkat keyakinan.",
};

const FIELD_LABELS = {
  viewer_behavior: "Perilaku calon pelanggan",
  biggest_challenge: "Tantangan utama usaha",
  repeat_frequency: "Frekuensi pembelian ulang",
  order_surge: "Kemampuan menangani lonjakan pesanan",
  sales_trend_3m: "Tren penjualan tiga bulan terakhir",
  operational_obstacles: "Hambatan operasional",
  main_customers: "Kelompok pelanggan",
  sales_sources: "Saluran penjualan",
  acquisition_activities: "Aktivitas pemasaran",
  story_text: "Cerita kondisi usaha",
};

const VALUE_LABELS = {
  many_view_few_ask: "Banyak yang melihat, tetapi sedikit yang bertanya",
  many_ask_few_buy: "Banyak yang bertanya, tetapi sedikit yang membeli",
  ask_then_some_buy: "Sebagian yang bertanya akhirnya membeli",
  buy_directly: "Calon pelanggan cenderung langsung membeli",
  rarely: "Jarang terjadi pembelian ulang",
  sometimes: "Pembelian ulang terjadi sesekali",
  often: "Pembelian ulang cukup sering",
  almost_always: "Pembelian ulang sangat sering",
  decreasing: "Penjualan menurun",
  stable: "Penjualan relatif stabil",
  fluctuating: "Penjualan naik turun",
  increasing: "Penjualan meningkat",
  starting_overwhelmed: "Mulai kewalahan saat pesanan meningkat",
  often_overwhelmed: "Sering kewalahan saat pesanan meningkat",
};

function readableValue(value) {
  if (Array.isArray(value)) {
    return value.map(readableValue).join(", ");
  }

  if (value === null || value === undefined) {
    return "Belum tersedia";
  }

  if (typeof value !== "string" && typeof value !== "number") {
    return "Data tersedia";
  }

  return VALUE_LABELS[value] ?? String(value).replaceAll("_", " ");
}

function formatSignal(signal) {
  if (!signal || typeof signal !== "object") return null;

  const field = FIELD_LABELS[signal.source_field]
    ?? signal.source_field
    ?? "Informasi assessment";

  return `${field}: ${readableValue(signal.value)}.`;
}

export function adaptBusinessDiagnosis(rawDiagnosis) {
  const raw =
    rawDiagnosis &&
    typeof rawDiagnosis === "object" &&
    !Array.isArray(rawDiagnosis)
      ? rawDiagnosis
      : {};

  const status = [
    "diagnosed",
    "needs_clarification",
    "undetermined",
  ].includes(raw.diagnosis_status)
    ? raw.diagnosis_status
    : "undetermined";

  const problem = raw.primary_problem;
  const problemCode = problem?.problem_type;

  const confidenceLevel = [
    "high",
    "medium",
    "low",
    "none",
  ].includes(raw.confidence)
    ? raw.confidence
    : "none";

  const contributingProblems = Array.isArray(raw.contributing_problems)
    ? raw.contributing_problems
    : [];

  const explanation = explainDiagnosis(raw);
  return {
    status,
    primaryProblem: explanation.primaryProblem,
    confidence: explanation.confidence,
    evidence: explanation.evidence,

    contributingProblems: contributingProblems.map((item) => ({
      code: item.problem_type,
      title: PROBLEM_LABELS[item.problem_type]
        ?? "Masalah Bisnis Lainnya",
      description: item.reason ?? "",
    })),

    clarificationQuestion:
      typeof raw.clarification_question === "string"
        ? raw.clarification_question
        : null,

    needsClarification: status === "needs_clarification",
    clarification:
      status === "needs_clarification" &&
      typeof raw.clarification_field === "string"
        ? {
            field: raw.clarification_field,
            choices: buildClarificationChoices(
              raw.clarification_field,
              raw.clarification_options,
              raw.clarification_option_labels
            ),
            round: Number.isInteger(raw.clarification_round)
              ? raw.clarification_round
              : 0,
          }
        : null,

    missingInformation: Array.isArray(raw.missing_information)
      ? raw.missing_information.filter((item) => typeof item === "string")
      : [],

    otherProblems: Array.isArray(raw.other_detected_problems)
      ? raw.other_detected_problems
          .filter((item) => PROBLEM_LABELS[item?.problem_type])
          .map((item) => ({
            code: item.problem_type,
            title: PROBLEM_LABELS[item.problem_type],
          }))
      : [],

    // Peluang hanya muncul jika didukung bukti primer diagnosis.
//    opportunities: mapBusinessOpportunities(raw),
  };
}


export function buildOverviewMetrics(diagnosis) {
  if (!diagnosis || diagnosis.status !== "diagnosed") {
    return [];
  }

  const primary = diagnosis.primaryProblem;
  const contributing = diagnosis.contributingProblems ?? [];

  if (!primary?.code) {
    return [];
  }

  const totalProblems = 1 + contributing.length;

  return [
    {
      label: "Hal yang Perlu Diperhatikan",
      value: `${totalProblems} Masalah`,
      detail: "Ini jumlah hal yang terlihat perlu mendapat perhatian dari jawabanmu.",
      icon: "experiment",
      tone: "pink",
    },
    {
      label: "Prioritas Utama",
      value: primary.title,
      detail: primary.description,
      icon: "wallet",
      tone: "green",
    },
    {
      label: "Hal Lain yang Perlu Diperhatikan",
      value: contributing.length > 0
        ? contributing.map((item) => item.title).join(", ")
        : "Tidak Ada Masalah Tambahan",
      detail: contributing.length > 0
        ? "Selain fokus utama, ada hal lain yang juga bisa kamu perhatikan secara bertahap."
        : "Untuk saat ini, belum terlihat masalah tambahan yang perlu kamu prioritaskan.",
      icon: "chart",
      tone: "purple",
    },
    /* Kartu "Fokus Perbaikan" disembunyikan sementara (isinya sama dengan Prioritas Utama)
    {
      label: "Fokus Perbaikan",
      value: primary.title,
      detail: "Bagian usaha yang paling baik kamu perhatikan lebih dulu, sesuai hasil jawabanmu.",
      icon: "star",
      tone: "yellow",
    },
    */
  ];
}
