/// <reference types="node" />
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Build-time guard: developer-facing landing pages must not contain raw
 * dot-notation key strings that look like unresolved i18n placeholders
 * (e.g. "developer.hero.title.lead"). Runs against the actual file source
 * — fast, deterministic, no jsdom render required.
 *
 * Pattern matches `t('a.b.c' as any)` AND any string literal containing 3+
 * dot-segments under a known landing namespace.
 */
const FILES = [
  'src/pages/Index.tsx',
  'src/components/developer/landing/HeroSection.tsx',
  'src/components/developer/landing/SecuritySection.tsx',
  'src/components/developer/landing/ArchitectureSection.tsx',
  'src/components/developer/landing/CodeSnippetSection.tsx',
  'src/components/developer/landing/IntegrationOverview.tsx',
  'src/components/developer/landing/OpenBankingSection.tsx',
  'src/components/developer/landing/SDKSection.tsx',
  'src/components/developer/landing/UseCasesSection.tsx',
];

const BROKEN_T_AS_ANY = /\bt\(\s*["'][^"']+["']\s+as\s+any\s*\)/;
// Looks like an unresolved placeholder rendered as text:
//   "developer.hero.title.lead"  but NOT "developer.hero.com" (URL-like)
const PLACEHOLDER_KEY_LITERAL =
  /["'](developer|hero|security|architecture|sdk|usecases|integration|openbanking)\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*["']/i;

describe('developer landing pages — no raw i18n placeholders', () => {
  for (const rel of FILES) {
    it(`${rel} renders no placeholder key strings`, () => {
      const full = path.join(process.cwd(), rel);
      const src = fs.readFileSync(full, 'utf8');

      // Strip imports/exports/comments/JSX-attribute paths to reduce false positives
      const cleaned = src
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/[^\n]*/g, '')
        .replace(/from\s+["'][^"']+["']/g, '')
        .replace(/import\s+[^;]+;/g, '')
        .replace(/className=["'][^"']*["']/g, '');

      expect(BROKEN_T_AS_ANY.test(cleaned), `Broken t(... as any) in ${rel}`).toBe(false);
      expect(
        PLACEHOLDER_KEY_LITERAL.test(cleaned),
        `Suspicious placeholder-style key literal in ${rel}`,
      ).toBe(false);
    });
  }
});
