#!/usr/bin/env node
/**
 * snapshot-openapi-yaml-history.mjs
 *
 * For every JSON snapshot in `public/openapi-history/openapi-<version>.json`,
 * write a sibling `openapi-<version>.yaml` if it does not exist (or if the
 * YAML is stale). Lets integrators consume the spec per ratchet/spec_version
 * in either format.
 *
 * Idempotent — safe to run on every CI build.
 *
 * Justification: ORDER P4 (Open Spec Rule), ORDER P10 (Living Docs Rule).
 */
import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const ROOT = process.cwd();
const HISTORY = path.join(ROOT, "public/openapi-history");

if (!fs.existsSync(HISTORY)) {
  console.log("snapshot-openapi-yaml-history: no openapi-history dir, skipping.");
  process.exit(0);
}

const files = fs.readdirSync(HISTORY).filter((f) => /^openapi-.*\.json$/.test(f));
let written = 0;
for (const f of files) {
  const jsonPath = path.join(HISTORY, f);
  const yamlPath = jsonPath.replace(/\.json$/, ".yaml");
  try {
    const spec = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const yamlOut = yaml.dump(spec, { lineWidth: 120, noRefs: true });
    if (!fs.existsSync(yamlPath) || fs.readFileSync(yamlPath, "utf8") !== yamlOut) {
      fs.writeFileSync(yamlPath, yamlOut);
      written++;
      console.log(`  • ${path.basename(yamlPath)} written`);
    }
  } catch (err) {
    console.error(`::warning::failed to convert ${f}: ${err.message}`);
  }
}
console.log(
  `snapshot-openapi-yaml-history: ${written ? `${written} yaml file(s) written` : "all snapshots already in sync"}.`,
);
