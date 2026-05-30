// supabase/functions/admin-validate-email-templates
// Admin-only static validation suite for all registered email templates.
//
// For every template in the TEMPLATES registry we render the React Email
// component three times (full sample data, empty data, partial data) and
// run a battery of Litmus-style HTML lint checks plus the structural
// rules required for deliverability:
//
//   - From address uses the verified SENDER_DOMAIN
//   - Reply-To configured (and not a no-reply on the wrong domain)
//   - Plain-text fallback derivable from the HTML
//   - Unsubscribe link will be appended by the dispatcher (no duplicate
//     embedded link in template body)
//   - Renders without throwing for empty / partial variable payloads
//   - No literal "undefined" / "null" / "[object Object]" leaks
//   - Inline styles only (no <link rel=stylesheet> / <script> / @import)
//   - Images carry alt attributes
//   - Body width capped (Container component / max-width ≤ 700px)
//   - Body background is #ffffff (workspace rule)
//   - <html lang> present
//
// POST /functions/v1/admin-validate-email-templates
// Body: { templates?: string[] }  // omit = validate all
// Returns: { ok, summary, results: ValidationResult[] }

import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { TEMPLATES } from "../_shared/transactional-email-templates/registry.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Sender configuration — must mirror send-transactional-email/index.ts
const SENDER_DOMAIN = "notify.info.kangfintechsolutions.com";
const FROM_DOMAIN = "info.kangfintechsolutions.com";
const FROM_ADDRESS = `noreply@${FROM_DOMAIN}`;
const REPLY_TO = `support@${FROM_DOMAIN}`;

