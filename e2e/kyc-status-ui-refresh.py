"""
E2E: KYC/KYB status UI refreshes after a Youverify webhook — no stale UI.

Strategy:
  1. Seed a `pending` row for the signed-in test user.
  2. Open /app/kyc in Playwright with the user's session; assert it renders
     "pending" (no stale terminal state from a prior run).
  3. Without reloading, POST a signed webhook flipping the row to `approved`.
  4. Wait up to 12s for the UI to reflect the new status via either:
       * Supabase realtime subscription, or
       * client polling/react-query refetch on focus/interval.
  5. Repeat for `rejected` (fresh row) and for business_kyc.

Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, YOUVERIFY_WEBHOOK_SECRET,
     TEST_USER_ID, TEST_USER_SESSION_JSON,
     LOVABLE_BROWSER_SUPABASE_STORAGE_KEY, TEST_APP_BASE_URL
"""
from __future__ import annotations
import asyncio, hashlib, hmac, json, os, sys, time, uuid
from pathlib import Path
import urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SECRET = os.environ["YOUVERIFY_WEBHOOK_SECRET"]
USER_ID = os.environ["TEST_USER_ID"]
SESSION = os.environ["TEST_USER_SESSION_JSON"]
KEY = os.environ["LOVABLE_BROWSER_SUPABASE_STORAGE_KEY"]
APP = os.environ.get("TEST_APP_BASE_URL", "http://localhost:8080")

SHOTS = Path("/tmp/browser/kyc-status-ui-refresh"); SHOTS.mkdir(parents=True, exist_ok=True)

def rest(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, method=method, headers={
        "apikey": SVC, "Authorization": f"Bearer {SVC}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()}

def seed(table, status_col, sid):
    rid = str(uuid.uuid4())
    row = {"id": rid, "user_id": USER_ID, status_col: "pending",
           "youverify_session_id": sid, "verification_method": "youverify"}
    if table == "kyc_verifications": row["document_type"] = "national_id"
    rest(f"/rest/v1/{table}", "POST", row)
    return rid

def cleanup(table, rid): rest(f"/rest/v1/{table}?id=eq.{rid}", "DELETE")

def webhook(sid, status):
    payload = {"id": f"evt_{uuid.uuid4()}", "event": f"verification.{status}",
               "data": {"sessionId": sid, "status": status}}
    raw = json.dumps(payload); ts = str(int(time.time()))
    sig = hmac.new(SECRET.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(f"{URL}/functions/v1/youverify-webhook",
        data=raw.encode(), method="POST", headers={
            "Content-Type": "application/json",
            "x-youverify-signature": f"sha256={sig}",
            "x-youverify-timestamp": ts})
    try: urllib.request.urlopen(req, timeout=15).read()
    except urllib.error.HTTPError as e: print("webhook err:", e.code, e.read().decode())

MARKERS = {
    "approved": ["approved", "verified"],
    "rejected": ["rejected", "declined"],
    "pending":  ["pending", "in review", "submitted"],
}

async def wait_for_marker(page, markers: list[str], timeout: float = 12.0) -> bool:
    deadline = time.time() + timeout
    while time.time() < deadline:
        text = (await page.locator("body").inner_text()).lower()
        if any(m in text for m in markers): return True
        await page.wait_for_timeout(500)
    return False

async def run_case(page, table, status_col, target, slug) -> bool:
    sid = f"yv_ui_{uuid.uuid4()}"
    rid = seed(table, status_col, sid)
    try:
        await page.goto(f"{APP}/app/kyc", wait_until="networkidle")
        if not await wait_for_marker(page, MARKERS["pending"], 6):
            await page.screenshot(path=str(SHOTS / f"{slug}-pre-fail.png"))
            print(f"FAIL [{slug}] initial pending not visible"); return False
        webhook(sid, target)
        ok = await wait_for_marker(page, MARKERS[target], 12)
        await page.screenshot(path=str(SHOTS / f"{slug}-{'pass' if ok else 'fail'}.png"))
        print(f"{'PASS' if ok else 'FAIL'} [{slug}] UI reflects {target} without reload")
        return ok
    finally:
        cleanup(table, rid)

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()
        await page.goto(f"{APP}/", wait_until="domcontentloaded")
        await page.evaluate(f"window.localStorage.setItem({json.dumps(KEY)}, {json.dumps(SESSION)})")
        cases = [
            ("kyc_verifications", "status", "approved", "kyc-approved"),
            ("kyc_verifications", "status", "rejected", "kyc-rejected"),
            ("business_kyc", "verification_status", "approved", "kyb-approved"),
            ("business_kyc", "verification_status", "rejected", "kyb-rejected"),
        ]
        results = []
        for c in cases:
            results.append(await run_case(page, *c))
        await browser.close()
    ok = all(results)
    print(f"\n{'PASS' if ok else 'FAIL'}: {sum(results)}/{len(results)}")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    asyncio.run(main())
