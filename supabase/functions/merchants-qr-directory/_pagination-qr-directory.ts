/**
 * Phase 1B — R1I-d.2B-I1c-X2-A — Isolated pagination adapter for
 * `merchantsQrDirectoryList` (GET /v1/merchants/qr-directory).
 *
 * Foundation-only module. Composes the accepted shared primitives from
 * `../_shared/pagination.ts`. It is deliberately isolated from the
 * gateway-query d.2A / d.2B adapters — no imports from those siblings.
 *
 * Scope of this file (X2-A):
 *   - Pure request parsing, scope + filter hashing, cursor decode /
 *     encode, page finalisation and header-value construction.
 *   - No database, Supabase client, HTTP `Request` / `Response`, logging,
 *     bearer or credential handling, or environment configuration reads.
 *
 * Runtime integration (`merchants-qr-directory/index.ts`), OpenAPI, SDKs
 * and any downstream consumers remain unchanged during X2-A. They are
 * migrated in X2-B / X2-C respectively.
 *
 * Ratified constants (Compatibility Decision X2-D0):
 *   Operation ID           merchantsQrDirectoryList
 *   Default limit          25
 *   Maximum limit          100
 *   Cursor lifetime        1800 s
 *   Ordering               merchant_id ASC   (unique final tie-breaker)
 *   Order profile ID       qr-directory.merchant-id-asc.v1
 *   Scope tuple            (environment, visibility="public")
 *   Filter tuple           (country, category)
 *   Exact total            PROHIBITED
 *   Response body          { data, pagination, meta: {} }
 *
 * The four ratified response header names are:
 *   X-Pagination-Mode
 *   X-Pagination-Has-More
 *   X-Pagination-Next-Cursor
 *   X-Pagination-Limit
 */

import {
  decodeCursor,
  encodeCursor,
  finalizePage,
  hashFilters,
  hashScope,
  parsePaginationLimit,
  PaginationConfigurationError,
  PaginationValidationError,
  type CursorFailureCode,
  type CursorSecretOptions,
  type DecodedCursorResult,
  type PaginationOrderProfile,
  type PaginationScalar,
} from "../_shared/pagination.ts";

// -------- Ratified constants --------

export const QR_DIRECTORY_OPERATION_ID = "merchantsQrDirectoryList" as const;
export type QrDirectoryOperationId = typeof QR_DIRECTORY_OPERATION_ID;

export const QR_DIRECTORY_DEFAULT_LIMIT = 25;
export const QR_DIRECTORY_MAX_LIMIT = 100;
export const QR_DIRECTORY_CURSOR_LIFETIME_SECONDS = 1800;

export const QR_DIRECTORY_ORDER_PROFILE: PaginationOrderProfile = {
  id: "qr-directory.merchant-id-asc.v1",
  fields: [
    { key: "merchant_id", direction: "asc", nullable: false, unique: true },
  ],
};

/**
 * Ratified response header names in the canonical order used by the
 * `Access-Control-Expose-Headers` constant below.
 */
export const QR_DIRECTORY_PAGINATION_HEADER_NAMES = [
  "X-Pagination-Mode",
  "X-Pagination-Has-More",
  "X-Pagination-Next-Cursor",
  "X-Pagination-Limit",
] as const;

/**
 * `Access-Control-Expose-Headers` value the runtime must emit alongside
 * the four `X-Pagination-*` headers. Exposed as a constant so the runtime
 * cannot silently drift from the adapter contract.
 */
export const QR_DIRECTORY_ACCESS_CONTROL_EXPOSE_HEADERS =
  QR_DIRECTORY_PAGINATION_HEADER_NAMES.join(", ");

// -------- Environment normalisation --------

export type QrDirectoryEnvironment = "sandbox" | "production";
const SUPPORTED_ENVIRONMENTS: readonly QrDirectoryEnvironment[] = ["sandbox", "production"];

/**
 * Normalise the deployment-environment configuration. Any value outside
 * the ratified allowlist is a **server** configuration failure — never a
 * client 400.
 */
