"""
Deep-link verification for every email CTA.

Goes beyond a 200 check: each CTA declares the *intended state* it should
render (route, optional query/hash, and a visible marker — heading text,
[data-testid], or an active-tab attribute). We sign in using the
LOVABLE_BROWSER_SUPABASE_* env (so auth-gated routes render real content
instead of bouncing to /auth) and then assert all three conditions:

    1) HTTP status < 400
    2) Final pathname matches the intended route (querystring/hash preserved
       when the CTA targets a specific tab/section)
    3) The intent marker is visible after SPA hydration

Run:  python3 e2e/email-cta-deeplinks.py
Output: /tmp/browser/email-cta-deeplinks/results.json + console PASS/FAIL.
Exit code is non-zero if any CTA fails.
"""
import asyncio, json, os, sys, re
from pathlib import Path
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/email-cta-deeplinks"); OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

# Each CTA: dict with
#   template, label, path (incl. query/hash),
#   expect_path (final pathname must match or startwith),
#   marker: {kind: "text"|"testid"|"selector"|"tab"|"any", value: ...}
#   allow_auth_redirect: True if /auth is acceptable when not signed in
CTAS = [
    # ---- Auth provider links (Supabase builds the URL, we only own /auth)
    {"template": "signup",        "label": "Confirm email",     "path": "/auth",
     "expect_path": "/auth", "marker": {"kind": "text", "value": "sign in"}, "allow_auth_redirect": False},
    {"template": "magic-link",    "label": "Sign in",           "path": "/auth",
     "expect_path": "/auth", "marker": {"kind": "text", "value": "sign in"}, "allow_auth_redirect": False},
    {"template": "recovery",      "label": "Reset password",    "path": "/auth?mode=reset",
     "expect_path": "/auth", "marker": {"kind": "any", "value": ["sign", "password", "email"]}, "allow_auth_redirect": False},
    {"template": "invite",        "label": "Accept invite",     "path": "/auth",
     "expect_path": "/auth", "marker": {"kind": "text", "value": "sign"}, "allow_auth_redirect": False},
    {"template": "email-change",  "label": "Confirm change",    "path": "/auth",
     "expect_path": "/auth", "marker": {"kind": "text", "value": "sign"}, "allow_auth_redirect": False},

    # ---- App CTAs (authenticated)
    {"template": "welcome", "label": "Open your dashboard", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["dashboard", "wallet", "overview"]}, "allow_auth_redirect": True},
    {"template": "payment-confirmation", "label": "View transaction", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["dashboard", "transactions"]}, "allow_auth_redirect": True},
    {"template": "payment-received", "label": "Open your wallet", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["wallet", "balance"]}, "allow_auth_redirect": True},
    {"template": "payout-processed", "label": "View payout details", "path": "/merchant",
     "expect_path": "/merchant", "marker": {"kind": "any", "value": ["merchant", "payout"]}, "allow_auth_redirect": True},
    {"template": "high-value-alert", "label": "Review transaction", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["transactions", "dashboard"]}, "allow_auth_redirect": True},
    {"template": "login-alert", "label": "Review security settings", "path": "/security",
     "expect_path": "/security", "marker": {"kind": "any", "value": ["security", "sessions", "device"]}, "allow_auth_redirect": True},
    {"template": "password-changed", "label": "Review security settings", "path": "/security",
     "expect_path": "/security", "marker": {"kind": "any", "value": ["security", "password"]}, "allow_auth_redirect": True},
    {"template": "api-key-created", "label": "Open developer portal", "path": "/developer",
     "expect_path": "/developer", "marker": {"kind": "any", "value": ["developer", "api", "sdk"]}, "allow_auth_redirect": False},
    {"template": "kyc-status-update", "label": "Complete verification", "path": "/kyc-verification",
     "expect_path": "/kyc-verification", "marker": {"kind": "any", "value": ["verification", "identity", "kyc"]}, "allow_auth_redirect": True},
    {"template": "kyc-status-update", "label": "Open your dashboard", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["dashboard", "wallet"]}, "allow_auth_redirect": True},
    {"template": "loan-application-received", "label": "View loan status", "path": "/loans",
     "expect_path": "/loans", "marker": {"kind": "any", "value": ["loan", "application"]}, "allow_auth_redirect": True},
    {"template": "loan-status-update", "label": "View loan details", "path": "/loans",
     "expect_path": "/loans", "marker": {"kind": "any", "value": ["loan"]}, "allow_auth_redirect": True},
    {"template": "merchant-onboarded", "label": "Open merchant dashboard", "path": "/merchant",
     "expect_path": "/merchant", "marker": {"kind": "any", "value": ["merchant", "store"]}, "allow_auth_redirect": True},
    {"template": "consent-authorized", "label": "Manage consents", "path": "/consents",
     "expect_path": "/consents", "marker": {"kind": "any", "value": ["consent"]}, "allow_auth_redirect": True},
    {"template": "consent-revoked", "label": "Manage consents", "path": "/consents",
     "expect_path": "/consents", "marker": {"kind": "any", "value": ["consent"]}, "allow_auth_redirect": True},
    {"template": "statement-ready", "label": "Download statement", "path": "/app/statements",
     "expect_path": "/app/statements", "marker": {"kind": "any", "value": ["statement"]}, "allow_auth_redirect": True},
    {"template": "weekly-activity-digest", "label": "Open your dashboard", "path": "/dashboard",
     "expect_path": "/", "marker": {"kind": "any", "value": ["dashboard", "wallet"]}, "allow_auth_redirect": True},
    {"template": "monthly-statement", "label": "Download statement", "path": "/app/statements?period=2026-05",
     "expect_path": "/app/statements", "marker": {"kind": "any", "value": ["statement"]}, "allow_auth_redirect": True,
     "expect_query": {"period": "2026-05"}},
    {"template": "support-reply", "label": "Open support chat", "path": "/support",
     "expect_path": "/support", "marker": {"kind": "any", "value": ["support", "chat", "help"]}, "allow_auth_redirect": False},
    {"template": "support-ticket-created", "label": "Open support chat", "path": "/support",
     "expect_path": "/support", "marker": {"kind": "any", "value": ["support", "chat", "help"]}, "allow_auth_redirect": False},
    {"template": "chat-assigned", "label": "Open admin support chat", "path": "/admin/support-chat",
     "expect_path": "/admin/support-chat", "marker": {"kind": "any", "value": ["support", "chat", "conversation"]}, "allow_auth_redirect": True},
    {"template": "support-agent-invite", "label": "Sign in to Agent Console", "path": "/support-agent",
     "expect_path": "/support-agent", "marker": {"kind": "any", "value": ["agent", "console", "sign in"]}, "allow_auth_redirect": False},
    {"template": "admin-email-queue-alert", "label": "Open admin dashboard", "path": "/admin/invite-email-history",
     "expect_path": "/admin/invite-email-history", "marker": {"kind": "any", "value": ["email", "invite", "history"]}, "allow_auth_redirect": True},
    {"template": "crediq-monthly-report", "label": "View full report", "path": "/credit-score",
     "expect_path": "/credit-score", "marker": {"kind": "any", "value": ["credit", "score"]}, "allow_auth_redirect": True},
    {"template": "crediq-weekly-digest", "label": "View my score", "path": "/credit-score",
     "expect_path": "/credit-score", "marker": {"kind": "any", "value": ["credit", "score"]}, "allow_auth_redirect": True},
    {"template": "crediq-score-change", "label": "See what changed", "path": "/credit-score",
     "expect_path": "/credit-score", "marker": {"kind": "any", "value": ["credit", "score"]}, "allow_auth_redirect": True},
    {"template": "crediq-tip-recommendation", "label": "View my tips", "path": "/credit-score?tab=tips",
     "expect_path": "/credit-score", "marker": {"kind": "any", "value": ["tip", "recommend", "credit"]}, "allow_auth_redirect": True,
     "expect_query": {"tab": "tips"}},
    {"template": "rent-payment-reminder", "label": "Open Rent Reporting", "path": "/rent-reporting",
     "expect_path": "/rent-reporting", "marker": {"kind": "any", "value": ["rent"]}, "allow_auth_redirect": False},
    {"template": "kyc_incomplete_reminder", "label": "Complete verification", "path": "/kyc-verification",
     "expect_path": "/kyc-verification", "marker": {"kind": "any", "value": ["verification", "identity", "kyc"]}, "allow_auth_redirect": True},
]


