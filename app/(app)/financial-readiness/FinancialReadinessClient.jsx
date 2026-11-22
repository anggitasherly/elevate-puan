
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ClipboardList,
  TrendingUp,
  House,
  Coins,
  Wallet,
  ShieldAlert,
  Lightbulb,
  Target,
  FlaskConical,
  ChartNoAxesCombined,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  Calculator,
  Info,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";

const STORAGE_KEY = "elevate_financial_readiness";
const ANALYSIS_KEY = "elevate_financial_analysis";
const MIN_AMOUNT = 10000;

const EMPTY = {
  period: "Bulanan",
  revenue: "",
  expenses: "",
  householdNeed: "",
  budget: "",
  productMargin: "",
};

const MONEY_FIELDS = [
  "revenue",
  "expenses",
  "householdNeed",
  "budget",
];

const money = (n) =>
  "Rp" + Math.round(Math.abs(n)).toLocaleString("id-ID");

const signedMoney = (n) =>
  (n < 0 ? "-" : "") + money(n);

const parseMoney = (v) =>
  Number(String(v ?? "").replace(/\D/g, "")) || 0;

function Field({
  fieldKey,
  label,
  description,
  value,
  onChange,
  percent = false,
  example,
  allowZero = false,
  confirmed = false,
  onConfirm,
}) {
  const nominal = parseMoney(value);

  const isLow =
    !percent &&
    value !== "" &&
    nominal > 0 &&
    nominal < MIN_AMOUNT;

  const isZeroInvalid =
    !percent &&
    !allowZero &&
    value !== "" &&
    nominal === 0;

  const needsConfirmation = isLow && !confirmed;
  const isInvalid = needsConfirmation || isZeroInvalid;

  return (
    <div className="grid gap-3 border-b border-purple-50 py-4 last:border-0 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] sm:items-start">
      <div className="sm:pt-2">
        <div className="flex items-center gap-2">
          <label
            htmlFor={`finance-${fieldKey}`}
            className="block text-sm font-bold text-ink-title"
          >
            {label}
          </label>

          {!percent && (
            <span className="group relative inline-flex">
              <Info
                size={15}
                tabIndex={0}
                aria-label={`Informasi ${label}`}
                className="cursor-help text-purple-400"
              />
              <span
                role="tooltip"
                className="pointer-events-none absolute bottom-full left-0 z-50 mb-2 w-56 rounded-xl bg-[#30214E] px-3 py-2 text-xs leading-5 text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
              >
                Nominal kurang dari Rp10.000 tetap dapat
                digunakan setelah kamu mengonfirmasinya.
              </span>
            </span>
          )}
        </div>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          {description}
        </p>
      </div>

      <div className="min-w-0">
        <div
          className={`flex overflow-hidden rounded-xl border bg-white focus-within:ring-2 ${
            isInvalid
              ? "border-amber-300 focus-within:ring-amber-100"
              : isLow && confirmed
                ? "border-green-300 focus-within:ring-green-100"
                : "border-pink-line focus-within:ring-purple-200"
          }`}
        >
          {!percent && (
            <span className="flex items-center bg-purple-50 px-3 text-sm font-semibold text-purple-800">
              Rp
            </span>
          )}

          <input
            id={`finance-${fieldKey}`}
            type="text"
            inputMode={percent ? "decimal" : "numeric"}
            value={
              percent
                ? value
                : value === ""
                  ? ""
                  : Number(value).toLocaleString("id-ID")
            }
            placeholder={example}
            aria-invalid={isInvalid}
            onChange={(e) => {
              const raw = e.target.value;

              if (percent) {
                if (/^\d{0,3}([.,]\d{0,2})?$/.test(raw)) {
                  onChange(raw.replace(",", "."));
                }
              } else {
                onChange(raw.replace(/\D/g, ""));
              }
            }}
            className="min-w-0 w-full bg-transparent px-3 py-3 text-sm text-ink-title outline-none placeholder:text-slate-400"
          />

          {percent && (
            <span className="flex items-center bg-purple-50 px-4 text-sm font-bold text-purple-800">
              %
            </span>
          )}
        </div>

        {needsConfirmation && (
          <div
            role="alert"
            className="mt-2 rounded-2xl border border-amber-200 bg-amber-50 p-3 shadow-sm"
          >
            <div className="flex items-start gap-2">
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0 text-amber-600"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-amber-900">
                  Yakin nominalnya sudah benar?
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  Kamu memasukkan {money(nominal)},
                  kurang dari Rp10.000. Jika nominal ini
                  memang sesuai kondisi sebenarnya,
                  kamu tetap boleh menggunakannya.
                </p>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition hover:bg-amber-700"
                >
                  <CheckCircle2 size={15} />
                  Ya, gunakan nominal ini
                </button>
              </div>
            </div>
          </div>
        )}

        {isLow && confirmed && (
          <div className="mt-2 flex items-center gap-2 text-xs text-green-700">
            <CheckCircle2 size={16} />
            Nominal sudah dikonfirmasi dan dapat digunakan.
          </div>
        )}

        {isZeroInvalid && (
          <div
            role="alert"
            className="mt-2 flex items-center gap-2 text-xs text-amber-700"
          >
            <AlertCircle size={15} />
            Pendapatan harus lebih dari Rp0.
          </div>
        )}
      </div>
    </div>
  );
}

