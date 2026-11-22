"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import Popup from "@/components/experiment-youfih/Popup";

/*
 * Halaman ini tidak lagi memanggil Supabase langsung.
 * Alur: Browser -> /api/experiments/* -> Supabase.
 * Mode preview tetap memakai data demo dan sessionStorage.
 */

/* =========================================
   KONSTANTA EKSPERIMEN
========================================= */

const EXPERIMENT_DURATION_DAYS = 7;

/* =========================================
   DATA DEMO UNTUK PREVIEW
   Tidak pernah dikirim ke database.
========================================= */

const DEMO_BUSINESS = {
  id: "demo-business",
  name: "Dinda Skincare",
  category: "Skincare",
  business_type: "UMKM",
};

const DEMO_FINANCE = {
  monthly_revenue: 5000000,
  monthly_operating_cost: 1000000,
  household_need: 2000000,
  product_margin_pct: 40,
  willingness_to_lose: 100000,
  affordable_loss: 100000,
  business_profit: 4000000,
  free_surplus: 2000000,
  recommended_budget: 100000,
  growth_level: 1,
};

const DEMO_PROPOSAL = {
  id: "demo-proposal",
  source_type: "opportunity_library",
  title: "Grebek Flash Sale 3 Jam",
  problem_addressed:
    "Penjualan skincare masih belum optimal meskipun bisnis sudah rutin melakukan promosi melalui media sosial.",
  rationale:
    "Flash sale singkat dapat mendorong calon pelanggan yang sebelumnya hanya bertanya untuk segera melakukan pembelian.",
  hypothesis:
    "Jika calon pembeli yang sering bertanya harga ditawari flash sale selama 3 jam dengan stok terbatas, maka mereka akan lebih cepat memutuskan membeli.",
  steps: [
    "Pilih produk jagoan",
    "Siapkan amunisi visual",
    "Mulai beri bocoran H-1",
    "Pengingat terakhir",
    "Waktunya beraksi",
    "Pantau konsistensi penjualan",
    "Evaluasi hasil eksperimen",
  ],
  recommended_daily_plan: [
    {
      day: 1,
      title: "Pilih produk jagoan",
      tasks: ["Tentukan produk utama untuk promosi."],
    },
    {
      day: 2,
      title: "Siapkan materi promosi",
      tasks: ["Buat visual dan siapkan informasi harga."],
    },
    {
      day: 3,
      title: "Mulai beri bocoran",
      tasks: ["Publikasikan teaser promosi."],
    },
    {
      day: 4,
      title: "Kirim pengingat",
      tasks: ["Ingatkan calon pelanggan tentang promo."],
    },
    {
      day: 5,
      title: "Jalankan flash sale",
      tasks: ["Publikasikan promo dan layani pesanan."],
    },
    {
      day: 6,
      title: "Pantau penjualan",
      tasks: ["Catat omzet dan jumlah pesanan."],
    },
    {
      day: 7,
      title: "Evaluasi hasil",
      tasks: ["Bandingkan hasil dengan target."],
    },
  ],
  est_cost: 0,
  est_days: 7,
  growth_level: 1,
  risks: [
    {
      title: "Risiko penjualan rendah",
      description:
        "Flash sale mungkin tidak menghasilkan pembelian sesuai target.",
    },
    {
      title: "Risiko harga terlalu rendah",
      description:
        "Pastikan harga promo tetap memperhatikan modal produk.",
    },
  ],
  success_metrics: [
    {
      title: "Berhasil",
      description:
        "Omzet flash sale mencapai atau melebihi target yang telah ditentukan.",
    },
    {
      title: "Ada sinyal positif",
      description:
        "Ada pembelian dari calon pelanggan yang sebelumnya hanya bertanya.",
    },
    {
      title: "Belum berhasil",
      description: "Tidak ada pembelian selama flash sale berlangsung.",
    },
  ],
  message_template:
    'Halo Kak! Besok jam 16.00–19.00 ada "Grebek Flash Sale 3 Jam" untuk [nama produk]. Harga spesial dan stok terbatas, siapa cepat dia dapat. Mau aku ingatkan jam 15.00? 😊',
};

/* =========================================
   HELPER FORMAT DAN ANGKA
========================================= */

const formatRupiah = (value) =>
  "Rp" + Math.round(Number(value) || 0).toLocaleString("id-ID");

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (value === null || value === undefined || value === "") {
    return 0;
  }

  const normalized = String(value)
    .trim()
    .replace(/Rp/gi, "")
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const result = Number(normalized);

  return Number.isFinite(result) ? result : 0;
};

const formatThousands = (value) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits).toLocaleString("id-ID") : "";
};

const dateOnly = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
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
   HELPER JSONB
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

function normalizeList(value) {
  const parsed = parseJson(value, []);

  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => {
      if (typeof item === "string") {
        return {
          title: `Informasi ${index + 1}`,
          description: item,
        };
      }

      if (item && typeof item === "object") {
        return {
          ...item,
          title:
            item.title ||
            item.name ||
            item.label ||
            item.step ||
            `Informasi ${index + 1}`,
          description:
            item.description ||
            item.detail ||
            item.notes ||
            item.text ||
            "",
        };
      }

      return {
        title: `Informasi ${index + 1}`,
        description: String(item ?? ""),
      };
    });
  }

  if (typeof parsed === "string") {
    return [{ title: "Informasi", description: parsed }];
  }

  if (parsed && typeof parsed === "object") {
    return Object.entries(parsed).map(([key, item]) => ({
      title: key,
      description:
        typeof item === "string" ? item : JSON.stringify(item),
    }));
  }

  return [];
}

/* =========================================
   NORMALISASI RENCANA HARIAN
========================================= */

