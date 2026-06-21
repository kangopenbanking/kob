#!/usr/bin/env node
// Prebuild smoke test: verify install context is sane before Vercel builds.
// Fails fast with a clear message (workspace + exact command) if package.json,
// package-lock.json, node_modules, or critical deps are missing.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const PREFIX = "[vercel-preinstall-check]";

function fail({ workspace = ".", command, reason, hint }) {
  console.error(`\n${PREFIX} FAIL`);
  console.error(`  workspace: ${workspace}`);
  if (command) console.error(`  command:   ${command}`);
  console.error(`  reason:    ${reason}`);
  if (hint) console.error(`  hint:      ${hint}`);
  console.error("");
  process.exit(1);
}
const ok = (msg) => console.log(`${PREFIX} OK: ${msg}`);

const ROOT_INSTALL =
  "npm install --include-workspace-root --legacy-peer-deps --no-audit --no-fund";

// 1) package.json
const pjPath = resolve(root, "package.json");
if (!existsSync(pjPath)) {
  fail({
    command: "ls package.json",
    reason: "package.json not found at workspace root",
    hint: "Vercel must build from the repo root. Check Vercel project Root Directory.",
  });
}
const pj = JSON.parse(readFileSync(pjPath, "utf8"));
ok(`package.json found (${pj.name}@${pj.version})`);

// 2) Node version pin
const declaredNode = pj.engines?.node;
if (declaredNode) ok(`engines.node = ${declaredNode}`);
const nvmrcPath = resolve(root, ".nvmrc");
if (existsSync(nvmrcPath)) {
  ok(`.nvmrc = ${readFileSync(nvmrcPath, "utf8").trim()}`);
}
ok(`runtime node = ${process.version}`);

// 3) Workspaces
const patterns = Array.isArray(pj.workspaces)
  ? pj.workspaces
  : pj.workspaces?.packages || [];
if (patterns.length) {
  ok(`npm workspaces declared: ${JSON.stringify(patterns)}`);
} else {
  ok("no npm workspaces declared — installing root package only");
}

// 4) Lockfile
const lockPath = resolve(root, "package-lock.json");
if (!existsSync(lockPath)) {
  fail({
    command: "npm install --package-lock-only --legacy-peer-deps",
    reason: "package-lock.json missing",
    hint: "Run the command locally and commit the resulting package-lock.json before deploying.",
  });
}
ok(`package-lock.json present (${(statSync(lockPath).size / 1024).toFixed(1)} KB)`);

// 5) node_modules + critical deps (root)
const nm = resolve(root, "node_modules");
if (!existsSync(nm)) {
  fail({
    command: ROOT_INSTALL,
    reason: "node_modules missing after install step",
    hint: "Check Vercel installCommand in vercel.json.",
  });
}
const critical = ["vite", "react", "react-dom"];
const missing = critical.filter((p) => !existsSync(resolve(nm, p, "package.json")));
if (missing.length) {
  fail({
    command: ROOT_INSTALL,
    reason: `critical deps missing from node_modules: ${missing.join(", ")}`,
    hint: "Lockfile may be stale. Regenerate package-lock.json locally and commit it.",
  });
}
ok(`critical deps resolved: ${critical.join(", ")}`);

// 6) Per-workspace package.json presence (cheap pre-flight; full verification
//    happens in vercel-postinstall-check.mjs).
function expandWorkspaces(pats) {
  const out = [];
  for (const pattern of pats) {
    if (pattern.endsWith("/*")) {
      const base = pattern.slice(0, -2);
      const baseAbs = resolve(root, base);
      if (!existsSync(baseAbs)) continue;
      for (const entry of readdirSync(baseAbs)) {
        const abs = join(baseAbs, entry);
        if (statSync(abs).isDirectory() && existsSync(join(abs, "package.json"))) {
          out.push(join(base, entry));
        }
      }
    } else if (existsSync(resolve(root, pattern, "package.json"))) {
      out.push(pattern);
    }
  }
  return out;
}
for (const w of expandWorkspaces(patterns)) {
  const wpj = JSON.parse(readFileSync(resolve(root, w, "package.json"), "utf8"));
  ok(`workspace ready: ${w} (${wpj.name || "unnamed"})`);
}

console.log(`${PREFIX} all checks passed`);
