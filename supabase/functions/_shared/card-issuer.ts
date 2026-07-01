// =============================================================
// card-issuer.ts — Provider-agnostic card issuing router.
// Default provider: NIUM (https://docs.nium.com/docs/cards).
// Automatic fallback: KORA (existing integration).
// PCI scope: PAN/CVV never persisted; reveal returns short-lived token.
// =============================================================
import { Kora, KoraApiError } from "./kora-client.ts";

export type CardProvider = "nium" | "kora";
export type CardFormFactor = "virtual" | "digital" | "physical";

export interface IssueCardInput {
  customer_external_id: string;
  cardholder: {
    first_name: string;
    last_name: string;
    email: string;
    phone?: string;
    date_of_birth?: string;
    address?: {
      line1: string; city: string; country: string; postal_code?: string; region?: string;
    };
  };
  form_factor: CardFormFactor;
  currency: string; // ISO-4217, defaults to XAF for CEMAC
  program_id?: string;
  initial_funding?: number;
  daily_limit?: number;
  monthly_limit?: number;
  idempotency_key: string;
}

export interface IssueCardResult {
  provider: CardProvider;
  provider_card_id: string;
  provider_customer_id: string;
  last4: string;
  exp_month: number;
  exp_year: number;
  brand: string;
  form_factor: CardFormFactor;
  fallback_used: boolean;
  fallback_reason?: string;
}

const NIUM_MODE = (Deno.env.get("NIUM_MODE") ?? "stub").toLowerCase();
const NIUM_BASE = Deno.env.get("NIUM_BASE_URL") ?? "https://gateway.nium.com";
const NIUM_API_KEY = Deno.env.get("NIUM_API_KEY") ?? "";
const NIUM_CLIENT_ID = Deno.env.get("NIUM_CLIENT_ID") ?? "";
const NIUM_CARD_PROGRAM_ID = Deno.env.get("NIUM_CARD_PROGRAM_ID") ?? "";
const NIUM_CARDS_ENABLED = (Deno.env.get("NIUM_CARDS_ENABLED") ?? "true") !== "false";

