import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const PUSHER_APP_ID = Deno.env.get("PUSHER_APP_ID");
    const PUSHER_KEY = Deno.env.get("PUSHER_KEY");
    const PUSHER_SECRET = Deno.env.get("PUSHER_SECRET");
    const PUSHER_CLUSTER = Deno.env.get("PUSHER_CLUSTER") || "eu";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Validate JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, institution_id, type, title, message, icon, metadata } = body;

    if (!user_id || !title || !message) {
      return new Response(
        JSON.stringify({ error: "user_id, title, and message are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert notification into database
    const { data: notification, error: insertError } = await supabase
      .from("app_notifications")
      .insert({
        user_id,
        institution_id: institution_id || null,
        type: type || "info",
        title,
        message,
        icon: icon || "default",
        metadata: metadata || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(
        JSON.stringify({ error: "Failed to create notification" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Trigger Pusher events if configured
    if (PUSHER_APP_ID && PUSHER_KEY && PUSHER_SECRET) {
      const channels = [`user-${user_id}`];
      if (institution_id) {
        channels.push(`institution-${institution_id}`);
      }

      await triggerPusherBatch(PUSHER_APP_ID, PUSHER_KEY, PUSHER_SECRET, PUSHER_CLUSTER, channels, "notification", {
        id: notification.id,
        type: type || "info",
        title,
        message,
        icon: icon || "default",
      });
    }

    return new Response(
      JSON.stringify({ success: true, notification }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Batch trigger Pusher events across multiple channels
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

// Utility: MD5 hash
async function md5(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("MD5", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Utility: HMAC-SHA256
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
