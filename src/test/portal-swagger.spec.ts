/**
 * Playwright Swagger UI smoke test for the developer portal.
 *
 * Verifies that:
 *   1) /developer/api-explorer renders Swagger UI (not just the SPA shell).
 *   2) Swagger UI fetches /openapi.json and the response is HTTP 200 with a
 *      JSON body whose info.version equals the expected SSOT version.
 *   3) At least one operation row (.opblock) is rendered in the DOM,
 *      proving the spec was successfully parsed and rendered.
 *
 * Configure target with SMOKE_BASE_URL (defaults to production).
 */
import { test, expect } from '@playwright/test';
import { readExpectedVersion } from '../../scripts/lib/read-expected-version.mjs';

const BASE = (process.env.SMOKE_BASE_URL || 'https://kangopenbanking.com').replace(/\/$/, '');
const EXPECTED = readExpectedVersion();

test('Swagger UI renders the OpenAPI spec with at least one endpoint', async ({ page }) => {
  let openapiResponse = null;

  page.on('response', (resp) => {
    const url = resp.url();
    if (/\/openapi\.json(\?|$)/.test(url)) {
      openapiResponse = resp;
    }
  });

  await page.goto(`${BASE}/developer/api-explorer`, { waitUntil: 'networkidle', timeout: 60_000 });

  // Wait up to 30s for at least one operation row to be rendered.
  const opblock = page.locator('.swagger-ui .opblock');
  await expect(opblock.first()).toBeVisible({ timeout: 30_000 });
  const count = await opblock.count();
  expect(count, 'Swagger UI should render at least one operation row').toBeGreaterThan(0);

  // Verify the underlying spec request succeeded.
  expect(openapiResponse, '/openapi.json was never requested by Swagger UI').not.toBeNull();
  expect(openapiResponse.status()).toBe(200);
  const spec = await openapiResponse.json();
  expect(spec?.info?.version).toBe(EXPECTED);
  expect(Object.keys(spec.paths || {}).length).toBeGreaterThan(100);
});
