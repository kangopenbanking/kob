/**
 * Source Code Translation String Scanner
 * ---------------------------------------
 * Scans every .tsx/.ts file in src/ at build time using Vite's import.meta.glob,
 * extracts user-facing English strings via regex pattern matching, classifies
 * them by source app (customer/business/banking/admin/web), and produces a
 * deduplicated list ready to be registered for translation.
 *
 * This is the engine behind the admin "Scan & Sync All Strings" button.
 */

// Eagerly load every .tsx/.ts file in src/ as raw text. This runs at build
// time so the bundle contains the complete source tree as strings.
const SOURCE_FILES = import.meta.glob('/src/**/*.{tsx,ts}', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>;

// ---------- Filters ----------------------------------------------------------

const SKIP_PATH_PATTERNS = [
  /\/integrations\/supabase\/types\.ts$/,
  /\/i18n\/(translations|sourceStringScanner)\.ts$/,
  /\.test\.(t|j)sx?$/,
  /\.spec\.(t|j)sx?$/,
  /\/__tests__\//,
];

// Strings we never want in the translation table
const REJECT_PATTERNS = [
  /^[\s\d.,:/\-+%$€£¥₦*#&]+$/,            // numeric-only / punctuation
  /^(https?:\/\/|www\.|mailto:|tel:)/i,    // URLs
  /^[a-z][a-zA-Z0-9_-]*$/,                 // single-word identifiers (camelCase, kebab, snake)
  /^[A-Z_][A-Z0-9_]+$/,                    // CONSTANTS
  /^#?[0-9a-fA-F]{3,8}$/,                  // hex colors / hashes
  /^\$\{.*\}$/,                            // pure template expressions
  /\{\{.*\}\}/,                            // mustache placeholders
  /<[^>]+>/,                               // HTML markup
  /^[\w-]+\/[\w-]+/,                       // mime-types / paths
  /^@\w+\//,                               // npm scoped imports
  /\.(png|jpe?g|svg|webp|gif|ico|css|json|js|ts|tsx|woff2?|ttf|otf|map|md|html)$/i,
  /^(true|false|null|undefined)$/i,
  /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD)$/,
  /^(rgb|rgba|hsl|hsla)\(/,
  /^(px|rem|em|vh|vw|%|fr|deg)$/,
  /^[a-z]+:[a-z]/i,                        // protocol-like / css selectors
];

// Strings (or substrings) that indicate code, not UI copy
const REJECT_SUBSTR = [
  '@/', '../', './', 'lucide-react', 'react', 'supabase', 'tanstack',
  'console.', 'window.', 'document.', 'process.env', 'import.meta',
  'navigator.', 'localStorage', 'sessionStorage',
  'flex ', 'grid ', 'w-', 'h-', 'p-', 'm-', 'text-', 'bg-', 'border-',
  'min-', 'max-', 'gap-', 'rounded', 'shadow', 'opacity', 'animate-',
];

const HARD_SKIP_KEYS = new Set([
  'children', 'className', 'style', 'key', 'ref', 'id', 'name', 'type',
  'href', 'src', 'alt', 'role', 'tabIndex', 'data-testid',
]);

function isLikelyUIString(text: string): boolean {
  const t = text.trim();
  if (t.length < 3 || t.length > 200) return false;
  // Must contain at least one space OR start with capital letter and contain a vowel
  const hasSpace = /\s/.test(t);
  const startsCapital = /^[A-Z]/.test(t);
  const hasVowel = /[aeiouAEIOU]/.test(t);
  if (!hasSpace && !(startsCapital && hasVowel && t.length > 4)) return false;
  // Must contain at least one ASCII letter
  if (!/[A-Za-z]/.test(t)) return false;
  for (const r of REJECT_PATTERNS) if (r.test(t)) return false;
  for (const s of REJECT_SUBSTR) if (t.includes(s)) return false;
  // Reject if it looks like a tailwind class chain
  if (t.split(' ').filter(Boolean).every((w) => /^-?[a-z][\w:/-]*$/.test(w)) && t.split(' ').length > 1) return false;
  return true;
}

// ---------- Categorization ---------------------------------------------------

export type SourceApp = 'customer' | 'business' | 'banking' | 'admin' | 'developer' | 'web';

function classifyPath(path: string): SourceApp {
  const p = path.toLowerCase();
  if (p.includes('/customer-app/') || p.includes('/pages/app/') || p.includes('/customerapp')) return 'customer';
  if (p.includes('/business-app/') || p.includes('/pages/biz/') || p.includes('/businessapp') || p.includes('/merchant')) return 'business';
  if (p.includes('/banking-app/') || p.includes('/pages/bank/') || p.includes('/bankingapp')) return 'banking';
  if (p.includes('/admin/') || p.includes('/pages/admin')) return 'admin';
  if (p.includes('/developer') || p.includes('/docs')) return 'developer';
  return 'web';
}

// ---------- Extractors -------------------------------------------------------

/**
 * Pull JSX text content: ">Hello world<" — between two angle brackets.
 * Captures any non-tag, non-brace text on a single line.
 */
const JSX_TEXT_RE = />\s*([^<>{}\n]+?)\s*</g;

/**
 * Pull string-literal props of common UI attributes:
 *   placeholder="...", title="...", label="...", description="...",
 *   aria-label="...", message="...", toast({title:"...",description:"..."})
 *   <Heading>"..."</Heading>, etc.
 */
const PROP_STRING_RE = /\b(?:placeholder|title|label|description|message|tooltip|aria-label|alt|heading|subheading|subtitle|content|text|caption)\s*[:=]\s*["'`]([^"'`\n]{3,200})["'`]/g;

/**
 * Toast/alert/dialog calls: toast({ title: "...", description: "..." })
 */
const TOAST_OBJ_RE = /\b(?:toast|alert|notify|confirm)\s*\(\s*\{[^}]*?\b(?:title|description|message)\s*:\s*["']([^"'\n]{3,200})["']/g;

function extractFromFile(content: string): Set<string> {
  const found = new Set<string>();
  // Strip block comments + line comments to avoid noise
  const clean = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

  // Strip imports — they contain quoted paths
  const noImports = clean.replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?$/gm, '');

  let m: RegExpExecArray | null;

  while ((m = JSX_TEXT_RE.exec(noImports)) !== null) {
    const t = m[1].trim();
    if (isLikelyUIString(t)) found.add(t);
  }

  while ((m = PROP_STRING_RE.exec(noImports)) !== null) {
    const t = m[1].trim();
    if (isLikelyUIString(t)) found.add(t);
  }

  while ((m = TOAST_OBJ_RE.exec(noImports)) !== null) {
    const t = m[1].trim();
    if (isLikelyUIString(t)) found.add(t);
  }

  return found;
}

// ---------- Stable hash (FNV-1a 32-bit) -------------------------------------

function fnv1a(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

// ---------- Public API ------------------------------------------------------

export interface ScannedString {
  key: string;
  default_value: string;
  category: SourceApp;
  context: string;          // file path
}

export interface ScanReport {
  filesScanned: number;
  filesSkipped: number;
  uniqueStrings: number;
  byApp: Record<SourceApp, number>;
  strings: ScannedString[];
}

export function scanAllSourceStrings(): ScanReport {
  const byApp: Record<SourceApp, number> = {
    customer: 0, business: 0, banking: 0, admin: 0, developer: 0, web: 0,
  };
  const stringMap = new Map<string, ScannedString>(); // key -> entry

  let filesScanned = 0;
  let filesSkipped = 0;

  for (const [path, content] of Object.entries(SOURCE_FILES)) {
    if (SKIP_PATH_PATTERNS.some((r) => r.test(path))) {
      filesSkipped++;
      continue;
    }
    if (!content || typeof content !== 'string') {
      filesSkipped++;
      continue;
    }
    filesScanned++;

    const app = classifyPath(path);
    const found = extractFromFile(content);

    for (const text of found) {
      const key = `auto.${fnv1a(text)}`;
      if (!stringMap.has(key)) {
        stringMap.set(key, {
          key,
          default_value: text,
          category: app,
          context: path.replace(/^\/src\//, ''),
        });
        byApp[app]++;
      }
    }
  }

  const strings = Array.from(stringMap.values());
  return {
    filesScanned,
    filesSkipped,
    uniqueStrings: strings.length,
    byApp,
    strings,
  };
}
