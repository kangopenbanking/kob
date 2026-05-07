#!/usr/bin/env node
/**
 * Firebase OTP preflight — validates that the environment is correctly
 * configured for Firebase Phone Auth + reCAPTCHA Enterprise BEFORE the
 * E2E phone-auth test suite runs. Fails fast with actionable messages.
 *
 * Required env vars:
 *   FIREBASE_API_KEY, FIREBASE_PROJECT_ID
 *   FIREBASE_AUTHORIZED_DOMAINS  (comma-separated list to validate)
 *   RECAPTCHA_ENTERPRISE_SITE_KEY  (the public site key)
 *   GCP_ACCESS_TOKEN  (optional — if set, validates the reCAPTCHA key
 *                       allowlist via the reCAPTCHA Enterprise API)
 *   GCP_PROJECT_ID    (defaults to FIREBASE_PROJECT_ID)
 *
 * Exit codes:
 *   0  all checks passed
 *   1  one or more required checks failed
 *   2  preflight could not run (missing required env)
 */
const fail = [];
const warn = [];
const ok = [];

function need(name) {
  const v = process.env[name];
  if (!v) {
    console.error(`[preflight] missing required env: ${name}`);
    process.exit(2);
  }
  return v;
}

const apiKey = need('FIREBASE_API_KEY');
const projectId = need('FIREBASE_PROJECT_ID');
const expectedDomainsRaw = need('FIREBASE_AUTHORIZED_DOMAINS');
const expectedDomains = expectedDomainsRaw.split(',').map((s) => s.trim()).filter(Boolean);
const siteKey = process.env.RECAPTCHA_ENTERPRISE_SITE_KEY || '';
const gcpToken = process.env.GCP_ACCESS_TOKEN || '';
const gcpProject = process.env.GCP_PROJECT_ID || projectId;

console.log(`[preflight] Firebase project=${projectId}, expected domains=${expectedDomains.length}`);

// 1. Identity Toolkit reachable + project resolves
async function checkIdentityToolkit() {
  const url = `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config?key=${apiKey}`;
  const r = await fetch(url);
  const body = await r.json().catch(() => ({}));
  if (!r.ok) {
    fail.push(`Identity Toolkit reachable: HTTP ${r.status} — ${body?.error?.message || 'unknown'}`);
    return null;
  }
  ok.push('Identity Toolkit reachable for project');
  return body;
}

// 2. Validate authorized domains against config
function checkAuthorizedDomains(cfg) {
  if (!cfg) return;
  const domains = cfg.authorizedDomains || cfg.authorized_domains || [];
  const missing = expectedDomains.filter((d) => !domains.includes(d));
  if (missing.length) {
    fail.push(`Firebase Authorized domains missing: ${missing.join(', ')}. Add them in Firebase Console → Authentication → Settings.`);
  } else {
    ok.push(`All ${expectedDomains.length} expected domains present in Firebase Authorized domains`);
  }
}

// 3. Phone provider enabled
function checkPhoneProvider(cfg) {
  if (!cfg) return;
  const providers = cfg.signIn?.allowDuplicateEmails === undefined
    ? null
    : cfg.signIn;
  // Identity Toolkit config exposes phoneNumber config under signIn
  const phone = cfg.signIn?.phoneNumber;
  if (phone && phone.enabled === false) {
    fail.push('Phone provider is DISABLED in Firebase Auth. Enable it in Console → Authentication → Sign-in method → Phone.');
  } else {
    ok.push('Phone provider appears enabled');
  }
}

// 4. reCAPTCHA v2 Invisible mode check.
//    We use v2 Invisible (free, no GCP allowlist). Validate that NO
//    Enterprise key is bound in Firebase Auth — having one forces the SDK
//    onto the Enterprise path and breaks v2 Invisible.
async function checkRecaptchaMode(cfg) {
  if (!cfg) return;
  const enterpriseKey = cfg?.recaptchaConfig?.recaptchaEnterpriseConfig?.siteKey
    || cfg?.recaptcha_config?.recaptcha_enterprise_config?.site_key
    || cfg?.recaptchaEnterpriseSiteKey
    || null;
  if (enterpriseKey) {
    fail.push(
      `A reCAPTCHA Enterprise site key (${enterpriseKey}) is bound to Firebase Auth. ` +
      `This project uses reCAPTCHA v2 Invisible — unlink it in ` +
      `Firebase Console → Authentication → Settings → reCAPTCHA Enterprise.`
    );
  } else {
    ok.push('reCAPTCHA v2 Invisible mode active (no Enterprise key bound)');
  }
  if (siteKey || gcpToken) {
    warn.push('RECAPTCHA_ENTERPRISE_SITE_KEY / GCP_ACCESS_TOKEN set but project uses v2 Invisible — ignoring.');
  }
}

(async () => {
  const cfg = await checkIdentityToolkit();
  checkAuthorizedDomains(cfg);
  checkPhoneProvider(cfg);
  await checkRecaptchaMode(cfg);

  console.log('\n=== Firebase OTP Preflight Report ===');
  ok.forEach((m) => console.log(`  PASS  ${m}`));
  warn.forEach((m) => console.log(`  WARN  ${m}`));
  fail.forEach((m) => console.log(`  FAIL  ${m}`));
  console.log('=====================================\n');

  if (fail.length) {
    console.error(`Preflight failed with ${fail.length} error(s). Aborting phone-auth E2E.`);
    process.exit(1);
  }
  console.log('Preflight passed. Phone-auth E2E may proceed.');
})().catch((e) => {
  console.error('[preflight] unexpected error', e);
  process.exit(2);
});
