/**
 * Mobile-Money provider error normalization.
 *
 * Maps raw provider error codes (MTN MoMo Collection API v2, Orange Money OM API v1,
 * Wave, Safaricom M-Pesa Daraja v2, Airtel Money Open API v1) onto a single KOB
 * taxonomy so SDKs and webhooks can branch deterministically.
 *
 * Reference: GSMA Mobile Money API v1.2 §6 — Error handling.
 */

export type MoMoProvider = "mtn" | "orange" | "wave" | "mpesa" | "airtel";

export type NormalizedMoMoErrorCode =
  | "insufficient_funds"
  | "invalid_msisdn"
  | "subscriber_not_found"
  | "subscriber_pin_blocked"
  | "subscriber_kyc_incomplete"
  | "subscriber_limit_exceeded"
  | "duplicate_transaction"
  | "transaction_expired"
  | "transaction_declined"
  | "provider_timeout"
  | "provider_unavailable"
  | "currency_not_supported"
  | "amount_below_minimum"
  | "amount_above_maximum"
  | "internal_error";

export interface NormalizedMoMoError {
  provider: MoMoProvider;
  raw_code: string;
  raw_message?: string;
  normalized_code: NormalizedMoMoErrorCode;
  retryable: boolean;
}

const RETRYABLE = new Set<NormalizedMoMoErrorCode>([
  "provider_timeout",
  "provider_unavailable",
  "internal_error",
]);

const MAP: Record<MoMoProvider, Record<string, NormalizedMoMoErrorCode>> = {
  mtn: {
    NOT_ENOUGH_FUNDS: "insufficient_funds",
    PAYEE_NOT_ALLOWED_TO_RECEIVE: "subscriber_not_found",
    PAYER_NOT_FOUND: "subscriber_not_found",
    INVALID_ACCOUNT_HOLDER_STATUS: "subscriber_kyc_incomplete",
    INVALID_AMOUNT: "amount_below_minimum",
    APPROVAL_REJECTED: "transaction_declined",
    EXPIRED: "transaction_expired",
    INTERNAL_PROCESSING_ERROR: "internal_error",
    SERVICE_UNAVAILABLE: "provider_unavailable",
    TIMEOUT: "provider_timeout",
    DUPLICATE_REFERENCE_ID: "duplicate_transaction",
    PAYER_LIMIT_REACHED: "subscriber_limit_exceeded",
    PIN_BLOCKED: "subscriber_pin_blocked",
  },
  orange: {
    "60019": "insufficient_funds",
    "60001": "invalid_msisdn",
    "60002": "subscriber_not_found",
    "60003": "subscriber_kyc_incomplete",
    "60004": "subscriber_limit_exceeded",
    "60020": "transaction_declined",
    "60021": "transaction_expired",
    "60099": "internal_error",
    "503": "provider_unavailable",
    "504": "provider_timeout",
  },
  wave: {
    INSUFFICIENT_FUNDS: "insufficient_funds",
    INVALID_RECIPIENT: "invalid_msisdn",
    RECIPIENT_NOT_FOUND: "subscriber_not_found",
    AMOUNT_TOO_SMALL: "amount_below_minimum",
    AMOUNT_TOO_LARGE: "amount_above_maximum",
    DECLINED: "transaction_declined",
    TIMED_OUT: "provider_timeout",
    SERVICE_DOWN: "provider_unavailable",
  },
  mpesa: {
    "1": "insufficient_funds",
    "2": "subscriber_pin_blocked",
    "5": "transaction_declined",
    "26": "internal_error",
    "1001": "subscriber_limit_exceeded",
    "1037": "provider_timeout",
    "1019": "transaction_expired",
    "2001": "subscriber_not_found",
  },
  airtel: {
    ESB000001: "internal_error",
    ESB000004: "subscriber_not_found",
    ESB000008: "insufficient_funds",
    ESB000011: "duplicate_transaction",
    ESB000014: "subscriber_kyc_incomplete",
    ESB000033: "transaction_declined",
    DP00800001006: "provider_timeout",
  },
};

export function normalizeMoMoError(
  provider: MoMoProvider,
  rawCode: string,
  rawMessage?: string,
): NormalizedMoMoError {
  const table = MAP[provider] || {};
  const normalized = table[rawCode] || "internal_error";
  return {
    provider,
    raw_code: rawCode,
    raw_message: rawMessage,
    normalized_code: normalized,
    retryable: RETRYABLE.has(normalized),
  };
}