function normalizeDailyPlan(value) {
  const parsed = parseJson(value, []);

  if (Array.isArray(parsed)) {
    return parsed.map((item, index) => {
      if (typeof item === "string") {
        return {
          day: index + 1,
          title: `Hari ${index + 1}`,
          description: item,
        };
      }

      const dayValue = Number(
        item?.day ?? item?.day_number ?? item?.hari ?? index + 1
      );

      const day =
        Number.isFinite(dayValue) && dayValue > 0
          ? dayValue
          : index + 1;

      const taskValue = parseJson(
        item?.tasks ??
          item?.checklist ??
          item?.activities ??
          item?.steps,
        []
      );

      const taskText = Array.isArray(taskValue)
        ? taskValue
            .map((task) => {
              if (typeof task === "string") return task;

              return (
                task?.title ||
                task?.description ||
                task?.task ||
                task?.text ||
                ""
              );
            })
            .filter(Boolean)
            .join(" • ")
        : typeof taskValue === "string"
          ? taskValue
          : "";

      return {
        ...item,
        day,
        title: item?.title || item?.name || `Hari ${day}`,
        description:
          item?.description ||
          item?.detail ||
          item?.activity ||
          item?.text ||
          taskText ||
          "",
      };
    });
  }

  if (parsed && typeof parsed === "object") {
    if (Array.isArray(parsed.days)) {
      return normalizeDailyPlan(parsed.days);
    }

    if (Array.isArray(parsed.daily_plan)) {
      return normalizeDailyPlan(parsed.daily_plan);
    }

    if (Array.isArray(parsed.plan)) {
      return normalizeDailyPlan(parsed.plan);
    }

    return Object.entries(parsed).map(([key, item], index) => {
      const dayNumber =
        Number(String(key).match(/\d+/)?.[0]) || index + 1;

      const tasks = Array.isArray(item?.tasks)
        ? item.tasks
            .map((task) =>
              typeof task === "string"
                ? task
                : task?.title || task?.description || ""
            )
            .filter(Boolean)
            .join(" • ")
        : "";

      return {
        day: dayNumber,
        title: item?.title || `Hari ${dayNumber}`,
        description:
          typeof item === "string"
            ? item
            : item?.description ||
              item?.detail ||
              item?.activity ||
              tasks,
      };
    });
  }

  return [];
}

/* =========================================
   KAPASITAS WAKTU MINGGUAN
========================================= */

function parseWeeklyHours(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const numbers = String(value).match(/\d+(?:[.,]\d+)?/g);

  if (!numbers || numbers.length === 0) {
    return null;
  }

  const lowestValue = Number(numbers[0].replace(",", "."));

  return Number.isFinite(lowestValue) && lowestValue > 0
    ? lowestValue
    : null;
}

/*
 * Aktivitas tetap berasal dari proposal.
 * Fungsi ini hanya menambahkan informasi
 * kapasitas waktu untuk Daily Check-in.
 * Dipakai di mode preview. Mode asli dihitung di server.
 */

function buildDailyPlanWithCapacity(rawPlan, weeklyHours) {
  const plan = normalizeDailyPlan(rawPlan);

  if (!plan.length) return [];

  if (!weeklyHours || weeklyHours <= 0) {
    return plan;
  }

  const weeklyMinutes = Math.floor(weeklyHours * 60);
  const dailyMinutes = Math.floor(weeklyMinutes / 7);

  return plan.map((item) => ({
    ...item,
    weekly_capacity_hours: weeklyHours,
    weekly_capacity_minutes: weeklyMinutes,
    time_budget_minutes: dailyMinutes,
  }));
}

/* =========================================
   DETEKSI CHANNEL
========================================= */

