
export const initialFinancialData = {
  period: "Bulanan",
  revenue: "",
  expenses: "",
  householdNeed: "",
  willingnessToLose: "",
  productMargin: "",
  cash: "",
  budget: "",
};

export function formatRupiah(value) {
  const number = Number(value) || 0;
  const sign = number < 0 ? "-" : "";

  return (
    sign +
    "Rp" +
    Math.round(Math.abs(number)).toLocaleString("id-ID")
  );
}

export function parseMoney(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits ? Number(digits) : 0;
}
