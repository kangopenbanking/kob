// Kora webhook signature verification — unit test.
// Mirrors the HMAC-SHA256 logic in supabase/functions/_shared/kora-client.ts
import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";

function hmacSha256Hex(secret: string, body: string) {
  return createHmac("sha256", secret).update(body).digest("hex");
}

describe("kora webhook signature", () => {
  const secret = "test_secret_value";
  const body = JSON.stringify({ id: "evt_1", event: "virtualcard.charge", data: { amount: 10 } });

  it("computes a stable signature", () => {
    const a = hmacSha256Hex(secret, body);
    const b = hmacSha256Hex(secret, body);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs for different payloads", () => {
    const a = hmacSha256Hex(secret, body);
    const b = hmacSha256Hex(secret, body + " ");
    expect(a).not.toBe(b);
  });

  it("differs for different secrets", () => {
    const a = hmacSha256Hex(secret, body);
    const b = hmacSha256Hex(secret + "x", body);
    expect(a).not.toBe(b);
  });
});
