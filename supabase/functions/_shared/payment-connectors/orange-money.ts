// Direct Orange Money connector (Web Payment / Merchant API).
// Tenant-supplied credentials only.

import type {
  PaymentConnector, ConnectorContext, ChargePayload, ChargeResult,
  StatusResult, RefundResult, HealthResult,
} from './types.ts';

function baseUrl(ctx: ConnectorContext): string {
  return ctx.environment === 'live'
    ? 'https://api.orange.com'
    : 'https://api.sandbox.orange.com';
}

async function getAccessToken(ctx: ConnectorContext): Promise<string> {
  const { client_id, client_secret } = ctx.credentials;
  if (!client_id || !client_secret) {
    throw new Error('Orange Money credentials incomplete (need client_id, client_secret)');
  }
  const basic = btoa(`${client_id}:${client_secret}`);
  const res = await fetch(`${baseUrl(ctx)}/oauth/v3/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Orange token failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

export const orangeMoneyConnector: PaymentConnector = {
  id: 'orange_money',

  requiredCredentialFields() {
    return ['client_id', 'client_secret', 'merchant_key'];
  },

  async initiateCharge(ctx, payload: ChargePayload): Promise<ChargeResult> {
    try {
      const token = await getAccessToken(ctx);
      const res = await fetch(`${baseUrl(ctx)}/orange-money-webpay/cm/v1/webpayment`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          merchant_key: ctx.credentials.merchant_key,
          currency: payload.currency,
          order_id: payload.reference,
          amount: payload.amount,
          return_url: payload.callback_url || 'https://kob.lovable.app/payment-return',
          cancel_url: payload.callback_url || 'https://kob.lovable.app/payment-cancel',
          notif_url: payload.callback_url || 'https://kob.lovable.app/payment-notif',
          lang: 'en',
          reference: payload.reference,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.status !== 201) {
        return { success: false, status: 'failed', raw: json, error: json.message || `Orange HTTP ${res.status}` };
      }
      return { success: true, status: 'pending', provider_reference: json.pay_token, raw: json };
    } catch (e) {
      return { success: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(ctx, providerReference): Promise<StatusResult> {
    const token = await getAccessToken(ctx);
    const res = await fetch(
      `${baseUrl(ctx)}/orange-money-webpay/cm/v1/transactionstatus?pay_token=${encodeURIComponent(providerReference)}`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    const json = await res.json();
    const orangeStatus = json.status as string | undefined;
    const status: StatusResult['status'] =
      orangeStatus === 'SUCCESS' ? 'successful' :
      orangeStatus === 'FAILED' || orangeStatus === 'EXPIRED' ? 'failed' : 'pending';
    return {
      status, provider_reference: providerReference,
      amount: json.amount ? Number(json.amount) : undefined,
      currency: json.currency, raw: json,
    };
  },

  async refund(): Promise<RefundResult> {
    return { success: false, error: 'Orange Money refund not implemented in this version' };
  },

  async healthCheck(ctx): Promise<HealthResult> {
    const start = Date.now();
    try {
      await getAccessToken(ctx);
      return { healthy: true, latency_ms: Date.now() - start };
    } catch (e) {
      return { healthy: false, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
