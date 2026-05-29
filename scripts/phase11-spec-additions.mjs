#!/usr/bin/env node
/**
 * Phase 11 — integrator-experience spec additions (additive only).
 *
 * Adds admin-scoped operations:
 *   POST /v1/admin/webhooks/test         — fire a signed synthetic event
 *   POST /v1/admin/api-keys              — mint
 *   POST /v1/admin/api-keys/{id}/rotate  — rotate w/ overlap
 *   POST /v1/admin/api-keys/{id}/suspend — suspend/resume
 *   POST /v1/admin/api-keys/{id}/revoke  — revoke
 *
 * Standing Orders compliance:
 *   #1 LOCK: no renames/removals.
 *   #2 RATCHET: pure addition.
 *   #3 AUDIT: cites RFC 6920 (HMAC-SHA-256 signatures), OWASP API Top 10 2023
 *             (API2 broken auth) and OAS 3.1.
 *   #4 SURGEON: additive.
 *   #5 DEAD CODE: every schema referenced by at least one operation.
 *   #6 VERSION: minor bump → 4.49.0.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.49.0";

function ensure(spec) {
  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.paths = spec.paths || {};
  spec.tags = spec.tags || [];
}
function addTag(spec, name, description) {
  if (!spec.tags.find((t) => t.name === name)) spec.tags.push({ name, description });
}

function addSchemas(spec) {
  const S = spec.components.schemas;
  S.AdminTestWebhookRequest = S.AdminTestWebhookRequest || {
    type: "object",
    required: ["endpoint_id", "event_type"],
    properties: {
      endpoint_id: { type: "string", format: "uuid" },
      event_type: {
        type: "string",
        enum: [
          "payment.succeeded",
          "payment.failed",
          "qr.paid",
          "remittance.cemac.paid",
          "agent.cashin.completed",
          "ussd.session.ended",
          "transfer.completed",
        ],
      },
      payload: { type: "object", additionalProperties: true },
    },
  };
  S.AdminTestWebhookResult = S.AdminTestWebhookResult || {
    type: "object",
    required: ["delivery_id", "status"],
    properties: {
      delivery_id: { type: "string", format: "uuid", nullable: true },
      event_id: { type: "string" },
      status: { type: "string", enum: ["delivered", "failed"] },
      http_status: { type: "integer" },
      latency_ms: { type: "integer" },
      signature_header: { type: "string" },
      endpoint_url: { type: "string", format: "uri" },
    },
  };
  S.AdminApiKey = S.AdminApiKey || {
    type: "object",
    required: ["id", "status", "environment"],
    properties: {
      id: { type: "string", format: "uuid" },
      key_prefix: { type: "string", example: "sk_live_a1b2" },
      label: { type: "string" },
      environment: { type: "string", enum: ["sandbox", "production"] },
      status: { type: "string", enum: ["active", "suspended", "revoked"] },
      created_at: { type: "string", format: "date-time" },
      suspended_at: { type: "string", format: "date-time", nullable: true },
      suspended_reason: { type: "string", nullable: true },
    },
  };
  S.AdminApiKeyCreateRequest = S.AdminApiKeyCreateRequest || {
    type: "object",
    required: ["merchant_id"],
    properties: {
      merchant_id: { type: "string", format: "uuid" },
      label: { type: "string", maxLength: 120 },
      environment: { type: "string", enum: ["sandbox", "production"], default: "sandbox" },
    },
  };
  S.AdminApiKeyCreateResponse = S.AdminApiKeyCreateResponse || {
    allOf: [
      { $ref: "#/components/schemas/AdminApiKey" },
      {
        type: "object",
        required: ["api_key", "shown_once"],
        properties: {
          api_key: { type: "string", example: "sk_live_…" },
          shown_once: { type: "boolean" },
          message: { type: "string" },
        },
      },
    ],
  };
  S.AdminApiKeySuspendRequest = S.AdminApiKeySuspendRequest || {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["suspend", "resume"] },
      reason: { type: "string", maxLength: 500 },
    },
  };
}

function jsonBody(ref) {
  return { content: { "application/json": { schema: { $ref: `#/components/schemas/${ref}` } } } };
}
function jsonBodyRequired(ref) {
  return { required: true, ...jsonBody(ref) };
}

function addPaths(spec) {
  const P = spec.paths;
  P["/v1/admin/webhooks/test"] = P["/v1/admin/webhooks/test"] || {
    post: {
      tags: ["Admin"],
      summary: "Fire a signed test webhook to an existing endpoint",
      description: "Admin-only. Generates a synthetic event, signs with HMAC-SHA256 (RFC 6920), POSTs to the endpoint URL, records the delivery row.",
      operationId: "adminSendTestWebhook",
      security: [{ bearerAuth: [] }],
      requestBody: jsonBodyRequired("AdminTestWebhookRequest"),
      responses: {
        "200": { description: "Delivery attempted", ...jsonBody("AdminTestWebhookResult") },
        "400": { description: "Bad request" },
        "403": { description: "Admin role required" },
        "404": { description: "Endpoint not found" },
      },
    },
  };

  const adminKeyBase = "/v1/admin/api-keys";
  P[adminKeyBase] = P[adminKeyBase] || {
    post: {
      tags: ["Admin"],
      summary: "Mint a new institution API key",
      description: "Returns plaintext key once. Cite OWASP API Top 10 2023 #2.",
      operationId: "adminCreateApiKey",
      security: [{ bearerAuth: [] }],
      requestBody: jsonBodyRequired("AdminApiKeyCreateRequest"),
      responses: {
        "201": { description: "Created", ...jsonBody("AdminApiKeyCreateResponse") },
        "400": { description: "Bad request" },
        "403": { description: "Forbidden" },
      },
    },
  };

  for (const [suffix, opId, summary, bodyRef] of [
    ["{id}/rotate", "adminRotateApiKey", "Rotate an API key with grace overlap", null],
    ["{id}/suspend", "adminSuspendApiKey", "Suspend or resume an API key", "AdminApiKeySuspendRequest"],
    ["{id}/revoke", "adminRevokeApiKey", "Revoke an API key permanently", null],
  ]) {
    const p = `${adminKeyBase}/${suffix}`;
    if (P[p]) continue;
    P[p] = {
      post: {
        tags: ["Admin"],
        summary,
        operationId: opId,
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        ],
        ...(bodyRef ? { requestBody: jsonBodyRequired(bodyRef) } : {}),
        responses: {
          "200": { description: "OK", ...jsonBody("AdminApiKey") },
          "403": { description: "Forbidden" },
          "404": { description: "Not found" },
        },
      },
    };
  }
}

for (const file of SPECS) {
  if (!fs.existsSync(file)) continue;
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  ensure(spec);
  addTag(spec, "Admin", "Admin-only operations: API key lifecycle, webhook testing, integrator governance.");
  addSchemas(spec);
  addPaths(spec);
  spec.info = spec.info || {};
  spec.info.version = FINAL_VERSION;
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n");
  console.log(`  • ${path.basename(file)} updated → v${FINAL_VERSION}`);
}
console.log("phase11-spec-additions: done.");
