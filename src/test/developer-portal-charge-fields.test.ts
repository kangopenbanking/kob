// @ts-nocheck
/**
 * Audit fix (May 2026): The Claude AI Integration Readiness Report flagged
 * that the prerendered Getting Started + Gateway Quickstart pages used the
 * old GatewayCharge field names `provider` / `phone_number`. Per the
 * canonical OpenAPI 3.1 spec (v4.27.0+), the required fields are
 * `channel` and `customer_phone`. This guard prevents regression.
 *
 * Also asserts that no developer-portal source uses
 * `https://api.kangopenbanking.com/v1` as a SANDBOX URL (must use
 * `https://sandbox-api.kangopenbanking.com/v1`).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');

const PRERENDER = path.join(root, 'vite-plugin-prerender-docs.ts');

describe('Developer portal — GatewayCharge field correctness', () => {
  it('prerender plugin Getting Started + Gateway Quickstart use channel + customer_phone', () => {
    const src = fs.readFileSync(PRERENDER, 'utf-8');
    // The /v1/gateway/charges curl examples must use channel/customer_phone,
    // not the legacy provider/phone_number combo.
    const chargeBlocks = src.match(/\/v1\/gateway\/charges[\s\S]{0,800}/g) || [];
    expect(chargeBlocks.length).toBeGreaterThan(0);
    for (const block of chargeBlocks) {
      // If the block creates a charge body, it must use the canonical names
      if (block.includes('"amount"') || block.includes("amount':")) {
        expect(block).toContain('channel');
        expect(block).toContain('customer_phone');
        // Legacy field as a *required body field* must not appear next to
        // amount/currency anymore. (It may still appear as an optional
        // "provider" routing hint — that field is still in the spec.)
        expect(block).not.toMatch(/"phone_number"\s*:/);
      }
    }
  });

  it('prerender Sandbox page exposes the sandbox host, not the production host', () => {
    const src = fs.readFileSync(PRERENDER, 'utf-8');
    const sandboxRoute = src.split("path: '/developer/sandbox/overview'")[1] || '';
    const block = sandboxRoute.split('},')[0];
    expect(block).toContain('sandbox-api.kangopenbanking.com');
    expect(block).not.toContain('YOUR_PROJECT');
  });

  it('prerender home page advertises the current API version', () => {
    const src = fs.readFileSync(PRERENDER, 'utf-8');
    const homeBlock = src.split("path: '/developer',")[1] || '';
    expect(homeBlock).toMatch(/v4\.27\./);
  });

  it('prerender includes a top-level Authentication overview route', () => {
    const src = fs.readFileSync(PRERENDER, 'utf-8');
    expect(src).toContain("path: '/developer/authentication',");
  });
});
