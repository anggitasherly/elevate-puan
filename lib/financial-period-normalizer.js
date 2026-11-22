const MAX_DB_INTEGER = 2147483647;

function toMonthlyAmount(value, period) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error("Nominal keuangan tidak valid.");
  }

  const monthly =
    period === "Mingguan"
      ? Math.round((value * 52) / 12)
      : value;

  if (!Number.isSafeInteger(monthly) || monthly > MAX_DB_INTEGER) {
    throw new Error("Nominal bulanan melebihi batas database.");
  }

  return monthly;
}

export function normalizeFinancialPeriod(analysis) {
  if (!["Mingguan", "Bulanan"].includes(analysis?.period)) {
    throw new Error("Periode keuangan tidak valid.");
  }

  const monthlyRevenue = toMonthlyAmount(
    analysis.revenue,
    analysis.period
  );

  const monthlyOperatingCost = toMonthlyAmount(
    analysis.expenses,
    analysis.period
  );

  const monthlyHouseholdNeed = toMonthlyAmount(
    analysis.householdNeed,
    analysis.period
  );

  const businessProfit =
    monthlyRevenue - monthlyOperatingCost;

  const freeSurplus =
    businessProfit - monthlyHouseholdNeed;

  return {
    sourcePeriod: analysis.period,
    monthlyRevenue,
    monthlyOperatingCost,
    monthlyHouseholdNeed,
    productMarginPct: analysis.productMargin,
    businessProfit,
    freeSurplus,
    experimentBudget: analysis.budget,
  };
}