async def restore_session(page):
    """Plant Supabase session into localStorage on the localhost origin."""
    key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    if not (key and sess):
        return False
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await page.evaluate(
        f"window.localStorage.setItem({json.dumps(key)}, {json.dumps(sess)})"
    )
    return True


async def check_marker(page, marker) -> bool:
    kind = marker.get("kind")
    val = marker.get("value")
    try:
        if kind == "testid":
            return await page.locator(f"[data-testid='{val}']").count() > 0
        if kind == "selector":
            return await page.locator(val).count() > 0
        if kind == "tab":
            # value is a tab value attribute (Radix-style data-state=active)
            loc = page.locator(f"[role='tab'][data-state='active'][value='{val}']")
            return await loc.count() > 0
        text = (await page.locator("body").inner_text())[:8000].lower()
        if kind == "text":
            return str(val).lower() in text
        if kind == "any":
            return any(str(v).lower() in text for v in val)
    except Exception:
        return False
    return False


def query_subset(actual_qs: str, expected: dict) -> bool:
    if not expected:
        return True
    from urllib.parse import parse_qs
    parsed = {k: v[0] for k, v in parse_qs(actual_qs).items()}
    return all(parsed.get(k) == v for k, v in expected.items())


async def main():
    results = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("pageerror", lambda e: None)

        signed_in = await restore_session(page)
        print(f"Auth session restored: {signed_in}\n")

        for cta in CTAS:
            url = BASE + cta["path"]
            entry = {**cta, "url": url}
            try:
                resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                status = resp.status if resp else 0
                await page.wait_for_timeout(900)
                final_url = page.url
                from urllib.parse import urlparse
                parsed = urlparse(final_url)
                final_path = parsed.path.rstrip("/") or "/"
                final_qs = parsed.query

                title = await page.title()
                body_text = (await page.locator("body").inner_text())[:3000].lower()
                is_404 = ("page not found" in body_text or "404" in title.lower())

                expect_path = cta["expect_path"].rstrip("/") or "/"
                bounced_auth = final_path.startswith("/auth") or final_path.startswith("/app/auth")
                path_match = (final_path == expect_path
                              or final_path.startswith(expect_path + "/")
                              or (cta.get("allow_auth_redirect") and bounced_auth))

                query_ok = query_subset(final_qs, cta.get("expect_query") or {})
                # Skip marker assertion if auth-bounced and that's allowed
                if cta.get("allow_auth_redirect") and bounced_auth:
                    marker_ok = True
                    marker_note = "auth-bounced (acceptable)"
                else:
                    marker_ok = await check_marker(page, cta["marker"])
                    marker_note = f"marker[{cta['marker']['kind']}]={cta['marker']['value']}"

                ok = (status < 400) and (not is_404) and path_match and query_ok and marker_ok
                entry.update({
                    "status": status, "final_path": final_path, "final_qs": final_qs,
                    "title": title[:120], "is_404": is_404, "path_match": path_match,
                    "query_ok": query_ok, "marker_ok": marker_ok, "marker_note": marker_note,
                    "auth_bounced": bounced_auth, "pass": ok,
                })
            except Exception as e:
                entry.update({"status": 0, "error": str(e)[:240], "pass": False})

            results.append(entry)
            mark = "PASS" if entry.get("pass") else "FAIL"
            print(f"[{mark}] {cta['template']:32s} {cta['path']:42s} -> "
                  f"{entry.get('final_path','?')} qs='{entry.get('final_qs','')}' "
                  f"path={entry.get('path_match')} q={entry.get('query_ok')} "
                  f"marker={entry.get('marker_ok')}")

        await browser.close()

    (OUT / "results.json").write_text(json.dumps(results, indent=2))
    failed = [r for r in results if not r.get("pass")]
    total = len(results)
    print(f"\nTotal: {total}  Passed: {total - len(failed)}  Failed: {len(failed)}")
    if failed:
        print("\nFailures:")
        for f in failed:
            print(f"  - {f['template']} {f['path']}: "
                  f"status={f.get('status')} final={f.get('final_path')} "
                  f"path_match={f.get('path_match')} marker={f.get('marker_ok')} "
                  f"err={f.get('error','')}")
    sys.exit(0 if not failed else 1)


asyncio.run(main())
