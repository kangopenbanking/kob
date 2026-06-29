#!/usr/bin/env node
/**
 * Validates that every `$kob->...` and `KangOpenBanking::...` call referenced
 * in the PHP SDK README is backed by a real public method/property in
 * packages/sdk-php/src/.
 *
 * Run before publishing the SDK:  node scripts/check-php-sdk-readme.mjs
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const SRC_DIR = join(ROOT, "packages/sdk-php/src");
const READMES = [
  "packages/sdk-php/README.md",
  "public/sdk-downloads/sdk-php-README.md",
  "docs/sdks/php-README-clean.md",
];

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".php")) out.push(p);
  }
  return out;
}

// Collect every `public function name(` and `public readonly Type $name`
const methods = new Set();
const properties = new Set();
for (const f of walk(SRC_DIR)) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/public(?:\s+static)?\s+function\s+(\w+)\s*\(/g)) {
    methods.add(m[1]);
  }
  for (const m of src.matchAll(/public\s+readonly\s+\w+\s+\$(\w+)/g)) {
    properties.add(m[1]);
  }
}

const errors = [];
const PROP_CALL = /\$kob->(\w+)(->(\w+)\s*\()?/g;     // $kob->prop or $kob->prop->method(
const STATIC_CALL = /KangOpenBanking::(\w+)\s*\(/g;
const SELF_METHOD = /\$kob->(\w+)\s*\(/g;             // $kob->getToken(

for (const rel of READMES) {
  let text;
  try { text = readFileSync(join(ROOT, rel), "utf8"); }
  catch { continue; }

  for (const m of text.matchAll(PROP_CALL)) {
    const [, prop, , method] = m;
    if (!properties.has(prop) && !methods.has(prop)) {
      errors.push(`${rel}: unknown $kob->${prop}`);
    }
    if (method && !methods.has(method)) {
      errors.push(`${rel}: unknown method $kob->${prop}->${method}()`);
    }
  }
  for (const m of text.matchAll(SELF_METHOD)) {
    const name = m[1];
    if (!properties.has(name) && !methods.has(name)) {
      errors.push(`${rel}: unknown $kob->${name}()`);
    }
  }
  for (const m of text.matchAll(STATIC_CALL)) {
    if (!methods.has(m[1])) {
      errors.push(`${rel}: unknown KangOpenBanking::${m[1]}()`);
    }
  }
}

if (errors.length) {
  console.error("PHP SDK README drift detected:\n  " + [...new Set(errors)].join("\n  "));
  process.exit(1);
}
console.log(`OK — README samples match ${methods.size} methods / ${properties.size} resource properties.`);