function Panel({
  icon: Icon,
  title,
  subtitle,
  children,
  color = "pink",
}) {
  return (
    <section className="rounded-3xl border border-pink-line bg-white/95 p-5 shadow-sm sm:p-7">
      <div className="mb-5 flex items-start gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
            color === "purple"
              ? "bg-purple-50 text-purple-600"
              : color === "yellow"
                ? "bg-amber-50 text-amber-500"
                : "bg-pink-50 text-pink-500"
          }`}
        >
          <Icon size={23} strokeWidth={1.9} />
        </div>

        <div>
          <h2 className="text-xl font-bold text-ink-title sm:text-2xl">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {subtitle}
          </p>
        </div>
      </div>

      {children}
    </section>
  );
}

function ResultRow({
  icon: Icon,
  label,
  detail,
  value,
  tone = "purple",
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-purple-50 py-3 last:border-0 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
            tone === "green"
              ? "bg-green-50 text-green-600"
              : tone === "yellow"
                ? "bg-amber-50 text-amber-500"
                : "bg-purple-50 text-purple-600"
          }`}
        >
          <Icon size={20} />
        </span>

        <div>
          <p className="text-sm font-bold text-ink-title">
            {label}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            {detail}
          </p>
        </div>
      </div>

      <div className="rounded-xl bg-gradient-to-r from-purple-50 to-pink-50 px-4 py-2 text-sm font-bold text-purple-900 sm:min-w-[170px] sm:text-right">
        {value}
      </div>
    </div>
  );
}

