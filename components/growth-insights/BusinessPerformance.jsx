
"use client";

import { useMemo, useState } from "react";
import {
  TrendingUp,
  Wallet,
  Award,
  Info,
} from "lucide-react";

import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LabelList,
} from "recharts";

// =========================================
// FORMAT RUPIAH
// =========================================

const formatRupiah = (value) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

const formatCompactRupiah = (value) => {
  if (value >= 1000000) {
    return `${(value / 1000000).toLocaleString("id-ID", {
      maximumFractionDigits: 1,
    })} jt`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toLocaleString("id-ID", {
      maximumFractionDigits: 0,
    })} rb`;
  }

  return value;
};

// =========================================
// FORMAT TANGGAL
// =========================================

const formatDate = (date) => {
  if (!date) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00`));
};

// =========================================
// CUSTOM TOOLTIP GRAFIK
// =========================================

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) {
    return null;
  }

  return (
    <div className="rounded-xl border border-pink-100 bg-white px-4 py-3 shadow-lg">
      <p className="type-caption text-ink-muted">
        {label}
      </p>

      <p className="mt-1 text-sm font-bold text-pink-ink">
        {formatRupiah(payload[0].value)}
      </p>
    </div>
  );
}

// =========================================
// LABEL DI ATAS BATANG
// =========================================

function RevenueBarLabel({ x, y, width, value }) {
  if (value === undefined || value === null) {
    return null;
  }

  return (
    <text
      x={x + width / 2}
      y={y - 9}
      fill="#a83268"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
    >
      {formatCompactRupiah(value)}
    </text>
  );
}

// =========================================
// BUSINESS PERFORMANCE
// Data berasal dari API Growth Insights.
// =========================================

