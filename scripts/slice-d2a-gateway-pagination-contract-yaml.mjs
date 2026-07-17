#!/usr/bin/env node
/**
 * Phase 1B — R1I-d.2A — YAML parity sync for four gateway list operations.
 *
 * Applies the same additive contract corrections directly to public/openapi.yaml
 * without re-serialising the entire spec (which would perturb unrelated
 * formatting). Uses the js-yaml parser to load->patch->dump only the four
 * target operations, then splices them back into the on-disk YAML by
 * matching operationId anchors.
 */
import { readFileSync, writeFileSync } from "node:fs";
import yaml from "js-yaml";

const TARGETS = new Set([
  "gatewayListSubaccounts",
  "gatewayListBeneficiaries",
  "gatewayListPaymentLinks",
  "gatewayListVirtualAccounts",
]);

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

const src = readFileSync("public/openapi.yaml", "utf8");
const doc = yaml.load(src);
let touched = 0;
for (const p of Object.values(doc.paths || {})) {
  for (const op of Object.values(p)) {
    if (!op || typeof op !== "object" || !TARGETS.has(op.operationId)) continue;
    op.parameters = op.parameters || [];
    for (const pr of op.parameters) {
      if (pr && pr.name === "limit" && pr.schema) {
        pr.schema.default = 25;
        pr.schema.maximum = 100;
        if (typeof pr.schema.minimum !== "number") pr.schema.minimum = 1;
      }
    }
    const hasCursor = op.parameters.some(
      (pr) => (pr && pr.name === "cursor") || (pr && pr.$ref === "#/components/parameters/CursorParam"),
    );
    if (!hasCursor) op.parameters.push({ $ref: "#/components/parameters/CursorParam" });
    const ok = op.responses && op.responses["200"];
    if (ok) {
      if (!ok.headers) ok.headers = {};
      for (const [name, def] of Object.entries(PAGINATION_HEADERS)) {
        if (!ok.headers[name]) ok.headers[name] = def;
      }
    }
    touched++;
  }
}
writeFileSync(
  "public/openapi.yaml",
  yaml.dump(doc, { lineWidth: 200, noRefs: true, quotingType: '"' }),
  "utf8",
);
console.log(`patched ${touched} operations in public/openapi.yaml`);
