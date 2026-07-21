/**
 * Phase 1B — R1I-d.2B — Gateway pagination adapter (medium-volume ops).
 *
 * Composes shared foundation primitives from `../_shared/pagination.ts`
 * per-operation. This helper is scoped to `gateway-query` and is only used by
 * the three d.2B operations:
 *
 *   - gatewayListCustomers      → gateway_customers
 *   - gatewayListPaymentPlans   → gateway_payment_plans
 *   - gatewayListSubscriptions  → gateway_subscriptions
 *
 * Ratified per phase-1b-r1i-d2s-pagination-decisions.md §d.2B:
 *   defaultLimit = 25, maxLimit = 100, cursor lifetime = 1800 s
 *   ordering profile: (created_at DESC, id DESC)
 *   scope inputs   : { env, operation, actorSub, merchantId }
 *   filter inputs  : operation-specific (customers/payment-plans: sort;
 *                    subscriptions: plan_id + status + sort)
 *   response body  : { data, pagination: { mode, has_more, next_cursor, limit }, meta: {} }
 *
 * This file MUST NOT import from, extend, or modify the ratified d.2A helper
 * (`./_pagination.ts`). It is a sibling adapter with independent constants
 * and its own operation-specific ordering profile identifier.
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
  type CursorSecretOptions,
  type DecodedCursorResult,
  type PaginationOrderProfile,
  type PaginationScalar,
} from "../_shared/pagination.ts";

// -------- Types --------

export type D2bEnv = "sandbox" | "production" | "test" | "unknown";

export type GatewayD2bOperationId =
  | "gatewayListCustomers"
  | "gatewayListPaymentPlans"
  | "gatewayListSubscriptions";

export type GatewayD2bTable =
  | "gateway_customers"
  | "gateway_payment_plans"
  | "gateway_subscriptions";

export interface GatewayD2bOperation {
  id: GatewayD2bOperationId;
  table: GatewayD2bTable;
}

// -------- Ratified constants --------

export const D2B_DEFAULT_LIMIT = 25;
export const D2B_MAX_LIMIT = 100;
export const D2B_CURSOR_LIFETIME_SECONDS = 1800;

/** Ratified operation → table binding. Both allowlists are closed sets. */
export const D2B_OPERATIONS: readonly GatewayD2bOperation[] = Object.freeze([
  Object.freeze({ id: "gatewayListCustomers", table: "gateway_customers" }),
  Object.freeze({ id: "gatewayListPaymentPlans", table: "gateway_payment_plans" }),
  Object.freeze({ id: "gatewayListSubscriptions", table: "gateway_subscriptions" }),
]) as readonly GatewayD2bOperation[];

/** Ratified d.2B ordering profile shared by all three operations. */
export const D2B_ORDER_PROFILE: PaginationOrderProfile = {
  id: "gateway.d2b.created_desc_id_desc.v1",
  fields: [
    { key: "created_at", direction: "desc", nullable: false, unique: false },
    { key: "id", direction: "desc", nullable: false, unique: true },
  ],
};

/** Canonical sort contract — only these values are supported. */
export const D2B_CANONICAL_SORT_BY = "created_at" as const;
export const D2B_CANONICAL_SORT_ORDER = "desc" as const;

// -------- Operation allowlist helpers --------

export function isSupportedD2bOperation(id: string): id is GatewayD2bOperationId {
  return D2B_OPERATIONS.some((o) => o.id === id);
}

export function isSupportedD2bTable(table: string): table is GatewayD2bTable {
  return D2B_OPERATIONS.some((o) => o.table === table);
}

export function resolveD2bOperation(id: GatewayD2bOperationId): GatewayD2bOperation {
  const found = D2B_OPERATIONS.find((o) => o.id === id);
  if (!found) {
    throw new PaginationValidationError(`unsupported d.2B operation: ${id}`);
  }
  return found;
}

// -------- Problem Details mapping --------

export type D2bProblemCode =
  | "PAGINATION_LIMIT_INVALID"
  | "PAGINATION_SORT_INVALID"
  | "PAGINATION_CURSOR_INVALID"
  | "PAGINATION_CURSOR_EXPIRED"
  | "PAGINATION_CURSOR_OPERATION_MISMATCH"
  | "PAGINATION_CURSOR_SCOPE_MISMATCH"
  | "PAGINATION_CURSOR_FILTER_MISMATCH";

export interface D2bProblemDetails {
  status: 400;
  type: string;
  title: string;
  detail: string;
  code: D2bProblemCode;
}

