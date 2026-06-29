#!/usr/bin/env node
/**
 * Non-interactive end-to-end PKCE smoke test.
 *
 * Drives the full RFC 7636 §4 authorization_code + PKCE flow against the
 * deployed sandbox API without a browser:
 *
 *   1. Generate a code_verifier and S256 code_challenge.
 *   2. Call the sandbox-only helper `oauth-sandbox-pkce-dryrun` to mint an
 *      authorization_code bound to that challenge.
 *   3. Exchange the code at /v1/oauth/token with the verifier.
 *   4. Call /v1/health with the resulting bearer token.
 *
 * Required env (provided by the CI workflow as repository / environment secrets):
 *   KOB_SANDBOX_API_BASE         e.g. https://sandbox-api.kangopenbanking.com/v1
 *   KOB_SANDBOX_FUNCTIONS_BASE   e.g. https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1
 *   KOB_SANDBOX_CLIENT_ID        sandbox client (must start with `sbx_`)
 *   KOB_SANDBOX_CLIENT_SECRET    sandbox client secret
 *   KOB_SANDBOX_REDIRECT_URI     redirect URI registered on the sandbox client
 *
 * Exits 0 on full success, non-zero with a diagnostic on any failure.
 * Skips (exit 0) with a clear log line if required secrets are absent — keeps
 * fork PRs and unconfigured environments green.
 */
import { createHash, randomBytes } from 'node:crypto';

const required = [
  'KOB_SANDBOX_API_BASE',
  'KOB_SANDBOX_FUNCTIONS_BASE',
  'KOB_SANDBOX_CLIENT_ID',
  'KOB_SANDBOX_CLIENT_SECRET',
  'KOB_SANDBOX_REDIRECT_URI',
];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.log(`[pkce-smoke] skipping — missing env: ${missing.join(', ')}`);
  process.exit(0);
}

const apiBase = process.env.KOB_SANDBOX_API_BASE.replace(/\/$/, '');
const fnBase = process.env.KOB_SANDBOX_FUNCTIONS_BASE.replace(/\/$/, '');
const clientId = process.env.KOB_SANDBOX_CLIENT_ID;
const clientSecret = process.env.KOB_SANDBOX_CLIENT_SECRET;
const redirectUri = process.env.KOB_SANDBOX_REDIRECT_URI;

function b64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

const codeVerifier = b64url(randomBytes(32));
const codeChallenge = b64url(createHash('sha256').update(codeVerifier).digest());
const state = b64url(randomBytes(16));

console.log('[pkce-smoke] step 1/3 — minting authorization_code (sandbox dryrun)');
const dryrunRes = await fetch(`${fnBase}/oauth-sandbox-pkce-dryrun`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-sandbox': 'true' },
  body: JSON.stringify({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    scope: 'health:read',
    state,
  }),
});
if (!dryrunRes.ok) {
  console.error(`[pkce-smoke] dryrun failed: HTTP ${dryrunRes.status}`);
  console.error(await dryrunRes.text());
  process.exit(1);
}
const { code, state: returnedState } = await dryrunRes.json();
if (!code) {
  console.error('[pkce-smoke] dryrun returned no code');
  process.exit(1);
}
if (returnedState !== state) {
  console.error(`[pkce-smoke] state mismatch: sent ${state}, got ${returnedState}`);
  process.exit(1);
}

console.log('[pkce-smoke] step 2/3 — exchanging code at /oauth/token');
const tokenBody = new URLSearchParams({
  grant_type: 'authorization_code',
  code,
  redirect_uri: redirectUri,
  client_id: clientId,
  code_verifier: codeVerifier,
});
const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
const tokenRes = await fetch(`${apiBase}/oauth/token`, {
  method: 'POST',
  headers: {
    'content-type': 'application/x-www-form-urlencoded',
    authorization: `Basic ${basic}`,
  },
  body: tokenBody.toString(),
});
if (!tokenRes.ok) {
  console.error(`[pkce-smoke] token exchange failed: HTTP ${tokenRes.status}`);
  console.error(await tokenRes.text());
  process.exit(1);
}
const tok = await tokenRes.json();
if (!tok.access_token) {
  console.error('[pkce-smoke] token exchange returned no access_token');
  console.error(JSON.stringify(tok));
  process.exit(1);
}

console.log('[pkce-smoke] step 3/3 — calling /health with bearer');
const healthRes = await fetch(`${apiBase}/health`, {
  headers: { authorization: `Bearer ${tok.access_token}` },
});
if (!healthRes.ok) {
  console.error(`[pkce-smoke] /health failed: HTTP ${healthRes.status}`);
  console.error(await healthRes.text());
  process.exit(1);
}

console.log('[pkce-smoke] PASS — full PKCE authorization_code flow verified end-to-end');
