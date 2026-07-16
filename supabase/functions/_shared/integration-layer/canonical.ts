// Canonical JSON serialization for idempotency fingerprints.
// - Deterministic property ordering (alphabetical, recursive).
// - Arrays preserve order (semantic).
// - Excludes undefined values; null preserved.
// Justification: identical logical payloads (regardless of key ordering)
// must produce identical SHA-256 fingerprints (Phase 1B §8).

export function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonicalStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + canonicalStringify(obj[k])).join(",") + "}";
}
