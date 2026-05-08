/**
 * Kora (Korapay) API client for Virtual Card Issuing middleware.
 * Reference: https://developers.korapay.com/docs/issue-virtual-cards
 *
 * - Auth via Bearer secret key (server-side only).
 * - HMAC-SHA256 webhook signature verification (`x-korapay-signature`).
 * - Structured errors mapped to RFC 7807-style codes the API surface uses.
 * - 429 / 5xx retry with exponential backoff.
 */

const DEFAULT_BASE_URL = "https://api.korapay.com/merchant/api/v1";

export interface KoraRequestOptions {
  method: "GET" | "POST" | "PUT" | "DELETE";
  path: string;
  body?: unknown;
  idempotencyKey?: string;
  query?: Record<string, string | number | undefined>;
}

export interface KoraResponse<T = unknown> {
  status: boolean;
  message?: string;
  data?: T;
}

export class KoraApiError extends Error {
  public readonly httpStatus: number;
  public readonly code: string;
  public readonly raw: unknown;
  constructor(message: string, httpStatus: number, code: string, raw: unknown) {
    super(message);
    this.name = "KoraApiError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.raw = raw;
  }
}

function getEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`${name} is not configured`);
  return v;
}

function mapKoraError(httpStatus: number, body: unknown): { code: string; message: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const msg = String(b.message ?? "Kora API error");

  // Map known patterns to our public RFC 7807 catalogue.
  if (httpStatus === 401 || /unauthor/i.test(msg)) return { code: "card_provider_unauthorized", message: msg };
  if (httpStatus === 403) return { code: "card_provider_forbidden", message: msg };
  if (httpStatus === 404) return { code: "card_not_found", message: msg };
  if (httpStatus === 422 || /invalid|validation/i.test(msg)) return { code: "card_validation_failed", message: msg };
  if (httpStatus === 429) return { code: "rate_limited", message: msg };
  if (/insufficient/i.test(msg)) return { code: "card_insufficient_funds", message: msg };
  if (/kyc/i.test(msg)) return { code: "card_kyc_required", message: msg };
  if (/terminat/i.test(msg)) return { code: "card_terminated", message: msg };
  if (httpStatus >= 500) return { code: "card_provider_unavailable", message: msg };
  return { code: "card_provider_error", message: msg };
}

export async function koraRequest<T = unknown>(opts: KoraRequestOptions): Promise<KoraResponse<T>> {
  const baseUrl = (Deno.env.get("KORA_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const secretKey = getEnv("KORA_SECRET_KEY");

  const qs = opts.query
    ? "?" + new URLSearchParams(
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined)
          .map(([k, v]) => [k, String(v)])
      ).toString()
    : "";

  const url = `${baseUrl}${opts.path}${qs}`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (opts.idempotencyKey) headers["X-Idempotency-Key"] = opts.idempotencyKey;

  const init: RequestInit = { method: opts.method, headers };
  if (opts.body !== undefined && opts.method !== "GET") {
    init.body = JSON.stringify(opts.body);
  }

  // Retry: 3 attempts on 429 / 5xx with exp backoff.
  const maxAttempts = 3;
  let lastErr: unknown = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, init);
      const text = await res.text();
      let body: unknown = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = { message: text }; }

      if (!res.ok) {
        if ((res.status === 429 || res.status >= 500) && attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
          continue;
        }
        const { code, message } = mapKoraError(res.status, body);
        throw new KoraApiError(message, res.status, code, body);
      }

      return (body ?? {}) as KoraResponse<T>;
    } catch (e) {
      lastErr = e;
      if (e instanceof KoraApiError) throw e;
      if (attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, 250 * Math.pow(2, attempt - 1)));
    }
  }
  throw new KoraApiError(
    `Kora network error: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    0,
    "card_provider_unavailable",
    lastErr,
  );
}

// ---------------------------------------------------------------------
// Webhook signature verification — HMAC-SHA256(rawBody, KORA_WEBHOOK_SECRET)
// ---------------------------------------------------------------------
export async function verifyKoraSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const secret = Deno.env.get("KORA_WEBHOOK_SECRET");
  if (!secret) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time compare
  const a = expected.toLowerCase();
  const b = signatureHeader.trim().toLowerCase();
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ---------------------------------------------------------------------
// High-level helpers
// ---------------------------------------------------------------------
export const Kora = {
  createCardholder: (payload: Record<string, unknown>, idem?: string) =>
    koraRequest({ method: "POST", path: "/virtual-cards/customers", body: payload, idempotencyKey: idem }),

  issueCard: (payload: Record<string, unknown>, idem?: string) =>
    koraRequest({ method: "POST", path: "/virtual-cards", body: payload, idempotencyKey: idem }),

  getCard: (cardId: string) =>
    koraRequest({ method: "GET", path: `/virtual-cards/${encodeURIComponent(cardId)}` }),

  fundCard: (cardId: string, amount: number, currency: string, idem?: string) =>
    koraRequest({
      method: "POST",
      path: `/virtual-cards/${encodeURIComponent(cardId)}/fund`,
      body: { amount, currency },
      idempotencyKey: idem,
    }),

  withdrawFromCard: (cardId: string, amount: number, currency: string, idem?: string) =>
    koraRequest({
      method: "POST",
      path: `/virtual-cards/${encodeURIComponent(cardId)}/withdraw`,
      body: { amount, currency },
      idempotencyKey: idem,
    }),

  freezeCard: (cardId: string, idem?: string) =>
    koraRequest({ method: "POST", path: `/virtual-cards/${encodeURIComponent(cardId)}/freeze`, idempotencyKey: idem }),

  unfreezeCard: (cardId: string, idem?: string) =>
    koraRequest({ method: "POST", path: `/virtual-cards/${encodeURIComponent(cardId)}/unfreeze`, idempotencyKey: idem }),

  terminateCard: (cardId: string, idem?: string) =>
    koraRequest({ method: "POST", path: `/virtual-cards/${encodeURIComponent(cardId)}/terminate`, idempotencyKey: idem }),

  listTransactions: (cardId: string, page = 1, limit = 50) =>
    koraRequest({ method: "GET", path: `/virtual-cards/${encodeURIComponent(cardId)}/transactions`, query: { page, limit } }),
};
