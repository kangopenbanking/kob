/**
 * Kang Open Banking — minimal PKCE Authorization Code sample (Node 18+).
 *
 * Run:
 *   export KOB_BASE=https://sandbox-api.kangopenbanking.com/v1
 *   export KOB_CLIENT_ID=<your_sandbox_client_id>
 *   export KOB_REDIRECT_URI=http://127.0.0.1:8765/callback
 *   export KOB_SCOPE="openid accounts payments"
 *   bun packages/sdk-node/examples/pkce-auth-code.ts
 *
 * The script:
 *   1. Generates a 64-byte code_verifier and S256 code_challenge.
 *   2. Prints the /oauth/authorize URL — open it in any browser, sign in,
 *      consent.
 *   3. Listens on http://127.0.0.1:8765/callback for the redirect, captures
 *      ?code=&state= and validates state.
 *   4. Exchanges the code at /oauth/token with grant_type=authorization_code
 *      and the verifier (no client_secret — public client).
 *   5. Calls /health as a sanity probe with the returned bearer.
 *
 * RFC 7636 §4 (PKCE). No third-party deps; uses Node's built-in http + crypto.
 */
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { URL } from 'node:url';

const BASE = process.env.KOB_BASE ?? 'https://sandbox-api.kangopenbanking.com/v1';
const CLIENT_ID = process.env.KOB_CLIENT_ID;
const REDIRECT_URI = process.env.KOB_REDIRECT_URI ?? 'http://127.0.0.1:8765/callback';
const SCOPE = process.env.KOB_SCOPE ?? 'openid accounts';

if (!CLIENT_ID) {
  console.error('KOB_CLIENT_ID is required.');
  process.exit(1);
}

const b64url = (buf: Buffer) =>
  buf.toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');

const codeVerifier = b64url(randomBytes(64));
const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());
const state = b64url(randomBytes(16));

const authorizeUrl = new URL(`${BASE}/oauth/authorize`);
authorizeUrl.searchParams.set('response_type', 'code');
authorizeUrl.searchParams.set('client_id', CLIENT_ID);
authorizeUrl.searchParams.set('redirect_uri', REDIRECT_URI);
authorizeUrl.searchParams.set('scope', SCOPE);
authorizeUrl.searchParams.set('state', state);
authorizeUrl.searchParams.set('code_challenge', codeChallenge);
authorizeUrl.searchParams.set('code_challenge_method', 'S256');

console.log('\nOpen this URL in your browser, sign in, and consent:\n');
console.log(authorizeUrl.toString(), '\n');

const code: string = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    if (!req.url) return;
    const url = new URL(req.url, REDIRECT_URI);
    if (url.pathname !== new URL(REDIRECT_URI).pathname) {
      res.writeHead(404).end();
      return;
    }
    const returnedState = url.searchParams.get('state');
    const returnedCode = url.searchParams.get('code');
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end('<h2>Kang Open Banking — code captured. You can close this tab.</h2>');
    server.close();
    if (returnedState !== state) return reject(new Error('state mismatch — possible CSRF'));
    if (!returnedCode) return reject(new Error('no code returned'));
    resolve(returnedCode);
  });
  const { port, hostname } = new URL(REDIRECT_URI);
  server.listen(Number(port), hostname);
});

console.log('Received authorization code, exchanging for token...');

const tokenRes = await fetch(`${BASE}/oauth/token`, {
  method: 'POST',
  headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_verifier: codeVerifier,
  }),
});

if (!tokenRes.ok) {
  console.error('token exchange failed:', tokenRes.status, await tokenRes.text());
  process.exit(1);
}
const token = await tokenRes.json() as { access_token: string; token_type: string; expires_in: number };
console.log('Got access token (expires in', token.expires_in, 's).');

const probe = await fetch(`${BASE}/health`, {
  headers: { authorization: `Bearer ${token.access_token}` },
});
console.log('Secured /health call returned', probe.status);
process.exit(probe.ok ? 0 : 1);
