import { describe, it, expect } from "vitest";
import { detectTurnstileFailure } from "@/lib/turnstile-error";

describe("detectTurnstileFailure", () => {
  it("returns null for unrelated errors", () => {
    expect(detectTurnstileFailure(null)).toBeNull();
    expect(detectTurnstileFailure({ message: "other" })).toBeNull();
    expect(detectTurnstileFailure({ context: { body: JSON.stringify({ error: "other" }) } })).toBeNull();
  });

  it("returns structured failure for turnstile_failed body", () => {
    const err = {
      context: {
        body: JSON.stringify({
          error: "turnstile_failed",
          reason: "missing_token",
          codes: ["missing-input-response"],
          retryable: true,
          message: "Bot verification failed. Please complete the challenge again and retry.",
        }),
      },
    };
    const r = detectTurnstileFailure(err);
    expect(r).not.toBeNull();
    expect(r!.reason).toBe("missing_token");
    expect(r!.codes).toEqual(["missing-input-response"]);
    expect(r!.message).toMatch(/verification/i);
  });

  it("falls back to default message if backend omits message", () => {
    const err = { context: { body: { error: "turnstile_failed" } } };
    const r = detectTurnstileFailure(err);
    expect(r).not.toBeNull();
    expect(r!.message).toMatch(/verification/i);
  });
});
