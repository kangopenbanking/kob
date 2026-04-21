#!/usr/bin/env node
/**
 * i18n audit — scans landing surfaces and developer pages for t() usage,
 * classifies each call (valid / placeholder / fully-hardcoded), and emits
 * machine-readable JSON + CSV reports under public/reports/.
 *
 * Run: node scripts/i18n-audit.mjs
 */
import fs from 'node:fs';
import path from 'node:path';

const TARGETS = [
  'src/pages/Index.tsx',
  'src/components/developer/landing/HeroSection.tsx',
  'src/components/developer/landing/SecuritySection.tsx',
  'src/components/developer/landing/ArchitectureSection.tsx',
  'src/components/developer/landing/CodeSnippetSection.tsx',
  'src/components/developer/landing/IntegrationOverview.tsx',
  'src/components/developer/landing/OpenBankingSection.tsx',
  'src/components/developer/landing/SDKSection.tsx',
  'src/components/developer/landing/UseCasesSection.tsx',
  'src/components/developer/landing/AdvancedFeaturesGate.tsx',
  'src/components/Navigation.tsx',
  'src/components/DynamicNavigation.tsx',
];

const T_CALL = /\bt\(\s*(['"])([^'"]+)\1(\s+as\s+any)?\s*\)/g;
const rows = [];

for (const rel of TARGETS) {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) {
    rows.push({ file: rel, line: '', key: '', status: 'file_not_found', suggested: '' });
    continue;
  }
  const lines = fs.readFileSync(full, 'utf8').split('\n');
  let found = 0;
  lines.forEach((ln, i) => {
    const re = new RegExp(T_CALL.source, 'g');
    let m;
    while ((m = re.exec(ln)) !== null) {
      found++;
      rows.push({
        file: rel,
        line: i + 1,
        key: m[2],
        status: m[3] ? 'placeholder_broken' : 'used_valid',
        suggested: m[3]
          ? '(replace with hardcoded English string)'
          : '(valid — resolved by LanguageContext)',
      });
    }
  });
  if (found === 0) {
    rows.push({ file: rel, line: '', key: '(none)', status: 'fully_hardcoded', suggested: 'no action' });
  }
}

const summary = {
  fully_hardcoded: rows.filter((r) => r.status === 'fully_hardcoded').length,
  used_valid: rows.filter((r) => r.status === 'used_valid').length,
  placeholder_broken: rows.filter((r) => r.status === 'placeholder_broken').length,
  file_not_found: rows.filter((r) => r.status === 'file_not_found').length,
};

const outDir = path.join(process.cwd(), 'public', 'reports');
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(
  path.join(outDir, 'i18n-audit.json'),
  JSON.stringify(
    { generated_at: new Date().toISOString(), scanned_files: TARGETS.length, summary, rows },
    null,
    2,
  ),
);

const csv = [
  'file,line,key,status,suggested_replacement',
  ...rows.map((r) =>
    [r.file, r.line, r.key, r.status, `"${r.suggested.replace(/"/g, '""')}"`].join(','),
  ),
].join('\n');
fs.writeFileSync(path.join(outDir, 'i18n-audit.csv'), csv);

console.log(JSON.stringify({ summary, output_dir: 'public/reports/' }, null, 2));

if (summary.placeholder_broken > 0) {
  console.error(`\nFAIL: ${summary.placeholder_broken} placeholder keys found.`);
  process.exit(1);
}
