import { describe, it, expect } from "vitest";
import {
  computeAvailableDashboards,
  computeDefaultDashboard,
  orderDashboards,
  type DashKey,
} from "../UserProfileMenu";

const ALL_ORDER: DashKey[] = ["admin", "merchant", "developer", "institution", "personal"];

describe("UserProfileMenu — dashboard listing & default", () => {
  it("personal-only user sees only Personal as default", () => {
    const input = { accountType: "personal", roles: [] };
    const avail = computeAvailableDashboards(input);
    const def = computeDefaultDashboard(input);
    expect(avail).toEqual(["personal"]);
    expect(def).toBe("personal");
    expect(orderDashboards(avail, def)).toEqual(["personal"]);
  });

  it("merchant registration → Merchant default + Personal available", () => {
    const input = { accountType: "business", roles: ["merchant"], hasMerchant: true };
    const avail = computeAvailableDashboards(input);
    const def = computeDefaultDashboard(input);
    expect(avail.sort()).toEqual(["merchant", "personal"].sort());
    expect(def).toBe("merchant");
    expect(orderDashboards(avail, def)[0]).toBe("merchant");
  });

  it("developer registration → Developer default", () => {
    const input = { accountType: "developer", roles: ["developer"], hasDeveloperOrg: true };
    const avail = computeAvailableDashboards(input);
    expect(avail.sort()).toEqual(["developer", "personal"].sort());
    expect(computeDefaultDashboard(input)).toBe("developer");
  });

  it("developer_org without role still grants Developer dashboard", () => {
    const input = { accountType: "personal", roles: [], hasDeveloperOrg: true };
    const avail = computeAvailableDashboards(input);
    expect(avail).toContain("developer");
    expect(computeDefaultDashboard(input)).toBe("personal"); // account_type wins
  });

  it("institution registration → Institution default", () => {
    const input = {
      accountType: "institution",
      roles: ["institution"],
      institution: { status: "approved", institution_type: "bank" },
    };
    const avail = computeAvailableDashboards(input);
    expect(avail.sort()).toEqual(["institution", "personal"].sort());
    expect(computeDefaultDashboard(input)).toBe("institution");
  });

  it("institution of type 'developer' is routed to Developer dashboard", () => {
    const input = {
      roles: ["institution"],
      institution: { status: "approved", institution_type: "developer" },
    };
    const avail = computeAvailableDashboards(input);
    expect(avail).toContain("developer");
    expect(avail).not.toContain("institution");
  });

  it("admin user gets Admin in available list and as default when account_type is admin", () => {
    const input = { accountType: "admin", roles: ["admin"] };
    const avail = computeAvailableDashboards(input);
    expect(avail).toContain("admin");
    expect(computeDefaultDashboard(input)).toBe("admin");
  });

  it("admin role with personal account_type → Personal default but Admin still listed", () => {
    const input = { accountType: "personal", roles: ["admin"] };
    const avail = computeAvailableDashboards(input);
    expect(avail).toContain("admin");
    expect(avail).toContain("personal");
    expect(computeDefaultDashboard(input)).toBe("personal");
  });

  it("multi-role user lists every granted dashboard exactly once", () => {
    const input = {
      accountType: "business",
      roles: ["admin", "merchant", "developer"],
      hasMerchant: true,
      hasDeveloperOrg: true,
      institution: { status: "approved", institution_type: "bank" },
    };
    const avail = computeAvailableDashboards(input);
    const unique = new Set(avail);
    expect(unique.size).toBe(avail.length);
    ["admin", "merchant", "developer", "institution", "personal"].forEach((k) =>
      expect(avail).toContain(k as DashKey),
    );
    expect(computeDefaultDashboard(input)).toBe("merchant");
  });

  it("orderDashboards puts default first, then canonical order", () => {
    const avail: DashKey[] = ["personal", "merchant", "admin", "developer"];
    const ordered = orderDashboards(avail, "developer");
    expect(ordered[0]).toBe("developer");
    const rest = ordered.slice(1);
    expect(rest).toEqual(ALL_ORDER.filter((k) => avail.includes(k) && k !== "developer"));
  });

  it("missing institution row but role present → Institution dashboard available", () => {
    const input = { roles: ["institution"], institution: null };
    const avail = computeAvailableDashboards(input);
    expect(avail).toContain("institution");
  });

  it("every authenticated user always has Personal", () => {
    for (const accountType of ["personal", "business", "developer", "institution", "admin"]) {
      const avail = computeAvailableDashboards({ accountType, roles: [] });
      expect(avail).toContain("personal");
    }
  });

  it("default highlight is unique — only one dashboard is Default", () => {
    const input = {
      accountType: "developer",
      roles: ["developer", "merchant"],
      hasMerchant: true,
      hasDeveloperOrg: true,
    };
    const avail = computeAvailableDashboards(input);
    const def = computeDefaultDashboard(input);
    const ordered = orderDashboards(avail, def);
    const defaults = ordered.filter((k) => k === def);
    expect(defaults.length).toBe(1);
    expect(ordered[0]).toBe(def);
  });
});
