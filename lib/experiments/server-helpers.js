/*
 * Helper khusus sisi server untuk route /api/experiments.
 * Logikanya disalin dari halaman Rancangan supaya hasil hitungan sama.
 */

export const EXPERIMENT_DURATION_DAYS = 7;

export const EXPERIMENT_STATUS = {
  ACTIVE: "active",
  LEGACY_RUNNING: "running",
  COMPLETED: "completed",
  STOPPED: "stopped",
  EXPIRED: "expired",
};

export const ALLOWED_SOURCE_TYPES = ["opportunity_library", "growth_insight"];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value) =>
  typeof value === "string" && UUID_RE.test(value);

export const formatRupiah = (value) =>
  "Rp" + Math.round(Number(value) || 0).toLocaleString("id-ID");

export const toNumber = (value) => {
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

/*
 * Server biasanya berjalan di UTC. Supaya "hari ini" sama dengan
 * tanggal pengguna di Indonesia, tanggal dihitung memakai zona WIB.
 */
export function todayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function parseJson(value, fallback = []) {
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

export function normalizeDailyPlan(value) {
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
        Number.isFinite(dayValue) && dayValue > 0 ? dayValue : index + 1;

      const taskValue = parseJson(
        item?.tasks ?? item?.checklist ?? item?.activities ?? item?.steps,
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
    if (Array.isArray(parsed.days)) return normalizeDailyPlan(parsed.days);
    if (Array.isArray(parsed.daily_plan))
      return normalizeDailyPlan(parsed.daily_plan);
    if (Array.isArray(parsed.plan)) return normalizeDailyPlan(parsed.plan);

    return Object.entries(parsed).map(([key, item], index) => {
      const dayNumber = Number(String(key).match(/\d+/)?.[0]) || index + 1;

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
            : item?.description || item?.detail || item?.activity || tasks,
      };
    });
  }

  return [];
}

export function hasCompleteSevenDayPlan(plan) {
  const normalized = normalizeDailyPlan(plan);

  if (!Array.isArray(normalized)) return false;

  const availableDays = new Set();

  for (const item of normalized) {
    const day = Number(item?.day);

    if (!Number.isInteger(day) || day < 1 || day > EXPERIMENT_DURATION_DAYS) {
      continue;
    }

    const title = String(item?.title || "").trim();
    const description = String(item?.description || "").trim();

    const hasMeaningfulActivity =
      Boolean(description) || (Boolean(title) && title !== `Hari ${day}`);

    if (hasMeaningfulActivity) availableDays.add(day);
  }

  for (let day = 1; day <= EXPERIMENT_DURATION_DAYS; day++) {
    if (!availableDays.has(day)) return false;
  }

  return true;
}

export function parseWeeklyHours(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  const numbers = String(value).match(/\d+(?:[.,]\d+)?/g);

  if (!numbers || numbers.length === 0) return null;

  const lowestValue = Number(numbers[0].replace(",", "."));

  return Number.isFinite(lowestValue) && lowestValue > 0 ? lowestValue : null;
}

export function buildDailyPlanWithCapacity(rawPlan, weeklyHours) {
  const plan = normalizeDailyPlan(rawPlan);

  if (!plan.length) return [];

  if (!weeklyHours || weeklyHours <= 0) return plan;

  const weeklyMinutes = Math.floor(weeklyHours * 60);
  const dailyMinutes = Math.floor(weeklyMinutes / 7);

  return plan.map((item) => ({
    ...item,
    weekly_capacity_hours: weeklyHours,
    weekly_capacity_minutes: weeklyMinutes,
    time_budget_minutes: dailyMinutes,
  }));
}

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

  if (text.includes("whatsapp") || text.includes("wa ")) channels.push("WhatsApp");
  if (text.includes("instagram")) channels.push("Instagram");
  if (text.includes("facebook")) channels.push("Facebook");
  if (text.includes("tiktok")) channels.push("TikTok");
  if (text.includes("marketplace")) channels.push("Marketplace");

  return [...new Set(channels)];
}

export function getProposalChannels(proposal) {
  const parsedChannels = parseJson(proposal.channels, null);

  return Array.isArray(parsedChannels)
    ? parsedChannels.filter(Boolean)
    : detectChannels(proposal);
}

export function calculateFinance(data) {
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
    data.willingness_to_lose !== null && data.willingness_to_lose !== undefined
      ? toNumber(data.willingness_to_lose)
      : null;

  const affordableLoss =
    data.affordable_loss !== null && data.affordable_loss !== undefined
      ? toNumber(data.affordable_loss)
      : null;

  const rawRecommendedBudget = data.recommended_budget ?? data.recommended_budge;

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
      Math.min(recommendedBudget, freeSurplus, willingness, affordableLoss)
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