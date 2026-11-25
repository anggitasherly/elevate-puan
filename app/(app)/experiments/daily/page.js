"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";

/*
 * Halaman ini tidak lagi memanggil Supabase langsung.
 * Alur: Browser -> /api/experiments/* -> Supabase.
 *   - GET  /api/experiments/detail          (memuat data)
 *   - POST /api/experiments/[id]/checkin    (simpan catatan / keuangan)
 *   - POST /api/experiments/[id]/finish     (selesai / hentikan / kedaluwarsa)
 * Mode preview tetap memakai data demo dan sessionStorage.
 */

/* =========================================
   KONSTANTA
========================================= */

const EXPERIMENT_DURATION_DAYS = 7;

/*
 * true  = jika data asli gagal dimuat (belum login, eksperimen tidak
 *         ditemukan, dsb.), halaman otomatis menampilkan mode preview.
 * false = tampilkan layar error seperti biasa.
 * Ubah ke false saat aplikasi sudah dipakai pengguna sungguhan.
 */
const AUTO_PREVIEW_FALLBACK = false;

const STATUS = {
  ACTIVE: "active",
  LEGACY_RUNNING: "running",
  COMPLETED: "completed",
  STOPPED: "stopped",
  EXPIRED: "expired",
};

// active = status sekarang, running = status lama (kompatibilitas)
const ACTIVE_STATUSES = [STATUS.ACTIVE, STATUS.LEGACY_RUNNING];

const moods = ["Lancar", "Lumayan", "Agak sulit"];

/* =========================================
   DATA DEMO UNTUK MODE PREVIEW
   Tidak pernah dikirim ke server / database.
========================================= */

const DEMO_FINANCE = {
  margin: 0.4,
  budget: 100000,
};

const DEMO_DAILY_PLAN = [
  {
    day: 1,
    title: "Pilih produk jagoan",
    focus:
      'Pilih satu produk "jagoan" supaya pesan flash sale kuat dan tidak membingungkan.',
    tasks: [
      "Cek stok skincare yang kamu punya sekarang",
      "Pilih 1 produk dengan stok terbanyak atau yang paling disukai pembeli",
      "Tentukan harga normal dan harga promo (pastikan masih di atas modal)",
    ],
    hint: [
      "Produk serum, stok 40 botol, paling sering ditanyakan di DM.",
      "Bingung memilih antara dua produk yang sama-sama laku.",
    ],
  },
  {
    day: 2,
    title: "Siapkan materi promosi",
    focus: "Siapkan amunisi visual untuk flash sale.",
    tasks: [
      "Buat flyer sederhana dengan aplikasi desain gratis di HP",
      'Tulis judul yang kuat, misalnya "Grebek Flash Sale 3 Jam Saja (16.00–19.00)"',
      "Pastikan harga coret terlihat jelas di flyer",
    ],
    hint: [
      "Flyer sudah jadi, harga coret dan harga promo sudah terlihat jelas.",
      "Aplikasi desain agak lambat dan susah mengatur tulisan.",
    ],
  },
  {
    day: 3,
    title: "Mulai beri bocoran",
    focus: 'Mulai beri "bocoran" supaya calon pembeli penasaran.',
    tasks: [
      "Posting teaser di Story WhatsApp",
      "Posting teaser di Story Instagram dengan foto produk",
      'Tulis teks yang bikin penasaran, misalnya "Besok ada kejutan, siap-siap jam 4 sore ya!"',
    ],
    hint: [
      "Teaser sudah tayang di WA dan IG, beberapa orang menanyakan kejutannya.",
      "Bingung menulis teks teaser yang menarik.",
    ],
  },
  {
    day: 4,
    title: "Kirim pengingat",
    focus: "Kirim pengingat terakhir dan bangun rasa urgensi.",
    tasks: [
      "Kirim reminder satu jam sebelum mulai (sekitar jam 15.00)",
      'Posting story pengingat, misalnya "Satu jam lagi Flash Sale dimulai! Stok terbatas"',
      "Pastikan stok produk siap dan kamu bisa fokus membalas pesan jam 16.00–19.00",
    ],
    hint: [
      "Reminder terkirim ke calon pembeli yang pernah tanya harga.",
      "Takut stok kurang kalau peminatnya banyak.",
    ],
  },
  {
    day: 5,
    title: "Jalankan flash sale",
    focus: "Hari flash sale: buka promo tepat waktu dan jaga rasa urgensi.",
    tasks: [
      "Buka promo tepat jam 16.00",
      'Update story setiap ada pembelian, misalnya "Tinggal 5 paket lagi!"',
      "Balas semua DM dan catat setiap pembelian selama 3 jam",
    ],
    hint: [
      "Ada beberapa pembeli yang tadinya cuma tanya harga lalu langsung transfer.",
      "Pesan masuk terlalu banyak sehingga pencatatan agak tertinggal.",
    ],
  },
  {
    day: 6,
    title: "Tutup promo",
    focus: "Tutup promo tepat waktu supaya pembeli percaya batas waktunya serius.",
    tasks: [
      "Tutup promo tepat jam 19.00",
      'Umumkan dengan ramah: "Mohon maaf, Flash Sale sudah berakhir. Harga kembali normal."',
      "Tindak lanjuti pembeli yang sudah checkout (konfirmasi dan pengiriman)",
    ],
    hint: [
      "Promo ditutup tepat waktu dan pengumuman sudah diposting.",
      "Ada yang minta harga promo setelah promo berakhir.",
    ],
  },
  {
    day: 7,
    title: "Evaluasi hasil",
    focus: "Rayakan hasilnya dan catat pelajaran dari eksperimen.",
    tasks: [
      "Rekap semua penjualan dari flash sale",
      "Bandingkan omzet 3 jam flash sale dengan hari-hari biasa",
      "Tulis apa yang berhasil dan apa yang perlu diperbaiki",
    ],
    hint: [
      "Omzet 3 jam flash sale lebih tinggi dari rata-rata hari biasa.",
      "Sulit memisahkan penjualan flash sale dari penjualan biasa.",
    ],
  },
];

function buildDemoExperiment() {
  const id = generatePreviewId();

  const start = startOfToday();
  const end = addDays(start, EXPERIMENT_DURATION_DAYS - 1);

  return {
    id,
    business_id: "demo-business",
    proposal_id: "demo-proposal",
    title: "Grebek Flash Sale 3 Jam",
    channels: ["Flash Sale"],
    metric_name: `Total omzet usaha selama ${EXPERIMENT_DURATION_DAYS} hari`,
    baseline_value: 0,
    target_value: 250000,
    budget_planned: 0,
    growth_level: 1,
    start_date: dateOnly(start),
    end_date: dateOnly(end),
    status: STATUS.ACTIVE,
    daily_plan: DEMO_DAILY_PLAN,
    is_preview: true,
  };
}

/* =========================================
   HELPER UMUM
========================================= */

const card =
  "rounded-[20px] border border-[#e9e7f3]/90 bg-white/80 shadow-[0_4px_15px_rgba(67,51,130,0.055)] backdrop-blur-[2px]";

const fmt = (date, options) => date.toLocaleDateString("id-ID", options);

const toNumber = (value) => {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

// FORMAT ANGKA RUPIAH
const formatRupiah = (value) => {
  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
};

// FORMAT RUPIAH DENGAN TANDA (untuk nilai yang bisa negatif)
const formatRupiahSigned = (value) => {
  const n = Math.round(Number(value) || 0);
  return `${n < 0 ? "-" : ""}Rp ${formatRupiah(Math.abs(n))}`;
};

// FORMAT INPUT RUPIAH
const formatInputRupiah = (value) => {
  if (value === "" || value === null || value === undefined) {
    return "";
  }

  const angka = String(value).replace(/\D/g, "");

  if (!angka) return "";

  return new Intl.NumberFormat("id-ID", {
    maximumFractionDigits: 0,
  }).format(Number(angka));
};

// MENGAMBIL ANGKA ASLI TANPA TITIK
const parseRupiah = (value) => {
  return String(value).replace(/\D/g, "");
};

const formatTime = (value) => {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) return "";

  return date
    .toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(":", ".");
};

