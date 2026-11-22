
"use client";

import { useMemo } from "react";
import {
  CalendarCheck,
  ClipboardCheck,
  TrendingUp,
  Info,
  AlertCircle,
} from "lucide-react";

// =========================================
// HELPER: TANGGAL DAN STATUS
// =========================================

// Mengambil tanggal lokal browser dalam format YYYY-MM-DD.
function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

// Memastikan tanggal memiliki format dan nilai kalender yang valid.
function isValidDateString(value) {
  if (typeof value !== "string") return false;

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const [, year, month, day] = match;
  const date = new Date(
    Date.UTC(Number(year), Number(month) - 1, Number(day))
  );

  return (
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === Number(month) - 1 &&
    date.getUTCDate() === Number(day)
  );
}

// Menghitung hari kalender secara inklusif.
function countDaysInclusive(startDate, endDate) {
  if (
    !isValidDateString(startDate) ||
    !isValidDateString(endDate) ||
    endDate < startDate
  ) {
    return 0;
  }

  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);

  return Math.floor((end - start) / 86400000) + 1;
}

// Menyamakan variasi status dari database.
function normalizeStatus(status) {
  const value = String(status ?? "").trim().toLowerCase();

  const statusMap = {
    active: "ongoing",
    ongoing: "ongoing",
    in_progress: "ongoing",
    "in-progress": "ongoing",

    completed: "completed",
    complete: "completed",
    finished: "completed",

    stopped: "stopped",
    cancelled: "stopped",
    canceled: "stopped",

    draft: "draft",
    planned: "planned",
  };

  return statusMap[value] ?? "unknown";
}

// =========================================
// BUSINESS CONSISTENCY
// =========================================

export default function BusinessConsistency({ data }) {
  const consistency = useMemo(() => {
    const experiments = data?.experiments ?? [];
    const checkins = data?.checkins ?? [];

    const today = getLocalDateString();

    // Menyimpan periode eksperimen yang valid untuk dihitung.
    const eligiblePeriods = new Map();

    let totalExpectedDays = 0;

    experiments.forEach((experiment) => {
      const status = normalizeStatus(experiment.status);

      // Hanya completed dan ongoing yang dihitung.
      // Stopped dikecualikan karena belum ada stopped_at.
      if (!["completed", "ongoing"].includes(status)) {
        return;
      }

      if (!isValidDateString(experiment.start_date)) {
        return;
      }

      // Ongoing dihitung sampai hari ini.
      // Completed menggunakan end_date.
      const effectiveEndDate =
        status === "ongoing"
          ? today
          : experiment.end_date;

      const expectedDays = countDaysInclusive(
        experiment.start_date,
        effectiveEndDate
      );

      if (expectedDays === 0) {
        return;
      }

      eligiblePeriods.set(experiment.id, {
        startDate: experiment.start_date,
        endDate: effectiveEndDate,
      });

      totalExpectedDays += expectedDays;
    });

    // Satu tanggal hanya dihitung satu kali
    // untuk setiap eksperimen.
    const checkinDateSet = new Set();

    // Hari dengan omzet yang benar-benar dicatat.
    const revenueDateSet = new Set();

    checkins.forEach((item) => {
      const period = eligiblePeriods.get(item.experiment_id);

      // Abaikan check-in yang tidak terkait eksperimen
      // dengan periode yang masuk perhitungan.
      if (!period) return;

      // Tanggal kosong atau tidak valid tidak dihitung.
      if (!isValidDateString(item.checkin_date)) return;

      // Check-in harus berada dalam periode eksperimen.
      if (
        item.checkin_date < period.startDate ||
        item.checkin_date > period.endDate
      ) {
        return;
      }

      const key = `${item.experiment_id}:${item.checkin_date}`;

      checkinDateSet.add(key);

      // Nol tetap merupakan omzet yang tercatat.
      // Null atau nilai tidak valid tidak dihitung.
      if (
        item.revenue_today !== null &&
        item.revenue_today !== undefined &&
        item.revenue_today !== "" &&
        Number.isFinite(Number(item.revenue_today))
      ) {
        revenueDateSet.add(key);
      }
    });

    const completedCheckins = checkinDateSet.size;
    const recordedRevenueDays = revenueDateSet.size;

    const missedDays = Math.max(
      0,
      totalExpectedDays - completedCheckins
    );

    // Jika belum ada periode valid, persentase tidak tersedia.
    const checkInRate =
      totalExpectedDays > 0
        ? Math.min(
            100,
            Math.round(
              (completedCheckins / totalExpectedDays) * 100
            )
          )
        : null;

    const recordingRate =
      totalExpectedDays > 0
        ? Math.min(
            100,
            Math.round(
              (recordedRevenueDays / totalExpectedDays) * 100
            )
          )
        : null;

    return {
      totalExpectedDays,
      completedCheckins,
      recordedRevenueDays,
      missedDays,
      checkInRate,
      recordingRate,
    };
  }, [data]);

  const hasExpectedDays = consistency.totalExpectedDays > 0;

  return (
    <section className="space-y-5">

      {/* =====================================
          MAIN CONSISTENCY CARD
      ====================================== */}

      <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h3 className="type-h2 text-ink-title">
              Konsistensi Pencatatan Bisnis
            </h3>

            <p className="type-caption mt-1 text-ink-muted">
              Pantau konsistensi check-in dan pencatatan omzet
              selama periode eksperimen.
            </p>
          </div>

          <div className="rounded-xl bg-lav-pale p-3">
            <CalendarCheck size={22} className="text-brand" />
          </div>
        </div>

        {/* Check-in Participation */}
        <ConsistencyProgress
          title="Partisipasi Daily Check-in"
          percentage={consistency.checkInRate}
          numerator={consistency.completedCheckins}
          denominator={consistency.totalExpectedDays}
          color="bg-bar-indigo"
          explanation="Persentase hari eksperimen yang memiliki Daily Check-in valid. Satu tanggal dihitung satu kali untuk setiap eksperimen."
        />

        {/* Revenue Recording Coverage */}
        <ConsistencyProgress
          title="Kelengkapan Pencatatan Omzet"
          percentage={consistency.recordingRate}
          numerator={consistency.recordedRevenueDays}
          denominator={consistency.totalExpectedDays}
          color="bg-pink-500"
          explanation="Persentase hari eksperimen yang memiliki catatan omzet valid. Omzet Rp0 tetap dihitung sebagai catatan, sedangkan nilai kosong tidak."
        />

        {/* Detail Cards */}
        <div className="mt-7 grid grid-cols-1 gap-3 sm:grid-cols-3">

          <DetailCard
            label="Total Hari Eksperimen"
            value={`${consistency.totalExpectedDays} hari`}
            icon={CalendarCheck}
            color="text-brand"
            background="bg-lav-pale"
          />

          <DetailCard
            label="Hari dengan Check-in"
            value={`${consistency.completedCheckins} hari`}
            icon={ClipboardCheck}
            color="text-emerald-600"
            background="bg-mint-soft"
          />

          <DetailCard
            label="Hari dengan Catatan Omzet"
            value={`${consistency.recordedRevenueDays} hari`}
            icon={TrendingUp}
            color="text-pink-ink"
            background="bg-pink-pale"
          />

        </div>

        {!hasExpectedDays && (
          <div className="mt-5 rounded-xl bg-lav-pale p-4">
            <p className="type-caption text-ink-muted">
              Belum ada periode eksperimen yang dapat digunakan
              untuk menghitung konsistensi pencatatan.
            </p>
          </div>
        )}

        <div className="mt-5 flex items-start gap-2 rounded-xl bg-sun-soft p-4">
          <Info
            size={17}
            className="mt-0.5 shrink-0 text-honey-ink"
          />
          <p className="type-caption text-ink-muted">
            Perhitungan menggunakan eksperimen yang sedang
            berjalan dan telah selesai. Eksperimen yang dihentikan
            tidak dihitung karena tanggal penghentian aktual
            belum tersedia.
          </p>
        </div>
      </div>

      {/* =====================================
          CHECK-IN ACTIVITY
      ====================================== */}

      <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">

        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-sun-soft p-3">
            <CalendarCheck size={20} className="text-honey-ink" />
          </div>

          <div>
            <h3 className="type-h2 text-ink-title">
              Aktivitas Daily Check-in
            </h3>

            <p className="type-caption text-ink-muted">
              Ringkasan aktivitas pencatatan selama periode
              eksperimen yang diperhitungkan.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between border-b border-row-line pb-4">
          <p className="type-body text-ink-muted">
            Hari dengan check-in
          </p>

          <p className="type-body font-semibold text-ink-title">
            {consistency.completedCheckins} hari
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <p className="type-body text-ink-muted">
            Hari tanpa check-in
          </p>

          <p className="type-body font-semibold text-ink-title">
            {hasExpectedDays
              ? `${consistency.missedDays} hari`
              : "—"}
          </p>
        </div>

        <p className="type-caption mt-5 rounded-xl bg-lav-pale p-4 text-ink-muted">
          Konsistensi pencatatan membantu Elevate Puan memahami
          perkembangan bisnis dengan lebih baik. Hari tanpa
          catatan omzet tidak selalu berarti bisnis tidak
          menghasilkan penjualan.
        </p>

      </div>
    </section>
  );
}

