#!/usr/bin/env node
/**
 * Phase 10.3 — Agent banking (additive spec changes).
 *
 * Adds /v1/agents/* operations + Agent / AgentFloat / AgentCashTransaction schemas.
 *
 * Standing Orders compliance:
 *   #1 LOCK     : no renames/removals.
 *   #2 RATCHET  : pure addition.
 *   #3 AUDIT    : cites BIS Agent Banking Guidelines (2018), Mojaloop v1.1 PartyIdType,
 *                 GSMA Agent Network Management Toolkit v2, RFC 7807, BCP 47.
 *   #4 SURGEON  : additive.
 *   #5 DEAD CODE: every schema referenced by a path.
 *   #6 VERSION  : minor bump 4.45.0 -> 4.46.0.
 */
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SPECS = [
  path.join(ROOT, "public/openapi.json"),
  path.join(ROOT, "public/openapi-sandbox.json"),
];
const FINAL_VERSION = "4.46.0";

function ensure(spec) {
  spec.components = spec.components || {};
  spec.components.schemas = spec.components.schemas || {};
  spec.paths = spec.paths || {};
  spec.tags = spec.tags || [];
}

function addAgentsTag(spec) {
  if (!spec.tags.find((t) => t.name === "Agents")) {
    spec.tags.push({
      name: "Agents",
      description:
        "Agent (cash-in/out) banking. CEMAC-wide registry, float management, customer cash transactions. See BIS Agent Banking Guidelines (2018) and Mojaloop v1.1.",
    });
  }
}

function addSchemas(spec) {
  Object.assign(spec.components.schemas, {
    Agent: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        agent_code: { type: "string", example: "AG3K7M2P" },
        business_name: { type: "string", example: "Mama Africa Mobile Money" },
        legal_name: { type: "string", nullable: true },
        msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$", example: "+237671234567" },
        email: { type: "string", format: "email", nullable: true },
        country_code: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"], example: "CM" },
        region: { type: "string", nullable: true, example: "Centre" },
        city: { type: "string", nullable: true, example: "Yaoundé" },
        address: { type: "string", nullable: true },
        latitude: { type: "number", format: "double", nullable: true, example: 3.848 },
        longitude: { type: "number", format: "double", nullable: true, example: 11.502 },
        status: { type: "string", enum: ["pending", "active", "suspended", "terminated"] },
        tier: { type: "string", enum: ["standard", "premium", "master"] },
        commission_rate: { type: "number", format: "double", example: 0.01 },
        created_at: { type: "string", format: "date-time" },
      },
      required: ["agent_code", "business_name", "msisdn", "country_code", "status", "tier"],
    },
    AgentRegisterRequest: {
      type: "object",
      properties: {
        business_name: { type: "string", minLength: 2, maxLength: 200 },
        legal_name: { type: "string", maxLength: 200 },
        msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$" },
        email: { type: "string", format: "email" },
        country_code: { type: "string", enum: ["CM", "GA", "CG", "TD", "CF", "GQ"] },
        region: { type: "string" },
        city: { type: "string" },
        address: { type: "string" },
        latitude: { type: "number" },
        longitude: { type: "number" },
        tier: { type: "string", enum: ["standard", "premium", "master"] },
      },
      required: ["business_name", "msisdn"],
    },
    AgentFloat: {
      type: "object",
      properties: {
        currency: { type: "string", enum: ["XAF", "XOF", "EUR", "USD"] },
        float_balance: { type: "number", format: "double", example: 250000 },
        cash_balance: { type: "number", format: "double", example: 75000 },
        low_threshold: { type: "number", format: "double", example: 50000 },
        last_topup_at: { type: "string", format: "date-time", nullable: true },
      },
      required: ["currency", "float_balance", "cash_balance"],
    },
    AgentFloatMutationRequest: {
      type: "object",
      properties: {
        amount: { type: "number", format: "double", minimum: 1 },
        currency: { type: "string", enum: ["XAF", "XOF", "EUR", "USD"], default: "XAF" },
      },
      required: ["amount"],
    },
    AgentCashTransaction: {
      type: "object",
      properties: {
        id: { type: "string", format: "uuid" },
        agent_id: { type: "string", format: "uuid" },
        customer_msisdn: { type: "string", nullable: true },
        customer_user_id: { type: "string", format: "uuid", nullable: true },
        tx_type: {
          type: "string",
          enum: ["cash_in", "cash_out", "float_topup", "float_withdraw", "commission"],
        },
        amount: { type: "number", format: "double" },
        currency: { type: "string" },
        commission_amount: { type: "number", format: "double" },
        status: { type: "string", enum: ["pending", "completed", "failed", "reversed"] },
        idempotency_key: { type: "string", format: "uuid" },
        created_at: { type: "string", format: "date-time" },
        completed_at: { type: "string", format: "date-time", nullable: true },
      },
      required: ["id", "agent_id", "tx_type", "amount", "currency", "status", "idempotency_key"],
    },
    AgentCashRequest: {
      type: "object",
      properties: {
        amount: { type: "number", format: "double", minimum: 1 },
        currency: { type: "string", enum: ["XAF", "XOF"], default: "XAF" },
        customer_msisdn: { type: "string", pattern: "^\\+?[0-9]{8,15}$" },
        customer_user_id: { type: "string", format: "uuid" },
        reference: { type: "string", maxLength: 64 },
      },
      required: ["amount"],
    },
  });
}

