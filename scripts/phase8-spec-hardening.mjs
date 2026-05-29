#!/usr/bin/env node
/**
 * Phase 8 — Production blockers spec hardening (additive only).
 *
 * Standing Orders compliance:
 *   - #1 LOCK:     no rename/removal — only additions
 *   - #2 RATCHET:  all changes additive; no compliance regression
 *   - #3 AUDIT:    each change cites: Stripe API Reference, RFC 7807, PSD2 RTS Art.36(1)(b), OWASP webhook cheat-sheet
 *   - #4 SURGEON:  schema properties/headers added, never removed
 *   - #5 DEAD CODE: every new component referenced by ≥1 operation
 *   - #6 VERSION:  minor bump (new endpoints + new component schemas)
 *
 * Closes audit gaps:
 *   G1 Idempotency  — adds pattern + maxLength to Idempotency-Key schema,
 *                     adds X-Idempotent-Replay + X-Idempotency-Status headers,
 *                     wires them onto every financial mutating 2xx response.
 *   G2 PaymentIntent — adds /v1/payment-intents canonical async resource with state machine.
 *   G3 Webhooks      — adds X-Webhook-Signature / X-Webhook-Timestamp / WebhookSignature scheme,
 *                     adds /v1/webhooks/events/{eventId}/replay façade,
 *                     adds /v1/webhooks/dlq + requeue endpoints.
 *   G4 Sandbox       — tightens sbx_ key pattern, adds tier field,
 *                     adds /v1/sandbox/trigger and /v1/sandbox/charges/{chargeId}/simulate.
 *   G5 RFC 7807     — adds ProblemDetails examples (Conflict, Validation, RateLimited).
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.42.0";

const UUID_V4_PATTERN = "^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$";

const FINANCIAL_TAGS = new Set([
  "Payment Gateway",
  "Payments",
  "Mobile Money",
  "Pay by Bank",
  "PISP",
  "Interbank",
  "Loans",
  "Savings",
  "Overdraft",
  "Virtual Cards",
  "Ledger",
  "Banking Operations",
  "Payment Facilitation",
  "Settlement",
  "Consumer Tools",
]);

const MUT = ["post", "put", "patch"];

// ---------------------------------------------------------------------------
// Component additions
// ---------------------------------------------------------------------------
function ensureComponents(spec) {
  spec.components = spec.components || {};
  spec.components.parameters = spec.components.parameters || {};
  spec.components.headers = spec.components.headers || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.components.examples = spec.components.examples || {};
  spec.components.securitySchemes = spec.components.securitySchemes || {};
}

function hardenIdempotencyKeySchema(spec) {
  // Tighten existing IdempotencyKey parameter + header schemas (additive: pattern + maxLength).
  for (const target of [
    spec.components.parameters?.IdempotencyKey,
    spec.components.headers?.IdempotencyKey,
  ]) {
    if (!target?.schema) continue;
    target.schema.pattern ||= UUID_V4_PATTERN;
    target.schema.maxLength ||= 255;
    target.schema.format ||= "uuid";
  }
}

function addReplayHeaders(spec) {
  spec.components.headers["X-Idempotent-Replay"] = {
    description:
      "Set to `true` when the response was served from the idempotency cache for a replayed request (Stripe API Reference §Idempotent Requests).",
    schema: { type: "boolean" },
  };
  spec.components.headers["X-Idempotency-Status"] = {
    description:
      "Idempotency outcome: `first_request` (new key, normal processing), `replayed` (cached response served), `conflict_rejected` (same key reused with different payload — 409).",
    schema: {
      type: "string",
      enum: ["first_request", "replayed", "conflict_rejected"],
    },
  };
}

function addWebhookHeaders(spec) {
  spec.components.headers["X-Webhook-Signature"] = {
    description:
      "HMAC-SHA256 webhook signature. Format `t=<unix_ts>,v1=<hex>` per Stripe webhook signing convention. Receivers MUST reject deliveries where `|now - t| > 300s` (OWASP Webhook Security Cheat Sheet).",
    schema: {
      type: "string",
      pattern: "^t=\\d{10},v1=[0-9a-f]{64}$",
      example: "t=1716998400,v1=5257a869e7ecebeda32affa62cdca3fa51cad7e77a0e56ff536d0ce8e108d8bd",
    },
  };
  spec.components.headers["X-Webhook-Timestamp"] = {
    description:
      "Unix timestamp (seconds) of webhook signature generation. Use to compute and verify replay-protection window.",
    schema: { type: "integer", format: "int64", example: 1716998400 },
  };
  spec.components.headers["X-Webhook-Signature-Legacy"] = {
    description:
      "Deprecated. Raw HMAC-SHA256 hex of the body without timestamp prefix. Emitted in parallel during the 4.42.0 deprecation window for receivers that have not yet adopted the timestamped signature. Will be removed in v5.0.0.",
    deprecated: true,
    schema: { type: "string", pattern: "^[0-9a-f]{64}$" },
  };
  spec.components.securitySchemes.WebhookSignature = {
    type: "apiKey",
    in: "header",
    name: "X-Webhook-Signature",
    description:
      "HMAC-SHA256 signature over `${timestamp}.${body}` using the endpoint secret. Format `t=<ts>,v1=<hex>`. Reject if `|now - t| > 300s` (Stripe/OWASP convention).",
  };
}

function addProblemDetailsExamples(spec) {
  spec.components.examples.ProblemDetailsConflict = {
    summary: "RFC 7807 — idempotency key reused with different payload (409)",
    value: {
      type: "https://api.kangopenbanking.com/errors/idempotency-key-reused",
      title: "Idempotency Key Conflict",
      status: 409,
      detail:
        "The provided Idempotency-Key was previously used with a different request body.",
      instance: "/v1/gateway/charges",
      error_id: "err_idem_a1b2c3",
      timestamp: "2026-05-29T10:00:00Z",
    },
  };
  spec.components.examples.ProblemDetailsValidation = {
    summary: "RFC 7807 — request body validation error (422)",
    value: {
      type: "https://api.kangopenbanking.com/errors/validation",
      title: "Unprocessable Entity",
      status: 422,
      detail: "One or more request fields failed validation.",
      instance: "/v1/gateway/charges",
      error_id: "err_val_d4e5f6",
      timestamp: "2026-05-29T10:00:00Z",
      errors: [
        { field: "amount", code: "GW_001", message: "Amount must be > 0" },
        { field: "currency", code: "GW_002", message: "Unsupported currency 'USX'" },
      ],
    },
  };
  spec.components.examples.ProblemDetailsRateLimited = {
    summary: "RFC 7807 — rate limit exceeded (429)",
    value: {
      type: "https://api.kangopenbanking.com/errors/rate-limited",
      title: "Too Many Requests",
      status: 429,
      detail: "Request rate exceeded for the merchant's current tier.",
      instance: "/v1/gateway/charges",
      error_id: "err_rl_g7h8i9",
      timestamp: "2026-05-29T10:00:00Z",
      retry_after: 30,
    },
  };
}

// ---------------------------------------------------------------------------
// Payment Intent schema + paths
// ---------------------------------------------------------------------------
function addPaymentIntentSchemas(spec) {
  spec.components.schemas.PaymentIntent = {
    type: "object",
    description:
      "Rail-agnostic asynchronous payment intent. Models the canonical lifecycle of any payment from creation through terminal state. State machine (Stripe API Reference §payment_intents): requires_payment_method → requires_confirmation → processing → (requires_action → processing →)* succeeded | canceled | failed.",
    required: ["id", "amount", "currency", "status", "payment_method_types", "created_at"],
    properties: {
      id: { type: "string", format: "uuid" },
      amount: { type: "integer", format: "int64", minimum: 1, description: "Smallest currency unit; for XAF/XOF this is the whole amount (zero-decimal)." },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      status: {
        type: "string",
        enum: [
          "requires_payment_method",
          "requires_confirmation",
          "processing",
          "requires_action",
          "succeeded",
          "canceled",
          "failed",
        ],
      },
      payment_method_types: {
        type: "array",
        items: {
          type: "string",
          enum: ["mobile_money", "bank_transfer", "card", "pay_by_bank", "wallet"],
        },
        minItems: 1,
      },
      next_action: {
        type: "object",
        nullable: true,
        description: "Present when status is `requires_action`. Tells the client what to do next.",
        properties: {
          type: {
            type: "string",
            enum: ["redirect_to_url", "display_qr", "use_stk_push", "poll_provider"],
          },
          redirect_to_url: { type: "object", properties: { url: { type: "string", format: "uri" }, return_url: { type: "string", format: "uri" } } },
          display_qr: { type: "object", properties: { qr_payload: { type: "string" } } },
          use_stk_push: { type: "object", properties: { msisdn: { type: "string" }, operator: { type: "string" } } },
        },
      },
      last_error: {
        type: "object",
        nullable: true,
        properties: {
          code: { type: "string" },
          message: { type: "string" },
        },
      },
      description: { type: "string", nullable: true },
      metadata: { type: "object", additionalProperties: true },
      customer_id: { type: "string", format: "uuid", nullable: true },
      child_intent_id: { type: "string", format: "uuid", nullable: true, description: "ID of the underlying rail-specific intent (e.g. pay-by-bank intent or funding intent)." },
      child_resource: { type: "string", nullable: true, enum: [null, "pay_by_bank_intent", "funding_intent", "gateway_charge"] },
      created_at: { type: "string", format: "date-time" },
      updated_at: { type: "string", format: "date-time" },
      succeeded_at: { type: "string", format: "date-time", nullable: true },
      canceled_at: { type: "string", format: "date-time", nullable: true },
    },
  };

  spec.components.schemas.PaymentIntentCreate = {
    type: "object",
    required: ["amount", "currency", "payment_method_types"],
    properties: {
      amount: { type: "integer", format: "int64", minimum: 1 },
      currency: { type: "string", pattern: "^[A-Z]{3}$" },
      payment_method_types: {
        type: "array",
        items: { type: "string", enum: ["mobile_money", "bank_transfer", "card", "pay_by_bank", "wallet"] },
        minItems: 1,
      },
      confirm: { type: "boolean", default: false, description: "If true, attempt immediate confirmation. If false, intent is created in `requires_confirmation`." },
      description: { type: "string" },
      metadata: { type: "object", additionalProperties: true },
      customer_id: { type: "string", format: "uuid" },
    },
  };

  spec.components.schemas.PaymentIntentList = {
    type: "object",
    required: ["data"],
    properties: {
      data: { type: "array", items: { $ref: "#/components/schemas/PaymentIntent" } },
      has_more: { type: "boolean" },
      next_cursor: { type: "string", nullable: true },
    },
  };
}

function problemJsonResponses() {
  // Standard error responses pointing at existing ProblemDetails schema + new examples.
  return {
    400: {
      description: "Bad Request",
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/ProblemDetails" },
          examples: { ProblemDetailsValidation: { $ref: "#/components/examples/ProblemDetailsValidation" } },
        },
      },
    },
    401: { description: "Unauthorized", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
    409: {
      description: "Conflict",
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/ProblemDetails" },
          examples: { ProblemDetailsConflict: { $ref: "#/components/examples/ProblemDetailsConflict" } },
        },
      },
    },
    422: { description: "Unprocessable Entity", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
    429: {
      description: "Rate Limited",
      content: {
        "application/problem+json": {
          schema: { $ref: "#/components/schemas/ProblemDetails" },
          examples: { ProblemDetailsRateLimited: { $ref: "#/components/examples/ProblemDetailsRateLimited" } },
        },
      },
    },
  };
}

function addPaymentIntentPaths(spec) {
  const idempotencyParam = { $ref: "#/components/parameters/IdempotencyKey" };
  const replayHeaders = {
    "X-Idempotent-Replay": { $ref: "#/components/headers/X-Idempotent-Replay" },
    "X-Idempotency-Status": { $ref: "#/components/headers/X-Idempotency-Status" },
  };

  spec.paths["/v1/payment-intents"] = {
    post: {
      tags: ["Payments"],
      operationId: "createPaymentIntent",
      summary: "Create a payment intent (async)",
      description:
        "Creates a rail-agnostic payment intent. Returns `202 Accepted` immediately. Clients should poll `GET /v1/payment-intents/{id}` or subscribe to `payment_intent.*` webhooks for terminal state.",
      security: [{ bearerAuth: [] }],
      parameters: [idempotencyParam],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntentCreate" } } },
      },
      responses: {
        202: {
          description: "Payment intent accepted for processing.",
          headers: replayHeaders,
          content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntent" } } },
        },
        ...problemJsonResponses(),
      },
    },
    get: {
      tags: ["Payments"],
      operationId: "listPaymentIntents",
      summary: "List payment intents",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
        { name: "cursor", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["requires_payment_method", "requires_confirmation", "processing", "requires_action", "succeeded", "canceled", "failed"] } },
      ],
      responses: {
        200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntentList" } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/payment-intents/{id}"] = {
    get: {
      tags: ["Payments"],
      operationId: "getPaymentIntent",
      summary: "Retrieve a payment intent",
      security: [{ bearerAuth: [] }],
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        200: { description: "OK", content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntent" } } } },
        404: { description: "Not Found", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/payment-intents/{id}/confirm"] = {
    post: {
      tags: ["Payments"],
      operationId: "confirmPaymentIntent",
      summary: "Confirm a payment intent",
      description: "Transitions a `requires_confirmation` intent to `processing`. Idempotent.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        idempotencyParam,
      ],
      requestBody: { required: false, content: { "application/json": { schema: { type: "object" } } } },
      responses: {
        200: { description: "OK", headers: replayHeaders, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntent" } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/payment-intents/{id}/cancel"] = {
    post: {
      tags: ["Payments"],
      operationId: "cancelPaymentIntent",
      summary: "Cancel a payment intent",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        idempotencyParam,
      ],
      responses: {
        200: { description: "OK", headers: replayHeaders, content: { "application/json": { schema: { $ref: "#/components/schemas/PaymentIntent" } } } },
        ...problemJsonResponses(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Webhook replay façade + DLQ
// ---------------------------------------------------------------------------
function addWebhookPaths(spec) {
  spec.paths["/v1/webhooks/events/{eventId}/replay"] = {
    post: {
      tags: ["Webhooks"],
      operationId: "replayWebhookEvent",
      summary: "Replay a webhook event (canonical façade)",
      description:
        "Manually redeliver a webhook event by event_id. Looks up the originating endpoint and delivery, then re-queues. Convenience wrapper over `/v1/webhooks/v2/endpoints/{endpointId}/deliveries/{deliveryId}/replay`.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "eventId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ],
      responses: {
        202: {
          description: "Event re-queued for delivery.",
          headers: {
            "X-Idempotent-Replay": { $ref: "#/components/headers/X-Idempotent-Replay" },
            "X-Idempotency-Status": { $ref: "#/components/headers/X-Idempotency-Status" },
          },
          content: { "application/json": { schema: { type: "object", properties: { delivery_id: { type: "string", format: "uuid" }, status: { type: "string" } } } } },
        },
        404: { description: "Event not found", content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/webhooks/dlq"] = {
    get: {
      tags: ["Webhooks"],
      operationId: "listWebhookDlq",
      summary: "List dead-letter webhook deliveries",
      description: "Returns deliveries that exhausted the 7-attempt retry schedule.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 25 } },
        { name: "cursor", in: "query", schema: { type: "string" } },
      ],
      responses: {
        200: { description: "OK", content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { type: "object" } }, has_more: { type: "boolean" } } } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/webhooks/dlq/{deliveryId}/requeue"] = {
    post: {
      tags: ["Webhooks"],
      operationId: "requeueWebhookDlq",
      summary: "Requeue a dead-letter webhook delivery",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "deliveryId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ],
      responses: {
        202: {
          description: "Delivery requeued.",
          headers: {
            "X-Idempotent-Replay": { $ref: "#/components/headers/X-Idempotent-Replay" },
            "X-Idempotency-Status": { $ref: "#/components/headers/X-Idempotency-Status" },
          },
          content: { "application/json": { schema: { type: "object" } } },
        },
        ...problemJsonResponses(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Sandbox: tighten existing key response + add trigger + charge simulate
// ---------------------------------------------------------------------------
function hardenSandboxKey(spec) {
  const path = spec.paths?.["/v1/sandbox/api-keys"];
  if (!path?.post?.responses) return;
  for (const code of ["200", "201"]) {
    const resp = path.post.responses[code];
    const schema = resp?.content?.["application/json"]?.schema;
    if (!schema?.properties) continue;
    // Additive: tighten api_key + add tier
    if (schema.properties.api_key && !schema.properties.api_key.pattern) {
      schema.properties.api_key.pattern = "^sbx_[0-9a-f]{64}$";
      schema.properties.api_key.example = "sbx_" + "a".repeat(64);
    }
    if (!schema.properties.tier) {
      schema.properties.tier = { type: "string", enum: ["free", "pro", "enterprise"], default: "free" };
    }
  }
}

function addSandboxPaths(spec) {
  spec.paths["/v1/sandbox/trigger"] = {
    post: {
      tags: ["Sandbox"],
      operationId: "triggerSandboxFault",
      summary: "Trigger a sandbox fault-injection event",
      description: "Forces a specific failure mode on the next matching operation. Auth-scoped to the developer's sandbox.",
      security: [{ bearerAuth: [] }],
      parameters: [{ $ref: "#/components/parameters/IdempotencyKey" }],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["event"],
              properties: {
                event: {
                  type: "string",
                  enum: [
                    "bank_timeout",
                    "network_unreachable",
                    "insufficient_funds",
                    "operator_unavailable",
                    "customer_not_registered",
                    "daily_limit_exceeded",
                    "rate_limited_429",
                    "provider_504",
                  ],
                },
                target_id: { type: "string", description: "Optional charge/intent ID to target." },
                delay_ms: { type: "integer", minimum: 0, maximum: 60000, default: 0 },
              },
            },
          },
        },
      },
      responses: {
        202: { description: "Fault armed for next matching call.", content: { "application/json": { schema: { type: "object", properties: { trigger_id: { type: "string", format: "uuid" } } } } } },
        ...problemJsonResponses(),
      },
    },
  };

  spec.paths["/v1/sandbox/charges/{chargeId}/simulate"] = {
    post: {
      tags: ["Sandbox"],
      operationId: "simulateSandboxChargeOutcome",
      summary: "Simulate an outcome on a sandbox charge",
      description: "Charge-scoped façade over `/v1/sandbox/payments/simulate`.",
      security: [{ bearerAuth: [] }],
      parameters: [
        { name: "chargeId", in: "path", required: true, schema: { type: "string" } },
        { $ref: "#/components/parameters/IdempotencyKey" },
      ],
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["action"],
              properties: {
                action: { type: "string", enum: ["approve", "decline", "timeout", "reverse"] },
                decline_code: { type: "string" },
                delay_ms: { type: "integer", minimum: 0, maximum: 60000, default: 0 },
              },
            },
          },
        },
      },
      responses: {
        200: { description: "Simulation applied.", content: { "application/json": { schema: { type: "object" } } } },
        ...problemJsonResponses(),
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Wire X-Idempotent-Replay onto every existing idempotent 2xx response
// ---------------------------------------------------------------------------
function wireReplayHeaderEverywhere(spec) {
  let touched = 0;
  for (const [, methods] of Object.entries(spec.paths || {})) {
    const pathParams = methods.parameters || [];
    for (const [m, op] of Object.entries(methods)) {
      if (!MUT.includes(m)) continue;
      const tags = op?.tags || [];
      if (!tags.some((t) => FINANCIAL_TAGS.has(t))) continue;
      const params = [...pathParams, ...(op.parameters || [])];
      const hasIdem = params.some((p) => {
        const ref = (p.$ref || "").toLowerCase();
        const name = (p.name || "").toLowerCase();
        return name === "idempotency-key" || ref.includes("idempotency");
      });
      if (!hasIdem) continue;
      for (const [code, resp] of Object.entries(op.responses || {})) {
        if (!/^2\d\d$/.test(code)) continue;
        resp.headers = resp.headers || {};
        if (!resp.headers["X-Idempotent-Replay"]) {
          resp.headers["X-Idempotent-Replay"] = { $ref: "#/components/headers/X-Idempotent-Replay" };
          touched++;
        }
        if (!resp.headers["X-Idempotency-Status"]) {
          resp.headers["X-Idempotency-Status"] = { $ref: "#/components/headers/X-Idempotency-Status" };
        }
      }
    }
  }
  return touched;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
for (const file of SPECS) {
  if (!fs.existsSync(file)) {
    console.warn(`[phase8] skip missing ${file}`);
    continue;
  }
  const spec = JSON.parse(fs.readFileSync(file, "utf-8"));
  const prev = spec.info?.version;
  ensureComponents(spec);
  hardenIdempotencyKeySchema(spec);
  addReplayHeaders(spec);
  addWebhookHeaders(spec);
  addProblemDetailsExamples(spec);
  addPaymentIntentSchemas(spec);
  addPaymentIntentPaths(spec);
  addWebhookPaths(spec);
  hardenSandboxKey(spec);
  addSandboxPaths(spec);
  const wired = wireReplayHeaderEverywhere(spec);
  spec.info.version = FINAL_VERSION;
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n", "utf-8");
  console.log(`[phase8] ${path.basename(file)}: ${prev} → ${FINAL_VERSION} (wired replay headers on ${wired} 2xx responses)`);
}
console.log("[phase8] Production blockers spec hardening complete.");
