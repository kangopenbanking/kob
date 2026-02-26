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
