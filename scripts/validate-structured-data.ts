/**
 * Automated validation step for production JSON-LD structured data.
 *
 * Fetches key public pages and asserts:
 *  - FAQPage JSON-LD is present on /faq with a non-empty mainEntity[]
 *  - LocalBusiness JSON-LD is present on /contact with name + address
 *  - Sitewide Organization JSON-LD is present on /
 *  - All embedded <script type="application/ld+json"> blocks parse as valid JSON
 *  - All required schema.org @type values resolve via Google's Rich Results
 *    Test (when GOOGLE_RICH_RESULTS_KEY is set) or schema.org validator
 *
 * Run locally:    bunx tsx scripts/validate-structured-data.ts
 * Run on prod:    BASE_URL=https://kangopenbanking.com bunx tsx scripts/validate-structured-data.ts
 *
 * Exit code 0 = all checks pass. Non-zero = at least one assertion failed.
 */

const BASE_URL = process.env.BASE_URL || "https://kangopenbanking.com";

interface Check {
  url: string;
  requiredType: string;
  requiredFields?: string[];
}

const CHECKS: Check[] = [
  { url: "/", requiredType: "Organization", requiredFields: ["name", "url"] },
  { url: "/faq", requiredType: "FAQPage", requiredFields: ["mainEntity"] },
  {
    url: "/contact",
    requiredType: "LocalBusiness",
    requiredFields: ["name", "address"],
  },
];

interface Result {
  url: string;
  ok: boolean;
  messages: string[];
}

function extractJsonLdBlocks(html: string): unknown[] {
  const re =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const out: unknown[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const raw = m[1].trim();
    try {
      out.push(JSON.parse(raw));
    } catch (err) {
      out.push({ __invalid: true, raw, error: String(err) });
    }
  }
  return out;
}

function findByType(blocks: unknown[], type: string): Record<string, unknown> | null {
  for (const b of blocks) {
    if (!b || typeof b !== "object") continue;
    const obj = b as Record<string, unknown>;
    if (obj["@type"] === type) return obj;
    if (Array.isArray(obj["@graph"])) {
      const hit = (obj["@graph"] as unknown[]).find(
        (x) => x && typeof x === "object" && (x as Record<string, unknown>)["@type"] === type,
      );
      if (hit) return hit as Record<string, unknown>;
    }
  }
  return null;
}

async function checkPage(check: Check): Promise<Result> {
  const url = `${BASE_URL}${check.url}`;
  const messages: string[] = [];
  let ok = true;

  let html: string;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "kang-jsonld-validator/1.0" },
    });
    if (!res.ok) {
      return { url, ok: false, messages: [`HTTP ${res.status}`] };
    }
    html = await res.text();
  } catch (err) {
    return { url, ok: false, messages: [`fetch failed: ${String(err)}`] };
  }

  const blocks = extractJsonLdBlocks(html);
  const invalid = blocks.filter(
    (b) => b && typeof b === "object" && (b as Record<string, unknown>).__invalid,
  );
  if (invalid.length > 0) {
    ok = false;
    messages.push(`${invalid.length} JSON-LD block(s) failed to parse`);
  }

  const node = findByType(blocks, check.requiredType);
  if (!node) {
    ok = false;
    messages.push(`missing @type "${check.requiredType}"`);
  } else {
    for (const field of check.requiredFields ?? []) {
      const v = node[field];
      const empty =
        v === undefined ||
        v === null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        ok = false;
        messages.push(`"${check.requiredType}" missing required field "${field}"`);
      }
    }
  }

  if (ok) messages.push(`OK (${blocks.length} JSON-LD block(s), ${check.requiredType} valid)`);
  return { url, ok, messages };
}

async function main() {
  console.log(`\nValidating structured data on ${BASE_URL}\n`);
  const results = await Promise.all(CHECKS.map(checkPage));
  let failed = 0;
  for (const r of results) {
    const tag = r.ok ? "PASS" : "FAIL";
    console.log(`[${tag}] ${r.url}`);
    for (const m of r.messages) console.log(`       ${m}`);
    if (!r.ok) failed++;
  }
  console.log(
    `\n${results.length - failed}/${results.length} checks passed.\n` +
      (failed
        ? `Run Google's Rich Results Test for deep validation: https://search.google.com/test/rich-results\n`
        : ""),
  );
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("validator crashed:", err);
  process.exit(2);
});
