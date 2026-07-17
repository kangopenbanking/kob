#!/usr/bin/env node
// Phase 1B — R1I-d.2A-INFRA — Fail-closed environment guard.
//
// Single shared guard invoked by every d.2A execution script (bootstrap,
// teardown, online harness, fixture, query-plan capture, runtime tests, CI
// workflow). Rejects any environment that is not a disposable, isolated,
// local/CI PostgreSQL suitable for the R1I-d.2A-EV protocol.
//
// The guard NEVER prints passwords or complete connection strings. It emits
// redacted evidence only.
//
// Exit code 0 → environment accepted.
// Exit code >0 → environment rejected; the caller MUST abort.

import { URL } from "node:url";

const REQUIRED_MARKER = "KOB_D2A_DISPOSABLE_ENVIRONMENT";
const REQUIRED_SECRET = "KOB_CURSOR_HMAC_SECRET";
const URL_VAR = "D2A_HARNESS_PGURL";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "postgres", "db"]);
const FORBIDDEN_HOST_SUBSTRINGS = [
  "supabase.co",
  "supabase.net",
  "amazonaws.com",
  "rds.amazonaws",
  "azure.com",
  "cloud.google",
  "gcp.",
  "neon.tech",
  "render.com",
  "digitalocean",
  "planetscale",
  "prod",
  "production",
  "staging",
  "live",
];
const PROTECTED_DB_NAMES = new Set([
  "postgres",
  "template0",
  "template1",
  "supabase",
  "prod",
  "production",
  "live",
  "staging",
  "kob",
  "kang",
  "kangopenbanking",
]);
const FORBIDDEN_PORT = "6543"; // Supabase transaction pooler
const FORBIDDEN_SECRET_HINTS = [
  "prod",
  "production",
  "live",
  "release",
  "master",
];

function fail(code, message, detail) {
  const payload = { ok: false, code, message };
  if (detail) payload.detail = detail;
  process.stdout.write(JSON.stringify(payload) + "\n");
  process.exit(1);
}

function redactHost(host) {
  if (!host) return "<absent>";
  if (LOCAL_HOSTS.has(host)) return host;
  return host.replace(/[^.]/g, "*");
}

function isPublicIPv4(host) {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 127) return false;
  if (a === 10) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  return true;
}

export function runGuard(env = process.env) {
  const evidence = {
    marker: false,
    host: "<absent>",
    port: "<absent>",
    database: "<absent>",
    ci: Boolean(env.CI),
    githubActions: Boolean(env.GITHUB_ACTIONS),
    secretPresent: false,
  };

  // 1. Disposable marker.
  if (env[REQUIRED_MARKER] !== "true") {
    fail(
      "GUARD_MISSING_DISPOSABLE_MARKER",
      `${REQUIRED_MARKER} must be set to the string "true".`,
      evidence,
    );
  }
  evidence.marker = true;

  // 2. Connection URL.
  const raw = env[URL_VAR];
  if (!raw) {
    fail("GUARD_MISSING_PGURL", `${URL_VAR} is not set.`, evidence);
  }
  let u;
  try {
    u = new URL(raw);
  } catch {
    fail("GUARD_INVALID_PGURL", `${URL_VAR} is not a valid URL.`, evidence);
  }
  if (!/^postgres(ql)?:$/.test(u.protocol)) {
    fail(
      "GUARD_INVALID_PROTOCOL",
      `${URL_VAR} must use postgres:// (got ${u.protocol}).`,
      evidence,
    );
  }
  const host = u.hostname;
  const port = u.port || "5432";
  const database = (u.pathname || "").replace(/^\//, "");
  evidence.host = redactHost(host);
  evidence.port = port;
  evidence.database = database || "<absent>";

  // 3. Port must not be the transaction pooler.
  if (port === FORBIDDEN_PORT) {
    fail(
      "GUARD_TRANSACTION_POOLER_PORT",
      `Port ${FORBIDDEN_PORT} (transaction pooler) is prohibited.`,
      evidence,
    );
  }

  // 4. Host must be local, private, or an approved CI service host.
  const hostLower = host.toLowerCase();
  const isKnownLocal = LOCAL_HOSTS.has(hostLower);
  const isPrivate = /^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[0-1])\./.test(hostLower);
  const isCiServiceAlias = env.GITHUB_ACTIONS === "true" && /^[a-z0-9_-]+$/i.test(hostLower);
  if (!isKnownLocal && !isPrivate && !isCiServiceAlias) {
    fail(
      "GUARD_NON_LOCAL_HOST",
      "Host is not a local, private, or approved CI service alias.",
      evidence,
    );
  }
  if (isPublicIPv4(hostLower)) {
    fail("GUARD_PUBLIC_IP_HOST", "Public IP hosts are rejected.", evidence);
  }
  for (const bad of FORBIDDEN_HOST_SUBSTRINGS) {
    if (hostLower.includes(bad)) {
      fail(
        "GUARD_FORBIDDEN_HOST_KEYWORD",
        `Host contains forbidden substring: ${bad}`,
        evidence,
      );
    }
  }

  // 5. Database name must be present, non-protected, and clearly disposable.
  if (!database) {
    fail("GUARD_MISSING_DATABASE_NAME", "Database name is required.", evidence);
  }
  if (PROTECTED_DB_NAMES.has(database.toLowerCase())) {
    fail(
      "GUARD_PROTECTED_DATABASE_NAME",
      `Database "${database}" is protected.`,
      evidence,
    );
  }
  if (!/(test|scratch|ephemeral|disposable|ci|d2a)/i.test(database)) {
    fail(
      "GUARD_DATABASE_NAME_NOT_DISPOSABLE",
      "Database name must contain test|scratch|ephemeral|disposable|ci|d2a.",
      evidence,
    );
  }

  // 6. Test-only cursor secret must exist and must not carry production-like hints.
  const secret = env[REQUIRED_SECRET];
  if (!secret) {
    fail("GUARD_MISSING_CURSOR_SECRET", `${REQUIRED_SECRET} is not set.`, evidence);
  }
  if (secret.length < 32) {
    fail(
      "GUARD_CURSOR_SECRET_TOO_SHORT",
      `${REQUIRED_SECRET} must be at least 32 characters.`,
      evidence,
    );
  }
  for (const hint of FORBIDDEN_SECRET_HINTS) {
    if (secret.toLowerCase().includes(hint)) {
      fail(
        "GUARD_CURSOR_SECRET_LOOKS_PRODUCTION",
        `${REQUIRED_SECRET} value contains forbidden hint: ${hint}`,
        evidence,
      );
    }
  }
  evidence.secretPresent = true;

  return { ok: true, evidence };
}

// CLI usage.
const isCli = import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("guard.mjs");
if (isCli) {
  const result = runGuard();
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}
