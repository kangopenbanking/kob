#!/usr/bin/env node
/**
 * Validates that every `kob.<resource>` / `kob.<resource>.<method>(` /
 * `kob.<method>(` reference in the Python SDK READMEs is backed by a real
 * public attribute or method in packages/sdk-python/kangopenbanking/.
 *
 * Run before publishing the SDK:  node scripts/check-python-sdk-readme.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "packages/sdk-python/kangopenbanking");
const READMES = [
  "packages/sdk-python/README.md",
  "public/sdk-downloads/sdk-python-README.md",
  "docs/sdks/python-README-clean.md",
];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".py")) out.push(p);
  }
  return out;
}

// Collect every `self.<name> = ...` (resource attribute on KangOpenBanking),
// and every `def <name>(` method (excluding dunder + leading-underscore privates).
const attributes = new Set();
const methods = new Set();
for (const f of walk(SRC_DIR)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/self\.(\w+)\s*=/g)) {
    const name = m[1];
    if (!name.startsWith("_")) attributes.add(name);
  }
  for (const m of src.matchAll(/def\s+(\w+)\s*\(/g)) {
    const name = m[1];
    if (!name.startsWith("__")) methods.add(name);
  }
}

const errors = [];
// kob.<attr> or kob.<attr>.<method>(
const PROP_CALL = /\bkob\.(\w+)(?:\.(\w+)\s*\()?/g;
// kob.<method>( directly
const SELF_METHOD = /\bkob\.(\w+)\s*\(/g;

for (const rel of READMES) {
  let text;
  try { text = readFileSync(join(ROOT, rel), "utf8"); }
  catch { continue; }

  for (const m of text.matchAll(PROP_CALL)) {
    const [, prop, method] = m;
    if (!attributes.has(prop) && !methods.has(prop)) {
      errors.push(`${rel}: unknown kob.${prop}`);
    }
    if (method && !methods.has(method)) {
      errors.push(`${rel}: unknown method kob.${prop}.${method}()`);
    }
  }
  for (const m of text.matchAll(SELF_METHOD)) {
    const name = m[1];
    if (!attributes.has(name) && !methods.has(name)) {
      errors.push(`${rel}: unknown kob.${name}()`);
    }
  }
}

if (errors.length) {
  console.error("Python SDK README drift detected:\n  " + [...new Set(errors)].join("\n  "));
  process.exit(1);
}
console.log(`OK — README samples match ${methods.size} methods / ${attributes.size} resource attributes.`);
