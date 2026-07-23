/**
 * admin-storage-upload — service-role storage writer for admin-gated
 * buckets. Fixes the "new row violates row-level security policy" error
 * that occurred on hero-banner and other admin-only uploads whenever the
 * client-side `has_role(auth.uid(),'admin')` evaluation lagged the JWT.
 *
 * Auth: caller must own the `admin` role in public.user_roles.
 * Buckets allowed: strictly limited to the admin-gated set below.
 * Body: JSON { bucket, path, content_type, data_base64 }
 * Returns: { ok: true, path, public_url }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Admin-gated buckets writable through this service-role writer.
// `institution-assets` is included because admins configure Consumer-app
// hero backgrounds for institutions they do not personally own, so the
// `auth.uid()`-prefixed storage RLS can reject their upload even though
// they hold the `admin` role.
const ALLOWED_BUCKETS = new Set([
  "homepage-hero",
  "auth-branding",
  "nav-icons",
  "institution-assets",
]);

const HERO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const HERO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const BUCKETS_ALLOWING_VIDEO = new Set(["homepage-hero", "institution-assets"]);

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/^data:[^;]+;base64,/, "");
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ error: "missing_authorization" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes?.user) return json({ error: "invalid_session" }, 401);
  const userId = userRes.user.id;

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
  const { data: roleRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!roleRow) return json({ error: "forbidden" }, 403);

  let body: {
    bucket?: string;
    path?: string;
    content_type?: string;
    data_base64?: string;
    upsert?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const bucket = String(body.bucket ?? "");
  const path = String(body.path ?? "");
  const contentType = String(body.content_type ?? "application/octet-stream")
    .split(";")[0]
    .trim()
    .toLowerCase();
  const dataB64 = String(body.data_base64 ?? "");
  const upsert = body.upsert !== false;

  if (!ALLOWED_BUCKETS.has(bucket)) {
    return json({ error: "bucket_not_allowed", bucket }, 400);
  }
  if (!path || path.includes("..") || path.startsWith("/")) {
    return json({ error: "invalid_path" }, 400);
  }
  if (!dataB64) return json({ error: "missing_data" }, 400);

  let bytes: Uint8Array;
  try {
    bytes = base64ToBytes(dataB64);
  } catch {
    return json({ error: "invalid_base64" }, 400);
  }

  // Type/size limits (applied only to homepage-hero; other admin buckets
  // are small icons or branding assets — apply a generous 10 MB cap).
  if (bucket === "homepage-hero") {
    const isImage = HERO_IMAGE_TYPES.includes(contentType);
    const isVideo = HERO_VIDEO_TYPES.includes(contentType);
    if (!isImage && !isVideo) {
      return json({ error: "unsupported_content_type", content_type: contentType }, 400);
    }
    if (isImage && bytes.byteLength > MAX_IMAGE) {
      return json({ error: "image_too_large", bytes: bytes.byteLength, max: MAX_IMAGE }, 400);
    }
    if (isVideo && bytes.byteLength > MAX_VIDEO) {
      return json({ error: "video_too_large", bytes: bytes.byteLength, max: MAX_VIDEO }, 400);
    }
  } else {
    if (bytes.byteLength > MAX_IMAGE) {
      return json({ error: "file_too_large", bytes: bytes.byteLength, max: MAX_IMAGE }, 400);
    }
  }

  const { error: upErr } = await admin.storage
    .from(bucket)
    .upload(path, bytes, { contentType, upsert });
  if (upErr) return json({ error: "upload_failed", details: upErr.message }, 500);

  const { data: pub } = admin.storage.from(bucket).getPublicUrl(path);
  return json({ ok: true, path, public_url: pub.publicUrl });
});
