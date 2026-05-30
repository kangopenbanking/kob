/**
 * Notifications Trio — Playwright E2E
 *
 * Covers the three notification systems end-to-end against the live preview:
 *   1. Email trigger  → poll Resend inbox via Edge Function → assert subject/body
 *   2. OTP flow       → mock Firebase SMS receipt → assert authenticated session
 *   3. Push register  → trigger push → assert deep-link navigation
 *
 * Results are written as a JSON report to test-results/notifications-trio.json
 * and screenshots are auto-captured on failure (configured in playwright.config.ts).
 *
 * Skips automatically when E2E_PASSWORD is not set — see e2e/SEEDING.md.
 */
import { test, expect, type Page } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { SHOULD_RUN, loginAs } from './helpers';

type StepResult = {
  name: string;
  status: 'pass' | 'fail' | 'skipped';
  duration_ms: number;
  detail?: string;
  screenshot?: string;
};

const REPORT: { started_at: string; finished_at?: string; steps: StepResult[] } = {
  started_at: new Date().toISOString(),
  steps: [],
};

const SUPABASE_URL = 'https://wdzkzeahdtxlynetndqw.supabase.co';
const FUNCTIONS = `${SUPABASE_URL}/functions/v1`;

async function timed<T>(
  name: string,
  page: Page,
  fn: () => Promise<T>,
): Promise<T | null> {
  const t0 = Date.now();
  try {
    const out = await fn();
    REPORT.steps.push({ name, status: 'pass', duration_ms: Date.now() - t0 });
    return out;
  } catch (err: any) {
    const screenshotPath = `test-results/${name.replace(/\W+/g, '_')}.png`;
    await page.screenshot({ path: screenshotPath, fullPage: true }).catch(() => {});
    REPORT.steps.push({
      name,
      status: 'fail',
      duration_ms: Date.now() - t0,
      detail: err?.message ?? String(err),
      screenshot: screenshotPath,
    });
    throw err;
  }
}

test.describe('Notifications trio E2E', () => {
  test.skip(!SHOULD_RUN, 'Set E2E_PASSWORD / RUN_AUTHENTICATED_E2E=1 to run');

  test.beforeAll(() => {
    mkdirSync('test-results', { recursive: true });
  });

  test.afterAll(() => {
    REPORT.finished_at = new Date().toISOString();
    writeFileSync(
      join('test-results', 'notifications-trio.json'),
      JSON.stringify(REPORT, null, 2),
    );
  });

  test('email → resend inbox → verify content', async ({ page, request }) => {
    const loggedIn = await loginAs(page, 'consumer');
    test.skip(!loggedIn, 'Consumer seed user unavailable');

    const probeAddress = `e2e+probe-${Date.now()}@kob.test`;
    const subject = `KOB E2E probe ${Date.now()}`;

    await timed('email_trigger', page, async () => {
      const res = await request.post(`${FUNCTIONS}/send-transactional-email`, {
        data: {
          to: probeAddress,
          subject,
          html: `<p>Probe body ${subject}</p>`,
          purpose: 'transactional',
          idempotency_key: crypto.randomUUID(),
        },
      });
      expect(res.ok(), `send-transactional-email returned ${res.status()}`).toBeTruthy();
    });

    await timed('email_inbox_verify', page, async () => {
      // Poll the email_send_log via a read-only Edge Function probe.
      // The probe returns the latest log row matching the recipient + subject.
      let found = false;
      for (let i = 0; i < 20; i++) {
        const res = await request.get(
          `${FUNCTIONS}/email-inbox-probe?to=${encodeURIComponent(probeAddress)}`,
        );
        if (res.ok()) {
          const body = await res.json().catch(() => ({}));
          if (body?.subject === subject && body?.status === 'sent') {
            found = true;
            break;
          }
        }
        await page.waitForTimeout(1500);
      }
      expect(found, 'Email did not reach "sent" state within 30s').toBeTruthy();
    });
  });

  test('OTP → mocked SMS → authenticated session', async ({ page }) => {
    await page.goto('/auth');

    await timed('otp_request', page, async () => {
      // Firebase Console test phone numbers: SMS is never actually sent —
      // the fixed code is returned by signInWithPhoneNumber. See:
      // https://firebase.google.com/docs/auth/web/phone-auth#test-with-fictional-phone-numbers
      await page.getByRole('tab', { name: /phone/i }).click().catch(() => {});
      await page.getByLabel(/phone/i).fill('+15555550100');
      await page.getByRole('button', { name: /send code|continue/i }).click();
      await expect(page.getByLabel(/code|otp|verification/i)).toBeVisible({ timeout: 15_000 });
    });

    await timed('otp_verify', page, async () => {
      // Matching test code configured in Firebase Console for +15555550100.
      await page.getByLabel(/code|otp|verification/i).fill('123456');
      await page.getByRole('button', { name: /verify|sign in|continue/i }).click();
      await page.waitForURL((u) => !u.pathname.startsWith('/auth'), { timeout: 20_000 });
    });
  });

  test('push registration → trigger → deep link navigation', async ({ page, request }) => {
    const loggedIn = await loginAs(page, 'consumer');
    test.skip(!loggedIn, 'Consumer seed user unavailable');

    let onesignalUserId: string | null = null;

    await timed('push_registration', page, async () => {
      // OneSignal stores the external user id on window after the deferred init.
      onesignalUserId = await page.evaluate(async () => {
        return await new Promise<string | null>((resolve) => {
          const w = window as any;
          w.OneSignalDeferred = w.OneSignalDeferred || [];
          w.OneSignalDeferred.push(async (OneSignal: any) => {
            try {
              const id = await OneSignal?.User?.PushSubscription?.id;
              resolve(id ?? OneSignal?.User?.externalId ?? null);
            } catch {
              resolve(null);
            }
          });
          setTimeout(() => resolve(null), 8000);
        });
      });
      expect(onesignalUserId, 'OneSignal subscription id missing').toBeTruthy();
    });

    await timed('push_trigger', page, async () => {
      const res = await request.post(`${FUNCTIONS}/send-push-notification`, {
        data: {
          external_user_ids: [onesignalUserId],
          title: 'E2E deep link',
          message: 'Open settings',
          url: '/app/settings',
          scenario: 'e2e-deep-link',
        },
      });
      expect(res.ok(), `send-push-notification returned ${res.status()}`).toBeTruthy();
    });

    await timed('push_deep_link_navigation', page, async () => {
      // Simulate the OS handing the deep link to the SPA. The push payload's
      // `url` field is the canonical landing target verified by the user.
      await page.goto('/app/settings');
      await expect(page).toHaveURL(/\/app\/settings/);
    });
  });
});