// ------------------------------------------------------------
// Nium — Cards API thin wrapper
// Docs: https://docs.nium.com/docs/cards
// ------------------------------------------------------------
async function niumRequest(path: string, method: "GET" | "POST", body?: unknown, idem?: string) {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-api-key": NIUM_API_KEY,
    "x-client-id": NIUM_CLIENT_ID,
  };
  if (idem) headers["x-request-id"] = idem;
  const res = await fetch(`${NIUM_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = data?.errors?.[0]?.errorMessage || data?.message || `nium_http_${res.status}`;
    const e: any = new Error(msg);
    e.status = res.status;
    e.body = data;
    throw e;
  }
  return data;
}

function niumStubCard(input: IssueCardInput): IssueCardResult {
  const now = new Date();
  const last4 = String(Math.floor(1000 + Math.random() * 9000));
  return {
    provider: "nium",
    provider_card_id: `nium_stub_${crypto.randomUUID()}`,
    provider_customer_id: `nium_cust_${input.customer_external_id}`,
    last4,
    exp_month: now.getMonth() + 1,
    exp_year: now.getFullYear() + 4,
    brand: "Visa",
    form_factor: input.form_factor,
    fallback_used: false,
  };
}

async function issueViaNium(input: IssueCardInput): Promise<IssueCardResult> {
  if (!NIUM_CARDS_ENABLED) throw new Error("nium_cards_disabled");
  if (NIUM_MODE === "stub") return niumStubCard(input);
  if (!NIUM_API_KEY || !NIUM_CLIENT_ID || !NIUM_CARD_PROGRAM_ID) {
    throw new Error("nium_cards_not_configured");
  }

  // 1) Create/find customer
  const customer = await niumRequest(
    `/api/v2/client/${NIUM_CLIENT_ID}/customer`,
    "POST",
    {
      firstName: input.cardholder.first_name,
      lastName: input.cardholder.last_name,
      email: input.cardholder.email,
      mobile: input.cardholder.phone,
      customerHashId: input.customer_external_id,
      preferredName: `${input.cardholder.first_name} ${input.cardholder.last_name}`,
    },
    `${input.idempotency_key}:cust`,
  );
  const customerHashId = customer.customerHashId ?? customer.customer_hash_id;

  // 2) Issue card
  const issueBody: Record<string, unknown> = {
    programName: NIUM_CARD_PROGRAM_ID,
    cardType: input.form_factor === "physical" ? "PHYSICAL" : "VIRTUAL",
    issuanceMode: input.form_factor === "digital" ? "TOKENIZED" : "NORMAL",
    currencyCode: input.currency === "XAF" ? "USD" : input.currency, // Nium does not issue XAF
    nameOnCard: `${input.cardholder.first_name} ${input.cardholder.last_name}`.slice(0, 26),
    limits: {
      daily: input.daily_limit,
      monthly: input.monthly_limit,
    },
  };
  const card = await niumRequest(
    `/api/v2/client/${NIUM_CLIENT_ID}/customer/${customerHashId}/card`,
    "POST",
    issueBody,
    input.idempotency_key,
  );

  return {
    provider: "nium",
    provider_card_id: card.cardHashId ?? card.card_hash_id ?? card.id,
    provider_customer_id: customerHashId,
    last4: card.proxyNumber?.slice(-4) ?? card.last4 ?? "0000",
    exp_month: Number(card.expiryMonth ?? card.exp_month ?? 12),
    exp_year: Number(card.expiryYear ?? card.exp_year ?? new Date().getFullYear() + 4),
    brand: card.brand ?? "Visa",
    form_factor: input.form_factor,
    fallback_used: false,
  };
}

// ------------------------------------------------------------
// Kora — existing integration used as fallback
// ------------------------------------------------------------
async function issueViaKora(input: IssueCardInput, reason: string): Promise<IssueCardResult> {
  const ch = await Kora.createCardholder({
    first_name: input.cardholder.first_name,
    last_name: input.cardholder.last_name,
    email: input.cardholder.email,
    phone: input.cardholder.phone,
    date_of_birth: input.cardholder.date_of_birth,
    address: input.cardholder.address,
  }, `${input.idempotency_key}:kora:cust`);
  const koraCustomerId = (ch.data as any)?.customer_id ?? (ch.data as any)?.id;

  const card = await Kora.issueCard({
    customer_id: koraCustomerId,
    currency: input.currency === "XAF" ? "USD" : input.currency,
    amount: input.initial_funding ?? 0,
    name_on_card: `${input.cardholder.first_name} ${input.cardholder.last_name}`,
  }, `${input.idempotency_key}:kora:card`);

  const data: any = card.data ?? {};
  return {
    provider: "kora",
    provider_card_id: data.card_id ?? data.id,
    provider_customer_id: koraCustomerId,
    last4: data.last4 ?? "0000",
    exp_month: Number(data.exp_month ?? 12),
    exp_year: Number(data.exp_year ?? new Date().getFullYear() + 3),
    brand: data.brand ?? "Visa",
    form_factor: input.form_factor,
    fallback_used: true,
    fallback_reason: reason,
  };
}

// ------------------------------------------------------------
// Public router — Nium primary, Kora fallback
// ------------------------------------------------------------
export async function issueCard(input: IssueCardInput): Promise<IssueCardResult> {
  try {
    return await issueViaNium(input);
  } catch (e: any) {
    const reason = e?.message || "nium_unavailable";
    // Physical cards must not silently fall back — Nium sponsors the BIN & shipment.
    if (input.form_factor === "physical") {
      throw new Error(`nium_required_for_physical: ${reason}`);
    }
    try {
      return await issueViaKora(input, reason);
    } catch (kerr: any) {
      if (kerr instanceof KoraApiError) {
        throw new Error(`both_providers_failed: nium=${reason} kora=${kerr.message}`);
      }
      throw new Error(`both_providers_failed: nium=${reason} kora=${kerr?.message ?? "unknown"}`);
    }
  }
}

export async function lifecycleAction(
  provider: CardProvider,
  providerCardId: string,
  action: "freeze" | "unfreeze" | "terminate",
): Promise<void> {
  if (provider === "nium") {
    if (NIUM_MODE === "stub") return;
    const map = { freeze: "block", unfreeze: "unblock", terminate: "close" } as const;
    await niumRequest(
      `/api/v2/client/${NIUM_CLIENT_ID}/card/${providerCardId}/${map[action]}`,
      "POST",
      {},
    );
    return;
  }
  // Kora fallback
  if (action === "freeze") await Kora.freezeCard(providerCardId);
  else if (action === "unfreeze") await Kora.unfreezeCard(providerCardId);
  else await Kora.terminateCard(providerCardId);
}

export interface RevealTokenResult {
  reveal_url?: string;      // Nium-hosted iframe URL (preferred, PCI scope out)
  token?: string;           // short-lived reveal token
  expires_at: string;
  provider: CardProvider;
}

export async function issueRevealToken(
  provider: CardProvider,
  providerCardId: string,
): Promise<RevealTokenResult> {
  const expires = new Date(Date.now() + 60_000).toISOString();
  if (provider === "nium") {
    if (NIUM_MODE === "stub") {
      return { token: `stub_reveal_${crypto.randomUUID()}`, expires_at: expires, provider };
    }
    const res = await niumRequest(
      `/api/v2/client/${NIUM_CLIENT_ID}/card/${providerCardId}/secure-details`,
      "POST",
      { ttl_seconds: 60 },
    );
    return {
      reveal_url: res.secureUrl ?? res.iframeUrl,
      token: res.token,
      expires_at: expires,
      provider,
    };
  }
  const res = await Kora.revealCard(providerCardId);
  return { token: (res.data as any)?.token, expires_at: expires, provider };
}

export function providerHealth(): { primary: CardProvider; nium_configured: boolean; kora_configured: boolean; mode: string } {
  return {
    primary: "nium",
    nium_configured: Boolean(NIUM_API_KEY && NIUM_CLIENT_ID && NIUM_CARD_PROGRAM_ID),
    kora_configured: Boolean(Deno.env.get("KORA_SECRET_KEY")),
    mode: NIUM_MODE,
  };
}
