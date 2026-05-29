// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
//
// Phase 10.1 ratchet guard. Asserts every additive change shipped under
// 4.44.0 is present in public/openapi.json. Failing this test means a
// future edit silently regressed the spec contract.

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const spec = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "public/openapi.json"), "utf8"),
);

describe("Phase 10.1 coverage ratchet (v4.44.0)", () => {
  it("bumps info.version to 4.44.0", () => {
    expect(spec.info.version).toBe("4.44.0");
  });

  it("MobileMoneyCharge.provider enum covers MTN, Orange, Airtel, ExpressUnion, CamPost", () => {
    const enums = spec.components.schemas.MobileMoneyCharge.properties.provider.enum;
    for (const p of ["MTN", "Orange", "Airtel", "ExpressUnion", "CamPost"]) {
      expect(enums).toContain(p);
    }
  });

  it("registers ExpressUnionPickup and CamPostAccount sibling schemas", () => {
    expect(spec.components.schemas.ExpressUnionPickup).toBeTruthy();
    expect(spec.components.schemas.CamPostAccount).toBeTruthy();
  });

  it("adds RtpSla schema with expected_completion_seconds + sla_tier", () => {
    const s = spec.components.schemas.RtpSla;
    expect(s).toBeTruthy();
    expect(s.required).toEqual(expect.arrayContaining(["expected_completion_seconds", "sla_tier"]));
    expect(s.properties.sla_tier.enum).toEqual(
      expect.arrayContaining(["instant", "p50_30s", "p95_60s", "p99_300s", "best_effort"]),
    );
  });

  it("adds CreditScore.data_sources and locale_band", () => {
    const cs = spec.components.schemas.CreditScore.properties;
    expect(cs.data_sources).toBeTruthy();
    expect(cs.data_sources.items.enum).toEqual(
      expect.arrayContaining(["mobile_money_history", "njangi_participation", "cobac_registry"]),
    );
    expect(cs.locale_band).toBeTruthy();
    expect(cs.locale_band.enum).toEqual(expect.arrayContaining(["cemac_v1", "fico_us", "experian_eu"]));
  });

  it("fixes GatewayVirtualAccount example to Afriland First Bank / XAF and adds bank_country", () => {
    const va = spec.components.schemas.GatewayVirtualAccount.properties;
    expect(va.bank_name.example).toBe("Afriland First Bank");
    expect(va.currency.example).toBe("XAF");
    expect(va.bank_country).toBeTruthy();
    expect(va.bank_country.enum).toEqual(expect.arrayContaining(["CM", "GA", "CG", "TD", "CF", "GQ"]));
  });

  it("registers /v1/verify/nin and /v1/verify/cni operations", () => {
    expect(spec.paths["/v1/verify/nin"]?.post?.operationId).toBe("verifyNin");
    expect(spec.paths["/v1/verify/cni"]?.post?.operationId).toBe("verifyCni");
  });

  it("retains /v1/gateway/resolve-bvn but flags it deprecated-for-CEMAC", () => {
    const op = spec.paths["/v1/gateway/resolve-bvn"]?.post;
    expect(op).toBeTruthy();
    expect(op["x-deprecated-for-region"]).toEqual(["CEMAC"]);
  });

  it("registers /v1/errors/{code} lookup with LocalizedError schema", () => {
    expect(spec.paths["/v1/errors/{code}"]?.get?.operationId).toBe("getLocalizedError");
    const le = spec.components.schemas.LocalizedError;
    expect(le).toBeTruthy();
    expect(le.required).toEqual(expect.arrayContaining(["code", "title_en", "title_fr", "status"]));
  });

  it("registers Accept-Language parameter and Content-Language header", () => {
    expect(spec.components.parameters.AcceptLanguage).toBeTruthy();
    expect(spec.components.headers["Content-Language"]).toBeTruthy();
  });

  it("loosens LoanScheduleItem.required[] (deprecated float fields no longer required)", () => {
    const ls = spec.components.schemas.LoanScheduleItem;
    expect(ls.required).not.toContain("principal");
    expect(ls.required).not.toContain("interest");
    expect(ls.required).not.toContain("total_due");
    expect(ls.required).toEqual(
      expect.arrayContaining(["principal_amount", "interest_amount", "total_due_amount"]),
    );
    // The deprecated fields must still EXIST (Standing Order #1 LOCK).
    expect(ls.properties.principal).toBeTruthy();
    expect(ls.properties.interest).toBeTruthy();
    expect(ls.properties.total_due).toBeTruthy();
    // And carry an explicit deprecation block.
    expect(ls["x-deprecation"]?.removal_version).toBe("5.0.0");
  });
});
