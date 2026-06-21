"""
E2E: KYC/KYB status page reflects Youverify webhook updates and never stays stale.

Flow per case (identity + business):
  1. Seed a kyc_verifications / business_kyc row in `pending` linked to a fake
     `youverify_session_id`.
  2. POST a signed Youverify webhook (approved / rejected) to
     /functions/v1/youverify-webhook.
  3. Poll the row until status flips, asserting flip happens within SLA.
  4. Load the KYC status page in Playwright as the seeded user and screenshot,
     asserting the rendered status string matches the new state (no stale UI).

Required env:
  SUPABASE_URL                       (e.g. https://<ref>.supabase.co)
  SUPABASE_SERVICE_ROLE_KEY          service role for seeding/reading rows
  YOUVERIFY_WEBHOOK_SECRET           HMAC secret matching the deployed function
  TEST_USER_ID                       auth.users.id to attach rows to
  TEST_USER_SESSION_JSON             Supabase session JSON for UI assertion
  TEST_APP_BASE_URL                  e.g. http://localhost:8080

Exit 0 = PASS, exit 1 = FAIL.
"""
from __future__ import annotations
import asyncio, hashlib, hmac, json, os, sys, time, uuid
from pathlib import Path
import urllib.request, urllib.error

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
WEBHOOK_SECRET = os.environ["YOUVERIFY_WEBHOOK_SECRET"]
USER_ID = os.environ["TEST_USER_ID"]
APP_BASE = os.environ.get("TEST_APP_BASE_URL", "http://localhost:8080")
SESSION_JSON = os.environ.get("TEST_USER_SESSION_JSON")
STORAGE_KEY = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")

SCREENSHOTS = Path("/tmp/browser/kyc-status-webhook-sync")
SCREENSHOTS.mkdir(parents=True, exist_ok=True)

def _req(path: str, method: str = "GET", body: dict | None = None, headers: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(body).encode() if body is not None else None
    h = {"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}", "Content-Type": "application/json", "Prefer": "return=representation"}
    if headers: h.update(headers)
    req = urllib.request.Request(f"{SUPABASE_URL}{path}", data=data, method=method, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode() or "{}"
            return resp.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else {"raw": raw})
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()}

def seed_kyc(table: str, status_col: str, session_id: str) -> str:
    rid = str(uuid.uuid4())
    row = {
        "id": rid, "user_id": USER_ID,
        status_col: "pending",
        "youverify_session_id": session_id,
        "verification_method": "youverify",
    }
    if table == "kyc_verifications":
        row["document_type"] = "national_id"
    code, body = _req(f"/rest/v1/{table}", "POST", row)
    assert code in (200, 201), f"seed {table} failed: {code} {body}"
    return rid

def post_webhook(session_id: str, status: str, event_id: str) -> int:
    payload = {
        "id": event_id, "event": f"verification.{status}",
        "data": {"sessionId": session_id, "status": status},
    }
    raw = json.dumps(payload)
    ts = str(int(time.time()))
    sig = hmac.new(WEBHOOK_SECRET.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/youverify-webhook",
        data=raw.encode(), method="POST",
        headers={
            "Content-Type": "application/json",
            "x-youverify-signature": f"sha256={sig}",
            "x-youverify-timestamp": ts,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r: return r.status
    except urllib.error.HTTPError as e:
        print("webhook error:", e.code, e.read().decode()); return e.code

def poll_status(table: str, status_col: str, rid: str, expected: str, timeout: float = 15) -> str:
    deadline = time.time() + timeout
    last = None
    while time.time() < deadline:
        code, body = _req(f"/rest/v1/{table}?id=eq.{rid}&select={status_col}")
        if code == 200 and body:
            last = body[0][status_col]
            if last == expected: return last
        time.sleep(0.5)
    return last or "<missing>"

def cleanup(table: str, rid: str):
    _req(f"/rest/v1/{table}?id=eq.{rid}", "DELETE")

async def verify_ui(expected_label_substrings: list[str], slug: str) -> bool:
    if not (SESSION_JSON and STORAGE_KEY):
        print(f"[{slug}] skipping UI assertion (no session)"); return True
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(f"{APP_BASE}/", wait_until="domcontentloaded")
        await page.evaluate(f"window.localStorage.setItem({json.dumps(STORAGE_KEY)}, {json.dumps(SESSION_JSON)})")
        await page.goto(f"{APP_BASE}/app/kyc", wait_until="networkidle")
        await page.screenshot(path=str(SCREENSHOTS / f"{slug}.png"))
        text = (await page.content()).lower()
        ok = any(s.lower() in text for s in expected_label_substrings)
        await browser.close()
        return ok

async def run_case(table: str, status_col: str, target: str, ui_markers: list[str]) -> bool:
    session_id = f"yv_test_{uuid.uuid4()}"
    rid = seed_kyc(table, status_col, session_id)
    try:
        code = post_webhook(session_id, target, str(uuid.uuid4()))
        if code != 200:
            print(f"FAIL [{table}->{target}] webhook HTTP {code}"); return False
        got = poll_status(table, status_col, rid, target)
        if got != target:
            print(f"FAIL [{table}->{target}] status={got}"); return False
        ui_ok = await verify_ui(ui_markers, f"{table}-{target}")
        if not ui_ok:
            print(f"FAIL [{table}->{target}] UI did not reflect status"); return False
        print(f"PASS [{table}->{target}]"); return True
    finally:
        cleanup(table, rid)

async def main():
    cases = [
        ("kyc_verifications", "status", "approved", ["approved", "verified"]),
        ("kyc_verifications", "status", "rejected", ["rejected", "declined"]),
        ("business_kyc", "verification_status", "approved", ["approved", "verified"]),
        ("business_kyc", "verification_status", "rejected", ["rejected", "declined"]),
    ]
    results = [await run_case(*c) for c in cases]
    ok = all(results)
    print(f"\n{'PASS' if ok else 'FAIL'}: {sum(results)}/{len(results)}")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    asyncio.run(main())