const PROBLEM_TYPE_BASE = "https://kob.dev/problems/";

function problem(code: D2bProblemCode, detail: string, title: string, slug: string): D2bProblemDetails {
  return {
    status: 400,
    type: `${PROBLEM_TYPE_BASE}${slug}`,
    title,
    detail,
    code,
  };
}

// -------- Limit + cursor parameter parsing --------

export interface D2bPaginationParams {
  limit: number;
  cursor: string | null;
}

export function parseD2bParams(raw: {
  limit?: string | number | null;
  cursor?: string | null;
}): { ok: true; value: D2bPaginationParams } | { ok: false; error: D2bProblemDetails } {
  let limit: number;
  try {
    limit = parsePaginationLimit(raw.limit, {
      defaultLimit: D2B_DEFAULT_LIMIT,
      maxLimit: D2B_MAX_LIMIT,
    });
  } catch (e) {
    if (e instanceof PaginationValidationError) {
      return {
        ok: false,
        error: problem(
          "PAGINATION_LIMIT_INVALID",
          e.message,
          "Invalid pagination limit",
          "pagination-limit-invalid",
        ),
      };
    }
    throw e;
  }
  const cursor = typeof raw.cursor === "string" && raw.cursor.length > 0 ? raw.cursor : null;
  return { ok: true, value: { limit, cursor } };
}

// -------- Sort normalisation --------

export interface D2bSort {
  sort_by: typeof D2B_CANONICAL_SORT_BY;
  sort_order: typeof D2B_CANONICAL_SORT_ORDER;
}

/**
 * Normalise the sort_by / sort_order query pair. Unsupported values MUST be
 * rejected with a Problem Details 400 rather than silently coerced.
 */
export function normalizeD2bSort(raw: {
  sort_by?: string | null;
  sort_order?: string | null;
}): { ok: true; value: D2bSort } | { ok: false; error: D2bProblemDetails } {
  const sortBy = raw.sort_by === undefined || raw.sort_by === null || raw.sort_by === ""
    ? D2B_CANONICAL_SORT_BY
    : String(raw.sort_by);
  const sortOrder = raw.sort_order === undefined || raw.sort_order === null || raw.sort_order === ""
    ? D2B_CANONICAL_SORT_ORDER
    : String(raw.sort_order).toLowerCase();
  if (sortBy !== D2B_CANONICAL_SORT_BY) {
    return {
      ok: false,
      error: problem(
        "PAGINATION_SORT_INVALID",
        `sort_by must be '${D2B_CANONICAL_SORT_BY}'`,
        "Invalid sort field",
        "pagination-sort-invalid",
      ),
    };
  }
  if (sortOrder !== D2B_CANONICAL_SORT_ORDER) {
    return {
      ok: false,
      error: problem(
        "PAGINATION_SORT_INVALID",
        `sort_order must be '${D2B_CANONICAL_SORT_ORDER}'`,
        "Invalid sort order",
        "pagination-sort-invalid",
      ),
    };
  }
  return {
    ok: true,
    value: { sort_by: D2B_CANONICAL_SORT_BY, sort_order: D2B_CANONICAL_SORT_ORDER },
  };
}

// -------- Scope + filter hashing --------

export interface D2bScopeInputs {
  environment: D2bEnv;
  operation: GatewayD2bOperationId;
  actorSub: string;
  merchantId: string;
}

/**
 * Scope hash inputs (§d.2S): environment, operation, actor.sub, verified
 * merchant. Merchant id is bound as a one-way SHA-256 hash — the raw value
 * is never present in the cursor payload.
 */
export async function computeD2bScopeHash(inputs: D2bScopeInputs): Promise<string> {
  if (typeof inputs.merchantId !== "string" || inputs.merchantId.length === 0) {
    throw new PaginationValidationError("merchantId is required for d.2B scope binding");
  }
  if (typeof inputs.actorSub !== "string" || inputs.actorSub.length === 0) {
    throw new PaginationValidationError("actorSub is required for d.2B scope binding");
  }
  if (!isSupportedD2bOperation(inputs.operation)) {
    throw new PaginationValidationError(`unsupported d.2B operation: ${inputs.operation}`);
  }
  return hashScope({
    env: inputs.environment,
    op: inputs.operation,
    actor: inputs.actorSub,
    merchant: inputs.merchantId,
  });
}

export interface D2bCustomersFilterInputs {
  operation: "gatewayListCustomers";
  sort: D2bSort;
}

export interface D2bPaymentPlansFilterInputs {
  operation: "gatewayListPaymentPlans";
  sort: D2bSort;
}

