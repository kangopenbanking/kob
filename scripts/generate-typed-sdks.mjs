#!/usr/bin/env node
// ============================================================
// Typed SDK Generator — emits TypeScript, Python, Go, and Java
// clients from public/openapi.json into sdks/generated/<lang>/.
//
// Uses @openapitools/openapi-generator-cli (Java-based) under the
// hood. Requires Java 11+ on the host (CI installs it via the
// actions/setup-java step). Locally, the script will print a clear
// error if Java is missing instead of crashing.
//
// Standing Order P5 (Working Code Rule): generated clients must
// compile against the published openapi.json without manual edits.
// Standing Order 6 (Version Gate): emitted package version mirrors
// info.version from the spec so SDK releases track the API.
// ============================================================

import { execSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SPEC = resolve(ROOT, "public/openapi.json");
const OUT_BASE = resolve(ROOT, "sdks/generated");

const TARGETS = [
  {
    lang: "typescript",
    generator: "typescript-fetch",
    out: "typescript",
    additionalProperties: [
      "npmName=@kangopenbanking/sdk-typed",
      "supportsES6=true",
      "withInterfaces=true",
      "typescriptThreePlus=true",
    ],
  },
  {
    lang: "python",
    generator: "python",
    out: "python",
    additionalProperties: [
      "packageName=kangopenbanking_typed",
      "projectName=kangopenbanking-typed",
      "library=urllib3",
    ],
  },
  {
    lang: "go",
    generator: "go",
    out: "go",
    additionalProperties: [
      "packageName=kangopenbanking",
      "isGoSubmodule=false",
    ],
  },
  {
    lang: "java",
    generator: "java",
    out: "java",
    additionalProperties: [
      "groupId=com.kangopenbanking",
      "artifactId=kangopenbanking-sdk-typed",
      "library=okhttp-gson",
      "java8=true",
    ],
  },
];

function checkJava() {
  const r = spawnSync("java", ["-version"], { stdio: "pipe" });
  if (r.status !== 0) {
    console.error(
      "Java 11+ is required (openapi-generator-cli runs on the JVM).\n" +
        "Install OpenJDK locally or rely on CI (.github/workflows/sdk-generate.yml)."
    );
    process.exit(2);
  }
}

function loadVersion() {
  const spec = JSON.parse(readFileSync(SPEC, "utf8"));
  return spec.info?.version ?? "0.0.0";
}

function generate(version) {
  if (!existsSync(SPEC)) {
    console.error(`Spec not found: ${SPEC}`);
    process.exit(1);
  }
  mkdirSync(OUT_BASE, { recursive: true });

  for (const t of TARGETS) {
    const outDir = resolve(OUT_BASE, t.out);
    rmSync(outDir, { recursive: true, force: true });
    mkdirSync(outDir, { recursive: true });

    const props = [
      ...t.additionalProperties,
      `packageVersion=${version}`,
      `artifactVersion=${version}`,
    ].join(",");

    const cmd = [
      "npx --yes @openapitools/openapi-generator-cli@^2.13",
      "generate",
      `-i ${SPEC}`,
      `-g ${t.generator}`,
      `-o ${outDir}`,
      `--additional-properties=${props}`,
      "--skip-validate-spec",
    ].join(" ");

    console.log(`[${t.lang}] generating to ${outDir} ...`);
    try {
      execSync(cmd, { stdio: "inherit", cwd: ROOT });
    } catch (e) {
      console.error(`[${t.lang}] generation failed`);
      process.exit(3);
    }

    writeFileSync(
      resolve(outDir, "GENERATED.md"),
      [
        `# ${t.lang} typed client`,
        ``,
        `Auto-generated from \`public/openapi.json\` v${version} via openapi-generator-cli (${t.generator}).`,
        ``,
        `Do not edit by hand — re-run \`npm run sdk:generate\` to refresh.`,
        ``,
        `For a curated, hand-tuned DX use the package under \`packages/sdk-${t.lang === "typescript" ? "node" : t.lang}\` instead.`,
      ].join("\n") + "\n"
    );
  }

  writeFileSync(
    resolve(OUT_BASE, "VERSION"),
    `${version}\n`
  );
  console.log(`\nGenerated ${TARGETS.length} typed SDKs at version ${version}.`);
}

checkJava();
const version = loadVersion();
generate(version);
