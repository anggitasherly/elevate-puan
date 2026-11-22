"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* =========================================================
   HASIL EKSPERIMEN

   MODE ASLI    : semua data dibaca dan disimpan lewat route
                  /api/experiments/* (Browser -> route -> Supabase).
                  - GET  /api/experiments/detail         (memuat data)
                  - POST /api/experiments/[id]/finish    (status akhir)
                  - PUT  /api/experiments/[id]/result    (simpan evaluasi)
                  Halaman ini TIDAK memanggil Supabase langsung.
   MODE PREVIEW : semua data hanya dari sessionStorage browser,
                  sama persis dengan halaman Rancangan dan Daily.
                  TIDAK ADA data preview yang masuk ke Supabase.

   Jika pengguna belum memakai data asli (belum ada proposalId
   atau ID eksperimen asli), halaman otomatis memakai preview,
   jadi tidak berhenti di layar error walau belum login.
========================================================= */

/* =========================================
   KONSTANTA
========================================= */

const DEFAULT_DURATION_DAYS = 7;
const ACTIVE_STATUSES = ["active", "running"]; // running = status lama
const FINAL_STATUSES = ["completed", "stopped", "expired"];
const EVALUATION_VERSION = 3;

// Margin contoh yang sama dengan Daily dan Rancangan (preview)
const PREVIEW_MARGIN = 0.4;