export default function FinancialReadinessClient() {
  const [data, setData] = useState(() => {
    try {
      if (typeof window === "undefined") return EMPTY;

      const saved = JSON.parse(
        sessionStorage.getItem(STORAGE_KEY) || "null"
      );

      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        return Object.fromEntries(
          Object.keys(EMPTY).map((key) => [
            key,
            saved[key] ?? EMPTY[key],
          ])
        );
      }
    } catch {
      // Gunakan nilai awal jika sessionStorage tidak tersedia.
    }

    return EMPTY;
  });

  const [confirmedLow, setConfirmedLow] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");

  function update(key, value) {
    const next =
      key === "period" && value !== data.period
        ? {
            ...EMPTY,
            period: value,
            productMargin: data.productMargin,
          }
        : { ...data, [key]: value };

    setData(next);
    setResult(null);
    setError("");

    if (key === "period") {
      setConfirmedLow({});
    } else {
      setConfirmedLow((prev) => {
        const updated = { ...prev };
        delete updated[key];
        return updated;
      });
    }

    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(next)
      );
      sessionStorage.removeItem(ANALYSIS_KEY);
    } catch {}
  }

  function confirmLow(key) {
    setConfirmedLow((prev) => ({
      ...prev,
      [key]: String(data[key]),
    }));
    setError("");
  }

  function reset() {
    setData(EMPTY);
    setConfirmedLow({});
    setResult(null);
    setError("");

    try {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem(ANALYSIS_KEY);
    } catch {}
  }

  async function calculate() {
    setError("");

    const required = [...MONEY_FIELDS, "productMargin"];

    if (required.some((key) =>
      data[key] === "" ||
      data[key] === null ||
      data[key] === undefined
    )) {
      setError("Lengkapi seluruh data keuangan terlebih dahulu.");
      return;
    }

    const unconfirmed = MONEY_FIELDS.filter((key) => {
      const amount = parseMoney(data[key]);
      return (
        amount > 0 &&
        amount < MIN_AMOUNT &&
        confirmedLow[key] !== String(data[key])
      );
    });

    if (unconfirmed.length > 0) {
      setError(
        "Konfirmasi terlebih dahulu setiap nominal di bawah Rp10.000."
      );
      return;
    }

    try {
      const response = await fetch("/api/financial-readiness", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, confirmedLow }),
      });

      const payload = await response.json();

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.message || "Perhitungan backend gagal."
        );
      }

      const { profit, surplus, budget, remaining, ratio } =
        payload.analysis;

      const unit =
        data.period === "Mingguan" ? "minggu" : "bulan";

      const gate = payload.financialGate || {};
      const gateStatus = gate.status;

      // Angka gate dari backend sudah dalam basis bulanan (normalized),
      // jadi teks gate selalu memakai "bulan", termasuk saat periode mingguan.
      const normalized = payload.normalized || {};
      const safeLimit = gate.affordableLoss;
      const gateBudget = normalized.experimentBudget ?? budget;
      const allowancePct = gate.riskAllowancePct;
      const hasSafeLimit = typeof safeLimit === "number";

      const surplusFinding =
        surplus <= 0
          ? {
              title: "Belum Ada Surplus",
              text:
                surplus < 0
                  ? `Setelah biaya operasional dan kebutuhan rumah tangga, uang usahamu kurang ${money(surplus)} per ${unit}. Karena itu belum ada dana yang aman dipakai untuk eksperimen.`
                  : `Setelah biaya operasional dan kebutuhan rumah tangga, tidak ada sisa uang per ${unit}. Karena itu belum ada dana yang aman dipakai untuk eksperimen.`,
              icon: ShieldAlert,
            }
          : {
              title: "Surplus Usaha",
              text: `Dari laba usaha ${signedMoney(profit)} per ${unit}, setelah dipakai untuk kebutuhan rumah tangga masih ada sisa ${money(surplus)}. Inilah dana yang secara perhitungan bisa kamu alokasikan.`,
              icon: TrendingUp,
            };

      const budgetFinding =
        surplus > 0
          ? {
              title: "Anggaran Eksperimen vs Surplus",
              text:
                remaining >= 0
                  ? `Anggaran eksperimen ${money(budget)} memakai ${ratio.toFixed(1)}% dari surplus. Setelah dikeluarkan, surplusmu masih tersisa ${money(remaining)} per ${unit}, jadi anggaran ini masih bisa ditutup.`
                  : `Anggaran eksperimen ${money(budget)} lebih besar dari surplusmu. Kekurangannya ${money(remaining)} per ${unit}.`,
              icon: Coins,
            }
          : {
              title: "Kebutuhan Pendanaan",
              text:
                budget > 0
                  ? `Anggaran eksperimen ${money(budget)} belum bisa ditutup dari surplus periode ini.`
                  : "Tidak ada biaya eksperimen yang direncanakan.",
              icon: Coins,
            };

      let gateFinding = null;

      if (gateStatus === "above_recommended") {
        gateFinding = {
          title: "Kenapa Anggaranmu di Atas Batas Aman?",
          text: hasSafeLimit
            ? `Sistem menyarankan anggaran eksperimen maksimal ${money(safeLimit)} per bulan, yaitu ${allowancePct}% dari surplus bulananmu. Anggaranmu ${money(gateBudget)}, lebih besar ${money(gateBudget - safeLimit)} dari batas itu. Ini bukan berarti uangmu tidak cukup. Batas ini dibuat agar kerugian tetap kecil jika hasil eksperimen belum sesuai harapan. Kamu bisa menurunkan anggaran menjadi ${money(safeLimit)} atau kurang.`
            : "Anggaran yang kamu rencanakan lebih besar dari batas aman yang disarankan sistem. Ini bukan berarti uangmu tidak cukup. Batas ini dibuat agar kerugian tetap kecil jika hasil eksperimen belum sesuai harapan. Pertimbangkan menurunkan anggaran sedikit.",
          icon: ShieldAlert,
        };
      } else if (gateStatus === "within_range") {
        gateFinding = {
          title: "Anggaran dalam Batas Aman",
          text: hasSafeLimit
            ? `Anggaran ${money(gateBudget)} tidak melebihi batas aman ${money(safeLimit)} per bulan (${allowancePct}% dari surplus bulanan). Kamu bisa menjalankan eksperimen sesuai rencana.`
            : "Anggaran eksperimenmu tidak melebihi batas aman yang disarankan sistem. Kamu bisa menjalankan eksperimen sesuai rencana.",
          icon: CheckCircle2,
        };
      } else if (gateStatus === "not_recommended") {
        gateFinding = {
          title: "Batas Aman Eksperimen",
          text: "Karena tidak ada surplus, batas aman dan rekomendasi anggaran eksperimen adalah Rp0. Mulai dari strategi tanpa biaya dulu sambil memperbaiki pengeluaran.",
          icon: ShieldAlert,
        };
      }

      const findings = [
        surplusFinding,
        budgetFinding,
        gateFinding,
        {
          title: "Yang Belum Dihitung",
          text: "Perhitungan ini hanya memakai pendapatan, biaya, dan kebutuhan rumah tangga yang kamu isi. Saldo kas dan kewajiban lain, misalnya cicilan, belum dihitung. Cek keduanya sebelum memutuskan.",
          icon: ShieldAlert,
        },
      ].filter(Boolean);

      const analysis = {
        profit,
        surplus,
        budget,
        remaining,
        ratio,
        findings,
        financialGate: payload.financialGate,
      };

      setResult(analysis);

      try {
        sessionStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(data)
        );

        sessionStorage.setItem(
          ANALYSIS_KEY,
          JSON.stringify({
            profit,
            surplus,
            budget,
            remaining,
            ratio,
            financialGate: payload.financialGate,
            findings: findings.map(({ title, text }) => ({
              title,
              text,
            })),
          })
        );
      } catch {}
    } catch (error) {
      setResult(null);
      setError(
        error.message || "Tidak dapat terhubung ke backend."
      );
    }
  }
  const periodUnit =
    data.period === "Mingguan" ? "minggu" : "bulan";

  const fieldProps = (key) => ({
    fieldKey: key,
    value: data[key],
    onChange: (value) => update(key, value),
    confirmed: confirmedLow[key] === String(data[key]),
    onConfirm: () => confirmLow(key),
  });

  return (
    <div className="min-h-full space-y-6 text-ink">
      {/* HEADER */}
      <header>
        <p className="mb-2 text-sm font-semibold text-pink-ink">
          KESIAPAN FINANSIAL
        </p>

        <h1 className="text-2xl font-bold tracking-tight text-ink-title md:text-3xl">
          Bagaimana Kondisi Keuanganmu?
        </h1>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
          Yuk, cek kesiapan finansial bisnismu secara menyeluruh.
        </p>
      </header>

      {/* FORM */}
      <Panel
        icon={ClipboardList}
        title="Data Keuangan Bisnismu Saat Ini"
        subtitle="Lengkapi data berikut untuk memahami kondisi keuangan usahamu."
      >
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <label
            htmlFor="finance-period"
            className="text-sm font-semibold"
          >
            Periode Analisis
          </label>

          <select
            id="finance-period"
            value={data.period}
            onChange={(e) =>
              update("period", e.target.value)
            }
            className="rounded-xl border border-pink-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-purple-200 sm:w-1/2"
          >
            <option>Bulanan</option>
            <option>Mingguan</option>
          </select>
        </div>

        <p className="rounded-xl bg-gradient-to-r from-pink-50 to-purple-50 p-3 text-xs leading-5 text-purple-800">
          Masukkan pendapatan, biaya operasional, dan
          kebutuhan rumah tangga sesuai periode{" "}
          {data.period.toLowerCase()}.
        </p>

        <div className="mt-2">
          <Field
            {...fieldProps("revenue")}
            label="Total Pendapatan Usaha"
            description={`Total omzet usaha selama satu ${periodUnit}.`}
            example="Contoh: 3.500.000"
          />

          <Field
            {...fieldProps("expenses")}
            label="Biaya Operasional dan HPP"
            description={`Pengeluaran usaha selama satu ${periodUnit}.`}
            example="Contoh: 1.800.000"
            allowZero
          />

          <Field
            {...fieldProps("householdNeed")}
            label="Kebutuhan Rumah Tangga"
            description={`Kebutuhan rumah tangga selama satu ${periodUnit}.`}
            example="Contoh: 1.000.000"
            allowZero
          />

          <Field
            {...fieldProps("budget")}
            label="Rencana Anggaran Eksperimen"
            description="Anggaran untuk satu eksperimen bisnis."
            example="Contoh: 500.000"
            allowZero
          />

          <Field
            {...fieldProps("productMargin")}
            label="Margin Keuntungan Produk"
            description="Persentase keuntungan dari harga jual setelah biaya pokok produk."
            example="Contoh: 30"
            percent
          />
        </div>

        {error && (
          <p
            role="alert"
            className="mt-3 rounded-xl border border-red-100 bg-red-50 p-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={reset}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-pink-200 bg-white px-5 py-3 text-sm font-bold text-pink-500 transition hover:bg-pink-50"
          >
            <RotateCcw size={17} />
            Reset
          </button>

          <button
            type="button"
            onClick={calculate}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-400 to-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
          >
            <Calculator size={17} />
            Hitung Kesiapan
          </button>
        </div>
      </Panel>

      {/* HASIL ANALISIS */}
      <Panel
        icon={ChartNoAxesCombined}
        title="Hasil Analisis Keuangan"
        subtitle="Ringkasan perhitungan berdasarkan data keuanganmu."
        color="purple"
      >
        {!result ? (
          <p className="rounded-xl bg-purple-50/60 p-5 text-sm text-slate-500">
            Isi data keuangan dan tekan Hitung Kesiapan
            untuk melihat hasil analisis.
          </p>
        ) : (
          <div>
            <ResultRow
              icon={TrendingUp}
              label={`Laba Usaha per ${periodUnit}`}
              detail="Pendapatan dikurangi biaya operasional."
              value={signedMoney(result.profit)}
            />

            <ResultRow
              icon={House}
              label={`Kebutuhan Rumah Tangga per ${periodUnit}`}
              detail="Anggaran yang kamu sisihkan untuk kebutuhan rumah tangga."
              value={money(
                parseMoney(data.householdNeed)
              )}
            />

            <ResultRow
              icon={Coins}
              label="Surplus Setelah Kebutuhan Rumah Tangga"
              detail="Surplus periode, bukan saldo kas."
              value={signedMoney(result.surplus)}
              tone={
                result.surplus >= 0
                  ? "green"
                  : "yellow"
              }
            />

            <ResultRow
              icon={FlaskConical}
              label="Rencana Anggaran Eksperimen"
              detail="Anggaran yang kamu rencanakan."
              value={money(result.budget)}
            />

            <ResultRow
              icon={Wallet}
              label="Sisa Surplus Setelah Eksperimen"
              detail="Simulasi setelah anggaran eksperimen dikeluarkan."
              value={signedMoney(result.remaining)}
              tone={
                result.remaining >= 0
                  ? "green"
                  : "yellow"
              }
            />

            <ResultRow
              icon={ShieldAlert}
              label="Status Kesiapan"
              detail={
                result?.financialGate?.status === "within_range"
                  ? "Batas kerugian berada dalam rekomendasi batas aman berdasarkan surplus bulanan."
                  : result?.financialGate?.status === "above_recommended"
                    ? "Anggaran lebih besar dari batas aman yang disarankan, meski surplusmu masih cukup."
                    : result?.financialGate?.status === "not_recommended"
                      ? "Surplus bulanan belum mendukung pendanaan eksperimen."
                      : "Batas aman belum dievaluasi."
              }
              value={
                result?.financialGate?.status === "within_range"
                  ? "Dalam Batas yang Direkomendasikan"
                  : result?.financialGate?.status === "above_recommended"
                    ? "Melebihi Batas yang Direkomendasikan"
                    : result?.financialGate?.status === "not_recommended"
                      ? "Belum Direkomendasikan"
                      : "Perlu evaluasi lanjutan"
              }
              tone={
                result?.financialGate?.status === "within_range"
                  ? "green"
                  : "yellow"
              }
            />
          </div>
        )}
      </Panel>

      {/* TEMUAN */}
      <Panel
        icon={Lightbulb}
        title="Temuan"
        subtitle="Hal penting yang terungkap dari kondisi keuangan usahamu."
        color="yellow"
      >
        {!result ? (
          <p className="rounded-xl bg-pink-50/60 p-4 text-sm text-slate-500">
            Temuan akan muncul setelah kamu menghitung
            kondisi keuangan.
          </p>
        ) : (
          <div className="space-y-3">
            {result.findings.map((item, index) => {
              const Icon = item.icon;

              return (
                <div
                  key={index}
                  className="flex items-start gap-3 rounded-2xl border border-purple-50 bg-gradient-to-r from-white to-purple-50/50 p-4"
                >
                  <Icon
                    size={20}
                    className="mt-0.5 shrink-0 text-purple-500"
                  />
                  <div>
                    <p className="text-sm font-bold text-purple-900">
                      {item.title}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {item.text}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {/* IMPLIKASI */}
      <section className="rounded-3xl border border-amber-100 bg-gradient-to-r from-amber-50/80 to-white p-6">
        <div className="flex items-start gap-3">
          <Target
            size={25}
            className="shrink-0 text-amber-500"
          />

          <div>
            <h2 className="text-xl font-bold">
              Apa Artinya untuk Usahamu?
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-700">
              {!result
                ? "Lengkapi analisis untuk memahami implikasi rencana anggaran terhadap kondisi usahamu."
                : result.surplus <= 0
                  ? "Belum ada surplus periode ini untuk menutup biaya eksperimen. Pertimbangkan strategi tanpa biaya dan evaluasi pengeluaran terlebih dahulu."
                  : result.remaining < 0
                    ? "Rencana eksperimen melebihi surplus periode ini. Pertimbangkan menyesuaikan anggaran sebelum menjalankannya."
                    : result.financialGate?.status === "above_recommended"
                      ? "Surplusmu cukup untuk menutup anggaran eksperimen, tetapi anggarannya lebih besar dari batas aman yang disarankan. Menurunkan anggaran akan menjaga risiko tetap kecil. Cek juga saldo kas dan kewajiban lain sebelum memulai."
                      : "Secara perhitungan, surplus periode ini dapat menutup rencana anggaran eksperimen. Namun, saldo kas dan kewajiban lain belum diperiksa."}
            </p>
          </div>
        </div>
      </section>

      {/* NAVIGASI */}
      <nav
        aria-label="Navigasi Financial Readiness"
        className="flex flex-col gap-3 border-t border-pink-line pt-7 sm:flex-row sm:justify-between"
      >
        <Link
          href="/business-overview"
          className="inline-flex items-center justify-center gap-2 rounded-full border border-purple-200 px-5 py-3 text-sm font-semibold text-purple-700 transition hover:bg-purple-50"
        >
          <ArrowLeft size={17} />
          Kembali ke Business Overview
        </Link>

        <Link
          href="/realistic-condition"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-400 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
        >
          Lanjut ke Kondisi & Kendala Usaha
          <ArrowRight size={17} />
        </Link>
      </nav>
    </div>
  );
}



