"""
E2E: Youverify webhook idempotency.

Same event_id replayed N times must:
  * Only insert ONE row in youverify_webhook_events.
  * Only produce ONE state transition on kyc_verifications / business_kyc
    (updated_at must not advance after the first apply).
  * Never downgrade a decided (approved/rejected) row to a different terminal
    state when a conflicting late event arrives.

Required env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
              YOUVERIFY_WEBHOOK_SECRET, TEST_USER_ID
"""
from __future__ import annotations
import hashlib, hmac, json, os, sys, time, uuid
import urllib.request, urllib.error

URL = os.environ["SUPABASE_URL"].rstrip("/")
SVC = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SECRET = os.environ["YOUVERIFY_WEBHOOK_SECRET"]
USER_ID = os.environ["TEST_USER_ID"]

def rest(path, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(f"{URL}{path}", data=data, method=method, headers={
        "apikey": SVC, "Authorization": f"Bearer {SVC}",
        "Content-Type": "application/json", "Prefer": "return=representation",
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            raw = r.read().decode() or "{}"
            return r.status, (json.loads(raw) if raw.strip().startswith(("{","[")) else {})
    except urllib.error.HTTPError as e:
        return e.code, {"error": e.read().decode()}

def send_webhook(event_id, session_id, status):
    payload = {"id": event_id, "event": f"verification.{status}",
               "data": {"sessionId": session_id, "status": status}}
    raw = json.dumps(payload); ts = str(int(time.time()))
    sig = hmac.new(SECRET.encode(), f"{ts}.{raw}".encode(), hashlib.sha256).hexdigest()
    req = urllib.request.Request(f"{URL}/functions/v1/youverify-webhook",
        data=raw.encode(), method="POST", headers={
            "Content-Type": "application/json",
            "x-youverify-signature": f"sha256={sig}",
            "x-youverify-timestamp": ts,
        })
    try:
        with urllib.request.urlopen(req, timeout=15) as r: return r.status, r.read().decode()
    except urllib.error.HTTPError as e: return e.code, e.read().decode()

def seed(table, status_col, session_id):
    rid = str(uuid.uuid4())
    row = {"id": rid, "user_id": USER_ID, status_col: "pending",
           "youverify_session_id": session_id, "verification_method": "youverify"}
    if table == "kyc_verifications": row["document_type"] = "national_id"
    code, body = rest(f"/rest/v1/{table}", "POST", row)
    assert code in (200, 201), f"seed: {code} {body}"
    return rid

def get_row(table, status_col, rid):
    code, body = rest(f"/rest/v1/{table}?id=eq.{rid}&select={status_col},updated_at")
    return body[0] if code == 200 and body else None

def count_events(event_id):
    code, body = rest(f"/rest/v1/youverify_webhook_events?event_id=eq.{event_id}&select=event_id")
    return len(body) if code == 200 else -1

def cleanup(table, rid): rest(f"/rest/v1/{table}?id=eq.{rid}", "DELETE")

def case_replay(table, status_col) -> bool:
    sid = f"yv_idem_{uuid.uuid4()}"
    eid = f"evt_{uuid.uuid4()}"
    rid = seed(table, status_col, sid)
    try:
        # First delivery
        c1, _ = send_webhook(eid, sid, "approved")
        if c1 != 200: print(f"FAIL {table} 1st HTTP {c1}"); return False
        time.sleep(0.5)
        first = get_row(table, status_col, rid)
        if not first or first[status_col] != "approved":
            print(f"FAIL {table} not approved after 1st: {first}"); return False

        # Replay 4x
        for i in range(4):
            cN, _ = send_webhook(eid, sid, "approved")
            if cN not in (200, 202):
                print(f"FAIL {table} replay#{i} HTTP {cN}"); return False
        time.sleep(0.5)

        after = get_row(table, status_col, rid)
        if after["updated_at"] != first["updated_at"]:
            print(f"FAIL {table} updated_at advanced on replay "
                  f"({first['updated_at']} -> {after['updated_at']})"); return False
        n = count_events(eid)
        if n != 1:
            print(f"FAIL {table} event rows={n}"); return False

        # Conflicting late event (different event_id, status=rejected) must NOT
        # demote a decided row.
        eid2 = f"evt_{uuid.uuid4()}"
        send_webhook(eid2, sid, "rejected")
        time.sleep(0.5)
        post = get_row(table, status_col, rid)
        if post[status_col] != "approved":
            print(f"FAIL {table} terminal state was overwritten: {post}"); return False

        print(f"PASS {table} idempotent (events={n}, terminal preserved)")
        return True
    finally:
        cleanup(table, rid)

def main():
    results = [
        case_replay("kyc_verifications", "status"),
        case_replay("business_kyc", "verification_status"),
    ]
    ok = all(results)
    print("PASS" if ok else "FAIL")
    sys.exit(0 if ok else 1)

if __name__ == "__main__":
    main()
