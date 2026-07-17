/**
 * Shared pagination foundation (Phase 1B-R1I-d.1F).
 *
 * Framework-neutral helpers implementing the ratified pagination standard:
 *   - HMAC-SHA-256 signed cursor tokens (kobp1.<payload>.<signature>).
 *   - Deterministic canonical hashing for scope + filter binding.
 *   - Typed ordering profiles requiring a unique final tie-breaker.
 *   - Explicit bounded page-limit parsing (no silent clamping).
 *   - Limit-plus-one page finalisation.
 *
 * This module intentionally does NOT ship:
 *   - HTTP response envelopes,
 *   - X-Pagination-* headers,
 *   - global page-size defaults,
 *   - database query builders,
 *   - operation-specific handlers.
 *
 * Those remain per-operation slice decisions (see docs/audits/phase-1/
 * phase-1b-r1i-d0-remediation-plan.md §§d.2–d.9).
 *
 * The cursor secret is read from KOB_CURSOR_HMAC_SECRET (never reuse
 * SUPABASE_JWT_SECRET). Callers may inject a secret directly for tests.
 */

// -------- Constants --------

/** Fixed token prefix — bumped only via a major-version cursor change. */
export const CURSOR_PREFIX = "kobp1";
/** Minimum secret entropy in bytes. */
export const MIN_SECRET_BYTES = 32;
/** Cursor payload version. */
export const CURSOR_VERSION = 1 as const;
/** Absolute safety ceiling for any per-operation max limit. */
export const ABSOLUTE_MAX_LIMIT = 500;
/** Minimum cursor lifetime (seconds). */
export const MIN_CURSOR_LIFETIME_SECONDS = 60;
/** Maximum cursor lifetime (seconds). */
export const MAX_CURSOR_LIFETIME_SECONDS = 86_400;

const HEX_HASH_RE = /^[0-9a-f]{64}$/;

// -------- Types --------

export type PaginationScalar = string | number | boolean | null;

export interface PaginationCursorPayload {
  v: 1;
  op: string;
  sh: string;
  fh: string;
  ord: string;
  pos: PaginationScalar[];
  iat: number;
  exp: number;
}

export interface PaginationOrderField {
  key: string;
  direction: "asc" | "desc";
  nullable: boolean;
  nulls?: "first" | "last";
  unique: boolean;
}

export interface PaginationOrderProfile {
  id: string;
  fields: PaginationOrderField[];
}

export type CursorFailureCode =
  | "MALFORMED"
  | "UNSUPPORTED_VERSION"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "OPERATION_MISMATCH"
  | "SCOPE_MISMATCH"
  | "FILTER_MISMATCH"
  | "ORDER_MISMATCH"
  | "POSITION_INVALID"
  | "CONFIGURATION_ERROR";

export interface DecodedCursorSuccess {
  ok: true;
  payload: PaginationCursorPayload;
}

export interface DecodedCursorFailure {
  ok: false;
  code: CursorFailureCode;
  detail: string;
}

export type DecodedCursorResult = DecodedCursorSuccess | DecodedCursorFailure;

export interface CursorEncodeContext {
  operation: string;
  scopeHash: string;
  filterHash: string;
  orderProfileId: string;
  position: PaginationScalar[];
  issuedAt: number;
  expiresAt: number;
}

export interface CursorExpectedContext {
  operation: string;
  scopeHash: string;
  filterHash: string;
  orderProfile: PaginationOrderProfile;
}

export interface CursorSecretOptions {
  /** Raw secret bytes. If omitted, read from env KOB_CURSOR_HMAC_SECRET. */
  secret?: string;
}

export interface ParsePaginationLimitOptions {
  defaultLimit: number;
  maxLimit: number;
}

export interface PaginationPage<T> {
  items: T[];
  hasMore: boolean;
  nextCursor?: string;
}

// -------- Base64URL --------