export default function BusinessPerformance({ data }) {
  const [activeView, setActiveView] = useState("monthly");

  const revenueData = useMemo(() => {
    const checkins = data?.checkins || [];
    const experiments = data?.experiments || [];

    // Hanya mengambil check-in yang omzetnya benar-benar dicatat.
    // Nilai 0 tetap dihitung, sedangkan null tidak dihitung.
    const recordedCheckins = checkins.filter(
      (item) =>
        item.revenue_today !== null &&
        item.revenue_today !== undefined &&
        Number.isFinite(Number(item.revenue_today))
    );

    const experimentMap = new Map(
      experiments.map((experiment) => [
        experiment.id,
        experiment.title,
      ])
    );

    // Mengelompokkan omzet berdasarkan tanggal.
    const dailyMap = new Map();

    recordedCheckins.forEach((item) => {
      const date = item.checkin_date;
      const revenue = Number(item.revenue_today);

      if (!dailyMap.has(date)) {
        dailyMap.set(date, 0);
      }

      dailyMap.set(
        date,
        dailyMap.get(date) + revenue
      );
    });

    const dailyRevenue = Array.from(
      dailyMap,
      ([date, revenue]) => ({
        date,
        revenue,
      })
    ).sort((a, b) => a.date.localeCompare(b.date));

    // Total omzet dari seluruh hari yang memiliki pencatatan.
    const totalRevenue = dailyRevenue.reduce(
      (total, item) => total + item.revenue,
      0
    );

    // Rata-rata hanya menggunakan hari yang memiliki pencatatan omzet.
    const averageDailyRevenue =
      dailyRevenue.length > 0
        ? totalRevenue / dailyRevenue.length
        : 0;

    // Mencari hari dengan omzet tertinggi.
    const highestRevenueDay = dailyRevenue.reduce(
      (highest, item) =>
        !highest || item.revenue > highest.revenue
          ? item
          : highest,
      null
    );

    // Mengelompokkan omzet berdasarkan bulan.
    const monthlyMap = new Map();

    dailyRevenue.forEach((item) => {
      const monthKey = item.date.slice(0, 7);

      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, 0);
      }

      monthlyMap.set(
        monthKey,
        monthlyMap.get(monthKey) + item.revenue
      );
    });

    // Urutkan menggunakan key YYYY-MM agar kronologis.
    const monthlyRevenue = Array.from(
      monthlyMap,
      ([month, revenue]) => ({
        month,
        label: new Intl.DateTimeFormat("id-ID", {
          month: "short",
          year: "numeric",
        }).format(new Date(`${month}-01T00:00:00`)),
        revenue,
      })
    ).sort((a, b) => a.month.localeCompare(b.month));

    // Mengelompokkan omzet berdasarkan eksperimen.
    // Eksperimen tanpa pencatatan omzet tidak dimasukkan.
    // Catatan omzet Rp0 tetap dimasukkan.
    const experimentRevenueMap = new Map();

    recordedCheckins.forEach((item) => {
      const experimentId = item.experiment_id;
      const revenue = Number(item.revenue_today);

      if (!experimentRevenueMap.has(experimentId)) {
        experimentRevenueMap.set(experimentId, 0);
      }

      experimentRevenueMap.set(
        experimentId,
        experimentRevenueMap.get(experimentId) + revenue
      );
    });

    const experimentRevenue = Array.from(
      experimentRevenueMap,
      ([experimentId, revenue]) => ({
        experimentId,
        label:
          experimentMap.get(experimentId) ||
          "Eksperimen tanpa nama",
        revenue,
      })
    ).sort((a, b) => b.revenue - a.revenue);

    return {
      totalRevenue,
      averageDailyRevenue,
      highestRevenueDay,
      monthlyRevenue,
      experimentRevenue,
      recordedDays: dailyRevenue.length,
    };
  }, [data]);

  const chartData =
    activeView === "monthly"
      ? revenueData.monthlyRevenue
      : revenueData.experimentRevenue;

  return (
    <section className="space-y-6">

      {/* =====================================
          REVENUE OVERVIEW
      ====================================== */}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

        <MetricCard
          title="Total Recorded Revenue"
          value={formatRupiah(revenueData.totalRevenue)}
          description="Total omzet yang sudah dicatat"
          explanation="Jumlah seluruh omzet yang tercatat melalui Daily Check-in selama periode data yang tersedia. Hari yang belum mencatat omzet tidak dimasukkan."
          icon={Wallet}
          iconStyle="bg-lav-pale text-brand"
        />

        <MetricCard
          title="Average Daily Revenue"
          value={formatRupiah(revenueData.averageDailyRevenue)}
          description="Rata-rata omzet per hari pencatatan"
          explanation="Rata-rata omzet dihitung dari total omzet dibagi jumlah hari yang memiliki catatan omzet. Hari tanpa pencatatan tidak ikut dihitung."
          icon={TrendingUp}
          iconStyle="bg-pink-pale text-pink-ink"
        />

        <MetricCard
          title="Highest Revenue Day"
          value={formatRupiah(
            revenueData.highestRevenueDay?.revenue || 0
          )}
          description={
            revenueData.highestRevenueDay
              ? `Tercatat pada ${formatDate(
                  revenueData.highestRevenueDay.date
                )}`
              : "Belum ada pencatatan omzet"
          }
          explanation="Hari dengan jumlah omzet tercatat paling tinggi dibandingkan hari lainnya selama periode data yang tersedia."
          icon={Award}
          iconStyle="bg-sun-soft text-honey-ink"
        />

      </div>

      {/* =====================================
          REVENUE TREND
      ====================================== */}

      <div className="rounded-2xl border border-lav-line bg-white p-5 shadow-sm md:p-6">

        <div className="flex flex-wrap items-start justify-between gap-4">

          <div>
            <h3 className="type-h2 text-ink-title">
              Revenue Trend
            </h3>

            <p className="type-caption mt-1 text-ink-muted">
              Pantau perkembangan omzet dari catatan bisnismu.
            </p>
          </div>

          {/* Pilihan tampilan grafik */}
          <div className="flex rounded-xl bg-pink-pale p-1">

            <button
              type="button"
              onClick={() => setActiveView("monthly")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeView === "monthly"
                  ? "bg-white text-pink-ink shadow-sm"
                  : "text-ink-muted hover:text-pink-ink"
              }`}
            >
              Monthly
            </button>

            <button
              type="button"
              onClick={() => setActiveView("experiment")}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                activeView === "experiment"
                  ? "bg-white text-pink-ink shadow-sm"
                  : "text-ink-muted hover:text-pink-ink"
              }`}
            >
              Per Experiment
            </button>

          </div>
        </div>

        {/* Grafik omzet */}
        <div className="mt-8 h-80 w-full">

          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">

              {activeView === "monthly" ? (
                <AreaChart
                  data={chartData}
                  margin={{
                    top: 12,
                    right: 12,
                    left: 4,
                    bottom: 4,
                  }}
                >

                  <defs>
                    <linearGradient
                      id="revenuePinkGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ff498c"
                        stopOpacity={0.32}
                      />

                      <stop
                        offset="95%"
                        stopColor="#ff498c"
                        stopOpacity={0.015}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#f1e6ec"
                    strokeDasharray="4 5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#99919a",
                      fontSize: 12,
                    }}
                    dy={12}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#99919a",
                      fontSize: 11,
                    }}
                    tickFormatter={formatCompactRupiah}
                    width={55}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    content={<RevenueTooltip />}
                    cursor={{
                      stroke: "#ff9cbd",
                      strokeDasharray: "4 4",
                    }}
                  />

                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="#ff498c"
                    strokeWidth={3}
                    fill="url(#revenuePinkGradient)"
                    activeDot={{
                      r: 6,
                      fill: "#ff498c",
                      stroke: "#ffffff",
                      strokeWidth: 3,
                    }}
                    dot={{
                      r: 3,
                      fill: "#ff498c",
                      stroke: "#ffffff",
                      strokeWidth: 2,
                    }}
                    animationDuration={800}
                    animationEasing="ease-out"
                  />

                </AreaChart>
              ) : (
                <BarChart
                  data={chartData}
                  margin={{
                    top: 28,
                    right: 16,
                    left: 4,
                    bottom: 42,
                  }}
                  barCategoryGap="35%"
                >

                  <defs>
                    <linearGradient
                      id="experimentPinkGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="#ff498c"
                        stopOpacity={1}
                      />

                      <stop
                        offset="100%"
                        stopColor="#ff9cbd"
                        stopOpacity={0.72}
                      />
                    </linearGradient>
                  </defs>

                  <CartesianGrid
                    stroke="#f1e6ec"
                    strokeDasharray="4 5"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    interval={0}
                    height={55}
                    angle={-12}
                    textAnchor="end"
                    tick={{
                      fill: "#827985",
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#99919a",
                      fontSize: 11,
                    }}
                    tickFormatter={formatCompactRupiah}
                    width={55}
                    domain={[0, "auto"]}
                  />

                  <Tooltip
                    content={<RevenueTooltip />}
                    cursor={{
                      fill: "#fff0f6",
                    }}
                  />

                  <Bar
                    dataKey="revenue"
                    fill="url(#experimentPinkGradient)"
                    radius={[10, 10, 2, 2]}
                    maxBarSize={64}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    <LabelList
                      dataKey="revenue"
                      content={<RevenueBarLabel />}
                    />
                  </Bar>

                </BarChart>
              )}

            </ResponsiveContainer>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <TrendingUp
                size={32}
                className="mb-3 text-ink-muted"
              />

              <p className="text-sm font-medium text-ink-title">
                Belum ada data omzet
              </p>

              <p className="type-caption mt-1 max-w-sm text-ink-muted">
                Catat omzet melalui Daily Check-in untuk melihat
                grafik perkembangan bisnismu.
              </p>
            </div>
          )}

        </div>

        <p className="type-caption mt-4 text-ink-muted">
          {activeView === "monthly"
            ? "Total omzet berdasarkan bulan pencatatan."
            : "Total omzet yang tercatat pada masing-masing eksperimen."}
        </p>

      </div>

    </section>
  );
}

