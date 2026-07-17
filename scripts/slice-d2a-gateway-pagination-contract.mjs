#!/usr/bin/env node
/**
 * Phase 1B — R1I-d.2A — Contract corrections for four gateway list operations.
 *
 * Scope (matches phase-1b-r1i-d2s-contract-decisions.md §1):
 *   - gatewayListSubaccounts
 *   - gatewayListBeneficiaries
 *   - gatewayListPaymentLinks
 *   - gatewayListVirtualAccounts
 *
 * Per-op changes (additive; no operationId/path/method/version change):
 *   - Ensure `limit` parameter has default=25, maximum=100.
 *   - Add `cursor` parameter (via components/parameters/CursorParam ref).
 *   - Add X-Pagination-Mode, X-Pagination-Has-More, X-Pagination-Next-Cursor,
 *     X-Pagination-Limit response headers on 200 responses.
 *   - Preserve existing responses, error responses, other parameters.
 *   - Preserve legacy `offset`/`starting_after`/`ending_before` as deprecated
 *     aliases (retained per d.2S §2 "one release").
 *
 * Applies to public/openapi.json only. YAML is regenerated separately by the
 * existing `openapi:build` toolchain; if yaml is present, this script keeps
 * it aligned by rewriting only these four operations in-place.
 */
import { readFileSync, writeFileSync } from "node:fs";

const TARGETS = [
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
];

const PAGINATION_HEADERS = {
  "X-Pagination-Mode": {
    description: "Pagination mode used for this response (always `cursor` for d.2A operations).",
    schema: { type: "string", enum: ["cursor"] },
  },
  "X-Pagination-Has-More": {
    description: "Boolean flag (`true`/`false`) indicating whether more pages are available.",
    schema: { type: "string", enum: ["true", "false"] },
  },
  "X-Pagination-Next-Cursor": {
    description: "Opaque continuation cursor. Omitted when has_more is false.",
    schema: { type: "string" },
  },
  "X-Pagination-Limit": {
    description: "Effective per-page limit used for this response.",
    schema: { type: "integer", minimum: 1, maximum: 100 },
  },
};

function correctLimitParam(params) {
  for (const param of params) {
    if (param && typeof param === "object" && param.name === "limit" && param.schema) {
      param.schema.default = 25;
      param.schema.maximum = 100;
      if (typeof param.schema.minimum !== "number") param.schema.minimum = 1;
    }
  }
}

function ensureCursorParam(params) {
  const hasCursor = params.some(
    (p) => (p && p.name === "cursor") || (p && p.$ref === "#/components/parameters/CursorParam"),
  );
  if (!hasCursor) {
    params.push({ $ref: "#/components/parameters/CursorParam" });
  }
}

function ensurePaginationHeaders(responses) {
  const ok = responses && responses["200"];
  if (!ok) return;
  if (!ok.headers) ok.headers = {};
  for (const [name, def] of Object.entries(PAGINATION_HEADERS)) {
    if (!ok.headers[name]) ok.headers[name] = def;
  }
}

function patch(specPath) {
  const spec = JSON.parse(readFileSync(specPath, "utf8"));
  let touched = 0;
  const paths = spec.paths || {};
  for (const path of Object.keys(paths)) {
    const methods = paths[path];
    for (const method of Object.keys(methods)) {
      const op = methods[method];
      if (!op || typeof op !== "object") continue;
      if (!TARGETS.includes(op.operationId)) continue;
      op.parameters = op.parameters || [];
      correctLimitParam(op.parameters);
      ensureCursorParam(op.parameters);
      ensurePaginationHeaders(op.responses);
      touched++;
    }
  }
  writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n", "utf8");
  console.log(`patched ${touched} operations in ${specPath}`);
}

patch("public/openapi.json");
