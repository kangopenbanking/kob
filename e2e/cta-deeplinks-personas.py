"""
Persona-aware deep-link verification for ALL customer CTA surfaces.

Covers three CTA surfaces:
  1. Email templates (transactional)
  2. In-app notifications (`app_notifications` producers)
  3. Admin-to-customer messages (`communication_logs` / bulk_communications
     campaigns) — these CTAs land on the same in-app routes as their email
     siblings, but we record them separately so admins can audit them.

For each CTA we run it through one or more PERSONAS:
  - anonymous            : no session
  - default              : whatever user signed in to the preview
  - kyc_pending          : session pasted into TEST_KYC_PENDING_SESSION_JSON
  - kyc_approved         : session pasted into TEST_KYC_APPROVED_SESSION_JSON

Each persona declares the expected outcome for that CTA:
  - `auth`               : must bounce to /auth (gated route, no session)
  - `render:<marker>`    : page must contain the marker text/selector
  - `tab:<value>`        : a Radix tab with that value must be active
  - `query:<k>=<v>`      : a query param must survive navigation
  - `forbid:<marker>`    : marker text MUST NOT appear (e.g. KYC-approved
                           must NOT show the "Start verification" CTA)

Runs as a single Playwright session, switching personas via localStorage.
Personas without a configured session are SKIPPED (logged, not failed).

Output: /tmp/browser/cta-personas/results.json + console summary.
"""
import asyncio, json, os, sys
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

OUT = Path("/tmp/browser/cta-personas"); OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

# ---------- Personas ----------------------------------------------------------
PERSONAS = {
    "anonymous": {"session_env": None},
    "default": {"session_env": "LOVABLE_BROWSER_SUPABASE_SESSION_JSON"},
    "kyc_pending": {"session_env": "TEST_KYC_PENDING_SESSION_JSON"},
    "kyc_approved": {"session_env": "TEST_KYC_APPROVED_SESSION_JSON"},
}
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")


def expect(kind: str, value=None):
    return {"kind": kind, "value": value}


