import { BAHT_TO_GRAM_BAR } from "@/lib/gold-weight";

// Estimated prices for gold of other purities, derived from the official
// 96.5% price. GTA's bar-gold announcement (the only price this site stores)
// is for 96.5% gold; every other row is an ESTIMATE of the gold content's
// value, pro rata: price(X%) = price(96.5%) x X / 96.5. It is not a quote -
// real buy-back prices for low-purity gold are typically lower.

/** The purity GTA's announced price is for. */
export const REFERENCE_PURITY = 96.5;

export interface PurityLevel {
  percent: number;
  /** Shown under the percentage where there is a well-known equivalent. */
  note?: string;
}

export const PURITY_LEVELS: PurityLevel[] = [
  { percent: 99.99, note: "ทองคำบริสุทธิ์ 24K" },
  { percent: 96.5, note: "มาตรฐานทองไทย" },
  { percent: 90 },
  { percent: 80 },
  { percent: 75, note: "ทอง 18K" },
  { percent: 50, note: "ทอง 12K" },
  { percent: 40 },
];

/** Value per baht-weight of gold at `percent` purity, given the 96.5% price. */
export function estimatePriceByPurity(price965: number, percent: number): number {
  return (price965 * percent) / REFERENCE_PURITY;
}

/** Per-gram value from a per-baht-weight price (bar gold: 15.244 g per baht). */
export function pricePerGram(pricePerBaht: number): number {
  return pricePerBaht / BAHT_TO_GRAM_BAR;
}
