import "server-only";
import { toProposalPayload } from "@/lib/recommendation/strategy-adapter";

// Menyimpan hasil rekomendasi ke solution_proposals, seluruhnya di sisi server.
// Isi yang disimpan berasal dari hasil mesin dan narasi AI di server, bukan dari browser.
// Rekomendasi dengan judul yang sama (masih proposed) dipakai ulang, tidak disimpan dua kali.

const isText = (value, max) =>
  typeof value === "string" && value.trim().length > 0 && value.length <= max;

const cleanList = (value, maxItems, maxLength = 600) =>
  (Array.isArray(value) ? value : [])
    .filter((item) => isText(item, maxLength))
    .map((item) => item.trim())
    .slice(0, maxItems);

// Setiap hari wajib punya judul dan deskripsi (dibaca halaman eksperimen),
// dan tetap memuat checklist agar kompatibel dengan format lama.
export function buildDailyPlan(days) {
  if (!Array.isArray(days) || days.length !== 7) return null;

  const result = [];
  for (let index = 0; index < 7; index++) {
    const item = days[index];
    if (
      !item ||
      Number(item.day) !== index + 1 ||
      !isText(item.title, 160) ||
      !isText(item.description, 600)
    ) {
      return null;
    }
    result.push({
      day: index + 1,
      title: item.title.trim(),
      description: item.description.trim(),
      checklists: [{ id: `d${index + 1}-1`, activity: item.description.trim() }],
    });
  }
  return { days: result };
}

function prepare(item) {
  const payload = toProposalPayload(item);
  const plan = buildDailyPlan(payload.days);
  if (!plan || !isText(payload.title, 300) || !isText(payload.description, 2000)) return null;

  const estCost = Number(payload.est_cost);
  return {
    playbook_id: String(payload.playbook_id),
    title: payload.title.trim(),
    description: payload.description.trim(),
    rationale: isText(payload.rationale, 4000) ? payload.rationale.trim() : null,
    problem_addressed: isText(payload.problem_addressed, 1000)
      ? payload.problem_addressed.trim()
      : null,
    hypothesis: isText(payload.hypothesis, 1000) ? payload.hypothesis.trim() : null,
    steps: cleanList(payload.steps, 7),
    est_cost: Number.isFinite(estCost) && estCost >= 0 ? Math.round(estCost) : 0,
    risks: cleanList(payload.risks, 4),
    success_metrics: cleanList(payload.success_metrics, 6),
    recommended_daily_plan: plan,
  };
}

// Mengembalikan peta { playbook_id: proposal_id }. Rekomendasi yang datanya tidak lengkap dilewati.
export async function saveRecommendationProposals({ supabase, businessId, recommendations }) {
  const prepared = [];
  recommendations.forEach((item, index) => {
    const row = prepare(item);
    if (row) prepared.push({ ...row, role: index === 0 ? "primary" : "alternative" });
  });
  if (prepared.length === 0) return {};

  const titles = prepared.map((item) => item.title);
  const { data: existing, error: existingError } = await supabase
    .from("solution_proposals")
    .select("id, title")
    .eq("business_id", businessId)
    .eq("source_type", "opportunity_library")
    .eq("status", "proposed")
    .in("title", titles)
    .order("created_at", { ascending: false });

  if (existingError) throw new Error(`gagal memeriksa data lama: ${existingError.message}`);

  const idByTitle = new Map();
  for (const row of existing ?? []) {
    if (!idByTitle.has(row.title)) idByTitle.set(row.title, row.id);
  }

  const toInsert = prepared.filter((item) => !idByTitle.has(item.title));

  if (toInsert.length > 0) {
    const rows = toInsert.map((item) => ({
      business_id: businessId,
      title: item.title,
      description: item.description,
      rationale: item.rationale,
      problem_addressed: item.problem_addressed,
      hypothesis: item.hypothesis,
      steps: item.steps,
      est_cost: item.est_cost,
      risks: item.risks,
      success_metrics: item.success_metrics,
      recommended_daily_plan: item.recommended_daily_plan,
      source_type: "opportunity_library",
      role: item.role,
      est_days: 7,
      status: "proposed",
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("solution_proposals")
      .insert(rows)
      .select("id, title");

    if (insertError) throw new Error(`gagal menyimpan: ${insertError.message}`);
    for (const row of inserted ?? []) idByTitle.set(row.title, row.id);

    // Tautan ke playbook asal. Kegagalan di sini tidak membatalkan penyimpanan.
    const links = toInsert
      .map((item) => ({ proposal_id: idByTitle.get(item.title), playbook_id: item.playbook_id }))
      .filter((link) => link.proposal_id);

    if (links.length > 0) {
      const { error: linkError } = await supabase
        .from("solution_proposal_playbooks")
        .insert(links);
      if (linkError) console.error("Proposal: gagal menautkan playbook:", linkError.message);
    }
  }

  const result = {};
  for (const item of prepared) {
    const id = idByTitle.get(item.title);
    if (id) result[item.playbook_id] = id;
  }
  return result;
}