/* =========================================
   HELPER ANGKA DAN FORMAT
========================================= */

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const rp = (value) => {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? "-" : ""}Rp${Math.abs(n).toLocaleString("id-ID")}`;
};

const round2 = (value) => Math.round((Number(value) || 0) * 100) / 100;

const clampInt = (value) =>
  Math.max(-2147483648, Math.min(2147483647, Math.round(Number(value) || 0)));

const fmtDate = (date, options) =>
  date ? date.toLocaleDateString("id-ID", options) : "-";

// Rapikan hari berurutan jadi rentang: [3,4,5] -> "Hari 3–5"
const formatDays = (days) => {
  const groups = [];

  days.forEach((d) => {
    const last = groups[groups.length - 1];

    if (last && d === last[1] + 1) last[1] = d;
    else groups.push([d, d]);
  });

  return groups
    .map(([a, b]) => (a === b ? `Hari ${a}` : `Hari ${a}–${b}`))
    .join(", ");
};

/* =========================================
   HELPER JSON
========================================= */

function parseJson(value, fallback = []) {
  if (value === null || value === undefined || value === "") return fallback;

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function safeParse(text, fallback) {
  try {
    const parsed = text ? JSON.parse(text) : fallback;
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

/* =========================================
   HELPER TANGGAL (KALENDER LOKAL, BUKAN UTC)
========================================= */

function parseDateOnly(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

// Tanggal kalender LOKAL dari timestamp
function localDateOf(value) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}

// Selisih hari kalender (bukan selisih jam)
function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((b - a) / 86400000);
}

function isoLocal(d) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Total hari eksperimen: dari start_date sampai end_date (default 7)
function totalDaysOf(exp) {
  const s = parseDateOnly(exp?.start_date);
  const e = parseDateOnly(exp?.end_date);

  if (s && e) {
    const n = daysBetween(s, e) + 1;
    if (n >= 1 && n <= 60) return n;
  }

  return DEFAULT_DURATION_DAYS;
}

/* =========================================
   ATURAN "TERSIMPAN" (SAMA PERSIS DENGAN DAILY)
========================================= */

function isNoteSaved(row) {
  if (!row) return false;

  const steps = parseJson(row.steps_done, []);

  return (
    Array.isArray(steps) &&
    steps.length > 0 &&
    row.progress_note !== null &&
    row.progress_note !== undefined &&
    row.mood !== null &&
    row.mood !== undefined
  );
}

function isFinanceSaved(row) {
  return Boolean(
    row &&
      row.revenue_today !== null &&
      row.revenue_today !== undefined &&
      row.experiment_cost_today !== null &&
      row.experiment_cost_today !== undefined
  );
}

function isDayComplete(row) {
  return isNoteSaved(row) && isFinanceSaved(row);
}

/* =========================================
   RENCANA HARIAN (daily_plan)
   Hanya MEMBACA rencana. Tidak membuat tugas baru.
========================================= */

function planToArray(rawPlan) {
  const parsed = parseJson(rawPlan, []);

  if (Array.isArray(parsed)) return parsed;

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.days)) return parsed.days;
    if (Array.isArray(parsed.daily_plan)) return parsed.daily_plan;
    if (Array.isArray(parsed.plan)) return parsed.plan;

    return Object.entries(parsed).map(([key, item], index) => ({
      day: Number(String(key).match(/\d+/)?.[0]) || index + 1,
      ...(item && typeof item === "object"
        ? item
        : { description: String(item ?? "") }),
    }));
  }

  return [];
}

function planInfo(rawPlan, day) {
  const item = planToArray(rawPlan).find((entry, index) => {
    if (typeof entry === "string") return index + 1 === day;

    const value = Number(
      entry?.day ?? entry?.day_number ?? entry?.hari ?? index + 1
    );

    return value === day;
  });

  if (!item) return { label: "", tasks: [] };

  if (typeof item === "string") {
    const text = item.trim();
    return { label: text, tasks: text ? [text] : [] };
  }

  const title = String(item.title || item.name || "").trim();
  const meaningfulTitle = title && title !== `Hari ${day}` ? title : "";
  const focus = String(
    item.focus || item.description || item.detail || ""
  ).trim();

  const rawTasks = parseJson(
    item.tasks ?? item.checklist ?? item.activities ?? item.steps,
    []
  );

  let tasks = [];

  if (Array.isArray(rawTasks)) {
    tasks = rawTasks
      .map((t) =>
        typeof t === "string"
          ? t
          : t?.title || t?.description || t?.task || t?.text || ""
      )
      .map((t) => String(t).trim())
      .filter(Boolean);
  } else if (typeof rawTasks === "string") {
    tasks = rawTasks
      .split(/\s*•\s*|\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  if (tasks.length === 0 && focus) tasks = [focus];
  if (tasks.length === 0 && meaningfulTitle) tasks = [meaningfulTitle];

  return {
    label: meaningfulTitle || focus || "",
    tasks: tasks.slice(0, 3), // sama dengan batas Daily
  };
}

/* =========================================
   METRIK FLEKSIBEL
   Jenis metrik dibaca dari metric_name rancangan.
   Sistem TIDAK dikunci pada omzet.
========================================= */

const REVENUE_RE = /omzet|revenue|penjualan|pendapatan|pemasukan/i;
const ORDER_RE = /pesanan|order|transaksi/i;

function metricKind(name) {
  const text = String(name || "");
  const rev = REVENUE_RE.test(text);
  const ord = ORDER_RE.test(text);

  if (rev && !ord) return "revenue";
  if (ord && !rev) return "orders";
  if (rev && ord) return /jumlah|banyak/i.test(text) ? "orders" : "revenue";

  return "other";
}

const fmtMetric = (kind, value) =>
  kind === "revenue"
    ? rp(value)
    : Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });

/* =========================================
   EVALUASI
   Semua angka berasal dari experiments + experiment_checkins.
   Tidak ada data yang dikarang: yang tidak tersedia = null.
========================================= */

function buildEvaluation(exp, rows, ctx) {
  const status = exp.status;
  const start = parseDateOnly(exp.start_date);
  const totalDays = totalDaysOf(exp);

  const dayOf = (value) => {
    const d = parseDateOnly(value);
    return start && d ? daysBetween(start, d) + 1 : 0;
  };

  // Satu baris per tanggal check-in (hanya yang berada di periode eksperimen)
  const byDay = {};

  (rows || []).forEach((row) => {
    const n = dayOf(row.checkin_date);
    if (n >= 1 && n <= totalDays) byDay[n] = row;
  });

  const recordedDays = Object.keys(byDay)
    .map(Number)
    .sort((a, b) => a - b);

  const lastCheckinDay = recordedDays.length
    ? recordedDays[recordedDays.length - 1]
    : 0;

  const noData = recordedDays.length === 0;

  /* ---- Durasi / hari pelaksanaan ---- */

  let stop = null;
  let elapsed = totalDays;

  if (status === "stopped") {
    let estimatedDay = null;

    if (ctx.forced) {
      estimatedDay = ctx.forced.estimatedDay ?? null;
    } else {
      // Tidak ada kolom waktu penghentian di tabel experiments.
      // Perkiraan: kapan baris hasil dibuat (Daily membuatnya saat tombol
      // "Hentikan" ditekan). Ini perkiraan, bukan bukti.
      const created = localDateOf(ctx.result?.created_at);

      if (created && start) {
        estimatedDay = daysBetween(start, created) + 1;
      } else if (ctx.isPreview && start) {
        estimatedDay = daysBetween(start, ctx.today) + 1;
      }

      if (estimatedDay !== null) {
        if (estimatedDay < 1) estimatedDay = null;
        else estimatedDay = Math.min(estimatedDay, totalDays);
      }
    }

    stop = { provenDay: lastCheckinDay, estimatedDay };

    elapsed =
      ctx.forced?.elapsed ??
      Math.min(totalDays, Math.max(lastCheckinDay, estimatedDay || 0));
  }

  elapsed = Math.max(0, Math.min(elapsed, totalDays));

  /* ---- Detail per hari ---- */

  const days = Array.from({ length: totalDays }, (_, i) => {
    const n = i + 1;
    const row = byDay[n] || null;
    const plan = planInfo(exp.daily_plan, n);
    const complete = isDayComplete(row);

    let state;

    if (n > elapsed) state = status === "stopped" ? "not_run" : "upcoming";
    else if (complete) state = "complete";
    else if (row) state = "partial";
    else state = "missed";

    const rawSteps = row ? parseJson(row.steps_done, []) : [];

    const steps = Array.isArray(rawSteps)
      ? rawSteps
          .map((s) => ({ task: s?.task || "", done: s?.done !== false }))
          .filter((s) => s.task)
      : [];

    return {
      day: n,
      date: start ? addDays(start, i) : null,
      state,
      plan,
      row,
      note: isNoteSaved(row)
        ? {
            mood: row.mood,
            progress: String(row.progress_note || "").trim(),
            obstacle: String(row.obstacle || "").trim(),
          }
        : null,
      steps,
      recordedDone: steps.filter((s) => s.done).length,
      revenue:
        row && row.revenue_today !== null && row.revenue_today !== undefined
          ? toNumber(row.revenue_today)
          : null,
      cost:
        row &&
        row.experiment_cost_today !== null &&
        row.experiment_cost_today !== undefined
          ? toNumber(row.experiment_cost_today)
          : null,
      metricValue:
        row && row.metric_value !== null && row.metric_value !== undefined
          ? toNumber(row.metric_value)
          : null,
    };
  });

  const ran = days.filter((d) => d.day <= elapsed);

  /* ---- Kelengkapan check-in (hanya hari yang sudah dijalani) ---- */

  const completeDays = ran.filter((d) => d.state === "complete").map((d) => d.day);
  const partialDays = ran.filter((d) => d.state === "partial").map((d) => d.day);
  const missedDays = ran.filter((d) => d.state === "missed").map((d) => d.day);
  const notRunDays = days.filter((d) => d.state === "not_run").map((d) => d.day);

  const completeness =
    elapsed > 0 ? round2((completeDays.length / elapsed) * 100) : null;

  /* ---- Tugas rencana vs tugas yang benar-benar dicatat ---- */

  const tasks = {
    planned: ran.reduce((sum, d) => sum + d.plan.tasks.length, 0),
    recorded: ran.reduce((sum, d) => sum + d.recordedDone, 0),
  };

  /* ---- Metrik utama ---- */

  const kind = metricKind(exp.metric_name);
  const target = toNumber(exp.target_value) > 0 ? toNumber(exp.target_value) : null;

  // baseline_value dari Rancangan adalah baseline untuk seluruh durasi
  // yang direncanakan. Jika eksperimen dihentikan lebih awal, sesuaikan
  // baseline omzet dengan jumlah hari yang benar-benar dijalani.
  // Contoh: baseline 7 hari x (3 hari dijalani / 7 hari rencana) = baseline 3 hari.
  const plannedBaseline =
    exp.baseline_value !== null && exp.baseline_value !== undefined
      ? toNumber(exp.baseline_value)
      : null;

  const baseline =
    plannedBaseline !== null && kind === "revenue"
      ? Math.round((plannedBaseline / totalDays) * elapsed)
      : plannedBaseline;

  const mvDays = ran.filter((d) => d.metricValue !== null);
  const revDays = ran.filter((d) => d.revenue !== null);
  const costDays = ran.filter((d) => d.cost !== null);

  let actual = null;
  let source = "none";

  if (mvDays.length > 0) {
    actual = mvDays.reduce((sum, d) => sum + d.metricValue, 0);
    source = "metric_value";
  } else if (kind === "revenue" && revDays.length > 0) {
    actual = revDays.reduce((sum, d) => sum + d.revenue, 0);
    source = "revenue_today";
  }

  const percentage =
    target && actual !== null ? Math.round((actual / target) * 100) : null;

  const targetMet = target && actual !== null ? actual >= target : null;

  /* ---- Keuangan ---- */

  const margin = Number(ctx.margin) || 0;
  const revenue = revDays.reduce((sum, d) => sum + d.revenue, 0);
  const cost = costDays.reduce((sum, d) => sum + d.cost, 0);
  const hasRevenue = revDays.length > 0;
  const hasCost = costDays.length > 0;

  const gross = hasRevenue && margin > 0 ? revenue * margin : null;
  const net = gross !== null ? gross - cost : null;
  const roi = net !== null && cost > 0 ? round2((net / cost) * 100) : null;

  // Tambahan omzet hanya dihitung jika:
  // 1) metrik eksperimen memang omzet,
  // 2) baseline tersedia dan bernilai lebih dari nol,
  // 3) setiap hari dalam durasi pelaksanaan memiliki catatan revenue.
  // Hari tanpa catatan tidak boleh dianggap memiliki omzet Rp0.
  const revenuePeriodComplete =
    elapsed > 0 && revDays.length === elapsed;

  const additional =
    kind === "revenue" &&
    revenuePeriodComplete &&
    baseline !== null &&
    baseline > 0
      ? revenue - baseline
      : null;

  // Break-even hanya jika metriknya jumlah pesanan dan datanya cukup
  const breakEven =
    kind === "orders" &&
    actual &&
    actual > 0 &&
    hasRevenue &&
    revenue > 0 &&
    margin > 0 &&
    cost > 0
      ? Math.ceil(cost / ((revenue / actual) * margin))
      : null;

  const finance = { revenue, cost, hasRevenue, hasCost, margin, gross, net, roi, additional, breakEven };

  /* ---- Catatan pengguna (tidak diubah) ---- */

  const worked = days
    .filter((d) => d.note?.progress)
    .map((d) => `Hari ${d.day}: ${d.note.progress}`);

  const obstacles = days
    .filter((d) => d.note?.obstacle)
    .map((d) => `Hari ${d.day}: ${d.note.obstacle}`);

  const moods = days
    .filter((d) => d.note?.mood)
    .map((d) => ({ day: d.day, mood: d.note.mood }));

  /* ---- Label hasil ---- */

  const metric = {
    name: exp.metric_name || "Metrik utama",
    kind,
    baseline,
    target,
    actual,
    source,
    percentage,
    targetMet,
  };

  let verdict;

  if (noData) {
    verdict = { label: "Data tidak tersedia", tone: "neutral" };
  } else if (actual === null) {
    verdict = { label: "Belum bisa dinilai dari metrik", tone: "neutral" };
  } else if (!target) {
    verdict = { label: "Target belum ditetapkan", tone: "neutral" };
  } else if (status === "stopped") {
    verdict = targetMet
      ? { label: "Target tercapai sebelum dihentikan", tone: "green" }
      : { label: "Dihentikan sebelum target tercapai", tone: "violet" };
  } else if (targetMet) {
    verdict = { label: "Target tercapai", tone: "green" };
  } else if (percentage >= 50) {
    verdict = { label: "Sebagian tercapai", tone: "violet" };
  } else {
    verdict = { label: "Belum mencapai target", tone: "rose" };
  }

  /* ---- Kesimpulan (aturan, tanpa AI, selalu dengan alasan dari data) ---- */

  const fm = (v) => fmtMetric(kind, v);

  const metricSentence =
    actual !== null
      ? `${metric.name}: aktual ${fm(actual)}${
          target ? ` dari target ${fm(target)} (${percentage}%)` : ""
        }.`
      : `Nilai aktual untuk metrik "${metric.name}" tidak tersedia di Daily Check-in, sehingga pencapaian target tidak dapat dihitung.`;

  const reasons = [];
  const limitations = [];

  if (!noData) {
    reasons.push(
      `Check-in lengkap ${completeDays.length} dari ${elapsed} hari yang dijalani (${completeness}%).`
    );
    reasons.push(metricSentence);

    if (tasks.planned > 0) {
      reasons.push(
        `Tugas yang tercatat dikerjakan ${tasks.recorded} dari ${tasks.planned} tugas pada rencana hari yang dijalani.`
      );
    }

    if (net !== null) {
      reasons.push(
        `Total pemasukan tercatat ${rp(revenue)} dengan biaya eksperimen ${rp(cost)}; estimasi laba bersih ${rp(net)}.`
      );
    }

    if (obstacles.length > 0) {
      reasons.push(`Kendala yang kamu catat: ${obstacles[0]}`);
    }
  }

  if (status === "stopped") {
    limitations.push(
      "Tanggal penghentian tidak tersimpan khusus di database, jadi hari penghentian yang persis tidak dapat dipastikan. Durasi dihitung dari bukti yang ada."
    );
    limitations.push("Alasan penghentian tidak tercatat.");
  }

  if (!noData && actual === null) {
    limitations.push(
      `Metrik "${metric.name}" tidak punya nilai aktual yang tercatat, jadi tidak dibandingkan dengan target.`
    );
  }

  if (source === "metric_value") {
    limitations.push("Nilai aktual dijumlahkan dari nilai metrik harian di check-in.");
  }

  if (!noData && net === null) {
    limitations.push(
      "Laba dan ROI tidak dihitung karena data pemasukan atau margin produk tidak tersedia."
    );
  }

  if (!noData && kind === "revenue") {
    limitations.push(
      "Total pemasukan yang dicatat tidak otomatis seluruhnya tambahan akibat eksperimen."
    );
  }

  if (!noData && completeness !== null && completeness < 50) {
    limitations.push(
      "Kelengkapan check-in di bawah 50%, jadi hasil sebaiknya dibaca dengan hati-hati."
    );
  }

  let title;
  let description;
  let conclusion;
  let statusLabel;

  if (noData) {
    statusLabel = "Data tidak tersedia";
    title = "Tidak ada bukti pelaksanaan harian";
    description =
      "Tidak ada Daily Check-in yang tercatat selama periode eksperimen ini.";
    conclusion =
      "Tanpa catatan harian, sistem tidak dapat menilai hasil eksperimen. Sistem sengaja tidak membuat hasil apa pun tanpa data.";
  } else if (status === "completed") {
    statusLabel = "Eksperimen selesai";
    title = targetMet
      ? "Eksperimen selesai dan target tercapai"
      : actual !== null && target
        ? "Eksperimen selesai, target belum tercapai"
        : "Eksperimen selesai";
    description = `Eksperimen dijalankan sampai hari ke-${elapsed} dari ${totalDays} hari. ${metricSentence}`;
    conclusion = !(actual !== null && target)
      ? "Pelaksanaan eksperimen sudah selesai, tetapi pencapaian target belum dapat dinilai karena nilai aktual atau target tidak tersedia."
      : targetMet
        ? "Berdasarkan data yang kamu catat, hasil aktual sudah mencapai target. Strategi ini menunjukkan hasil yang sesuai harapan untuk periode eksperimen."
        : percentage >= 50
          ? `Hasil aktual baru ${percentage}% dari target. Strategi sudah menunjukkan hasil, tetapi belum sepenuhnya mencapai target.`
          : `Hasil aktual baru ${percentage}% dari target, jadi strategi ini belum terbukti efektif dalam periode eksperimen.`;
  } else if (status === "stopped") {
    statusLabel = "Dihentikan";
    title = "Eksperimen dihentikan sebelum periode selesai";
    description = `Aktivitas tercatat sampai hari ke-${lastCheckinDay} dan durasi pelaksanaan dihitung ${elapsed} dari ${totalDays} hari. ${metricSentence}`;
    conclusion =
      "Karena dihentikan sebelum periode selesai, hasil dibaca sebagai hasil sementara dan tidak otomatis dianggap gagal. Catatan yang sudah terkumpul tetap bisa menjadi bahan belajar.";
  } else {
    statusLabel = "Periode berakhir";
    title = "Periode eksperimen sudah berakhir";
    description = `Periode ${totalDays} hari sudah lewat. Check-in hanya tercatat pada ${formatDays(recordedDays)}. ${metricSentence}`;
    conclusion =
      actual !== null && target
        ? targetMet
          ? "Target tercapai berdasarkan data yang tercatat, meskipun tidak semua hari memiliki check-in."
          : `Hasil aktual baru ${percentage}% dari target berdasarkan data yang tercatat. Hari tanpa check-in tidak dianggap sudah dijalankan.`
        : "Periode sudah berakhir dan pencapaian target belum dapat dinilai karena nilai aktual atau target tidak tersedia. Hari tanpa check-in tidak dianggap sudah dijalankan.";
  }

  const learningText = [
    worked.length ? `Perkembangan yang dicatat:\n${worked.join("\n")}` : "",
    obstacles.length ? `Kendala yang dicatat:\n${obstacles.join("\n")}` : "",
    noData
      ? "Tidak ada check-in yang tercatat."
      : `Check-in lengkap ${completeDays.length} dari ${elapsed} hari.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    status,
    totalDays,
    elapsed,
    stop,
    start,
    end: start ? addDays(start, totalDays - 1) : null,
    days,
    recordedDays,
    lastCheckinDay,
    noData,
    completeDays,
    partialDays,
    missedDays,
    notRunDays,
    completeness,
    tasks,
    metric,
    finance,
    learnings: { worked, obstacles, moods, text: learningText },
    verdict,
    summary: { status: statusLabel, title, description, conclusion, reasons, limitations },
  };
}