function detectChannels(proposal) {
  const text = [
    proposal.title,
    proposal.problem_addressed,
    proposal.rationale,
    proposal.message_template,
    JSON.stringify(proposal.steps || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const channels = [];

  if (text.includes("whatsapp") || text.includes("wa ")) {
    channels.push("WhatsApp");
  }

  if (text.includes("instagram")) {
    channels.push("Instagram");
  }

  if (text.includes("facebook")) {
    channels.push("Facebook");
  }

  if (text.includes("tiktok")) {
    channels.push("TikTok");
  }

  if (text.includes("marketplace")) {
    channels.push("Marketplace");
  }

  return [...new Set(channels)];
}

/* =========================================
   NORMALISASI PROPOSAL
========================================= */

function normalizeProposal(data) {
  if (!data) return null;

  const parsedChannels = parseJson(data.channels, null);

  return {
    id: data.id,
    title: data.title || "Eksperimen tanpa judul",

    description:
      data.description ||
      data.problem_addressed ||
      data.rationale ||
      "Belum ada ringkasan eksperimen.",

    hypothesis:
      data.hypothesis || "Hipotesis eksperimen belum tersedia.",

    success: normalizeList(data.success_metrics),
    risk: normalizeList(data.risks),
    dailyPlan: normalizeDailyPlan(data.recommended_daily_plan),

    sourceType: data.source_type || null,
    growthInsightId: data.growth_insight_id || null,

    template: data.message_template || "",

    channels: Array.isArray(parsedChannels)
      ? parsedChannels.filter(Boolean)
      : detectChannels(data),

    estCost: Math.max(0, toNumber(data.est_cost)),

    // Semua eksperimen menggunakan 7 hari kalender.
    estDays: EXPERIMENT_DURATION_DAYS,

    growthLevel: toNumber(data.growth_level) || 1,

    raw: data,
  };
}

/* =========================================
   FINANCIAL READINESS
========================================= */

function calculateFinance(data) {
  if (!data) return null;

  const omzet = toNumber(data.monthly_revenue);

  const operational = toNumber(
    data.monthly_operating_cost ?? data.monthly_operating_co
  );

  const household = toNumber(data.household_need);

  const marginRaw = toNumber(data.product_margin_pct);
  const margin = marginRaw > 1 ? marginRaw / 100 : marginRaw;

  const businessProfit =
    data.business_profit !== null && data.business_profit !== undefined
      ? toNumber(data.business_profit)
      : null;

  const freeSurplus =
    data.free_surplus !== null && data.free_surplus !== undefined
      ? toNumber(data.free_surplus)
      : null;

  const willingness =
    data.willingness_to_lose !== null &&
    data.willingness_to_lose !== undefined
      ? toNumber(data.willingness_to_lose)
      : null;

  const affordableLoss =
    data.affordable_loss !== null && data.affordable_loss !== undefined
      ? toNumber(data.affordable_loss)
      : null;

  const rawRecommendedBudget =
    data.recommended_budget ?? data.recommended_budge;

  const recommendedBudget =
    rawRecommendedBudget !== null && rawRecommendedBudget !== undefined
      ? toNumber(rawRecommendedBudget)
      : null;

  let budget = null;

  if (
    recommendedBudget !== null &&
    freeSurplus !== null &&
    willingness !== null &&
    affordableLoss !== null
  ) {
    budget = Math.max(
      0,
      Math.min(
        recommendedBudget,
        freeSurplus,
        willingness,
        affordableLoss
      )
    );
  }

  const estimatedTarget =
    margin > 0 && budget !== null && budget > 0
      ? Math.ceil(budget / margin)
      : 0;

  return {
    omzet,
    operational,
    household,
    margin,
    businessProfit,
    freeSurplus,
    willingness,
    affordableLoss,
    recommendedBudget,
    budget,
    estimatedTarget,
    status: data.status,
    growthLevel: data.growth_level,
  };
}

/* =========================================
   WARNA KARTU
========================================= */

const colorMap = {
  violet: "bg-[#f3efff] border-[#e8e0fa] text-[#5032ae]",
  pink: "bg-[#fff0f5] border-[#f9dfe9] text-[#d83b80]",
  blue: "bg-[#edf4ff] border-[#dce8fa] text-[#2855a0]",
  green: "bg-[#e9f8f0] border-[#d8eee2] text-[#16866a]",
};

/* =========================================
   RINCIAN FINANSIAL
========================================= */

function FinanceDetails({ finance }) {
  const rows = [
    ["Omzet bulanan", finance.omzet],
    ["Biaya operasional bulanan", finance.operational],
    ["Laba usaha", finance.businessProfit],
    ["Kebutuhan rumah tangga", finance.household],
    ["Sisa dana", finance.freeSurplus],
    ["Kesediaan menanggung risiko", finance.willingness],
    ["Kemampuan budget", finance.budget],
  ];

  return (
    <details className="group mt-4 rounded-[14px] border border-[#eee9f8] bg-[#fcfbff] p-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[12px] font-bold text-[#35477f]">
        <span>Rincian perhitungan keuangan</span>

        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f0eaff] text-[#684bd0] transition-transform group-open:rotate-180">
          ↓
        </span>
      </summary>

      <div className="mt-3 space-y-0.5">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between gap-3 border-b border-[#f0edf7] py-2.5 text-[11px]"
          >
            <span className="text-[#7c849d]">{label}</span>

            <span className="shrink-0 font-bold text-[#394775]">
              {value === null || value === undefined
                ? "Belum tersedia"
                : formatRupiah(value)}
            </span>
          </div>
        ))}

        <div className="flex items-center justify-between py-2.5 text-[11px]">
          <span className="text-[#7c849d]">Margin produk</span>

          <span className="font-extrabold text-[#6844c9]">
            {(finance.margin * 100).toFixed(2)}%
          </span>
        </div>
      </div>

      <div className="mt-3 rounded-[10px] bg-[#f1edff] p-3 text-[10px] leading-relaxed text-[#66559d]">
        Perhitungan target rekomendasi menggunakan rumus:

        <p className="mt-1 font-bold">
          Kemampuan budget ÷ Margin produk = Target omzet
        </p>

        <p className="mt-2">
          Perhitungan menggunakan nilai Financial Readiness yang
          tersimpan. Sistem tidak menghitung ulang laba usaha dari
          omzet dan biaya operasional karena data HPP belum tersedia
          pada tabel ini.
        </p>
      </div>
    </details>
  );
}

/* =========================================
   HALAMAN RANCANGAN EKSPERIMEN
========================================= */

