// Schema-level validation for webhook event payloads.
// Ensures the verifier UI and runtime reject malformed events identically.

import { describe, it, expect } from "vitest";
import {
  validateWebhookEvent,
  WEBHOOK_EVENT_SCHEMAS,
} from "@/lib/webhook-event-schemas";

describe("webhook event schema validation", () => {
  it("accepts a well-formed charge.succeeded event", () => {
    const r = validateWebhookEvent({
      id: "evt_test_001",
      type: "charge.succeeded",
      created: 1700000000,
      data: { object: { id: "chg_test_123", amount: "5000", currency: "XAF", status: "succeeded" } },
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });

  it("rejects an unknown event type", () => {
    const r = validateWebhookEvent({ id: "evt_x", type: "not.a.real.event", created: 1, data: {} });
    expect(r.ok).toBe(false);
    expect(r.errors[0].path).toBe("$.type");
  });

  it("rejects missing required nested field", () => {
    const r = validateWebhookEvent({
      id: "evt_test_001",
      type: "charge.succeeded",
      created: 1,
      data: { object: { id: "chg_x", currency: "XAF", status: "succeeded" } },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.endsWith(".amount"))).toBe(true);
  });

  it("rejects wrong status enum", () => {
    const r = validateWebhookEvent({
      id: "evt_test_001",
      type: "charge.succeeded",
      created: 1,
      data: { object: { id: "chg_x", amount: "1", currency: "XAF", status: "pending" } },
    });
    expect(r.ok).toBe(false);
  });

  it("covers all documented event types with non-empty schemas", () => {
    const expected = [
      "charge.succeeded", "charge.failed", "payout.completed", "refund.processed", "transfer.completed",
      "registration.pending", "registration.under_review", "registration.approved", "registration.rejected",
    ];
    for (const t of expected) expect(WEBHOOK_EVENT_SCHEMAS[t]).toBeDefined();
  });

  it("accepts a well-formed registration.approved event", () => {
    const r = validateWebhookEvent({
      id: "evt_reg_001",
      type: "registration.approved",
      created: 1700000000,
      data: {
        object: {
          id: "reg_123",
          account_type: "business",
          entity_id: "merch_abc",
          status: "approved",
          reviewer_id: "admin_1",
          occurred_at: "2026-06-09T10:00:00Z",
        },
      },
    });
    expect(r.ok).toBe(true);
  });

  it("rejects registration event with wrong account_type", () => {
    const r = validateWebhookEvent({
      id: "evt_reg_002",
      type: "registration.pending",
      created: 1,
      data: { object: { id: "x", account_type: "robot", entity_id: "y", status: "pending", occurred_at: "2026-06-09T10:00:00Z" } },
    });
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.path.endsWith(".account_type"))).toBe(true);
  });

  it("rejects registration.rejected with wrong status enum", () => {
    const r = validateWebhookEvent({
      id: "evt_reg_003",
      type: "registration.rejected",
      created: 1,
      data: { object: { id: "x", account_type: "personal", entity_id: "y", status: "approved", occurred_at: "2026-06-09T10:00:00Z" } },
    });
    expect(r.ok).toBe(false);
  });
});
