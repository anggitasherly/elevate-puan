// Kode masalah bersama. Initial Diagnosis tetap memakai implementasi existing.
export const PROBLEM_TYPES = Object.freeze([
 "low_awareness", "low_conversion", "weak_retention", "capacity_limit",
 "narrow_market", "inconsistent_promo", "product_stagnation", "weak_finance_habits"
]);
export const isProblemType = (value) => PROBLEM_TYPES.includes(value);