// =========================================
// REUSABLE METRIC CARD + INFO TOOLTIP
// =========================================

function MetricCard({
  title,
  value,
  description,
  explanation,
  icon: Icon,
  iconStyle,
}) {
  return (
    <div className="relative rounded-2xl border border-lav-line bg-white p-5 shadow-sm">

      <div className="flex items-center justify-between">

        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${iconStyle}`}
        >
          <Icon size={20} />
        </div>

        {/* Tooltip penjelasan */}
        <div className="group relative">
          <button
            type="button"
            aria-label={`Informasi ${title}`}
            aria-describedby={`tooltip-${title.replaceAll(" ", "-")}`}
            className="rounded-full p-1 text-ink-muted transition hover:bg-pink-pale hover:text-pink-ink focus:outline-none focus:ring-2 focus:ring-pink-200"
          >
            <Info size={17} />
          </button>

          <div
            id={`tooltip-${title.replaceAll(" ", "-")}`}
            role="tooltip"
            className="pointer-events-none absolute right-0 top-full z-30 mt-2 w-64 rounded-xl border border-lav-line bg-white p-3 text-left text-xs leading-relaxed text-ink-muted opacity-0 shadow-xl transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <p className="mb-1 font-semibold text-ink-title">
              Apa artinya?
            </p>

            {explanation}
          </div>
        </div>

      </div>

      <p className="mt-5 text-xl font-bold text-ink-title">
        {value}
      </p>

      <p className="type-caption mt-1 text-ink-muted">
        {title}
      </p>

      <p className="type-micro mt-1 text-ink-muted">
        {description}
      </p>

    </div>
  );
}
