/**
 * Phase 8 — Daily Needs Delivery Network smoke guard.
 * Static checks that the merchant + driver workflow stays wired together.
 * Run: `bunx vitest run ddn-phase8`.
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf-8");
const exists = (p: string) => fs.existsSync(path.join(root, p));

describe("Phase 8 — DDN merchant + driver workflow", () => {
  it("ships the merchant DDN pages", () => {
    expect(exists("src/pages/merchant/MerchantDailyNeedsDeliveries.tsx")).toBe(true);
    expect(exists("src/pages/merchant/MerchantDailyNeedsDrivers.tsx")).toBe(true);
    expect(exists("src/pages/merchant/MerchantDailyNeedsDeliverySettings.tsx")).toBe(true);
  });

  it("mounts the merchant DDN routes", () => {
    const app = read("src/App.tsx");
    expect(app).toContain('daily-needs/deliveries');
    expect(app).toContain('daily-needs/drivers');
    expect(app).toContain('daily-needs/delivery-settings');
    expect(app).toContain("MerchantDailyNeedsDeliveries");
    expect(app).toContain("MerchantDailyNeedsDrivers");
    expect(app).toContain("MerchantDailyNeedsDeliverySettings");
  });

  it("registers DDN entries in the merchant navigation", () => {
    const nav = read("src/components/merchant/merchant-navigation-config.ts");
    expect(nav).toContain("/merchant/daily-needs/deliveries");
    expect(nav).toContain("/merchant/daily-needs/drivers");
    expect(nav).toContain("/merchant/daily-needs/delivery-settings");
  });

  it("renders the deliveries page with realtime + tabs", () => {
    const src = read("src/pages/merchant/MerchantDailyNeedsDeliveries.tsx");
    expect(src).toContain("supabase.channel");
    expect(src).toContain("postgres_changes");
    expect(src).toContain("ddn_assignments");
    expect(src).toMatch(/Active|Completed/);
  });

  it("ships advanced fulfillment rules in delivery settings", () => {
    const src = read("src/pages/merchant/MerchantDailyNeedsDeliverySettings.tsx");
    expect(src).toContain("max_radius_km");
    expect(src).toContain("surge_multiplier");
    expect(src).toContain("operating_hours");
    expect(src).toContain("accept_outside_hours");
    expect(src).toContain("min_fee_xaf");
    expect(src).toContain("max_fee_xaf");
  });

  it("hardens the onboarding wizard against empties / bad dates", () => {
    const src = read("src/pages/merchant/MerchantDailyNeedsOnboarding.tsx");
    expect(src).toContain("URL_FIELDS");
    expect(src).toContain("DATE_FIELDS");
    expect(src).toContain("PHONE_RE");
    expect(src).toContain("ISO_DATE_RE");
  });

  it("dispatch honours operating hours, max radius, surge, min/max fees", () => {
    const src = read("supabase/functions/ddn-dispatch/index.ts");
    expect(src).toContain("withinOperatingHours");
    expect(src).toContain("outside_max_radius");
    expect(src).toContain("surge_multiplier");
    expect(src).toContain("min_fee_xaf");
    expect(src).toContain("max_fee_xaf");
  });

  it("ships shared notification helper + emits notifications on every event", () => {
    expect(exists("supabase/functions/_shared/ddn-notify.ts")).toBe(true);
    const dispatch = read("supabase/functions/ddn-dispatch/index.ts");
    const accept = read("supabase/functions/ddn-offer-respond/index.ts");
    const pickup = read("supabase/functions/ddn-pickup-confirm/index.ts");
    const verify = read("supabase/functions/ddn-deliver-verify/index.ts");
    expect(dispatch).toContain("ddn.assignment.created");
    expect(accept).toContain("ddn.assignment.accepted");
    expect(pickup).toContain("ddn.assignment.picked_up");
    expect(verify).toContain("ddn.delivery.verified");
    expect(verify).toContain("ddn.settlement.completed");
    // Idempotency keys present for every notification
    for (const src of [dispatch, accept, pickup, verify]) {
      expect(src).toMatch(/idempotency_key:\s*`ddn\./);
    }
  });

  it("driver workflow files are in place", () => {
    expect(exists("src/pages/customer-app/driver/DriverHome.tsx")).toBe(true);
    expect(exists("src/pages/customer-app/driver/DriverActiveDelivery.tsx")).toBe(true);
    expect(exists("src/pages/customer-app/driver/DriverPayouts.tsx")).toBe(true);
    expect(exists("src/components/auth/DriverGuard.tsx")).toBe(true);
  });

  it("ships the Phase 8 QA checklist", () => {
    expect(exists("docs/daily-needs/phase-8-qa-checklist.md")).toBe(true);
  });
});