/* =========================================
   ISI KOLOM experiment_results
   (evaluated_at TIDAK dikirim dari browser: di mode asli diisi
   server, di mode preview ditambahkan saat disimpan ke sessionStorage)
========================================= */

function toResultPayload(ev) {
  const f = ev.finance;
  const m = ev.metric;

  return {
    actual_value: m.actual !== null ? round2(m.actual) : null,
    target_met: m.targetMet,
    checkin_completeness: ev.completeness,
    cost_spent: f.hasCost ? clampInt(f.cost) : null,
    additional_revenue: f.additional !== null ? clampInt(f.additional) : null,
    gross_profit: f.gross !== null ? clampInt(f.gross) : null,
    net_profit: f.net !== null ? clampInt(f.net) : null,
    roi: f.roi,
    break_even_orders: f.breakEven,
    learnings: ev.learnings.text,
    system_evaluation: {
      version: EVALUATION_VERSION,
      final_status: ev.status,
      status: ev.summary.status,
      title: ev.summary.title,
      description: ev.summary.description,
      conclusion: ev.summary.conclusion,
      reasons: ev.summary.reasons,
      limitations: ev.summary.limitations,
      verdict_label: ev.verdict.label,
      duration: {
        total_days: ev.totalDays,
        elapsed_days: ev.elapsed,
        stop_proven_day: ev.stop ? ev.stop.provenDay : null,
        stop_estimated_day: ev.stop ? ev.stop.estimatedDay : null,
      },
      completeness: {
        complete_days: ev.completeDays.length,
        partial_days: ev.partialDays.length,
        missed_days: ev.missedDays.length,
        percent: ev.completeness,
      },
      metric: {
        name: m.name,
        baseline: m.baseline,
        target: m.target,
        actual: m.actual,
        source: m.source,
      },
    },
  };
}

// Hasil dianggap sudah lengkap jika versi evaluasinya sama dan evaluated_at ada
function readStoredEvaluation(result) {
  if (!result?.evaluated_at) return null;

  const se = parseJson(result.system_evaluation, null);

  if (!se || typeof se !== "object" || se.version !== EVALUATION_VERSION) {
    return null;
  }

  return se;
}

/* =========================================
   PREVIEW: sessionStorage (sama dengan Rancangan dan Daily)
========================================= */

function savePreviewExperiment(experiment) {
  const text = JSON.stringify(experiment);

  sessionStorage.setItem(`ep_preview_experiment_${experiment.id}`, text);
  sessionStorage.setItem("ep_preview_experiment", text);
  sessionStorage.setItem("ep_current_experiment_id", experiment.id);
}

/* =========================================
   CONTOH PREVIEW
   Dipakai jika belum ada data preview di browser.
   Disimpan di sessionStorage dengan key yang sama dengan
   Rancangan dan Daily. TIDAK dikirim ke Supabase.
========================================= */

const SAMPLE_STATUSES = ["active", "completed", "stopped", "expired"];

