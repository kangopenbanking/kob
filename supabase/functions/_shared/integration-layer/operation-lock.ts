// KOB Integration Layer — Business-Operation Lock (Phase 1B-R1I-b.1X)
//
// Purpose: prevent duplicate provider-side create operations when a caller
// retries the SAME logical business operation under DIFFERENT Idempotency-Key
// values (e.g. two client-generated keys for the same user+currency).
//
// Design:
//   - No new persistence — reuses the existing `integration_idempotency_keys`
//     table via the shared reserve/store helpers. This is NOT a new
//     idempotency framework; it is a second, server-derived key that shares
//     the same atomic INSERT semantics.
//   - Operation key is a UUID v4 deterministically derived from a TRUSTED
//     server-side scope (never client input): user_id, provider, resource,
//     currency, account kind. Same scope → same UUID → single atomic slot.
//   - Resource string is prefixed `op:` to keep the operation lock out of
//     the per-request client-key space.
//
// Justification:
//   - Standing Order #4 (Surgeon Rule): additive, no framework change.
//   - Project Core Memory: atomic row-level protection for financial mutations.

import { sha256 } from "./idempotency.ts";
import { canonicalStringify } from "./canonical.ts";

/**
 * Derive a deterministic UUID v4 (RFC 4122 §4.4 layout) from a trusted scope.
 * Same scope → same UUID → atomic INSERT collision in the shared table.
 * Bits 48-51 forced to 0100 (version 4) and bits 64-65 forced to 10 (variant).
 */
export async function deriveOperationKey(scope: Record<string, unknown>): Promise<string> {
  const canonical = canonicalStringify(scope);
  const hex = await sha256(canonical); // 64 hex chars
  // Take first 32 hex chars, coerce to UUID v4 layout.
  const bytes = hex.slice(0, 32).split("");
  bytes[12] = "4"; // version
  const variantChar = bytes[16];
  const variantByte = (parseInt(variantChar, 16) & 0x3) | 0x8; // 10xx binary
  bytes[16] = variantByte.toString(16);
  const s = bytes.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}

/** Operation-lock resource identifier prefix — namespaces the shared table. */
export const OPERATION_LOCK_PREFIX = "op:";