export interface D2bSubscriptionsFilterInputs {
  operation: "gatewayListSubscriptions";
  planId: string | null;
  status: string | null;
  sort: D2bSort;
}

export type D2bFilterInputs =
  | D2bCustomersFilterInputs
  | D2bPaymentPlansFilterInputs
  | D2bSubscriptionsFilterInputs;

/**
 * Filter hash inputs are operation-specific. Raw filter values are never
 * placed in the cursor payload — only the SHA-256 digest is bound so that the
 * server can detect filter drift without leaking the underlying filter values.
 */
export async function computeD2bFilterHash(inputs: D2bFilterInputs): Promise<string> {
  if (inputs.operation === "gatewayListSubscriptions") {
    return hashFilters({
      plan_id: inputs.planId ?? null,
      status: inputs.status ?? null,
      sort_by: inputs.sort.sort_by,
      sort_order: inputs.sort.sort_order,
    });
  }
  return hashFilters({
    sort_by: inputs.sort.sort_by,
    sort_order: inputs.sort.sort_order,
  });
}

// -------- Cursor encode / decode --------

export interface D2bCursorRow {
  createdAt: string;
  id: string;
}

export interface D2bEncodeInputs {
  operation: GatewayD2bOperationId;
  scopeHash: string;
  filterHash: string;
  row: D2bCursorRow;
  /** Optional injection point for tests. Never accept from client input. */
  secretOptions?: CursorSecretOptions;
  /** Optional clock injection point for tests. Never accept from client input. */
  nowSeconds?: number;
}

export async function encodeD2bCursor(input: D2bEncodeInputs): Promise<string> {
  if (!isSupportedD2bOperation(input.operation)) {
    throw new PaginationValidationError(`unsupported d.2B operation: ${input.operation}`);
  }
  const now = typeof input.nowSeconds === "number"
    ? Math.floor(input.nowSeconds)
    : Math.floor(Date.now() / 1000);
  return encodeCursor(
    {
      operation: input.operation,
      scopeHash: input.scopeHash,
      filterHash: input.filterHash,
      orderProfileId: D2B_ORDER_PROFILE.id,
      issuedAt: now,
      expiresAt: now + D2B_CURSOR_LIFETIME_SECONDS,
      position: [input.row.createdAt, input.row.id] as PaginationScalar[],
    },
    input.secretOptions,
  );
}

export interface D2bDecodeInputs {
  token: string;
  operation: GatewayD2bOperationId;
  scopeHash: string;
  filterHash: string;
  secretOptions?: CursorSecretOptions;
}

export interface D2bDecodedCursorSuccess {
  ok: true;
  createdAt: string;
  id: string;
}

export interface D2bDecodedCursorFailure {
  ok: false;
  error: D2bProblemDetails;
}

export type D2bDecodedCursorResult = D2bDecodedCursorSuccess | D2bDecodedCursorFailure;

const CURSOR_FAILURE_TO_PROBLEM: Record<string, D2bProblemCode> = {
  MALFORMED: "PAGINATION_CURSOR_INVALID",
  UNSUPPORTED_VERSION: "PAGINATION_CURSOR_INVALID",
  INVALID_SIGNATURE: "PAGINATION_CURSOR_INVALID",
  EXPIRED: "PAGINATION_CURSOR_EXPIRED",
  OPERATION_MISMATCH: "PAGINATION_CURSOR_OPERATION_MISMATCH",
  SCOPE_MISMATCH: "PAGINATION_CURSOR_SCOPE_MISMATCH",
  FILTER_MISMATCH: "PAGINATION_CURSOR_FILTER_MISMATCH",
  ORDER_MISMATCH: "PAGINATION_CURSOR_INVALID",
  POSITION_INVALID: "PAGINATION_CURSOR_INVALID",
  // CONFIGURATION_ERROR is intentionally NOT mapped here — see decodeD2bCursor.
};

/**
 * Decode a ratified d.2B cursor bound to (operation, scope, filters, ordering).
 *
 * Client-attributable failures (bad signature, expiry, scope drift, filter
 * drift, operation drift, structural errors) are mapped to canonical
 * Problem Details 400 codes.
 *
 * A missing cursor-secret configuration remains a **server** configuration
 * failure and is re-raised as `PaginationConfigurationError` — it MUST NOT
 * be masked as a client 400.
 */
