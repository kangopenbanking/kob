#!/usr/bin/env node
/**
 * Auto-push hardcoded English landing strings into translation_strings.
 *
 * Extracts visible JSX text + key attributes (placeholder, alt, aria-label,
 * title) from landing surfaces. Uploads via the existing
 * `register-translation-strings` edge function so admins can translate them
 * in the standard TranslationManager UI.
 *
 * Each string is keyed by hash so the same copy is never duplicated, and
 * `description` records the source file:line for traceability.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node scripts/i18n-push-hardcoded.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = [
  ['src/pages/Index.tsx', 'index'],
  ['src/components/developer/landing/HeroSection.tsx', 'developer.hero'],
  ['src/components/developer/landing/SecuritySection.tsx', 'developer.security'],
  ['src/components/developer/landing/ArchitectureSection.tsx', 'developer.architecture'],
  ['src/components/developer/landing/CodeSnippetSection.tsx', 'developer.code'],
  ['src/components/developer/landing/IntegrationOverview.tsx', 'developer.integration'],
  ['src/components/developer/landing/OpenBankingSection.tsx', 'developer.openbanking'],
  ['src/components/developer/landing/SDKSection.tsx', 'developer.sdk'],
  ['src/components/developer/landing/UseCasesSection.tsx', 'developer.usecases'],
];

// Match: >text content<, "string literals", and key attribute values.
const JSX_TEXT = />([^<>{}]{3,200})</g;
const STRING_LITERAL = /(?:title|description|label|placeholder|aria-label|alt)\s*[:=]\s*["']([^"']{3,200})["']/g;

function isCopy(s) {
  const t = s.trim();
  if (t.length < 3 || t.length > 200) return false;
  if (!/[A-Za-z]/.test(t)) return false;
  if (/^[\s\d.,:/\-+%$€£¥₦]+$/.test(t)) return false;
  if (/^(https?:\/\/|www\.)/.test(t)) return false;
  if (/^[{<[].*[}>\]]$/.test(t)) return false;
  if (t.includes('{{') || t.includes('}}')) return false;
  return true;
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const collected = new Map();

for (const [rel, category] of TARGETS) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) continue;
  const src = fs.readFileSync(full, 'utf8');
  const lines = src.split('\n');

  for (const re of [JSX_TEXT, STRING_LITERAL]) {
    const r = new RegExp(re.source, 'g');
    let m;
    while ((m = r.exec(src)) !== null) {
      const text = m[1].trim();
      if (!isCopy(text)) continue;
      const offset = m.index;
      const lineNum = src.slice(0, offset).split('\n').length;
      const key = `${category}.${fnv1a(text)}`;
      if (!collected.has(key)) {
        collected.set(key, {
          string_key: key,
          default_value: text,
          category,
          description: `Auto-pushed from ${rel}:${lineNum}`,
        });
      }
    }
  }
}

const strings = Array.from(collected.values());
console.log(`Collected ${strings.length} unique strings from ${TARGETS.length} files.`);

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log('SUPABASE_URL/SUPABASE_ANON_KEY not set — dry run only.');
  fs.mkdirSync('public/reports', { recursive: true });
  fs.writeFileSync(
    'public/reports/i18n-pending-push.json',
    JSON.stringify({ generated_at: new Date().toISOString(), strings }, null, 2),
  );
  console.log('Wrote public/reports/i18n-pending-push.json');
  process.exit(0);
}

const res = await fetch(`${url}/functions/v1/register-translation-strings`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}`, apikey: key },
  body: JSON.stringify({ strings }),
});
console.log(`register-translation-strings → HTTP ${res.status}`);
console.log(await res.text());