export function normalizeQrDirectoryEnvironment(raw: unknown): QrDirectoryEnvironment {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new PaginationConfigurationError(
      "deployment environment is not configured",
    );
  }
  const trimmed = raw.trim().toLowerCase();
  if (trimmed === "sandbox" || trimmed === "production") return trimmed;
  throw new PaginationConfigurationError(
    `unsupported deployment environment: ${trimmed}`,
  );
}

// -------- Problem Details mapping --------

export type QrDirectoryProblemCode =
  | "PAGINATION_LIMIT_INVALID"
  | "PAGINATION_FILTER_INVALID"
  | "PAGINATION_CURSOR_INVALID"
  | "PAGINATION_CURSOR_EXPIRED"
  | "PAGINATION_CURSOR_OPERATION_MISMATCH"
  | "PAGINATION_CURSOR_SCOPE_MISMATCH"
  | "PAGINATION_CURSOR_FILTER_MISMATCH";

export interface QrDirectoryProblemDetails {
  status: 400;
  type: string;
  title: string;
  detail: string;
  code: QrDirectoryProblemCode;
}

const PROBLEM_TYPE_BASE = "https://kob.dev/problems/";

function problem(
  code: QrDirectoryProblemCode,
  detail: string,
): QrDirectoryProblemDetails {
  const slug = code.toLowerCase().replace(/_/g, "-");
  const title =
    code === "PAGINATION_LIMIT_INVALID" ? "Invalid pagination limit" :
    code === "PAGINATION_FILTER_INVALID" ? "Invalid filter parameter" :
    code === "PAGINATION_CURSOR_EXPIRED" ? "Pagination cursor expired" :
    code === "PAGINATION_CURSOR_OPERATION_MISMATCH" ? "Pagination cursor operation mismatch" :
    code === "PAGINATION_CURSOR_SCOPE_MISMATCH" ? "Pagination cursor scope mismatch" :
    code === "PAGINATION_CURSOR_FILTER_MISMATCH" ? "Pagination cursor filter mismatch" :
    "Invalid pagination cursor";
  return {
    status: 400,
    type: `${PROBLEM_TYPE_BASE}${slug}`,
    title,
    detail,
    code,
  };
}

// -------- Filter normalisation --------

export interface QrDirectoryRawFilters {
  country?: string | null;
  category?: string | null;
}

export interface QrDirectoryFilters {
  country: string | null;
  category: string | null;
}

const COUNTRY_RE = /^[A-Z]{2}$/;
const CATEGORY_RE = /^[0-9]{3,5}$/;

export function normalizeQrDirectoryFilters(
  raw: QrDirectoryRawFilters,
): { ok: true; value: QrDirectoryFilters } | { ok: false; error: QrDirectoryProblemDetails } {
  let country: string | null = null;
  if (raw.country !== undefined && raw.country !== null && raw.country !== "") {
    const c = String(raw.country).trim().toUpperCase();
    if (c === "") {
      country = null;
    } else if (!COUNTRY_RE.test(c)) {
      return {
        ok: false,
        error: problem(
          "PAGINATION_FILTER_INVALID",
          "country must be an ISO 3166-1 alpha-2 code",
        ),
      };
    } else {
      country = c;
    }
  }

  let category: string | null = null;
  if (raw.category !== undefined && raw.category !== null && raw.category !== "") {
    const c = String(raw.category).trim();
    if (c === "") {
      category = null;
    } else if (!CATEGORY_RE.test(c)) {
      return {
        ok: false,
        error: problem(
          "PAGINATION_FILTER_INVALID",
          "category must be a 3–5 digit numeric MCC",
        ),
      };
    } else {
      category = c;
    }
  }

  return { ok: true, value: { country, category } };
}

// -------- Limit parsing --------

export function parseQrDirectoryLimit(
  raw: unknown,
): { ok: true; value: number } | { ok: false; error: QrDirectoryProblemDetails } {
  try {
    const v = parsePaginationLimit(raw, {
      defaultLimit: QR_DIRECTORY_DEFAULT_LIMIT,
      maxLimit: QR_DIRECTORY_MAX_LIMIT,
    });
    return { ok: true, value: v };
  } catch (e) {
    if (e instanceof PaginationValidationError) {
      return {
        ok: false,
        error: problem("PAGINATION_LIMIT_INVALID", e.message),
      };
    }
    // Configuration errors bubble up — never converted to client 400.
    throw e;
  }
}