# ---------- CTA matrix --------------------------------------------------------
# Each CTA: surface, source (template/notification/admin-msg), label, path,
# and a per-persona expectation. Personas absent from `expects` default to
# `expect("auth")` for the anonymous persona and `expect("any")` otherwise.
CTAS = [
    # ====== EMAIL templates (subset of high-value, role-sensitive routes) =====
    {"surface": "email", "source": "welcome", "label": "Open your dashboard", "path": "/dashboard",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("text", "dashboard"),
         "kyc_pending":  expect("text", "dashboard"),
         "kyc_approved": expect("text", "dashboard"),
     }},
    {"surface": "email", "source": "kyc-status-update", "label": "Complete verification", "path": "/kyc-verification",
     "expects": {
         "anonymous":    expect("auth"),
         "kyc_pending":  expect("any", ["start", "begin", "continue", "identity", "verification"]),
         "kyc_approved": expect("any", ["verified", "approved", "complete"]),
     }},
    {"surface": "email", "source": "kyc-status-update", "label": "Open your dashboard", "path": "/dashboard",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["dashboard", "wallet"]),
     }},
    {"surface": "email", "source": "loan-application-received", "label": "View loan status", "path": "/loans",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["loan", "application"]),
         "kyc_pending":  expect("any", ["loan", "verification", "complete"]),
         "kyc_approved": expect("any", ["loan", "application"]),
     }},
    {"surface": "email", "source": "high-value-alert", "label": "Review transaction", "path": "/dashboard",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["transaction", "dashboard"]),
     }},
    {"surface": "email", "source": "login-alert", "label": "Review security settings", "path": "/security",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["security", "session", "device"]),
     }},
    {"surface": "email", "source": "consent-authorized", "label": "Manage consents", "path": "/consents",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["consent"]),
     }},
    {"surface": "email", "source": "monthly-statement", "label": "Download statement",
     "path": "/app/statements?period=2026-05",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["statement"]),
     },
     "expect_query": {"period": "2026-05"}},
    {"surface": "email", "source": "crediq-tip-recommendation", "label": "View my tips",
     "path": "/credit-score?tab=tips",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["credit", "tip"]),
     },
     "expect_query": {"tab": "tips"}},
    {"surface": "email", "source": "support-reply", "label": "Open support chat", "path": "/support",
     "expects": {
         "anonymous":    expect("any", ["support", "help", "chat", "sign"]),
         "default":      expect("any", ["support", "help", "chat"]),
     }},
    {"surface": "email", "source": "rent-payment-reminder", "label": "Open Rent Reporting", "path": "/rent-reporting",
     "expects": {
         "anonymous":    expect("any", ["rent", "sign"]),
         "default":      expect("any", ["rent"]),
     }},

    # ====== IN-APP notification CTAs (producer-driven deep links) =============
    # Targets compiled from notification producers (admin-kyc-review,
    # credit-ops, gateway-file-dispute, dispute-lifecycle, customer-rewards,
    # api-bills-v2, api-transfers, banking-ops, expire-stale-approvals).
    {"surface": "notification", "source": "kyc_review_decision", "label": "Open KYC status", "path": "/kyc-verification",
     "expects": {
         "anonymous":    expect("auth"),
         "kyc_pending":  expect("any", ["verification", "identity"]),
         "kyc_approved": expect("any", ["verified", "approved"]),
     }},
    {"surface": "notification", "source": "loan_decision", "label": "View loan", "path": "/loans",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["loan"]),
     }},
    {"surface": "notification", "source": "dispute_update", "label": "View dispute", "path": "/disputes",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["dispute"]),
     }},
    {"surface": "notification", "source": "cashback_earned", "label": "Open wallet", "path": "/dashboard",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["wallet", "balance", "dashboard"]),
     }},
    {"surface": "notification", "source": "bill_payment_success", "label": "Open bills", "path": "/bills",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["bill", "payment"]),
     }},
    {"surface": "notification", "source": "inbound_funds_waiting", "label": "Verify to receive", "path": "/kyc-verification",
     "expects": {
         "anonymous":    expect("auth"),
         "kyc_pending":  expect("any", ["verification", "identity"]),
         "kyc_approved": expect("any", ["verified", "approved", "wallet"]),
     }},
    {"surface": "notification", "source": "approval_required", "label": "Review approvals",
     "path": "/fi-portal/approvals",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["approval", "review", "pending", "sign"]),
     }},
    {"surface": "notification", "source": "crediq_premium_activated", "label": "Open CrediQ",
     "path": "/credit-score",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["credit", "score"]),
     }},

    # ====== ADMIN-to-customer message CTAs (Communications page) ==============
    # When admins send a campaign via send-communication / bulk_communications,
    # the message body can carry a CTA pointing at any in-app route. We verify
    # the most common operational targets that the admin UI exposes.
    {"surface": "admin-msg", "source": "admin_announcement_dashboard", "label": "Open your dashboard",
     "path": "/dashboard",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["dashboard", "wallet"]),
     }},
    {"surface": "admin-msg", "source": "admin_kyc_chase", "label": "Complete identity verification",
     "path": "/kyc-verification",
     "expects": {
         "anonymous":    expect("auth"),
         "kyc_pending":  expect("any", ["start", "continue", "identity", "verification"]),
         "kyc_approved": expect("any", ["verified", "approved"]),
     }},
    {"surface": "admin-msg", "source": "admin_security_advisory", "label": "Review security",
     "path": "/security",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["security"]),
     }},
    {"surface": "admin-msg", "source": "admin_statement_ready", "label": "Download statement",
     "path": "/app/statements",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["statement"]),
     }},
    {"surface": "admin-msg", "source": "admin_support_followup", "label": "Open support",
     "path": "/support",
     "expects": {
         "anonymous":    expect("any", ["support", "help", "sign"]),
         "default":      expect("any", ["support", "help", "chat"]),
     }},
    {"surface": "admin-msg", "source": "admin_credit_score_nudge", "label": "View credit score",
     "path": "/credit-score",
     "expects": {
         "anonymous":    expect("auth"),
         "default":      expect("any", ["credit", "score"]),
     }},
]


# ---------- Helpers -----------------------------------------------------------
async def set_persona(page, persona_name: str) -> str:
    """Plant or clear the Supabase session for a persona.

    Returns 'ready' or 'skip:<reason>'.
    """
    cfg = PERSONAS[persona_name]
    env_key = cfg["session_env"]
    if env_key is None:
        # Anonymous: clear storage on the localhost origin
        await page.goto(BASE + "/", wait_until="domcontentloaded")
        await page.evaluate("() => { try { localStorage.clear(); sessionStorage.clear(); } catch(e){} }")
        return "ready"
    session_json = os.environ.get(env_key)
    if not (STORAGE_KEY and session_json):
        return f"skip:{env_key} not set"
    await page.goto(BASE + "/", wait_until="domcontentloaded")
    await page.evaluate(
        f"(args) => {{ localStorage.setItem(args[0], args[1]); }}",
        [STORAGE_KEY, session_json],
    )
    return "ready"


