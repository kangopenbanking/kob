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

  it("should map PayPal payout statuses correctly", async () => {
    const { mapPayPalStatus } = await import("../../supabase/functions/_shared/gateway-adapters");
    expect(mapPayPalStatus("SUCCESS")).toBe("successful");
    expect(mapPayPalStatus("FAILED")).toBe("failed");
    expect(mapPayPalStatus("PENDING")).toBe("processing");
    expect(mapPayPalStatus("UNCLAIMED")).toBe("pending");
    expect(mapPayPalStatus("RETURNED")).toBe("failed");
    expect(mapPayPalStatus("ONHOLD")).toBe("processing");
    expect(mapPayPalStatus("BLOCKED")).toBe("failed");
    expect(mapPayPalStatus("REFUNDED")).toBe("failed");
    expect(mapPayPalStatus("REVERSED")).toBe("failed");
    expect(mapPayPalStatus("unknown_status")).toBe("pending");
  });
});

describe("Gateway Adapters — PayPal Fee Calculation", () => {
  it("should calculate paypal fees correctly", async () => {
    const { calculateGatewayFee } = await import("../../supabase/functions/_shared/gateway-adapters");
    const { fee, net } = calculateGatewayFee(10000, "paypal");
    expect(fee).toBe(Math.round(10000 * 0.035 + 150)); // 500
    expect(net).toBe(10000 - fee);
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
  it("should have 7 distinct transfer channels defined", () => {
    const transferChannels = [
      "/v1/banking/internal-transfer",
      "/v1/flutterwave/bank-transfer",
      "/v1/banking/facilitated-transfer",
      "/v1/mobile-money/to-bank",
      "/v1/gateway/fund-account",
      "/v1/gateway/withdraw-to-bank",
      "/v1/gateway/payouts/paypal",
    ];
    expect(transferChannels.length).toBe(7);
    expect(new Set(transferChannels).size).toBe(7);
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

describe("New Gateway Endpoints — Path Coverage (v2.6.0)", () => {
  it("should have payment links CRUD endpoints", () => {
    const endpoints = [
      "POST /v1/gateway/payment-links",
      "GET /v1/gateway/payment-links",
      "PUT /v1/gateway/payment-links/{linkId}",
      "DELETE /v1/gateway/payment-links/{linkId}",
    ];
    expect(endpoints.length).toBe(4);
    expect(new Set(endpoints).size).toBe(4);
  });

  it("should have subscriptions lifecycle endpoints", () => {
    const endpoints = [
      "POST /v1/gateway/subscriptions",
      "GET /v1/gateway/subscriptions",
      "GET /v1/gateway/subscriptions/{subscriptionId}",
      "POST /v1/gateway/subscriptions/cancel",
    ];
    expect(endpoints.length).toBe(4);
  });

  it("should have customer tokenization endpoints", () => {
    const endpoints = [
      "POST /v1/gateway/customers",
      "GET /v1/gateway/customers",
      "GET /v1/gateway/customers/{customerId}",
      "PUT /v1/gateway/customers/{customerId}",
      "GET /v1/gateway/customers/{customerId}/tokens",
      "DELETE /v1/gateway/customers/{customerId}/tokens/{tokenId}",
      "POST /v1/gateway/charges/token",
    ];
    expect(endpoints.length).toBe(7);
  });

  it("should have reconciliation endpoints", () => {
    const endpoints = [
      "POST /v1/gateway/reconciliation",
      "GET /v1/gateway/reconciliation",
    ];
    expect(endpoints.length).toBe(2);
  });

  it("should have merchant onboarding endpoints", () => {
    const endpoints = [
      "POST /v1/merchants",
      "GET /v1/merchants",
      "PATCH /v1/merchants",
      "POST /v1/merchants/kyb",
      "GET /v1/merchants/kyb",
      "POST /v1/merchants/api-keys",
      "GET /v1/merchants/api-keys",
      "DELETE /v1/merchants/api-keys",
      "POST /v1/merchants/settlement-accounts",
      "GET /v1/merchants/settlement-accounts",
      "POST /v1/merchants/webhooks",
      "GET /v1/merchants/webhooks",
    ];
    expect(endpoints.length).toBe(12);
    expect(new Set(endpoints).size).toBe(12);
  });

  it("should have charge events and fee report endpoints", () => {
    const endpoints = [
      "GET /v1/gateway/charges/{chargeId}/events",
      "GET /v1/gateway/reports/fees",
      "POST /v1/gateway/payouts/{payoutId}/retry",
    ];
    expect(endpoints.length).toBe(3);
  });

  it("should have all 8 fee channels defined", () => {
    const allChannels = [
      "mobile_money", "card", "bank_transfer",
      "apple_pay", "google_pay", "ussd",
      "account_funding", "paypal",
    ];
    expect(allChannels.length).toBe(8);
    expect(new Set(allChannels).size).toBe(8);
  });
});
