#!/usr/bin/env node
/**
 * Phase 1 — Trust & Truthfulness Pass (Kang Open Banking).
 *
 * What this script does (and ONLY this):
 *   1. Reads the current `info.description` from public/openapi.json and public/openapi.yaml.
 *   2. Archives the full original prose verbatim to CHANGELOG_INTERNAL.md (one-time append,
 *      idempotent — re-running is a no-op once the archive exists).
 *   3. Replaces `info.description` in BOTH files with a clean, factual paragraph that:
 *        - removes "COBAC & BEAC compliant" (hedged to "designed for alignment; licensing in progress")
 *        - removes per-version self-grading ("100/100", "final compliance push")
 *        - removes Guardian / Standing Order narration from the public surface
 *        - keeps the same module enumeration and currency note (no scope change)
 *   4. Bumps `info.version` 4.51.0 -> 4.51.1 (patch, additive metadata only) per Standing Order 6.
 *
 * What this script does NOT touch:
 *   - paths, components, schemas, security schemes, tags, servers, x-* vendor extensions
 *   - any operationId, parameter, response, or example
 *   - any SDK source or generated client
 *
 * The OpenAPI JSON is rewritten with 2-space indent and a trailing newline to match the
 * existing repo convention. The YAML file is patched in-place by replacing only the line
 * range that holds the `description: >-` folded scalar; all surrounding YAML is untouched.
 */
import fs from "node:fs";

const JSON_PATH = "public/openapi.json";
const YAML_PATH = "public/openapi.yaml";
const ARCHIVE_PATH = "CHANGELOG_INTERNAL.md";
const OLD_VERSION = "4.51.0";
const NEW_VERSION = "4.51.1";

const NEW_DESCRIPTION = [
  "Kang Open Banking (KOB) v1 API.",
  "",
  "Provides Account Information (AISP), Payment Initiation (PISP), Credit Scoring, Loans, Savings, Mobile Money, a double-entry Ledger, Virtual Card Issuing, Custodial Wallets, Escrow, Compliance Screening, SLA Monitoring, POS Commerce, Bank Directory, Bank Connector Kit, and an Interbank Engine (ISO 20022) for the CEMAC region. Monetary examples use XAF (Central African CFA Franc) unless stated otherwise.",
  "",
  "Regulatory status: this API is designed with COBAC and BEAC requirements in mind. KOB does not currently hold a COBAC or BEAC licence; licensing is in progress. No text on this surface should be interpreted as a claim of certification, accreditation, or regulatory approval.",
  "",
  "Module maturity: AISP and PISP are the production-track modules for v1. Loans, Savings, Virtual Card Issuing, Custodial Wallets, Escrow, Credit Scoring, the Ledger, and Interbank/ISO 20022 are exposed in sandbox for integration and pilot use and are not yet licensed for production traffic. The forthcoming `x-maturity` vendor extension will mark each tag explicitly.",
  "",
  "Authentication: the production-track surface uses OAuth 2.0 Authorization Code with PKCE and rotating refresh tokens. Some advanced flows (mTLS client auth, private_key_jwt, full FAPI 1.0 Advanced) are referenced in the specification but are not yet implemented end-to-end; they are tracked as Planned and must not be relied on for production integrations until separately announced.",
  "",
  "Versioning and changelog: per-release notes live at https://kangopenbanking.com/changelog.json and are also rendered at /developer/changelog. Internal release narration (engineering rationale, governance citations, per-cut self-review) is kept in an internal-only document and is not published on this surface.",
].join("\n");

// ---------- 1. JSON ----------
const json = JSON.parse(fs.readFileSync(JSON_PATH, "utf8"));
const originalJsonDesc = json.info.description ?? "";
const originalJsonVersion = json.info.version;

if (originalJsonVersion !== OLD_VERSION && originalJsonVersion !== NEW_VERSION) {
  throw new Error(`openapi.json info.version is ${originalJsonVersion}, expected ${OLD_VERSION} or ${NEW_VERSION}`);
}

