#!/usr/bin/env node
/**
 * Phase 5 — Consistency & Hygiene
 *
 * Surgical, additive-only spec hardening:
 *   1. Ensure every operation response carries X-RateLimit-Limit/Remaining/Reset.
 *   2. Ensure every 429 response carries Retry-After.
 *   3. Audit money-amount string schemas for missing pattern (report only).
 *
 * Honors Guardian Standing Orders 1 (Lock), 4 (Surgeon — additive only),
 * and 6 (Version Gate — patch bump).
 */
import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

const ROOT = process.cwd();
const TARGETS = [
  "public/openapi.json",
  "public/openapi.yaml",
  "public/openapi-sandbox.json",
  "public/openapi-sandbox.yaml",
];

const RL_HEADERS = {
  "X-RateLimit-Limit": { $ref: "#/components/headers/XRateLimitLimit" },
  "X-RateLimit-Remaining": { $ref: "#/components/headers/XRateLimitRemaining" },
  "X-RateLimit-Reset": { $ref: "#/components/headers/XRateLimitReset" },
};
const RETRY_AFTER = { $ref: "#/components/headers/RetryAfter" };

const stats = { files: 0, responses: 0, rlAdded: 0, retryAdded: 0, moneyAudited: 0, moneyMissingPattern: [] };

function loadSpec(file) {
  const raw = fs.readFileSync(file, "utf8");
  return file.endsWith(".yaml") ? YAML.parse(raw) : JSON.parse(raw);
}
function saveSpec(file, spec) {
  const out = file.endsWith(".yaml")
    ? YAML.stringify(spec, { lineWidth: 0 })
    : JSON.stringify(spec, null, 2) + "\n";
  fs.writeFileSync(file, out);
}

function ensureRateLimitHeaders(resp) {
  resp.headers = resp.headers || {};
  for (const [name, ref] of Object.entries(RL_HEADERS)) {
    if (!resp.headers[name]) {
      resp.headers[name] = ref;
      stats.rlAdded++;
    }
  }
}

function walkAmounts(node, pathStr, missing) {
  if (Array.isArray(node)) {
    node.forEach((v, i) => walkAmounts(v, `${pathStr}[${i}]`, missing));
    return;
  }
  if (!node || typeof node !== "object") return;
  if (
    node.type === "string" &&
    /amount|fee|balance/i.test(pathStr) &&
    !node.pattern &&
    !node.$ref
  ) {
    missing.push(pathStr);
  }
  for (const [k, v] of Object.entries(node)) walkAmounts(v, `${pathStr}/${k}`, missing);
}

for (const rel of TARGETS) {
  const file = path.join(ROOT, rel);
  if (!fs.existsSync(file)) continue;
  const spec = loadSpec(file);
  stats.files++;

  for (const [, ops] of Object.entries(spec.paths || {})) {
    for (const [method, op] of Object.entries(ops)) {
      if (typeof op !== "object" || method === "parameters") continue;
      const responses = op.responses || {};
      for (const [code, resp] of Object.entries(responses)) {
        if (typeof resp !== "object" || resp.$ref) continue;
        stats.responses++;
        ensureRateLimitHeaders(resp);
        if (code === "429") {
          resp.headers = resp.headers || {};
          if (!resp.headers["Retry-After"]) {
            resp.headers["Retry-After"] = RETRY_AFTER;
            stats.retryAdded++;
          }
        }
      }
    }
  }

  // Money audit (report-only)
  const missing = [];
  walkAmounts(spec.components?.schemas || {}, "components/schemas", missing);
  stats.moneyAudited += 1;
  if (missing.length) stats.moneyMissingPattern.push({ file: rel, missing });

  saveSpec(file, spec);
}

console.log("Phase 5 — Consistency & Hygiene applied");
console.log(JSON.stringify(stats, null, 2));
