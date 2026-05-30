// Standalone test/utility edge function that sends a OneSignal push targeted
// by external_user_id (set client-side via OneSignal.login()). Used by the
// admin OneSignal Test Suite to verify end-to-end push delivery.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface Payload {
  external_user_id?: string;     // OneSignal alias (= our auth user id)
  user_ids?: string[];           // OneSignal player ids (fallback)
  title: string;
  message: string;
  url?: string;                  // Deep link launch URL
  data?: Record<string, unknown>;
  channel_for_external_user_id?: "push";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    // RBAC: must be admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id, _role: "admin",
    });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    if (!ONESIGNAL_APP_ID || !ONESIGNAL_REST_API_KEY) {
      return json({ error: "OneSignal not configured" }, 500);
    }

    const body = (await req.json()) as Payload & { test_mode?: boolean };
    // XSS-safe sanitization for any field that may render in-app.
    const sanitize = (s: unknown, max: number) =>
      typeof s === "string"
        ? s.replace(/<\/?[^>]+(>|$)/g, "")
            .replace(/javascript:/gi, "")
            .replace(/on\w+\s*=/gi, "")
            .replace(/[\u0000-\u001F\u007F]/g, "")
            .trim()
            .slice(0, max)
        : "";
    const safeTitle = sanitize(body.title, 120);
    const safeMessage = sanitize(body.message, 500);
    // Restrict deep-link URL: only same-origin paths or https URLs.
    let safeUrl: string | undefined;
    if (body.url && typeof body.url === "string") {
      if (/^\//.test(body.url) || /^https:\/\//i.test(body.url)) {
        safeUrl = body.url.slice(0, 2048);
      }
    }
    if (!safeTitle || !safeMessage) {
      return json({ error: "title and message are required" }, 400);
    }
    if (!body.external_user_id && !(body.user_ids?.length)) {
      return json({ error: "external_user_id or user_ids[] required" }, 400);
    }

    const payload: Record<string, unknown> = {
      app_id: ONESIGNAL_APP_ID,
      headings: { en: safeTitle },
      contents: { en: safeMessage },
      data: { ...(body.data || {}), source: "send-push-notification", test_mode: !!body.test_mode },
      chrome_web_icon: "https://kangopenbanking.com/favicon.png",
    };
    if (safeUrl) {
      payload.url = safeUrl;
      payload.app_url = safeUrl;
    }
    if (body.external_user_id) {
      payload.include_aliases = { external_id: [body.external_user_id] };
      payload.target_channel = "push";
    } else if (body.user_ids?.length) {
      payload.include_player_ids = body.user_ids;
    }
    // Audience isolation: route through env-tagged segment so test runs
    // never hit production-subscribed devices.
    payload.filters = [
      { field: "tag", key: "env", relation: "=", value: body.test_mode ? "test" : "production" },
    ];

    const started = Date.now();
    const resp = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });
    const elapsedMs = Date.now() - started;
    const respBody = await resp.json().catch(() => ({}));

    // Log to push_test_log if the table exists; ignore otherwise.
    try {
      await admin.from("push_test_log").insert({
        triggered_by: user.id,
        target_external_user_id: body.external_user_id ?? null,
        title: safeTitle,
        message: safeMessage,
        url: safeUrl ?? null,
        onesignal_id: respBody?.id ?? null,
        recipients: respBody?.recipients ?? null,
        status: resp.ok ? "sent" : "failed",
        error: resp.ok ? null : (respBody?.errors ?? respBody),
        elapsed_ms: elapsedMs,
      });
    } catch { /* table optional */ }

    if (!resp.ok) {
      return json({ error: "OneSignal API error", details: respBody, status: resp.status }, 502);
    }

    return json({
      success: true,
      onesignal_id: respBody.id,
      recipients: respBody.recipients,
      external_id: respBody.external_id,
      elapsed_ms: elapsedMs,
    });
  } catch (e) {
    console.error("send-push-notification error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