const acceptLanguageParam = {
  name: "Accept-Language",
  in: "header",
  required: false,
  schema: { type: "string", example: "fr" },
};
const idempotencyKeyParam = {
  name: "Idempotency-Key",
  in: "header",
  required: true,
  schema: { type: "string", format: "uuid" },
  description: "UUIDv4. Replays with the same key return the original transaction.",
};

function addPaths(spec) {
  spec.paths["/v1/agents"] = {
    get: {
      tags: ["Agents"],
      summary: "Discover agents (geo + region filter)",
      operationId: "agentList",
      parameters: [
        { name: "country_code", in: "query", schema: { type: "string", enum: ["CM","GA","CG","TD","CF","GQ"] } },
        { name: "region", in: "query", schema: { type: "string" } },
        { name: "status", in: "query", schema: { type: "string", enum: ["active","pending","suspended","terminated"], default: "active" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        acceptLanguageParam,
      ],
      responses: {
        "200": {
          description: "Agent list",
          content: { "application/json": { schema: { type: "object", properties: { data: { type: "array", items: { $ref: "#/components/schemas/Agent" } }, count: { type: "integer" } } } } },
        },
      },
    },
    post: {
      tags: ["Agents"],
      summary: "Register a new agent",
      operationId: "agentRegister",
      parameters: [acceptLanguageParam],
      requestBody: {
        required: true,
        content: { "application/json": { schema: { $ref: "#/components/schemas/AgentRegisterRequest" } } },
      },
      responses: {
        "201": { description: "Created", content: { "application/json": { schema: { $ref: "#/components/schemas/Agent" } } } },
        "400": { description: "Validation error" },
      },
    },
  };
  spec.paths["/v1/agents/{agentId}"] = {
    get: {
      tags: ["Agents"],
      summary: "Read agent (including float balances)",
      operationId: "agentGet",
      parameters: [
        { name: "agentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        acceptLanguageParam,
      ],
      responses: {
        "200": {
          description: "Agent with embedded floats",
          content: {
            "application/json": {
              schema: {
                allOf: [
                  { $ref: "#/components/schemas/Agent" },
                  { type: "object", properties: { agent_floats: { type: "array", items: { $ref: "#/components/schemas/AgentFloat" } } } },
                ],
              },
            },
          },
        },
        "404": { description: "Not found" },
      },
    },
  };
  const floatOp = (action) => ({
    tags: ["Agents"],
    summary: action === "topup" ? "Top up agent float" : "Withdraw from agent float",
    operationId: action === "topup" ? "agentFloatTopup" : "agentFloatWithdraw",
    parameters: [
      { name: "agentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      idempotencyKeyParam,
      acceptLanguageParam,
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/AgentFloatMutationRequest" } } },
    },
    responses: {
      "201": { description: "Transaction recorded", content: { "application/json": { schema: { $ref: "#/components/schemas/AgentCashTransaction" } } } },
      "200": { description: "Idempotent replay" },
      "409": { description: "Insufficient float" },
    },
  });
  spec.paths["/v1/agents/{agentId}/float/topup"] = { post: floatOp("topup") };
  spec.paths["/v1/agents/{agentId}/float/withdraw"] = { post: floatOp("withdraw") };

  const cashOp = (kind) => ({
    tags: ["Agents"],
    summary: kind === "cash-in" ? "Customer deposits cash with agent" : "Customer withdraws cash from agent",
    operationId: kind === "cash-in" ? "agentCashIn" : "agentCashOut",
    parameters: [
      { name: "agentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
      idempotencyKeyParam,
      acceptLanguageParam,
    ],
    requestBody: {
      required: true,
      content: { "application/json": { schema: { $ref: "#/components/schemas/AgentCashRequest" } } },
    },
    responses: {
      "201": {
        description: "Transaction recorded",
        headers: {
          "X-Float-Warning": {
            description: "Set to 'low_float' when the agent's float balance falls below low_threshold.",
            schema: { type: "string", enum: ["low_float"] },
          },
        },
        content: { "application/json": { schema: { $ref: "#/components/schemas/AgentCashTransaction" } } },
      },
      "200": { description: "Idempotent replay" },
      "409": { description: "Insufficient float or cash" },
    },
  });
  spec.paths["/v1/agents/{agentId}/cash-in"] = { post: cashOp("cash-in") };
  spec.paths["/v1/agents/{agentId}/cash-out"] = { post: cashOp("cash-out") };

  spec.paths["/v1/agents/{agentId}/transactions"] = {
    get: {
      tags: ["Agents"],
      summary: "List agent cash transactions",
      operationId: "agentTransactionList",
      parameters: [
        { name: "agentId", in: "path", required: true, schema: { type: "string", format: "uuid" } },
        { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 200, default: 50 } },
        acceptLanguageParam,
      ],
      responses: {
        "200": {
          description: "Transaction list",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  data: { type: "array", items: { $ref: "#/components/schemas/AgentCashTransaction" } },
                  count: { type: "integer" },
                },
              },
            },
          },
        },
      },
    },
  };
}

for (const specPath of SPECS) {
  if (!fs.existsSync(specPath)) continue;
  const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));
  ensure(spec);
  addAgentsTag(spec);
  addSchemas(spec);
  addPaths(spec);
  spec.info.version = FINAL_VERSION;
  fs.writeFileSync(specPath, JSON.stringify(spec, null, 2) + "\n");
  console.log(`updated ${path.relative(ROOT, specPath)} -> v${FINAL_VERSION}`);
}
console.log("done.");
