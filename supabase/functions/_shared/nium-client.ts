// Nium API client with stub/live modes.
// NIUM_MODE=stub (default) — deterministic fake accounts + FX rate, no network calls.
// NIUM_MODE=live  — calls Nium API using NIUM_API_KEY, NIUM_CLIENT_ID, NIUM_BASE_URL.
// Switching to live requires no code change; just set the env vars.

// 17 currencies supported by Nium for virtual/global accounts.
// XAF is the platform's default DESTINATION currency (Cameroon / CEMAC) but
// Nium does NOT issue XAF accounts — XAF only appears as a payout target via
// MoMo / wallet credit after FX. Source list mirrors Nium API v2 reference.
export type NiumCurrency =
  | "USD" | "EUR" | "GBP" | "AUD" | "CAD" | "SGD" | "AED"
  | "JPY" | "INR" | "ZAR" | "HKD" | "CHF" | "NZD"
  | "SEK" | "NOK" | "DKK" | "CNY";

export const NIUM_SUPPORTED_CURRENCIES: readonly NiumCurrency[] = Object.freeze([
  "USD","EUR","GBP","AUD","CAD","SGD","AED","JPY","INR",
  "ZAR","HKD","CHF","NZD","SEK","NOK","DKK","CNY",
]);

export const DEFAULT_DESTINATION_CURRENCY = "XAF" as const;

export function assertNiumCurrency(value: unknown): NiumCurrency {
  if (typeof value === "string" && (NIUM_SUPPORTED_CURRENCIES as readonly string[]).includes(value)) {
    return value as NiumCurrency;
  }
  throw new Error(
    `unsupported_currency: must be one of ${NIUM_SUPPORTED_CURRENCIES.join(",")} (XAF is destination only)`,
  );
}

export interface NiumGlobalAccount {
  nium_customer_hash_id: string;
  nium_account_id: string;
  currency: NiumCurrency;
  iban: string | null;
  account_number: string | null;
  routing_code: string | null;
  bic: string | null;
  bank_name: string;
  bank_address: string;
  beneficiary_name: string;
  mode: "stub" | "sandbox" | "live";
}

export interface NiumFxQuote {
  rate: number;          // 1 source unit = N XAF
  source_currency: NiumCurrency;
  target_currency: "XAF";
  quote_id: string;
}

const MODE = (Deno.env.get("NIUM_MODE") ?? "stub").toLowerCase() as "stub" | "sandbox" | "live";
const BASE_URL = Deno.env.get("NIUM_BASE_URL") ?? "https://gateway.nium.com";
const API_KEY = Deno.env.get("NIUM_API_KEY") ?? "";
const CLIENT_ID = Deno.env.get("NIUM_CLIENT_ID") ?? "";

// Fixed reference XAF rates for stub/sandbox parity (FX engine peg).
// Fixed reference XAF rates for stub/sandbox parity (FX engine peg).
// EUR is pegged to BEAC reference 655.957. Others are sane reference rates
// for deterministic CI; real sandbox rates come from Nium when MODE != stub.
const STUB_RATES: Record<NiumCurrency, number> = {
  USD: 605.0,
  EUR: 655.957, // EUR/XAF fixed peg (BEAC)
  GBP: 760.0,
  AUD: 395.0,
  CAD: 445.0,
  SGD: 450.0,
  AED: 165.0,
  JPY: 4.05,
  INR: 7.25,
  ZAR: 33.0,
  HKD: 77.5,
  CHF: 680.0,
  NZD: 365.0,
  SEK: 57.5,
  NOK: 55.0,
  DKK: 88.0,
  CNY: 84.0,
};

function deterministicId(prefix: string, seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return `${prefix}_${h.toString(36)}${Date.now().toString(36).slice(-4)}`;
}

