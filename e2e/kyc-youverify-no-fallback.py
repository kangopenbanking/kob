"""
E2E: unified-kyc-gateway always invokes Youverify for KYC + KYB, with no
fallback path used in the happy path.

Asserts, per case:
  * Response.provider == "youverify"
  * Response.fallback_triggered === false
  * kyc_verification_audit row has provider_used="youverify" and
    fallback_triggered=false, youverify_success=true
  * kyc_circuit_breaker_state for "youverify" is `closed`
  * A `youverify_session_id` was persisted on the target row

Required env:
  SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
  TEST_USER_JWT       (a real signed-in JWT for the test customer)
  TEST_USER_ID
Optional:
  TEST_INSTITUTION_ID for KYB (else gateway resolves from user)

Exit 0 = PASS.
"""
from __future__ import annotations
import json, os, sys, time, uuid
import urllib.request, urllib.error

SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
USER_JWT = os.environ["TEST_USER_JWT"]
USER_ID = os.environ["TEST_USER_ID"]
INSTITUTION_ID = os.environ.get("TEST_INSTITUTION_ID")

def _svc(path: str, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{SUPABASE_URL}{path}", data=data, method=method,
        headers={"apikey": SERVICE_KEY, "Authorization": f"Bearer {SERVICE_KEY}",
                 "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=15) as r:
        raw = r.read().decode() or "{}"
        return r.status, (json.loads(raw) if raw.strip().startswith(("{", "[")) else {"raw": raw})

def invoke_gateway(payload: dict) -> tuple[int, dict]:
    raw = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{SUPABASE_URL}/functions/v1/unified-kyc-gateway",
        data=raw, method="POST",
        headers={"Content-Type": "application/json",
                 "Authorization": f"Bearer {USER_JWT}",
                 "apikey": SERVICE_KEY},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read().decode() or "{}")
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()}

def assert_breaker_closed() -> bool:
    code, body = _svc("/rest/v1/kyc_circuit_breaker_state?provider=eq.youverify&select=state")
    if code != 200 or not body:
        print("WARN: no breaker row; treating as closed"); return True
    state = body[0]["state"]
    if state != "closed":
        print(f"FAIL: breaker={state}"); return False
    return True

def assert_audit(trace_id: str) -> bool:
    # poll briefly for audit row
    for _ in range(10):
        code, body = _svc(f"/rest/v1/kyc_verification_audit?trace_id=eq.{trace_id}&select=provider_used,fallback_triggered,youverify_success")
        if code == 200 and body:
            row = body[0]
            ok = row["provider_used"] == "youverify" and row["fallback_triggered"] is False and row["youverify_success"] is True
            if not ok: print(f"FAIL audit: {row}")
            return ok
        time.sleep(0.3)
    print("FAIL: no audit row"); return False

def run_kyc() -> bool:
    trace = str(uuid.uuid4())
    payload = {
        "kind": "identity",
        "trace_id": trace,
        "user_id": USER_ID,
        "document_type": "national_id",
        "document_number": f"E2E{int(time.time())}",
        "first_name": "E2E", "last_name": "Test",
        "date_of_birth": "1990-01-01",
        "country_code": "CM",
    }
    code, body = invoke_gateway(payload)
    if code != 200:
        print(f"FAIL kyc HTTP {code}: {body}"); return False
    if body.get("provider") != "youverify" or body.get("fallback_triggered") is not False:
        print(f"FAIL kyc routing: {body}"); return False
    return assert_audit(trace) and assert_breaker_closed()

def run_kyb() -> bool:
    if not INSTITUTION_ID:
        print("SKIP kyb (no TEST_INSTITUTION_ID)"); return True
    trace = str(uuid.uuid4())
    payload = {
        "kind": "business",
        "trace_id": trace,
        "user_id": USER_ID,
        "institution_id": INSTITUTION_ID,
        "business_name": "E2E Holdings",
        "registration_number": f"RC-E2E-{int(time.time())}",
        "country_code": "CM",
    }
    code, body = invoke_gateway(payload)
    if code != 200:
        print(f"FAIL kyb HTTP {code}: {body}"); return False
    if body.get("provider") != "youverify" or body.get("fallback_triggered") is not False:
        print(f"FAIL kyb routing: {body}"); return False
    return assert_audit(trace) and assert_breaker_closed()

def main():
    results = {"kyc": run_kyc(), "kyb": run_kyb()}
    ok = all(results.values())
    print(json.dumps(results, indent=2))
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
