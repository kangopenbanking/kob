#!/usr/bin/env node
/**
 * Phase 1B-R1I-c.4 — Remove budgetingDeleteRule from unreleased OpenAPI 4.53.1.
 *
 * - Removes path key "/v1/budgeting/categories/rules/{ruleId}" (only DELETE existed).
 * - Regenerates deterministic JSON and YAML representations.
 * - No version bump. No schema removal (no dedicated rule schema exists).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import yaml from "js-yaml";

const root = process.cwd();
const jsonPath = resolve(root, "public/openapi.json");
const yamlPath = resolve(root, "public/openapi.yaml");

const spec = JSON.parse(readFileSync(jsonPath, "utf8"));

const RULE_PATH = "/v1/budgeting/categories/rules/{ruleId}";
if (!(RULE_PATH in spec.paths)) {
  console.error(`Path ${RULE_PATH} not found; nothing to remove.`);
  process.exit(1);
}
const node = spec.paths[RULE_PATH];
const methods = Object.keys(node).filter((k) =>
  ["get", "post", "put", "delete", "patch", "options", "head"].includes(k),
);
if (methods.length !== 1 || methods[0] !== "delete" || node.delete.operationId !== "budgetingDeleteRule") {
  console.error("Unexpected operations under rules/{ruleId}; aborting", methods);
  process.exit(1);
}
delete spec.paths[RULE_PATH];

// Count remaining ops
let ops = 0;
for (const p of Object.values(spec.paths))
  for (const m of Object.keys(p))
    if (["get", "post", "put", "delete", "patch"].includes(m)) ops++;

if (ops !== 483) {
  console.error(`Operation count mismatch after removal: ${ops} (expected 483)`);
  process.exit(1);
}
if (spec.info.version !== "4.53.1") {
  console.error(`Version drift: ${spec.info.version}`);
  process.exit(1);
}

writeFileSync(jsonPath, JSON.stringify(spec, null, 2) + "\n");
writeFileSync(yamlPath, yaml.dump(spec, { lineWidth: -1, noRefs: true, sortKeys: false }));

console.log(`OK: removed budgetingDeleteRule. ops=${ops} version=${spec.info.version}`);
