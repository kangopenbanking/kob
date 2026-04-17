// Direct MTN MoMo connector (Collection API).
// Tenant-supplied credentials only. Sandbox & live environments supported.

import type {
  PaymentConnector, ConnectorContext, ChargePayload, ChargeResult,
  StatusResult, RefundResult, HealthResult,
} from './types.ts';

function baseUrl(ctx: ConnectorContext): string {
  return ctx.environment === 'live'
    ? 'https://proxy.momoapi.mtn.com'
    : 'https://sandbox.momodeveloper.mtn.com';
}

function targetEnv(ctx: ConnectorContext): string {
  return ctx.credentials.target_environment || (ctx.environment === 'live' ? 'mtncameroon' : 'sandbox');
}

async function getAccessToken(ctx: ConnectorContext): Promise<string> {
  const { subscription_key, api_user, api_key } = ctx.credentials;
  if (!subscription_key || !api_user || !api_key) {
    throw new Error('MTN MoMo credentials incomplete (need subscription_key, api_user, api_key)');
  }
  const basic = btoa(`${api_user}:${api_key}`);
  const res = await fetch(`${baseUrl(ctx)}/collection/token/`, {
    method: 'POST',
    headers: {
      'Ocp-Apim-Subscription-Key': subscription_key,
      Authorization: `Basic ${basic}`,
    },
  });
  if (!res.ok) throw new Error(`MTN token failed: HTTP ${res.status}`);
  const json = await res.json();
  return json.access_token;
}

export const mtnMomoConnector: PaymentConnector = {
  id: 'mtn_momo',

  requiredCredentialFields() {
    return ['subscription_key', 'api_user', 'api_key', 'target_environment'];
  },

  async initiateCharge(ctx, payload: ChargePayload): Promise<ChargeResult> {
    try {
      const token = await getAccessToken(ctx);
      const referenceId = crypto.randomUUID();
      const res = await fetch(`${baseUrl(ctx)}/collection/v1_0/requesttopay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Reference-Id': referenceId,
          'X-Target-Environment': targetEnv(ctx),
          'Ocp-Apim-Subscription-Key': ctx.credentials.subscription_key,
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: payload.amount.toString(),
          currency: payload.currency,
          externalId: payload.reference,
          payer: { partyIdType: 'MSISDN', partyId: payload.phone_number.replace(/\D/g, '') },
          payerMessage: payload.description?.slice(0, 160) || 'Payment',
          payeeNote: payload.reference.slice(0, 160),
        }),
      });
      if (res.status !== 202) {
        const text = await res.text();
        return { success: false, status: 'failed', error: `MTN HTTP ${res.status}: ${text}` };
      }
      return { success: true, status: 'pending', provider_reference: referenceId };
    } catch (e) {
      return { success: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(ctx, providerReference): Promise<StatusResult> {
    const token = await getAccessToken(ctx);
    const res = await fetch(`${baseUrl(ctx)}/collection/v1_0/requesttopay/${providerReference}`, {
      headers: {
        'X-Target-Environment': targetEnv(ctx),
        'Ocp-Apim-Subscription-Key': ctx.credentials.subscription_key,
        Authorization: `Bearer ${token}`,
      },
    });
    const json = await res.json();
    const mtnStatus = json.status as string | undefined;
    const status: StatusResult['status'] =
      mtnStatus === 'SUCCESSFUL' ? 'successful' :
      mtnStatus === 'FAILED' ? 'failed' : 'pending';
    return {
      status, provider_reference: providerReference,
      amount: json.amount ? Number(json.amount) : undefined,
      currency: json.currency, raw: json,
    };
  },

  async refund(_ctx, _ref): Promise<RefundResult> {
    // MTN refunds require Disbursement API + separate flow; out of scope for v1.
    return { success: false, error: 'MTN refund not implemented in this version' };
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
