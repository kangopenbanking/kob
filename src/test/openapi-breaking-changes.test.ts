// @ts-nocheck
/**
 * Breaking-change regression gate.
 *
 * Compares the freshly built `public/openapi.json` against the most recent
 * snapshot in `public/openapi-history/manifest.json` (excluding the current
 * version itself) and FAILS the build if any of the following breaking
 * changes is introduced WITHOUT being declared in `public/changelog.json`
 * for the current version:
 *
 *   - A path was removed
 *   - An operation (HTTP method on a path) was removed
 *   - An operationId was renamed
 *   - A previously documented response status code was removed
 *   - A previously declared enum value was removed from a schema
 *   - A previously required property was removed from required[]
 *
 * If breaking changes ARE detected, the changelog entry for the current
 * version must declare `breaking_changes: true` AND name each broken element
 * inside `highlights[]` or a dedicated `breaking[]` field. A major-version
 * bump (X.0.0) is also required by Standing Order 6.
 *
 * Justification: Standing Orders 1 (Lock), 2 (Ratchet), 4 (Surgeon),
 * 6 (Version Gate); ORDER P7 (Changelog Rule).
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SPEC = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/openapi.json'), 'utf8'));
const MANIFEST = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/openapi-history/manifest.json'), 'utf8'),
);
const CHANGELOG = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'public/changelog.json'), 'utf8'),
);

const HTTP_METHODS = new Set([
  'get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace',
]);

function findPreviousSnapshot(currentVersion) {
  // Pick the most recent snapshot entry whose version != currentVersion AND
  // whose file exists on disk.
  for (const entry of MANIFEST.versions || []) {
    if (entry.type !== 'snapshot') continue;
    if (entry.version === currentVersion) continue;
    const fp = path.join(ROOT, 'public/openapi-history', entry.file);
    if (fs.existsSync(fp)) return { entry, spec: JSON.parse(fs.readFileSync(fp, 'utf8')) };
  }
  return null;
}

function diffSpecs(prev, cur) {
  const breaks = [];

  const prevPaths = prev.paths || {};
  const curPaths = cur.paths || {};

  for (const p of Object.keys(prevPaths)) {
    if (!(p in curPaths)) {
      breaks.push({ kind: 'path_removed', element: p });
      continue;
    }
    const prevOps = prevPaths[p];
    const curOps = curPaths[p];

    for (const m of Object.keys(prevOps)) {
      if (!HTTP_METHODS.has(m)) continue;
      if (!(m in curOps)) {
        breaks.push({ kind: 'operation_removed', element: `${m.toUpperCase()} ${p}` });
        continue;
      }
      const prevOp = prevOps[m];
      const curOp = curOps[m];

      // operationId rename
      if (
        prevOp?.operationId &&
        curOp?.operationId &&
        prevOp.operationId !== curOp.operationId
      ) {
        breaks.push({
          kind: 'operationId_renamed',
          element: `${m.toUpperCase()} ${p}: ${prevOp.operationId} -> ${curOp.operationId}`,
        });
      }

      // Response codes removed
      const prevCodes = Object.keys(prevOp?.responses || {});
      const curCodes = new Set(Object.keys(curOp?.responses || {}));
      for (const code of prevCodes) {
        if (!curCodes.has(code)) {
          breaks.push({
            kind: 'response_code_removed',
            element: `${m.toUpperCase()} ${p} -> ${code}`,
          });
        }
      }
    }
  }

  // Schemas: enum value removed, required field removed
  const prevSchemas = prev.components?.schemas || {};
  const curSchemas = cur.components?.schemas || {};
  for (const name of Object.keys(prevSchemas)) {
    const ps = prevSchemas[name];
    const cs = curSchemas[name];
    if (!cs) continue; // schema removal is caught indirectly via $ref breakage; not flagged here
    // Required[]
    const prevReq = Array.isArray(ps?.required) ? ps.required : [];
    const curReq = new Set(Array.isArray(cs?.required) ? cs.required : []);
    for (const f of prevReq) {
      if (!curReq.has(f)) {
        breaks.push({ kind: 'required_removed', element: `${name}.${f}` });
      }
    }
    // Enum on top-level + on properties
    function compareEnums(prevNode, curNode, prefix) {
      if (Array.isArray(prevNode?.enum)) {
        const curEnum = new Set(Array.isArray(curNode?.enum) ? curNode.enum : []);
        for (const v of prevNode.enum) {
          if (!curEnum.has(v)) {
            breaks.push({ kind: 'enum_value_removed', element: `${prefix} -> ${v}` });
          }
        }
      }
    }
    compareEnums(ps, cs, name);
    const prevProps = ps?.properties || {};
    const curProps = cs?.properties || {};
    for (const propName of Object.keys(prevProps)) {
      const cp = curProps[propName];
      if (!cp) continue;
      compareEnums(prevProps[propName], cp, `${name}.${propName}`);
    }
  }

  return breaks;
}

function changelogDeclaresBreakingChanges(version, breaks) {
  const entry = (CHANGELOG.entries || []).find((e) => e.version === version);
  if (!entry) return { declared: false, reason: `no changelog entry for v${version}` };
  if (!entry.breaking_changes) {
    return {
      declared: false,
      reason: `changelog entry for v${version} has breaking_changes=false`,
    };
  }
  // Every broken element must be referenced (by substring) in highlights[] or breaking[]
  const corpus = JSON.stringify({
    highlights: entry.highlights || [],
    breaking: entry.breaking || [],
    summary: entry.summary || '',
  }).toLowerCase();
  const undocumented = [];
  for (const b of breaks) {
    // Try each token of the element to find a reference
    const needle = b.element.toLowerCase().split(/\s+|->/).map((s) => s.trim()).filter(Boolean);
    const ok = needle.some((n) => n.length > 2 && corpus.includes(n));
    if (!ok) undocumented.push(b);
  }
  if (undocumented.length) {
    return {
      declared: false,
      reason:
        `changelog entry for v${version} declares breaking_changes but does not name: ` +
        undocumented.map((b) => `[${b.kind}] ${b.element}`).join('; '),
    };
  }
  return { declared: true };
}

describe('OpenAPI breaking-change gate', () => {
  const currentVersion = SPEC.info.version;
  const prevSnapshot = findPreviousSnapshot(currentVersion);

  it('there is a previous snapshot to compare against (manifest hygiene)', () => {
    expect(
      prevSnapshot,
      'No previous snapshot found in public/openapi-history/manifest.json. ' +
        'Add at least one historical "snapshot" entry to make breaking-change ' +
        'detection meaningful.',
    ).not.toBeNull();
  });

  it('every breaking change vs the previous snapshot is declared in the changelog', () => {
    if (!prevSnapshot) return;
    const breaks = diffSpecs(prevSnapshot.spec, SPEC);
    if (breaks.length === 0) return; // additive-only release — Surgeon Rule satisfied

    // If breaks exist, the bump must be MAJOR (X.0.0) and the changelog must declare them.
    const [prevMajor] = String(prevSnapshot.entry.version).split('.').map((n) => Number(n));
    const [curMajor] = String(currentVersion).split('.').map((n) => Number(n));
    expect(
      curMajor,
      `Breaking changes detected vs v${prevSnapshot.entry.version} but version ` +
        `did not bump major (${prevSnapshot.entry.version} -> ${currentVersion}). ` +
        `Standing Order 6 requires a major bump for breaking changes.\n` +
        breaks.map((b) => `  - [${b.kind}] ${b.element}`).join('\n'),
    ).toBeGreaterThan(prevMajor);

    const verdict = changelogDeclaresBreakingChanges(currentVersion, breaks);
    expect(verdict.declared, verdict.reason).toBe(true);
  });
});
