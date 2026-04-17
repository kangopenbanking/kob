// SOAP Bank Connector — for legacy core-banking systems (T24, Flexcube, OBDX, etc.)
// Implements the unified PaymentConnector contract over SOAP/XML envelopes.
// Tenant supplies WSDL endpoint + WS-Security credentials.
//
// NOTE: TLS is terminated by the edge proxy. mTLS (client X.509 to bank) is not
// possible in the managed runtime — see mem://constraints/mtls-infrastructure-limitations.
// Tenants requiring mTLS must front this connector with their own VPN/gateway.

import type {
  PaymentConnector, ConnectorContext, ChargePayload, ChargeResult,
  StatusResult, RefundResult, HealthResult,
} from './types.ts';

function escapeXml(v: string): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildEnvelope(
  ns: string,
  operation: string,
  username: string,
  password: string,
  body: Record<string, string | number>,
): string {
  const inner = Object.entries(body)
    .map(([k, v]) => `<${k}>${escapeXml(String(v))}</${k}>`)
    .join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="${escapeXml(ns)}">
  <soapenv:Header>
    <wsse:Security xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
      <wsse:UsernameToken>
        <wsse:Username>${escapeXml(username)}</wsse:Username>
        <wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordText">${escapeXml(password)}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <tns:${operation}>${inner}</tns:${operation}>
  </soapenv:Body>
</soapenv:Envelope>`;
}

function extractTag(xml: string, tag: string): string | undefined {
  const m = xml.match(new RegExp(`<(?:[a-zA-Z0-9]+:)?${tag}[^>]*>([^<]*)</(?:[a-zA-Z0-9]+:)?${tag}>`));
  return m?.[1]?.trim();
}

function requiredCreds(ctx: ConnectorContext): {
  endpoint: string; username: string; password: string;
  ns: string; opInit: string; opStatus: string;
} {
  const c = ctx.credentials;
  const missing = ['endpoint_url', 'username', 'password', 'service_namespace', 'operation_initiate', 'operation_status']
    .filter(k => !c[k]);
  if (missing.length) throw new Error(`SOAP bank credentials incomplete: missing ${missing.join(', ')}`);
  return {
    endpoint: c.endpoint_url,
    username: c.username,
    password: c.password,
    ns: c.service_namespace,
    opInit: c.operation_initiate,
    opStatus: c.operation_status,
  };
}

export const soapBankConnector: PaymentConnector = {
  id: 'soap_bank' as never,

  requiredCredentialFields() {
    return [
      'endpoint_url', 'username', 'password',
      'service_namespace', 'operation_initiate', 'operation_status',
    ];
  },

  async initiateCharge(ctx: ConnectorContext, payload: ChargePayload): Promise<ChargeResult> {
    try {
      const c = requiredCreds(ctx);
      const envelope = buildEnvelope(c.ns, c.opInit, c.username, c.password, {
        Reference: payload.reference,
        Amount: payload.amount,
        Currency: payload.currency,
        AccountNumber: payload.phone_number,
        Description: payload.description ?? '',
      });
      const res = await fetch(c.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          'SOAPAction': `"${c.ns}/${c.opInit}"`,
        },
        body: envelope,
      });
      const text = await res.text();
      if (!res.ok) {
        return { success: false, status: 'failed', error: `SOAP HTTP ${res.status}`, raw: text.slice(0, 1000) };
      }
      if (text.includes('<soapenv:Fault') || text.includes('<soap:Fault')) {
        const fault = extractTag(text, 'faultstring') || 'SOAP fault';
        return { success: false, status: 'failed', error: fault, raw: text.slice(0, 1000) };
      }
      const ref = extractTag(text, 'TransactionId') || extractTag(text, 'TransactionReference') || extractTag(text, 'Reference');
      const status = (extractTag(text, 'Status') || 'pending').toLowerCase();
      return {
        success: true,
        provider_reference: ref,
        status: status === 'success' || status === 'successful' || status === 'completed' ? 'successful'
              : status === 'failed' || status === 'rejected' ? 'failed'
              : 'pending',
        raw: text.slice(0, 1000),
      };
    } catch (e) {
      return { success: false, status: 'failed', error: e instanceof Error ? e.message : String(e) };
    }
  },

  async getStatus(ctx: ConnectorContext, providerReference: string): Promise<StatusResult> {
    const c = requiredCreds(ctx);
    const envelope = buildEnvelope(c.ns, c.opStatus, c.username, c.password, { TransactionId: providerReference });
    const res = await fetch(c.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': `"${c.ns}/${c.opStatus}"`,
      },
      body: envelope,
    });
    const text = await res.text();
    const status = (extractTag(text, 'Status') || 'pending').toLowerCase();
    return {
      status: status === 'success' || status === 'successful' || status === 'completed' ? 'successful'
            : status === 'failed' || status === 'rejected' ? 'failed'
            : 'pending',
      provider_reference: providerReference,
      raw: text.slice(0, 1000),
    };
  },

  async refund(_ctx: ConnectorContext, _ref: string): Promise<RefundResult> {
    return { success: false, error: 'Refund not supported for generic SOAP adapter — implement bank-specific operation' };
  },

  async healthCheck(ctx: ConnectorContext): Promise<HealthResult> {
    const start = Date.now();
    try {
      const c = requiredCreds(ctx);
      const res = await fetch(c.endpoint + '?wsdl', { method: 'GET' });
      const ok = res.ok;
      const text = await res.text();
      return {
        healthy: ok && text.toLowerCase().includes('wsdl'),
        latency_ms: Date.now() - start,
        details: { status: res.status, has_wsdl: text.toLowerCase().includes('wsdl') },
      };
    } catch (e) {
      return { healthy: false, latency_ms: Date.now() - start, error: e instanceof Error ? e.message : String(e) };
    }
  },
};
