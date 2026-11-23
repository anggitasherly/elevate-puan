// Pengubah hasil mesin rekomendasi menjadi bentuk yang dipakai tampilan Opportunity Library.
const PROBLEM_LABELS = {
  low_awareness: "usahamu belum cukup dikenal calon pelanggan",
  low_conversion: "calon pelanggan belum banyak yang jadi membeli",
  weak_retention: "pelanggan belum banyak yang membeli kembali",
  capacity_limit: "kapasitas operasional usaha terbatas",
  narrow_market: "pasar usahamu masih sempit",
  inconsistent_promo: "promosi usahamu belum konsisten",
  product_stagnation: "produk usahamu belum berkembang",
  weak_finance_habits: "pencatatan dan pengelolaan keuangan usaha belum rapi",
};

const PROBLEM_ICONS = {
  low_awareness: "instagram",
  low_conversion: "bag",
  weak_retention: "whatsapp",
  capacity_limit: "check",
  narrow_market: "chart",
  inconsistent_promo: "instagram",
  product_stagnation: "sparkle",
  weak_finance_habits: "calculator",
};

const SKILL_LABELS = { low: "rendah", medium: "sedang", high: "tinggi" };

function toText(value) {
  if (Array.isArray(value)) return value.filter(Boolean).join(" ");
  return typeof value === "string" ? value.trim() : "";
}

function rupiah(value) {
  if (typeof value !== "number") return null;
  return value === 0 ? "Rp0" : `Rp${value.toLocaleString("id-ID")}`;
}

// Metrik di playbook berisi daftar panjang dipisah titik koma.
// Kotak "Target" cukup menampilkan dua yang pertama agar rapi.
function shortTarget(text) {
  const items = toText(text)
    .split(/[;.]/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (items.length === 0) return "";
  const joined = items.slice(0, 2).join(", ");
  return joined.length > 60 ? items[0] : joined;
}

// Mengubah satu hasil mesin menjadi bentuk yang dipakai komponen tampilan.
export function toStrategy(item) {
  const cost = rupiah(item.cost_estimated);
  return {
    id: item.playbook_id,
    title: item.title,
    description: item.summary || "",
    icon: PROBLEM_ICONS[item.problem_type] || "sparkle",
    duration: "7 Hari",
    cost: cost || "Lihat catatan biaya",
    target: shortTarget(item.narrative?.target || item.metric) || "Sesuai metrik strategi",
    narrativeSource: item.narrative ? "gemini" : "fallback",
    // Rencana 7 hari dari Gemini dipakai bila ada, jika tidak memakai 7 langkah asli playbook.
    day_by_day_plan: Array.isArray(item.narrative?.days)
      ? item.narrative.days.map((day) => `${day.title}. ${day.description}`)
      : Array.isArray(item.steps)
        ? item.steps
        : [],
    raw: item,
  };
}

export function buildNarrative(item) {
  // Narasi dari Gemini dipakai bila ada. Risiko dari Gemini ditambahkan di akhir.
  if (item.narrative?.rationale) {
    const risks = Array.isArray(item.narrative.risks)
      ? item.narrative.risks.filter(Boolean)
      : [];
    return risks.length
      ? `${item.narrative.rationale}\n\nYang perlu diwaspadai: ${risks.join(" ")}`
      : item.narrative.rationale;
  }
  const problem = PROBLEM_LABELS[item.problem_type];
  const skill = SKILL_LABELS[String(item.skill_needed || "").toLowerCase()];
  const cost = rupiah(item.cost_estimated);
  const parts = [];

  if (problem) {
    parts.push(
      `Dari hasil diagnosis, masalah utama usahamu saat ini adalah ${problem}. Strategi ini dipilih karena memang ditujukan untuk masalah tersebut.`
    );
  }

  const facts = [];
  if (item.time_needed) facts.push(`waktu sekitar ${item.time_needed}`);
  if (cost) facts.push(`biaya ${cost}`);
  if (skill) facts.push(`keahlian digital ${skill}`);
  if (facts.length) {
    parts.push(
      `Kebutuhannya ${facts.join(", ")}, dan masih sesuai dengan waktu, tim, keahlian, serta anggaran yang kamu isi.`
    );
  }

  if (toText(item.risks)) {
    parts.push(`Yang perlu diwaspadai: ${toText(item.risks)}`);
  }
  return parts.join("\n\n");
}

// Mengubah satu rekomendasi menjadi data yang disimpan ke solution_proposals.
// Rencana 7 hari memakai hasil Gemini bila ada, jika tidak memakai 7 langkah asli playbook.
export function toProposalPayload(item) {
  const steps = Array.isArray(item.steps) ? item.steps : [];
  const days = Array.isArray(item.narrative?.days)
    ? item.narrative.days
    : steps.map((step, index) => ({
        day: index + 1,
        title: `Hari ${index + 1}`,
        description: step,
      }));

  const metricList = toText(item.metric)
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean);

  const risks = Array.isArray(item.narrative?.risks) && item.narrative.risks.length
    ? item.narrative.risks
    : toText(item.risks)
      ? [toText(item.risks)]
      : [];

  const target = item.narrative?.target || metricList[0] || "";

  return {
    playbook_id: item.playbook_id,
    title: item.title,
    description: item.summary || item.title,
    rationale: item.narrative?.rationale || null,
    problem_addressed: PROBLEM_LABELS[item.problem_type] || null,
    hypothesis: target
      ? `Jika strategi "${item.title}" dijalankan selama 7 hari, kamu bisa mengamati: ${target}`
      : null,
    steps,
    est_cost: typeof item.cost_estimated === "number" ? item.cost_estimated : 0,
    risks,
    success_metrics: metricList,
    days,
  };
}
