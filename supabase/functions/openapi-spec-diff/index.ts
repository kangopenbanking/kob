// PERMANENT PUBLIC EDGE FUNCTION — DO NOT GATE OR REDIRECT (Order P1, P4)
//
// /v1/spec/versions  -> { current, versions[] } (manifest)
// /v1/spec/diff?from=A&to=B
//   Compares two OpenAPI snapshots from public/openapi-history/ and returns
//   a structured diff: { from, to, breaking, added_paths, removed_paths,
//   changed_paths, added_schemas, removed_schemas, required_field_changes,
//   summary }. RFC 6902-style intent — additive vs breaking is computed
//   per Standing Order 4 (Surgeon Rule).
//
// Public, unauthenticated, cacheable. Hosted at the edge so consumers do
// not need to download both specs to compute a diff client-side.

import { corsHeaders } from "../_shared/cors.ts";

const PROJECT_REF = Deno.env.get("SUPABASE_URL") ?? "";
// Snapshots are served from the static site (same origin as openapi.json).
// We hard-code the public docs origin here so the function works regardless
// of which Supabase project it is deployed in.
const STATIC_ORIGINS = [
  "https://kangopenbanking.com",
  "https://www.kangopenbanking.com",
];

type ManifestEntry = {
  version: string;
  released_at: string;
  type: "snapshot" | "changelog_only";
  file?: string;
  changelog?: string;
  notes?: string;
};

type Manifest = { current: string; versions: ManifestEntry[] };

async function fetchFirst(paths: string[]): Promise<Response | null> {
  for (const origin of STATIC_ORIGINS) {
    try {
      for (const p of paths) {
        const res = await fetch(`${origin}${p}`, { redirect: "follow" });
        if (res.ok) return res;
      }
    } catch { /* try next origin */ }
  }
  return null;
}

async function loadManifest(): Promise<Manifest> {
  const res = await fetchFirst(["/openapi-history/manifest.json"]);
  if (!res) throw new Error("manifest_unavailable");
  return await res.json();
}

async function loadSpec(version: string, manifest: Manifest): Promise<any> {
  if (version === "current" || version === manifest.current) {
    const res = await fetchFirst(["/openapi.json"]);
    if (!res) throw new Error("current_spec_unavailable");
    return await res.json();
  }
  const entry = manifest.versions.find((v) => v.version === version);
  if (!entry) throw new Error(`unknown_version:${version}`);
  if (entry.type !== "snapshot" || !entry.file) {
    return { __changelog_only: true, version, changelog: entry.changelog, notes: entry.notes };
  }
  const res = await fetchFirst([`/openapi-history/${entry.file}`]);
  if (!res) throw new Error(`snapshot_unavailable:${version}`);
  return await res.json();
}