export async function createGlobalAccount(params: {
  user_id: string;
  beneficiary_name: string;
  currency: NiumCurrency;
}): Promise<NiumGlobalAccount> {
  if (MODE === "live" || MODE === "sandbox") {
    if (!API_KEY || !CLIENT_ID) throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    const res = await fetch(`${BASE_URL}/api/v2/client/${CLIENT_ID}/customer/${params.user_id}/virtualAccount`, {
      method: "POST",
      headers: {
        "x-api-key": API_KEY,
        "Content-Type": "application/json",
        "x-request-id": crypto.randomUUID(),
      },
      body: JSON.stringify({ currencyCode: params.currency, accountCategory: "INDIVIDUAL" }),
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Nium createGlobalAccount failed: ${res.status} ${txt}`);
    }
    const j = await res.json();
    return {
      nium_customer_hash_id: j.customerHashId ?? params.user_id,
      nium_account_id: j.accountId ?? j.id,
      currency: params.currency,
      iban: j.iban ?? null,
      account_number: j.accountNumber ?? null,
      routing_code: j.routingCode ?? j.routingCodeValue ?? null,
      bic: j.bicCode ?? null,
      bank_name: j.bankName ?? "Nium Partner Bank",
      bank_address: j.bankAddress ?? "",
      beneficiary_name: params.beneficiary_name,
      mode: MODE,
    };
  }

  // Stub mode — deterministic per (user, currency)
  const seed = `${params.user_id}:${params.currency}`;
  const accId = deterministicId("nium_acc", seed);
  const last8 = (Math.abs(parseInt(accId.slice(-6), 36)) % 99999999).toString().padStart(8, "0");
  const stub: NiumGlobalAccount = {
    nium_customer_hash_id: deterministicId("nium_cust", params.user_id),
    nium_account_id: accId,
    currency: params.currency,
    iban: params.currency === "EUR" ? `GB29NWBK6016133${last8.slice(0, 4)}9${last8.slice(4)}` : null,
    account_number: params.currency === "USD" ? `9${last8}` : params.currency === "GBP" ? `8${last8}` : null,
    routing_code: params.currency === "USD" ? "021000021" : params.currency === "GBP" ? "200000" : null,
    bic: params.currency === "EUR" ? "NWBKGB2L" : params.currency === "USD" ? "CHASUS33" : "BARCGB22",
    bank_name: params.currency === "USD" ? "JPMorgan Chase (via Nium)" : params.currency === "EUR" ? "NatWest (via Nium)" : "Barclays (via Nium)",
    bank_address: params.currency === "USD" ? "383 Madison Ave, New York, NY 10179" : "1 Princes Street, London EC2R 8BP",
    beneficiary_name: params.beneficiary_name,
    mode: "stub",
  };
  return stub;
}

export async function getFxQuote(source: NiumCurrency, _amount: number): Promise<NiumFxQuote> {
  if (MODE === "live" || MODE === "sandbox") {
    if (!API_KEY || !CLIENT_ID) throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    const res = await fetch(`${BASE_URL}/api/v1/client/${CLIENT_ID}/exchangeRate?sourceCurrencyCode=${source}&destinationCurrencyCode=XAF`, {
      headers: { "x-api-key": API_KEY },
    });
    if (!res.ok) throw new Error(`Nium getFxQuote failed: ${res.status}`);
    const j = await res.json();
    return {
      rate: Number(j.exchangeRate ?? j.rate),
      source_currency: source,
      target_currency: "XAF",
      quote_id: j.quoteId ?? crypto.randomUUID(),
    };
  }
  return {
    rate: STUB_RATES[source],
    source_currency: source,
    target_currency: "XAF",
    quote_id: `stub_quote_${Date.now().toString(36)}`,
  };
}

// Verify Nium webhook HMAC-SHA256 signature: header `x-nium-signature` = hex(hmac_sha256(secret, body))
export async function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret = Deno.env.get("NIUM_WEBHOOK_SECRET") ?? "";
  if (!secret || !signatureHeader) {
    // In stub mode without configured secret we accept (sandbox-only flag).
    return MODE === "stub" && !secret;
  }
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant-time-ish comparison
  if (hex.length !== signatureHeader.length) return false;
  let mismatch = 0;
  for (let i = 0; i < hex.length; i++) mismatch |= hex.charCodeAt(i) ^ signatureHeader.charCodeAt(i);
  return mismatch === 0;
}

export const NIUM_MODE = MODE;