// -------- Scope + filter hashing --------

export async function computeQrDirectoryScopeHash(
  environment: QrDirectoryEnvironment,
): Promise<string> {
  if (!SUPPORTED_ENVIRONMENTS.includes(environment)) {
    throw new PaginationConfigurationError(
      `unsupported deployment environment: ${String(environment)}`,
    );
  }
  return hashScope({
    environment,
    visibility: "public",
  });
}

export async function computeQrDirectoryFilterHash(
  filters: QrDirectoryFilters,
): Promise<string> {
  return hashFilters({
    country: filters.country,
    category: filters.category,
  });
}

// -------- Cursor encode / decode --------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidMerchantIdPosition(pos: PaginationScalar[]): boolean {
  return pos.length === 1 &&
    typeof pos[0] === "string" &&
    pos[0].length > 0 &&
    UUID_RE.test(pos[0]);
}

export interface QrDirectoryEncodeInputs {
  environment: QrDirectoryEnvironment;
  filters: QrDirectoryFilters;
  merchantId: string;
  secretOptions?: CursorSecretOptions;
  /** Optional clock injection for deterministic tests. */
  nowSeconds?: number;
}

export async function encodeQrDirectoryCursor(
  input: QrDirectoryEncodeInputs,
): Promise<string> {
  if (typeof input.merchantId !== "string" || !UUID_RE.test(input.merchantId)) {
    throw new PaginationValidationError(
      "merchantId must be a UUID for the qr-directory cursor position",
    );
  }
  const scopeHash = await computeQrDirectoryScopeHash(input.environment);
  const filterHash = await computeQrDirectoryFilterHash(input.filters);
  const now = typeof input.nowSeconds === "number"
    ? Math.floor(input.nowSeconds)
    : Math.floor(Date.now() / 1000);
  return encodeCursor(
    {
      operation: QR_DIRECTORY_OPERATION_ID,
      scopeHash,
      filterHash,
      orderProfileId: QR_DIRECTORY_ORDER_PROFILE.id,
      issuedAt: now,
      expiresAt: now + QR_DIRECTORY_CURSOR_LIFETIME_SECONDS,
      position: [input.merchantId] as PaginationScalar[],
    },
    input.secretOptions,
  );
}

export interface QrDirectoryDecodeInputs {
  token: string;
  environment: QrDirectoryEnvironment;
  filters: QrDirectoryFilters;
  secretOptions?: CursorSecretOptions;
}

export type QrDirectoryDecodedResult =
  | { ok: true; merchantId: string }
  | { ok: false; error: QrDirectoryProblemDetails };

const CURSOR_FAILURE_MAP: Record<
  Exclude<CursorFailureCode, "CONFIGURATION_ERROR">,
  QrDirectoryProblemCode
> = {
  MALFORMED: "PAGINATION_CURSOR_INVALID",
  UNSUPPORTED_VERSION: "PAGINATION_CURSOR_INVALID",
  INVALID_SIGNATURE: "PAGINATION_CURSOR_INVALID",
  ORDER_MISMATCH: "PAGINATION_CURSOR_INVALID",
  POSITION_INVALID: "PAGINATION_CURSOR_INVALID",
  EXPIRED: "PAGINATION_CURSOR_EXPIRED",
  OPERATION_MISMATCH: "PAGINATION_CURSOR_OPERATION_MISMATCH",
  SCOPE_MISMATCH: "PAGINATION_CURSOR_SCOPE_MISMATCH",
  FILTER_MISMATCH: "PAGINATION_CURSOR_FILTER_MISMATCH",
};

function isDecodedCursorFailure(
  result: DecodedCursorResult,
): result is Extract<DecodedCursorResult, { ok: false }> {
  return result.ok === false;
}

/**
 * Decode a signed QR-directory cursor bound to (operation, scope, filter,
 * ordering). CONFIGURATION_ERROR is re-raised as
 * `PaginationConfigurationError` so a missing / weak HMAC secret never
 * degrades to a client 400.
 */
