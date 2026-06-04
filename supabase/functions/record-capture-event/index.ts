/**
 * record-capture-event — append-only logger for screenshot attempts and
 * visibility blurs from the Consumer + Banking PWAs (and native shells).
 *
 * - Authenticates the caller via the access token in the Authorization
 *   header. Anonymous calls are accepted (some events fire before auth
 *   resolves) but always insert NULL for user_id.
 * - Hashes the client IP server-side (SHA-256, no salt — same IP from
 *   the same user produces a stable bucket without storing PII).
 * - Validates `kind`, `pathname`, `app_context` strictly.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";

const ALLOWED_KINDS = new Set([
  "key:PrintScreen",
  "key:p",
  "key:s",
  "key:3",
  "key:4",
  "key:5",
  "key:S",
  "contextmenu",
  "copy",
  "visibility:hidden",
  "blur",
  "native:capture_detected",
  "native:secured",
  "native:unsecured",
  "guard:render",
]);

const ALLOWED_CONTEXTS = new Set(["consumer", "banking"]);

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const traceId =
    req.headers.get("x-trace-id") ||
    req.headers.get("traceparent")?.split("-")[1] ||
    crypto.randomUUID().replace(/-/g, "");

  try {
    const body = await req.json().catch(() => ({}));
    const kind = String(body.kind ?? "").slice(0, 64);
    // Accept any kind starting with "key:" + a single key name; otherwise
    // it must be in the explicit allowlist.
    const kindOk =
      ALLOWED_KINDS.has(kind) ||
      (kind.startsWith("key:") && kind.length <= 24);
    const appContext = String(body.app_context ?? "");
    const pathname = String(body.pathname ?? "").slice(0, 256);

    if (!kindOk || !ALLOWED_CONTEXTS.has(appContext) || !pathname) {
      return new Response(
        JSON.stringify({ error: "invalid_payload", trace_id: traceId }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Resolve user from the access token if present. Failure is non-fatal —
    // event is stored with user_id=NULL.
    let userId: string | null = null;
    const auth = req.headers.get("Authorization") ?? "";
    if (auth.toLowerCase().startsWith("bearer ")) {
      try {
        const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
          global: { headers: { Authorization: auth } },
        });
        const { data } = await userClient.auth.getUser();
        userId = data.user?.id ?? null;
      } catch {
        userId = null;
      }
    }

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "";
    const ipHash = ip ? (await sha256(ip)).slice(0, 32) : null;
    const userAgent = (req.headers.get("user-agent") ?? "").slice(0, 256);

    const metadata = typeof body.metadata === "object" && body.metadata !== null ? body.metadata : {};

    const { error } = await admin.from("security_capture_events").insert({
      user_id: userId,
      app_context: appContext,
      kind,
      pathname,
      trace_id: traceId,
      user_agent: userAgent || null,
      ip_hash: ipHash,
      metadata,
    });

    if (error) {
      console.error("[record-capture-event] insert failed", { traceId, error });
      return new Response(
        JSON.stringify({ error: "insert_failed", trace_id: traceId }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } },
      );
    }

    return new Response(JSON.stringify({ ok: true, trace_id: traceId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId },
    });
  } catch (e) {
    console.error("[record-capture-event] unhandled", { traceId, error: String(e) });
    return new Response(
      JSON.stringify({ error: "internal_error", trace_id: traceId }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json", "x-trace-id": traceId } },
    );
  }
});
