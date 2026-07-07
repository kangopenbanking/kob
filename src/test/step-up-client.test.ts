import { describe, it, expect } from "vitest";
import { detectStepUp } from "@/lib/step-up-client";

describe("detectStepUp", () => {
  it("returns false for ordinary success responses", async () => {
    expect((await detectStepUp({ data: { ok: true }, error: null })).triggered).toBe(false);
  });

  it("detects STEP_UP_REQUIRED in the data envelope", async () => {
    const r = await detectStepUp({ data: { code: "STEP_UP_REQUIRED", message: "step up" }, error: null });
    expect(r.triggered).toBe(true);
    expect(r.message).toBe("step up");
  });

  it("detects step_up_required in error.context.body string", async () => {
    const r = await detectStepUp({
      data: null,
      error: { context: { body: JSON.stringify({ code: "STEP_UP_REQUIRED", reason: "aal2_required" }) } },
    });
    expect(r.triggered).toBe(true);
    expect(r.reason).toBe("aal2_required");
  });

  it("detects step_up_required in error.context.body object", async () => {
    const r = await detectStepUp({
      data: null,
      error: { context: { body: { error: "step_up_required", message: "MFA needed" } } },
    });
    expect(r.triggered).toBe(true);
  });

  it("detects step_up_required from a Response context (Supabase v2 shape)", async () => {
    const resp = new Response(JSON.stringify({ code: "STEP_UP_REQUIRED", reason: "aal2_required" }), { status: 401 });
    const r = await detectStepUp({ data: null, error: { context: resp } });
    expect(r.triggered).toBe(true);
    expect(r.reason).toBe("aal2_required");
  });

  it("ignores unrelated error codes", async () => {
    const r = await detectStepUp({
      data: null,
      error: { context: { body: JSON.stringify({ code: "OTHER", message: "no" }) } },
    });
    expect(r.triggered).toBe(false);
  });
});
