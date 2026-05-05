import { describe, it, expect } from "vitest";
import { decideDashboard, type RoutingSignals } from "@/lib/dashboardRouting";

const base: RoutingSignals = {
  isAdmin: false,
  isMerchantRole: false,
  isDeveloperRole: false,
  hasDeveloperOrg: false,
  isMerchantStaff: false,
  institutionStatus: null,
  institutionType: null,
  isStaff: false,
};

describe("decideDashboard", () => {
  it("admin → /admin", () => {
    expect(decideDashboard({ ...base, isAdmin: true }).path).toBe("/admin");
  });
  it("merchant role → /merchant", () => {
    expect(decideDashboard({ ...base, isMerchantRole: true }).path).toBe("/merchant");
  });
  it("developer role → /developer", () => {
    expect(decideDashboard({ ...base, isDeveloperRole: true }).path).toBe("/developer");
  });
  it("developer_org without role still → /developer", () => {
    const d = decideDashboard({ ...base, hasDeveloperOrg: true });
    expect(d.path).toBe("/developer");
    expect(d.reason).toBe("developer_org_row");
  });
  it("merchant staff → /merchant/travel-services", () => {
    expect(decideDashboard({ ...base, isMerchantStaff: true }).path).toBe("/merchant/travel-services");
  });
  it("approved bank institution → /fi-portal", () => {
    expect(decideDashboard({ ...base, institutionStatus: "approved", institutionType: "bank" }).path).toBe("/fi-portal");
  });
  it("approved developer institution → /developer", () => {
    expect(decideDashboard({ ...base, institutionStatus: "approved", institutionType: "developer" }).path).toBe("/developer");
  });
  it("pending institution → /pending-approval", () => {
    expect(decideDashboard({ ...base, institutionStatus: "pending" }).path).toBe("/pending-approval");
  });
  it("FI staff role with no institution → /fi-portal", () => {
    expect(decideDashboard({ ...base, isStaff: true }).path).toBe("/fi-portal");
  });
  it("plain user → /credit-score", () => {
    expect(decideDashboard(base).path).toBe("/credit-score");
  });
  it("admin precedence over developer/merchant", () => {
    expect(decideDashboard({ ...base, isAdmin: true, isMerchantRole: true, isDeveloperRole: true }).path).toBe("/admin");
  });
  it("merchant role precedence over developer signals", () => {
    expect(decideDashboard({ ...base, isMerchantRole: true, hasDeveloperOrg: true }).path).toBe("/merchant");
  });
});
