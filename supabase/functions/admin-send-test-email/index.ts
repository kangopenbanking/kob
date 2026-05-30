// supabase/functions/admin-send-test-email
// Admin-only "Send Test Email" — sends a sample render of any registered
// transactional template to a chosen test address using the existing
// send-transactional-email pipeline, then returns the resulting
// email_send_log row so the caller can display delivery status and any
// underlying provider error.
//
// POST /functions/v1/admin-send-test-email
// Body:
//   {
//     template_name: string,        // must be a key in TEMPLATES registry
//     recipient_email: string,      // test address
//     template_data?: object        // overrides for sample variables
//   }
// Returns:
//   {
//     ok: boolean,
//     template_name, recipient_email,
//     idempotency_key, message_id,
//     enqueue_result: { ... },      // raw response from send-transactional-email
//     delivery: { status, error_message, created_at } | null
//   }

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isEmail(v: unknown): v is string {
  return typeof v === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 254;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json(500, { error: "Server configuration error" });

  const admin = createClient(supabaseUrl, serviceKey);

  // ── AuthN ──────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
  const token = authHeader.slice("Bearer ".length);
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return json(401, { error: "Unauthorized" });
  const userId = userData.user.id;

  // ── AuthZ (admin only) ─────────────────────────────────────────────────
  const { data: isAdmin } = await admin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (!isAdmin) return json(403, { error: "Forbidden — admin role required" });

  // ── Input ──────────────────────────────────────────────────────────────
  let body: { template_name?: string; recipient_email?: string; template_data?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "Invalid JSON body" });
  }

  const templateName = body.template_name?.trim();
  const recipient = body.recipient_email?.trim().toLowerCase();
  const templateData = body.template_data && typeof body.template_data === "object" ? body.template_data : {};

  if (!templateName || !/^[a-z0-9-]{1,64}$/.test(templateName)) {
    return json(400, { error: "template_name is required (kebab-case, ≤64 chars)" });
  }
  if (!recipient || !isEmail(recipient)) {
    return json(400, { error: "recipient_email is required and must be a valid email" });
  }

  // ── Invoke send-transactional-email ───────────────────────────────────
  const idempotencyKey = `test-${templateName}-${crypto.randomUUID()}`;
  const startedAt = Date.now();

  let enqueueResult: any = null;
  let enqueueError: string | null = null;
  let httpStatus = 0;
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        templateName,
        recipientEmail: recipient,
        idempotencyKey,
        templateData,
      }),
    });
    httpStatus = resp.status;
    const text = await resp.text();
    try {
      enqueueResult = JSON.parse(text);
    } catch {
      enqueueResult = { raw: text };
    }
    if (!resp.ok) enqueueError = enqueueResult?.error || `HTTP ${resp.status}`;
  } catch (e) {
    enqueueError = (e as Error).message;
  }

  // ── Lookup latest send-log row for this recipient/template ────────────
  let delivery: { status: string; error_message: string | null; created_at: string } | null = null;
  try {
    const { data: logRows } = await admin
      .from("email_send_log")
      .select("status, error_message, created_at")
      .eq("recipient_email", recipient)
      .eq("template_name", templateName)
      .order("created_at", { ascending: false })
      .limit(1);
    if (logRows && logRows.length > 0) delivery = logRows[0] as any;
  } catch {
    // table may be service-role-only; ignore
  }

  // ── Audit ─────────────────────────────────────────────────────────────
  try {
    await admin.from("audit_logs").insert({
      user_id: userId,
      action: "email.test_send",
      resource_type: "email_template",
      resource_id: templateName,
      metadata: {
        recipient_email: recipient,
        idempotency_key: idempotencyKey,
        http_status: httpStatus,
        enqueue_error: enqueueError,
        latency_ms: Date.now() - startedAt,
      },
    });
  } catch {
    // audit_logs may not exist in all environments — non-fatal
  }

  return json(enqueueError ? 502 : 200, {
    ok: !enqueueError,
    template_name: templateName,
    recipient_email: recipient,
    idempotency_key: idempotencyKey,
    http_status: httpStatus,
    latency_ms: Date.now() - startedAt,
    enqueue_result: enqueueResult,
    enqueue_error: enqueueError,
    delivery,
  });
});