export async function decodeD2bCursor(input: D2bDecodeInputs): Promise<D2bDecodedCursorResult> {
  if (!isSupportedD2bOperation(input.operation)) {
    throw new PaginationValidationError(`unsupported d.2B operation: ${input.operation}`);
  }
  let result: DecodedCursorResult;
  try {
    result = await decodeCursor(
      input.token,
      {
        operation: input.operation,
        scopeHash: input.scopeHash,
        filterHash: input.filterHash,
        orderProfile: D2B_ORDER_PROFILE,
      },
      input.secretOptions,
    );
  } catch (e) {
    if (e instanceof PaginationConfigurationError) {
      // Missing / weak secret is a server configuration issue. Re-raise so
      // the runtime returns a 5xx rather than incorrectly reporting a 400.
      throw e;
    }
    throw e;
  }

  if (!result.ok) {
    // Foundation returns CONFIGURATION_ERROR when the secret is missing at
    // decode time. Re-raise to preserve the fail-closed server semantics.
    if (result.code === "CONFIGURATION_ERROR") {
      throw new PaginationConfigurationError(result.detail);
    }
    const code = CURSOR_FAILURE_TO_PROBLEM[result.code] ?? "PAGINATION_CURSOR_INVALID";
    const title = code === "PAGINATION_CURSOR_EXPIRED"
      ? "Pagination cursor expired"
      : "Invalid pagination cursor";
    const slug = code === "PAGINATION_CURSOR_EXPIRED"
      ? "pagination-cursor-expired"
      : "pagination-cursor-invalid";
    return {
      ok: false,
      error: problem(
        code,
        "Cursor could not be validated in the current request context.",
        title,
        slug,
      ),
    };
  }

  const pos = result.payload.pos;
  if (pos.length !== 2 || typeof pos[0] !== "string" || typeof pos[1] !== "string") {
    return {
      ok: false,
      error: problem(
        "PAGINATION_CURSOR_INVALID",
        "Cursor position shape mismatch.",
        "Invalid pagination cursor",
        "pagination-cursor-invalid",
      ),
    };
  }
  return { ok: true, createdAt: pos[0], id: pos[1] };
}

// -------- Page finalisation --------

export interface D2bFinalizeInputs<T extends { created_at: string; id: string }> {
  operation: GatewayD2bOperationId;
  scopeHash: string;
  filterHash: string;
  limit: number;
  fetchedItems: T[];
  mode: "cursor" | "hybrid";
  secretOptions?: CursorSecretOptions;
  nowSeconds?: number;
}

export interface D2bPageResponse<T> {
  body: {
    data: T[];
    pagination: {
      mode: "cursor" | "hybrid";
      has_more: boolean;
      next_cursor: string | null;
      limit: number;
    };
    meta: Record<string, never>;
  };
  headers: Record<string, string>;
}

/**
 * Wrap a limit-plus-one fetch result into the ratified d.2B body envelope.
 *
 * NOTE ON HEADERS: this adapter emits only the pagination values in an
 * ordinary header record. The runtime is responsible for combining these
 * with the d.2B-local CORS helper and for guaranteeing all four
 * X-Pagination-* header names are present on every 200 response — that
 * concern is outside the scope of this static foundation adapter.
 */
export async function finalizeD2bPage<T extends { created_at: string; id: string }>(
  input: D2bFinalizeInputs<T>,
): Promise<D2bPageResponse<T>> {
  const now = typeof input.nowSeconds === "number"
    ? Math.floor(input.nowSeconds)
    : Math.floor(Date.now() / 1000);
  const page = await finalizePage<T>({
    fetchedItems: input.fetchedItems,
    requestedLimit: input.limit,
    encodeContext: {
      operation: input.operation,
      scopeHash: input.scopeHash,
      filterHash: input.filterHash,
      orderProfileId: D2B_ORDER_PROFILE.id,
      issuedAt: now,
      expiresAt: now + D2B_CURSOR_LIFETIME_SECONDS,
    },
    positionExtractor: (row) => [row.created_at, row.id] as PaginationScalar[],
    secretOptions: input.secretOptions,
  });
  const nextCursor = page.hasMore && page.nextCursor ? page.nextCursor : null;
  const headers: Record<string, string> = {
    "X-Pagination-Mode": input.mode,
    "X-Pagination-Has-More": page.hasMore ? "true" : "false",
    "X-Pagination-Next-Cursor": nextCursor ?? "",
    "X-Pagination-Limit": String(input.limit),
  };
  return {
    body: {
      data: page.items,
      pagination: {
        mode: input.mode,
        has_more: page.hasMore,
        next_cursor: nextCursor,
        limit: input.limit,
      },
      meta: {},
    },
    headers,
  };
}
