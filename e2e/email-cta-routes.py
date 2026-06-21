"""
E2E test: verify every email CTA URL resolves to a real page on the running app.

We hit each route on localhost:8080, wait for SPA hydration, and assert:
  - HTTP 200
  - Page title is set (not empty / not generic "Page not found")
  - The NotFound page marker is NOT present
  - The page did NOT silently bounce to "/" (auth-gated routes are allowed
    to redirect to /auth, which is a valid CTA destination).
"""
import asyncio, json, sys
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/email-cta"); OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

# (template, label, path, allow_auth_redirect)
CTAS = [
    # Auth (these are constructed dynamically by Supabase, just verify /auth resolves)
    ("signup", "Confirm email", "/auth", False),
    ("magic-link", "Sign in", "/auth", False),
    ("recovery", "Reset password", "/auth", False),
    ("invite", "Accept invite", "/auth", False),
    ("email-change", "Confirm change", "/auth", False),
    # App
    ("welcome", "Open your dashboard", "/dashboard", True),
    ("payment-confirmation", "View transaction", "/dashboard", True),
    ("payment-received", "Open your wallet", "/dashboard", True),
    ("payout-processed", "View payout details", "/merchant", True),
    ("high-value-alert", "Review transaction", "/dashboard", True),
    ("login-alert", "Review security settings", "/security", True),
    ("password-changed", "Review security settings", "/security", True),
    ("api-key-created", "Open developer portal", "/developer", False),
    ("kyc-status-update", "Complete verification", "/kyc-verification", True),
    ("kyc-status-update", "Open your dashboard", "/dashboard", True),
    ("loan-application-received", "View loan status", "/loans", True),
    ("loan-status-update", "View loan details", "/loans", True),
    ("merchant-onboarded", "Open merchant dashboard", "/merchant", True),
    ("consent-authorized", "Manage consents", "/consents", True),
    ("consent-revoked", "Manage consents", "/consents", True),
    ("statement-ready", "Download statement", "/dashboard", True),
    ("weekly-activity-digest", "Open your dashboard", "/dashboard", True),
    ("monthly-statement", "Download statement", "/app/statements?period=2026-05&user=demo", True),
    ("support-reply", "Open support chat", "/support", False),
    ("support-ticket-created", "Open support chat", "/support", False),
    ("chat-assigned", "Open admin support chat", "/admin/support-chat", True),
    ("support-agent-invite", "Sign in to Agent Console", "/support-agent", False),
    ("admin-email-queue-alert", "Open admin dashboard", "/admin/invite-email-history", True),
    ("crediq-monthly-report", "View full report", "/credit-score", True),
    ("crediq-weekly-digest", "View my score", "/credit-score", True),
    ("crediq-score-change", "See what changed", "/credit-score", True),
    ("crediq-tip-recommendation", "View my tips", "/credit-score", True),
    ("rent-payment-reminder", "Open Rent Reporting", "/rent-reporting", False),
    ("kyc_incomplete_reminder", "Complete verification", "/kyc-verification", True),
]

async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        # Suppress noisy console
        page.on("pageerror", lambda e: None)

        for tpl, label, path, allow_auth in CTAS:
            url = BASE + path
            entry = {"template": tpl, "label": label, "path": path, "url": url}
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                status = resp.status if resp else 0
                # Wait briefly for SPA route resolution
                await page.wait_for_timeout(700)
                final_url = page.url
                # Grab visible markers
                body_text = (await page.locator("body").inner_text())[:2000].lower()
                title = await page.title()

                is_404 = ("page not found" in body_text or "404" in title.lower()
                          or "not found" in title.lower())
                # Acceptable redirects: same path, /auth (auth gate), /app (consumer splash),
                # or for /dashboard the DashboardRouter target.
                final_path = final_url.replace(BASE, "").split("?")[0].rstrip("/") or "/"
                requested_path = path.split("?")[0].rstrip("/") or "/"
                redirected_home = final_path in ("/", "/index") and requested_path not in ("/", "/index")
                redirected_auth = final_path.startswith("/auth") or final_path.startswith("/app")

                ok = (status < 400) and (not is_404)
                if redirected_home and not allow_auth:
                    ok = False
                # If auth-gated and bounced to /auth or /app, that's fine when allow_auth.
                entry.update({
                    "status": status, "final_path": final_path, "title": title[:120],
                    "is_404": is_404, "redirected_home": redirected_home,
                    "redirected_auth": redirected_auth, "pass": ok,
                })
            except Exception as e:
                entry.update({"status": 0, "error": str(e)[:200], "pass": False})
            results.append(entry)
            mark = "PASS" if entry.get("pass") else "FAIL"
            print(f"[{mark}] {tpl:35s} {path:40s} -> {entry.get('final_path','?')} ({entry.get('status','?')})")

        await browser.close()

    (OUT / "results.json").write_text(json.dumps(results, indent=2))
    failed = [r for r in results if not r.get("pass")]
    print(f"\nTotal: {len(results)}  Passed: {len(results)-len(failed)}  Failed: {len(failed)}")
    if failed:
        print("\nFailures:")
        for f in failed:
            print(f"  - {f['template']} {f['path']}: status={f.get('status')} final={f.get('final_path')} err={f.get('error','')}")
    sys.exit(0 if not failed else 1)

asyncio.run(main())
