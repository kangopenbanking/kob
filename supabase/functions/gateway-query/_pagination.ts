/**
 * Phase 1B — R1I-d.2A — Gateway pagination adapter (local helper).
 *
 * Composes shared foundation primitives from `../_shared/pagination.ts`
 * per-operation without modifying that module. This helper is scoped to
 * `gateway-query` and is only used by the four d.2A operations:
 *
 *   - gatewayListSubaccounts       → gateway_subaccounts
 *   - gatewayListBeneficiaries     → gateway_beneficiaries
 *   - gatewayListPaymentLinks      → gateway_payment_links
 *   - gatewayListVirtualAccounts   → gateway_virtual_accounts
 *
 * Ratified per phase-1b-r1i-d2s-pagination-decisions.md:
 *   defaultLimit = 25, maxLimit = 100, cursor lifetime = 3600 s
 *   ordering profile: (created_at DESC, id DESC)
 *   scope inputs   : { env, merchant_id, actor.sub }
 *   filter inputs  : operation-specific (subset of query filters)
 *   response body  : { data, pagination: { mode, has_more, next_cursor, limit } }
 *   response hdrs  : X-Pagination-Mode, X-Pagination-Has-More,
 *                    X-Pagination-Next-Cursor, X-Pagination-Limit
 *   count policy   : no exact totals (d.2A is small merchant-scoped catalogues,
 *                    but exact totals are not part of the ratified metadata).
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
  type PaginationOrderProfile,
  type PaginationScalar,
} from "../_shared/pagination.ts";

export type Env = "sandbox" | "production" | "test" | "unknown";

export interface GatewayD2aOperation {
  id:
    | "gatewayListSubaccounts"
    | "gatewayListBeneficiaries"
    | "gatewayListPaymentLinks"
    | "gatewayListVirtualAccounts";
  table: "gateway_subaccounts" | "gateway_beneficiaries" | "gateway_payment_links" | "gateway_virtual_accounts";
}

export const D2A_DEFAULT_LIMIT = 25;
export const D2A_MAX_LIMIT = 100;
export const D2A_CURSOR_LIFETIME_SECONDS = 3600;

/** Ratified ordering profile shared by all four d.2A operations. */
export const D2A_ORDER_PROFILE: PaginationOrderProfile = {
  id: "gateway.d2a.created_desc_id_desc.v1",
  fields: [
    { key: "created_at", direction: "desc", nullable: false, unique: false },
    { key: "id", direction: "desc", nullable: false, unique: true },
  ],
};

export interface PaginationParams {
  limit: number;
  cursor: string | null;
}

export interface PaginationErrorProblem {
  status: 400;
  type: string;
  title: string;
  detail: string;
  code: string;
}

/**
 * Parse and validate the ratified limit + opaque cursor from the request.
 * Errors are converted to Problem Details 400 (`code` matches d.2S decision).
 */
export function parseD2aParams(raw: {
  limit?: string | number | null;
  cursor?: string | null;
}): { ok: true; value: PaginationParams } | { ok: false; error: PaginationErrorProblem } {
  let limit: number;
  try {
    limit = parsePaginationLimit(raw.limit, {
      defaultLimit: D2A_DEFAULT_LIMIT,
      maxLimit: D2A_MAX_LIMIT,
    });
  } catch (e) {
    if (e instanceof PaginationValidationError) {
      return {
        ok: false,
        error: {
          status: 400,
          type: "https://kob.dev/problems/pagination-limit-invalid",
          title: "Invalid pagination limit",
          detail: e.message,
          code: "PAGINATION_LIMIT_INVALID",
        },
      };
    }
    throw e;
  }
  const cursor = typeof raw.cursor === "string" && raw.cursor.length > 0 ? raw.cursor : null;
  return { ok: true, value: { limit, cursor } };
}

export interface D2aScopeInputs {
  environment: Env;
  operation: GatewayD2aOperation["id"];
  actorSub: string;
  merchantScope: string[];
}

export async function computeD2aScopeHash(scope: D2aScopeInputs): Promise<string> {
  // Merchant scope is hashed in canonical sorted order so a stable set
  // produces a stable hash regardless of input array order.
  const merchants = [...scope.merchantScope].sort();
  return hashScope({
    env: scope.environment,
    op: scope.operation,
    actor: scope.actorSub,
    merchants,
  });
}

export async function computeD2aFilterHash(filters: Record<string, unknown>): Promise<string> {
  return hashFilters(filters);
}

export interface D2aDecodedCursor {
  ok: true;
  createdAt: string;
  id: string;
}

export interface D2aCursorError {
  ok: false;
  error: PaginationErrorProblem;
}

/**
 * Decode a ratified cursor bound to (operation, scope, filters, ordering).
 * Any codec failure maps to canonical Problem Details 400.
 */