// =========================================
// REUSABLE PROGRESS INDICATOR
// =========================================

function ConsistencyProgress({
  title,
  percentage,
  numerator,
  denominator,
  color,
  explanation,
}) {
  const hasData = denominator > 0;

  return (
    <div className="mt-7">

      <div className="flex flex-wrap items-end justify-between gap-3">

        <div>
          <div className="flex items-center gap-2">
            <p className="type-caption text-ink-muted">
              {title}
            </p>

            <div className="group relative">
              <button
                type="button"
                aria-label={`Informasi ${title}`}
                className="rounded-full text-ink-muted hover:text-pink-ink focus:outline-none focus:ring-2 focus:ring-pink-200"
              >
                <Info size={15} />
              </button>

              <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 w-64 rounded-xl border border-lav-line bg-white p-3 text-xs leading-relaxed text-ink-muted opacity-0 shadow-xl transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                {explanation}
              </div>
            </div>
          </div>

          <p className="mt-1 text-3xl font-bold text-ink-title">
            {hasData ? `${percentage}%` : "—"}
          </p>
        </div>

        <p className="type-caption text-ink-muted">
          {numerator} dari {denominator} hari
        </p>

      </div>

      <div
        className="mt-3 h-3 overflow-hidden rounded-full bg-track"
        role="progressbar"
        aria-label={title}
        aria-valuenow={hasData ? percentage : 0}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{
            width: `${hasData ? percentage : 0}%`,
          }}
        />
      </div>

    </div>
  );
}

// =========================================
// REUSABLE DETAIL CARD
// =========================================

function DetailCard({
  label,
  value,
  icon: Icon,
  color,
  background,
}) {
  return (
    <div className="rounded-xl border border-row-line p-4">

      <div
        className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg ${background}`}
      >
        <Icon size={18} className={color} />
      </div>

      <p className="type-caption text-ink-muted">
        {label}
      </p>

      <p className="mt-1 text-lg font-bold text-ink-title">
        {value}
      </p>

    </div>
  );
}