function base64UrlEncode(bytes: Uint8Array): string {
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  const b64 = typeof btoa === "function"
    ? btoa(str)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    : (globalThis as unknown as { Buffer: { from: (s: string, enc: string) => { toString: (e: string) => string } } })
        .Buffer.from(str, "binary").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(input: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]*$/.test(input)) return null;
  const padLen = (4 - (input.length % 4)) % 4;
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  try {
    const bin = typeof atob === "function"
      ? atob(b64)
      : (globalThis as unknown as { Buffer: { from: (s: string, enc: string) => { toString: (e: string) => string } } })
          .Buffer.from(b64, "base64").toString("binary");
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

// -------- Secret loading --------

function readSecret(options: CursorSecretOptions | undefined): string {
  const provided = options?.secret;
  if (typeof provided === "string" && provided.length > 0) {
    if (provided.length < MIN_SECRET_BYTES) {
      throw new PaginationConfigurationError("cursor secret shorter than minimum entropy");
    }
    return provided;
  }
  // Env lookup: prefer Deno.env (Edge), fall back to process.env (Node/tests).
  let envVal: string | undefined;
  const g = globalThis as unknown as {
    Deno?: { env?: { get: (k: string) => string | undefined } };
    process?: { env?: Record<string, string | undefined> };
  };
  if (g.Deno?.env?.get) envVal = g.Deno.env.get("KOB_CURSOR_HMAC_SECRET");
  if (!envVal && g.process?.env) envVal = g.process.env.KOB_CURSOR_HMAC_SECRET;
  if (!envVal || envVal.length === 0) {
    throw new PaginationConfigurationError("KOB_CURSOR_HMAC_SECRET is not configured");
  }
  if (envVal.length < MIN_SECRET_BYTES) {
    throw new PaginationConfigurationError("KOB_CURSOR_HMAC_SECRET shorter than minimum entropy");
  }
  return envVal;
}

// -------- Errors --------

export class PaginationConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationConfigurationError";
  }
}

export class PaginationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaginationValidationError";
  }
}

// -------- Canonical JSON + hashing --------

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype;
}

function canonicalize(value: unknown): unknown {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new PaginationValidationError("non-finite number rejected");
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => canonicalize(v));
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    const keys = Object.keys(value).sort();
    for (const k of keys) out[k] = canonicalize(value[k]);
    return out;
  }
  throw new PaginationValidationError(`unsupported value type: ${typeof value}`);
}

export function canonicalStringify(value: unknown): string {
  return JSON.stringify(canonicalize(value));
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const subtle = getSubtle();
  const digest = await subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  const view = new Uint8Array(digest);
  let hex = "";
  for (let i = 0; i < view.length; i++) hex += view[i].toString(16).padStart(2, "0");
  return hex;
}

function getSubtle(): SubtleCrypto {
  const c = (globalThis as unknown as { crypto?: Crypto }).crypto;
  if (!c || !c.subtle) {
    throw new PaginationConfigurationError("Web Crypto API is not available");
  }
  return c.subtle;
}

const REDACTED_KEYS = new Set([
  "password", "pwd", "secret", "token", "api_key", "apiKey",
  "authorization", "auth", "access_token", "refresh_token",
  "jwt", "private_key", "privateKey",
]);

function assertNoSecretKeys(value: unknown, path = ""): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => assertNoSecretKeys(v, `${path}[${i}]`));
    return;
  }
  if (isPlainObject(value)) {
    for (const k of Object.keys(value)) {
      if (REDACTED_KEYS.has(k.toLowerCase())) {
        throw new PaginationValidationError(`prohibited hash input key: ${path}${k}`);
      }
      assertNoSecretKeys(value[k], `${path}${k}.`);
    }
  }
}

export async function hashScope(scope: Record<string, unknown>): Promise<string> {
  if (!isPlainObject(scope)) {
    throw new PaginationValidationError("scope must be a plain object");
  }
  assertNoSecretKeys(scope);
  const canon = canonicalStringify(scope);
  return sha256Hex(new TextEncoder().encode(`kobp1.scope:${canon}`));
}

export async function hashFilters(filters: Record<string, unknown>): Promise<string> {
  if (!isPlainObject(filters)) {
    throw new PaginationValidationError("filters must be a plain object");
  }
  assertNoSecretKeys(filters);
  const canon = canonicalStringify(filters);
  return sha256Hex(new TextEncoder().encode(`kobp1.filters:${canon}`));
}

// -------- HMAC --------

