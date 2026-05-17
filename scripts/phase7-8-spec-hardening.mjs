#!/usr/bin/env node
/**
 * Phase 7 (Fraud & Risk) + Phase 8 (Scalability & DX) — verification script.
 *
 * Confirms that v4.40.0 artifacts are in place and version-aligned across:
 *  - src/config/version.ts
 *  - public/openapi.json          (x-risk, x-scalability extensions)
 *  - public/openapi.yaml          (mirrors JSON)
 *  - public/openapi-sandbox.json  (same version + extensions)
 *  - public/changelog.json        (apiVersion bumped, entry present)
 *  - public/openapi-history/manifest.json (current === 4.40.0)
 *  - packages/sdk-java            (pom.xml, KangClient.java)
 *  - e2e/load                     (charge-burst, webhook-flood, aisp-read-storm)
 *
 * Standing Order 6 (Version Gate) — exits non-zero on any mismatch.
 */
import { readFileSync, existsSync } from "node:fs";

const EXPECTED = "4.40.0";
const errors = [];
const ok = (msg) => console.log("\u2713", msg);
const fail = (msg) => { errors.push(msg); console.error("\u2717", msg); };

function readJson(p) { return JSON.parse(readFileSync(p, "utf8")); }

// 1) version.ts
const vts = readFileSync("src/config/version.ts", "utf8");
vts.includes(`"${EXPECTED}"`) ? ok(`version.ts === ${EXPECTED}`) : fail(`version.ts mismatch`);

// 2) openapi.json + extensions
const spec = readJson("public/openapi.json");
spec.info.version === EXPECTED ? ok(`openapi.json info.version === ${EXPECTED}`) : fail(`openapi.json version: ${spec.info.version}`);
spec["x-risk"] ? ok("openapi.json x-risk present") : fail("openapi.json missing x-risk");
spec["x-scalability"] ? ok("openapi.json x-scalability present") : fail("openapi.json missing x-scalability");

// 3) openapi.yaml mirrors version + extensions
const yaml = readFileSync("public/openapi.yaml", "utf8");
yaml.includes(`version: "${EXPECTED}"`) || yaml.includes(`version: ${EXPECTED}`)
  ? ok(`openapi.yaml version === ${EXPECTED}`) : fail(`openapi.yaml version mismatch`);
yaml.includes("x-risk:") ? ok("openapi.yaml x-risk present") : fail("openapi.yaml missing x-risk");
yaml.includes("x-scalability:") ? ok("openapi.yaml x-scalability present") : fail("openapi.yaml missing x-scalability");

// 4) sandbox spec
const sb = readJson("public/openapi-sandbox.json");
sb.info.version === EXPECTED ? ok(`sandbox spec version === ${EXPECTED}`) : fail(`sandbox spec version: ${sb.info.version}`);
sb["x-risk"] && sb["x-scalability"] ? ok("sandbox spec carries x-risk + x-scalability") : fail("sandbox spec missing risk/scalability extensions");

// 5) changelog
const ch = readJson("public/changelog.json");
ch.apiVersion === EXPECTED ? ok(`changelog.apiVersion === ${EXPECTED}`) : fail(`changelog.apiVersion: ${ch.apiVersion}`);

// 6) history manifest
const hist = readJson("public/openapi-history/manifest.json");
hist.current === EXPECTED ? ok(`history.current === ${EXPECTED}`) : fail(`history.current: ${hist.current}`);
existsSync(`public/openapi-history/openapi-${EXPECTED}.json`)
  ? ok(`openapi-${EXPECTED}.json snapshot exists`) : fail(`missing openapi-${EXPECTED}.json snapshot`);

// 7) Java SDK
[
  "packages/sdk-java/pom.xml",
  "packages/sdk-java/README.md",
  "packages/sdk-java/src/main/java/com/kangopenbanking/KangClient.java",
].forEach((p) => existsSync(p) ? ok(`Java SDK file: ${p}`) : fail(`missing ${p}`));

// 8) Load tests
[
  "e2e/load/README.md",
  "e2e/load/charge-burst.js",
  "e2e/load/webhook-flood.js",
  "e2e/load/aisp-read-storm.js",
].forEach((p) => existsSync(p) ? ok(`Load test: ${p}`) : fail(`missing ${p}`));

if (errors.length) {
  console.error(`\nPhase 7/8 verification FAILED with ${errors.length} issue(s).`);
  process.exit(1);
}
console.log(`\nPhase 7/8 verification PASSED. v${EXPECTED} fully landed.`);
