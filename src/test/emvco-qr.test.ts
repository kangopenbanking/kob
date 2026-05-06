import { describe, it, expect } from 'vitest';
import { crc16ccitt, parseEmvQR, EmvParseError, isSupportedQR } from '@/lib/emvco-qr';

/** Helper: build a TLV string */
const tlv = (tag: string, value: string) => `${tag}${value.length.toString().padStart(2, '0')}${value}`;

/** Build an EMVCo payload + valid CRC */
function buildQR(opts: {
  poi?: '11' | '12';
  account?: { tag: string; guid: string; merchantId: string };
  currency?: string;     // numeric (e.g. '950')
  amount?: string;
  country?: string;
  merchantName?: string;
  merchantCity?: string;
  badCrc?: boolean;
}) {
  const parts: string[] = [];
  parts.push(tlv('00', '01'));
  parts.push(tlv('01', opts.poi ?? '12'));
  if (opts.account) {
    const sub = tlv('00', opts.account.guid) + tlv('01', opts.account.merchantId);
    parts.push(tlv(opts.account.tag, sub));
  }
  parts.push(tlv('52', '6011'));                          // MCC
  parts.push(tlv('53', opts.currency ?? '950'));          // currency
  if (opts.amount) parts.push(tlv('54', opts.amount));
  parts.push(tlv('58', opts.country ?? 'CM'));
  parts.push(tlv('59', opts.merchantName ?? 'Acme Shop'));
  parts.push(tlv('60', opts.merchantCity ?? 'Douala'));
  let body = parts.join('') + '6304';
  const crc = opts.badCrc ? '0000' : crc16ccitt(body);
  return body + crc;
}

describe('crc16ccitt', () => {
  it('produces stable, validatable CRCs (round-trip)', () => {
    // Generated payloads round-trip through parseEmvQR (which validates CRC).
    const qr = buildQR({ account: { tag: '26', guid: 'KOB', merchantId: 'm1' } });
    expect(() => parseEmvQR(qr)).not.toThrow();
    // Flip one byte → CRC must change
    const tampered = qr.slice(0, -8) + qr.slice(-7);
    expect(tampered).not.toBe(qr);
  });
});

describe('parseEmvQR', () => {
  it('decodes a dynamic Cameroon MoMo QR', () => {
    const qr = buildQR({
      poi: '12',
      account: { tag: '26', guid: 'com.mtn.momo', merchantId: '237677123456' },
      currency: '950',
      amount: '5000',
    });
    const d = parseEmvQR(qr);
    expect(d.qrType).toBe('dynamic');
    expect(d.currency).toBe('XAF');
    expect(d.amount).toBe('5000');
    expect(d.countryCode).toBe('CM');
    expect(d.merchantAccounts[0].merchantId).toBe('237677123456');
    expect(d.merchantKey).toBe('com.mtn.momo:237677123456');
  });

  it('decodes a static QR with no amount', () => {
    const qr = buildQR({
      poi: '11',
      account: { tag: '27', guid: 'KOB', merchantId: 'mer_abc123' },
    });
    const d = parseEmvQR(qr);
    expect(d.qrType).toBe('static');
    expect(d.amount).toBeUndefined();
    expect(d.merchantKey).toBe('KOB:mer_abc123');
  });

  it('prefers KOB account over MoMo when both present', () => {
    const sub1 = tlv('00', 'com.mtn.momo') + tlv('01', '237600000000');
    const sub2 = tlv('00', 'KOB') + tlv('01', 'mer_kob_001');
    const body = tlv('00', '01') + tlv('01', '12') + tlv('26', sub1) + tlv('27', sub2)
      + tlv('53', '950') + tlv('58', 'CM') + tlv('59', 'X') + tlv('60', 'Y') + '6304';
    const qr = body + crc16ccitt(body);
    const d = parseEmvQR(qr);
    expect(d.merchantKey).toBe('KOB:mer_kob_001');
  });

  it('rejects bad CRC', () => {
    const qr = buildQR({ badCrc: true, account: { tag: '26', guid: 'KOB', merchantId: 'm1' } });
    expect(() => parseEmvQR(qr)).toThrow(EmvParseError);
  });

  it('rejects truncated payloads', () => {
    expect(() => parseEmvQR('001')).toThrow(EmvParseError);
  });

  it('isSupportedQR rejects unsupported currency (NGN)', () => {
    const qr = buildQR({ currency: '566', account: { tag: '26', guid: 'KOB', merchantId: 'm1' } });
    const d = parseEmvQR(qr);
    const r = isSupportedQR(d);
    expect(r.ok).toBe(false);
  });

  it('isSupportedQR rejects QR without merchant account', () => {
    const body = tlv('00', '01') + tlv('01', '12') + tlv('53', '950') + tlv('58', 'CM')
      + tlv('59', 'X') + tlv('60', 'Y') + '6304';
    const qr = body + crc16ccitt(body);
    const d = parseEmvQR(qr);
    expect(isSupportedQR(d)).toEqual({ ok: false, reason: 'no_merchant_account' });
  });
});

/**
 * Pre-payment-wiring fixture suite — locks in the four canonical EMVCo
 * shapes the qr-initiate-payment bridge MUST tolerate before any money
 * moves: static, dynamic, bad-CRC, missing-amount.
 */
describe('EMVCo MPM fixtures (pre-payment wiring)', () => {
  const KOB = { tag: '26', guid: 'KOB', merchantId: 'mer_kob_demo' };

  it('FIXTURE: dynamic XAF QR with amount → decodes & is supported', () => {
    const qr = buildQR({ poi: '12', account: KOB, currency: '950', amount: '12500.50' });
    const d = parseEmvQR(qr);
    expect(d.qrType).toBe('dynamic');
    expect(d.amount).toBe('12500.50');
    expect(d.currency).toBe('XAF');
    expect(isSupportedQR(d)).toEqual({ ok: true });
  });

  it('FIXTURE: static QR with NO amount → decodes; consumer must supply amount_override', () => {
    const qr = buildQR({ poi: '11', account: KOB });
    const d = parseEmvQR(qr);
    expect(d.qrType).toBe('static');
    expect(d.amount).toBeUndefined();
    expect(isSupportedQR(d)).toEqual({ ok: true });
  });

  it('FIXTURE: bad CRC → throws EmvParseError(QR_001_BAD_CRC)', () => {
    const qr = buildQR({ poi: '12', account: KOB, amount: '1000', badCrc: true });
    let caught: unknown;
    try { parseEmvQR(qr); } catch (e) { caught = e; }
    expect(caught).toBeInstanceOf(EmvParseError);
    expect((caught as EmvParseError).code).toBe('QR_001_BAD_CRC');
  });

  it('FIXTURE: dynamic QR missing amount tag (54) → parser tolerant, downstream must reject', () => {
    const qr = buildQR({ poi: '12', account: KOB });
    const d = parseEmvQR(qr);
    expect(d.amount).toBeUndefined();
    expect(d.qrType).toBe('dynamic');
  });
});
