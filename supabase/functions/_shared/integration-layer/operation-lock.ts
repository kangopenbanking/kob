// KOB Integration Layer — Business-Operation Lock (Phase 1B-R1I-b.1X / b.1XV)
//
// Purpose
// -------
// Prevent duplicate provider-side create operations when a caller retries the
// SAME logical business operation under DIFFERENT client-supplied
// Idempotency-Key values. A second, server-derived key is reserved atomically
// against the existing shared `integration_idempotency_keys` table.
//
// Identifier standard (b.1XV correction)
// --------------------------------------
// Phase 1B-R1I-b.1X originally described the derived identifier as
// "a UUID v4 deterministically computed from SHA-256". That description is
// standards-incorrect: RFC 4122 §4.4 defines v4 as *random*. The correct
// standard for a name-based, deterministic UUID is **RFC 4122 §4.3 UUIDv5**
// (SHA-1 over a namespace UUID + name).
//
// This module now implements Model A — UUIDv5 — with:
//   * A fixed, documented KOB namespace UUID (`KOB_OP_LOCK_NAMESPACE`).
//   * A canonical, deterministic name string derived from the TRUSTED
//     server-side scope (see `canonicaliseScope`). Property ordering is
//     alphabetical and value normalisation is applied so equivalent valid
//     inputs collapse to one identifier.
//   * SHA-1 as required by RFC 4122 §4.3 (SHA-1 is used ONLY for name→UUID
//     derivation, never for authentication or integrity — no cryptographic
//     downgrade is implied).
//
// The idempotency validator (`validateIdempotencyKey`) accepts UUID v4 OR v5
// (both are RFC 4122 §4 layouts) so the shared reserve/store contract is
// reused unchanged.
//
// Scope trust classification
// --------------------------
// Only the fields below participate in the operation identity. Client-
// supplied fields such as `Idempotency-Key`, request ID, IP, or body
// `tenant`/`institution`/`merchant` overrides are STRUCTURALLY EXCLUDED.
//
//   provider        CONSTANT_SERVER_NAMESPACE     ("nium")
//   resource        CONSTANT_SERVER_NAMESPACE     ("global_account")
//   environment     AUTHORITATIVE_SERVER_CONTEXT  (KOB_ENV | "unknown")
//   tenant_id       AUTHORITATIVE_SERVER_CONTEXT  (JWT / server context)
//   user_id         AUTHORITATIVE_SERVER_CONTEXT  (JWT `sub`)
//   currency        VALIDATED_CLIENT_DOMAIN_INPUT (uppercased ISO-4217)
//   account_kind    VALIDATED_CLIENT_DOMAIN_INPUT (lower-cased, enum)
//
// Justification
// -------------
//   * Standing Order #4 (Surgeon Rule): additive, no schema change.
//   * Standing Order #3 (Audit Trail): RFC 4122 §4.3 cited.
//   * Project Core Memory: atomic row-level protection for financial mutations.

import { canonicalStringify } from "./canonical.ts";

/** Fixed KOB namespace UUID for operation-lock derivation.
 *  Generated once; MUST NOT change without a Guardian-approved migration
 *  (changing it would produce different operation identities for the same
 *  logical scope, breaking cross-key protection). */
export const KOB_OP_LOCK_NAMESPACE = "6f8c9c11-0e6f-5c4b-9a80-3b6c1d5f2e10";

/** Prefix used on the shared table's `resource` column so operation-lock
 *  rows are namespaced away from per-request client-key rows. */
export const OPERATION_LOCK_PREFIX = "op:";

/** RFC 4122 §4 layout — accepts version 4 (random) and version 5 (SHA-1). */
export const UUID_V4_OR_V5_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[45][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// ---------- normalisation ----------

const ALLOWED_ACCOUNT_KINDS = new Set(["virtual", "global"]);
// ISO-4217 alpha-3 shape. Domain validity is enforced by `assertNiumCurrency`
// in the handler BEFORE the scope is built; this regex is a shape gate only.
const CURRENCY_SHAPE = /^[A-Z]{3}$/;

export interface OperationScope {
  provider: string;
  resource: string;
  environment?: string | null;
  tenant_id?: string | null;
  user_id: string;
  currency: string;
  account_kind: string;
}

/** Normalise validated client-domain inputs so equivalent valid values map
 *  to the same operation identity. Throws on invalid shape — callers MUST
 *  have already applied domain validation. */
export function canonicaliseScope(scope: OperationScope): Required<OperationScope> {
  const provider = String(scope.provider ?? "").trim().toLowerCase();
  const resource = String(scope.resource ?? "").trim().toLowerCase();
  const environment = String(scope.environment ?? "unknown").trim().toLowerCase();
  const tenant_id = scope.tenant_id ? String(scope.tenant_id).trim() : "";
  const user_id = String(scope.user_id ?? "").trim();
  const currency = String(scope.currency ?? "").trim().toUpperCase().normalize("NFKC");
  const account_kind = String(scope.account_kind ?? "").trim().toLowerCase().normalize("NFKC");

  if (!provider) throw new Error("op-lock: provider required");
  if (!resource) throw new Error("op-lock: resource required");
  if (!user_id) throw new Error("op-lock: user_id required");
  if (!CURRENCY_SHAPE.test(currency)) throw new Error("op-lock: invalid currency shape");
  if (!ALLOWED_ACCOUNT_KINDS.has(account_kind)) throw new Error("op-lock: invalid account_kind");

  return { provider, resource, environment, tenant_id, user_id, currency, account_kind };
}

// ---------- UUIDv5 (RFC 4122 §4.3) ----------

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function bytesToUuid(b: Uint8Array): string {
  const h = Array.from(b).map((v) => v.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

/** RFC 4122 §4.3 UUIDv5: SHA-1(namespace_bytes || name_bytes),
 *  then set version=5 and variant=10xx. */
export async function uuidV5(namespace: string, name: string): Promise<string> {
  const ns = hexToBytes(namespace.replace(/-/g, ""));
  const nameBytes = new TextEncoder().encode(name);
  const buf = new Uint8Array(ns.length + nameBytes.length);
  buf.set(ns, 0);
  buf.set(nameBytes, ns.length);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-1", buf));
  const out = digest.slice(0, 16);
  out[6] = (out[6] & 0x0f) | 0x50; // version 5
  out[8] = (out[8] & 0x3f) | 0x80; // variant 10xx
  return bytesToUuid(out);
}

/** Derive the deterministic operation-lock UUIDv5 from a trusted scope.
 *  Same normalised scope → same UUID → single atomic INSERT slot. */
export async function deriveOperationKey(scope: OperationScope): Promise<string> {
  const canon = canonicaliseScope(scope);
  const name = canonicalStringify(canon);
  return await uuidV5(KOB_OP_LOCK_NAMESPACE, name);
}