export async function decodeD2aCursor(
  token: string,
  ctx: { operation: GatewayD2aOperation["id"]; scopeHash: string; filterHash: string },
): Promise<D2aDecodedCursor | D2aCursorError> {
  try {
    const result = await decodeCursor(token, {
      operation: ctx.operation,
      scopeHash: ctx.scopeHash,
      filterHash: ctx.filterHash,
      orderProfile: D2A_ORDER_PROFILE,
    });
    if (!result.ok) {
      const codeMap: Record<string, string> = {
        MALFORMED: "PAGINATION_CURSOR_INVALID",
        UNSUPPORTED_VERSION: "PAGINATION_CURSOR_INVALID",
        INVALID_SIGNATURE: "PAGINATION_CURSOR_INVALID",
        EXPIRED: "PAGINATION_CURSOR_EXPIRED",
        OPERATION_MISMATCH: "PAGINATION_CURSOR_OPERATION_MISMATCH",
        SCOPE_MISMATCH: "PAGINATION_CURSOR_SCOPE_MISMATCH",
        FILTER_MISMATCH: "PAGINATION_CURSOR_FILTER_MISMATCH",
        ORDER_MISMATCH: "PAGINATION_CURSOR_INVALID",
        POSITION_INVALID: "PAGINATION_CURSOR_INVALID",
        CONFIGURATION_ERROR: "PAGINATION_CURSOR_INVALID",
      };
      return {
        ok: false,
        error: {
          status: 400,
          type: "https://kob.dev/problems/pagination-cursor-invalid",
          title: "Invalid pagination cursor",
          detail: "Cursor could not be validated in the current request context.",
          code: codeMap[result.code] ?? "PAGINATION_CURSOR_INVALID",
        },
      };
    }
    const pos = result.payload.pos;
    if (pos.length !== 2 || typeof pos[0] !== "string" || typeof pos[1] !== "string") {
      return {
        ok: false,
        error: {
          status: 400,
          type: "https://kob.dev/problems/pagination-cursor-invalid",
          title: "Invalid pagination cursor",
          detail: "Cursor position shape mismatch.",
          code: "PAGINATION_CURSOR_INVALID",
        },
      };
    }
    return { ok: true, createdAt: pos[0] as string, id: pos[1] as string };
  } catch (e) {
    if (e instanceof PaginationConfigurationError) {
      // Missing secret is a server configuration issue, not client 400.
      throw e;
    }
    return {
      ok: false,
      error: {
        status: 400,
        type: "https://kob.dev/problems/pagination-cursor-invalid",
        title: "Invalid pagination cursor",
        detail: "Cursor could not be decoded.",
        code: "PAGINATION_CURSOR_INVALID",
      },
    };
  }
}

export interface D2aPageResponse<T> {
  body: {
    data: T[];
    pagination: {
      mode: "cursor";
      has_more: boolean;
      next_cursor: string | null;
      limit: number;
    };
  };
  headers: Record<string, string>;
}

/**
 * Wrap a limit-plus-one fetch result into the ratified body + response headers.
 */
export async function finalizeD2aPage<T extends { created_at: string; id: string }>(input: {
  operation: GatewayD2aOperation["id"];
  scopeHash: string;
  filterHash: string;
  limit: number;
  fetchedItems: T[];
}): Promise<D2aPageResponse<T>> {
  const now = Math.floor(Date.now() / 1000);
  const page = await finalizePage<T>({
    fetchedItems: input.fetchedItems,
    requestedLimit: input.limit,
    encodeContext: {
      operation: input.operation,
      scopeHash: input.scopeHash,
      filterHash: input.filterHash,
      orderProfileId: D2A_ORDER_PROFILE.id,
      issuedAt: now,
      expiresAt: now + D2A_CURSOR_LIFETIME_SECONDS,
    },
    positionExtractor: (row) => [row.created_at, row.id] as PaginationScalar[],
  });
  const headers: Record<string, string> = {
    "X-Pagination-Mode": "cursor",
    "X-Pagination-Has-More": page.hasMore ? "true" : "false",
    "X-Pagination-Limit": String(input.limit),
  };
  if (page.hasMore && page.nextCursor) {
    headers["X-Pagination-Next-Cursor"] = page.nextCursor;
  }
  return {
    body: {
      data: page.items,
      pagination: {
        mode: "cursor",
        has_more: page.hasMore,
        next_cursor: page.hasMore && page.nextCursor ? page.nextCursor : null,
        limit: input.limit,
      },
    },
    headers,
  };
}

/**
 * Convenience wrapper for encoding a first-page cursor for tests / adapters
 * that need to synthesise a continuation token from a known row.
 */
export async function encodeD2aCursor(input: {
  operation: GatewayD2aOperation["id"];
  scopeHash: string;
  filterHash: string;
  createdAt: string;
  id: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return encodeCursor({
    operation: input.operation,
    scopeHash: input.scopeHash,
    filterHash: input.filterHash,
    orderProfileId: D2A_ORDER_PROFILE.id,
    issuedAt: now,
    expiresAt: now + D2A_CURSOR_LIFETIME_SECONDS,
    position: [input.createdAt, input.id],
  });
}
