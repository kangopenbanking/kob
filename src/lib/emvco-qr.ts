/**
 * EMVCo Merchant-Presented QR (MPM) parser — pure, dependency-free.
 * Spec: EMVCo MPM v1.1 (TLV format with CRC16-CCITT/FALSE checksum).
 *
 * Used by:
 *  - Frontend QRPayScanner (decodes user-scanned merchant QR)
 *  - Edge function qr-initiate-payment (re-validates server-side)
 *
 * IMPORTANT: a Deno-compatible mirror lives at
 * supabase/functions/_shared/emvco-qr.ts. Keep both files in sync.
 */

export type EmvQRType = 'static' | 'dynamic';

export interface EmvMerchantAccount {
  /** Tag id 26-51 */
  tag: string;
  /** Globally Unique Identifier (sub-tag 00) — e.g. "KOB", "com.mtn.momo" */
  guid: string;
  /** Merchant ID inside the account info (sub-tag 01 or 02) */
  merchantId?: string;
  /** Raw sub-tags */
  subTags: Record<string, string>;
}

export interface EmvDecoded {
  payloadFormatIndicator: string;          // tag 00 ("01")
  pointOfInitiation: '11' | '12' | string; // tag 01 — 11=static, 12=dynamic
  qrType: EmvQRType;
  merchantAccounts: EmvMerchantAccount[];
  merchantCategoryCode?: string;           // tag 52 (ISO 18245)
  currency?: string;                        // tag 53 → alpha (XAF/XOF/USD/...)
  currencyNumeric?: string;
  amount?: string;                          // tag 54 (string to preserve precision)
  countryCode?: string;                     // tag 58 (ISO 3166-1 alpha-2)
  merchantName?: string;                    // tag 59
  merchantCity?: string;                    // tag 60
  postalCode?: string;                      // tag 61
  additionalData?: Record<string, string>;  // tag 62 sub-tags
  crc: string;                              // tag 63
  /** Stable hash of the canonical merchant target (for idempotency keys + audit). */
  merchantKey: string;
}

const CURRENCY_NUMERIC_TO_ALPHA: Record<string, string> = {
  '950': 'XAF', // Central African CFA
  '952': 'XOF', // West African CFA
  '840': 'USD',
  '978': 'EUR',
  '566': 'NGN',
  '826': 'GBP',
};

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — required by EMVCo §6 */
export function crc16ccitt(input: string): string {
  let crc = 0xffff;
  for (let i = 0; i < input.length; i++) {
    crc ^= input.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

interface Tlv { tag: string; len: number; value: string; }

function parseTlvs(input: string): Tlv[] {
  const out: Tlv[] = [];
  let i = 0;
  while (i < input.length) {
    if (i + 4 > input.length) throw new Error('emvco_truncated_tlv');
    const tag = input.slice(i, i + 2);
    const lenStr = input.slice(i + 2, i + 4);
    const len = parseInt(lenStr, 10);
    if (Number.isNaN(len)) throw new Error('emvco_invalid_length');
    const value = input.slice(i + 4, i + 4 + len);
    if (value.length !== len) throw new Error('emvco_truncated_value');
    out.push({ tag, len, value });
    i += 4 + len;
  }
  return out;
}

function parseSubTags(value: string): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    for (const t of parseTlvs(value)) out[t.tag] = t.value;
  } catch { /* tolerate non-TLV payloads */ }
  return out;
}

export class EmvParseError extends Error {
  code: string;
  constructor(code: string, message?: string) {
    super(message || code);
    this.code = code;
  }
}

