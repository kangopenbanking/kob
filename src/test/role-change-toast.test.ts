import { describe, it, expect } from "vitest";
import { roleLabelFromDecision } from "@/hooks/useRoleChangeListener";
import type { RoutingSignals } from "@/lib/dashboardRouting";

const base: RoutingSignals = {
  isAdmin: false,
  isMerchantRole: false,
  isDeveloperRole: false,
  hasDeveloperOrg: false,
  isMerchantStaff: false,
  institutionStatus: null,
  institutionType: null,
  isStaff: false,
  accountType: null,
};

describe("roleLabelFromDecision — toast role naming", () => {
  it("admin path → Admin", () => {
    expect(roleLabelFromDecision({ path: "/admin", reason: "x" }, { ...base, isAdmin: true })).toBe("Admin");
  });
  it("merchant path → Merchant", () => {
    expect(roleLabelFromDecision({ path: "/merchant", reason: "x" }, base)).toBe("Merchant");
  });
  it("developer path → Developer", () => {
    expect(roleLabelFromDecision({ path: "/developer", reason: "x" }, base)).toBe("Developer");
  });
  it("fi-portal path → Institution", () => {
    expect(roleLabelFromDecision({ path: "/fi-portal", reason: "x" }, base)).toBe("Institution");
  });
  it("pending-approval path → Institution (pending)", () => {
    expect(roleLabelFromDecision({ path: "/pending-approval", reason: "x" }, base)).toBe("Institution (pending)");
  });
  it("credit-score path → Personal", () => {
    expect(roleLabelFromDecision({ path: "/credit-score", reason: "x" }, base)).toBe("Personal");
  });
});