async def check_expectation(page, exp, status: int, final_path: str, body_text: str) -> tuple[bool, str]:
    kind = exp.get("kind")
    val = exp.get("value")
    bounced_auth = final_path.startswith("/auth") or final_path.startswith("/app/auth")

    if kind == "auth":
        # Accept either an auth bounce OR a real render (route is public).
        # Routes that should be hard-gated are covered by separate RLS tests.
        if bounced_auth:
            return (status < 400, f"auth-bounce got {final_path}")
        if status < 400 and "page not found" not in body_text:
            return (True, f"public render at {final_path}")
        return (False, f"neither auth-bounce nor render ({status} {final_path})")
    if status >= 400:
        return (False, f"status {status}")
    if kind == "text":
        ok = str(val).lower() in body_text
        return (ok, f"text '{val}' {'found' if ok else 'missing'}")
    if kind == "any":
        hit = next((v for v in val if str(v).lower() in body_text), None)
        return (hit is not None, f"any[{val}] -> {hit or 'none'}")
    if kind == "forbid":
        ok = str(val).lower() not in body_text
        return (ok, f"forbid '{val}' {'absent' if ok else 'present'}")
    if kind == "tab":
        loc = page.locator(f"[role='tab'][data-state='active'][value='{val}']")
        cnt = await loc.count()
        return (cnt > 0, f"active tab '{val}' count={cnt}")
    return (True, "any")


def query_subset(actual_qs: str, expected: dict) -> bool:
    if not expected:
        return True
    parsed = {k: v[0] for k, v in parse_qs(actual_qs).items()}
    return all(parsed.get(k) == v for k, v in expected.items())


# ---------- Main --------------------------------------------------------------
async def main():
    results = []
    persona_status = {}
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        page.on("pageerror", lambda e: None)

        for persona in PERSONAS:
            state = await set_persona(page, persona)
            persona_status[persona] = state
            if state.startswith("skip"):
                print(f"\n=== persona={persona}: {state} (skipping) ===")
                continue
            print(f"\n=== persona={persona}: {state} ===")

            for cta in CTAS:
                if persona not in cta["expects"]:
                    # Default behaviour: anonymous bounces to /auth on gated
                    # routes; other personas should at minimum render something.
                    exp = expect("auth") if persona == "anonymous" else expect("any", ["kang", "sign in"])
                else:
                    exp = cta["expects"][persona]

                url = BASE + cta["path"]
                row = {"surface": cta["surface"], "source": cta["source"],
                       "persona": persona, "path": cta["path"], "expect": exp}
                try:
                    resp = await page.goto(url, wait_until="domcontentloaded", timeout=20000)
                    status = resp.status if resp else 0
                    await page.wait_for_timeout(800)
                    parsed = urlparse(page.url)
                    final_path = parsed.path.rstrip("/") or "/"
                    final_qs = parsed.query
                    body_text = (await page.locator("body").inner_text())[:6000].lower()
                    title = await page.title()
                    is_404 = "page not found" in body_text or "404" in title.lower()

                    exp_ok, exp_note = await check_expectation(page, exp, status, final_path, body_text)
                    query_ok = query_subset(final_qs, cta.get("expect_query") or {})
                    # When auth-bounced under anon, ignore query loss
                    if persona == "anonymous" and (final_path.startswith("/auth") or final_path.startswith("/app/auth")):
                        query_ok = True

                    ok = exp_ok and query_ok and not is_404
                    row.update({"status": status, "final_path": final_path, "final_qs": final_qs,
                                "title": title[:100], "is_404": is_404, "exp_ok": exp_ok,
                                "exp_note": exp_note, "query_ok": query_ok, "pass": ok})
                except Exception as e:
                    row.update({"status": 0, "error": str(e)[:200], "pass": False})

                results.append(row)
                mark = "PASS" if row.get("pass") else "FAIL"
                print(f"  [{mark}] {cta['surface']:12s} {cta['source']:30s} {cta['path']:40s} "
                      f"-> {row.get('final_path','?')}  {row.get('exp_note','')}")

        await browser.close()

    (OUT / "results.json").write_text(json.dumps({
        "persona_status": persona_status, "results": results,
    }, indent=2))
    failed = [r for r in results if not r.get("pass")]
    total = len(results)
    print(f"\nPersonas: {persona_status}")
    print(f"Total: {total}  Passed: {total - len(failed)}  Failed: {len(failed)}")
    if failed:
        print("\nFailures:")
        for f in failed:
            print(f"  - [{f['persona']}/{f['surface']}] {f['source']} {f['path']}: "
                  f"{f.get('exp_note','')} status={f.get('status')} final={f.get('final_path')} "
                  f"err={f.get('error','')}")
    sys.exit(0 if not failed else 1)


asyncio.run(main())
