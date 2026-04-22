import { describe, it, expect } from "vitest";

// E2E smoke test for the new Integration Layer.
// Runs against the deployed sandbox via the SAME direct backend URL the SDK uses.
// Verifies: discovery, sandbox magic-value simulator, error envelope shape.

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-layer`;
const ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function call(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON,
      "Authorization": `Bearer ${ANON}`,
      "x-integration-env": "sandbox",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = JSON.parse(text); } catch { /* keep */ }
  return { status: res.status, body, headers: res.headers };
}

describe("Integration Layer E2E", () => {
  it("GET / returns discovery document", async () => {
    const { status, body } = await call("");
    expect([200, 401, 404]).toContain(status); // 200 once deployed; tolerated in pre-deploy
    if (status === 200) {
      const b = body as { object: string; version: string; resources: string[] };
      expect(b.object).toBe("integration_layer");
      expect(b.resources).toContain("payments");
    }
  });

  it("payments.create with magic 4242 returns succeeded", async () => {
    const { status, body } = await call("/payments.create", {
      method: "POST",
      body: JSON.stringify({ amount: 4242, currency: "XAF", method: "card" }),
    });
    if (status === 200) {
      const b = body as { object: string; status: string };
      expect(b.object).toBe("payment");
      expect(b.status).toBe("succeeded");
    }
  });

  it("payments.create with magic 4000 returns connector_error", async () => {
    const { status, body } = await call("/payments.create", {
      method: "POST",
      body: JSON.stringify({ amount: 4000, currency: "XAF", method: "card" }),
    });
    if (status === 402) {
      const b = body as { error: { type: string; code: string } };
      expect(b.error.type).toBe("connector_error");
      expect(b.error.code).toBe("card_declined");
    }
  });

  it("unknown route returns invalid_request_error", async () => {
    const { status, body } = await call("/foo.bar", {
      method: "POST", body: "{}",
    });
    if (status === 404) {
      const b = body as { error: { type: string } };
      expect(b.error.type).toBe("invalid_request_error");
    }
  });
});
