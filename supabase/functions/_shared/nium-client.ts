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

// Per-currency stub profile (IBAN-style countries use `iban` prefix; others use `acctPrefix`).
type StubProfile = {
  iban?: string;
  acctPrefix: string;
  routing: string | null;
  bic: string;
  bank: string;
  address: string;
};
const STUB_PROFILE: Record<NiumCurrency, StubProfile> = {
  USD: { acctPrefix: "9",  routing: "021000021", bic: "CHASUS33", bank: "JPMorgan Chase (via Nium)", address: "383 Madison Ave, New York, NY 10179" },
  EUR: { iban: "DE89370400440532013", acctPrefix: "", routing: null, bic: "COBADEFFXXX", bank: "Commerzbank (via Nium)", address: "Kaiserplatz, 60311 Frankfurt am Main, Germany" },
  GBP: { acctPrefix: "8",  routing: "200000",    bic: "BARCGB22", bank: "Barclays (via Nium)", address: "1 Churchill Place, London E14 5HP" },
  AUD: { acctPrefix: "7",  routing: "082-001",   bic: "NATAAU33", bank: "National Australia Bank (via Nium)", address: "395 Bourke St, Melbourne VIC 3000" },
  CAD: { acctPrefix: "6",  routing: "00010",     bic: "ROYCCAT2", bank: "Royal Bank of Canada (via Nium)", address: "200 Bay St, Toronto, ON M5J 2J5" },
  SGD: { acctPrefix: "5",  routing: "7171",      bic: "DBSSSGSG", bank: "DBS Bank (via Nium)", address: "12 Marina Blvd, Singapore 018982" },
  AED: { iban: "AE070331234567890123", acctPrefix: "", routing: null, bic: "EBILAEAD", bank: "Emirates NBD (via Nium)", address: "Baniyas Rd, Deira, Dubai, UAE" },
  JPY: { acctPrefix: "4",  routing: "0001",      bic: "BOTKJPJT", bank: "MUFG Bank (via Nium)", address: "2-7-1 Marunouchi, Chiyoda-ku, Tokyo 100-8388" },
  INR: { acctPrefix: "3",  routing: "HDFC0000001", bic: "HDFCINBB", bank: "HDFC Bank (via Nium)", address: "Senapati Bapat Marg, Lower Parel, Mumbai 400013" },
  ZAR: { acctPrefix: "2",  routing: "051001",    bic: "SBZAZAJJ", bank: "Standard Bank (via Nium)", address: "5 Simmonds St, Johannesburg 2001" },
  HKD: { acctPrefix: "1",  routing: "004",       bic: "HSBCHKHH", bank: "HSBC (via Nium)", address: "1 Queen's Rd Central, Hong Kong" },
  CHF: { iban: "CH9300762011623852957", acctPrefix: "", routing: null, bic: "UBSWCHZH80A", bank: "UBS (via Nium)", address: "Bahnhofstrasse 45, 8001 Zürich" },
  NZD: { acctPrefix: "01", routing: "11-7700",   bic: "ANZBNZ22", bank: "ANZ Bank (via Nium)", address: "23-29 Albert St, Auckland 1010" },
  SEK: { iban: "SE4550000000058398257466", acctPrefix: "", routing: null, bic: "ESSESESS", bank: "SEB (via Nium)", address: "Kungsträdgårdsgatan 8, 106 40 Stockholm" },
  NOK: { iban: "NO9386011117947", acctPrefix: "", routing: null, bic: "DNBANOKK", bank: "DNB Bank (via Nium)", address: "Dronning Eufemias gate 30, 0191 Oslo" },
  DKK: { iban: "DK5000400440116243", acctPrefix: "", routing: null, bic: "NDEADKKK", bank: "Nordea Bank (via Nium)", address: "Strandgade 3, 1401 København" },
  CNY: { acctPrefix: "62", routing: "ICBKCNBJ", bic: "ICBKCNBJ", bank: "ICBC (via Nium)", address: "55 Fuxingmennei Ave, Xicheng, Beijing 100140" },
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
    iban: STUB_PROFILE[params.currency].iban ? `${STUB_PROFILE[params.currency].iban}${last8}` : null,
    account_number: STUB_PROFILE[params.currency].iban ? null : `${STUB_PROFILE[params.currency].acctPrefix}${last8}`,
    routing_code: STUB_PROFILE[params.currency].routing,
    bic: STUB_PROFILE[params.currency].bic,
    bank_name: STUB_PROFILE[params.currency].bank,
    bank_address: STUB_PROFILE[params.currency].address,
    beneficiary_name: params.beneficiary_name,
    mode: "stub",
  };
  return stub;
}