export function parseEmvQR(payload: string): EmvDecoded {
  if (!payload || typeof payload !== 'string' || payload.length < 20) {
    throw new EmvParseError('QR_001_INVALID_PAYLOAD');
  }

  // CRC validation: tag 63, 4 hex digits, computed over everything up to and including "6304"
  const crcIdx = payload.lastIndexOf('6304');
  if (crcIdx < 0 || crcIdx + 8 !== payload.length) {
    throw new EmvParseError('QR_001_MISSING_CRC');
  }
  const expected = crc16ccitt(payload.slice(0, crcIdx + 4));
  const actual = payload.slice(crcIdx + 4).toUpperCase();
  if (expected !== actual) {
    throw new EmvParseError('QR_001_BAD_CRC', `expected ${expected} got ${actual}`);
  }

  let tlvs: Tlv[];
  try {
    tlvs = parseTlvs(payload);
  } catch (e: any) {
    throw new EmvParseError('QR_001_TLV_PARSE', e?.message);
  }

  const decoded: Partial<EmvDecoded> = {
    merchantAccounts: [],
    additionalData: {},
  };

  for (const t of tlvs) {
    switch (t.tag) {
      case '00': decoded.payloadFormatIndicator = t.value; break;
      case '01': decoded.pointOfInitiation = t.value as any; break;
      case '52': decoded.merchantCategoryCode = t.value; break;
      case '53':
        decoded.currencyNumeric = t.value;
        decoded.currency = CURRENCY_NUMERIC_TO_ALPHA[t.value];
        break;
      case '54': decoded.amount = t.value; break;
      case '58': decoded.countryCode = t.value; break;
      case '59': decoded.merchantName = t.value; break;
      case '60': decoded.merchantCity = t.value; break;
      case '61': decoded.postalCode = t.value; break;
      case '62': decoded.additionalData = parseSubTags(t.value); break;
      case '63': decoded.crc = t.value; break;
      default: {
        // Merchant Account Information tags 26-51
        const tagNum = parseInt(t.tag, 10);
        if (tagNum >= 26 && tagNum <= 51) {
          const sub = parseSubTags(t.value);
          decoded.merchantAccounts!.push({
            tag: t.tag,
            guid: sub['00'] || '',
            merchantId: sub['01'] || sub['02'],
            subTags: sub,
          });
        }
      }
    }
  }

  decoded.qrType = decoded.pointOfInitiation === '12' ? 'dynamic' : 'static';

  // Pick canonical merchant target: prefer KOB, then known MoMo GUIDs, else first.
  const accounts = decoded.merchantAccounts || [];
  const preferred = accounts.find(a => /kob/i.test(a.guid))
    || accounts.find(a => /(mtn|orange|momo|moov)/i.test(a.guid))
    || accounts[0];
  const merchantKey = preferred
    ? `${preferred.guid || 'UNKNOWN'}:${preferred.merchantId || preferred.tag}`
    : 'UNKNOWN:UNKNOWN';

  return {
    payloadFormatIndicator: decoded.payloadFormatIndicator || '',
    pointOfInitiation: decoded.pointOfInitiation || '11',
    qrType: decoded.qrType,
    merchantAccounts: accounts,
    merchantCategoryCode: decoded.merchantCategoryCode,
    currency: decoded.currency,
    currencyNumeric: decoded.currencyNumeric,
    amount: decoded.amount,
    countryCode: decoded.countryCode,
    merchantName: decoded.merchantName,
    merchantCity: decoded.merchantCity,
    postalCode: decoded.postalCode,
    additionalData: decoded.additionalData || {},
    crc: decoded.crc || '',
    merchantKey,
  };
}

/** CEMAC/UEMOA + commonly supported regions. Tightened in edge function. */
export const SUPPORTED_QR_CURRENCIES = ['XAF', 'XOF', 'USD', 'EUR'] as const;
export const SUPPORTED_QR_COUNTRIES = ['CM', 'CF', 'TD', 'CG', 'GQ', 'GA', 'BJ', 'BF', 'CI', 'GW', 'ML', 'NE', 'SN', 'TG'] as const;

export function isSupportedQR(d: EmvDecoded): { ok: true } | { ok: false; reason: string } {
  if (!d.currency || !(SUPPORTED_QR_CURRENCIES as readonly string[]).includes(d.currency)) {
    return { ok: false, reason: 'unsupported_currency' };
  }
  if (d.countryCode && !(SUPPORTED_QR_COUNTRIES as readonly string[]).includes(d.countryCode)) {
    return { ok: false, reason: 'unsupported_country' };
  }
  if (!d.merchantAccounts.length) return { ok: false, reason: 'no_merchant_account' };
  return { ok: true };
}

/** Build a deterministic short hash for the QR (server-side audit + idempotency). */
export async function hashQRPayload(payload: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
