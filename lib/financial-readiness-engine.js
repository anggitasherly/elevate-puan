
const MONEY_FIELDS = [
  "revenue",
  "expenses",
  "householdNeed",
  "budget",
];

const MIN_AMOUNT = 10000;

function parseAmount(value) {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    throw new Error("Format nominal tidak valid.");
  }

  const raw = String(value);

  if (!/^\d+$/.test(raw)) {
    throw new Error(
      "Nominal harus berupa angka bulat tidak negatif."
    );
  }

  const amount = Number(raw);

  if (!Number.isSafeInteger(amount)) {
    throw new Error("Nominal terlalu besar.");
  }

  return amount;
}

export function calculateFinancialReadiness(input) {
  if (
    !input ||
    typeof input !== "object" ||
    Array.isArray(input)
  ) {
    throw new Error("Data keuangan tidak valid.");
  }

  if (!["Bulanan", "Mingguan"].includes(input.period)) {
    throw new Error("Periode keuangan tidak valid.");
  }

  const amounts = {};

  for (const field of MONEY_FIELDS) {
    if (
      input[field] === "" ||
      input[field] === null ||
      input[field] === undefined
    ) {
      throw new Error("Lengkapi seluruh data keuangan.");
    }

    amounts[field] = parseAmount(input[field]);
  }

  if (amounts.revenue === 0) {
    throw new Error("Pendapatan harus lebih dari Rp0.");
  }

  const margin = Number(input.productMargin);

  if (
    input.productMargin === "" ||
    input.productMargin === null ||
    input.productMargin === undefined ||
    typeof input.productMargin === "boolean" ||
    !Number.isFinite(margin) ||
    margin < 0 ||
    margin > 100
  ) {
    throw new Error(
      "Margin keuntungan harus antara 0% dan 100%."
    );
  }

  const confirmations = input.confirmedLow ?? {};

  if (
    typeof confirmations !== "object" ||
    confirmations === null ||
    Array.isArray(confirmations)
  ) {
    throw new Error("Konfirmasi nominal tidak valid.");
  }

  for (const field of MONEY_FIELDS) {
    const amount = amounts[field];

    if (amount > 0 && amount < MIN_AMOUNT) {
      if (confirmations[field] !== String(amount)) {
        throw new Error(
          `Konfirmasi nominal ${field} terlebih dahulu.`
        );
      }
    }
  }

  const profit =
    amounts.revenue - amounts.expenses;

  const surplus =
    profit - amounts.householdNeed;

  const remaining =
    surplus - amounts.budget;

  const ratio =
    surplus > 0
      ? (amounts.budget / surplus) * 100
      : null;

  if (
    ![profit, surplus, remaining].every(
      Number.isSafeInteger
    ) ||
    (ratio !== null && !Number.isFinite(ratio))
  ) {
    throw new Error("Hasil perhitungan di luar batas.");
  }

  return {
    period: input.period,
    revenue: amounts.revenue,
    expenses: amounts.expenses,
    householdNeed: amounts.householdNeed,
    budget: amounts.budget,
    productMargin: margin,
    profit,
    surplus,
    remaining,
    ratio,
    statusCode: "pending_financial_gate",
    status: "Perlu evaluasi lanjutan",
    note:
      "Ini adalah perhitungan dasar. Saldo kas, kewajiban lain, dan aturan Financial Gate resmi belum dievaluasi.",
  };
}
