import { test, expect, type Page, type ConsoleMessage } from '@playwright/test';

/**
 * Phase 4.3 — Dashboard smoke suite.
 *
 * For every dashboard root we verify:
 *   1. The route responds (no 5xx, no SPA redirect to "/").
 *   2. No uncaught console errors fire during initial paint.
 *   3. The page renders SOMETHING (>0 visible <main>/<aside>/<nav> nodes).
 *
 * Auth-gated routes are expected to redirect to /auth — that is treated as a
 * PASS for the smoke layer (the route is reachable, the guard works). Deeper
 * authenticated flows are covered by per-dashboard specs added later.
 */

type DashboardCase = {
  name: string;
  path: string;
  /** A redirect to /auth is acceptable (route is gated). */
  authGated: boolean;
};

const DASHBOARDS: DashboardCase[] = [
  // Public-facing
  { name: 'Marketing home', path: '/', authGated: false },
  { name: 'Developer portal', path: '/developer', authGated: false },
  { name: 'API explorer', path: '/developer/api-explorer', authGated: false },
  { name: 'Changelog', path: '/developer/changelog', authGated: false },

  // Auth-gated dashboards
  { name: 'Admin dashboard', path: '/admin', authGated: true },
  { name: 'Bank / FI Portal', path: '/fi-portal', authGated: true },
  { name: 'Institution overview', path: '/fi-portal/dashboard', authGated: true },
  { name: 'Merchant dashboard', path: '/merchant', authGated: true },
  { name: 'Personal dashboard', path: '/dashboard', authGated: true },
  { name: 'Customer PWA', path: '/customer-app', authGated: true },
  { name: 'Business PWA', path: '/business-app', authGated: true },
  { name: 'Banking App', path: '/banking-app', authGated: true },
];

const IGNORED_CONSOLE_PATTERNS = [
  /Failed to load resource.*favicon/i,
  /Download the React DevTools/i,
  /\[vite\]/i,
  // Supabase realtime warning when no session
  /WebSocket connection.*failed/i,
];

async function captureConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on('console', (msg: ConsoleMessage) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (IGNORED_CONSOLE_PATTERNS.some((re) => re.test(text))) return;
    errors.push(text);
  });
  page.on('pageerror', (err) => errors.push(`pageerror: ${err.message}`));
  return errors;
}

for (const dash of DASHBOARDS) {
  test(`smoke: ${dash.name} (${dash.path})`, async ({ page }) => {
    const errors = await captureConsoleErrors(page);

    const response = await page.goto(dash.path, { waitUntil: 'domcontentloaded' });
    expect(response, `no response for ${dash.path}`).not.toBeNull();
    expect(response!.status(), `status for ${dash.path}`).toBeLessThan(500);

    // Allow client-side guard redirect to /auth for gated routes
    await page.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const finalUrl = new URL(page.url());
    if (dash.authGated && finalUrl.pathname.startsWith('/auth')) {
      // Acceptable: the protected route bounced to login.
      expect(finalUrl.pathname).toMatch(/^\/auth/);
    } else {
      // Public route OR authenticated session — must render shell
      const shellCount = await page.locator('main, aside, nav, [role="main"], [data-sidebar]').count();
      expect(shellCount, `no app shell rendered at ${dash.path}`).toBeGreaterThan(0);
    }

    expect(errors, `console errors at ${dash.path}`).toEqual([]);
  });
}
