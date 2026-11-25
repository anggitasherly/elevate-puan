// Aturan level pertumbuhan pengguna (keputusan tim). Satu-satunya sumber aturan level.
//
// Level 1: belum ada eksperimen selesai       -> risk allowance 15%, playbook gratis
// Level 2: minimal 1 eksperimen selesai        -> risk allowance 20%, playbook sampai Rp300.000
// Level 3: dua eksperimen selesai terakhir
//          untung (net_profit lebih dari 0)
//          dan batas aman (surplus x 25%)
//          di atas Rp300.000                   -> risk allowance 25%, semua playbook
//
// "Eksperimen selesai" = status completed. Eksperimen yang dihentikan atau
// kedaluwarsa tidak dihitung. Hasil tanpa net_profit tetap dihitung selesai,
// tapi tidak dihitung untung.

export const RISK_ALLOWANCE_BY_LEVEL = { 1: 15, 2: 20, 3: 25 };

// Batas bawah Level 3 pada level biaya playbook (di atas Rp300.000).
export const LEVEL_3_MIN_SAFE_LIMIT = 300000;

function safeLimitFor(freeSurplus, riskAllowancePct) {
  const surplus = Number(freeSurplus);
  if (!Number.isFinite(surplus)) return 0;
  return Math.round(Math.max(0, surplus) * (riskAllowancePct / 100));
}

// history: daftar eksperimen selesai, dari yang paling lama ke yang paling baru.
// Tiap item punya net_profit (boleh kosong).
export function determineGrowthLevel({
  marginFilled = true,
  freeSurplus = 0,
  history = [],
}) {
  const completed = Array.isArray(history) ? history : [];

  let growthLevel = 1;

  if (marginFilled && completed.length >= 1) {
    growthLevel = 2;

    const lastTwo = completed.slice(-2);
    const lastTwoProfitable =
      lastTwo.length === 2 &&
      lastTwo.every((item) => Number(item?.net_profit) > 0);

    const safeLimitAtLevel3 = safeLimitFor(
      freeSurplus,
      RISK_ALLOWANCE_BY_LEVEL[3]
    );

    if (lastTwoProfitable && safeLimitAtLevel3 > LEVEL_3_MIN_SAFE_LIMIT) {
      growthLevel = 3;
    }
  }

  const riskAllowancePct = RISK_ALLOWANCE_BY_LEVEL[growthLevel];

  return {
    growthLevel,
    riskAllowancePct,
    safeLimit: safeLimitFor(freeSurplus, riskAllowancePct),
  };
}
