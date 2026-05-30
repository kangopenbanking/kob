import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Security helpers ─────────────────────────────────────────────
// Strip HTML/script tags to prevent stored-XSS via NotificationCenter
// rendering. Notification trays render plain text, but the in-app
// NotificationCenter component renders {title}/{message} into the DOM.
function sanitizeText(input: unknown, maxLen: number): string {
  if (typeof input !== "string") return "";
  return input
    .replace(/<\/?[^>]+(>|$)/g, "")           // strip tags
    .replace(/javascript:/gi, "")              // strip js: protocols
    .replace(/on\w+\s*=/gi, "")                // strip inline handlers
    .replace(/[\u0000-\u001F\u007F]/g, "")     // strip control chars
    .trim()
    .slice(0, maxLen);
}

// Per-user rate limit. NOTE: the platform does not yet have first-class
// rate-limit primitives — this is an ad-hoc DB-backed counter that uses
// the recent `app_notifications` insert history for the target user.
// Max 20 push-notification inserts per 60s per recipient.
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 20;
async function isRateLimited(admin: any, userId: string): Promise<boolean> {
  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const { count } = await admin
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  return (count ?? 0) >= RATE_MAX;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PUSHER_APP_ID = Deno.env.get("PUSHER_APP_ID");
    const PUSHER_KEY = Deno.env.get("PUSHER_KEY");
    const PUSHER_SECRET = Deno.env.get("PUSHER_SECRET");
    const PUSHER_CLUSTER = Deno.env.get("PUSHER_CLUSTER") || "eu";
    const ONESIGNAL_APP_ID = Deno.env.get("ONESIGNAL_APP_ID");
    const ONESIGNAL_REST_API_KEY = Deno.env.get("ONESIGNAL_REST_API_KEY");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── AuthN/AuthZ ─────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    // Allow service-role calls (DB triggers / internal cron) to bypass.
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;
    let callerId: string | null = null;
    let callerIsAdmin = false;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: userErr } = await userClient.auth.getUser();
      if (userErr || !user) return json({ error: "Unauthorized" }, 401);
      callerId = user.id;
      const { data: roleData } = await admin.rpc("has_role", {
        _user_id: user.id, _role: "admin",
      });
      callerIsAdmin = !!roleData;
    }

    const body = await req.json();
    const {
      user_id, institution_id, type, title, message, icon, metadata,
      title_fr, message_fr, locale: explicitLocale,
      test_mode,
    } = body;

    if (!user_id || !title || !message) {
      return json(
        { error: "user_id, title, and message are required" }, 400
      );
    }

    // Authorization: a non-admin, non-service caller may only target
    // themselves. Prevents User A → User B notification spam/phishing.
    if (!isServiceRole && !callerIsAdmin && callerId !== user_id) {
      return json({ error: "Forbidden: cannot send to another user" }, 403);
    }

    // Rate limit (skip for service-role internal callers).
    if (!isServiceRole && await isRateLimited(admin, user_id)) {
      return json({ error: "Rate limit exceeded for recipient" }, 429);
    }

    // Sanitize all user-visible fields.
    const safeTitle    = sanitizeText(title, 120);
    const safeMessage  = sanitizeText(message, 500);
    const safeTitleFr  = title_fr   ? sanitizeText(title_fr, 120)   : undefined;
    const safeMsgFr    = message_fr ? sanitizeText(message_fr, 500) : undefined;
    const safeIcon     = sanitizeText(icon || "default", 64);
    if (!safeTitle || !safeMessage) {
      return json({ error: "title/message empty after sanitization" }, 400);
    }

    // Resolve recipient locale
    let recipientLocale: 'en' | 'fr' = 'en';
    if (explicitLocale === 'fr' || explicitLocale === 'en') {
      recipientLocale = explicitLocale;
    } else {
      const { data: pref } = await admin
        .from('user_preferences')
        .select('language')
        .eq('user_id', user_id)
        .maybeSingle();
      if (pref?.language === 'fr' || pref?.language === 'en') {
        recipientLocale = pref.language as 'en' | 'fr';
      }
    }

    const storedTitle   = recipientLocale === 'fr' && safeTitleFr ? safeTitleFr : safeTitle;
    const storedMessage = recipientLocale === 'fr' && safeMsgFr   ? safeMsgFr   : safeMessage;

    const { data: notification, error: insertError } = await admin
      .from("app_notifications")
      .insert({
        user_id,
        institution_id: institution_id || null,
        type: type || "info",
        title: storedTitle,
        message: storedMessage,
        icon: safeIcon,
        metadata: { ...(metadata || {}), locale: recipientLocale, test_mode: !!test_mode },
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return json({ error: "Failed to create notification" }, 500);
    }

    // ── OneSignal Push ────────────────────────────────────────
    if (ONESIGNAL_APP_ID && ONESIGNAL_REST_API_KEY) {
      await sendOneSignalPush(ONESIGNAL_APP_ID, ONESIGNAL_REST_API_KEY, {
        user_id,
        institution_id,
        title: safeTitle,
        message: safeMessage,
        title_fr: safeTitleFr,
        message_fr: safeMsgFr,
        type: type || "info",
        notificationId: notification.id,
        test_mode: !!test_mode,
      });
    }

    // ── Pusher realtime ───────────────────────────────────────
    if (PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET) {
      const channels = [`user-${user_id}`];
      if (institution_id) channels.push(`institution-${institution_id}`);
      await triggerPusherBatch(PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER, channels, "notification", {
        id: notification.id,
        type: type || "info",
        title: safeTitle,
        message: safeMessage,
        icon: safeIcon,
      });
    }

    return json({ success: true, notification });
  } catch (error) {
    console.error("Error:", error);
    return json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      500
    );
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ── OneSignal Push ──────────────────────────────────────────────
async function sendOneSignalPush(
  appId: string,
  restApiKey: string,
  params: {
    user_id: string;
    institution_id?: string;
    title: string;
    message: string;
    title_fr?: string;
    message_fr?: string;
    type: string;
    notificationId: string;
    test_mode?: boolean;
  }
) {
  const filters: Record<string, string>[] = [
    { field: "tag", key: "user_id", relation: "=", value: params.user_id },
  ];
  if (params.institution_id) {
    filters.push(
      { field: "tag", key: "institution_id", relation: "=", value: params.institution_id }
    );
  }
  // Audience isolation: only fan out to devices whose `env` tag matches.
  // Devices that opted into the test audience (set tag env=test in client)
  // never receive production notifications, and vice-versa.
  filters.push(
    { field: "tag", key: "env", relation: "=", value: params.test_mode ? "test" : "production" }
  );

  const headings: Record<string, string> = { en: params.title };
  const contents: Record<string, string> = { en: params.message };
  if (params.title_fr)   headings.fr = params.title_fr;
  if (params.message_fr) contents.fr = params.message_fr;

  const payload: Record<string, unknown> = {
    app_id: appId,
    filters,
    headings,
    contents,
    data: {
      notification_id: params.notificationId,
      type: params.type,
      institution_id: params.institution_id || null,
      test_mode: !!params.test_mode,
    },
    chrome_web_icon: "https://kangopenbanking.com/favicon.png",
  };

  try {
    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error("OneSignal push failed:", errBody);
    }
  } catch (err) {
    console.error("OneSignal push error:", err);
  }
}

// ── Pusher Batch ────────────────────────────────────────────────
async function triggerPusherBatch(
  appId: string, key: string, secret: string, cluster: string,
  channels: string[], eventName: string, data: Record<string, unknown>
) {
  const batchEvents = channels.map(channel => ({
    channel,
    name: eventName,
    data: JSON.stringify(data),
  }));

  const bodyStr = JSON.stringify({ batch: batchEvents });
  const timestamp = Math.floor(Date.now() / 1000);
  const path = `/apps/${appId}/batch_events`;

  const queryParams = new URLSearchParams({
    auth_key: key,
    auth_timestamp: String(timestamp),
    auth_version: "1.0",
    body_md5: await md5(bodyStr),
  });

  const stringToSign = `POST\n${path}\n${queryParams.toString()}`;
  const signature = await hmacSha256(secret, stringToSign);
  queryParams.set("auth_signature", signature);

  const pusherUrl = `https://api-${cluster}.pusher.com${path}?${queryParams.toString()}`;

  try {
    const response = await fetch(pusherUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: bodyStr,
    });
    if (!response.ok) {
      const errBody = await response.text();
      console.error("Pusher batch trigger failed:", errBody);
    }
  } catch (err) {
    console.error("Pusher trigger error:", err);
  }
}

async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
