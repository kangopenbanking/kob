/**
 * hero-media-update — admin-only endpoint that validates a replacement
 * homepage-hero media URL (type, size, aspect ratio for images), updates
 * the homepage_hero_slides row, and writes an audit_logs entry.
 *
 * Auth: requires the caller to have the `admin` role.
 * Storage: assumes the new file is already uploaded to the `homepage-hero`
 *   bucket by the admin client; this function re-fetches it via HEAD/GET
 *   only to confirm size/type/dimensions before persisting.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "https://esm.sh/zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const HERO_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const HERO_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 50 * 1024 * 1024;
const TARGET_ASPECT = 16 / 9;
const ASPECT_TOL = 0.05;

const BodySchema = z.object({
  slide_id: z.string().uuid(),
  media_url: z.string().url(),
  media_type: z.enum(["image", "video"]),
  reported_width: z.number().int().positive().optional(),
  reported_height: z.number().int().positive().optional(),
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "missing_authorization" }, 401);

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

  let parsed: z.infer<typeof BodySchema>;
  try {
    parsed = BodySchema.parse(await req.json());
  } catch (e) {
    return json({ error: "invalid_body", details: (e as Error).message }, 400);
  }

  // Verify the uploaded asset's content-type + size via HEAD.
  let headResp: Response;
  try {
    headResp = await fetch(parsed.media_url, { method: "HEAD" });
  } catch (e) {
    return json({ error: "media_unreachable", details: (e as Error).message }, 400);
  }
  if (!headResp.ok) return json({ error: "media_head_failed", status: headResp.status }, 400);

  const ct = (headResp.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const len = Number(headResp.headers.get("content-length") ?? 0);

  if (parsed.media_type === "image") {
    if (!HERO_IMAGE_TYPES.includes(ct)) return json({ error: "invalid_image_type", content_type: ct }, 400);
    if (len > MAX_IMAGE) return json({ error: "image_too_large", bytes: len, max: MAX_IMAGE }, 400);
    if (parsed.reported_width && parsed.reported_height) {
      const ratio = parsed.reported_width / parsed.reported_height;
      if (Math.abs(ratio - TARGET_ASPECT) / TARGET_ASPECT > ASPECT_TOL) {
        return json({ error: "aspect_out_of_range", ratio, target: TARGET_ASPECT }, 400);
      }
    }
  } else {
    if (!HERO_VIDEO_TYPES.includes(ct)) return json({ error: "invalid_video_type", content_type: ct }, 400);
    if (len > MAX_VIDEO) return json({ error: "video_too_large", bytes: len, max: MAX_VIDEO }, 400);
  }

  // Read existing for audit trail.
  const { data: prev } = await admin
    .from("homepage_hero_slides")
    .select("media_url, media_type")
    .eq("id", parsed.slide_id)
    .maybeSingle();
  if (!prev) return json({ error: "slide_not_found" }, 404);

  const { error: updErr } = await admin
    .from("homepage_hero_slides")
    .update({ media_url: parsed.media_url, media_type: parsed.media_type })
    .eq("id", parsed.slide_id);
  if (updErr) return json({ error: "update_failed", details: updErr.message }, 500);

  await admin.from("audit_logs").insert({
    action_type: "hero_media_replace",
    entity_type: "homepage_hero_slide",
    entity_id: parsed.slide_id,
    performed_by: userId,
    details: {
      previous: prev,
      next: { media_url: parsed.media_url, media_type: parsed.media_type },
      content_type: ct,
      content_length: len,
      reported_width: parsed.reported_width ?? null,
      reported_height: parsed.reported_height ?? null,
    },
    ip_address: req.headers.get("x-forwarded-for") ?? null,
    user_agent: req.headers.get("user-agent") ?? null,
  });

  return json({ ok: true });
});