json.info.description = NEW_DESCRIPTION;
json.info.version = NEW_VERSION;
fs.writeFileSync(JSON_PATH, JSON.stringify(json, null, 2) + "\n");

// ---------- 2. YAML ----------
// We do a targeted line-range replacement so unrelated formatting is preserved.
const yamlLines = fs.readFileSync(YAML_PATH, "utf8").split("\n");

// Find `  description: >-` after `info:` and find the next top-level info child
// (a line that begins with exactly two spaces followed by a non-space, non-list character).
let infoStart = -1;
for (let i = 0; i < yamlLines.length; i++) {
  if (yamlLines[i].startsWith("info:")) { infoStart = i; break; }
}
if (infoStart === -1) throw new Error("YAML: info: block not found");

let descStart = -1;
for (let i = infoStart + 1; i < yamlLines.length; i++) {
  if (yamlLines[i].startsWith("  description:")) { descStart = i; break; }
  if (/^[A-Za-z]/.test(yamlLines[i])) break; // left info: block
}
if (descStart === -1) throw new Error("YAML: info.description not found");

let descEnd = -1; // exclusive
for (let i = descStart + 1; i < yamlLines.length; i++) {
  if (/^  [A-Za-z]/.test(yamlLines[i])) { descEnd = i; break; }
  if (/^[A-Za-z]/.test(yamlLines[i])) { descEnd = i; break; }
}
if (descEnd === -1) throw new Error("YAML: end of info.description not found");

// Build replacement: block scalar using literal style `|` so newlines are preserved verbatim.
const replacement = ["  description: |"];
for (const line of NEW_DESCRIPTION.split("\n")) {
  replacement.push(line.length ? `    ${line}` : "");
}

const patchedYamlLines = [
  ...yamlLines.slice(0, descStart),
  ...replacement,
  ...yamlLines.slice(descEnd),
];

// Bump info.version line (it appears as `  version: 4.51.0` inside info:).
for (let i = infoStart + 1; i < Math.min(infoStart + 20, patchedYamlLines.length); i++) {
  if (/^  version:\s*['"]?4\.51\.0['"]?\s*$/.test(patchedYamlLines[i])) {
    patchedYamlLines[i] = `  version: ${NEW_VERSION}`;
    break;
  }
  if (/^  version:\s*['"]?4\.51\.1['"]?\s*$/.test(patchedYamlLines[i])) {
    // already bumped
    break;
  }
}

fs.writeFileSync(YAML_PATH, patchedYamlLines.join("\n"));

// ---------- 3. Archive original prose ----------
const archiveHeader = `# Internal Engineering Changelog (Kang Open Banking)\n\nThis document is **internal only**. It is NOT served from the API, NOT linked from /developer, and NOT part of any public artifact. It exists to preserve the engineering rationale, per-version self-review, and Guardian/Standing-Order citations that were previously embedded in the public OpenAPI \`info.description\`.\n\nIf you are an external integrator, the public changelog is at https://kangopenbanking.com/changelog.json and at /developer/changelog. This file is not part of that surface.\n\n---\n\n## Archive: openapi.json info.description as of ${new Date().toISOString().slice(0, 10)} (pre-v${NEW_VERSION})\n\n\`\`\`\n${originalJsonDesc}\n\`\`\`\n`;

if (!fs.existsSync(ARCHIVE_PATH)) {
  fs.writeFileSync(ARCHIVE_PATH, archiveHeader);
} else {
  // idempotent: only append if this exact archive header is not already present
  const existing = fs.readFileSync(ARCHIVE_PATH, "utf8");
  if (!existing.includes(`pre-v${NEW_VERSION}`)) {
    fs.appendFileSync(ARCHIVE_PATH, "\n---\n\n" + archiveHeader);
  }
}

console.log("Phase 1 patch applied:");
console.log("  - openapi.json info.description: rewritten (factual, hedged)");
console.log("  - openapi.yaml info.description: rewritten (factual, hedged)");
console.log(`  - info.version: ${OLD_VERSION} -> ${NEW_VERSION}`);
console.log(`  - archived original prose -> ${ARCHIVE_PATH}`);
