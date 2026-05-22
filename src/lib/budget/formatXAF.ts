/**
 * formatXAF — canonical XAF currency formatter for the Smart Budgeting feature.
 * Always renders amounts with fr-CM grouping. Compact mode shrinks to k/M suffixes.
 */
export function formatXAF(amount: number, compact = false): string {
  if (!Number.isFinite(amount)) return "0 XAF";
  if (compact && Math.abs(amount) >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1).replace(/\.0$/, "")}M XAF`;
  }
  if (compact && Math.abs(amount) >= 1_000) {
    return `${Math.round(amount / 1_000)}k XAF`;
  }
  const formatted = new Intl.NumberFormat("fr-CM", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
  return `${formatted} XAF`;
}