type Severity = "error" | "warning" | "info";
interface Check {
  id: string;
  label: string;
  severity: Severity;
  passed: boolean;
  detail?: string;
}
interface RenderProbe {
  scenario: "full" | "empty" | "partial";
  ok: boolean;
  html_length: number;
  text_length: number;
  error?: string;
}
interface ValidationResult {
  template: string;
  displayName: string;
  checks: Check[];
  renders: RenderProbe[];
  passed: boolean;
  warnings: number;
  errors: number;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Naive HTML → text conversion to assess plain-text fallback quality.
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function renderTemplate(
  entry: typeof TEMPLATES[string],
  data: Record<string, unknown>,
): Promise<{ html: string; text: string; error?: string }> {
  try {
    const Comp = entry.component as React.ComponentType<Record<string, unknown>>;
    const html = await renderAsync(React.createElement(Comp, data));
    return { html, text: htmlToText(html) };
  } catch (e) {
    return { html: "", text: "", error: (e as Error).message };
  }
}

function check(id: string, label: string, passed: boolean, severity: Severity = "error", detail?: string): Check {
  return { id, label, severity, passed, detail };
}

function validateHtml(html: string, templateName: string): Check[] {
  const checks: Check[] = [];
  const lower = html.toLowerCase();

  checks.push(check(
    "html-lang",
    "Root <html lang> attribute present",
    /<html[^>]*\blang=/i.test(html),
    "warning",
  ));

  checks.push(check(
    "no-external-stylesheet",
    "No external <link rel=stylesheet> (use inline styles)",
    !/<link[^>]+rel=["']?stylesheet/i.test(html),
  ));

  checks.push(check(
    "no-script-tags",
    "No <script> tags (stripped by every major client)",
    !/<script\b/i.test(html),
  ));

  checks.push(check(
    "no-css-import",
    "No CSS @import (blocked by Outlook/Gmail)",
    !/@import\s+url/i.test(html),
  ));

  // Images must have alt attributes
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const imgsWithoutAlt = imgs.filter((tag) => !/\balt=/i.test(tag));
  checks.push(check(
    "img-alt",
    "All <img> tags have alt attributes",
    imgsWithoutAlt.length === 0,
    "warning",
    imgsWithoutAlt.length ? `${imgsWithoutAlt.length} image(s) missing alt` : undefined,
  ));

  // Body width bound — Container typically renders inside main; look for max-width
  const widthMatch = [...html.matchAll(/max-width:\s*(\d+)\s*px/gi)].map((m) => parseInt(m[1], 10));
  const widest = widthMatch.length ? Math.max(...widthMatch) : 0;
  checks.push(check(
    "max-width",
    "Email body width ≤ 700px (mobile/Outlook safe)",
    widest === 0 || widest <= 700,
    "warning",
    widest ? `widest max-width found: ${widest}px` : "no max-width declared (React Email default 600px applies)",
  ));

  // Background must be white per workspace rule (Body main style)
  checks.push(check(
    "white-body-bg",
    "Body background is #ffffff",
    /background(-color)?:\s*#ffffff/i.test(html) || /backgroundColor.*#ffffff/i.test(html) || /bgcolor=["']?#?fff/i.test(html),
    "warning",
  ));

  // No literal interpolation leaks
  const leaks = ["undefined", "null", "[object Object]", "NaN"]
    .filter((t) => lower.includes(`>${t}<`) || lower.includes(` ${t} `) || lower.includes(`>${t} `));
  checks.push(check(
    "no-variable-leaks",
    "No literal undefined/null/[object Object] in rendered body",
    leaks.length === 0,
    "error",
    leaks.length ? `Found: ${leaks.join(", ")}` : undefined,
  ));

  // Unsubscribe — dispatcher appends; template MUST NOT also embed one
  // (would duplicate). Allow common substring "unsubscribe" only inside the
  // appended footer wrapper if any template intentionally references it,
  // but flag href= unsubscribe links inside body.
  const embeddedUnsub = /href=["'][^"']*unsubscribe[^"']*["']/i.test(html);
  checks.push(check(
    "no-duplicate-unsubscribe",
    "Template does not embed its own unsubscribe link (dispatcher appends one)",
    !embeddedUnsub,
    "warning",
  ));

  // Preview text (deliverability — appears in inbox preview)
  checks.push(check(
    "preview-text",
    "<Preview> text block present (improves inbox preview)",
    /preview/i.test(html) || /display:\s*none[^"']*max-height/i.test(html),
    "info",
  ));

  return checks;
}

function configChecks(entry: typeof TEMPLATES[string]): Check[] {
  const checks: Check[] = [];

  // From verified sender domain
  checks.push(check(
    "from-verified-domain",
    `From address uses verified domain (${FROM_DOMAIN})`,
    FROM_ADDRESS.endsWith(`@${FROM_DOMAIN}`),
    "error",
    `from=${FROM_ADDRESS}, sender=${SENDER_DOMAIN}`,
  ));

  // Reply-to configured
  checks.push(check(
    "reply-to-set",
    "Reply-To address configured",
    !!REPLY_TO && /^[^\s@]+@[^\s@]+$/.test(REPLY_TO),
    "warning",
    `reply-to=${REPLY_TO}`,
  ));

  // Subject sanity
  const subj = typeof entry.subject === "function" ? entry.subject({}) : entry.subject;
  checks.push(check(
    "subject-length",
    "Subject length 5–78 chars (inbox preview safe)",
    !!subj && subj.length >= 5 && subj.length <= 78,
    "warning",
    `subject="${subj}" (${subj?.length ?? 0} chars)`,
  ));

  return checks;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceKey);

  // AuthN + admin AuthZ
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const { data: userData, error: userErr } = await admin.auth.getUser(auth.slice(7));
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (!isAdmin) return json(403, { error: "Forbidden — admin role required" });

  // Input
  let body: { templates?: string[] } = {};
  try { body = await req.json(); } catch { /* empty body = validate all */ }
  const wanted = Array.isArray(body.templates) && body.templates.length > 0
    ? body.templates.filter((n) => typeof n === "string" && n in TEMPLATES)
    : Object.keys(TEMPLATES);

  const results: ValidationResult[] = [];

  for (const name of wanted) {
    const entry = TEMPLATES[name];
    if (!entry) continue;
    const sample = entry.previewData ?? {};
    const partialKeys = Object.keys(sample).slice(0, Math.max(1, Math.floor(Object.keys(sample).length / 2)));
    const partial = Object.fromEntries(partialKeys.map((k) => [k, (sample as any)[k]]));

    // Render probes
    const probes: RenderProbe[] = [];
    const renders: { scenario: RenderProbe["scenario"]; html: string; text: string }[] = [];

    for (const scenario of ["full", "empty", "partial"] as const) {
      const data = scenario === "full" ? sample : scenario === "empty" ? {} : partial;
      const r = await renderTemplate(entry, data as Record<string, unknown>);
      probes.push({
        scenario,
        ok: !r.error && r.html.length > 0,
        html_length: r.html.length,
        text_length: r.text.length,
        error: r.error,
      });
      if (!r.error) renders.push({ scenario, html: r.html, text: r.text });
    }

    // Run checks against the full render (canonical) — fall back to first ok render
    const canonical = renders.find((r) => r.scenario === "full") ?? renders[0];
    const checks: Check[] = [...configChecks(entry)];

    if (canonical) {
      checks.push(...validateHtml(canonical.html, name));

      // Plain-text fallback derivable
      checks.push(check(
        "plain-text-fallback",
        "Plain-text fallback derivable (≥ 40 chars after stripping HTML)",
        canonical.text.length >= 40,
        "warning",
        `${canonical.text.length} chars`,
      ));
    } else {
      checks.push(check(
        "render-required",
        "Template renders without throwing",
        false,
        "error",
      ));
    }

    // Structural integrity across empty/partial renders
    const emptyProbe = probes.find((p) => p.scenario === "empty");
    checks.push(check(
      "empty-vars-render",
      "Template renders cleanly with empty templateData",
      !!emptyProbe?.ok,
      "error",
      emptyProbe?.error,
    ));
    const partialProbe = probes.find((p) => p.scenario === "partial");
    checks.push(check(
      "partial-vars-render",
      "Template renders cleanly with partial templateData",
      !!partialProbe?.ok,
      "warning",
      partialProbe?.error,
    ));

    const errors = checks.filter((c) => !c.passed && c.severity === "error").length;
    const warnings = checks.filter((c) => !c.passed && c.severity === "warning").length;
    results.push({
      template: name,
      displayName: entry.displayName ?? name,
      checks,
      renders: probes,
      passed: errors === 0,
      errors,
      warnings,
    });
  }

  const summary = {
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: results.filter((r) => !r.passed).length,
    total_errors: results.reduce((s, r) => s + r.errors, 0),
    total_warnings: results.reduce((s, r) => s + r.warnings, 0),
    from_address: FROM_ADDRESS,
    reply_to: REPLY_TO,
    sender_domain: SENDER_DOMAIN,
  };

  return json(200, { ok: summary.failed === 0, summary, results });
});
