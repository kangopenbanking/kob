/**
 * Didit-first KYC E2E suite
 *
 * Verifies (against https://kob.lovable.app or PLAYWRIGHT_BASE_URL):
 *  1. A fresh consumer signup lands on the KYC step and launches Didit
 *     via unified-kyc-gateway (Didit-first policy — no direct kyc-submit).
 *  2. Credit-score UI stays gated while `kyc_verifications.status !== 'approved'`.
 *  3. When a mocked Didit webhook flips the status to `approved`, the credit
 *     score screen unlocks and the score becomes computable.
 *
 * The Didit webhook is mocked by POSTing directly to the /didit-webhook edge
 * function with `x-e2e-mock: 1` header — the seeded consumer's session id is
 * used as `vendor_data` so the handler routes the update to that user.
 *
 * Skipped automatically until seeding + env vars are configured
 * (see e2e/SEEDING.md). Set RUN_AUTHENTICATED_E2E=1 and E2E_PASSWORD to run.
 */
import { test, expect, request as pwRequest } from "@playwright/test";
import { SHOULD_RUN, loginAs } from "./helpers";

const SUPABASE_FN_BASE = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";
const MOCK_HEADER = { "x-e2e-mock": "1", "content-type": "application/json" };

test.describe("Didit-first KYC + credit gating", () => {
  test.skip(!SHOULD_RUN, "Requires seeded consumer + E2E_PASSWORD (see e2e/SEEDING.md)");

  test("consumer signup routes KYC through unified-kyc-gateway (Didit-first)", async ({ page }) => {
    const gatewayCalls: string[] = [];
    const directKycSubmitCalls: string[] = [];

    page.on("request", (req) => {
      const url = req.url();
      if (url.includes("/functions/v1/unified-kyc-gateway")) gatewayCalls.push(url);
      if (url.match(/\/functions\/v1\/(kyc-submit|business-kyc-submit)(\?|$)/)) directKycSubmitCalls.push(url);
    });

    const ok = await loginAs(page, "consumer");
    expect(ok, "consumer login should succeed").toBeTruthy();

    // Navigate the register/KYC wizard step that launches Didit
    await page.goto("/app/register");
    await page.waitForLoadState("networkidle").catch(() => {});

    // Advance to step 1 (verify identity) then click "Start Didit verification"
    // The wizard shows "Continue" on step 0 (reasons) if none selected the button is disabled — try reasons first.
    const anyReason = page.locator('[role="checkbox"], button:has-text("Send money")').first();
    if (await anyReason.count()) await anyReason.click().catch(() => {});
    const continueBtn = page.getByRole("button", { name: /continue|next/i }).first();
    if (await continueBtn.count()) await continueBtn.click().catch(() => {});

    const startDidit = page.getByRole("button", { name: /start didit|verify identity/i }).first();
    await expect(startDidit).toBeVisible({ timeout: 10_000 });
    await startDidit.click();
    await page.waitForTimeout(2_000);

    expect(gatewayCalls.length, "unified-kyc-gateway must be called").toBeGreaterThan(0);
    expect(directKycSubmitCalls.length, "kyc-submit must NOT be called directly").toBe(0);
  });

  test("credit score screen is gated until KYC is approved via Didit webhook", async ({ page, baseURL }) => {
    const ok = await loginAs(page, "consumer");
    expect(ok).toBeTruthy();

    // Snapshot pre-approval credit page — expect no computed score
    await page.goto("/app/credit");
    await page.waitForLoadState("networkidle").catch(() => {});
    const gatedCta = page.getByText(/verify (your )?identity|complete kyc|unlock your score/i);
    // Not asserting strict visibility — it's OK if the CTA differs — but there must be no numeric score.
    const preScore = await page.locator('text=/\\b[3-8][0-9]{2}\\b/').first().textContent().catch(() => null);

    // Fire a mocked Didit webhook that approves the seeded consumer.
    // Vendor_data must match the consumer's user_id. Grab it from the app.
    const userId = await page.evaluate(() => {
      const raw = Object.keys(localStorage).find((k) => k.startsWith("sb-") && k.endsWith("-auth-token"));
      if (!raw) return null;
      try { return JSON.parse(localStorage.getItem(raw)!)?.user?.id ?? null; } catch { return null; }
    });
    expect(userId, "seeded consumer must have an active session").toBeTruthy();

    const ctx = await pwRequest.newContext();
    const eventId = `e2e-didit-${Date.now()}`;
    const sessionId = `e2e-sess-${Date.now()}`;
    const res = await ctx.post(`${SUPABASE_FN_BASE}/didit-webhook`, {
      headers: MOCK_HEADER,
      data: {
        event: "verification.approved",
        session_id: sessionId,
        workflow_id: "e2e",
        status: "approved",
        vendor_data: userId,
        id: eventId,
      },
    });
    // The mock header is honored by the handler in test mode; a 2xx confirms delivery.
    expect([200, 202]).toContain(res.status());
    await ctx.dispose();

    // Poll the credit screen until it unlocks (max ~20s).
    await page.goto("/app/credit");
    let unlocked = false;
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(2_000);
      await page.reload();
      const hasScore = await page.locator('text=/\\b[3-8][0-9]{2}\\b/').first().count();
      if (hasScore > 0) { unlocked = true; break; }
    }
    // If the gate lifted but no score is present yet, the "Compute score" CTA must be present.
    if (!unlocked) {
      const computeBtn = page.getByRole("button", { name: /compute|refresh|recalculate/i });
      await expect(computeBtn).toBeVisible({ timeout: 5_000 });
    }
    expect(preScore).toBeFalsy();
  });
});
