// Flutterwave connector — wraps the existing platform Flutterwave logic so it can
// be addressed through the unified PaymentConnector interface. Tenants who supply
// their own Flutterwave secret key can use this directly; otherwise the platform
// FLUTTERWAVE_SECRET_KEY is used by the legacy `mobile-money-charge` function
// (left untouched).

import type {
  PaymentConnector, ConnectorContext, ChargePayload, ChargeResult,
  StatusResult, RefundResult, HealthResult,
} from './types.ts';

const FW_BASE = 'https://api.flutterwave.com/v3';

function authHeader(ctx: ConnectorContext): string {
  const key = ctx.credentials.secret_key || ctx.credentials.FLUTTERWAVE_SECRET_KEY;
  if (!key) throw new Error('Flutterwave secret_key missing');
  return `Bearer ${key}`;
}

export const flutterwaveConnector: PaymentConnector = {
  id: 'flutterwave',

  requiredCredentialFields() {
    return ['secret_key'];
  },

  async initiateCharge(ctx, payload: ChargePayload): Promise<ChargeResult> {
    try {
      const provider = ctx.country === 'CM' ? 'mobile_money_franco' : 'mobile_money_franco';
      const res = await fetch(`${FW_BASE}/charges?type=${provider}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: authHeader(ctx) },
        body: JSON.stringify({
          amount: payload.amount,
          currency: payload.currency,
          phone_number: payload.phone_number,
          email: payload.customer_email || 'noreply@kob.cm',
          tx_ref: payload.reference,
          fullname: payload.customer_name || 'Customer',
          redirect_url: payload.callback_url,
          meta: payload.metadata || {},
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 'success') {
        return { success: false, status: 'failed', raw: json, error: json.message || 'Flutterwave charge failed' };
      }
      return {
        success: true,
        status: 'pending',
        provider_reference: json.data?.id?.toString() || json.data?.flw_ref,
        raw: json,
      };
    } catch (e) {
      return { success: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(ctx, providerReference): Promise<StatusResult> {
    const res = await fetch(`${FW_BASE}/transactions/${providerReference}/verify`, {
      headers: { Authorization: authHeader(ctx) },
    });
    const json = await res.json();
    const fwStatus = json.data?.status;
    const status: StatusResult['status'] =
      fwStatus === 'successful' ? 'successful' : fwStatus === 'failed' ? 'failed' : 'pending';
    return {
      status,
      provider_reference: providerReference,
      amount: json.data?.amount,
      currency: json.data?.currency,
      raw: json,
    };
  },

  async refund(ctx, providerReference, amount): Promise<RefundResult> {
    const res = await fetch(`${FW_BASE}/transactions/${providerReference}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: authHeader(ctx) },
      body: JSON.stringify(amount ? { amount } : {}),
    });
    const json = await res.json();
    if (!res.ok || json.status !== 'success') {
      return { success: false, raw: json, error: json.message || 'Refund failed' };
    }
    return { success: true, refund_reference: json.data?.id?.toString(), raw: json };
  },

  async healthCheck(ctx): Promise<HealthResult> {
    const start = Date.now();
    try {
      const res = await fetch(`${FW_BASE}/banks/NG`, {
        headers: { Authorization: authHeader(ctx) },
      });
      const latency = Date.now() - start;
      if (!res.ok) {
        return { healthy: false, latency_ms: latency, error: `HTTP ${res.status}` };
      }
      return { healthy: true, latency_ms: latency };
    } catch (e) {
      return { healthy: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
