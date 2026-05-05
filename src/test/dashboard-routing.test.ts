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

describe("decideDashboard — single-signal cases", () => {
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
  it("approved fintech institution → /fi-portal", () => {
    expect(decideDashboard({ ...base, institutionStatus: "approved", institutionType: "fintech" }).path).toBe("/fi-portal");
  });
  it("approved developer institution → /developer", () => {
    expect(decideDashboard({ ...base, institutionStatus: "approved", institutionType: "developer" }).path).toBe("/developer");
  });
  it("pending institution → /pending-approval", () => {
    expect(decideDashboard({ ...base, institutionStatus: "pending" }).path).toBe("/pending-approval");
  });
  it("rejected institution → /pending-approval", () => {
    expect(decideDashboard({ ...base, institutionStatus: "rejected" }).path).toBe("/pending-approval");
  });
  it("FI staff role with no institution → /fi-portal", () => {
    expect(decideDashboard({ ...base, isStaff: true }).path).toBe("/fi-portal");
  });
  it("plain user → /credit-score", () => {
    expect(decideDashboard(base).path).toBe("/credit-score");
  });
});

describe("decideDashboard — precedence matrix", () => {
  const cohorts: Array<[string, RoutingSignals, string]> = [
    ["admin > everything", { ...base, isAdmin: true, isMerchantRole: true, isDeveloperRole: true, hasDeveloperOrg: true, isMerchantStaff: true, institutionStatus: "approved", institutionType: "bank", isStaff: true }, "/admin"],
    ["merchant > developer", { ...base, isMerchantRole: true, isDeveloperRole: true, hasDeveloperOrg: true }, "/merchant"],
    ["merchant > institution", { ...base, isMerchantRole: true, institutionStatus: "approved", institutionType: "bank" }, "/merchant"],
    ["developer role > developer_org", { ...base, isDeveloperRole: true, hasDeveloperOrg: true }, "/developer"],
    ["developer role > approved bank institution", { ...base, isDeveloperRole: true, institutionStatus: "approved", institutionType: "bank" }, "/developer"],
    ["developer_org > approved bank institution", { ...base, hasDeveloperOrg: true, institutionStatus: "approved", institutionType: "bank" }, "/developer"],
    ["merchant staff > pending institution", { ...base, isMerchantStaff: true, institutionStatus: "pending" }, "/merchant/travel-services"],
    ["approved developer institution > FI staff role", { ...base, institutionStatus: "approved", institutionType: "developer", isStaff: true }, "/developer"],
    ["pending institution > FI staff role", { ...base, institutionStatus: "pending", isStaff: true }, "/pending-approval"],
  ];
  for (const [name, signals, expected] of cohorts) {
    it(name, () => {
      expect(decideDashboard(signals).path).toBe(expected);
    });
  }
});

describe("decideDashboard — every decision returns a non-empty reason", () => {
  it("includes a reason string", () => {
    const cases: RoutingSignals[] = [
      { ...base, isAdmin: true },
      { ...base, isMerchantRole: true },
      { ...base, isDeveloperRole: true },
      { ...base, hasDeveloperOrg: true },
      { ...base, isMerchantStaff: true },
      { ...base, institutionStatus: "approved", institutionType: "bank" },
      { ...base, institutionStatus: "approved", institutionType: "developer" },
      { ...base, institutionStatus: "pending" },
      { ...base, isStaff: true },
      base,
    ];
    for (const c of cases) {
      const d = decideDashboard(c);
      expect(d.reason).toBeTruthy();
      expect(d.path.startsWith("/")).toBe(true);
    }
  });
});
