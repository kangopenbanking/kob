// Deno mirror of src/lib/emvco-qr.ts — keep in sync.
// EMVCo MPM v1.1 parser used by qr-initiate-payment edge function.

export type EmvQRType = 'static' | 'dynamic';

export interface EmvMerchantAccount {
  tag: string;
  guid: string;
  merchantId?: string;
  subTags: Record<string, string>;
}

export interface EmvDecoded {
  payloadFormatIndicator: string;
  pointOfInitiation: string;
  qrType: EmvQRType;
  merchantAccounts: EmvMerchantAccount[];
  merchantCategoryCode?: string;
  currency?: string;
  currencyNumeric?: string;
  amount?: string;
  countryCode?: string;
  merchantName?: string;
  merchantCity?: string;
  postalCode?: string;
  additionalData?: Record<string, string>;
  crc: string;
  merchantKey: string;
}

const CURRENCY_NUMERIC_TO_ALPHA: Record<string, string> = {
  '950': 'XAF', '952': 'XOF', '840': 'USD', '978': 'EUR', '566': 'NGN', '826': 'GBP',
};

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
    const len = parseInt(input.slice(i + 2, i + 4), 10);
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
  try { for (const t of parseTlvs(value)) out[t.tag] = t.value; } catch { /* ignore */ }
  return out;
}

export class EmvParseError extends Error {
  code: string;
  constructor(code: string, message?: string) { super(message || code); this.code = code; }
}

export function parseEmvQR(payload: string): EmvDecoded {
  if (!payload || typeof payload !== 'string' || payload.length < 20) {
    throw new EmvParseError('QR_001_INVALID_PAYLOAD');
  }
  const crcIdx = payload.lastIndexOf('6304');
  if (crcIdx < 0 || crcIdx + 8 !== payload.length) throw new EmvParseError('QR_001_MISSING_CRC');
  const expected = crc16ccitt(payload.slice(0, crcIdx + 4));
  const actual = payload.slice(crcIdx + 4).toUpperCase();
  if (expected !== actual) throw new EmvParseError('QR_001_BAD_CRC', `expected ${expected} got ${actual}`);

  let tlvs: Tlv[];
  try { tlvs = parseTlvs(payload); } catch (e) { throw new EmvParseError('QR_001_TLV_PARSE', (e as Error).message); }

  const decoded: Partial<EmvDecoded> = { merchantAccounts: [], additionalData: {} };

  for (const t of tlvs) {
    switch (t.tag) {
      case '00': decoded.payloadFormatIndicator = t.value; break;
      case '01': decoded.pointOfInitiation = t.value; break;
      case '52': decoded.merchantCategoryCode = t.value; break;
      case '53': decoded.currencyNumeric = t.value; decoded.currency = CURRENCY_NUMERIC_TO_ALPHA[t.value]; break;
      case '54': decoded.amount = t.value; break;
      case '58': decoded.countryCode = t.value; break;
      case '59': decoded.merchantName = t.value; break;
      case '60': decoded.merchantCity = t.value; break;
      case '61': decoded.postalCode = t.value; break;
      case '62': decoded.additionalData = parseSubTags(t.value); break;
      case '63': decoded.crc = t.value; break;
      default: {
        const n = parseInt(t.tag, 10);
        if (n >= 26 && n <= 51) {
          const sub = parseSubTags(t.value);
          decoded.merchantAccounts!.push({ tag: t.tag, guid: sub['00'] || '', merchantId: sub['01'] || sub['02'], subTags: sub });
        }
      }
    }
  }

  decoded.qrType = decoded.pointOfInitiation === '12' ? 'dynamic' : 'static';
  const accounts = decoded.merchantAccounts || [];
  const preferred = accounts.find(a => /kob/i.test(a.guid))
    || accounts.find(a => /(mtn|orange|momo|moov)/i.test(a.guid))
    || accounts[0];
  const merchantKey = preferred ? `${preferred.guid || 'UNKNOWN'}:${preferred.merchantId || preferred.tag}` : 'UNKNOWN:UNKNOWN';

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

export const SUPPORTED_QR_CURRENCIES = ['XAF', 'XOF', 'USD', 'EUR'];
export const SUPPORTED_QR_COUNTRIES = ['CM','CF','TD','CG','GQ','GA','BJ','BF','CI','GW','ML','NE','SN','TG'];

export async function hashQRPayload(payload: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/**
 * Validate that a decoded EMVCo QR is acceptable for the KOB rail.
 * Currency must be in SUPPORTED_QR_CURRENCIES; country (when present)
 * must be in SUPPORTED_QR_COUNTRIES; at least one merchant account tag
 * (26-51) is required.
 */
export function isSupportedQR(decoded: EmvDecoded): { ok: true } | { ok: false; reason: string } {
  if (!decoded.currency || !SUPPORTED_QR_CURRENCIES.includes(decoded.currency)) {
    return { ok: false, reason: `unsupported_currency:${decoded.currency ?? '?'}` };
  }
  if (decoded.countryCode && !SUPPORTED_QR_COUNTRIES.includes(decoded.countryCode)) {
    return { ok: false, reason: `unsupported_country:${decoded.countryCode}` };
  }
  if (!decoded.merchantAccounts?.length) {
    return { ok: false, reason: 'no_merchant_account' };
  }
  return { ok: true };
}
