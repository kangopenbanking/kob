#!/usr/bin/env node
// Prebuild smoke test: verify install context is sane before Vercel builds.
// Fails fast with a clear message if package.json / package-lock.json / node_modules
// are missing or inconsistent, so build logs are actionable instead of npm help dumps.
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const fail = (msg) => {
  console.error(`\n[vercel-preinstall-check] FAIL: ${msg}\n`);
  process.exit(1);
};
const ok = (msg) => console.log(`[vercel-preinstall-check] OK: ${msg}`);

const pjPath = resolve(root, "package.json");
if (!existsSync(pjPath)) fail("package.json not found at workspace root");
const pj = JSON.parse(readFileSync(pjPath, "utf8"));
ok(`package.json found (${pj.name}@${pj.version})`);

if (pj.workspaces) {
  ok(`npm workspaces declared: ${JSON.stringify(pj.workspaces)}`);
} else {
  ok("no npm workspaces declared — installing root package only");
}

const lockPath = resolve(root, "package-lock.json");
if (!existsSync(lockPath)) {
  fail(
    "package-lock.json missing. Run `npm install --package-lock-only` locally and commit it before deploying."
  );
}
ok(`package-lock.json present (${(statSync(lockPath).size / 1024).toFixed(1)} KB)`);

const nm = resolve(root, "node_modules");
if (!existsSync(nm)) {
  fail(
    "node_modules missing after install. Check Vercel installCommand and that --legacy-peer-deps is set if peer conflicts exist."
  );
}

const critical = ["vite", "react", "react-dom"];
const missing = critical.filter((p) => !existsSync(resolve(nm, p, "package.json")));
if (missing.length) {
  fail(`critical deps missing from node_modules: ${missing.join(", ")}`);
}
ok(`critical deps resolved: ${critical.join(", ")}`);

console.log("[vercel-preinstall-check] all checks passed");