const SAMPLE_PLAN = [
  { day: 1, title: "Pilih produk jagoan", focus: "Pilih satu produk jagoan supaya pesan flash sale kuat.", tasks: ["Cek stok produk", "Pilih 1 produk utama", "Tentukan harga promo"] },
  { day: 2, title: "Siapkan materi promosi", focus: "Siapkan amunisi visual untuk flash sale.", tasks: ["Buat flyer sederhana", "Tulis judul promo yang kuat"] },
  { day: 3, title: "Mulai beri bocoran", focus: "Buat calon pembeli penasaran.", tasks: ["Posting teaser di Story WhatsApp", "Posting teaser di Story Instagram"] },
  { day: 4, title: "Kirim pengingat", focus: "Kirim pengingat terakhir.", tasks: ["Kirim reminder satu jam sebelum mulai", "Pastikan stok siap"] },
  { day: 5, title: "Jalankan flash sale", focus: "Buka promo tepat waktu.", tasks: ["Buka promo tepat jam 16.00", "Balas semua DM dan catat pembelian"] },
  { day: 6, title: "Tutup promo", focus: "Tutup promo tepat waktu.", tasks: ["Tutup promo jam 19.00", "Tindak lanjuti pembeli"] },
  { day: 7, title: "Evaluasi hasil", focus: "Catat pelajaran dari eksperimen.", tasks: ["Rekap semua penjualan", "Tulis yang berhasil dan perlu diperbaiki"] },
];

