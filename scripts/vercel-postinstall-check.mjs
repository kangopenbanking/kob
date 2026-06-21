#!/usr/bin/env node
// Postinstall smoke check: verify each npm workspace (and root) has its
// declared dependencies installed. Designed to run after `npm install` on
// Vercel so we fail fast with the exact failing workspace + command.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const root = process.cwd();
const PREFIX = "[vercel-postinstall-check]";
const fail = (workspace, command, msg) => {
  console.error(`\n${PREFIX} FAIL`);
  console.error(`  workspace: ${workspace}`);
  console.error(`  command:   ${command}`);
  console.error(`  reason:    ${msg}\n`);
  process.exit(1);
};
const ok = (msg) => console.log(`${PREFIX} OK: ${msg}`);

function expandWorkspaces(patterns) {
  const out = [];
  for (const pattern of patterns) {
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

function checkWorkspace(relDir) {
  const dir = resolve(root, relDir);
  const pjPath = join(dir, "package.json");
  const installCmd =
    relDir === "."
      ? "npm install --include-workspace-root --legacy-peer-deps"
      : `npm install --workspace ${relDir} --legacy-peer-deps`;
  if (!existsSync(pjPath)) fail(relDir, installCmd, "package.json not found");
  const pj = JSON.parse(readFileSync(pjPath, "utf8"));
  const deps = { ...(pj.dependencies || {}), ...(pj.devDependencies || {}) };
  const names = Object.keys(deps);
  if (names.length === 0) {
    ok(`${relDir} (${pj.name || "unnamed"}) — no deps declared`);
    return;
  }
  // Hoisted installs put deps in root node_modules; check both.
  const localNm = join(dir, "node_modules");
  const rootNm = resolve(root, "node_modules");
  const missing = names.filter(
    (n) =>
      !existsSync(join(localNm, n, "package.json")) &&
      !existsSync(join(rootNm, n, "package.json"))
  );
  if (missing.length) {
    fail(
      relDir,
      installCmd,
      `${missing.length} dependency(ies) not resolved: ${missing.slice(0, 8).join(", ")}${
        missing.length > 8 ? ", …" : ""
      }`
    );
  }
  ok(`${relDir} (${pj.name}) — ${names.length} deps resolved`);
}

const pj = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const patterns = Array.isArray(pj.workspaces)
  ? pj.workspaces
  : pj.workspaces?.packages || [];

checkWorkspace(".");
const workspaces = expandWorkspaces(patterns);
if (workspaces.length === 0) {
  ok("no npm workspaces declared — root-only check complete");
} else {
  ok(`found ${workspaces.length} workspace(s): ${workspaces.join(", ")}`);
  for (const w of workspaces) checkWorkspace(w);
}

console.log(`${PREFIX} all workspaces installed successfully`);
