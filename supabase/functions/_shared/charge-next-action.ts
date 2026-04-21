// Builds a Stripe-style `next_action` block per channel so integrators
// know exactly what to do after POST /v1/gateway/charges.
// Additive only — STANDING ORDER 4. Cites P5 (Working Code Rule).

declare const Deno: { env: { get(key: string): string | undefined } } | undefined;

export interface NextAction {
  type:
    | "stripe_confirm_card"
    | "bank_transfer_instructions"
    | "mobile_money_push"
    | "paypal_redirect"
    | "redirect_to_url";
  [key: string]: unknown;
}

interface BuildArgs {
  channel: string;
  charge: { id: string; status: string; provider: string; provider_ref?: string | null };
  providerResult?: {
    provider_ref?: string;
    status?: string;
    provider_raw?: any;
    redirect_url?: string;
  };
  customer_phone?: string | null;
}

function getStripePublishableKey(): { key: string; env: "test" | "live" } {
  const key =
    (typeof Deno !== "undefined"
      ? Deno.env.get("STRIPE_PUBLIC_KEY") || Deno.env.get("VITE_STRIPE_PUBLIC_KEY") || ""
      : "") || "";
  return { key, env: key.startsWith("pk_live_") ? "live" : "test" };
}

export function buildNextAction(args: BuildArgs): NextAction | null {
  const { channel, charge, providerResult, customer_phone } = args;

  // Terminal — no further action
  if (["successful", "failed", "cancelled", "refunded"].includes(charge.status)) {
    return null;
  }

  const raw = providerResult?.provider_raw || {};

  if (channel === "card" || channel === "apple_pay" || channel === "google_pay") {
    // Stripe PaymentIntent → return client_secret + publishable key
    const clientSecret = raw?.client_secret || null;
    if (clientSecret) {
      const pk = getStripePublishableKey();
      return {
        type: "stripe_confirm_card",
        client_secret: clientSecret,
        publishable_key: pk.key || null,
        publishable_key_env: pk.env,
        payment_intent_id: providerResult?.provider_ref || raw?.id || null,
      };
    }
    // Stripe missing client_secret → fall through to redirect or null
    if (providerResult?.redirect_url) {
      return { type: "redirect_to_url", url: providerResult.redirect_url };
    }
    return null;
  }

  if (channel === "bank_transfer") {
    // Flutterwave bank_transfer returns meta.authorization with transfer_account etc.
    const auth =
      raw?.meta?.authorization ||
      raw?.data?.meta?.authorization ||
      raw?.data?.authorization ||
      {};
    const accountNumber =
      auth.transfer_account || auth.account_number || raw?.data?.account_number || null;
    const bankName = auth.transfer_bank || auth.bank_name || raw?.data?.bank_name || null;
    const accountName = auth.account_expiration_name || auth.beneficiary_name || null;
    const reference = auth.transfer_reference || auth.reference || raw?.data?.flw_ref || null;
    const amount = auth.transfer_amount || raw?.data?.amount || null;
    const expiresAt = auth.account_expiration || auth.transfer_account_expiration || null;

    if (accountNumber || reference) {
      return {
        type: "bank_transfer_instructions",
        bank_name: bankName,
        account_number: accountNumber,
        account_name: accountName,
        reference,
        amount,
        expires_at: expiresAt,
        instructions:
          "Transfer the exact amount to the account above using the reference. Funds confirm within 1-5 minutes.",
      };
    }
    return null;
  }

  if (channel === "mobile_money") {
    return {
      type: "mobile_money_push",
      message: customer_phone
        ? `Approve the USSD prompt sent to ${customer_phone} to complete payment.`
        : "Approve the USSD prompt on the customer's phone to complete payment.",
      poll_url: `/v1/gateway/charges/${charge.id}/verify`,
      poll_interval_seconds: 3,
      timeout_seconds: 120,
    };
  }

  if (channel === "ussd") {
    const ussdCode = raw?.meta?.authorization?.note || raw?.data?.meta?.authorization?.note || null;
    return {
      type: "redirect_to_url",
      url: providerResult?.redirect_url || null,
      ussd_code: ussdCode,
      poll_url: `/v1/gateway/charges/${charge.id}/verify`,
    };
  }

  if (channel === "paypal") {
    const approval = raw?.links?.find?.((l: any) => l.rel === "approve")?.href || raw?.approval_url;
    if (approval) return { type: "paypal_redirect", approval_url: approval };
    return null;
  }

  // Generic redirect fallback
  if (providerResult?.redirect_url) {
    return { type: "redirect_to_url", url: providerResult.redirect_url };
  }
  return null;
}