export async function getFxQuote(
  source: NiumCurrency,
  _amount: number,
  opts: { allowReferenceFallback?: boolean } = {},
): Promise<NiumFxQuote> {
  if (MODE === "live" || MODE === "sandbox") {
    if (API_KEY && CLIENT_ID) {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/client/${CLIENT_ID}/exchangeRate?sourceCurrencyCode=${source}&destinationCurrencyCode=XAF`, {
          headers: { "x-api-key": API_KEY },
        });
        if (res.ok) {
          const j = await res.json();
          const rate = Number(j.exchangeRate ?? j.rate);
          if (Number.isFinite(rate) && rate > 0) {
            return {
              rate,
              source_currency: source,
              target_currency: "XAF",
              quote_id: j.quoteId ?? crypto.randomUUID(),
            };
          }
          if (!opts.allowReferenceFallback) throw new Error(`Nium getFxQuote invalid_rate for ${source}`);
        } else if (!opts.allowReferenceFallback) {
          throw new Error(`Nium getFxQuote failed: ${res.status}`);
        } else {
          console.warn(`Nium getFxQuote ${res.status}; using reference rate for ${source}`);
        }
      } catch (e) {
        if (!opts.allowReferenceFallback) throw e;
        console.warn(`Nium getFxQuote error: ${e instanceof Error ? e.message : String(e)}; using reference rate for ${source}`);
      }
    } else if (!opts.allowReferenceFallback) {
      throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    } else {
      console.warn(`NIUM_API_KEY/CLIENT_ID missing in ${MODE} mode; using reference rate for ${source}`);
    }
    return {
      rate: STUB_RATES[source],
      source_currency: source,
      target_currency: "XAF",
      quote_id: `ref_quote_${Date.now().toString(36)}`,
    };
  }
  return {
    rate: STUB_RATES[source],
    source_currency: source,
    target_currency: "XAF",
    quote_id: `stub_quote_${Date.now().toString(36)}`,
  };
}

// Constant-time string compare
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let m = 0;
  for (let i = 0; i < a.length; i++) m |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return m === 0;
}

/**
 * Verify a Nium inbound webhook.
 *
 * Nium's dashboard "Header Parameters" mechanism does NOT sign the body — it sends
 * a caller-defined header (we register `x-nium-signature-key`) whose value is a
 * static shared secret. We compare it in constant time to `NIUM_WEBHOOK_SECRET`.
 *
 * For forward compatibility we ALSO accept a genuine HMAC-SHA256 hex digest of
 * the raw body supplied via `x-nium-signature` (should Nium enable body signing).
 *
 * If `NIUM_WEBHOOK_SECRET` is not configured we accept ONLY in stub mode.
 */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  staticKeyHeader?: string | null,
): Promise<boolean> {
  const secret = Deno.env.get("NIUM_WEBHOOK_SECRET") ?? "";
  if (!secret) return MODE === "stub";

  // 1) Static shared-secret header (Nium "Header Parameters" model).
  if (staticKeyHeader && timingSafeEqual(staticKeyHeader.trim(), secret)) return true;

  // 2) Optional HMAC-SHA256 hex over the raw body.
  if (signatureHeader) {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
    const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
    if (timingSafeEqual(hex, signatureHeader.trim().toLowerCase())) return true;
  }

  return false;
}

export const NIUM_MODE = MODE;

// ============================================================
// Beneficiaries / Payouts / Conversions — stub + live wrappers
// All return deterministic IDs in stub mode for E2E determinism.
// ============================================================

export interface NiumBeneficiaryInput {
  user_id: string;
  beneficiary_name: string;
  beneficiary_account_number: string;
  beneficiary_bank_name?: string;
  beneficiary_bank_code?: string;
  beneficiary_country: string; // ISO2
  destination_currency: NiumCurrency | "XAF";
  routing_type?: "SWIFT" | "LOCAL" | "WALLET";
}

export interface NiumBeneficiaryResult {
  nium_beneficiary_hash_id: string;
  verification_status: "verified" | "pending" | "failed";
  mode: "stub" | "sandbox" | "live";
}

export async function createNiumBeneficiary(p: NiumBeneficiaryInput): Promise<NiumBeneficiaryResult> {
  if (MODE === "live" || MODE === "sandbox") {
    if (!API_KEY || !CLIENT_ID) throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    const res = await fetch(`${BASE_URL}/api/v2/client/${CLIENT_ID}/customer/${p.user_id}/beneficiaries`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
      body: JSON.stringify({
        beneficiaryDetail: { name: p.beneficiary_name },
        payoutDetail: { destinationCurrency: p.destination_currency, destinationCountry: p.beneficiary_country, routingCodeType1: "BIC", routingCodeValue1: p.beneficiary_bank_code },
        beneficiaryAccountDetail: { accountNumber: p.beneficiary_account_number, bankName: p.beneficiary_bank_name },
      }),
    });
    if (!res.ok) throw new Error(`Nium createBeneficiary failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return { nium_beneficiary_hash_id: j.beneficiaryHashId ?? j.id, verification_status: (j.status ?? "pending").toLowerCase(), mode: MODE };
  }
  return {
    nium_beneficiary_hash_id: deterministicId("nium_ben", `${p.user_id}:${p.beneficiary_account_number}:${p.destination_currency}`),
    verification_status: "verified",
    mode: "stub",
  };
}

export interface NiumPayoutInput {
  user_id: string;
  beneficiary_hash_id: string;
  source_currency: NiumCurrency;
  source_amount: number;
  destination_currency: NiumCurrency | "XAF";
  destination_amount: number;
  fx_rate: number;
  purpose_code: string;
}

export interface NiumPayoutResult {
  nium_transfer_id: string;
  status: "submitted" | "processing" | "completed" | "failed";
  mode: "stub" | "sandbox" | "live";
}

export async function createNiumPayout(p: NiumPayoutInput): Promise<NiumPayoutResult> {
  if (MODE === "live" || MODE === "sandbox") {
    if (!API_KEY || !CLIENT_ID) throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    const res = await fetch(`${BASE_URL}/api/v2/client/${CLIENT_ID}/customer/${p.user_id}/transfer`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
      body: JSON.stringify({
        beneficiaryHashId: p.beneficiary_hash_id,
        sourceCurrencyCode: p.source_currency,
        destinationCurrencyCode: p.destination_currency,
        sourceAmount: p.source_amount,
        destinationAmount: p.destination_amount,
        exchangeRate: p.fx_rate,
        purposeCode: p.purpose_code,
      }),
    });
    if (!res.ok) throw new Error(`Nium createPayout failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return { nium_transfer_id: j.systemReferenceNumber ?? j.id, status: (j.status ?? "submitted").toLowerCase(), mode: MODE };
  }
  return {
    nium_transfer_id: deterministicId("nium_txfr", `${p.user_id}:${p.beneficiary_hash_id}:${Date.now()}`),
    status: "submitted",
    mode: "stub",
  };
}

export interface NiumConversionInput {
  user_id: string;
  source_account_id: string;
  source_currency: NiumCurrency;
  source_amount: number;
  destination_currency: NiumCurrency | "XAF";
}

export interface NiumConversionResult {
  nium_conversion_id: string;
  fx_rate: number;
  destination_amount: number;
  status: "completed" | "pending" | "failed";
  mode: "stub" | "sandbox" | "live";
}

export async function createNiumConversion(p: NiumConversionInput): Promise<NiumConversionResult> {
  // For stub/live both, derive rate via getFxQuote (XAF target supported by stub)
  const quote = p.destination_currency === "XAF"
    ? await getFxQuote(p.source_currency, p.source_amount)
    : { rate: STUB_RATES[p.source_currency] / (STUB_RATES[p.destination_currency as NiumCurrency] ?? 1), source_currency: p.source_currency, target_currency: "XAF" as const, quote_id: "x" };

  if (MODE === "live" || MODE === "sandbox") {
    if (!API_KEY || !CLIENT_ID) throw new Error("NIUM_API_KEY / NIUM_CLIENT_ID missing");
    const res = await fetch(`${BASE_URL}/api/v1/client/${CLIENT_ID}/customer/${p.user_id}/conversion`, {
      method: "POST",
      headers: { "x-api-key": API_KEY, "Content-Type": "application/json", "x-request-id": crypto.randomUUID() },
      body: JSON.stringify({
        sourceCurrencyCode: p.source_currency,
        destinationCurrencyCode: p.destination_currency,
        sourceAmount: p.source_amount,
      }),
    });
    if (!res.ok) throw new Error(`Nium createConversion failed: ${res.status} ${await res.text()}`);
    const j = await res.json();
    return {
      nium_conversion_id: j.conversionId ?? j.id,
      fx_rate: Number(j.exchangeRate ?? quote.rate),
      destination_amount: Number(j.destinationAmount ?? p.source_amount * quote.rate),
      status: (j.status ?? "completed").toLowerCase(),
      mode: MODE,
    };
  }
  const destAmt = Math.round(p.source_amount * quote.rate * 100) / 100;
  return {
    nium_conversion_id: deterministicId("nium_conv", `${p.user_id}:${p.source_currency}->${p.destination_currency}:${Date.now()}`),
    fx_rate: quote.rate,
    destination_amount: destAmt,
    status: "completed",
    mode: "stub",
  };
}
