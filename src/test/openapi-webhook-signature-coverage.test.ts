// @ts-nocheck
/**
 * Phase 8 ratchet — webhook signature spec hardening.
 *
 * - Components must declare `X-Webhook-Signature`, `X-Webhook-Timestamp`,
 *   and the legacy/deprecated `X-Webhook-Signature-Legacy` headers.
 * - A `WebhookSignature` security scheme must exist.
 * - The canonical replay façade `/v1/webhooks/events/{eventId}/replay` must exist.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const root = path.resolve(path.dirname(__filename), '../..');
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf-8'));

describe('Phase 8 — webhook signature components', () => {
  it('declares X-Webhook-Signature (timestamped) header component', () => {
    const h = spec.components?.headers?.['X-Webhook-Signature'];
    expect(h).toBeDefined();
    expect(h.schema?.pattern).toMatch(/t=/);
    expect(h.schema?.pattern).toMatch(/v1=/);
  });

  it('declares X-Webhook-Timestamp header component', () => {
    expect(spec.components?.headers?.['X-Webhook-Timestamp']).toBeDefined();
  });

  it('keeps the deprecated legacy header for back-compat', () => {
    const legacy = spec.components?.headers?.['X-Webhook-Signature-Legacy'];
    expect(legacy).toBeDefined();
    expect(legacy.deprecated).toBe(true);
  });

  it('declares WebhookSignature security scheme', () => {
    expect(spec.components?.securitySchemes?.WebhookSignature).toBeDefined();
  });

  it('exposes the canonical webhook replay façade', () => {
    expect(spec.paths?.['/v1/webhooks/events/{eventId}/replay']?.post).toBeDefined();
  });

  it('exposes DLQ list + requeue endpoints', () => {
    expect(spec.paths?.['/v1/webhooks/dlq']?.get).toBeDefined();
    expect(spec.paths?.['/v1/webhooks/dlq/{deliveryId}/requeue']?.post).toBeDefined();
  });
});