function diffSpecs(from: any, to: any) {
  const breaking: string[] = [];
  const summary: string[] = [];

  // changelog_only fallback: surface notes rather than fabricate a diff.
  if (from?.__changelog_only || to?.__changelog_only) {
    return {
      mode: "changelog_only",
      from_changelog: from?.__changelog_only ? from.changelog : null,
      to_changelog: to?.__changelog_only ? to.changelog : null,
      breaking: false,
      added_paths: [],
      removed_paths: [],
      changed_paths: [],
      added_schemas: [],
      removed_schemas: [],
      required_field_changes: [],
      summary: [
        "One or both versions are not preserved as machine-readable snapshots.",
        "Refer to the linked changelog for human-readable history.",
      ],
    };
  }

  const fromPaths = Object.keys(from?.paths ?? {});
  const toPaths = Object.keys(to?.paths ?? {});
  const added_paths = toPaths.filter((p) => !fromPaths.includes(p));
  const removed_paths = fromPaths.filter((p) => !toPaths.includes(p));
  removed_paths.forEach((p) => breaking.push(`Removed path: ${p}`));

  const changed_paths: Array<{ path: string; changes: string[] }> = [];
  for (const path of toPaths.filter((p) => fromPaths.includes(p))) {
    const fromOps = from.paths[path] ?? {};
    const toOps = to.paths[path] ?? {};
    const methods = new Set([...Object.keys(fromOps), ...Object.keys(toOps)]);
    const changes: string[] = [];
    for (const m of methods) {
      if (!["get", "post", "put", "patch", "delete"].includes(m)) continue;
      if (!fromOps[m] && toOps[m]) changes.push(`+ ${m.toUpperCase()} added`);
      else if (fromOps[m] && !toOps[m]) {
        changes.push(`- ${m.toUpperCase()} removed`);
        breaking.push(`Removed operation: ${m.toUpperCase()} ${path}`);
      } else if (fromOps[m] && toOps[m]) {
        // Compare response codes
        const fromCodes = Object.keys(fromOps[m].responses ?? {});
        const toCodes = Object.keys(toOps[m].responses ?? {});
        const removedCodes = fromCodes.filter((c) => !toCodes.includes(c));
        const addedCodes = toCodes.filter((c) => !fromCodes.includes(c));
        removedCodes.forEach((c) => {
          changes.push(`  ${m.toUpperCase()} response ${c} removed`);
          breaking.push(`Removed response ${c} from ${m.toUpperCase()} ${path}`);
        });
        addedCodes.forEach((c) => changes.push(`  ${m.toUpperCase()} response ${c} added`));
        // operationId rename
        if (fromOps[m].operationId !== toOps[m].operationId) {
          changes.push(`  operationId changed: ${fromOps[m].operationId} -> ${toOps[m].operationId}`);
          breaking.push(`Renamed operationId on ${m.toUpperCase()} ${path}`);
        }
      }
    }
    if (changes.length) changed_paths.push({ path, changes });
  }

  const fromSchemas = Object.keys(from?.components?.schemas ?? {});
  const toSchemas = Object.keys(to?.components?.schemas ?? {});
  const added_schemas = toSchemas.filter((s) => !fromSchemas.includes(s));
  const removed_schemas = fromSchemas.filter((s) => !toSchemas.includes(s));
  removed_schemas.forEach((s) => breaking.push(`Removed schema: ${s}`));

  const required_field_changes: Array<{ schema: string; added: string[]; removed: string[] }> = [];
  for (const s of toSchemas.filter((x) => fromSchemas.includes(x))) {
    const fr = from.components.schemas[s]?.required ?? [];
    const tr = to.components.schemas[s]?.required ?? [];
    const added = tr.filter((x: string) => !fr.includes(x));
    const removed = fr.filter((x: string) => !tr.includes(x));
    if (added.length || removed.length) {
      required_field_changes.push({ schema: s, added, removed });
      removed.forEach((field: string) => breaking.push(`Removed required field ${field} from schema ${s}`));
    }
  }

  summary.push(`${added_paths.length} added paths, ${removed_paths.length} removed paths, ${changed_paths.length} changed paths.`);
  summary.push(`${added_schemas.length} added schemas, ${removed_schemas.length} removed schemas.`);
  if (breaking.length) summary.push(`${breaking.length} breaking change(s) detected.`);
  else summary.push("No breaking changes detected — fully additive (Standing Order 4).");

  return {
    mode: "structural",
    breaking: breaking.length > 0,
    breaking_changes: breaking,
    added_paths,
    removed_paths,
    changed_paths,
    added_schemas,
    removed_schemas,
    required_field_changes,
    summary,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json", Allow: "GET" },
    });
  }

  const url = new URL(req.url);
  const last = url.pathname.split("/").filter(Boolean).pop();

  try {
    const manifest = await loadManifest();

    if (last === "versions") {
      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=300",
          "X-Fapi-Interaction-Id": crypto.randomUUID(),
        },
      });
    }

    // diff
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to") ?? "current";
    if (!from) {
      return new Response(JSON.stringify({ error: "missing_from", message: "Provide ?from=<version>&to=<version>" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const [fromSpec, toSpec] = await Promise.all([loadSpec(from, manifest), loadSpec(to, manifest)]);
    const result = diffSpecs(fromSpec, toSpec);
    return new Response(JSON.stringify({ from, to, ...result }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
        "X-Fapi-Interaction-Id": crypto.randomUUID(),
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const status = msg.startsWith("unknown_version") ? 404 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
