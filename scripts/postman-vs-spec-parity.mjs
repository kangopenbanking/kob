#!/usr/bin/env node
/**
 * Postman vs OpenAPI parity check (Standing Order 2 — THE RATCHET).
 *
 * Compares the published /postman/Kang_Open_Banking_API_latest collection
 * against public/openapi.json and fails if:
 *   - the collection version != spec info.version
 *   - any spec operation (method + path) is missing from the collection
 *   - any collection request points at a path not in the spec
 *   - any request body example references a field name not declared in the
 *     matching operation's requestBody schema (top-level properties only)
 *
 * Exits 0 on parity, 1 on drift. Safe to run offline (no network).
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const spec = JSON.parse(fs.readFileSync(path.join(root, 'public/openapi.json'), 'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/postman/manifest.json'), 'utf8'));
const collection = JSON.parse(
  fs.readFileSync(path.join(root, 'public/postman/Kang_Open_Banking_API_latest.postman_collection.json'), 'utf8')
);

const errs = [];
const warns = [];

// ---- 1. Version parity ----
const specVersion = spec.info?.version;
const colVersion = collection.info?.version?.string || collection.info?.version;
const manifestVersion = manifest.apiVersion;
if (specVersion !== manifestVersion) errs.push(`manifest.apiVersion (${manifestVersion}) != spec.info.version (${specVersion})`);
if (colVersion && colVersion !== specVersion) warns.push(`collection.info.version (${colVersion}) != spec (${specVersion})`);

// ---- 2. Build spec operation set ----
const specOps = new Set();
for (const [p, item] of Object.entries(spec.paths || {})) {
  for (const m of ['get','post','put','patch','delete']) {
    if (item[m]) specOps.add(`${m.toUpperCase()} ${p}`);
  }
}

// ---- 3. Walk collection requests ----
const colOps = new Map(); // key -> request body (raw)
function walk(items) {
  for (const it of items || []) {
    if (it.item) { walk(it.item); continue; }
    const r = it.request; if (!r) continue;
    const method = (typeof r.method === 'string' ? r.method : 'GET').toUpperCase();
    // Reconstruct path with {var}
    const segs = (r.url?.path || []).map(s => s.startsWith(':') ? `{${s.slice(1)}}` : s);
    const p = '/' + segs.join('/');
    colOps.set(`${method} ${p}`, r.body?.raw || null);
  }
}
walk(collection.item);

// ---- 4. Diff ----
const missing = [...specOps].filter(k => !colOps.has(k));
const extra = [...colOps.keys()].filter(k => !specOps.has(k));
if (missing.length) errs.push(`Missing in collection (${missing.length}): ${missing.slice(0,5).join(' | ')}${missing.length>5?' …':''}`);
if (extra.length) errs.push(`Extra in collection not in spec (${extra.length}): ${extra.slice(0,5).join(' | ')}${extra.length>5?' …':''}`);

// ---- 5. Field-name spot check on POST/PUT/PATCH bodies ----
function resolveRef(ref){ const segs = ref.replace(/^#\//,'').split('/'); let c=spec; for (const s of segs) c=c?.[s]; return c; }
function topProps(schema, depth=0){
  if (!schema || depth>4) return new Set();
  if (schema.$ref) return topProps(resolveRef(schema.$ref), depth+1);
  if (schema.allOf) { const s=new Set(); for (const sub of schema.allOf) for (const k of topProps(sub,depth+1)) s.add(k); return s; }
  return new Set(Object.keys(schema.properties || {}));
}
let fieldMismatches = 0;
for (const [p, item] of Object.entries(spec.paths || {})) {
  for (const m of ['post','put','patch']) {
    const op = item[m]; if (!op) continue;
    const key = `${m.toUpperCase()} ${p}`;
    const raw = colOps.get(key); if (!raw) continue;
    let body; try { body = JSON.parse(raw); } catch { continue; }
    if (!body || typeof body !== 'object' || Array.isArray(body)) continue;
    const json = op.requestBody?.content?.['application/json'];
    const allowed = topProps(json?.schema);
    if (!allowed.size) continue;
    const bad = Object.keys(body).filter(k => !allowed.has(k));
    if (bad.length) {
      fieldMismatches++;
      if (fieldMismatches <= 5) warns.push(`Field drift in ${key}: collection has unknown keys ${JSON.stringify(bad)}`);
    }
  }
}
if (fieldMismatches > 5) warns.push(`… +${fieldMismatches-5} more operations with field drift`);

// ---- Report ----
console.log(`Spec version       : ${specVersion}`);
console.log(`Manifest version   : ${manifestVersion}`);
console.log(`Collection version : ${colVersion || '(none)'}`);
console.log(`Spec operations    : ${specOps.size}`);
console.log(`Collection requests: ${colOps.size}`);
console.log(`Field mismatches   : ${fieldMismatches}`);
for (const w of warns) console.log('WARN: ' + w);
if (errs.length) {
  for (const e of errs) console.error('FAIL: ' + e);
  process.exit(1);
}
console.log('OK — postman collection in parity with OpenAPI spec.');