async function importHmacKey(secret: string): Promise<CryptoKey> {
  const subtle = getSubtle();
  return subtle.importKey(
    "raw",
    new TextEncoder().encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function hmacSign(secret: string, message: Uint8Array): Promise<Uint8Array> {
  const key = await importHmacKey(secret);
  const sig = await getSubtle().sign("HMAC", key, message as unknown as ArrayBuffer);
  return new Uint8Array(sig);
}

async function hmacVerify(secret: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
  const key = await importHmacKey(secret);
  return getSubtle().verify(
    "HMAC",
    key,
    signature as unknown as ArrayBuffer,
    message as unknown as ArrayBuffer,
  );
}

// -------- Ordering profile validation --------

export function validateOrderProfile(profile: PaginationOrderProfile): void {
  if (!profile || typeof profile.id !== "string" || profile.id.length === 0) {
    throw new PaginationValidationError("ordering profile requires non-empty id");
  }
  if (!Array.isArray(profile.fields) || profile.fields.length === 0) {
    throw new PaginationValidationError("ordering profile requires at least one field");
  }
  const seen = new Set<string>();
  for (const f of profile.fields) {
    if (typeof f.key !== "string" || f.key.length === 0) {
      throw new PaginationValidationError("ordering field key must be non-empty string");
    }
    if (seen.has(f.key)) {
      throw new PaginationValidationError(`duplicate ordering field: ${f.key}`);
    }
    seen.add(f.key);
    if (f.direction !== "asc" && f.direction !== "desc") {
      throw new PaginationValidationError(`invalid direction on field ${f.key}`);
    }
    if (typeof f.nullable !== "boolean") {
      throw new PaginationValidationError(`nullable flag missing on field ${f.key}`);
    }
    if (f.nullable && f.nulls !== "first" && f.nulls !== "last") {
      throw new PaginationValidationError(`nullable field ${f.key} must declare nulls ordering`);
    }
    if (!f.nullable && f.nulls !== undefined) {
      throw new PaginationValidationError(`non-nullable field ${f.key} must not declare nulls ordering`);
    }
    if (typeof f.unique !== "boolean") {
      throw new PaginationValidationError(`unique flag missing on field ${f.key}`);
    }
  }
  const last = profile.fields[profile.fields.length - 1];
  if (!last.unique) {
    throw new PaginationValidationError(
      "ordering profile must terminate with a unique tie-breaker field",
    );
  }
}

function validatePositionShape(
  position: PaginationScalar[],
  profile: PaginationOrderProfile,
): void {
  if (!Array.isArray(position) || position.length === 0) {
    throw new PaginationValidationError("position tuple must be non-empty");
  }
  if (position.length !== profile.fields.length) {
    throw new PaginationValidationError(
      `position arity mismatch: expected ${profile.fields.length}, got ${position.length}`,
    );
  }
  position.forEach((v, i) => {
    if (v === null) {
      if (!profile.fields[i].nullable) {
        throw new PaginationValidationError(`position[${i}] null but field not nullable`);
      }
      return;
    }
    const t = typeof v;
    if (t !== "string" && t !== "number" && t !== "boolean") {
      throw new PaginationValidationError(`position[${i}] unsupported scalar type: ${t}`);
    }
    if (t === "number" && !Number.isFinite(v as number)) {
      throw new PaginationValidationError(`position[${i}] non-finite number`);
    }
  });
}

// -------- Encode / decode --------

function assertHexHash(value: string, label: string): void {
  if (typeof value !== "string" || !HEX_HASH_RE.test(value)) {
    throw new PaginationValidationError(`${label} must be a 64-char hex SHA-256`);
  }
}

export async function encodeCursor(
  ctx: CursorEncodeContext,
  options?: CursorSecretOptions,
): Promise<string> {
  if (typeof ctx.operation !== "string" || ctx.operation.length === 0) {
    throw new PaginationValidationError("operation is required");
  }
  assertHexHash(ctx.scopeHash, "scopeHash");
  assertHexHash(ctx.filterHash, "filterHash");
  if (typeof ctx.orderProfileId !== "string" || ctx.orderProfileId.length === 0) {
    throw new PaginationValidationError("orderProfileId is required");
  }
  if (!Array.isArray(ctx.position) || ctx.position.length === 0) {
    throw new PaginationValidationError("position tuple must be non-empty");
  }
  ctx.position.forEach((v, i) => {
    if (v === null) return;
    const t = typeof v;
    if (t !== "string" && t !== "number" && t !== "boolean") {
      throw new PaginationValidationError(`position[${i}] unsupported scalar type`);
    }
    if (t === "number" && !Number.isFinite(v as number)) {
      throw new PaginationValidationError(`position[${i}] non-finite number`);
    }
  });
  if (!Number.isInteger(ctx.issuedAt) || ctx.issuedAt <= 0) {
    throw new PaginationValidationError("issuedAt must be positive integer seconds");
  }
  if (!Number.isInteger(ctx.expiresAt) || ctx.expiresAt <= ctx.issuedAt) {
    throw new PaginationValidationError("expiresAt must be integer > issuedAt");
  }
  const lifetime = ctx.expiresAt - ctx.issuedAt;
  if (lifetime < MIN_CURSOR_LIFETIME_SECONDS || lifetime > MAX_CURSOR_LIFETIME_SECONDS) {
    throw new PaginationValidationError(
      `cursor lifetime must be between ${MIN_CURSOR_LIFETIME_SECONDS} and ${MAX_CURSOR_LIFETIME_SECONDS} seconds`,
    );
  }
  const secret = readSecret(options);
  const payload: PaginationCursorPayload = {
    v: CURSOR_VERSION,
    op: ctx.operation,
    sh: ctx.scopeHash,
    fh: ctx.filterHash,
    ord: ctx.orderProfileId,
    pos: [...ctx.position],
    iat: ctx.issuedAt,
    exp: ctx.expiresAt,
  };
  const canonical = canonicalStringify(payload);
  const payloadBytes = new TextEncoder().encode(canonical);
  const payloadSegment = base64UrlEncode(payloadBytes);
  const signingInput = new TextEncoder().encode(`${CURSOR_PREFIX}.${payloadSegment}`);
  const sig = await hmacSign(secret, signingInput);
  return `${CURSOR_PREFIX}.${payloadSegment}.${base64UrlEncode(sig)}`;
}

function fail(code: CursorFailureCode, detail: string): DecodedCursorFailure {
  return { ok: false, code, detail };
}

export async function decodeCursor(
  token: string,
  expected: CursorExpectedContext,
  options?: CursorSecretOptions,
): Promise<DecodedCursorResult> {
  validateOrderProfile(expected.orderProfile);
  if (typeof expected.operation !== "string" || expected.operation.length === 0) {
    return fail("CONFIGURATION_ERROR", "expected.operation missing");
  }
  assertHexHash(expected.scopeHash, "expected.scopeHash");
  assertHexHash(expected.filterHash, "expected.filterHash");

  let secret: string;
  try {
    secret = readSecret(options);
  } catch (e) {
    return fail("CONFIGURATION_ERROR", (e as Error).message);
  }

  if (typeof token !== "string" || token.length === 0) {
    return fail("MALFORMED", "empty token");
  }
  const parts = token.split(".");
  if (parts.length !== 3) return fail("MALFORMED", "token must have 3 segments");
  const [prefix, payloadSegment, sigSegment] = parts;
  if (prefix !== CURSOR_PREFIX) {
    return fail("UNSUPPORTED_VERSION", "unknown cursor prefix");
  }
  const payloadBytes = base64UrlDecode(payloadSegment);
  const sigBytes = base64UrlDecode(sigSegment);
  if (!payloadBytes || !sigBytes) return fail("MALFORMED", "invalid base64url encoding");

  const signingInput = new TextEncoder().encode(`${CURSOR_PREFIX}.${payloadSegment}`);
  let verified = false;
  try {
    verified = await hmacVerify(secret, signingInput, sigBytes);
  } catch {
    return fail("INVALID_SIGNATURE", "signature verification error");
  }
  if (!verified) return fail("INVALID_SIGNATURE", "signature mismatch");

  let payload: PaginationCursorPayload;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as unknown;
    if (!isPlainObject(parsed)) return fail("MALFORMED", "payload not an object");
    const p = parsed as Record<string, unknown>;
    if (p.v !== CURSOR_VERSION) return fail("UNSUPPORTED_VERSION", `version ${String(p.v)}`);
    if (typeof p.op !== "string" || typeof p.sh !== "string" ||
        typeof p.fh !== "string" || typeof p.ord !== "string" ||
        !Array.isArray(p.pos) ||
        typeof p.iat !== "number" || typeof p.exp !== "number") {
      return fail("MALFORMED", "payload shape invalid");
    }
    payload = {
      v: CURSOR_VERSION,
      op: p.op,
      sh: p.sh,
      fh: p.fh,
      ord: p.ord,
      pos: p.pos as PaginationScalar[],
      iat: p.iat,
      exp: p.exp,
    };
  } catch {
    return fail("MALFORMED", "payload JSON parse failed");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now) return fail("EXPIRED", "cursor expired");
  if (payload.op !== expected.operation) return fail("OPERATION_MISMATCH", "operation mismatch");
  if (payload.sh !== expected.scopeHash) return fail("SCOPE_MISMATCH", "scope mismatch");
  if (payload.fh !== expected.filterHash) return fail("FILTER_MISMATCH", "filter mismatch");
  if (payload.ord !== expected.orderProfile.id) return fail("ORDER_MISMATCH", "ordering profile mismatch");

  try {
    validatePositionShape(payload.pos, expected.orderProfile);
  } catch (e) {
    return fail("POSITION_INVALID", (e as Error).message);
  }

  return { ok: true, payload };
}

// -------- Limit parsing --------

export function parsePaginationLimit(
  rawValue: unknown,
  options: ParsePaginationLimitOptions,
): number {
  const { defaultLimit, maxLimit } = options;
  if (!Number.isInteger(defaultLimit) || !Number.isInteger(maxLimit)) {
    throw new PaginationConfigurationError("defaultLimit and maxLimit must be integers");
  }
  if (defaultLimit < 1 || maxLimit < 1 || defaultLimit > maxLimit || maxLimit > ABSOLUTE_MAX_LIMIT) {
    throw new PaginationConfigurationError(
      `invalid limit configuration: 1 ≤ default(${defaultLimit}) ≤ max(${maxLimit}) ≤ ${ABSOLUTE_MAX_LIMIT}`,
    );
  }
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return defaultLimit;
  }
  let num: number;
  if (typeof rawValue === "number") {
    num = rawValue;
  } else if (typeof rawValue === "string") {
    if (!/^-?\d+$/.test(rawValue.trim())) {
      throw new PaginationValidationError("limit must be an integer");
    }
    num = Number(rawValue.trim());
  } else {
    throw new PaginationValidationError("limit must be integer or numeric string");
  }
  if (!Number.isSafeInteger(num)) {
    throw new PaginationValidationError("limit must be a safe integer");
  }
  if (num < 1) throw new PaginationValidationError("limit must be ≥ 1");
  if (num > maxLimit) {
    throw new PaginationValidationError(`limit exceeds maximum ${maxLimit}`);
  }
  return num;
}

// -------- Page finalisation --------

export interface FinalizePageInput<T> {
  fetchedItems: readonly T[];
  requestedLimit: number;
  encodeContext: Omit<CursorEncodeContext, "position">;
  positionExtractor: (item: T) => PaginationScalar[];
  secretOptions?: CursorSecretOptions;
}

export async function finalizePage<T>(input: FinalizePageInput<T>): Promise<PaginationPage<T>> {
  const { fetchedItems, requestedLimit, encodeContext, positionExtractor } = input;
  if (!Array.isArray(fetchedItems)) {
    throw new PaginationValidationError("fetchedItems must be an array");
  }
  if (!Number.isInteger(requestedLimit) || requestedLimit < 1) {
    throw new PaginationValidationError("requestedLimit must be positive integer");
  }
  const hasMore = fetchedItems.length > requestedLimit;
  const items = hasMore
    ? fetchedItems.slice(0, requestedLimit)
    : fetchedItems.slice(0);
  if (!hasMore || items.length === 0) {
    return { items, hasMore: false };
  }
  const last = items[items.length - 1];
  const position = positionExtractor(last);
  const nextCursor = await encodeCursor(
    { ...encodeContext, position },
    input.secretOptions,
  );
  return { items, hasMore: true, nextCursor };
}
