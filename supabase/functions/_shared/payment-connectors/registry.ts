// Connector registry + tenant credential resolution.
// Credentials are stored encrypted in tenant_payment_connectors and decrypted
// here using the per-project ENCRYPTION_KEY (AES-GCM). For deployments where
// pgcrypto-symmetric storage is preferred, this layer can be swapped without
// touching connector implementations.

import { flutterwaveConnector } from './flutterwave.ts';
import { mtnMomoConnector } from './mtn-momo.ts';
import { orangeMoneyConnector } from './orange-money.ts';
import type { ConnectorId, PaymentConnector } from './types.ts';

const REGISTRY: Record<ConnectorId, PaymentConnector> = {
  flutterwave: flutterwaveConnector,
  mtn_momo: mtnMomoConnector,
  orange_money: orangeMoneyConnector,
};

export function getConnector(id: ConnectorId): PaymentConnector {
  const c = REGISTRY[id];
  if (!c) throw new Error(`Unknown connector: ${id}`);
  return c;
}

export function listConnectors(): PaymentConnector[] {
  return Object.values(REGISTRY);
}

// AES-GCM encryption using PAYMENT_CONNECTOR_KEY (32-byte base64).
// Falls back to plain JSON if key is absent (sandbox-only convenience).

async function getKey(): Promise<CryptoKey | null> {
  const raw = Deno.env.get('PAYMENT_CONNECTOR_KEY');
  if (!raw) return null;
  const bytes = Uint8Array.from(atob(raw), c => c.charCodeAt(0));
  return await crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function encryptCredentials(creds: Record<string, string>): Promise<Record<string, unknown>> {
  const key = await getKey();
  const plaintext = new TextEncoder().encode(JSON.stringify(creds));
  if (!key) {
    return { v: 0, plain: JSON.stringify(creds) };
  }
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    v: 1,
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
}

export async function decryptCredentials(stored: Record<string, unknown>): Promise<Record<string, string>> {
  if (stored.v === 0 && typeof stored.plain === 'string') {
    return JSON.parse(stored.plain);
  }
  const key = await getKey();
  if (!key) throw new Error('PAYMENT_CONNECTOR_KEY not configured');
  const iv = Uint8Array.from(atob(String(stored.iv)), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(String(stored.ct)), c => c.charCodeAt(0));
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  return JSON.parse(new TextDecoder().decode(pt));
}
