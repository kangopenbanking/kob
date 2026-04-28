// JSON Schemas for each documented webhook event type.
// Mirrors the OpenAPI components.schemas used in /v1/webhooks/* event payloads.
// Lightweight (no AJV) — used both at runtime by the verifier UI and by tests.
//
// Adding a new event:
//   1) Add an entry to WEBHOOK_EVENT_SCHEMAS keyed by the event type.
//   2) Add the same shape to public/openapi.json under components.schemas.
//   3) src/test/webhook-event-schemas.test.ts will assert the contract.

export type JsonSchema = {
  type?: "object" | "string" | "number" | "integer" | "boolean" | "array";
  properties?: Record<string, JsonSchema>;
  required?: string[];
  enum?: readonly (string | number)[];
  pattern?: string;
  items?: JsonSchema;
  additionalProperties?: boolean;
  format?: string;
};

const ENVELOPE: Record<string, JsonSchema> = {
  id: { type: "string", pattern: "^evt_[a-zA-Z0-9_]+$" },
  type: { type: "string" },
  created: { type: "integer" },
  data: { type: "object" },
};

function envelope(eventType: string, dataSchema: JsonSchema): JsonSchema {
  return {
    type: "object",
    required: ["id", "type", "created", "data"],
    properties: {
      ...ENVELOPE,
      type: { type: "string", enum: [eventType] },
      data: dataSchema,
    },
  };
}

const MONEY_AMOUNT: JsonSchema = { type: "string", pattern: "^[0-9]{1,15}$" };
const CURRENCY: JsonSchema = { type: "string", enum: ["XAF", "XOF", "USD", "EUR", "GBP", "NGN"] };

export const WEBHOOK_EVENT_SCHEMAS: Record<string, JsonSchema> = {
  "charge.succeeded": envelope("charge.succeeded", {
    type: "object",
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: ["id", "amount", "currency", "status"],
        properties: {
          id: { type: "string", pattern: "^chg_[a-zA-Z0-9_]+$" },
          amount: MONEY_AMOUNT,
          currency: CURRENCY,
          status: { type: "string", enum: ["succeeded"] },
          merchant_id: { type: "string" },
        },
      },
    },
  }),
  "charge.failed": envelope("charge.failed", {
    type: "object",
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: ["id", "amount", "currency", "status", "failure_reason"],
        properties: {
          id: { type: "string", pattern: "^chg_[a-zA-Z0-9_]+$" },
          amount: MONEY_AMOUNT,
          currency: CURRENCY,
          status: { type: "string", enum: ["failed"] },
          failure_reason: { type: "string" },
        },
      },
    },
  }),
  "payout.completed": envelope("payout.completed", {
    type: "object",
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: ["id", "amount", "currency", "status"],
        properties: {
          id: { type: "string", pattern: "^po_[a-zA-Z0-9_]+$" },
          amount: MONEY_AMOUNT,
          currency: CURRENCY,
          status: { type: "string", enum: ["completed"] },
          destination: { type: "string" },
        },
      },
    },
  }),
  "refund.processed": envelope("refund.processed", {
    type: "object",
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: ["id", "charge_id", "amount", "currency", "status"],
        properties: {
          id: { type: "string", pattern: "^re_[a-zA-Z0-9_]+$" },
          charge_id: { type: "string", pattern: "^chg_[a-zA-Z0-9_]+$" },
          amount: MONEY_AMOUNT,
          currency: CURRENCY,
          status: { type: "string", enum: ["succeeded", "pending", "failed"] },
        },
      },
    },
  }),
  "transfer.completed": envelope("transfer.completed", {
    type: "object",
    required: ["object"],
    properties: {
      object: {
        type: "object",
        required: ["id", "amount", "currency", "status"],
        properties: {
          id: { type: "string", pattern: "^tr_[a-zA-Z0-9_]+$" },
          amount: MONEY_AMOUNT,
          currency: CURRENCY,
          status: { type: "string", enum: ["completed"] },
        },
      },
    },
  }),
};

export interface ValidationError {
  path: string;
  message: string;
}

/** Tiny, dependency-free JSON Schema validator. Sufficient for our schema subset. */
export function validateAgainstSchema(value: unknown, schema: JsonSchema, path = "$"): ValidationError[] {
  const errs: ValidationError[] = [];
  const t = schema.type;

  if (t === "object") {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      errs.push({ path, message: `expected object` });
      return errs;
    }
    const obj = value as Record<string, unknown>;
    for (const req of schema.required ?? []) {
      if (!(req in obj)) errs.push({ path: `${path}.${req}`, message: "missing required field" });
    }
    for (const [k, sub] of Object.entries(schema.properties ?? {})) {
      if (k in obj) errs.push(...validateAgainstSchema(obj[k], sub, `${path}.${k}`));
    }
    return errs;
  }
  if (t === "array") {
    if (!Array.isArray(value)) {
      errs.push({ path, message: "expected array" });
      return errs;
    }
    if (schema.items) value.forEach((v, i) => errs.push(...validateAgainstSchema(v, schema.items!, `${path}[${i}]`)));
    return errs;
  }
  if (t === "string") {
    if (typeof value !== "string") errs.push({ path, message: "expected string" });
    else {
      if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
        errs.push({ path, message: `does not match pattern ${schema.pattern}` });
      }
      if (schema.enum && !schema.enum.includes(value)) {
        errs.push({ path, message: `must be one of ${schema.enum.join(", ")}` });
      }
    }
    return errs;
  }
  if (t === "integer" || t === "number") {
    if (typeof value !== "number" || (t === "integer" && !Number.isInteger(value))) {
      errs.push({ path, message: `expected ${t}` });
    }
    return errs;
  }
  if (t === "boolean") {
    if (typeof value !== "boolean") errs.push({ path, message: "expected boolean" });
    return errs;
  }
  return errs;
}

export function validateWebhookEvent(payload: unknown): { ok: boolean; errors: ValidationError[]; event_type?: string } {
  if (typeof payload !== "object" || payload === null) {
    return { ok: false, errors: [{ path: "$", message: "payload must be a JSON object" }] };
  }
  const eventType = (payload as { type?: unknown }).type;
  if (typeof eventType !== "string") {
    return { ok: false, errors: [{ path: "$.type", message: "missing or non-string event type" }] };
  }
  const schema = WEBHOOK_EVENT_SCHEMAS[eventType];
  if (!schema) {
    return {
      ok: false,
      event_type: eventType,
      errors: [{ path: "$.type", message: `unknown event type "${eventType}". Known: ${Object.keys(WEBHOOK_EVENT_SCHEMAS).join(", ")}` }],
    };
  }
  const errors = validateAgainstSchema(payload, schema);
  return { ok: errors.length === 0, errors, event_type: eventType };
}