export async function decodeQrDirectoryCursor(
  input: QrDirectoryDecodeInputs,
): Promise<QrDirectoryDecodedResult> {
  const scopeHash = await computeQrDirectoryScopeHash(input.environment);
  const filterHash = await computeQrDirectoryFilterHash(input.filters);
  const result: DecodedCursorResult = await decodeCursor(
    input.token,
    {
      operation: QR_DIRECTORY_OPERATION_ID,
      scopeHash,
      filterHash,
      orderProfile: QR_DIRECTORY_ORDER_PROFILE,
    },
    input.secretOptions,
  );
  if (isDecodedCursorFailure(result)) {
    if (result.code === "CONFIGURATION_ERROR") {
      throw new PaginationConfigurationError(result.detail);
    }
    return {
      ok: false,
      error: problem(
        CURSOR_FAILURE_MAP[result.code],
        "Cursor could not be validated in the current request context.",
      ),
    };
  }
  const pos = result.payload.pos;
  if (!isValidMerchantIdPosition(pos)) {
    return {
      ok: false,
      error: problem(
        "PAGINATION_CURSOR_INVALID",
        "Cursor position shape mismatch.",
      ),
    };
  }
  return { ok: true, merchantId: pos[0] as string };
}

// -------- Page finalisation --------

export interface QrDirectoryFinalizeInputs<T extends { merchant_id: string }> {
  environment: QrDirectoryEnvironment;
  filters: QrDirectoryFilters;
  limit: number;
  fetchedItems: readonly T[];
  secretOptions?: CursorSecretOptions;
  nowSeconds?: number;
}

export interface QrDirectoryPageResponse<T> {
  body: {
    data: T[];
    pagination: {
      mode: "cursor";
      has_more: boolean;
      next_cursor: string | null;
      limit: number;
    };
    meta: Record<string, never>;
  };
  headers: Record<string, string>;
}

/**
 * Fold a limit-plus-one query result into the ratified canonical envelope.
 * The runtime layer (X2-B) is responsible for wiring these headers onto
 * the outbound `Response` and combining them with the CORS-expose header.
 */
export async function finalizeQrDirectoryPage<T extends { merchant_id: string }>(
  input: QrDirectoryFinalizeInputs<T>,
): Promise<QrDirectoryPageResponse<T>> {
  if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > QR_DIRECTORY_MAX_LIMIT) {
    throw new PaginationValidationError(
      `limit must be an integer within [1, ${QR_DIRECTORY_MAX_LIMIT}]`,
    );
  }
  const scopeHash = await computeQrDirectoryScopeHash(input.environment);
  const filterHash = await computeQrDirectoryFilterHash(input.filters);
  const now = typeof input.nowSeconds === "number"
    ? Math.floor(input.nowSeconds)
    : Math.floor(Date.now() / 1000);
  const page = await finalizePage<T>({
    fetchedItems: input.fetchedItems,
    requestedLimit: input.limit,
    encodeContext: {
      operation: QR_DIRECTORY_OPERATION_ID,
      scopeHash,
      filterHash,
      orderProfileId: QR_DIRECTORY_ORDER_PROFILE.id,
      issuedAt: now,
      expiresAt: now + QR_DIRECTORY_CURSOR_LIFETIME_SECONDS,
    },
    positionExtractor: (row) => {
      if (typeof row.merchant_id !== "string" || !UUID_RE.test(row.merchant_id)) {
        throw new PaginationValidationError(
          "row.merchant_id must be a UUID for the qr-directory cursor position",
        );
      }
      return [row.merchant_id] as PaginationScalar[];
    },
    secretOptions: input.secretOptions,
  });
  const nextCursor = page.hasMore && page.nextCursor ? page.nextCursor : null;
  return {
    body: {
      data: page.items.slice(),
      pagination: {
        mode: "cursor",
        has_more: page.hasMore,
        next_cursor: nextCursor,
        limit: input.limit,
      },
      meta: {},
    },
    headers: {
      "X-Pagination-Mode": "cursor",
      "X-Pagination-Has-More": page.hasMore ? "true" : "false",
      "X-Pagination-Next-Cursor": nextCursor ?? "",
      "X-Pagination-Limit": String(input.limit),
    },
  };
}
