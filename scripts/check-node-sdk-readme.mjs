#!/usr/bin/env node
/**
 * Validates that every `kob.<resource>` / `kob.<resource>.<method>(` /
 * `kob.<method>(` reference in the Node SDK READMEs is backed by a real
 * public property or method in packages/sdk-node/src/.
 *
 * Run before publishing the SDK:  node scripts/check-node-sdk-readme.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "packages/sdk-node/src");
const READMES = [
  "packages/sdk-node/README.md",
  "public/sdk-downloads/sdk-node-README.md",
  "docs/sdks/node-README-clean.md",
];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts")) out.push(p);
  }
  return out;
}

// Collect every `public readonly <name>:` (resource property),
// every `<name>(...): ` method, and every `async <name>(`.
const methods = new Set();
const properties = new Set();
for (const f of walk(SRC_DIR)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/public\s+readonly\s+(\w+)\s*:/g)) {
    properties.add(m[1]);
  }
  for (const m of src.matchAll(/(?:public\s+)?(?:async\s+)?(\w+)\s*(?:<[^>]+>)?\s*\([^)]*\)\s*:\s*[\w<]/g)) {
    methods.add(m[1]);
  }
  for (const m of src.matchAll(/\basync\s+(\w+)\s*\(/g)) {
    methods.add(m[1]);
  }
}

// Always-known runtime/JS keywords that show up in regex matches but
// aren't part of the SDK surface — ignore.
const KEYWORDS = new Set([
  "if", "for", "while", "switch", "catch", "return", "function",
  "constructor", "new", "set", "get",
]);
for (const k of KEYWORDS) methods.delete(k);

const errors = [];
// kob.<prop> or kob.<prop>.<method>(
const PROP_CALL = /\bkob\.(\w+)(?:\.(\w+)\s*\()?/g;
// kob.<method>( directly
const SELF_METHOD = /\bkob\.(\w+)\s*\(/g;

for (const rel of READMES) {
  let text;
  try { text = readFileSync(join(ROOT, rel), "utf8"); }
  catch { continue; }

  for (const m of text.matchAll(PROP_CALL)) {
    const [, prop, method] = m;
    if (!properties.has(prop) && !methods.has(prop)) {
      errors.push(`${rel}: unknown kob.${prop}`);
    }
    if (method && !methods.has(method)) {
      errors.push(`${rel}: unknown method kob.${prop}.${method}()`);
    }
  }
  for (const m of text.matchAll(SELF_METHOD)) {
    const name = m[1];
    if (!properties.has(name) && !methods.has(name)) {
      errors.push(`${rel}: unknown kob.${name}()`);
    }
  }
}

if (errors.length) {
  console.error("Node SDK README drift detected:\n  " + [...new Set(errors)].join("\n  "));
  process.exit(1);
}
console.log(`OK — README samples match ${methods.size} methods / ${properties.size} resource properties.`);
