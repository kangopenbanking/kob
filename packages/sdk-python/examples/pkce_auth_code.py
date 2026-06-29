"""
Kang Open Banking — minimal PKCE Authorization Code sample (Python 3.10+).

Run:
    export KOB_BASE=https://sandbox-api.kangopenbanking.com/v1
    export KOB_CLIENT_ID=<your_sandbox_client_id>
    export KOB_REDIRECT_URI=http://127.0.0.1:8765/callback
    export KOB_SCOPE="openid accounts"
    python packages/sdk-python/examples/pkce_auth_code.py

Steps:
    1. Generate a 64-byte code_verifier and S256 code_challenge.
    2. Print the /oauth/authorize URL.  Open it in any browser, sign in,
       consent.
    3. Capture the redirect on 127.0.0.1:8765, validate state, exchange the
       code at /oauth/token with grant_type=authorization_code (public client,
       no client_secret).
    4. Call /health as a sanity probe with the bearer.

RFC 7636 §4 (PKCE).  Stdlib only — uses http.server, urllib, secrets, hashlib.
"""
from __future__ import annotations

import base64
import hashlib
import http.server
import os
import secrets
import sys
import threading
import urllib.parse
import urllib.request


BASE = os.environ.get("KOB_BASE", "https://sandbox-api.kangopenbanking.com/v1")
CLIENT_ID = os.environ.get("KOB_CLIENT_ID")
REDIRECT_URI = os.environ.get("KOB_REDIRECT_URI", "http://127.0.0.1:8765/callback")
SCOPE = os.environ.get("KOB_SCOPE", "openid accounts")

if not CLIENT_ID:
    sys.exit("KOB_CLIENT_ID is required.")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


code_verifier = b64url(secrets.token_bytes(64))
code_challenge = b64url(hashlib.sha256(code_verifier.encode()).digest())
state = b64url(secrets.token_bytes(16))

params = {
    "response_type": "code",
    "client_id": CLIENT_ID,
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPE,
    "state": state,
    "code_challenge": code_challenge,
    "code_challenge_method": "S256",
}
print("\nOpen this URL in your browser, sign in, and consent:\n")
print(f"{BASE}/oauth/authorize?{urllib.parse.urlencode(params)}\n")


captured: dict[str, str] = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):  # noqa: N802
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path != urllib.parse.urlparse(REDIRECT_URI).path:
            self.send_response(404)
            self.end_headers()
            return
        captured.update(dict(urllib.parse.parse_qsl(parsed.query)))
        self.send_response(200)
        self.send_header("content-type", "text/html")
        self.end_headers()
        self.wfile.write(
            b"<h2>Kang Open Banking - code captured. You can close this tab.</h2>"
        )
        threading.Thread(target=self.server.shutdown, daemon=True).start()

    def log_message(self, *_):  # silence
        pass


parsed = urllib.parse.urlparse(REDIRECT_URI)
server = http.server.HTTPServer((parsed.hostname or "127.0.0.1", parsed.port or 8765), Handler)
server.serve_forever()

if captured.get("state") != state:
    sys.exit("state mismatch - possible CSRF")
code = captured.get("code")
if not code:
    sys.exit("no code returned")

print("Received authorization code, exchanging for token...")
body = urllib.parse.urlencode(
    {
        "grant_type": "authorization_code",
        "code": code,
        "client_id": CLIENT_ID,
        "redirect_uri": REDIRECT_URI,
        "code_verifier": code_verifier,
    }
).encode()

req = urllib.request.Request(
    f"{BASE}/oauth/token",
    data=body,
    headers={"content-type": "application/x-www-form-urlencoded"},
)
import json
with urllib.request.urlopen(req, timeout=15) as resp:
    token = json.loads(resp.read())
print(f"Got access token (expires in {token.get('expires_in')}s).")

probe = urllib.request.Request(
    f"{BASE}/health",
    headers={"authorization": f"Bearer {token['access_token']}"},
)
with urllib.request.urlopen(probe, timeout=15) as resp:
    print("Secured /health call returned", resp.status)