function seedPreviewSample(kind) {
  const today = startOfToday();

  const id = `preview-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  const shift =
    kind === "completed" ? -7 : kind === "expired" ? -9 : kind === "stopped" ? -3 : 0;

  const start = addDays(today, shift);

  const exp = {
    id,
    business_id: "demo-business",
    proposal_id: "demo-proposal",
    title: "Grebek Flash Sale 3 Jam",
    channels: ["Flash Sale"],
    metric_name: "Omzet selama 7 hari",
    baseline_value: 0,
    target_value: 250000,
    budget_planned: 0,
    growth_level: 1,
    start_date: isoLocal(start),
    end_date: isoLocal(addDays(start, 6)),
    status: kind,
    daily_plan: SAMPLE_PLAN,
    is_preview: true,
  };

  const make = (n, revenue, cost, full = true) => ({
    id: `${id}-${n}`,
    experiment_id: id,
    checkin_date: isoLocal(addDays(start, n - 1)),
    steps_done: SAMPLE_PLAN[n - 1].tasks.map((task, index) => ({
      index,
      task,
      done: true,
      saved_at: new Date().toISOString(),
    })),
    progress_note: `Tugas hari ke-${n} berjalan sesuai rencana.`,
    mood: "Lancar",
    obstacle: n % 2 === 0 ? "Waktu agak terbatas." : "Tidak ada kendala berarti.",
    metric_value: null,
    revenue_today: full ? revenue : null,
    experiment_cost_today: full ? cost : null,
    created_at: new Date().toISOString(),
  });

  let rows = [];

  if (kind === "completed") {
    rows = [
      make(1, 40000, 0),
      make(2, 50000, 5000),
      make(3, 60000, 0),
      make(4, 55000, 10000),
      make(5, 0, 0, false), // hanya catatan (sebagian)
      make(7, 70000, 0),
    ];
  } else if (kind === "stopped") {
    rows = [make(1, 40000, 0), make(2, 50000, 5000), make(3, 30000, 0)];
  } else if (kind === "expired") {
    rows = [make(1, 40000, 0), make(2, 50000, 5000), make(4, 35000, 0)];
  }

  savePreviewExperiment(exp);
  sessionStorage.setItem(`ep_preview_checkins_${id}`, JSON.stringify(rows));
  sessionStorage.removeItem(`ep_preview_result_${id}`);
  sessionStorage.removeItem(`ep_preview_day_offset_${id}`);

  return exp;
}

function loadPreview(urlId, storedId, sample) {
  const previewId = urlId.startsWith("preview-")
    ? urlId
    : storedId.startsWith("preview-")
      ? storedId
      : "";

  const raw = previewId
    ? sessionStorage.getItem(`ep_preview_experiment_${previewId}`) ||
      sessionStorage.getItem("ep_preview_experiment")
    : sessionStorage.getItem("ep_preview_experiment");

  let exp = safeParse(raw, null);

  if (!exp?.id || (previewId && exp.id !== previewId)) exp = null;

  // Belum ada data preview, atau diminta contoh tertentu (?status=...)
  if (!exp || SAMPLE_STATUSES.includes(sample)) {
    exp = seedPreviewSample(SAMPLE_STATUSES.includes(sample) ? sample : "active");
  }

  const rows = safeParse(
    sessionStorage.getItem(`ep_preview_checkins_${exp.id}`),
    []
  );

  return {
    isPreview: true,
    exp,
    rows: Array.isArray(rows) ? rows : [],
    result: safeParse(sessionStorage.getItem(`ep_preview_result_${exp.id}`), null),
    margin: PREVIEW_MARGIN,
    offset: Number(sessionStorage.getItem(`ep_preview_day_offset_${exp.id}`)) || 0,
  };
}

/* =========================================
   MODE ASLI: lewat route /api/experiments/*
========================================= */

function friendlyReason(err) {
  const message = String(err?.message || "");

  if (
    err?.name === "AuthSessionMissingError" ||
    /auth session missing/i.test(message)
  ) {
    return "Kamu belum login, jadi data eksperimen asli belum bisa dibaca.";
  }

  return message || "Data eksperimen belum bisa dibaca.";
}

function normalizeMargin(data) {
  const raw = toNumber(data?.product_margin_pct);
  return raw > 1 ? raw / 100 : raw;
}

// Panggilan ke route /api. Gagal -> Error dengan pesan dari server.
async function apiRequest(url, options = {}) {
  let response;

  try {
    response = await fetch(url, { cache: "no-store", ...options });
  } catch {
    throw new Error(
      "Tidak dapat terhubung ke server. Periksa koneksi internetmu."
    );
  }

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new Error(
      body?.error || "Terjadi kesalahan saat menghubungi server."
    );

    error.status = response.status;
    error.code = body?.code;

    throw error;
  }

  return body;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function loadReal(urlId, storedId) {
  const experimentId =
    (urlId && !urlId.startsWith("preview-") ? urlId : "") ||
    (storedId && !storedId.startsWith("preview-") ? storedId : "");

  const query = new URLSearchParams({ pick: "latest" });

  if (experimentId) query.set("experimentId", experimentId);

  // Server memeriksa login dan kepemilikan bisnis, lalu mengembalikan
  // eksperimen + check-in + keuangan + hasil (paling awal) sekaligus.
  const body = await apiRequest(`/api/experiments/detail?${query.toString()}`);

  const exp = body?.experiment;

  if (!exp?.id) {
    throw new Error("Eksperimen tidak ditemukan. Jalankan eksperimen terlebih dahulu.");
  }

  sessionStorage.setItem("ep_current_experiment_id", exp.id);

  return {
    isPreview: false,
    exp,
    rows: Array.isArray(body.checkins) ? body.checkins : [],
    result: body.result ?? null,
    margin: normalizeMargin(body.finance),
    offset: 0,
  };
}

/* =========================================
   PROSES OTOMATIS
   1) active yang periodenya sudah lewat -> completed / expired
   2) status akhir -> evaluasi disimpan SATU KALI ke experiment_results
   Hasil yang sudah ada hanya dibaca, tidak dibuat ulang.
========================================= */

async function settle(base) {
  const out = { ...base, persist: "none", notice: "" };
  const { isPreview, offset } = base;

  const today = addDays(startOfToday(), isPreview ? offset : 0);
  const start = parseDateOnly(base.exp.start_date);
  const totalDays = totalDaysOf(base.exp);

  // 1) Deteksi periode berakhir (halaman dibuka setelah end_date)
  if (
    ACTIVE_STATUSES.includes(base.exp.status) &&
    start &&
    daysBetween(start, today) + 1 > totalDays
  ) {
    const lastDate = isoLocal(addDays(start, totalDays - 1));
    const lastRow = base.rows.find((r) => r.checkin_date === lastDate);
    const nextStatus = isDayComplete(lastRow) ? "completed" : "expired";

    try {
      if (isPreview) {
        const updated = { ...base.exp, status: nextStatus };
        savePreviewExperiment(updated);
        out.exp = updated;
      } else {
        // Server hanya mengubah status jika masih active/running. Jika sudah
        // diubah proses lain (misal halaman Daily), status terbaru dikembalikan.
        const body = await apiRequest(
          `/api/experiments/${encodeURIComponent(base.exp.id)}/finish`,
          {
            method: "POST",
            headers: JSON_HEADERS,
            body: JSON.stringify({ status: nextStatus }),
          }
        );

        if (body?.experiment) out.exp = body.experiment;
        if (body?.result) out.result = body.result;
      }
    } catch (err) {
      console.error("Gagal memperbarui status eksperimen:", err?.message);
      out.notice =
        "Periode eksperimen sudah berakhir, tetapi status belum berhasil diperbarui. Muat ulang halaman untuk mencoba lagi.";
      return out;
    }
  }

  // 2) Status akhir -> pastikan evaluasi tersimpan
  if (!FINAL_STATUSES.includes(out.exp.status)) return out;

  if (readStoredEvaluation(out.result)) {
    out.persist = "saved";
    return out;
  }

  const ev = buildEvaluation(out.exp, out.rows, {
    margin: out.margin,
    result: out.result,
    isPreview,
    today,
  });

  const payload = toResultPayload(ev);

  try {
    if (isPreview) {
      const saved = {
        ...(out.result || {}),
        experiment_id: out.exp.id,
        ...payload,
        evaluated_at: new Date().toISOString(),
      };

      sessionStorage.setItem(
        `ep_preview_result_${out.exp.id}`,
        JSON.stringify(saved)
      );

      out.result = saved;
    } else {
      // Server melengkapi baris hasil yang ada (dari Daily / finish) atau
      // membuatnya jika belum ada, lalu mengembalikan baris paling awal.
      const body = await apiRequest(
        `/api/experiments/${encodeURIComponent(out.exp.id)}/result`,
        {
          method: "PUT",
          headers: JSON_HEADERS,
          body: JSON.stringify(payload),
        }
      );

      if (!body?.result) {
        throw new Error("Balasan server tidak berisi hasil eksperimen.");
      }

      out.result = body.result;
    }

    out.persist = "saved";
  } catch (err) {
    console.error("Gagal menyimpan evaluasi eksperimen:", err?.message);
    out.persist = "failed";
    out.notice =
      "Evaluasi berhasil dihitung dan ditampilkan, tetapi belum tersimpan ke database. Evaluasi akan dicoba disimpan lagi saat halaman ini dibuka kembali.";
  }

  return out;
}

function MetricCard({ title, value, sub, green = false, warn = false }) {
  return (
    <div
      className={`min-w-0 rounded-xl border p-3 md:p-4 ${
        green
          ? "border-emerald-200 bg-emerald-50"
          : warn
            ? "border-rose-200 bg-rose-50"
            : "border-violet-100 bg-white"
      }`}
    >
      <p className="text-[11px] text-slate-500 md:text-xs">{title}</p>

      <p
        className={`mt-1 break-words text-xl font-extrabold md:text-2xl ${
          green ? "text-emerald-700" : warn ? "text-rose-600" : "text-violet-950"
        }`}
      >
        {value}
      </p>

      {sub && (
        <p className="mt-1 text-[10px] font-semibold text-slate-500 md:text-xs">
          {sub}
        </p>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub, tone = "neutral" }) {
  const tones = {
    neutral: "border-violet-100 bg-white text-violet-950",
    violet: "border-violet-200 bg-violet-50 text-violet-950",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-600",
  };

  return (
    <div className={`min-w-0 rounded-xl border p-3 md:p-4 ${tones[tone]}`}>
      <p className="text-[10px] font-semibold text-slate-500 md:text-[11px]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-extrabold md:text-base">
        {value}
      </p>

      {sub && (
        <p className="mt-1 text-[10px] leading-snug text-slate-500">{sub}</p>
      )}
    </div>
  );
}

function SectionTitle({ number, title, description }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
        {number}
      </span>

      <div className="min-w-0">
        <h2 className="text-base font-extrabold text-violet-950 md:text-lg">
          {title}
        </h2>

        <p className="text-[11px] text-slate-500 md:text-xs">{description}</p>
      </div>
    </div>
  );
}

const DAY_STATE = {
  complete: { label: "Lengkap", chip: "bg-emerald-100 text-emerald-700", dot: "bg-violet-600" },
  partial: { label: "Sebagian", chip: "bg-violet-100 text-violet-700", dot: "bg-violet-300" },
  missed: { label: "Terlewat", chip: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
  not_run: { label: "Tidak dijalankan", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
  upcoming: { label: "Belum", chip: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

const TONE_BOX = {
  green: { box: "border-emerald-100 bg-emerald-50/60", chip: "bg-emerald-100 text-emerald-700", bar: "border-emerald-200" },
  violet: { box: "border-violet-100 bg-violet-50/60", chip: "bg-violet-100 text-violet-700", bar: "border-violet-200" },
  rose: { box: "border-rose-100 bg-rose-50/60", chip: "bg-rose-100 text-rose-600", bar: "border-rose-200" },
  neutral: { box: "border-slate-200 bg-slate-50/70", chip: "bg-slate-200 text-slate-600", bar: "border-slate-200" },
};

/* =========================================
   HALAMAN HASIL EKSPERIMEN
========================================= */

export default function Hasil() {
  const router = useRouter();

  const loadRef = useRef(null);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [showNotes, setShowNotes] = useState(false);

  // Sembunyikan footer hanya pada halaman ini
  useEffect(() => {
    const footer = document.querySelector("footer");

    if (footer) footer.style.display = "none";

    return () => {
      if (footer) footer.style.display = "";
    };
  }, []);

  /* =====================================
     AMBIL DATA + PROSES OTOMATIS
     (promise disimpan di ref supaya evaluasi tidak
     diproses dua kali, misalnya saat React Strict Mode)
  ===================================== */

  useEffect(() => {
    let mounted = true;

    if (!loadRef.current) {
      loadRef.current = (async () => {
        const params = new URLSearchParams(window.location.search);
        const urlId = params.get("experimentId")?.trim() || "";
        const storedId = sessionStorage.getItem("ep_current_experiment_id") || "";

        const wantsPreview =
          params.get("mode") === "preview" || urlId.startsWith("preview-");

        // Pengguna sudah memakai data asli (ID eksperimen asli, atau
        // proposalId dari Opportunity Library / Growth Insight)
        const hasRealIntent =
          Boolean(urlId && !urlId.startsWith("preview-")) ||
          Boolean(storedId && !storedId.startsWith("preview-")) ||
          Boolean(sessionStorage.getItem("ep_selected_proposal_id"));

        const base =
          wantsPreview || !hasRealIntent
            ? loadPreview(urlId, storedId, params.get("status"))
            : await loadReal(urlId, storedId);

        return settle(base);
      })();
    }

    loadRef.current
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((err) => {
        console.error("Gagal mengambil data Hasil Eksperimen:", err?.message);
        if (mounted) setError(friendlyReason(err));
      })
      .finally(() => {
        if (mounted) setReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  /* =====================================
     LOADING DAN ERROR
  ===================================== */

  if (!ready) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-violet-100 border-t-violet-600" />

          <p className="mt-4 text-sm font-semibold text-violet-700">
            Menyiapkan hasil eksperimen...
          </p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const params =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

    const inPreview = params.get("mode") === "preview";

    return (
      <div className="flex min-h-[60vh] items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-2xl border border-rose-100 bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h2 className="mt-3 text-lg font-extrabold text-violet-950">
            Data belum tersedia
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {error || "Data eksperimen tidak dapat dibaca."}
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={() => router.push("/home")}
              className="rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white"
            >
              Kembali
            </button>

            <button
              type="button"
              onClick={() =>
                router.push(
                  inPreview
                    ? "/experiments/daily?mode=preview"
                    : "/experiments/hasil?mode=preview"
                )
              }
              className="rounded-full border border-violet-200 bg-white px-6 py-3 text-sm font-bold text-violet-700"
            >
              {inPreview ? "Buka Daily (preview)" : "Lihat mode preview"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* =====================================
     DATA DASAR
  ===================================== */

  const { exp, rows, result, isPreview, margin, offset } = data;

  const status = FINAL_STATUSES.includes(exp.status)
    ? exp.status
    : ACTIVE_STATUSES.includes(exp.status)
      ? "active"
      : "planned";

  const isFinal = FINAL_STATUSES.includes(status);

  const category =
    (Array.isArray(exp.channels) && exp.channels.length > 0
      ? exp.channels.join(" & ")
      : null) || `Level ${exp.growth_level || 1}`;

  const title = exp.title || "Eksperimen";

  const dailyUrl = `/experiments/daily?${
    isPreview ? "mode=preview&" : ""
  }experimentId=${encodeURIComponent(exp.id)}`;

  const totalDays = totalDaysOf(exp);
  const start = parseDateOnly(exp.start_date);
  const end = start ? addDays(start, totalDays - 1) : null;

  const periodLabel = start
    ? `${fmtDate(start, { day: "numeric", month: "short" })} - ${fmtDate(end, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })}`
    : "Tanggal belum tersedia";

  const goSample = (kind) => {
      window.location.assign(
        `/experiments/hasil?mode=preview&status=${kind}`
    );
  };

  const previewBanner = isPreview && (
    <div className="rounded-[14px] border border-violet-200 bg-violet-50 px-4 py-3 text-[11px] leading-relaxed text-violet-700">
      <b>Mode preview.</b> Halaman ini membaca data simulasi dari Rancangan dan
      Daily yang tersimpan sementara di browser. Tidak ada data yang dikirim
      ke database.

      <div className="mt-3 flex flex-wrap gap-2">
        {[
          ["completed", "Contoh: Selesai"],
          ["stopped", "Contoh: Dihentikan"],
          ["expired", "Contoh: Periode berakhir"],
          ["active", "Contoh: Masih berjalan"],
        ].map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            onClick={() => goSample(kind)}
            className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-[10px] font-bold text-violet-700"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );

  const noticeBanner = data.notice && (
    <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] leading-relaxed text-amber-700">
      {data.notice}
    </div>
  );

  /* =====================================
     EKSPERIMEN BELUM SELESAI
     (planned / active tidak menghasilkan evaluasi akhir)
  ===================================== */

  if (!isFinal) {
    const recorded = rows.length;

    return (
      <main className="relative isolate min-h-screen w-full overflow-x-clip px-3 pb-10 pt-4 md:px-6 lg:px-8">
  <div className="relative z-10 mx-auto w-full max-w-3xl space-y-4">
      {previewBanner}
          {noticeBanner}

          <section className="rounded-2xl border border-violet-100 bg-white/95 p-6 text-center shadow-sm">
            <div className="text-4xl">{status === "active" ? "⏳" : "📅"}</div>

            <h1 className="mt-3 text-lg font-extrabold text-violet-950">
              {status === "active"
                ? "Hasil akhir belum tersedia"
                : "Eksperimen belum dijalankan"}
            </h1>

            <p className="mt-1 text-sm font-bold text-violet-700">{title}</p>

            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              {status === "active"
                ? `Eksperimen masih berjalan (${periodLabel}). Evaluasi akhir dibuat otomatis setelah eksperimen selesai, dihentikan, atau periodenya berakhir. Check-in yang tercatat saat ini: ${recorded} hari.`
                : "Eksperimen ini belum berstatus berjalan, jadi belum ada hasil yang dapat dievaluasi. Jalankan eksperimen dari halaman Rancangan terlebih dahulu."}
            </p>

            {(status === "active" || isPreview) && (
              <button
                type="button"
                onClick={() => router.push(dailyUrl)}
                className="mt-5 rounded-full bg-violet-600 px-6 py-3 text-sm font-bold text-white"
              >
                Lanjut ke Daily Check-in
              </button>
            )}
          </section>
        </div>
      </main>
    );
  }

  /* =====================================
     EVALUASI (status akhir)
     Jika hasil sudah tersimpan, kesimpulannya dibaca dari
     experiment_results, bukan dibuat ulang.
  ===================================== */

  const today = addDays(startOfToday(), isPreview ? offset : 0);
  const stored = readStoredEvaluation(result);

  const ev = buildEvaluation(exp, rows, {
    margin,
    result,
    isPreview,
    today,
    forced: stored
      ? {
          elapsed: stored.duration?.elapsed_days,
          estimatedDay: stored.duration?.stop_estimated_day ?? null,
        }
      : null,
  });

  const sum = stored
    ? {
        status: stored.status ?? ev.summary.status,
        title: stored.title ?? ev.summary.title,
        description: stored.description ?? ev.summary.description,
        conclusion: stored.conclusion ?? ev.summary.conclusion,
        reasons: Array.isArray(stored.reasons) ? stored.reasons : ev.summary.reasons,
        limitations: Array.isArray(stored.limitations)
          ? stored.limitations
          : ev.summary.limitations,
      }
    : ev.summary;

  const verdictLabel = stored?.verdict_label || ev.verdict.label;

  const stopped = status === "stopped";
  const expired = status === "expired";

  const m = ev.metric;
  const f = ev.finance;

  const statusText = stopped ? "Dihentikan" : expired ? "Periode berakhir" : "Selesai";

  const statusSub = stopped
    ? `Dijalankan ${ev.elapsed} dari ${ev.totalDays} hari`
    : expired
      ? "Periode sudah lewat sebelum diselesaikan"
      : `Selesai dalam ${ev.totalDays} hari`;

  const missedCount = ev.missedDays.length;

  const savedAt = result?.evaluated_at
    ? new Date(result.evaluated_at).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  // Penjelasan durasi eksperimen yang dihentikan (jujur terhadap batas data)
  const stopNote = (() => {
    if (!stopped || !ev.stop) return "";

    const parts = [];

    if (ev.stop.provenDay > 0) {
      parts.push(`Aktivitas tercatat sampai hari ke-${ev.stop.provenDay}.`);
    } else {
      parts.push("Tidak ada aktivitas harian yang tercatat sebelum penghentian.");
    }

    if (ev.stop.estimatedDay && ev.stop.estimatedDay !== ev.stop.provenDay) {
      parts.push(
        `Perkiraan penghentian di hari ke-${ev.stop.estimatedDay} (tidak dapat dipastikan karena waktu penghentian tidak tersimpan khusus).`
      );
    }

    if (ev.notRunDays.length > 0) {
      parts.push(
        `${formatDays(ev.notRunDays)} tidak dijalankan karena eksperimen sudah berhenti.`
      );
    }

    return parts.join(" ");
  })();

  const tone = TONE_BOX[ev.verdict.tone] || TONE_BOX.neutral;

  const goHistory = () => router.push("/history");
  const goInsight = () => router.push("/insights");

  /* =====================================
     TAMPILAN
  ===================================== */

  return (
    <main className="relative isolate min-h-full w-full min-w-0 overflow-x-clip pb-10">
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden opacity-60">
        <div className="absolute -left-8 top-36 h-40 w-40 rounded-full bg-pink-100/50 blur-3xl" />
        <div className="absolute -right-8 top-72 h-52 w-52 rounded-full bg-violet-200/50 blur-3xl" />
        <div className="absolute bottom-40 left-10 h-48 w-48 rounded-full bg-emerald-100/50 blur-3xl" />
      </div>

      <div className="relative z-10 w-full space-y-6">
        {previewBanner}
        {noticeBanner}

                {/* HEADER */}

        <header>
          <p className="mb-2 text-sm font-semibold text-pink-ink">
            {stopped
              ? "EKSPERIMEN DIHENTIKAN"
              : expired
                ? "PERIODE EKSPERIMEN BERAKHIR"
                : "HASIL EKSPERIMEN"}
          </p>

          <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
            {title}
          </h1>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Hasil dibaca dari rancangan eksperimen dan Daily Check-in yang
            kamu isi, lalu dievaluasi otomatis berdasarkan data yang
            benar-benar tercatat.
          </p>
        </header>

        {/* RINGKASAN EKSPERIMEN */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-5">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-lg font-extrabold text-emerald-700">
              ⚡
            </div>

            <div className="min-w-0">
              <h2 className="text-sm font-extrabold text-violet-950 md:text-base">
                {title}
              </h2>

              <span className="mt-1 inline-block rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                {category}
              </span>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <SummaryCard
              label="Status eksperimen"
              value={statusText}
              sub={statusSub}
              tone={stopped ? "rose" : expired ? "amber" : "green"}
            />

            <SummaryCard
              label="Hasil terhadap target"
              value={verdictLabel}
              sub={
                m.percentage !== null
                  ? `${m.percentage}% dari target`
                  : "Persentase tidak tersedia"
              }
              tone={ev.verdict.tone === "rose" ? "neutral" : ev.verdict.tone}
            />

            <SummaryCard
              label="Periode"
              value={periodLabel}
              sub={
                stopped
                  ? `Durasi pelaksanaan ${ev.elapsed} dari ${ev.totalDays} hari`
                  : `${ev.totalDays} hari`
              }
            />

            <SummaryCard
              label="Kelengkapan check-in"
              value={
                ev.completeness !== null
                  ? `${ev.completeDays.length} dari ${ev.elapsed} hari`
                  : "Tidak ada data"
              }
              sub={
                ev.completeness !== null
                  ? `${ev.completeness.toLocaleString("id-ID")}% lengkap · ${missedCount} hari terlewat`
                  : "Belum ada hari yang dijalani"
              }
            />
          </div>
        </section>

        {/* 1. PENCAPAIAN TARGET */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <SectionTitle
              number="1"
              title="Pencapaian Target"
              description="Metrik utama mengikuti rancangan eksperimen, nilai aktual dari Daily Check-in."
            />

            <span
              className={`mb-4 rounded-full px-3 py-1 text-[10px] font-bold ${tone.chip}`}
            >
              {verdictLabel}
            </span>
          </div>

          <div className="mb-3 rounded-xl bg-violet-50 px-3 py-2 text-xs text-violet-950">
            <span className="text-[10px] text-slate-500">Metrik utama</span>
            <p className="font-extrabold">{m.name}</p>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <MetricCard
              title="Nilai awal (baseline)"
              value={m.baseline !== null ? fmtMetric(m.kind, m.baseline) : "Tidak tersedia"}
              sub="Dari rancangan eksperimen"
            />

            <MetricCard
              title="Target"
              value={m.target !== null ? fmtMetric(m.kind, m.target) : "Tidak tersedia"}
              sub="Dari rancangan eksperimen"
            />

            <MetricCard
              title={stopped ? "Nilai aktual sampai berhenti" : "Nilai aktual"}
              value={m.actual !== null ? fmtMetric(m.kind, m.actual) : "Tidak tercatat"}
              sub={
                m.percentage !== null
                  ? `${m.percentage}% dari target`
                  : "Tidak dapat dibandingkan dengan target"
              }
              green={m.targetMet === true}
            />
          </div>

          <div className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-[10px] leading-relaxed text-slate-500 md:text-xs">
            <b className="text-violet-950">Catatan:</b>{" "}
            {m.source === "metric_value"
              ? "Nilai aktual dijumlahkan dari nilai metrik harian di Daily Check-in."
              : m.source === "revenue_today"
                ? "Nilai aktual dijumlahkan dari revenue harian di Daily Check-in."
                : "Tidak ada nilai metrik yang tercatat, jadi sistem tidak mengarang nilai aktual."}
          </div>

          {Array.isArray(parseJson(exp.success_criteria, [])) &&
            parseJson(exp.success_criteria, []).length > 0 && (
              <div className="mt-3 grid gap-2 md:grid-cols-3">
                {parseJson(exp.success_criteria, []).map((item, index) => (
                  <div
                    key={index}
                    className="rounded-xl border border-violet-100 bg-[#fcfaff] p-3"
                  >
                    <p className="text-[11px] font-extrabold text-violet-950">
                      {typeof item === "string" ? `Kriteria ${index + 1}` : item?.title || `Kriteria ${index + 1}`}
                    </p>

                    <p className="mt-1 text-[10px] leading-relaxed text-slate-500">
                      {typeof item === "string" ? item : item?.description || ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
        </section>

        {/* 2. PELAKSANAAN DAN KELENGKAPAN CHECK-IN */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <SectionTitle
              number="2"
              title="Pelaksanaan dan Kelengkapan Check-in"
              description="Rencana per hari dibandingkan dengan yang benar-benar dicatat."
            />

            <button
              type="button"
              onClick={() => setShowNotes((open) => !open)}
              aria-expanded={showNotes}
              className="shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-[10px] font-bold text-violet-700 transition hover:bg-violet-100 md:text-xs"
            >
              {showNotes ? "Sembunyikan catatan ▴" : "Lihat semua catatan ▾"}
            </button>
          </div>

          <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard
              title="Durasi pelaksanaan"
              value={`${ev.elapsed} dari ${ev.totalDays} hari`}
              sub={stopped ? "Eksperimen dihentikan" : "Periode eksperimen"}
            />

            <MetricCard
              title="Check-in lengkap"
              value={`${ev.completeDays.length} hari`}
              sub={
                ev.completeness !== null
                  ? `${ev.completeness.toLocaleString("id-ID")}% dari hari yang dijalani`
                  : "Belum ada hari yang dijalani"
              }
              green={ev.completeness !== null && ev.completeness >= 75}
            />

            <MetricCard
              title="Terlewat / sebagian"
              value={`${ev.missedDays.length} / ${ev.partialDays.length}`}
              sub="Hari belum datang tidak dihitung terlewat"
              warn={ev.missedDays.length > 0}
            />

            <MetricCard
              title="Tugas tercatat"
              value={
                ev.tasks.planned > 0
                  ? `${ev.tasks.recorded} dari ${ev.tasks.planned}`
                  : `${ev.tasks.recorded}`
              }
              sub="Dibanding tugas pada rencana harian"
            />
          </div>

          {/* TIMELINE */}
          <div className="relative mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-7">
            <div className="absolute left-[7%] right-[7%] top-[-8px] hidden border-t border-dashed border-violet-300 md:block" />

            {ev.days.map((d) => {
              const st = DAY_STATE[d.state];

              return (
                <div
                  key={d.day}
                  className="relative min-w-0 rounded-xl border border-violet-100 bg-[#fcfaff] p-2 md:pt-3"
                >
                  <div
                    className={`absolute -top-[13px] left-1/2 hidden h-3 w-3 -translate-x-1/2 rounded-full border-2 border-white md:block ${st.dot}`}
                  />

                  <p className="text-[11px] font-extrabold text-violet-950">
                    Hari {d.day}
                  </p>

                  <p className="mt-1 text-[9px] text-slate-500">
                    {fmtDate(d.date, { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  <span
                    className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold ${st.chip}`}
                  >
                    {st.label}
                  </span>

                  <p className="mt-2 text-[10px] leading-relaxed text-slate-600">
                    {d.plan.label || "Rencana tidak tersedia"}
                  </p>

                  {d.day <= ev.elapsed && d.plan.tasks.length > 0 && (
                    <p className="mt-1 text-[9px] text-slate-400">
                      Tugas tercatat {d.recordedDone}/{d.plan.tasks.length}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-slate-500">
            {["complete", "partial", "missed", "not_run"].map((key) => (
              <span key={key} className="flex items-center gap-1.5">
                <span className={`h-2.5 w-2.5 rounded-full ${DAY_STATE[key].dot}`} />
                {DAY_STATE[key].label}
              </span>
            ))}
          </div>

          {/* DETAIL PER HARI */}
          {showNotes && (
            <div className="mt-4 space-y-3 border-t border-violet-100 pt-4">
              <p className="text-[10px] leading-relaxed text-slate-500">
                Isi Daily Check-in apa adanya. Bagian yang kosong ditampilkan
                sebagai tidak tersedia.
              </p>

              <div className="grid gap-3 md:grid-cols-2">
                {ev.days
                  .filter((d) => d.row)
                  .map((d) => (
                    <div
                      key={d.day}
                      className="min-w-0 rounded-xl border border-violet-100 bg-[#fcfaff] p-4"
                    >
                      <p className="text-xs font-extrabold text-violet-950">
                        Hari {d.day}
                        <span className="ml-2 text-[10px] font-medium text-slate-500">
                          {fmtDate(d.date, { day: "numeric", month: "short" })}
                        </span>
                      </p>

                      <p className="mb-3 text-[10px] text-slate-500">
                        {d.plan.label || "Rencana tidak tersedia"}
                      </p>

                      {/* tugas */}
                      <div className="mb-3 overflow-hidden rounded-lg border border-violet-100 bg-white">
                        {d.steps.length > 0 ? (
                          d.steps.map((s, i) => (
                            <div
                              key={i}
                              className="flex items-start gap-2.5 border-b border-violet-50 px-3 py-2 last:border-b-0"
                            >
                              <span
                                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${
                                  s.done
                                    ? "border-violet-600 bg-violet-600 text-white"
                                    : "border-slate-300 bg-white text-transparent"
                                }`}
                              >
                                ✓
                              </span>

                              <p className="min-w-0 flex-1 text-[11px] leading-relaxed text-slate-600">
                                {s.task}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="px-3 py-2 text-[11px] text-slate-400">
                            Checklist tugas tidak tersedia.
                          </p>
                        )}
                      </div>

                      {/* angka */}
                      <div className="mb-3 grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-emerald-50 px-3 py-2">
                          <p className="text-[10px] text-slate-500">Revenue</p>
                          <p className="text-sm font-extrabold text-emerald-700">
                            {d.revenue !== null ? rp(d.revenue) : "Tidak tersedia"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-pink-50 px-3 py-2">
                          <p className="text-[10px] text-slate-500">Biaya</p>
                          <p className="text-sm font-extrabold text-rose-600">
                            {d.cost !== null ? rp(d.cost) : "Tidak tersedia"}
                          </p>
                        </div>
                      </div>

                      {d.metricValue !== null && (
                        <p className="mb-3 text-[11px] text-slate-600">
                          Nilai metrik hari ini:{" "}
                          <b>{fmtMetric(m.kind, d.metricValue)}</b>
                        </p>
                      )}

                      {/* catatan */}
                      <div className="space-y-2 text-[11px] leading-relaxed">
                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[10px] font-bold text-violet-600">Perasaan</p>
                          <p className="text-slate-600">
                            {d.note?.mood || "Tidak tersedia"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[10px] font-bold text-emerald-700">Perkembangan</p>
                          <p className="whitespace-pre-wrap break-words text-slate-600">
                            {d.note?.progress || "Tidak tersedia"}
                          </p>
                        </div>

                        <div className="rounded-lg bg-white px-3 py-2">
                          <p className="text-[10px] font-bold text-rose-600">Kendala</p>
                          <p className="whitespace-pre-wrap break-words text-slate-600">
                            {d.note?.obstacle || "Tidak tersedia"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>

              {ev.days.every((d) => !d.row) && (
                <p className="rounded-xl bg-slate-50 px-3 py-3 text-xs text-slate-500">
                  Tidak ada data harian yang tersimpan.
                </p>
              )}
            </div>
          )}
        </section>

        {/* 3. HASIL KEUANGAN */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-5">
          <SectionTitle
            number="3"
            title="Hasil Keuangan"
            description="Dihitung dari revenue dan biaya yang kamu catat. Yang datanya belum cukup tidak ditampilkan angkanya."
          />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
            <MetricCard
              title="Total pemasukan tercatat"
              value={f.hasRevenue ? rp(f.revenue) : "Tidak tersedia"}
              sub="Jumlah revenue harian"
            />

            <MetricCard
              title="Total biaya eksperimen"
              value={f.hasCost ? rp(f.cost) : "Tidak tersedia"}
              sub="Jumlah biaya harian"
            />

            <MetricCard
              title="Estimasi laba kotor"
              value={f.gross !== null ? rp(f.gross) : "Tidak tersedia"}
              sub={
                f.margin > 0
                  ? `Pemasukan × margin ${(f.margin * 100).toFixed(0)}%`
                  : "Margin produk belum tersedia"
              }
            />

            <MetricCard
              title="Laba bersih eksperimen"
              value={f.net !== null ? rp(f.net) : "Tidak tersedia"}
              sub="Laba kotor − biaya eksperimen"
              green={f.net !== null && f.net >= 0}
              warn={f.net !== null && f.net < 0}
            />

            <MetricCard
              title="ROI"
              value={f.roi !== null ? `${f.roi.toLocaleString("id-ID")}%` : "Tidak tersedia"}
              sub={f.roi !== null ? "Laba bersih ÷ biaya" : "Perlu biaya lebih dari nol"}
            />

            <MetricCard
              title="Selisih dibanding hari biasa"
              value={f.additional !== null ? rp(f.additional) : "Tidak tersedia"}
              green={f.additional !== null && f.additional > 0}
              warn={f.additional !== null && f.additional < 0}
              sub={
                f.additional !== null
                  ? `${f.additional >= 0 ? "Naik" : "Turun"} ${Math.abs(
                    Math.round((f.additional / m.baseline) * 100)
                  )}% dari omzet biasa selama ${ev.elapsed} hari`
                  : "Perlu data omzet lengkap dan baseline"
              }
            />
          </div>

          {f.breakEven !== null && (
            <p className="mt-3 text-xs text-slate-600">
              Titik impas: sekitar <b>{f.breakEven.toLocaleString("id-ID")}</b> pesanan untuk menutup biaya eksperimen.
            </p>
          )}
        </section>

        {/* 5. KESIMPULAN SISTEM */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-6">
          <SectionTitle
            number="4"
            title="Kesimpulan Sistem"
            description="Evaluasi otomatis berdasarkan status akhir dan bukti yang tersedia."
          />

          <div className={`rounded-2xl border p-4 sm:p-5 ${tone.box}`}>
            <span
              className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-bold ${tone.chip}`}
            >
              {sum.status}
            </span>

            <h3 className="mt-3 text-lg font-extrabold leading-snug text-violet-950 sm:text-xl">
              {sum.title}
            </h3>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className={`border-l-4 pl-3 ${tone.bar}`}>
                <p className="text-[11px] font-extrabold text-violet-950">
                  Yang terlihat dari datamu
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {sum.description}
                </p>
              </div>

              <div className={`border-l-4 pl-3 ${tone.bar}`}>
                <p className="text-[11px] font-extrabold text-violet-950">
                  Artinya untuk usahamu
                </p>

                <p className="mt-1 text-xs leading-relaxed text-slate-600">
                  {sum.conclusion}
                </p>
              </div>
            </div>

            {sum.reasons.length > 0 && (
              <div className="mt-4 rounded-xl bg-white/80 px-4 py-3">
                <p className="text-[11px] font-extrabold text-violet-950">
                  Alasan berdasarkan data
                </p>

                <ul className="mt-2 space-y-1.5">
                  {sum.reasons.map((r, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-slate-600">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-400" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {sum.limitations.length > 0 && (
              <div className="mt-3 rounded-xl bg-amber-50/80 px-4 py-3">
                <p className="text-[11px] font-extrabold text-amber-700">
                  Keterbatasan data
                </p>

                <ul className="mt-2 space-y-1.5">
                  {sum.limitations.map((r, i) => (
                    <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-amber-800/80">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 rounded-xl bg-white/80 px-4 py-3">
              <p className="text-[10px] text-slate-500">Langkah berikutnya</p>

              <p className="text-sm font-extrabold text-violet-950">
                Rekomendasi langkah berikutnya
              </p>

              <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                Rekomendasi untuk eksperimen selanjutnya disiapkan di Growth Insight.
              </p>
            </div>
          </div>

          <p className="mt-3 text-center text-[10px] text-slate-400">
            {data.persist === "saved"
              ? isPreview
                ? "Evaluasi tersimpan sementara di browser (mode preview), tidak dikirim ke database."
                : savedAt
                  ? `Evaluasi tersimpan otomatis ${savedAt}.`
                  : "Evaluasi tersimpan otomatis."
              : data.persist === "failed"
                ? "Evaluasi belum tersimpan ke database."
                : ""}
          </p>
        </section>

        {/* NAVIGASI */}

        <section className="rounded-2xl border border-violet-100 bg-white/95 p-4 shadow-sm md:p-5">
          <h2 className="text-sm font-extrabold text-violet-950">
            Lihat detail lainnya
          </h2>

          <p className="mb-3 text-[11px] text-slate-500">
            Catatan harian lengkap ada di Experiment History. Rekomendasi
            langkah berikutnya ada di Growth Insight.
          </p>

          <div className="grid gap-3 md:grid-cols-2">
            <button
              type="button"
              onClick={goHistory}
              className="flex items-center justify-between rounded-xl border border-violet-100 p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <div>
                <p className="text-xs font-extrabold text-violet-950">
                  Lihat Experiment History
                </p>

                <p className="mt-1 text-[10px] text-slate-500">
                  Akses catatan harian lengkap dan detail aktivitas.
                </p>
              </div>

              <span className="font-bold text-violet-600">→</span>
            </button>

            <button
              type="button"
              onClick={goInsight}
              className="flex items-center justify-between rounded-xl border border-violet-200 bg-violet-50 p-4 text-left transition hover:bg-violet-100"
            >
              <div>
                <p className="text-xs font-extrabold text-violet-950">
                  Lihat di Growth Insight
                </p>

                <p className="mt-1 text-[10px] text-slate-500">
                  Dapatkan analisis, pola yang terlihat, dan rekomendasi langkah berikutnya.
                </p>
              </div>

              <span className="font-bold text-violet-600">→</span>
            </button>
          </div>
        </section>

        <p className="pb-4 pt-2 text-center text-[10px] text-slate-400">
          ElevatePuan · Setiap langkah kecil membawa usahamu berkembang.
        </p>
      </div>
    </main>
  );
}