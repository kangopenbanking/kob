#!/usr/bin/env node
/**
 * Recovery script — lands the minimum spec surface for phases 10.2
 * (USSD), 10.4 (QR + offline) and 10.5 (CEMAC remittance) that the
 * ratchet test `openapi-phase10-modules-ratchet.test.ts` guards with
 * conditional `it.skip` blocks. Running this converts the five skipped
 * assertions into enforced contract checks.
 *
 * Standing Orders:
 *   #1 LOCK     — no renames/removals, additive only.
 *   #2 RATCHET  — required[] / paths only grow.
 *   #3 AUDIT    — cites ETSI TS 102 226 (USSD), EMVCo QR Spec v1.1,
 *                 BEAC Règlement N°02/CEMAC, RFC 7807, BCP 47.
 *   #4 SURGEON  — pure addition.
 *   #5 DEAD CODE — every schema referenced by an operation below.
 *   #6 VERSION  — additive recovery of previously-announced surface;
 *                 leaves info.version unchanged at the SSOT value.
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];

const TAGS = [
  { name: "USSD", description: "Session-based USSD menu engine for feature-phone banking. ETSI TS 102 226." },
  { name: "QR & Offline", description: "EMVCo-compliant QR + signed offline-payment tokens. EMVCo QR Spec v1.1." },
  { name: "CEMAC Remittance", description: "Cross-border XAF/XAF remittance inside the six BEAC-zone countries. BEAC Règlement N°02/CEMAC." },
];

const SCHEMAS = {
  // ---------- USSD ----------
  UssdSession: {
    type: "object",
    required: ["id", "msisdn", "session_id", "state", "created_at"],
    properties: {
      id: { type: "string", format: "uuid" },
      session_id: { type: "string", example: "USSD-3f9d2c" },
      msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$", example: "+237671234567" },
      service_code: { type: "string", example: "*144#" },
      state: { type: "string", enum: ["active", "ended", "expired"] },
      menu: { type: "string", example: "1. Send Money\n2. Buy Airtime\n3. Balance" },
      input: { type: "string", nullable: true },
      language: { type: "string", enum: ["en", "fr"], example: "fr" },
      created_at: { type: "string", format: "date-time" },
      ended_at: { type: "string", format: "date-time", nullable: true },
    },
  },
  UssdSessionRequest: {
    type: "object",
    required: ["session_id", "msisdn", "service_code"],
    properties: {
      session_id: { type: "string" },
      msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$" },
      service_code: { type: "string" },
      input: { type: "string", nullable: true },
      language: { type: "string", enum: ["en", "fr"], default: "fr" },
    },
  },

  // ---------- QR + Offline ----------
  QrCode: {
    type: "object",
    required: ["id", "payload", "amount", "currency", "merchant_id", "status", "created_at"],
    properties: {
      id: { type: "string", format: "uuid" },
      payload: { type: "string", description: "EMVCo-compliant TLV payload (base64)." },
      amount: { type: "string", pattern: "^[0-9]{1,15}$", example: "5000" },
      currency: { type: "string", enum: ["XAF", "XOF"], example: "XAF" },
      merchant_id: { type: "string", format: "uuid" },
      status: { type: "string", enum: ["active", "consumed", "expired", "revoked"] },
      expires_at: { type: "string", format: "date-time", nullable: true },
      created_at: { type: "string", format: "date-time" },
    },
  },
  OfflineToken: {
    type: "object",
    required: ["token_id", "payer_id", "amount", "currency", "issued_at", "expires_at", "signature"],
    properties: {
      token_id: { type: "string", format: "uuid" },
      payer_id: { type: "string", format: "uuid" },
      payee_id: { type: "string", format: "uuid", nullable: true },
      amount: { type: "string", pattern: "^[0-9]{1,15}$" },
      currency: { type: "string", enum: ["XAF", "XOF"] },
      issued_at: { type: "string", format: "date-time" },
      expires_at: { type: "string", format: "date-time" },
      signature: { type: "string", description: "Ed25519 detached signature (base64url)." },
      redeemed_at: { type: "string", format: "date-time", nullable: true },
    },
  },
  OfflineTokenIssueRequest: {
    type: "object",
    required: ["payer_id", "amount", "currency"],
    properties: {
      payer_id: { type: "string", format: "uuid" },
      payee_id: { type: "string", format: "uuid", nullable: true },
      amount: { type: "string", pattern: "^[0-9]{1,15}$" },
      currency: { type: "string", enum: ["XAF", "XOF"] },
      ttl_seconds: { type: "integer", minimum: 60, maximum: 86_400, default: 3600 },
    },
  },
  OfflineTokenRedeemRequest: {
    type: "object",
    required: ["token_id", "signature"],
    properties: {
      token_id: { type: "string", format: "uuid" },
      signature: { type: "string" },
      payee_id: { type: "string", format: "uuid" },
    },
  },

  // ---------- CEMAC remittance ----------
  CemacCorridor: {
    type: "object",
    required: ["origin_country", "destination_country", "fee_bps", "fx_rate", "status"],
    properties: {
      origin_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      destination_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      fee_bps: { type: "integer", minimum: 0, maximum: 1000, example: 100 },
      fx_rate: { type: "number", format: "double", example: 1.0 },
      status: { type: "string", enum: ["active", "suspended"] },
    },
  },
  CemacRemittanceQuoteRequest: {
    type: "object",
    required: ["origin_country", "destination_country", "amount"],
    properties: {
      origin_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      destination_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      amount: { type: "string", pattern: "^[0-9]{1,15}$", example: "50000" },
    },
  },
  CemacRemittanceQuote: {
    type: "object",
    required: ["amount", "fee", "net", "receive_amount", "fx_rate", "currency"],
    properties: {
      amount: { type: "string", pattern: "^[0-9]{1,15}$" },
      fee: { type: "string", pattern: "^[0-9]{1,15}$" },
      net: { type: "string", pattern: "^[0-9]{1,15}$" },
      receive_amount: { type: "string", pattern: "^[0-9]{1,15}$" },
      fx_rate: { type: "number", format: "double" },
      currency: { type: "string", enum: ["XAF"] },
      quote_id: { type: "string", format: "uuid" },
      expires_at: { type: "string", format: "date-time" },
    },
  },
  CemacRemittanceTransferRequest: {
    type: "object",
    required: ["quote_id", "sender", "recipient"],
    properties: {
      quote_id: { type: "string", format: "uuid" },
      sender: {
        type: "object",
        required: ["full_name", "msisdn", "country"],
        properties: {
          full_name: { type: "string" },
          msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$" },
          country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
        },
      },
      recipient: {
        type: "object",
        required: ["full_name", "msisdn", "country"],
        properties: {
          full_name: { type: "string" },
          msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$" },
          country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
        },
      },
      reference: { type: "string", maxLength: 140, nullable: true },
    },
  },
  CemacRemittanceTransfer: {
    type: "object",
    required: ["id", "status", "amount", "fee", "net", "origin_country", "destination_country", "created_at"],
    properties: {
      id: { type: "string", format: "uuid" },
      status: { type: "string", enum: ["pending", "funded", "settled", "cancelled", "failed"] },
      amount: { type: "string", pattern: "^[0-9]{1,15}$" },
      fee: { type: "string", pattern: "^[0-9]{1,15}$" },
      net: { type: "string", pattern: "^[0-9]{1,15}$" },
      origin_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      destination_country: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
      reference: { type: "string", nullable: true },
      created_at: { type: "string", format: "date-time" },
      settled_at: { type: "string", format: "date-time", nullable: true },
    },
  },
};

const IDEMPOTENCY_HEADER = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string", format: "uuid" },
  description: "RFC-compliant UUID v4 for safe retry.",
};
const ACCEPT_LANG = {
  name: "Accept-Language",
  in: "header",
  required: false,
  schema: { type: "string", default: "en" },
  description: "BCP 47 language tag (en, fr).",
};

const PROBLEM_RESPONSE = {
  description: "Problem details (RFC 7807).",
  content: { "application/problem+json": { schema: { $ref: "#/components/schemas/ProblemDetails" } } },
};

const PATHS = {
  // ---------- USSD ----------
  "/v1/ussd/sessions": {
    post: {
      tags: ["USSD"],
      summary: "Open or advance a USSD session.",
      operationId: "ussdSessionAdvance",
      parameters: [ACCEPT_LANG],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/UssdSessionRequest" } } },
      },
      responses: {
        "200": {
          description: "Session menu returned.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/UssdSession" } } },
        },
        "400": PROBLEM_RESPONSE,
        "429": PROBLEM_RESPONSE,
      },
    },
  },

  // ---------- QR + offline ----------
  "/v1/gateway/qr": {
    post: {
      tags: ["QR & Offline"],
      summary: "Create a merchant QR code.",
      operationId: "qrCreate",
      requestBody: {
        required: true,
        content: {
          "application/json": {
            schema: {
              type: "object",
              required: ["amount", "currency", "merchant_id"],
              properties: {
                amount: { type: "string", pattern: "^[0-9]{1,15}$" },
                currency: { type: "string", enum: ["XAF", "XOF"] },
                merchant_id: { type: "string", format: "uuid" },
                ttl_seconds: { type: "integer", minimum: 60, maximum: 86_400 },
              },
            },
          },
        },
      },
      responses: {
        "201": {
          description: "QR code created.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/QrCode" } } },
        },
        "400": PROBLEM_RESPONSE,
      },
    },
  },
  "/v1/gateway/qr/offline/issue": {
    post: {
      tags: ["QR & Offline"],
      summary: "Issue a signed offline payment token.",
      operationId: "qrOfflineIssue",
      parameters: [IDEMPOTENCY_HEADER],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/OfflineTokenIssueRequest" } } },
      },
      responses: {
        "201": {
          description: "Offline token issued.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/OfflineToken" } } },
        },
        "400": PROBLEM_RESPONSE,
        "409": PROBLEM_RESPONSE,
      },
    },
  },
  "/v1/gateway/qr/offline/redeem": {
    post: {
      tags: ["QR & Offline"],
      summary: "Redeem a signed offline payment token.",
      operationId: "qrOfflineRedeem",
      parameters: [IDEMPOTENCY_HEADER],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/OfflineTokenRedeemRequest" } } },
      },
      responses: {
        "200": {
          description: "Token redeemed.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/OfflineToken" } } },
        },
        "400": PROBLEM_RESPONSE,
        "409": PROBLEM_RESPONSE,
        "410": PROBLEM_RESPONSE,
      },
    },
  },

  // ---------- CEMAC remittance ----------
  "/v1/remittance/cemac/corridors": {
    get: {
      tags: ["CEMAC Remittance"],
      summary: "List active CEMAC remittance corridors.",
      operationId: "cemacCorridorsList",
      responses: {
        "200": {
          description: "Corridor list.",
          content: {
            "application/json": {
              schema: { type: "array", items: { $ref: "#/components/schemas/CemacCorridor" } },
            },
          },
        },
      },
    },
  },
  "/v1/remittance/cemac/quote": {
    post: {
      tags: ["CEMAC Remittance"],
      summary: "Get a CEMAC remittance quote.",
      operationId: "cemacRemittanceQuote",
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceQuoteRequest" } } },
      },
      responses: {
        "200": {
          description: "Quote computed.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceQuote" } } },
        },
        "400": PROBLEM_RESPONSE,
      },
    },
  },
  "/v1/remittance/cemac/transfers": {
    post: {
      tags: ["CEMAC Remittance"],
      summary: "Create a CEMAC remittance transfer.",
      operationId: "cemacRemittanceCreate",
      parameters: [IDEMPOTENCY_HEADER, ACCEPT_LANG],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceTransferRequest" } } },
      },
      responses: {
        "201": {
          description: "Transfer accepted.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceTransfer" } } },
        },
        "400": PROBLEM_RESPONSE,
        "409": PROBLEM_RESPONSE,
      },
    },
  },
  "/v1/remittance/cemac/transfers/{id}": {
    get: {
      tags: ["CEMAC Remittance"],
      summary: "Retrieve a CEMAC remittance transfer.",
      operationId: "cemacRemittanceGet",
      parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
      responses: {
        "200": {
          description: "Transfer detail.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceTransfer" } } },
        },
        "404": PROBLEM_RESPONSE,
      },
    },
  },
  "/v1/remittance/cemac/transfers/{id}/cancel": {
    post: {
      tags: ["CEMAC Remittance"],
      summary: "Cancel a pending or funded CEMAC remittance transfer.",
      operationId: "cemacRemittanceCancel",
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        IDEMPOTENCY_HEADER,
      ],
      responses: {
        "200": {
          description: "Transfer cancelled.",
          content: { "application/json": { schema: { $ref: "#/components/schemas/CemacRemittanceTransfer" } } },
        },
        "404": PROBLEM_RESPONSE,
        "409": PROBLEM_RESPONSE,
      },
    },
  },
};

function ensure(spec) {
  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.paths = spec.paths || {};
  spec.tags = spec.tags || [];
  // Guarantee shared ProblemDetails schema referenced above.
  if (!spec.components.schemas.ProblemDetails) {
    spec.components.schemas.ProblemDetails = {
      type: "object",
      required: ["type", "title", "status"],
      properties: {
        type: { type: "string", format: "uri", example: "https://errors.kangopenbanking.com/validation" },
        title: { type: "string" },
        status: { type: "integer" },
        detail: { type: "string" },
        instance: { type: "string" },
      },
    };
  }
}

function mergeTags(spec) {
  for (const tag of TAGS) {
    if (!spec.tags.find((t) => t.name === tag.name)) spec.tags.push(tag);
  }
}

function mergeSchemas(spec) {
  for (const [name, schema] of Object.entries(SCHEMAS)) {
    if (!spec.components.schemas[name]) {
      spec.components.schemas[name] = schema;
    }
  }
}

function mergePaths(spec) {
  for (const [route, methods] of Object.entries(PATHS)) {
    spec.paths[route] = { ...(spec.paths[route] || {}), ...methods };
  }
}

function writeYamlMirror(jsonPath) {
  const yamlPath = jsonPath.replace(/\.json$/, ".yaml");
  if (!fs.existsSync(yamlPath)) return;
  const spec = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
  fs.writeFileSync(yamlPath, yaml.dump(spec, { lineWidth: 120, noRefs: true }));
}

let touched = 0;
for (const file of SPECS) {
  if (!fs.existsSync(file)) continue;
  const spec = JSON.parse(fs.readFileSync(file, "utf8"));
  ensure(spec);
  mergeTags(spec);
  mergeSchemas(spec);
  mergePaths(spec);
  fs.writeFileSync(file, JSON.stringify(spec, null, 2) + "\n");
  writeYamlMirror(file);
  touched++;
  console.log(`  ✓ ${path.relative(ROOT, file)} — paths=${Object.keys(spec.paths).length} schemas=${Object.keys(spec.components.schemas).length}`);
}

if (!touched) {
  console.error("No spec files found.");
  process.exit(1);
}
console.log("Phase 10 recovery surface landed.");
