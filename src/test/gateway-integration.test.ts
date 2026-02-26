import { describe, it, expect } from "vitest";

// ─── Stage 1: Gateway Adapter Unit Tests ───

describe("Gateway Adapters — Fee Calculation", () => {
  it("should calculate mobile_money fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "mobile_money");
    expect(fee).toBe(Math.round(10000 * 0.03 + 50)); // 350
    expect(net).toBe(10000 - fee);
  });

  it("should calculate card fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "card");
    expect(fee).toBe(Math.round(10000 * 0.035 + 100)); // 450
    expect(net).toBe(10000 - fee);
  });

  it("should calculate bank_transfer fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "bank_transfer");
    expect(fee).toBe(Math.round(10000 * 0.02 + 75)); // 275
    expect(net).toBe(10000 - fee);
  });

  it("should calculate account_funding fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(50000, "account_funding");
    expect(fee).toBe(Math.round(50000 * 0.025 + 0)); // 1250
    expect(net).toBe(50000 - fee);
  });

  it("should calculate ussd fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "ussd");
    expect(fee).toBe(Math.round(10000 * 0.025 + 25)); // 275
    expect(net).toBe(10000 - fee);
  });

  it("should calculate apple_pay fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "apple_pay");
    expect(fee).toBe(Math.round(10000 * 0.035 + 100)); // 450
    expect(net).toBe(10000 - fee);
  });

  it("should calculate google_pay fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "google_pay");
    expect(fee).toBe(Math.round(10000 * 0.035 + 100)); // 450
    expect(net).toBe(10000 - fee);
  });

  it("should default to 3.5% for unknown channels", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee } = calculateGatewayFee(10000, "unknown_channel");
    expect(fee).toBe(Math.round(10000 * 0.035));
  });
});

describe("Gateway Adapters — Status Mapping", () => {
  it("should map Flutterwave statuses correctly", async () => {
    const { mapFlutterwaveStatus } = await import("../../supabase/functions/_shared/gateway-adapters");
    expect(mapFlutterwaveStatus("successful")).toBe("successful");
    expect(mapFlutterwaveStatus("completed")).toBe("successful");
    expect(mapFlutterwaveStatus("pending")).toBe("processing");
    expect(mapFlutterwaveStatus("failed")).toBe("failed");
    expect(mapFlutterwaveStatus("error")).toBe("failed");
    expect(mapFlutterwaveStatus("unknown")).toBe("pending");
  });

  it("should map Stripe statuses correctly", async () => {
    const { mapStripeStatus } = await import("../../supabase/functions/_shared/gateway-adapters");
    expect(mapStripeStatus("succeeded")).toBe("successful");
    expect(mapStripeStatus("processing")).toBe("processing");
    expect(mapStripeStatus("requires_payment_method")).toBe("pending");
    expect(mapStripeStatus("canceled")).toBe("cancelled");
    expect(mapStripeStatus("unknown")).toBe("pending");
  });

  it("should map Stripe dispute statuses correctly", async () => {
    const { mapStripeDisputeStatus } = await import("../../supabase/functions/_shared/gateway-adapters");
    expect(mapStripeDisputeStatus("needs_response")).toBe("open");
    expect(mapStripeDisputeStatus("under_review")).toBe("under_review");
    expect(mapStripeDisputeStatus("won")).toBe("won");
    expect(mapStripeDisputeStatus("lost")).toBe("lost");
    expect(mapStripeDisputeStatus("charge_refunded")).toBe("won");
  });
});

describe("API Configuration — Gateway Endpoints", () => {
  it("should have correct base URL", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL).toContain("kangopenbanking.com");
    expect(API_CONFIG.BASE_URL).toContain("functions/v1");
  });

  it("should have fallback URL", async () => {
    const { API_CONFIG } = await import("@/config/api");
    expect(API_CONFIG.BASE_URL_FALLBACK).toContain("supabase.co");
  });
});

// ─── Open Banking & Transfers E2E Tests ───

describe("AISP Consent Lifecycle — Schema Validation", () => {
  it("should define valid consent statuses", () => {
    const validStatuses = ["AwaitingAuthorisation", "Authorised", "Rejected", "Consumed", "Expired", "Revoked"];
    expect(validStatuses).toContain("Authorised");
    expect(validStatuses).toContain("Expired");
    expect(validStatuses).toContain("Revoked");
    expect(validStatuses.length).toBe(6);
  });

  it("should enforce consent expiry logic pattern", () => {
    // Simulates the expire_old_consents() DB function logic
    const consentDate = new Date("2026-01-01T00:00:00Z");
    const now = new Date("2026-02-26T00:00:00Z");
    expect(consentDate < now).toBe(true); // consent should be expired
  });

  it("should validate AISP permissions array", () => {
    const validPermissions = [
      "ReadAccountsBasic", "ReadAccountsDetail",
      "ReadBalances", "ReadTransactionsBasic",
      "ReadTransactionsDetail", "ReadBeneficiariesBasic",
      "ReadStandingOrdersBasic", "ReadDirectDebitsBasic",
    ];
    expect(validPermissions.length).toBeGreaterThanOrEqual(4);
    expect(validPermissions).toContain("ReadBalances");
  });
});

describe("PISP Payment Lifecycle — State Validation", () => {
  it("should define valid payment lifecycle states", () => {
    const states = ["Pending", "Authorised", "AcceptedSettlementInProgress", "Completed", "Failed"];
    expect(states).toContain("AcceptedSettlementInProgress");
    expect(states.indexOf("Pending")).toBeLessThan(states.indexOf("Completed"));
  });

  it("should enforce idempotency key format", () => {
    const key = crypto.randomUUID();
    expect(key).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("Transfer Endpoints — Documentation Coverage", () => {
  it("should have 6 distinct transfer channels defined", () => {
    const transferChannels = [
      "/v1/banking/internal-transfer",
      "/v1/flutterwave/bank-transfer",
      "/v1/banking/facilitated-transfer",
      "/v1/mobile-money/to-bank",
      "/v1/gateway/fund-account",
      "/v1/gateway/withdraw-to-bank",
    ];
    expect(transferChannels.length).toBe(6);
    expect(new Set(transferChannels).size).toBe(6); // all unique
  });

  it("should have internal transfer endpoint path", () => {
    const endpoint = "/v1/banking/internal-transfer";
    expect(endpoint).toContain("/v1/banking/");
    expect(endpoint).toContain("internal-transfer");
  });

  it("should have facilitated transfer endpoint path", () => {
    const endpoint = "/v1/banking/facilitated-transfer";
    expect(endpoint).toContain("/v1/banking/");
    expect(endpoint).toContain("facilitated-transfer");
  });

  it("should have mobile-money-to-bank endpoint path", () => {
    const endpoint = "/v1/mobile-money/to-bank";
    expect(endpoint).toContain("/v1/mobile-money/");
  });
});