export default function Rancangan() {
  const router = useRouter();

  const savingRef = useRef(false);

  const [popup, setPopup] = useState(false);
  const [createdExperimentId, setCreatedExperimentId] = useState(null);
  const [alreadyExisting, setAlreadyExisting] = useState(false);
  const [copied, setCopied] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [business, setBusiness] = useState(null);
  const [finance, setFinance] = useState(null);
  const [proposal, setProposal] = useState(null);

  const [weeklyHours, setWeeklyHours] = useState(null);

  const [targetInput, setTargetInput] = useState("");
  const [targetEdited, setTargetEdited] = useState(false);

  const [isPreview, setIsPreview] = useState(false);

  /* =====================================
     AMBIL PROPOSAL ID DARI URL
  ===================================== */

  function getSelectedProposalId() {
    if (typeof window === "undefined") return null;

    const params = new URLSearchParams(window.location.search);

    if (params.get("mode") === "preview") {
      return null;
    }

    const proposalId =
      params.get("proposalId") || params.get("proposal_id");

    return proposalId?.trim() || null;
  }

  /* =====================================
     KEMBALI
  ===================================== */

  function kembali() {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/home");
    }
  }

  function bukaPreview() {
    window.location.href = window.location.pathname + "?mode=preview";
  }

  /* =====================================
     AMBIL DATA PROPOSAL, BISNIS,
     FINANCIAL READINESS, DAN CONSTRAINTS
     (lewat GET /api/experiments/context)
  ===================================== */

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams(window.location.search);

        const forcePreview = params.get("mode") === "preview";

        const proposalId = forcePreview ? null : getSelectedProposalId();

        /*
         * PREVIEW
         *
         * Tidak menggunakan login dan database.
         */

        if (forcePreview || !proposalId) {
          if (!mounted) return;

          setBusiness(DEMO_BUSINESS);
          setFinance(calculateFinance(DEMO_FINANCE));
          setProposal(normalizeProposal(DEMO_PROPOSAL));
          setWeeklyHours(3);
          setIsPreview(true);

          return;
        }

        /*
         * MODE ASLI
         *
         * Login, kepemilikan bisnis, dan validasi
         * dicek di server oleh route.
         */

        const res = await fetch(
          `/api/experiments/context?proposalId=${encodeURIComponent(
            proposalId
          )}`,
          { cache: "no-store" }
        );

        const result = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(
            result?.error || "Terjadi kesalahan saat mengambil data."
          );
        }

        const {
          proposal: proposalData,
          business: businessData,
          finance: financeData,
          constraints: constraintData,
        } = result;

        if (!proposalData || !businessData) {
          throw new Error("Data eksperimen tidak lengkap.");
        }

        if (!financeData) {
          throw new Error(
            "Data Financial Readiness belum ditemukan. Silakan lengkapi data keuangan terlebih dahulu."
          );
        }

        const calculatedFinance = calculateFinance(financeData);

        if (!calculatedFinance) {
          throw new Error("Data keuangan tidak dapat dihitung.");
        }

        const parsedWeeklyHours = parseWeeklyHours(
          constraintData?.hours_per_week
        );

        if (!mounted) return;

        setBusiness(businessData);
        setFinance(calculatedFinance);
        setProposal(normalizeProposal(proposalData));
        setWeeklyHours(parsedWeeklyHours);
        setIsPreview(false);

        sessionStorage.setItem("ep_selected_proposal_id", proposalId);
      } catch (err) {
        console.error("Gagal mengambil data:", err?.message);

        if (mounted) {
          setError(
            err?.message || "Terjadi kesalahan saat mengambil data."
          );
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
  }, []);

  /* =====================================
     SEMBUNYIKAN FOOTER
  ===================================== */

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
     TARGET EKSPERIMEN
  ===================================== */

  const target = targetEdited
    ? Math.max(0, toNumber(targetInput))
    : finance?.estimatedTarget || 0;

  const targetIsValid = Number.isFinite(target) && target > 0;

  const additionalExperimentCost = Math.max(0, proposal?.estCost ?? 0);

  const financeReady = Boolean(
    finance &&
      finance.omzet > 0 &&
      finance.margin > 0 &&
      finance.freeSurplus !== null &&
      finance.freeSurplus >= 0 &&
      finance.willingness !== null &&
      finance.affordableLoss !== null &&
      finance.budget !== null
  );

  const budgetSufficient = Boolean(
    finance &&
      finance.budget !== null &&
      additionalExperimentCost <= finance.budget
  );

  const canRun = Boolean(
    !loading &&
      !saving &&
      business &&
      financeReady &&
      proposal &&
      proposal.id &&
      targetIsValid &&
      budgetSufficient
  );

  /* =====================================
     STATUS TARGET
  ===================================== */

  let targetStatus = "Data keuangan belum tersedia.";

  if (finance) {
    if (isPreview) {
      targetStatus =
        "Ini adalah target contoh untuk melihat desain halaman. Data bisnis belum terhubung.";
    } else if (finance.omzet <= 0) {
      targetStatus =
        "Data omzet belum tersedia. Lengkapi data omzet pada Financial Readiness.";
    } else if (finance.freeSurplus === null) {
      targetStatus =
        "Data sisa dana belum tersedia. Periksa kembali Financial Readiness.";
    } else if (finance.freeSurplus < 0) {
      targetStatus =
        "Sisa dana setelah kebutuhan rumah tangga bernilai negatif. Eksperimen berbayar tidak dapat dijalankan.";
    } else if (
      finance.willingness === null ||
      finance.affordableLoss === null ||
      finance.budget === null
    ) {
      targetStatus =
        "Data kemampuan budget belum lengkap. Periksa kembali Financial Readiness.";
    } else if (finance.margin <= 0) {
      targetStatus =
        "Margin produk belum tersedia atau tidak valid sehingga target omzet belum dapat dihitung.";
    } else if (!budgetSufficient) {
      targetStatus =
        "Estimasi biaya strategi melebihi kemampuan budget yang tersedia. Strategi ini belum dapat dijalankan.";
    } else if (targetEdited && target > finance.estimatedTarget) {
      targetStatus =
        "Target pilihanmu lebih tinggi dari rekomendasi. Pastikan target tersebut realistis dengan kondisi bisnismu.";
    } else {
      targetStatus =
        "Target dihitung berdasarkan data Financial Readiness. Kamu tetap dapat menyesuaikannya sesuai tujuan bisnismu.";
    }
  }

  /* =====================================
     JALANKAN EKSPERIMEN
  ===================================== */

  async function jalankan() {
    if (savingRef.current || saving) return;

    /*
     * PREVIEW
     *
     * Tidak memanggil API dan tidak menyimpan ke database.
     */

    if (isPreview) {
      setError("");
      setAlreadyExisting(false);

      const previewId = generatePreviewId();

      const startDate = new Date();
      const endDate = new Date(startDate);

      endDate.setDate(endDate.getDate() + EXPERIMENT_DURATION_DAYS - 1);

      const previewDailyPlan = buildDailyPlanWithCapacity(
        DEMO_PROPOSAL.recommended_daily_plan,
        weeklyHours
      );

      const previewExperiment = {
        id: previewId,
        business_id: DEMO_BUSINESS.id,
        proposal_id: DEMO_PROPOSAL.id,

        title: proposal?.title || DEMO_PROPOSAL.title,
        description:
          proposal?.description || DEMO_PROPOSAL.problem_addressed,
        hypothesis: proposal?.hypothesis || DEMO_PROPOSAL.hypothesis,

        metric_name: `Omzet selama ${EXPERIMENT_DURATION_DAYS} hari`,

        baseline_value: Math.round(
          (toNumber(DEMO_FINANCE.monthly_revenue) / 30) *
            EXPERIMENT_DURATION_DAYS
        ),

        target_value: Math.round(target || finance?.estimatedTarget || 0),

        budget_planned: proposal?.estCost || 0,
        growth_level: proposal?.growthLevel || 1,

        start_date: dateOnly(startDate),
        end_date: dateOnly(endDate),

        status: "active",

        daily_plan: previewDailyPlan,
        success_criteria: DEMO_PROPOSAL.success_metrics,
        risks: DEMO_PROPOSAL.risks,

        message_template:
          proposal?.template || DEMO_PROPOSAL.message_template,

        channels: proposal?.channels || [],
        is_preview: true,
      };

      sessionStorage.setItem(
        `ep_preview_experiment_${previewId}`,
        JSON.stringify(previewExperiment)
      );

      sessionStorage.setItem(
        `ep_preview_checkins_${previewId}`,
        JSON.stringify([])
      );

      sessionStorage.setItem(
        "ep_preview_experiment",
        JSON.stringify(previewExperiment)
      );

      sessionStorage.setItem("ep_current_experiment_id", previewId);

      setCreatedExperimentId(previewId);
      setPopup(true);

      return;
    }

    /*
     * VALIDASI AWAL MODE ASLI
     */

    if (!canRun) {
      setError(
        "Data eksperimen belum memenuhi persyaratan. Periksa kembali data keuangan, target, dan biaya eksperimen."
      );
      return;
    }

    savingRef.current = true;
    setSaving(true);
    setError("");
    setAlreadyExisting(false);

    try {
      /*
       * Browser hanya mengirim id strategi dan target.
       * target = null artinya pakai rekomendasi terbaru dari server.
       * Semua pengecekan (login, pemilik bisnis, keuangan, biaya,
       * rencana harian, tanggal) dilakukan di server.
       */

      const res = await fetch("/api/experiments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          proposalId: proposal.id,
          target: targetEdited ? Math.max(0, toNumber(targetInput)) : null,
        }),
      });

      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          result?.error ||
            "Eksperimen gagal disimpan. Silakan coba kembali."
        );
      }

      if (!result?.id) {
        throw new Error(
          "Eksperimen tersimpan, tetapi ID eksperimen tidak berhasil diperoleh."
        );
      }

      sessionStorage.setItem("ep_current_experiment_id", result.id);
      sessionStorage.removeItem("ep_preview_experiment");

      if (result.alreadyExisting) {
        setAlreadyExisting(true);
      }

      setCreatedExperimentId(result.id);
      setPopup(true);
    } catch (err) {
      console.error("Gagal menjalankan eksperimen:", err?.message);

      setError(
        err?.message ||
          "Eksperimen gagal disimpan. Silakan coba kembali."
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  /* =====================================
     SALIN TEMPLATE PESAN
  ===================================== */

  async function salinPesan() {
    if (!proposal?.template) return;

    try {
      await navigator.clipboard.writeText(proposal.template);

      setCopied(true);

      window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error("Gagal menyalin pesan:", err);

      setCopied(false);

      setError(
        "Pesan belum berhasil disalin. Silakan salin teks secara manual."
      );
    }
  }

  /* =====================================
     INFORMASI EKSPERIMEN
  ===================================== */

  const info = [
    {
      icon: "◎",
      label: "Target omzet",
      value: target > 0 ? formatRupiah(target) : "Belum tersedia",
      color: "violet",
    },
    {
      icon: "♧",
      label: "Biaya tambahan",
      value: formatRupiah(additionalExperimentCost),
      color: "pink",
    },
    {
      icon: "◷",
      label: "Kapasitas waktu",
      value:
        weeklyHours !== null
          ? `${weeklyHours} jam/minggu`
          : "Belum tersedia",
      color: "blue",
    },
    {
      icon: "▦",
      label: "Durasi",
      value: `${EXPERIMENT_DURATION_DAYS} hari`,
      color: "green",
    },
    {
      icon: "◉",
      label: "Channel",
      value:
        proposal?.channels?.length > 0
          ? proposal.channels.join(" & ")
          : "Belum ditentukan",
      color: "green",
    },
    {
      icon: "▣",
      label: "Level",
      value: `Level ${proposal?.growthLevel || 1}`,
      color: "violet",
    },
  ];

  /* =====================================
     TOMBOL KEMBALI
  ===================================== */

  const backLabel = isPreview
    ? "‹ Kembali"
    : proposal?.sourceType === "growth_insight"
      ? "‹ Kembali ke Growth Insight"
      : "‹ Kembali ke peluang";

  /* =====================================
     LOADING
  ===================================== */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-[#e8defb] border-t-[#684bd0]" />

          <p className="mt-4 text-sm font-semibold text-[#684bd0]">
            Menyiapkan halaman eksperimen...
          </p>
        </div>
      </div>
    );
  }

  /* =====================================
     ERROR SAAT MEMUAT DATA
  ===================================== */

  if (error && (!business || !finance || !proposal)) {
    return (
      <div className="flex min-h-screen items-center justify-center px-5">
        <div className="w-full max-w-lg rounded-[22px] border border-[#f1dce5] bg-white p-6 text-center shadow-sm">
          <div className="text-4xl">⚠️</div>

          <h2 className="mt-3 text-lg font-extrabold text-[#19347c]">
            Data belum tersedia
          </h2>

          <p className="mt-2 text-sm leading-relaxed text-[#7c849d]">
            {error}
          </p>

          <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
            <button
              onClick={kembali}
              className="rounded-full bg-[#684bd0] px-6 py-3 text-sm font-bold text-white"
            >
              Kembali
            </button>

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

  if (!business || !finance || !proposal) {
    return null;
  }

  /* =====================================
     TAMPILAN UTAMA
  ===================================== */

  return (
    <div className="min-h-full overflow-x-hidden font-sans text-ink-title">
      <main className="relative isolate min-h-screen overflow-hidden">
        <div className="relative z-10 mx-0 w-full max-w-none space-y-6 pb-16">

          {/* MODE PREVIEW */}

          {isPreview && (
            <div className="flex items-start gap-3 rounded-[14px] border border-[#e6d9ff] bg-[#f3edff] px-4 py-3 text-[#684bd0]">
              <span className="text-lg">👀</span>

              <div>
                <p className="text-[11px] font-extrabold">
                  Mode Preview Aktif
                </p>

                <p className="mt-1 text-[10px] leading-relaxed">
                  Halaman ini menggunakan data contoh agar kamu bisa
                  melihat desain tanpa memilih strategi. Data ini bukan
                  data bisnis asli dan tidak akan disimpan ke database.
                </p>
              </div>
            </div>
          )}

          {/* HEADER */}

          <header>
            <button
              onClick={kembali}
              className="mb-3 rounded-full border border-lav-line bg-white px-4 py-1.5 text-xs font-bold text-brand shadow-sm"
            >
              {backLabel}
            </button>

            <p className="mb-2 text-sm font-semibold text-pink-ink">
              RANCANGAN EKSPERIMEN
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
              {proposal.title}
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              {proposal.description}
            </p>

            <p className="mt-2 text-xs font-semibold text-brand">
              Bisnis: {business.name}
            </p>
          </header>

          {/* HIPOTESIS */}

          <section className="flex items-center gap-4 rounded-[20px] border border-[#e9dffb] bg-[#f2ecff]/90 p-4 shadow-sm md:gap-5 md:p-5">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-white text-[30px] shadow-sm">
              💡
            </div>

            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-extrabold tracking-wide text-[#6635c5]">
                HIPOTESIS
              </p>

              <p className="text-[13px] font-extrabold leading-relaxed text-[#192e72] md:text-[15px]">
                {proposal.hypothesis}
              </p>
            </div>
          </section>

          {/* INFORMASI EKSPERIMEN */}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {info.map((item) => (
              <div
                key={item.label}
                className={`flex min-h-[67px] items-center gap-3 rounded-[17px] border px-3 py-3 shadow-sm md:px-4 ${colorMap[item.color]}`}
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-white/90 text-[20px] font-bold">
                  {item.icon}
                </div>

                <div className="min-w-0">
                  <p className="text-[10px] leading-tight text-[#79819b] md:text-[11px]">
                    {item.label}
                  </p>

                  <p className="mt-0.5 break-words text-[12px] font-extrabold leading-snug md:text-[13px]">
                    {item.value}
                  </p>
                </div>
              </div>
            ))}
          </section>

          {/* TARGET DAN INDIKATOR */}

          <section className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1.12fr_0.88fr]">

            {/* TARGET */}

            <div className="rounded-[22px] border border-[#ded8f5] bg-white p-4 shadow-[0_4px_16px_rgba(63,63,120,0.06)] md:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[22px]">
                  🎯
                </span>

                <div>
                  <h2 className="text-[15px] font-extrabold text-[#19347c] md:text-[17px]">
                    Target Eksperimen
                  </h2>

                  <p className="mt-0.5 text-[11px] text-[#858da8]">
                    Target omzet yang ingin dicapai selama eksperimen.
                  </p>
                </div>
              </div>

              <div
                className={`mt-4 rounded-[12px] border p-3 text-[11px] leading-relaxed ${
                  canRun || isPreview
                    ? "border-[#d5eee2] bg-[#effaf4] text-[#16866a]"
                    : "border-[#f5dfca] bg-[#fff6ed] text-[#a36b31]"
                }`}
              >
                <span className="mr-1">
                  {canRun || isPreview ? "✓" : "ⓘ"}
                </span>
                {targetStatus}
              </div>

              <div className="mt-4 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#f2edff] via-[#f8f2ff] to-[#fff0f6] p-4 md:p-5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-bold tracking-wide text-[#75659e]">
                    TARGET OMZET
                  </p>

                  <span className="rounded-full bg-white/80 px-2.5 py-1 text-[9px] font-bold text-[#684bd0]">
                    {EXPERIMENT_DURATION_DAYS} HARI
                  </span>
                </div>

                <p className="mt-2 text-[30px] font-extrabold tracking-tight text-[#5332bb] md:text-[36px]">
                  {formatRupiah(target)}
                </p>

                <p className="mt-2 max-w-[500px] text-[11px] leading-relaxed text-[#77738e]">
                  Target omzet merupakan perkiraan yang ingin dicapai
                  dari pelaksanaan eksperimen. Target rekomendasi dihitung
                  berdasarkan kemampuan budget dan margin produk,
                  bukan jaminan penjualan.
                </p>
              </div>

              {/* EDIT TARGET */}

              <div className="mt-4 rounded-[15px] border border-[#e9e2f8] bg-[#fcfaff] p-3.5 md:p-4">
                <label className="text-[12px] font-extrabold text-[#293c72]">
                  Sesuaikan target omzet
                </label>

                <p className="mt-1 text-[10px] leading-relaxed text-[#858da8]">
                  Kamu dapat menggunakan target rekomendasi atau
                  mengubahnya sesuai kemampuan dan tujuan bisnismu.
                </p>

                <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                  <div className="relative min-w-0 flex-1">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-[#4932a0]">
                      Rp
                    </span>

                    <input
                      type="text"
                      inputMode="numeric"
                      value={
                        targetEdited
                          ? formatThousands(targetInput)
                          : formatThousands(finance.estimatedTarget)
                      }
                      onChange={(e) => {
                        const digitsOnly = e.target.value.replace(
                          /\D/g,
                          ""
                        );

                        setTargetInput(digitsOnly);
                        setTargetEdited(true);
                        setError("");
                      }}
                      placeholder="Masukkan target omzet"
                      className="w-full rounded-[11px] border border-[#ded7f0] bg-white py-3 pl-11 pr-4 text-[13px] font-bold text-[#4932a0] outline-none transition focus:border-[#8967e8] focus:ring-2 focus:ring-[#8967e8]/10"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setTargetEdited(false);
                      setTargetInput("");
                      setError("");
                    }}
                    className="rounded-[11px] border border-[#ddd2f7] bg-white px-4 py-3 text-[11px] font-bold text-[#684bd0] transition hover:bg-[#f5f0ff]"
                  >
                    Gunakan rekomendasi
                  </button>
                </div>

                {targetEdited && target > 0 && (
                  <div
                    className={`mt-3 rounded-[10px] p-3 text-[10px] leading-relaxed ${
                      target >= finance.estimatedTarget
                        ? "bg-[#fff5e8] text-[#a36b31]"
                        : "bg-[#effaf4] text-[#16866a]"
                    }`}
                  >
                    {target >= finance.estimatedTarget
                      ? "Target pilihanmu lebih tinggi atau sama dengan rekomendasi. Pastikan target ini tetap realistis."
                      : "Target pilihanmu lebih rendah dari rekomendasi. Target ini merupakan pilihanmu sendiri."}
                  </div>
                )}
              </div>

              <FinanceDetails finance={finance} />

              <p className="mt-3 text-[10px] leading-relaxed text-[#9295a9]">
                Catatan: Biaya tambahan eksperimen mengikuti estimasi
                rekomendasi. Realisasi omzet dicatat berdasarkan
                penjualan sebenarnya, bukan berdasarkan target rekomendasi.
              </p>
            </div>

            {/* INDIKATOR KEBERHASILAN */}

            <div className="rounded-[22px] border border-[#e7e7f1] bg-white p-4 shadow-[0_4px_16px_rgba(63,63,120,0.06)] md:p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[22px]">
                  📊
                </span>

                <div>
                  <h2 className="text-[15px] font-extrabold text-[#19347c] md:text-[17px]">
                    Indikator Keberhasilan
                  </h2>

                  <p className="mt-0.5 text-[11px] text-[#858da8]">
                    Bagaimana hasil eksperimen dinilai?
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {proposal.success.length > 0 ? (
                  proposal.success.map((item, index) => (
                    <div
                      key={`${item.title}-${index}`}
                      className={`rounded-[15px] border p-3.5 ${
                        index === 0
                          ? "border-[#d7eee2] bg-[#effaf4]"
                          : index === 1
                            ? "border-[#f3e5c5] bg-[#fff8eb]"
                            : "border-[#f5dce6] bg-[#fff1f5]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-[14px] font-extrabold text-[#16866a]">
                          {index + 1}
                        </span>

                        <p className="text-[12px] font-extrabold text-[#293c72]">
                          {item.title}
                        </p>
                      </div>

                      <p className="mt-2 pl-[42px] text-[11px] leading-relaxed text-[#596580]">
                        {item.description}
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="rounded-[15px] border border-[#eeeaf7] bg-[#fcfbff] p-4 text-[11px] text-[#858da8]">
                    Indikator keberhasilan belum tersedia pada rekomendasi ini.
                  </div>
                )}
              </div>

              <div className="mt-4 rounded-[14px] border border-[#e9e2f8] bg-[#faf8ff] p-3.5">
                <p className="flex items-center gap-2 text-[11px] font-extrabold text-[#6246b2]">
                  <span>💡</span>
                  Cara evaluasi
                </p>

                <p className="mt-1.5 text-[10px] leading-relaxed text-[#858da8]">
                  Setelah eksperimen selesai, jumlahkan penjualan
                  yang diperoleh selama periode eksperimen. Kemudian
                  bandingkan dengan target omzet yang telah ditentukan.
                </p>

                <div className="mt-3 flex items-center gap-2 rounded-[10px] bg-white p-2.5">
                  <span className="text-[17px]">📝</span>

                  <p className="text-[10px] leading-relaxed text-[#596580]">
                    Catat jumlah penjualan setiap hari melalui Daily Check-in.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* RENCANA PELAKSANAAN */}

          <section className="rounded-[21px] border border-[#e7e7f1] bg-white/95 p-4 shadow-sm md:p-5">
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[21px]">
                📅
              </span>

              <div>
                <h2 className="text-[14px] font-extrabold text-[#19347c] md:text-[16px]">
                  Rencana Pelaksanaan {EXPERIMENT_DURATION_DAYS} Hari
                </h2>

                <p className="mt-0.5 text-[10px] text-[#8990a9] md:text-[11px]">
                  Gambaran tahapan eksperimen dari persiapan hingga evaluasi.
                </p>
              </div>
            </div>

            {proposal.dailyPlan.length > 0 ? (
              <ol className="relative">
                {proposal.dailyPlan.map((step, index) => {
                  const isLast =
                    index === proposal.dailyPlan.length - 1;

                  const dailyMinutes =
                    weeklyHours !== null
                      ? Math.floor((weeklyHours * 60) / 7)
                      : null;

                  return (
                    <li
                      key={`${step.title}-${index}`}
                      className={`relative flex gap-4 ${
                        isLast ? "" : "pb-4"
                      }`}
                    >
                      {!isLast && (
                        <span
                          aria-hidden="true"
                          className="absolute left-[19px] top-10 bottom-0 w-[2px] bg-gradient-to-b from-[#d9ccf7] to-[#eee8fb]"
                        />
                      )}

                      <span
                        className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[13px] font-extrabold ${
                          isLast
                            ? "bg-gradient-to-br from-[#6338d5] to-[#4930bd] text-white shadow-md"
                            : "border-2 border-[#d9ccf7] bg-white text-[#6042c8]"
                        }`}
                      >
                        {step.day}
                      </span>

                      <div className="min-w-0 flex-1 rounded-[13px] border border-[#eeeaf7] bg-[#fcfbff] px-4 py-2.5">
                        <p className="text-[10px] font-extrabold uppercase tracking-wide text-[#8b6fe0]">
                          Hari {step.day}
                        </p>

                        <p className="mt-0.5 text-[12px] font-bold leading-snug text-[#27396f] md:text-[13px]">
                          {step.description || step.title}
                        </p>

                        {dailyMinutes !== null && (
                          <p className="mt-1 text-[10px] text-[#9295a9]">
                            Alokasi waktu perencanaan:{" "}
                            {step.time_budget_minutes ?? dailyMinutes} menit
                          </p>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <div className="rounded-[13px] border border-[#eeeaf7] bg-[#fcfbff] p-4 text-[11px] text-[#858da8]">
                Rencana aktivitas belum tersedia pada rekomendasi ini.
              </div>
            )}

            <p className="mt-3 text-[10px] text-[#9295a9]">
              Tugas lebih rinci untuk setiap hari dapat dilihat dan
              diselesaikan melalui Daily Check-in.
            </p>

            {weeklyHours === null && (
              <p className="mt-2 text-[10px] text-[#a36b31]">
                Kapasitas waktu mingguan belum tersedia. Rencana aktivitas
                tetap mengikuti rekomendasi strategi yang dipilih.
              </p>
            )}
          </section>

          {/* RISIKO */}

          <section className="flex items-start gap-4 rounded-[20px] border border-[#e7e7f1] bg-white/95 p-4 shadow-sm md:p-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0eaff] text-[21px]">
              🛡️
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="text-[13px] font-extrabold text-[#19347c]">
                Risiko dan Dasar Pelaksanaan
              </h2>

              {proposal.risk.length > 0 ? (
                <div className="mt-2 space-y-2">
                  {proposal.risk.map((item, index) => (
                    <div key={`${item.title}-${index}`}>
                      <p className="text-[11px] font-bold text-[#596580]">
                        {item.title}
                      </p>

                      {item.description && (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#858da8]">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[11px] leading-relaxed text-[#858da8]">
                  Informasi risiko belum tersedia pada rekomendasi ini.
                </p>
              )}
            </div>
          </section>

          {/* TEMPLATE PESAN */}

          <section className="rounded-[20px] border border-[#f3e6c9] bg-[#fff6e5] p-4 shadow-sm md:p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <span className="text-[21px]">📋</span>

                <h2 className="text-[13px] font-extrabold text-[#19347c] md:text-[14px]">
                  Template Pesan
                </h2>
              </div>

              {proposal.template && (
                <button
                  onClick={salinPesan}
                  className="shrink-0 rounded-full border border-[#eee1c9] bg-white px-4 py-1.5 text-[11px] font-bold text-[#7559c7]"
                >
                  {copied ? "Tersalin ✓" : "Salin pesan ▢"}
                </button>
              )}
            </div>

            <div className="rounded-[13px] border border-[#eee8dc] bg-white p-3 text-[11px] leading-relaxed text-[#58627f] md:text-[12px]">
              {proposal.template ||
                "Template pesan belum tersedia pada rekomendasi ini."}
            </div>

            <p className="mt-2 text-[10px] text-[#9295a9] md:text-[11px]">
              Pesan dapat disesuaikan dengan nama produk dan gaya
              komunikasi bisnismu.
            </p>
          </section>

          {/* ERROR SIMPAN */}

          {error && (
            <div className="rounded-[12px] border border-[#f3d5df] bg-[#fff1f5] p-3 text-[11px] text-[#c13c70]">
              {error}
            </div>
          )}

          {/* TOMBOL JALANKAN EKSPERIMEN */}

          <button
            type="button"
            onClick={jalankan}
            disabled={!isPreview && (!canRun || saving)}
            className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-[#6338d5] via-[#5934d0] to-[#4930bd] py-3.5 text-[13px] font-extrabold text-white shadow-[0_5px_16px_rgba(91,55,200,0.23)] transition hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 md:py-4 md:text-[14px]"
          >
            <span className="text-lg">
              {isPreview ? "👀" : saving ? "◌" : "➤"}
            </span>

            {isPreview
              ? "Coba Tampilan Eksperimen"
              : saving
                ? "Menyimpan eksperimen..."
                : "Jalankan eksperimen"}

            {!saving && <span className="text-xl">›</span>}
          </button>

          <p className="text-center text-[10px] text-[#9295a9]">
            {isPreview
              ? "Mode Preview: kamu dapat mencoba tombol tanpa menyimpan data."
              : "Pastikan target omzet sudah sesuai sebelum memulai eksperimen."}
          </p>
        </div>
      </main>

      {/* POPUP BERHASIL / SIMULASI */}

      {popup &&
        typeof document !== "undefined" &&
        createPortal(
          <Popup
            title={
              isPreview
                ? "Preview Berhasil!"
                : alreadyExisting
                  ? "Eksperimen sudah berjalan"
                  : "Selamat menjalankan eksperimen"
            }
            text={
              isPreview
                ? "Kamu berhasil mencoba tombol pada halaman rancangan. Ini hanya simulasi tampilan dan tidak menyimpan data ke database."
                : alreadyExisting
                  ? `Eksperimen ${proposal.title} sudah berjalan, jadi tidak dibuat ulang. Lanjutkan dengan mengisi Daily Check-in.`
                  : `Eksperimen ${proposal.title} berhasil disimpan. Jangan lupa isi Daily Check-in setiap hari.`
            }
            onClose={() => setPopup(false)}
          >
            <button
              onClick={() => {
                setPopup(false);
                router.push("/home");
              }}
              className="flex min-h-[58px] flex-1 items-center justify-center rounded-full border border-[#d8cdf5] bg-white px-4 py-3 text-[13px] font-bold text-[#684bd0]"
            >
              Home
            </button>

            <button
              onClick={() => {
                setPopup(false);

                if (isPreview) {
                  router.push(
                    `/experiments/daily?mode=preview&experimentId=${encodeURIComponent(
                      createdExperimentId || ""
                    )}`
                  );
                } else {
                  router.push(
                    `/experiments/daily?experimentId=${encodeURIComponent(
                      createdExperimentId || ""
                    )}`
                  );
                }
              }}
              className="flex min-h-[58px] flex-1 items-center justify-center rounded-full bg-gradient-to-r from-[#6336db] to-[#4930ca] px-4 py-3 text-[13px] font-bold text-white shadow-md"
            >
              Daily Check-in
            </button>
          </Popup>,
          document.body
        )}
    </div>
  );
}