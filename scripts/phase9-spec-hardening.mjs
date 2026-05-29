#!/usr/bin/env node
/**
 * Phase 9 — High-priority gaps (#6-#9) spec hardening (additive only).
 *
 * Standing Orders compliance:
 *   - #1 LOCK     : no rename/removal — only additions
 *   - #2 RATCHET  : all changes additive; no compliance regression
 *   - #3 AUDIT    : cites: GSMA Mobile Money API v1.2, Berlin Group NextGenPSD2 v1.3.6 (consent lifecycle),
 *                  W3C Trace Context Level 2 (traceparent/tracestate), ISO 20022 camt.053.001.08,
 *                  RFC 6585 §4 (Retry-After / rate-limit publication)
 *   - #4 SURGEON  : schema properties/headers added, never removed
 *   - #5 DEAD CODE: every new component referenced by ≥1 operation
 *   - #6 VERSION  : minor bump (new endpoints + new schemas)
 *
 * Closes audit gaps (high-priority tier):
 *   G6 Mobile Money error normalization — adds MobileMoneyErrorCode enum + provider_error
 *                                          response envelope + reference doc.
 *   G7 Consent lifecycle endpoints      — adds canonical /v1/consents façade
 *                                          (create / get / list / revoke / extend).
 *   G8 OpenTelemetry tracing            — adds traceparent + tracestate header components,
 *                                          attaches them to every operation as optional request headers.
 *   G9 camt.053 statement generation    — adds /v1/statements endpoints producing
 *                                          ISO 20022 camt.053.001.08 XML.
 *   Bonus: per-tier rate limit publication — adds /v1/rate-limits read endpoint.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.43.0";

// ---------------------------------------------------------------------------
// Component bootstrap
// ---------------------------------------------------------------------------
function ensureComponents(spec) {
  spec.components = spec.components || {};
  spec.components.parameters = spec.components.parameters || {};
  spec.components.headers = spec.components.headers || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.components.examples = spec.components.examples || {};
}

// ---------------------------------------------------------------------------
// G8 — W3C Trace Context (traceparent / tracestate)
//      Spec: https://www.w3.org/TR/trace-context/
// ---------------------------------------------------------------------------
const TRACEPARENT_PATTERN = "^[0-9a-f]{2}-[0-9a-f]{32}-[0-9a-f]{16}-[0-9a-f]{2}$";

function addTracingComponents(spec) {
  spec.components.parameters.Traceparent ||= {
    name: "traceparent",
    in: "header",
    required: false,
    description:
      "W3C Trace Context Level 2 traceparent header. When supplied, KOB propagates the same context to every upstream call (bank connectors, mobile-money providers, settlement workers) and emits the resulting span IDs to OTLP collectors. See https://www.w3.org/TR/trace-context/",
    schema: { type: "string", pattern: TRACEPARENT_PATTERN, maxLength: 55 },
    example: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
  };
  spec.components.parameters.Tracestate ||= {
    name: "tracestate",
    in: "header",
    required: false,
    description:
      "W3C Trace Context Level 2 tracestate header. Vendor-specific trace data, propagated unchanged.",
    schema: { type: "string", maxLength: 512 },
    example: "kob=req:abc123,partner=acme",
  };
  spec.components.headers.Traceparent ||= {
    description: "Echoed W3C traceparent (Trace Context Level 2). Always returned to support distributed correlation.",
    schema: { type: "string", pattern: TRACEPARENT_PATTERN },
  };
}

function wireTracingHeaders(spec) {
  // Attach traceparent + tracestate as optional request headers on every operation.
  // Echo Traceparent on 2xx responses (one path per operation is enough to satisfy ratchet).
  let opTouched = 0;
  let respTouched = 0;
  for (const methods of Object.values(spec.paths || {})) {
    for (const [m, op] of Object.entries(methods)) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      op.parameters = op.parameters || [];
      const have = new Set(op.parameters.map((p) => p.$ref || p.name));
      if (!have.has("#/components/parameters/Traceparent") && !have.has("traceparent")) {
        op.parameters.push({ $ref: "#/components/parameters/Traceparent" });
        opTouched++;
      }
      if (!have.has("#/components/parameters/Tracestate") && !have.has("tracestate")) {
        op.parameters.push({ $ref: "#/components/parameters/Tracestate" });
      }
      for (const [code, resp] of Object.entries(op.responses || {})) {
        if (!/^2\d\d$/.test(code)) continue;
        resp.headers = resp.headers || {};
        if (!resp.headers.traceparent) {
          resp.headers.traceparent = { $ref: "#/components/headers/Traceparent" };
          respTouched++;
        }
      }
    }
  }
  return { opTouched, respTouched };
}

// ---------------------------------------------------------------------------
// G6 — Mobile Money error normalization (GSMA Mobile Money API v1.2)
// ---------------------------------------------------------------------------
const MOMO_ERROR_CODES = [
  "insufficient_funds",
  "invalid_msisdn",
  "subscriber_not_found",
  "subscriber_pin_blocked",
  "subscriber_kyc_incomplete",
  "subscriber_limit_exceeded",
  "duplicate_transaction",
  "transaction_expired",
  "transaction_declined",
  "provider_timeout",
  "provider_unavailable",
  "currency_not_supported",
  "amount_below_minimum",
  "amount_above_maximum",
  "internal_error",
];

function addMomoErrorSchemas(spec) {
  spec.components.schemas.MobileMoneyErrorCode ||= {
    type: "string",
    description:
      "Unified KOB mobile-money error code. Maps every provider-specific code (MTN MoMo, Orange Money, Wave, M-Pesa) to a single taxonomy so SDKs can branch deterministically. See `/developer/reference/mobile-money-errors` for the full mapping.",
    enum: MOMO_ERROR_CODES,
  };
  spec.components.schemas.MobileMoneyProviderError ||= {
    type: "object",
    description:
      "Raw upstream error preserved for audit + support. Use `normalized_code` for programmatic branching.",
    required: ["provider", "raw_code", "normalized_code"],
    properties: {
      provider: { type: "string", enum: ["mtn", "orange", "wave", "mpesa", "airtel"] },
      raw_code: { type: "string", description: "Verbatim provider error code (e.g. MTN ‘NOT_ENOUGH_FUNDS’)." },
      raw_message: { type: "string" },
      normalized_code: { $ref: "#/components/schemas/MobileMoneyErrorCode" },
      retryable: { type: "boolean" },
    },
  };
  spec.components.examples.MobileMoneyInsufficientFunds ||= {
    summary: "Provider declined for insufficient funds",
    value: {
      provider: "mtn",
      raw_code: "NOT_ENOUGH_FUNDS",
      raw_message: "Subscriber balance too low",
      normalized_code: "insufficient_funds",
      retryable: false,
    },
  };
}

function wireMomoErrorEnvelope(spec) {
  // Attach a 422 response example to the existing mobile-money POSTs.
  let touched = 0;
  for (const [p, methods] of Object.entries(spec.paths || {})) {
    if (!/mobile-money/i.test(p)) continue;
    for (const [m, op] of Object.entries(methods)) {
      if (m !== "post") continue;
      op.responses = op.responses || {};
      if (!op.responses["422"]) {
        op.responses["422"] = {
          description: "Provider declined or upstream validation error (normalized).",
          content: {
            "application/problem+json": {
              schema: {
                allOf: [
                  spec.components.schemas.ProblemDetails
                    ? { $ref: "#/components/schemas/ProblemDetails" }
                    : { type: "object" },
                  {
                    type: "object",
                    properties: {
                      provider_error: { $ref: "#/components/schemas/MobileMoneyProviderError" },
                    },
                  },
                ],
              },
              examples: {
                insufficient_funds: { $ref: "#/components/examples/MobileMoneyInsufficientFunds" },
              },
            },
          },
        };
        touched++;
      }
    }
  }
  return touched;
}

// ---------------------------------------------------------------------------
// G7 — Consent lifecycle (Berlin Group NextGenPSD2 v1.3.6 §5)
// ---------------------------------------------------------------------------
function addConsentLifecycleSchemas(spec) {
  spec.components.schemas.ConsentCreate ||= {
    type: "object",
    required: ["type", "permissions"],
    properties: {
      type: { type: "string", enum: ["AISP", "PISP", "CBPII"] },
      permissions: {
        type: "array",
        minItems: 1,
        items: {
          type: "string",
          enum: [
            "ReadAccountsBasic",
            "ReadAccountsDetail",
            "ReadBalances",
            "ReadTransactionsBasic",
            "ReadTransactionsDetail",
            "ReadBeneficiariesBasic",
            "ReadStandingOrdersBasic",
            "ReadDirectDebitsBasic",
            "ReadPAN",
            "InitiatePayment",
          ],
        },
      },
      expiration_date: { type: "string", format: "date-time" },
      transaction_from_date: { type: "string", format: "date" },
      transaction_to_date: { type: "string", format: "date" },
      psu_identifier: { type: "string", description: "PSU MSISDN or customer reference." },
    },
  };
  spec.components.schemas.ConsentList ||= {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/Consent" } },
      next_cursor: { type: "string", nullable: true },
    },
  };
}

function addConsentLifecyclePaths(spec) {
  const traceParams = [
    { $ref: "#/components/parameters/Traceparent" },
    { $ref: "#/components/parameters/Tracestate" },
  ];
  const idem = spec.components.parameters.IdempotencyKey
    ? [{ $ref: "#/components/parameters/IdempotencyKey" }]
    : [];

  const consentsRoot = (spec.paths["/v1/consents"] ||= {});
  consentsRoot.get ||= {
    tags: ["Consents"],
    summary: "List consents",
    operationId: "listConsents",
    parameters: [
      ...traceParams,
      { name: "type", in: "query", schema: { type: "string", enum: ["AISP", "PISP", "CBPII"] } },
      { name: "status", in: "query", schema: { type: "string", enum: ["AwaitingAuthorisation", "Authorised", "Rejected", "Consumed", "Expired", "Revoked"] } },
      { name: "cursor", in: "query", schema: { type: "string" } },
      { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
    ],
    responses: {
      "200": {
        description: "Paginated list of consents.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/ConsentList" } } },
      },
    },
  };
  consentsRoot.post ||= {
    tags: ["Consents"],
    summary: "Create consent",
    description: "Rail-agnostic consent factory. Routes to `aisp-create-consent`, `pisp-create-consent`, or the CBPII module based on `type`.",
    operationId: "createConsent",
    parameters: [...traceParams, ...idem],
    requestBody: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/ConsentCreate" } } },
    },
    responses: {
      "201": {
        description: "Consent created in AwaitingAuthorisation.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Consent" } } },
      },
    },
  };

  const consentById = (spec.paths["/v1/consents/{consentId}"] ||= {
    parameters: [{ name: "consentId", in: "path", required: true, schema: { type: "string" } }],
  });
  consentById.parameters ||= [{ name: "consentId", in: "path", required: true, schema: { type: "string" } }];
  consentById.get ||= {
    tags: ["Consents"],
    summary: "Get consent",
    operationId: "getConsent",
    parameters: traceParams,
    responses: {
      "200": {
        description: "Consent record.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Consent" } } },
      },
    },
  };
  consentById.delete ||= {
    tags: ["Consents"],
    summary: "Revoke consent",
    operationId: "revokeConsent",
    parameters: [...traceParams, ...idem],
    responses: { "204": { description: "Consent revoked." } },
  };

  const consentExtend = (spec.paths["/v1/consents/{consentId}/extend"] ||= {
    parameters: [{ name: "consentId", in: "path", required: true, schema: { type: "string" } }],
  });
  consentExtend.parameters ||= [{ name: "consentId", in: "path", required: true, schema: { type: "string" } }];
  consentExtend.post ||= {
    tags: ["Consents"],
    summary: "Extend consent expiration",
    operationId: "extendConsent",
    parameters: [...traceParams, ...idem],
    requestBody: {
      required: true,
      content: {
        "application/json": {
          schema: {
            type: "object",
            required: ["expiration_date"],
            properties: { expiration_date: { type: "string", format: "date-time" } },
          },
        },
      },
    },
    responses: {
      "200": {
        description: "Consent extended.",
        content: { "application/json": { schema: { $ref: "#/components/schemas/Consent" } } },
      },
    },
  };
}


// ---------------------------------------------------------------------------
// G9 — ISO 20022 camt.053.001.08 statement generation
// ---------------------------------------------------------------------------
function addStatementSchemas(spec) {
  spec.components.schemas.StatementRequest ||= {
    type: "object",
    required: ["account_id", "period_from", "period_to"],
    properties: {
      account_id: { type: "string", format: "uuid" },
      period_from: { type: "string", format: "date" },
      period_to: { type: "string", format: "date" },
      format: { type: "string", enum: ["camt053", "pdf", "csv"], default: "camt053" },
    },
  };
  spec.components.schemas.Statement ||= {
    type: "object",
    required: ["statement_id", "account_id", "period_from", "period_to", "format", "status"],
    properties: {
      statement_id: { type: "string", format: "uuid" },
      account_id: { type: "string", format: "uuid" },
      period_from: { type: "string", format: "date" },
      period_to: { type: "string", format: "date" },
      format: { type: "string", enum: ["camt053", "pdf", "csv"] },
      status: { type: "string", enum: ["pending", "ready", "failed"] },
      download_url: { type: "string", format: "uri", nullable: true },
      generated_at: { type: "string", format: "date-time", nullable: true },
    },
  };
}

function addStatementPaths(spec) {
  const traceParams = [
    { $ref: "#/components/parameters/Traceparent" },
    { $ref: "#/components/parameters/Tracestate" },
  ];
  const idem = spec.components.parameters.IdempotencyKey
    ? [{ $ref: "#/components/parameters/IdempotencyKey" }]
    : [];

  spec.paths["/v1/statements"] ||= {
    post: {
      tags: ["Statements"],
      summary: "Request statement (camt.053 / pdf / csv)",
      description:
        "Generates an ISO 20022 camt.053.001.08 BankToCustomerStatement XML document by default. PDF and CSV formats are produced in parallel for the same period.",
      operationId: "createStatement",
      parameters: [...traceParams, ...idem],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/StatementRequest" } } },
      },
      responses: {
        "202": {
          description: "Statement job accepted.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Statement" } } },
        },
      },
    },
  };
  spec.paths["/v1/statements/{statementId}"] ||= {
    parameters: [{ name: "statementId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
    get: {
      tags: ["Statements"],
      summary: "Get statement metadata",
      operationId: "getStatement",
      parameters: traceParams,
      responses: {
        "200": {
          description: "Statement record.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/Statement" } } },
        },
      },
    },
  };
  spec.paths["/v1/statements/{statementId}/content"] ||= {
    parameters: [{ name: "statementId", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
    get: {
      tags: ["Statements"],
      summary: "Download statement content",
      description: "Returns the raw statement bytes. Content-Type matches the requested format (application/xml for camt.053, application/pdf, text/csv).",
      operationId: "getStatementContent",
      parameters: traceParams,
      responses: {
        "200": {
          description: "Statement content.",
          content: {
            "application/xml": { schema: { type: "string", description: "camt.053.001.08 XML." } },
            "application/pdf": { schema: { type: "string", format: "binary" } },
            "text/csv": { schema: { type: "string" } },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Bonus — Published rate-limit tiers
// ---------------------------------------------------------------------------
function addRateLimitTierSchemas(spec) {
  spec.components.schemas.RateLimitTier ||= {
    type: "object",
    required: ["tier", "requests_per_minute", "burst", "concurrent_connections"],
    properties: {
      tier: { type: "string", enum: ["free", "pro", "enterprise"] },
      requests_per_minute: { type: "integer" },
      burst: { type: "integer" },
      concurrent_connections: { type: "integer" },
      webhook_deliveries_per_minute: { type: "integer" },
      idempotency_window_hours: { type: "integer" },
    },
  };
  spec.components.schemas.RateLimitTiers ||= {
    type: "object",
    required: ["data"],
    properties: { data: { type: "array", items: { $ref: "#/components/schemas/RateLimitTier" } } },
  };
}

function addRateLimitPaths(spec) {
  spec.paths["/v1/rate-limits"] ||= {
    get: {
      tags: ["Platform"],
      summary: "Published rate limits per tier",
      description:
        "Returns the canonical per-tier rate-limit numbers. Mirrors the values enforced by the gateway and surfaced via `X-RateLimit-Limit` / `X-RateLimit-Remaining` response headers.",
      operationId: "getRateLimits",
      parameters: [
        { $ref: "#/components/parameters/Traceparent" },
        { $ref: "#/components/parameters/Tracestate" },
      ],
      responses: {
        "200": {
          description: "Tier table.",
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RateLimitTiers" },
              example: {
                data: [
                  { tier: "free", requests_per_minute: 60, burst: 120, concurrent_connections: 10, webhook_deliveries_per_minute: 30, idempotency_window_hours: 24 },
                  { tier: "pro", requests_per_minute: 600, burst: 1200, concurrent_connections: 100, webhook_deliveries_per_minute: 300, idempotency_window_hours: 24 },
                  { tier: "enterprise", requests_per_minute: 6000, burst: 12000, concurrent_connections: 1000, webhook_deliveries_per_minute: 3000, idempotency_window_hours: 168 },
                ],
              },
            },
          },
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------
function ensureTags(spec) {
  spec.tags = spec.tags || [];
  const existing = new Set(spec.tags.map((t) => t.name));
  const add = [
    { name: "Consents", description: "Unified AISP/PISP/CBPII consent lifecycle." },
    { name: "Statements", description: "ISO 20022 camt.053 + PDF + CSV statement generation." },
    { name: "Platform", description: "Platform-wide metadata (rate limits, health, capabilities)." },
  ];
  for (const t of add) if (!existing.has(t.name)) spec.tags.push(t);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
for (const file of SPECS) {
  if (!fs.existsSync(file)) {
    console.warn(`[phase9] skip missing ${file}`);
    continue;
  }
  const spec = JSON.parse(fs.readFileSync(file, "utf-8"));
  const prev = spec.info?.version;
  ensureComponents(spec);

  addTracingComponents(spec);
  addMomoErrorSchemas(spec);
  addConsentLifecycleSchemas(spec);
  addStatementSchemas(spec);
  addRateLimitTierSchemas(spec);

  addConsentLifecyclePaths(spec);
  addStatementPaths(spec);
  addRateLimitPaths(spec);

  ensureTags(spec);

  const momo = wireMomoErrorEnvelope(spec);
  const trace = wireTracingHeaders(spec);

  spec.info.version = FINAL_VERSION;
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf-8");
  const yamlPath = file.replace(/\.json$/, ".yaml");
  fs.writeFileSync(yamlPath, yaml.dump(spec, { noRefs: true, lineWidth: 200 }), "utf-8");
  console.log(
    `[phase9] ${path.basename(file)}: ${prev} → ${FINAL_VERSION} ` +
    `(momo 422s=${momo}, trace ops=${trace.opTouched}, trace 2xx echoes=${trace.respTouched})`
  );
}
console.log("[phase9] High-priority gaps spec hardening complete.");
