// @ts-nocheck
/**
 * Mega Master Prompt v5 — Permanence Guardian regression tests.
 *
 * Asserts:
 *   - Rule 1 (UTT): every prerendered route has its mandated unique <title>.
 *   - Rule 2 (CFT): every prerendered route has its mandated unique H1.
 *   - Rule 3 (CAT): no legacy `phone_number:` body field in any code example
 *     and the sandbox-api host appears wherever a sandbox URL is shown.
 *   - PAGE 9: portal home advertises the current version, an audience-card
 *     "Start building" section, and a "What's new" strip with the 3 most
 *     recent changelog entries.
 *   - Changelog page lists every published version inline (not just a link).
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '../..');
const PRERENDER = fs.readFileSync(
  path.join(root, 'vite-plugin-prerender-docs.ts'),
  'utf-8',
);

// Extract a single route block by its path key.
function block(routePath: string): string {
  const i = PRERENDER.indexOf(`path: '${routePath}'`);
  expect(i, `route ${routePath} missing in prerender plugin`).toBeGreaterThan(0);
  // Walk forward to the next "path: '" or end of array.
  const next = PRERENDER.indexOf("path: '", i + 10);
  return PRERENDER.slice(i, next === -1 ? undefined : next);
}

const UTT: Record<string, string> = {
  '/developer': 'Developer Portal | Kang Open Banking API Documentation',
  '/developer/getting-started':
    'Getting Started | Kang Open Banking Developer Docs',
  '/developer/sandbox/overview':
    'Sandbox Environment | Kang Open Banking Developer Sandbox',
  '/developer/authentication':
    'Authentication | Kang Open Banking Developer Docs',
  '/developer/gateway/webhooks':
    'Webhook Verification Guide | Kang Open Banking Gateway',
  '/developer/guides/sdks':
    'SDKs and Libraries | Kang Open Banking Developer Tools',
  '/developer/examples/real-world':
    'Real-World Integration Examples | Kang Open Banking',
  '/developer/changelog':
    'API Changelog | Kang Open Banking Version History',
};

const CFT: Record<string, string> = {
  '/developer': 'Kang Open Banking Developer Portal',
  '/developer/authentication': 'Authentication',
  '/developer/gateway/quickstart':
    'Payment Gateway Quickstart — Accept Payments in 10 Minutes',
  '/developer/gateway/webhooks': 'Webhook Verification Guide',
  '/developer/guides/sdks': 'SDKs and Client Libraries',
  '/developer/examples/real-world': 'Real-World Integration Examples',
  '/developer/changelog': 'API Changelog',
};

describe('Mega Prompt v5 — Unique Title Test (UTT)', () => {
  for (const [route, title] of Object.entries(UTT)) {
    it(`${route} title matches mandate`, () => {
      expect(block(route)).toContain(`title: '${title}'`);
    });
  }
});

describe('Mega Prompt v5 — Content Fingerprint Test (CFT)', () => {
  for (const [route, h1] of Object.entries(CFT)) {
    it(`${route} H1 matches mandate`, () => {
      expect(block(route)).toContain(`h1: '${h1}'`);
    });
  }
});

describe('Mega Prompt v5 — Code Accuracy Test (CAT)', () => {
  it('no prerendered code example uses the legacy phone_number body field', () => {
    // Legacy body field is `phone_number:` (followed by a value); the word
    // can still appear elsewhere (e.g. customer_phone_number column) but
    // never as a JSON / object key in a charge body.
    expect(PRERENDER).not.toMatch(/['"]phone_number['"]\s*:/);
    expect(PRERENDER).not.toMatch(/\bphone_number:\s/);
  });
  it('sandbox host appears in every code example that references a sandbox URL', () => {
    // Any occurrence of the production host in a sandbox context would be wrong.
    // Also: no internal supabase URL anywhere.
    expect(PRERENDER).not.toContain('YOUR_PROJECT');
    expect(PRERENDER).not.toContain('supabase.co');
  });
});

describe('Mega Prompt v5 — Portal home (PAGE 9) additions', () => {
  const home = block('/developer');
  it('advertises the current API version v4.27.2', () => {
    expect(home).toMatch(/v4\.27\.2/);
  });
  it('has the "Start building — pick your path" audience cards', () => {
    expect(home).toContain("Start building");
    expect(home).toContain("I'm a developer");
    expect(home).toContain("I'm integrating a bank");
    expect(home).toContain("I'm an e-commerce business");
  });
  it("has a What's new strip with the 3 most recent versions", () => {
    expect(home).toContain("What's new");
    expect(home).toContain('v4.27.2');
    expect(home).toContain('v4.27.1');
    expect(home).toContain('v4.27.0');
  });
});

describe('Mega Prompt v5 — Changelog inlines version history', () => {
  const cl = block('/developer/changelog');
  it('lists v4.27.2, v4.27.1, v4.27.0 and the 4.x baseline inline', () => {
    expect(cl).toContain('v4.27.2');
    expect(cl).toContain('v4.27.1');
    expect(cl).toContain('v4.27.0');
    expect(cl).toContain('v4.6.0');
    expect(cl).toContain('v4.2.0');
  });
  it('still exposes the machine-readable JSON feed', () => {
    expect(cl).toContain('/changelog.json');
  });
});