function generatePreviewId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return `preview-${crypto.randomUUID()}`;
  }

  return `preview-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/* =========================================
   HELPER TANGGAL (KALENDER LOKAL)
========================================= */

function dateOnly(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateOnly(value) {
  if (!value) return null;

  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const [year, month, day] = value
      .slice(0, 10)
      .split("-")
      .map(Number);

    return new Date(year, month - 1, day);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function addDays(date, amount) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + amount
  );
}

// Selisih hari kalender (bukan selisih jam)
function daysBetween(from, to) {
  const a = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const b = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());

  return Math.round((b - a) / 86400000);
}

/* =========================================
   HELPER JSONB DAN RENCANA HARIAN
========================================= */

function parseJson(value, fallback = []) {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  return value;
}

function itemText(item) {
  if (typeof item === "string") return item;

  return (
    item?.title ||
    item?.description ||
    item?.task ||
    item?.text ||
    ""
  );
}

function toTaskList(value) {
  const parsed = parseJson(value, []);

  if (Array.isArray(parsed)) {
    return parsed.map(itemText).map((t) => String(t).trim()).filter(Boolean);
  }

  if (typeof parsed === "string") {
    return parsed
      .split(/\s*•\s*|\n/)
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return [];
}

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

/*
 * Mengambil fokus, tugas (maksimal 3), dan contoh isian untuk satu hari
 * dari daily_plan. Tidak membuat tugas buatan: jika AI hanya memberi
 * 1 tugas, checklist hanya 1.
 */
function extractDayInfo(rawPlan, day) {
  const list = planToArray(rawPlan);

  const item = list.find((entry, index) => {
    if (typeof entry === "string") return index + 1 === day;

    const value = Number(
      entry?.day ?? entry?.day_number ?? entry?.hari ?? index + 1
    );

    return value === day;
  });

  if (!item) return null;

  if (typeof item === "string") {
    return {
      focus: item,
      tasks: toTaskList(item).slice(0, 3),
      hint: [],
    };
  }

  const title = String(item.title || item.name || "").trim();
  const meaningfulTitle = title && title !== `Hari ${day}` ? title : "";
  const description = String(item.description || item.detail || "").trim();

  let tasks = toTaskList(
    item.tasks ?? item.checklist ?? item.activities ?? item.steps
  );

  if (tasks.length === 0) tasks = toTaskList(description);
  if (tasks.length === 0 && meaningfulTitle) tasks = [meaningfulTitle];

  const hintRaw = parseJson(item.hint ?? item.hints, []);

  return {
    focus:
      item.focus ||
      meaningfulTitle ||
      description ||
      `Kerjakan tugas hari ke-${day}.`,
    tasks: tasks.slice(0, 3),
    hint: Array.isArray(hintRaw) ? hintRaw.map(String) : [],
  };
}

function allTasksLabel(total) {
  if (total <= 1) return "tugas di atas";
  if (total === 2) return "kedua tugas di atas";
  return "ketiga tugas di atas";
}

/* =========================================
   HELPER CHECK-IN
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

// Bentuk catatan untuk ditampilkan (hari ini maupun hari lain)
function buildSavedNote(row) {
  if (!isNoteSaved(row)) return null;

  const steps = parseJson(row.steps_done, []);
  const savedAt = Array.isArray(steps) ? steps[0]?.saved_at : null;

  return {
    progress: row.progress_note,
    obstacle: row.obstacle || "",
    mood: row.mood,
    time: savedAt ? formatTime(savedAt) : "",
  };
}

function readPreviewCheckins(experimentId) {
  try {
    const raw = sessionStorage.getItem(
      `ep_preview_checkins_${experimentId}`
    );
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePreviewCheckins(experimentId, rows) {
  sessionStorage.setItem(
    `ep_preview_checkins_${experimentId}`,
    JSON.stringify(rows)
  );
}

function writePreviewExperiment(experiment) {
  const text = JSON.stringify(experiment);

  sessionStorage.setItem(`ep_preview_experiment_${experiment.id}`, text);
  sessionStorage.setItem("ep_preview_experiment", text);
  sessionStorage.setItem("ep_current_experiment_id", experiment.id);
}

// Galat dari server belum login (status 401)
function isAuthMissing(err) {
  const message = String(err?.message || "");

  return (
    err?.status === 401 ||
    err?.name === "AuthSessionMissingError" ||
    /auth session missing/i.test(message)
  );
}

// Pesan yang mudah dipahami untuk alasan jatuh ke mode preview
function friendlyReason(err) {
  if (isAuthMissing(err)) {
    return "Kamu belum login, jadi data eksperimen asli belum bisa dibaca.";
  }

  return String(err?.message || "") || "Data eksperimen asli belum bisa dibaca.";
}

/* =========================================
   KEUANGAN (Financial Readiness)
========================================= */

function calculateFinanceLimits(data) {
  if (!data) return { margin: 0, budget: 0 };

  const marginRaw = toNumber(data.product_margin_pct);
  const margin = marginRaw > 1 ? marginRaw / 100 : marginRaw;

  const recommended = data.recommended_budget ?? data.recommended_budge;

  const values = [
    recommended,
    data.free_surplus,
    data.willingness_to_lose,
    data.affordable_loss,
  ];

  if (values.some((v) => v === null || v === undefined)) {
    return { margin, budget: 0 };
  }

  return {
    margin,
    budget: Math.max(0, Math.min(...values.map(toNumber))),
  };
}

/* =========================================
   EVALUASI (experiment_results)
   Dipakai di mode preview. Pada mode asli,
   evaluasi dihitung di server.
========================================= */

const clampInt = (value) =>
  Math.max(
    -2147483648,
    Math.min(2147483647, Math.round(Number(value) || 0))
  );

function buildEvaluation(experiment, rows, margin, status) {
  const revenue = rows.reduce(
    (sum, r) => sum + toNumber(r.revenue_today),
    0
  );

  const cost = rows.reduce(
    (sum, r) => sum + toNumber(r.experiment_cost_today),
    0
  );

  const gross = revenue * margin;
  const net = gross - cost;

  const filledDays = rows.filter(isDayComplete).length;

  const target = toNumber(experiment.target_value);

  let learnings = "";

  if (status === STATUS.COMPLETED) {
    learnings = `Eksperimen diselesaikan sampai Hari ${EXPERIMENT_DURATION_DAYS}. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  } else if (status === STATUS.STOPPED) {
    learnings = `Eksperimen dihentikan oleh pengguna sebelum selesai. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  } else {
    learnings = `Periode eksperimen berakhir sebelum selesai. Check-in lengkap ${filledDays} dari ${EXPERIMENT_DURATION_DAYS} hari.`;
  }

  return {
    actual_value: Math.round(revenue),
    target_met: target > 0 && revenue >= target,
    checkin_completeness:
      Math.round((filledDays / EXPERIMENT_DURATION_DAYS) * 1000) / 10,
    cost_spent: clampInt(cost),
    additional_revenue: clampInt(revenue),
    gross_profit: clampInt(gross),
    net_profit: clampInt(net),
    roi: cost > 0 ? Math.round((net / cost) * 10000) / 100 : null,
    learnings,
  };
}

/* =========================================
   KOMPONEN POP-UP TANPA SCROLLBAR
========================================= */

function Modal({ icon, title, text, onClose, children }) {
  // false saat render di server, true di browserser.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#22204f]/35 px-3 py-3 backdrop-blur-[3px] sm:px-4 sm:py-4">

      <div className="relative w-full max-w-[510px] overflow-hidden rounded-[20px] border border-[#eee8fb] bg-white px-4 py-5 text-center shadow-[0_20px_70px_rgba(45,35,100,0.22)] sm:rounded-[25px] sm:px-10 sm:py-7">

        {/* ORNAMEN */}
        <div className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-[#f8dff2]/70 blur-xl" />

        <div className="pointer-events-none absolute -bottom-10 -right-7 h-32 w-32 rounded-full bg-[#dff8f5]/80 blur-xl" />

        {/* TOMBOL TUTUP */}
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup jendela"
            className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-[#f1eaff] text-[24px] font-medium leading-none text-[#7651d8] transition hover:bg-[#e5d9ff] sm:right-4 sm:top-4 sm:h-10 sm:w-10 sm:text-[28px]"
          >
            ×
          </button>
        )}

        {/* ICON */}
        <div className="relative z-10 mx-auto mb-3 flex h-[72px] w-[72px] items-center justify-center rounded-[22px] bg-gradient-to-br from-[#f5edff] to-[#e9f9f5] sm:mb-5 sm:h-[100px] sm:w-[100px] sm:rounded-[30px]">

          <div className="flex h-[55px] w-[55px] items-center justify-center rounded-[18px] bg-white text-[30px] shadow-[0_5px_20px_rgba(100,75,180,0.12)] sm:h-[76px] sm:w-[76px] sm:rounded-[24px] sm:text-[43px]">
            {icon}
          </div>

          <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-[3px] border-white bg-[#4fc49a] text-[16px] font-extrabold text-white sm:h-10 sm:w-10 sm:border-[4px] sm:text-[22px]">
            ✓
          </span>
        </div>

        {/* JUDUL */}
        <h2 className="relative z-10 text-[18px] font-extrabold leading-snug text-[#40318f] sm:text-[24px]">
          {title}
        </h2>

        {/* DESKRIPSI */}
        <p className="relative z-10 mx-auto mt-2 max-w-[390px] text-[11px] leading-5 text-[#77799c] sm:mt-3 sm:text-[13px] sm:leading-7">
          {text}
        </p>

        {/* TOMBOL */}
        {children && (
          <div className="relative z-10 mt-4 flex flex-col justify-center gap-2 sm:mt-6 sm:flex-row sm:flex-wrap sm:gap-3">
            {children}
          </div>
        )}

        {/* ORNAMEN BAWAH */}
        <div className="pointer-events-none absolute -bottom-4 left-5 text-[28px] opacity-50">
          🌿
        </div>

        <div className="pointer-events-none absolute -bottom-4 right-5 text-[28px] opacity-50">
          🌸
        </div>

      </div>
    </div>,
    document.body
  );
}

/* =========================================
   DAFTAR TUGAS TERKUNCI
   (hari terlewat / hari yang belum dibuka)
========================================= */

function LockedTasks({ tasks = [], label, badgeClass }) {
  return (
    <div className="overflow-hidden rounded-[15px] border border-[#ece9f8] bg-white">
      <div className="divide-y divide-[#f1eefa]">
        {tasks.map((task, index) => (
          <div
            key={index}
            className="flex flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
          >
            <input
              type="checkbox"
              checked={false}
              disabled
              readOnly
              aria-label="Tugas terkunci"
              className="h-5 w-5 shrink-0 accent-violet-600"
            />

            <span className="min-w-0 flex-1 basis-[150px] text-[12px] text-[#77809c] sm:text-[13px]">
              {task}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${badgeClass}`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* =========================================
   KOMPONEN CHECKLIST (MAKS. 3 TUGAS + 1 FORM)
========================================= */

function ChecklistForm({
  tasks = [],
  hint = [],
  saved,
  busy = false,
  onSave,
  onProgress,
}) {
  const [checked, setChecked] = useState(() => tasks.map(() => false));

  const [f, setF] = useState({
    progress: "",
    obstacle: "",
    mood: "",
  });

  const allChecked =
    tasks.length > 0 && checked.every(Boolean);

  const formComplete =
    f.progress.trim() !== "" &&
    f.obstacle.trim() !== "" &&
    f.mood !== "";

  const canSave = allChecked && formComplete && !busy;

  // Beri tahu halaman berapa tugas yang sedang dicentang
  useEffect(() => {
    if (onProgress) {
      onProgress(checked.filter(Boolean).length);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked]);

  function toggle(index) {
    setChecked((old) =>
      old.map((v, i) => (i === index ? !v : v))
    );
  }

  function simpan() {
    if (!canSave || saved) return;

    onSave({
      ...f,
      time: formatTime(),
    });
  }

  /* TAMPILAN SETELAH DISIMPAN (TERKUNCI) */

  if (saved) {
    return (
      <div className="overflow-hidden rounded-[15px] border border-[#ece9f8] bg-white shadow-[0_2px_8px_rgba(67,51,130,0.035)]">
        <div className="divide-y divide-[#f1eefa]">
          {tasks.map((task, index) => (
            <div
              key={index}
              className="flex flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
            >
              <input
                type="checkbox"
                checked
                disabled
                readOnly
                aria-label="Tugas selesai"
                className="h-5 w-5 shrink-0 accent-violet-600"
              />

              <span className="min-w-0 flex-1 basis-[150px] text-[12px] text-[#77809c] sm:text-[13px]">
                {task}
              </span>

              <span className="rounded-full bg-[#e1f7ed] px-3 py-1 text-[10px] font-bold text-[#169574]">
                Selesai
              </span>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-l-[4px] border-[#7651db] bg-gradient-to-r from-[#f3efff] to-[#faf9ff] p-3 sm:gap-4 sm:p-4 md:grid-cols-[1.4fr_1fr_0.7fr]">
          <div className="min-w-0">
            <p className="mb-2 text-[12px] font-extrabold text-[#6544c8]">
              Catatan tersimpan
              {saved.time ? ` • ${saved.time}` : ""}
            </p>

            <p className="mb-1 text-[10px] text-[#8990aa]">
              Perkembangan
            </p>

            <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#414b70]">
              {saved.progress}
            </p>
          </div>

          <div className="min-w-0">
            <p className="mb-1 text-[10px] text-[#8990aa]">
              Kendala
            </p>

            <p className="whitespace-pre-wrap break-words text-[12px] leading-relaxed text-[#414b70]">
              {saved.obstacle}
            </p>
          </div>

          <div>
            <p className="mb-2 text-[10px] text-[#8990aa]">
              Perasaan
            </p>

            <span className="inline-block rounded-full bg-[#e9e1ff] px-3 py-1 text-[11px] font-bold text-[#6749c9]">
              {saved.mood}
            </span>
          </div>
        </div>
      </div>
    );
  }

  /* TAMPILAN SEBELUM DISIMPAN */

  return (
    <div className="overflow-hidden rounded-[15px] border border-[#ece9f8] bg-white">
      {/* DAFTAR TUGAS */}
      <div className="divide-y divide-[#f1eefa]">
        {tasks.map((task, index) => (
          <label
            key={index}
            className="flex cursor-pointer flex-wrap items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4"
          >
            <input
              type="checkbox"
              checked={Boolean(checked[index])}
              onChange={() => toggle(index)}
              aria-label={`Centang tugas ${index + 1}`}
              className="h-5 w-5 shrink-0 cursor-pointer accent-violet-600"
            />

            <span
              className={`min-w-0 flex-1 basis-[150px] text-[12px] sm:text-[13px] ${
                checked[index]
                  ? "text-[#77809c]"
                  : "text-[#39476e]"
              }`}
            >
              {task}
            </span>

            <span
              className={`rounded-full px-3 py-1 text-[10px] font-bold ${
                checked[index]
                  ? "bg-[#e1f7ed] text-[#169574]"
                  : "bg-[#fff0f5] text-[#dc4383]"
              }`}
            >
              {checked[index] ? "Dikerjakan" : "Belum selesai"}
            </span>
          </label>
        ))}
      </div>

      {/* SATU FORM UNTUK SEMUA TUGAS */}
      <div className="space-y-4 border-t border-[#efecf8] bg-[#faf9ff] p-3 sm:space-y-5 sm:p-4">
        <p className="text-[12px] font-extrabold text-[#6544c8]">
          Catatan hari ini
        </p>

        <div>
          <p className="mb-2 text-[12px] font-bold text-[#263b7c]">
            Perasaanmu hari ini{" "}
            <span className="text-[#dc4383]">*</span>
          </p>

          <div className="flex flex-wrap gap-2">
            {moods.map((m) => (
              <button
                type="button"
                key={m}
                onClick={() =>
                  setF((old) => ({
                    ...old,
                    mood: m,
                  }))
                }
                className={`rounded-full border px-3 py-2 text-[10px] font-semibold transition sm:px-4 sm:text-[11px] ${
                  f.mood === m
                    ? "border-[#704bd5] bg-[#704bd5] text-white"
                    : "border-[#e2dcf5] bg-white text-[#6855a6] hover:bg-[#f2eeff]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>

          {!f.mood && (
            <p className="mt-2 text-[10px] text-[#dc4383]">
              Pilih salah satu perasaan sebelum menyimpan.
            </p>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="min-w-0">
            <label className="text-[12px] font-bold text-[#263b7c]">
              Bagaimana perkembangannya?{" "}
              <span className="text-[#dc4383]">*</span>
            </label>

            <textarea
              required
              maxLength={2000}
              className="inp mt-2 w-full min-w-0 rounded-xl border border-[#e6e1f5] bg-white p-3 text-sm outline-none focus:border-[#8b6ce0]"
              rows={3}
              placeholder={
                "Contoh: " +
                (hint[0] || "Ceritakan perkembangan hari ini")
              }
              value={f.progress}
              onChange={(e) =>
                setF((old) => ({
                  ...old,
                  progress: e.target.value,
                }))
              }
            />
          </div>

          <div className="min-w-0">
            <label className="text-[12px] font-bold text-[#263b7c]">
              Apa kendalanya?{" "}
              <span className="text-[#dc4383]">*</span>
            </label>

            <textarea
              required
              maxLength={2000}
              className="inp mt-2 w-full min-w-0 rounded-xl border border-[#e6e1f5] bg-white p-3 text-sm outline-none focus:border-[#8b6ce0]"
              rows={3}
              placeholder={
                "Contoh: " +
                (hint[1] || "Ceritakan kendala hari ini")
              }
              value={f.obstacle}
              onChange={(e) =>
                setF((old) => ({
                  ...old,
                  obstacle: e.target.value,
                }))
              }
            />
          </div>
        </div>

        <div>
          <button
            type="button"
            disabled={!canSave}
            onClick={simpan}
            className="w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-6 py-2.5 text-[12px] font-bold text-white shadow-md transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto"
          >
            Simpan catatan
          </button>

          {!allChecked && (
            <p className="mt-2 text-[10px] text-[#dc4383]">
              Centang {allTasksLabel(tasks.length)} sebelum menyimpan.
            </p>
          )}
        </div>

        <p className="text-[10px] leading-relaxed text-[#9291a5]">
          * Semua kolom wajib diisi sebelum catatan dapat disimpan.
          Catatan yang sudah tersimpan tidak dapat diubah.
        </p>
      </div>
    </div>
  );
}

/* =========================================
   HALAMAN DAILY CHECK-IN
========================================= */

export default function Daily() {
  const router = useRouter();

  const savingRef = useRef(false);
  const finalizingRef = useRef(false);
  const autoAdvanceRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // true kalau server menjawab "eksperimen aktif tidak ditemukan" (404)
  const [noActive, setNoActive] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busy, setBusy] = useState(false);

  const [isPreview, setIsPreview] = useState(false);
  const [previewNotice, setPreviewNotice] = useState("");
  const [exp, setExp] = useState(null);
  const [checkins, setCheckins] = useState([]);
  const [margin, setMargin] = useState(0);
  const [budgetLimit, setBudgetLimit] = useState(0);

  const [realToday, setRealToday] = useState(() => startOfToday());
  const [previewOffset, setPreviewOffset] = useState(0);

  // Hari yang sedang dilihat. null = mengikuti hari kalender (hari ini).
  const [viewOverride, setViewOverride] = useState(null);

  const [liveDone, setLiveDone] = useState(0);
  const [missedDismissed, setMissedDismissed] = useState(false);

  const [fin, setFin] = useState({
    revenue: "",
    cost: "",
  });

  const [successPopup, setSuccessPopup] = useState(null);
  const [stop, setStop] = useState(false);
  const [finishPopup, setFinishPopup] = useState(false);
  const [resultUrl, setResultUrl] = useState("");

  // Sembunyikan footer hanya pada halaman Daily Check-in
  useEffect(() => {
    const footer = document.querySelector("footer");
    const previousDisplay = footer?.style.display;

    if (footer) {
      footer.style.display = "none";
    }

    return () => {
      if (footer) {
        footer.style.display = previousDisplay || "";
      }
    };
  }, []);

  /* =====================================
     NAVIGASI
  ===================================== */

  function hasilUrl(experimentId, preview) {
    return `/experiments/hasil?${
      preview ? "mode=preview&" : ""
    }experimentId=${encodeURIComponent(experimentId)}`;
  }

  function kembali() {
    if (
      typeof window !== "undefined" &&
      window.history.length > 1
    ) {
      router.back();
    } else {
      router.push("/home");
    }
  }

  function bukaPreview() {
    window.location.href =
      window.location.pathname + "?mode=preview";
  }

  /* =====================================
     AMBIL DATA EKSPERIMEN + CHECK-IN
     (mode asli lewat GET /api/experiments/detail)
  ===================================== */

  useEffect(() => {
    let mounted = true;

    /*
     * MODE PREVIEW
     * Hanya memakai sessionStorage. Tidak memanggil server.
     * `reason` diisi bila preview muncul karena data asli gagal dimuat.
     */
    function applyPreview(reason) {
      const params = new URLSearchParams(window.location.search);
      const urlExperimentId = params.get("experimentId")?.trim() || "";

      const storedId = sessionStorage.getItem("ep_current_experiment_id");

      const previewId =
        urlExperimentId.startsWith("preview-")
          ? urlExperimentId
          : storedId?.startsWith("preview-")
            ? storedId
            : "";

      let previewExperiment = null;

      if (previewId) {
        try {
          const raw =
            sessionStorage.getItem(`ep_preview_experiment_${previewId}`) ||
            sessionStorage.getItem("ep_preview_experiment");

          const parsed = raw ? JSON.parse(raw) : null;

          if (parsed?.id === previewId) {
            previewExperiment = parsed;
          }
        } catch {
          previewExperiment = null;
        }
      }

      if (!previewExperiment) {
        previewExperiment = buildDemoExperiment();
        writePreviewExperiment(previewExperiment);
        writePreviewCheckins(previewExperiment.id, []);
      }

      const offset = Number(
        sessionStorage.getItem(
          `ep_preview_day_offset_${previewExperiment.id}`
        )
      );

      if (!mounted) return;

      setIsPreview(true);
      setPreviewNotice(reason || "");
      setError("");
      setExp(previewExperiment);
      setCheckins(readPreviewCheckins(previewExperiment.id));
      setMargin(DEMO_FINANCE.margin);
      setBudgetLimit(DEMO_FINANCE.budget);
      setPreviewOffset(Number.isFinite(offset) && offset > 0 ? offset : 0);
    }

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams(window.location.search);

        const forcePreview = params.get("mode") === "preview";

        if (forcePreview) {
          applyPreview("");
          return;
        }

        /*
         * MODE ASLI
         *
         * Login, kepemilikan bisnis, dan pemilihan eksperimen
         * dicek di server oleh route.
         */

        try {
          const urlExperimentId =
            params.get("experimentId")?.trim() || "";

          const storedId = sessionStorage.getItem(
            "ep_current_experiment_id"
          );

          const experimentId =
            (urlExperimentId && !urlExperimentId.startsWith("preview-")
              ? urlExperimentId
              : "") ||
            (storedId && !storedId.startsWith("preview-")
              ? storedId
              : "");

          const query = new URLSearchParams({ pick: "active" });

          if (experimentId) {
            query.set("experimentId", experimentId);
          }

          const res = await fetch(
            `/api/experiments/detail?${query.toString()}`,
            { cache: "no-store" }
          );

          const payload = await res.json().catch(() => ({}));

          if (!res.ok) {
            const apiError = new Error(
              payload?.error ||
                "Data eksperimen asli belum bisa dibaca."
            );

            apiError.status = res.status;

            throw apiError;
          }

          const experimentData = payload.experiment;

          if (!experimentData) {
            throw new Error(
              "Eksperimen aktif tidak ditemukan. Pilih strategi dan jalankan eksperimen terlebih dahulu."
            );
          }

          sessionStorage.setItem(
            "ep_current_experiment_id",
            experimentData.id
          );

          // Eksperimen yang sudah selesai/berhenti/kedaluwarsa -> halaman Hasil
          if (
            [
              STATUS.COMPLETED,
              STATUS.STOPPED,
              STATUS.EXPIRED,
            ].includes(experimentData.status)
          ) {
            router.replace(hasilUrl(experimentData.id, false));
            return;
          }

          if (!ACTIVE_STATUSES.includes(experimentData.status)) {
            throw new Error(
              "Eksperimen ini belum dijalankan. Jalankan eksperimen dari halaman Rancangan terlebih dahulu."
            );
          }

          const checkinRows = payload.checkins || [];

          // Financial Readiness (margin dan batas biaya)
          const limits = calculateFinanceLimits(payload.finance);

          if (!mounted) return;

          setIsPreview(false);
          setPreviewNotice("");
          setExp(experimentData);
          setCheckins(checkinRows);
          setMargin(limits.margin);
          setBudgetLimit(limits.budget);
        } catch (err) {
          if (isAuthMissing(err)) {
            // Belum login itu keadaan wajar, bukan bug. Cukup info biasa.
            console.info("Belum login, memakai mode preview.");
          } else {
            console.error("Gagal mengambil data Daily:", err?.message);
          }

          if (AUTO_PREVIEW_FALLBACK) {
            // Data asli gagal dimuat -> tampilkan contoh (tanpa database)
            applyPreview(friendlyReason(err));
          } else if (mounted) {
            setNoActive(err?.status === 404);
            setError(friendlyReason(err));
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadData();

    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* =====================================
     PERGANTIAN TANGGAL KALENDER
     (halaman dibiarkan terbuka melewati tengah malam)
  ===================================== */

  useEffect(() => {
    const timer = setInterval(() => {
      const now = startOfToday();

      setRealToday((old) =>
        dateOnly(old) === dateOnly(now) ? old : now
      );
    }, 30000);

    return () => clearInterval(timer);
  }, []);

  /* =====================================
     PERHITUNGAN HARI (BERDASARKAN TANGGAL KALENDER)
  ===================================== */

  const today = isPreview ? addDays(realToday, previewOffset) : realToday;
  const todayStr = dateOnly(today);

  const start = exp ? parseDateOnly(exp.start_date) : null;

  // Hari ke-1 = start_date, hari ke-7 = start_date + 6
  const day = start ? daysBetween(start, today) + 1 : 0;

  const dayValid = day >= 1 && day <= EXPERIMENT_DURATION_DAYS;

  const periodEnded = Boolean(start) && day > EXPERIMENT_DURATION_DAYS;

  const todayCheckin =
    [...checkins]
      .filter((c) => c.checkin_date === todayStr)
      .pop() || null;

  const noteSaved = isNoteSaved(todayCheckin);
  const finSaved = isFinanceSaved(todayCheckin);
  const ready2 = noteSaved && finSaved;

  /* =====================================
     TUGAS HARI INI (DARI daily_plan, MAKS. 3)
  ===================================== */

  const dayInfo =
    exp && dayValid ? extractDayInfo(exp.daily_plan, day) : null;

  const tasks = dayInfo?.tasks || [];
  const hint = dayInfo?.hint || [];
  const totalTasks = tasks.length;

  /* =====================================
     HARI TERLEWATKAN
     Dihitung dari tanggal + ada/tidaknya check-in.
     Tidak membuat baris check-in palsu.
  ===================================== */

  const missedDays = [];

  if (start && day > 1) {
    const checkinDates = new Set(checkins.map((c) => c.checkin_date));

    for (
      let n = 1;
      n <= Math.min(day - 1, EXPERIMENT_DURATION_DAYS);
      n++
    ) {
      if (!checkinDates.has(dateOnly(addDays(start, n - 1)))) {
        missedDays.push(n);
      }
    }
  }

  /* =====================================
     KEMBALI KE HARI INI SAAT TANGGAL BERGANTI
  ===================================== */

  const [prevTodayStr, setPrevTodayStr] = useState(todayStr);

  if (prevTodayStr !== todayStr) {
    setPrevTodayStr(todayStr);
    setViewOverride(null);
  }

  useEffect(() => {
    autoAdvanceRef.current = false;
  }, [todayStr]);

  /* =====================================
     SINKRONISASI CATATAN KEUANGAN
  ===================================== */

  const finKey = `${todayStr}|${finSaved}`;
  const [prevFinKey, setPrevFinKey] = useState(null);

  if (prevFinKey !== finKey) {
    setPrevFinKey(finKey);
    setFin(
      finSaved && todayCheckin
        ? {
            revenue: String(todayCheckin.revenue_today ?? ""),
            cost: String(todayCheckin.experiment_cost_today ?? ""),
          }
        : { revenue: "", cost: "" }
    );
  }

  /* =====================================
     OTOMATIS PINDAH KE HARI BERIKUTNYA
     Setelah catatan + keuangan hari ini sama-sama tersimpan.
     Hari berikutnya hanya tampil terkunci sampai tanggalnya tiba.
  ===================================== */

  useEffect(() => {
    if (!autoAdvanceRef.current) return;

    if (
      loading ||
      !exp ||
      !ACTIVE_STATUSES.includes(exp.status) ||
      !ready2 ||
      successPopup ||
      day >= EXPERIMENT_DURATION_DAYS ||
      viewOverride !== null
    ) {
      return;
    }

    const timer = setTimeout(() => {
      autoAdvanceRef.current = false;
      setViewOverride(day + 1);

      if (typeof window !== "undefined") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [loading, exp, ready2, successPopup, day, viewOverride]);

  /* =====================================
     PERIODE 7 HARI BERAKHIR -> expired / completed
  ===================================== */

  useEffect(() => {
    if (loading || !exp || !periodEnded) return;
    if (!ACTIVE_STATUSES.includes(exp.status)) return;

    const endStr = dateOnly(
      addDays(start, EXPERIMENT_DURATION_DAYS - 1)
    );

    const lastDayRow = checkins.find((c) => c.checkin_date === endStr);

    // Hari 7 sudah lengkap -> dianggap completed, selain itu expired
    finalizeExperiment(
      isDayComplete(lastDayRow) ? STATUS.COMPLETED : STATUS.EXPIRED,
      false
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, exp, periodEnded]);

  /* =====================================
     OTOMATIS MENUJU HASIL SETELAH POP-UP SELESAI
  ===================================== */

  useEffect(() => {
    if (!finishPopup || !resultUrl) return;

    const timer = setTimeout(() => {
      router.replace(resultUrl);
    }, 2000);

    return () => clearTimeout(timer);
  }, [finishPopup, resultUrl, router]);

  /* =====================================
     FINALISASI: completed / stopped / expired
     - preview : hanya sessionStorage
     - asli    : POST /api/experiments/[id]/finish
               (server mengubah status satu kali dan membuat
                experiment_results satu kali)
  ===================================== */

  async function finalizeExperiment(newStatus, showPopup) {
    if (finalizingRef.current || !exp) return false;

    finalizingRef.current = true;

    try {
      if (isPreview) {
        const evaluation = buildEvaluation(
          exp,
          checkins,
          margin,
          newStatus
        );

        const updated = { ...exp, status: newStatus };

        writePreviewExperiment(updated);

        sessionStorage.setItem(
          `ep_preview_result_${exp.id}`,
          JSON.stringify({ experiment_id: exp.id, ...evaluation })
        );

        setExp(updated);
      } else {
        const res = await fetch(
          `/api/experiments/${encodeURIComponent(exp.id)}/finish`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: newStatus }),
          }
        );

        const payload = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            payload?.error ||
              "Status eksperimen gagal diperbarui. Silakan coba lagi."
          );
        }

        setExp({
          ...exp,
          status: payload?.experiment?.status || newStatus,
        });
      }

      const url = hasilUrl(exp.id, isPreview);

      if (showPopup) {
        setResultUrl(url);
        setFinishPopup(true);
      } else {
        router.replace(url);
      }

      return true;
    } catch (err) {
      console.error("Gagal memproses status eksperimen:", err?.message);

      setActionError(
        err?.message ||
          "Status eksperimen gagal diperbarui. Silakan coba lagi."
      );

      finalizingRef.current = false;

      return false;
    }
  }

  /* =====================================
     SIMPAN CHECK-IN (1 BARIS PER TANGGAL)
     Bagian yang sudah disimpan TIDAK PERNAH ditimpa lagi.
  ===================================== */

  const SECTION_CHECK = {
    note: isNoteSaved,
    finance: isFinanceSaved,
  };

  function mergeCheckin(row) {
    setCheckins((old) => {
      const index = old.findIndex(
        (c) => c.id === row.id || c.checkin_date === row.checkin_date
      );

      if (index === -1) return [...old, row];

      const copy = [...old];
      copy[index] = row;

      return copy;
    });
  }

  function alreadySavedError(existingRow) {
    const err = new Error(
      "Bagian ini sudah tersimpan sebelumnya dan tidak dapat diubah lagi."
    );

    err.existingRow = existingRow;

    return err;
  }

  async function persistCheckin(section, fields) {
    if (!exp || !dayValid) {
      throw new Error("Hari ini berada di luar periode eksperimen.");
    }

    const alreadySaved = SECTION_CHECK[section];

    /* PREVIEW: hanya sessionStorage */

    if (isPreview) {
      const list = readPreviewCheckins(exp.id);

      let row = list.find((r) => r.checkin_date === todayStr);

      if (!row) {
        row = {
          id: generatePreviewId(),
          experiment_id: exp.id,
          checkin_date: todayStr,
          steps_done: null,
          progress_note: null,
          mood: null,
          obstacle: null,
          metric_value: null,
          revenue_today: null,
          experiment_cost_today: null,
          created_at: new Date().toISOString(),
        };

        list.push(row);
      }

      if (alreadySaved(row)) {
        throw alreadySavedError(row);
      }

      Object.assign(row, fields);

      writePreviewCheckins(exp.id, list);

      return row;
    }

    /* MODE ASLI: semua pengecekan dilakukan di server */

    const requestBody =
      section === "note"
        ? {
            section,
            checkinDate: todayStr,
            tasks: (fields.steps_done || []).map((s) => s.task),
            progress: fields.progress_note,
            mood: fields.mood,
            obstacle: fields.obstacle,
          }
        : {
            section,
            checkinDate: todayStr,
            revenue: fields.revenue_today,
            cost: fields.experiment_cost_today,
          };

    const res = await fetch(
      `/api/experiments/${encodeURIComponent(exp.id)}/checkin`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }
    );

    const payload = await res.json().catch(() => ({}));

    if (!res.ok) {
      // Eksperimen sudah tidak aktif -> arahkan ke halaman Hasil
      if (payload?.code === "not_active") {
        router.replace(hasilUrl(exp.id, false));
      }

      const apiError = new Error(
        payload?.error || "Check-in gagal disimpan. Silakan coba lagi."
      );

      if (payload?.code === "already_saved" && payload?.checkin) {
        apiError.existingRow = payload.checkin;
      }

      throw apiError;
    }

    return payload.checkin;
  }

  /* SIMPAN CATATAN CHECKLIST (SATU CATATAN UNTUK SEMUA TUGAS) */

  async function saveNote(value) {
    if (savingRef.current || noteSaved || !dayValid) return;

    savingRef.current = true;
    setBusy(true);
    setActionError("");

    try {
      const savedAt = new Date().toISOString();

      const row = await persistCheckin("note", {
        steps_done: tasks.map((task, index) => ({
          index,
          task,
          done: true,
          saved_at: savedAt,
        })),
        progress_note: value.progress.trim(),
        mood: value.mood,
        obstacle: value.obstacle.trim(),
      });

      mergeCheckin(row);

      // Jika keuangan hari ini juga sudah tersimpan -> pindah otomatis
      if (isDayComplete(row)) {
        autoAdvanceRef.current = true;
      }

      setSuccessPopup({
        title: "Catatan berhasil disimpan!",
        text: "Catatan perkembangan, kendala, dan perasaan hari ini sudah tersimpan dan tidak dapat diubah lagi.",
        icon: "📋",
      });
    } catch (err) {
      console.error("Gagal menyimpan catatan:", err?.message);

      if (err?.existingRow) mergeCheckin(err.existingRow);

      setActionError(
        err?.message || "Catatan gagal disimpan. Silakan coba lagi."
      );
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  /* =====================================
     KEUANGAN
  ===================================== */

  const dayRecords = checkins.filter(isFinanceSaved);

  const total = dayRecords.reduce(
    (sum, r) => sum + toNumber(r.revenue_today),
    0
  );

  const totalProfit = dayRecords.reduce(
    (sum, r) =>
      sum +
      toNumber(r.revenue_today) * margin -
      toNumber(r.experiment_cost_today),
    0
  );

  const spentAll = dayRecords.reduce(
    (sum, r) => sum + toNumber(r.experiment_cost_today),
    0
  );

  // Biaya yang sudah terpakai di hari lain
  const spentOtherDays = dayRecords
    .filter((r) => r.checkin_date !== todayStr)
    .reduce((sum, r) => sum + toNumber(r.experiment_cost_today), 0);

  // Batas maksimal biaya yang boleh diisi hari ini
  const remainingBeforeToday = Math.max(
    0,
    budgetLimit - spentOtherDays
  );

  const costNow = finSaved
    ? toNumber(todayCheckin?.experiment_cost_today)
    : Number(fin.cost) || 0;

  const revenueNow = finSaved
    ? toNumber(todayCheckin?.revenue_today)
    : Number(fin.revenue) || 0;

  // Sisa biaya eksperimen setelah biaya hari ini
  const remainingAfterToday = remainingBeforeToday - costNow;

  const costExceeds = !finSaved && costNow > remainingBeforeToday;

  // Estimasi keuntungan hari ini
  const profitToday = revenueNow * margin - costNow;

  /* VALIDASI KEUANGAN */

  const financeComplete =
    fin.revenue.trim() !== "" &&
    fin.cost.trim() !== "" &&
    Number.isFinite(Number(fin.revenue)) &&
    Number.isFinite(Number(fin.cost)) &&
    Number(fin.revenue) >= 0 &&
    Number(fin.cost) >= 0 &&
    !costExceeds;

  /* SIMPAN CATATAN KEUANGAN */

  const saveFin = async () => {
    if (
      savingRef.current ||
      !financeComplete ||
      finSaved ||
      !dayValid
    ) {
      return;
    }

    savingRef.current = true;
    setBusy(true);
    setActionError("");

    try {
      const row = await persistCheckin("finance", {
        revenue_today: Number(fin.revenue),
        experiment_cost_today: Number(fin.cost),
      });

      mergeCheckin(row);

      // Jika catatan hari ini juga sudah tersimpan -> pindah otomatis
      if (isDayComplete(row)) {
        autoAdvanceRef.current = true;
      }

      setSuccessPopup({
        title: "Catatan keuangan tersimpan!",
        text: "Data pemasukan dan biaya hari ini sudah tersimpan dan tidak dapat diubah lagi.",
        icon: "💰",
      });
    } catch (err) {
      console.error("Gagal menyimpan catatan keuangan:", err?.message);

      if (err?.existingRow) mergeCheckin(err.existingRow);

      setActionError(
        err?.message ||
          "Catatan keuangan gagal disimpan. Silakan coba lagi."
      );
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  };

  /* =====================================
     SELESAIKAN / HENTIKAN
  ===================================== */

  async function selesai() {
    if (!ready2 || day !== EXPERIMENT_DURATION_DAYS || busy) return;

    setBusy(true);
    setActionError("");

    await finalizeExperiment(STATUS.COMPLETED, true);

    setBusy(false);
  }

  async function hentikan() {
    if (busy) return;

    setBusy(true);
    setActionError("");
    setStop(false);

    await finalizeExperiment(STATUS.STOPPED, false);

    setBusy(false);
  }

  /* =====================================
     KONTROL SIMULASI (HANYA PREVIEW)
  ===================================== */

  function setOffset(next) {
    if (!exp) return;

    const value = Math.max(0, next);

    sessionStorage.setItem(
      `ep_preview_day_offset_${exp.id}`,
      String(value)
    );

    autoAdvanceRef.current = false;
    setViewOverride(null);
    setMissedDismissed(false);
    setPreviewOffset(value);
  }

  function ulangiPreview() {
    const fresh = buildDemoExperiment();

    writePreviewExperiment(fresh);
    writePreviewCheckins(fresh.id, []);

    window.location.href = `${window.location.pathname}?mode=preview&experimentId=${encodeURIComponent(
      fresh.id
    )}`;
  }

  /* =====================================
     LOADING DAN ERROR
  ===================================== */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e8defb] border-t-[#684bd0]" />

          <p className="mt-4 text-sm font-semibold text-[#684bd0]">
            Menyiapkan Daily Check-in...
          </p>
        </div>
      </div>
    );
  }

  if (error || !exp || !start) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-[22px] border border-[#f1dce5] bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h2 className="mt-3 text-lg font-extrabold text-[#19347c]">
            {noActive ? "Belum ada eksperimen aktif" : "Data belum tersedia"}
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-[#7c849d]">
            {error || "Data eksperimen tidak dapat dibaca."}
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            {noActive ? (
              <button
                onClick={() => router.push("/opportunity-library")}
                className="rounded-full bg-[#684bd0] px-6 py-3 text-sm font-bold text-white"
              >
                Pilih strategi
              </button>
            ) : (
              <button
                onClick={kembali}
                className="rounded-full bg-[#684bd0] px-6 py-3 text-sm font-bold text-white"
              >
                Kembali
              </button>
            )}

            <button
              onClick={bukaPreview}
              className="rounded-full border border-[#d8cdf5] bg-white px-6 py-3 text-sm font-bold text-[#684bd0]"
            >
              Lihat contoh tampilan
            </button>
          </div>
        </div>
      </div>
    );
  }

  const experimentOver =
    periodEnded || !ACTIVE_STATUSES.includes(exp.status);

  /*
   * Periode berakhir tetapi status gagal diperbarui di server:
   * tampilkan pesan dan tombol coba lagi (bukan layar kosong).
   */
  if (experimentOver && actionError && !finishPopup) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-[22px] border border-[#f1dce5] bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h2 className="mt-3 text-lg font-extrabold text-[#19347c]">
            Eksperimen belum bisa diselesaikan
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-[#7c849d]">
            {actionError}
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              onClick={kembali}
              className="rounded-full border border-[#d8cdf5] bg-white px-6 py-3 text-sm font-bold text-[#684bd0]"
            >
              Kembali
            </button>

            <button
              onClick={() => window.location.reload()}
              className="rounded-full bg-[#684bd0] px-6 py-3 text-sm font-bold text-white"
            >
              Coba lagi
            </button>
          </div>
        </div>
      </div>
    );
  }

  /*
   * Periode berakhir / status sudah final: sedang dialihkan ke Hasil.
   * Pengecualian: saat pop-up "eksperimen selesai" tampil, halaman
   * tetap dirender supaya pop-up terlihat sebelum pindah ke Hasil.
   */
  if (experimentOver && !finishPopup) {
    return null;
  }

  // Eksperimen dijadwalkan mulai di masa depan
  if (day < 1) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf9ff] px-5">
        <div className="w-full max-w-lg rounded-[22px] border border-[#f1dce5] bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">📅</div>

          <h2 className="mt-3 text-lg font-extrabold text-[#19347c]">
            Eksperimen belum dimulai
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-[#7c849d]">
            Hari pertama dimulai pada{" "}
            {fmt(start, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            . Check-in belum bisa diisi sebelum tanggal tersebut.
          </p>

          <button
            onClick={kembali}
            className="mt-5 rounded-full bg-[#684bd0] px-6 py-3 text-sm font-bold text-white"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  /* =====================================
     TANGGAL EKSPERIMEN
  ===================================== */

  const end = addDays(start, EXPERIMENT_DURATION_DAYS - 1);

  const ex = {
    title: exp.title || "Eksperimen",
    category:
      (Array.isArray(exp.channels) && exp.channels.length > 0
        ? exp.channels.join(" & ")
        : null) || `Level ${exp.growth_level || 1}`,
  };

  /* =====================================
     HARI YANG SEDANG DILIHAT
     - viewDay === day  : hari ini (bisa diisi)
     - viewDay <  day   : hari lalu (terkunci, hanya lihat)
     - viewDay >  day   : hari berikutnya (terkunci sampai tanggalnya tiba)
  ===================================== */

  const viewDay = viewOverride ?? day;
  const viewingToday = viewDay === day;
  const viewUpcoming = viewDay > day;

  const viewDate = addDays(start, viewDay - 1);
  const viewDateStr = dateOnly(viewDate);

  const viewRow = viewingToday
    ? todayCheckin
    : [...checkins].filter((c) => c.checkin_date === viewDateStr).pop() ||
      null;

  const viewNoteSaved = isNoteSaved(viewRow);
  const viewFinSaved = isFinanceSaved(viewRow);

  const viewInfo = extractDayInfo(exp.daily_plan, viewDay);

  // Tugas yang tampil: untuk hari lalu yang sudah tersimpan, pakai yang tercatat
  const savedSteps = viewNoteSaved ? parseJson(viewRow.steps_done, []) : [];

  const savedStepTasks = Array.isArray(savedSteps)
    ? savedSteps.map((s) => s?.task).filter(Boolean)
    : [];

  const viewTasks = viewingToday
    ? tasks
    : savedStepTasks.length > 0
      ? savedStepTasks
      : viewInfo?.tasks || [];

  const viewTotalTasks = viewTasks.length;

  const savedNoteView = buildSavedNote(viewRow);

  const done = viewingToday
    ? noteSaved
      ? totalTasks
      : liveDone
    : viewNoteSaved
      ? viewTotalTasks
      : 0;

  // Keuangan untuk tampilan
  const shownRevenue = viewingToday
    ? fin.revenue
    : viewFinSaved
      ? String(viewRow.revenue_today)
      : "";

  const shownCost = viewingToday
    ? fin.cost
    : viewFinSaved
      ? String(viewRow.experiment_cost_today)
      : "";

  const finLocked = viewingToday ? Boolean(finSaved) : true;
  const finBadge = viewingToday ? finSaved : viewFinSaved;

  const panelSpent = viewingToday ? spentOtherDays + costNow : spentAll;

  const panelRemaining = viewingToday
    ? remainingAfterToday
    : budgetLimit - spentAll;

  const profitShown = viewingToday
    ? profitToday
    : viewFinSaved
      ? toNumber(viewRow.revenue_today) * margin -
        toNumber(viewRow.experiment_cost_today)
      : 0;

  const progress = Math.round((day / EXPERIMENT_DURATION_DAYS) * 100);

  // Status tiap hari untuk deretan pilihan hari
  function chipState(n) {
    if (n > day) return "locked";

    const row = checkins.find(
      (c) => c.checkin_date === dateOnly(addDays(start, n - 1))
    );

    if (n === day) return isDayComplete(row) ? "done" : "today";
    if (isDayComplete(row)) return "done";
    if (row) return "partial";

    return "missed";
  }

  const chipStyle = {
    today: "border-[#704bd5] bg-[#704bd5] text-white",
    done: "border-[#bfe7d3] bg-[#e2f7ef] text-[#16876b]",
    partial: "border-[#f4e3bb] bg-[#fff5df] text-[#956b19]",
    missed: "border-[#f5d2dc] bg-[#fff0f5] text-[#d83b80]",
    locked: "border-[#e9e4f7] bg-[#f5f3fc] text-[#b2b0c6]",
  };

  const lastMissed = missedDays.length
    ? missedDays[missedDays.length - 1]
    : null;

  /* =====================================
     TAMPILAN
  ===================================== */

  return (
    <>
      <main className="relative isolate min-h-screen w-full overflow-hidden rounded-[18px] bg-transparent pb-8 sm:rounded-[24px] sm:pb-10">
        <div className="relative z-10 w-full space-y-6">

          {/* MODE PREVIEW */}

          {isPreview && (
            <div className="rounded-[14px] border border-[#e6d9ff] bg-[#f3edff] px-4 py-3 text-[#684bd0]">
              <div className="flex items-start gap-3">
                <span className="text-lg">👀</span>

                <div className="min-w-0">
                  <p className="text-[11px] font-extrabold">
                    Mode Preview Aktif
                  </p>

                  {previewNotice && (
                    <p className="mt-1 text-[10px] font-bold leading-relaxed text-[#a36b31]">
                      Menampilkan contoh karena: {previewNotice}
                    </p>
                  )}

                  <p className="mt-1 text-[10px] leading-relaxed">
                    Halaman ini memakai data contoh dan penyimpanan
                    sementara di browser. Tidak ada data yang dikirim ke
                    database. Gunakan tombol simulasi untuk mencoba
                    pergantian hari kalender.
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={previewOffset <= 0}
                  onClick={() => setOffset(previewOffset - 1)}
                  className="rounded-full border border-[#d8cdf5] bg-white px-3 py-1.5 text-[10px] font-bold text-[#684bd0] disabled:opacity-40"
                >
                  ‹ Hari sebelumnya
                </button>

                <button
                  type="button"
                  disabled={previewOffset >= EXPERIMENT_DURATION_DAYS - 1}
                  onClick={() => setOffset(previewOffset + 1)}
                  className="rounded-full border border-[#d8cdf5] bg-white px-3 py-1.5 text-[10px] font-bold text-[#684bd0] disabled:opacity-40"
                >
                  Hari berikutnya ›
                </button>

                <button
                  type="button"
                  onClick={() => setOffset(EXPERIMENT_DURATION_DAYS)}
                  className="rounded-full border border-[#d8cdf5] bg-white px-3 py-1.5 text-[10px] font-bold text-[#684bd0]"
                >
                  Simulasi periode berakhir
                </button>

                <button
                  type="button"
                  onClick={ulangiPreview}
                  className="rounded-full bg-[#684bd0] px-3 py-1.5 text-[10px] font-bold text-white"
                >
                  Ulangi preview
                </button>
              </div>
            </div>
          )}

                    {/* HEADER */}

          <header>
            <p className="mb-2 text-sm font-semibold text-pink-ink">
              EKSPERIMEN AKTIF
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
              Daily Check-in
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              Centang tugas yang sudah kamu kerjakan, lalu catat
              perkembangannya. Catatan kecil setiap hari membantu kamu
              melihat apa yang berhasil.
            </p>

            <div className="mt-3 inline-flex max-w-full items-center rounded-full border border-lav-line bg-white px-3 py-2 text-xs font-bold text-ink-title shadow-sm">
              📅{" "}
              {fmt(viewDate, {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </div>
          </header>

          {/* RINGKASAN EKSPERIMEN */}

          <section
            className={`${card} flex flex-col items-stretch gap-3 p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3 sm:p-4 md:gap-4 md:px-5`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e3f7ef] text-[20px] font-extrabold text-[#16876b] sm:h-12 sm:w-12">
                ⚡
              </div>

              <div className="min-w-0 flex-1">
                <h2 className="break-words text-[13px] font-extrabold text-[#19347e] sm:text-[14px] md:text-[16px]">
                  {ex.title}
                </h2>

                <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] text-[#8990a8] sm:text-[10px] md:text-[11px]">
                  <span className="rounded-full bg-[#f0eaff] px-3 py-1 font-bold text-[#704bd0]">
                    {ex.category}
                  </span>

                  <span>
                    {fmt(start, {
                      day: "numeric",
                      month: "short",
                    })}
                    {" - "}
                    {fmt(end, {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>

                  <span className="hidden sm:inline">|</span>

                  <span className="font-semibold text-[#263b7c]">
                    Total omzet Rp {formatRupiah(total)}
                  </span>

                  <span className="hidden sm:inline">|</span>

                  <span className="font-semibold text-[#263b7c]">
                    Estimasi keuntungan {formatRupiahSigned(totalProfit)}
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full sm:ml-auto sm:w-[220px] md:w-[280px]">
              <div className="mb-2 flex justify-between text-[10px] font-extrabold text-[#19347e] sm:text-[11px]">
                <span>Hari ke-{day} dari 7 hari</span>
                <span>{progress}%</span>
              </div>

              <div className="h-[8px] overflow-hidden rounded-full bg-[#ece8fa]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#8653e8] to-[#5832c9] transition-all"
                  style={{
                    width: `${progress}%`,
                  }}
                />
              </div>
            </div>
          </section>

          {/* PILIHAN HARI (LIHAT CATATAN HARI SEBELUMNYA) */}

          <section className="flex flex-wrap items-center gap-2 rounded-[16px] border border-[#ece5fa] bg-white/80 px-3 py-2.5 sm:px-4">
            <span className="mr-1 text-[10px] font-bold text-[#6655a7] sm:text-[11px]">
              Lihat hari:
            </span>

            {Array.from(
              { length: EXPERIMENT_DURATION_DAYS },
              (_, i) => i + 1
            ).map((n) => {
              const state = chipState(n);
              const selected = n === viewDay;

              return (
                <button
                  key={n}
                  type="button"
                  disabled={state === "locked" && n !== viewDay}
                  onClick={() => setViewOverride(n === day ? null : n)}
                  aria-label={`Lihat hari ke-${n}`}
                  className={`rounded-full border px-3 py-1.5 text-[10px] font-bold transition sm:text-[11px] ${
                    chipStyle[state]
                  } ${
                    selected ? "ring-2 ring-[#8b6ce0]/60" : ""
                  } ${
                    state === "locked" && n !== viewDay
                      ? "cursor-not-allowed"
                      : "hover:brightness-95"
                  }`}
                >
                  H{n}
                  {state === "done" ? " ✓" : ""}
                </button>
              );
            })}
          </section>

          {/* PEMBERITAHUAN SAAT MELIHAT HARI LAIN */}

          {!viewingToday && (
            <section className="flex flex-col gap-3 rounded-[16px] border border-[#e6d9ff] bg-[#f3edff] px-3 py-3 sm:px-4 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="shrink-0 text-xl">
                  {viewUpcoming ? "🔒" : "👁️"}
                </span>

                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-[#5a3fc0]">
                    {viewUpcoming
                      ? `Hari ke-${viewDay} terbuka pada ${fmt(viewDate, {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}.`
                      : `Kamu sedang melihat catatan hari ke-${viewDay}.`}
                  </p>

                  <p className="text-[10px] leading-relaxed text-[#6655a7] sm:text-[11px]">
                    {viewUpcoming
                      ? "Hari berikutnya tidak bisa diisi lebih awal. Hasil kerjamu hari ini sudah tersimpan dengan aman."
                      : "Catatan hari yang sudah lewat terkunci dan tidak bisa diubah atau diisi ulang."}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewOverride(null)}
                className="w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-4 py-2.5 text-[10px] font-bold text-white shadow-md transition hover:brightness-110 sm:w-auto sm:px-5 sm:text-[11px]"
              >
                Kembali ke hari ini
              </button>
            </section>
          )}

          {/* FOKUS HARI */}

          <section className="flex items-start gap-3 rounded-[16px] border border-[#ece5fa] bg-[#f0eaff] px-3 py-3 sm:items-center sm:px-4">
            <span className="shrink-0 text-[21px] text-[#6848cf]">
              ◎
            </span>

            <p className="min-w-0 text-[10px] leading-relaxed text-[#6655a7] sm:text-[11px] md:text-[12px]">
              <b className="mr-2 text-[#6040c4]">
                {viewingToday ? "Fokus hari ini" : `Fokus hari ke-${viewDay}`}
              </b>
              H{viewDay}:{" "}
              {viewInfo?.focus || "Tugas hari ini belum tersedia."}
            </p>
          </section>

          {/* PERINGATAN HARI TERLEWATKAN (hari lalu terkunci) */}

          {viewingToday && missedDays.length > 0 && !missedDismissed && (
            <section className="flex flex-col gap-3 rounded-[16px] border border-[#f4e3bb] bg-[#fff5df] px-3 py-3 sm:px-4 sm:py-3 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3">
                <span className="shrink-0 text-xl">⚠️</span>

                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold text-[#956b19]">
                    Hari ke-{missedDays.join(", ")} terlewatkan.
                  </p>

                  <p className="text-[10px] leading-relaxed text-[#9a8251] sm:text-[11px]">
                    Hari yang terlewat tidak bisa diisi ulang dan tidak
                    dihitung selesai. Lanjutkan dengan tugas hari ini.
                  </p>
                </div>
              </div>

              <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                <button
                  type="button"
                  onClick={() => setViewOverride(lastMissed)}
                  className="w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-4 py-2.5 text-[10px] font-bold text-white shadow-md transition hover:brightness-110 sm:w-auto sm:px-5 sm:text-[11px]"
                >
                  Lihat hari ke-{lastMissed}
                </button>

                <button
                  type="button"
                  onClick={() => setMissedDismissed(true)}
                  className="w-full rounded-full border border-[#eee4ce] bg-white px-4 py-2.5 text-[10px] font-bold text-[#9b7a37] shadow-sm transition hover:bg-[#fffaf0] sm:w-auto sm:px-5 sm:text-[11px]"
                >
                  Mengerti
                </button>
              </div>
            </section>
          )}

          {/* PERINGATAN HARI TERAKHIR */}

          {viewingToday && day === EXPERIMENT_DURATION_DAYS && (
            <section className="flex items-start gap-3 rounded-[16px] border border-[#f4e3bb] bg-[#fff5df] p-3 sm:items-center sm:p-4">
              <span className="shrink-0 text-xl">⚠️</span>

              <div>
                <p className="text-[12px] font-extrabold text-[#956b19]">
                  Hari terakhir.
                </p>

                <p className="text-[10px] leading-relaxed text-[#9a8251] sm:text-[11px]">
                  Isi catatan hari ini, lalu selesaikan eksperimen
                  untuk melihat hasilnya.
                </p>
              </div>
            </section>
          )}

          {/* ERROR AKSI */}

          {actionError && (
            <div className="rounded-[12px] border border-[#f3d5df] bg-[#fff1f5] p-3 text-[11px] text-[#c13c70]">
              {actionError}
            </div>
          )}

          {/* CHECKLIST */}

          <section className={`${card} space-y-3 p-3 sm:p-4 md:p-5`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold text-[#19347e] sm:text-[16px]">
                  {viewingToday
                    ? "Checklist hari ini"
                    : `Checklist hari ke-${viewDay}`}
                </h2>

                <p className="mt-1 text-[10px] leading-relaxed text-[#8991aa] sm:text-[11px]">
                  {viewingToday
                    ? `Centang ${allTasksLabel(totalTasks).replace(
                        " di atas",
                        ""
                      )}, lalu isi satu catatan untuk hari ini. Semua kolom wajib dilengkapi.`
                    : "Tampilan hanya-baca. Catatan yang sudah disimpan tidak dapat diubah."}
                </p>
              </div>

              <span className="w-fit shrink-0 rounded-full bg-[#e2f7ef] px-3 py-1 text-[10px] font-extrabold text-[#16876b]">
                {done} dari {viewTotalTasks} selesai
              </span>
            </div>

            {viewTotalTasks === 0 ? (
              <div className="rounded-[15px] border border-[#ece9f8] bg-white p-4 text-[11px] text-[#8991aa]">
                Tugas untuk hari ini belum tersedia pada rencana harian
                strategi yang dipilih.
              </div>
            ) : viewingToday ? (
              <ChecklistForm
                key={`${viewDateStr}-${viewTotalTasks}`}
                tasks={viewTasks}
                hint={hint}
                saved={savedNoteView}
                busy={busy}
                onSave={saveNote}
                onProgress={setLiveDone}
              />
            ) : viewNoteSaved ? (
              <ChecklistForm
                key={`view-${viewDateStr}`}
                tasks={viewTasks}
                saved={savedNoteView}
              />
            ) : (
              <>
                <LockedTasks
                  tasks={viewTasks}
                  label={viewUpcoming ? "Belum dibuka" : "Terlewatkan"}
                  badgeClass={
                    viewUpcoming
                      ? "bg-[#f0eaff] text-[#6848cf]"
                      : "bg-[#fff5df] text-[#956b19]"
                  }
                />

                {!viewUpcoming && (
                  <p className="text-[10px] leading-relaxed text-[#9a8251]">
                    Tidak ada catatan pada hari ini dan tidak bisa
                    diisi ulang.
                  </p>
                )}
              </>
            )}
          </section>

          {/* CATATAN KEUANGAN */}

          <section className={`${card} p-3 sm:p-4 md:p-5`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
              <div className="min-w-0">
                <h2 className="text-[15px] font-extrabold text-[#19347e] sm:text-[16px]">
                  {viewingToday
                    ? "Catatan keuangan hari ini"
                    : `Catatan keuangan hari ke-${viewDay}`}
                </h2>

                <p className="mt-1 text-[10px] leading-relaxed text-[#8991aa] sm:text-[11px]">
                  {viewingToday
                    ? "Isi revenue untuk melihat estimasi keuntungan, dan isi biaya untuk memantau sisa biaya eksperimen."
                    : "Tampilan hanya-baca. Catatan yang sudah disimpan tidak dapat diubah."}
                </p>
              </div>

              {finBadge && (
                <span className="w-fit shrink-0 rounded-full bg-[#e2f7ef] px-3 py-1 text-[10px] font-bold text-[#16876b]">
                  Tersimpan
                </span>
              )}
            </div>

            {/* PANEL BATAS BIAYA EKSPERIMEN */}

            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <div className="rounded-[14px] border border-[#e9e2f8] bg-[#faf8ff] p-3">
                <p className="text-[10px] text-[#8990aa]">
                  Batas biaya eksperimen
                </p>

                <p className="mt-1 text-[13px] font-extrabold text-[#4932a0]">
                  Rp {formatRupiah(budgetLimit)}
                </p>
              </div>

              <div className="rounded-[14px] border border-[#e9e2f8] bg-[#faf8ff] p-3">
                <p className="text-[10px] text-[#8990aa]">
                  Terpakai
                  {viewingToday && (finSaved || costNow > 0)
                    ? " (termasuk hari ini)"
                    : ""}
                </p>

                <p className="mt-1 text-[13px] font-extrabold text-[#4932a0]">
                  Rp {formatRupiah(panelSpent)}
                </p>
              </div>

              <div
                className={`rounded-[14px] border p-3 ${
                  panelRemaining < 0
                    ? "border-[#f5d2dc] bg-[#fff0f5]"
                    : "border-[#d5eee2] bg-[#effaf4]"
                }`}
              >
                <p className="text-[10px] text-[#8990aa]">
                  Sisa biaya eksperimen
                </p>

                <p
                  className={`mt-1 text-[13px] font-extrabold ${
                    panelRemaining < 0
                      ? "text-[#d83b80]"
                      : "text-[#16866a]"
                  }`}
                >
                  {formatRupiahSigned(panelRemaining)}
                </p>
              </div>
            </div>

            <div className="mt-4 grid min-w-0 gap-3 sm:gap-4 md:grid-cols-2">
              <div className="min-w-0">
                <label className="text-[11px] font-bold text-[#243b7d] sm:text-[12px]">
                  {viewingToday
                    ? "Total omzet usaha hari ini"
                    : "Total omzet usaha"}{" "}
                  {viewingToday && <span className="text-[#dc4383]">*</span>}
                </label>

                <div className="mt-2 flex min-w-0 items-center rounded-xl border border-[#e9e4f7] bg-[#f5f3fc] px-3">
                  <span className="shrink-0 text-[12px] font-bold text-[#7250cc]">
                    Rp
                  </span>

                  <input
                    required
                    className="w-full min-w-0 border-0 bg-transparent px-2 py-3 text-[13px] font-semibold text-[#263b7c] outline-none placeholder:font-normal placeholder:text-[#9ba2bd] disabled:opacity-70"
                    type="text"
                    inputMode="numeric"
                    placeholder={
                      viewingToday ? "Masukkan revenue" : "Tidak ada catatan"
                    }
                    disabled={finLocked}
                    readOnly={finLocked}
                    value={formatInputRupiah(shownRevenue)}
                    onChange={(e) =>
                      setFin((old) => ({
                        ...old,
                        revenue: parseRupiah(e.target.value),
                      }))
                    }
                  />
                </div>

                <p className="mt-2 text-[10px] leading-relaxed text-[#8991aa]">
                  Estimasi keuntungan{" "}
                  {viewingToday ? "hari ini" : `hari ke-${viewDay}`}:{" "}
                  <b
                    className={
                      profitShown < 0
                        ? "text-[#d83b80]"
                        : "text-[#16866a]"
                    }
                  >
                    {formatRupiahSigned(profitShown)}
                  </b>
                  {margin > 0 && (
                    <span>
                      {" "}
                      (revenue × margin {(margin * 100).toFixed(0)}% − biaya)
                    </span>
                  )}
                </p>
              </div>

              <div className="min-w-0">
                <label className="text-[11px] font-bold text-[#243b7d] sm:text-[12px]">
                  {viewingToday ? "Biaya hari ini" : "Biaya eksperimen"}{" "}
                  {viewingToday && <span className="text-[#dc4383]">*</span>}
                </label>

                <div
                  className={`mt-2 flex min-w-0 items-center rounded-xl border bg-[#f5f3fc] px-3 ${
                    viewingToday && costExceeds
                      ? "border-[#e98aa8]"
                      : "border-[#e9e4f7]"
                  }`}
                >
                  <span className="shrink-0 text-[12px] font-bold text-[#7250cc]">
                    Rp
                  </span>

                  <input
                    required
                    className="w-full min-w-0 border-0 bg-transparent px-2 py-3 text-[13px] font-semibold text-[#263b7c] outline-none placeholder:font-normal placeholder:text-[#9ba2bd] disabled:opacity-70"
                    type="text"
                    inputMode="numeric"
                    placeholder={
                      viewingToday ? "Masukkan biaya" : "Tidak ada catatan"
                    }
                    disabled={finLocked}
                    readOnly={finLocked}
                    value={formatInputRupiah(shownCost)}
                    onChange={(e) =>
                      setFin((old) => ({
                        ...old,
                        cost: parseRupiah(e.target.value),
                      }))
                    }
                  />
                </div>

                {viewingToday &&
                  (costExceeds ? (
                    <p className="mt-2 text-[10px] leading-relaxed text-[#d83b80]">
                      Biaya melebihi sisa biaya eksperimen. Maksimal hari
                      ini Rp {formatRupiah(remainingBeforeToday)}.
                    </p>
                  ) : (
                    <p className="mt-2 text-[10px] leading-relaxed text-[#8991aa]">
                      Maksimal biaya hari ini Rp{" "}
                      {formatRupiah(remainingBeforeToday)}.
                    </p>
                  ))}
              </div>
            </div>

            {viewingToday && (
              <>
                <p className="mt-3 text-[10px] leading-relaxed text-[#9291a5]">
                  * Omzet dan biaya wajib diisi. Isi total seluruh penjualan hari ini, bukan hanya dari eksperimen. Jika tidak ada pemasukan
                  atau biaya, masukkan angka 0.
                </p>

                <button
                  type="button"
                  className="mt-4 w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-5 py-2.5 text-[11px] font-extrabold text-white shadow-[0_4px_12px_rgba(95,58,190,0.2)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:px-6"
                  disabled={Boolean(finSaved) || !financeComplete || busy}
                  onClick={saveFin}
                >
                  {finSaved
                    ? "✓ Catatan keuangan tersimpan"
                    : "▣ Simpan catatan keuangan"}
                </button>
              </>
            )}
          </section>

          {/* TOMBOL AKHIR (hanya saat melihat hari ini) */}

          {viewingToday &&
            (day === EXPERIMENT_DURATION_DAYS ? (
              <div>
                <button
                  type="button"
                  className="w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-4 py-3.5 text-[12px] font-extrabold text-white shadow-lg transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 sm:py-4 sm:text-[14px]"
                  disabled={!ready2 || busy}
                  onClick={selesai}
                >
                  Selesaikan eksperimen ›
                </button>

                <p className="mt-3 text-[10px] leading-relaxed text-[#9291a5] sm:text-[11px]">
                  Pastikan seluruh catatan hari ketujuh sudah tersimpan
                  sebelum melihat hasil eksperimen.
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="text-[11px] font-extrabold text-[#d64b6d] transition hover:text-[#b82e55] sm:text-[12px]"
                onClick={() => setStop(true)}
              >
                Hentikan eksperimen
              </button>
            ))}
        </div>
      </main>

      {/* POP-UP CATATAN BERHASIL */}

      {successPopup && (
        <Modal
          icon={successPopup.icon}
          title={successPopup.title}
          text={successPopup.text}
          onClose={() => setSuccessPopup(null)}
        />
      )}

      {/* POP-UP HENTIKAN EKSPERIMEN */}

      {stop && (
        <Modal
          icon="⚠️"
          title="Hentikan eksperimen?"
          text="Catatan yang sudah kamu isi tetap tersimpan. Hari yang belum dijalankan tidak akan terisi, dan eksperimen tidak bisa dilanjutkan lagi."
          onClose={() => setStop(false)}
        >
          <button
            type="button"
            onClick={() => setStop(false)}
            className="w-full rounded-full border border-violet-200 bg-white px-5 py-3 text-[12px] font-bold text-violet-700 sm:w-auto"
          >
            Lanjutkan eksperimen
          </button>

          <button
            type="button"
            onClick={hentikan}
            disabled={busy}
            className="w-full rounded-full bg-gradient-to-r from-[#7045d5] to-[#5632c4] px-6 py-3 text-[12px] font-bold text-white shadow-md disabled:opacity-60 sm:w-auto"
          >
            Ya, hentikan
          </button>
        </Modal>
      )}

      {/* POP-UP SELESAI EKSPERIMEN */}

      {finishPopup && (
        <Modal
          icon="🎉"
          title="Selamat, eksperimen selesai!"
          text="Kamu sudah menyelesaikan seluruh catatan selama 7 hari. Kamu akan otomatis diarahkan ke halaman hasil eksperimen."
        />
      )}
    </>
  );
}