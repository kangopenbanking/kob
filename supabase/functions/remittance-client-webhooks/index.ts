/**
 * Remittance Client Webhooks — Manage client-facing webhook subscriptions.
 *
 * Actions:
 *   register       — Register a new webhook endpoint
 *   list           — List endpoints for a client
 *   rotate_secret  — Rotate webhook signing secret
 *   list_deliveries — View delivery logs for an endpoint
 *   deliver        — Internal: deliver remittance event to subscribed endpoints
 *   get_endpoint   — Get endpoint details
 *   deactivate     — Deactivate an endpoint
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { corsHeaders } from "../_shared/cors.ts";
import { safeErrorResponse } from "../_shared/errors.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get("action");
    let body: Record<string, unknown> = {};

    if (req.method === "POST" || req.method === "PATCH") {
      body = await req.json().catch(() => ({}));
      action = action || (body.action as string);
    }

    if (!action) {
      return json({ error: "missing_action", message: "action parameter is required" }, 400);
    }

    // Supported remittance webhook events
    const SUPPORTED_EVENTS = [
      "remittance.transfer.created",
      "remittance.payin.succeeded",
      "remittance.payin.failed",
      "remittance.payout.succeeded",
      "remittance.payout.failed",
      "remittance.transfer.completed",
      "remittance.transfer.cancelled",
      "remittance.transfer.refunded",
    ];

    switch (action) {
      // ─── Register Endpoint ───
      case "register": {
        const { client_id, url: webhookUrl, events } = body as {
          client_id: string; url: string; events: string[];
        };

        if (!client_id || !webhookUrl || !events?.length) {
          return json({
            error: "missing_fields",
            message: "client_id, url, and events[] are required",
          }, 400);
        }

        // Validate events
        const invalidEvents = events.filter((e: string) => !SUPPORTED_EVENTS.includes(e));
        if (invalidEvents.length > 0) {
          return json({
            error: "invalid_events",
            message: `Unsupported events: ${invalidEvents.join(", ")}`,
            supported_events: SUPPORTED_EVENTS,
          }, 400);
        }

        // Generate signing secret
        const secret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
        const secretLastFour = secret.slice(-4);

        // Hash secret using SHA-256
        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
        const secretHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const { data: endpoint, error } = await supabase
          .from("remittance_client_webhook_endpoints")
          .insert({
            client_id,
            url: webhookUrl,
            events,
            secret_hash: secretHash,
            secret_last_four: secretLastFour,
          })
          .select()
          .single();

        if (error) throw error;

        return json({
          endpoint_id: endpoint.id,
          url: endpoint.url,
          events: endpoint.events,
          secret: secret, // Show only once
          secret_last_four: secretLastFour,
          is_active: true,
          message: "Save this secret — it will not be shown again.",
        }, 201);
      }

      // ─── List Endpoints ───
      case "list": {
        const clientId = url.searchParams.get("client_id") || (body as Record<string, string>).client_id;
        if (!clientId) return json({ error: "missing_client_id" }, 400);

        const { data, error } = await supabase
          .from("remittance_client_webhook_endpoints")
          .select("id, client_id, url, events, secret_last_four, is_active, created_at, updated_at")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false });

        if (error) throw error;
        return json({ endpoints: data || [] });
      }

      // ─── Get Endpoint ───
      case "get_endpoint": {
        const endpointId = url.searchParams.get("endpoint_id") || (body as Record<string, string>).endpoint_id;
        if (!endpointId) return json({ error: "missing_endpoint_id" }, 400);

        const { data, error } = await supabase
          .from("remittance_client_webhook_endpoints")
          .select("id, client_id, url, events, secret_last_four, is_active, created_at, updated_at")
          .eq("id", endpointId)
          .single();

        if (error || !data) return json({ error: "not_found" }, 404);
        return json({ endpoint: data });
      }

      // ─── Rotate Secret ───
      case "rotate_secret": {
        const { endpoint_id } = body as { endpoint_id: string };
        if (!endpoint_id) return json({ error: "missing_endpoint_id" }, 400);

        const newSecret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;
        const newLastFour = newSecret.slice(-4);

        const encoder = new TextEncoder();
        const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(newSecret));
        const newHash = Array.from(new Uint8Array(hashBuffer))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        const { error } = await supabase
          .from("remittance_client_webhook_endpoints")
          .update({
            secret_hash: newHash,
            secret_last_four: newLastFour,
            updated_at: new Date().toISOString(),
          })
          .eq("id", endpoint_id);

        if (error) throw error;

        return json({
          endpoint_id,
          new_secret: newSecret,
          secret_last_four: newLastFour,
          message: "Secret rotated. Save this secret — it will not be shown again.",
        });
      }

      // ─── Deactivate Endpoint ───
      case "deactivate": {
        const { endpoint_id } = body as { endpoint_id: string };
        if (!endpoint_id) return json({ error: "missing_endpoint_id" }, 400);

        const { error } = await supabase
          .from("remittance_client_webhook_endpoints")
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq("id", endpoint_id);

        if (error) throw error;
        return json({ endpoint_id, is_active: false });
      }

      // ─── List Deliveries ───
      case "list_deliveries": {
        const endpointId = url.searchParams.get("endpoint_id") || (body as Record<string, string>).endpoint_id;
        if (!endpointId) return json({ error: "missing_endpoint_id" }, 400);

        const limit = parseInt(url.searchParams.get("limit") || "50");
        const offset = parseInt(url.searchParams.get("offset") || "0");

        const { data, error, count } = await supabase
          .from("remittance_client_webhook_deliveries")
          .select("*", { count: "exact" })
          .eq("endpoint_id", endpointId)
          .order("created_at", { ascending: false })
          .range(offset, offset + limit - 1);

        if (error) throw error;
        return json({ deliveries: data || [], total: count, limit, offset });
      }

      // ─── Deliver Event (internal) ───
      case "deliver": {
        const { remittance_id, event_type, event_data, client_id } = body as {
          remittance_id: string; event_type: string; event_data: Record<string, unknown>; client_id?: string;
        };

        if (!event_type || !event_data) {
          return json({ error: "missing_fields", message: "event_type and event_data required" }, 400);
        }

        // Find all active endpoints subscribed to this event
        let query = supabase
          .from("remittance_client_webhook_endpoints")
          .select("*")
          .eq("is_active", true)
          .contains("events", [event_type]);

        if (client_id) query = query.eq("client_id", client_id);

        const { data: endpoints, error: epErr } = await query;
        if (epErr) throw epErr;

        const deliveryResults: Array<{ endpoint_id: string; status: string }> = [];

        for (const ep of (endpoints || [])) {
          // Build payload
          const payload = {
            event: event_type,
            data: event_data,
            remittance_id,
            created_at: new Date().toISOString(),
          };

          // Compute HMAC-SHA256 signature
          const payloadStr = JSON.stringify(payload);
          const key = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(ep.secret_hash),
            { name: "HMAC", hash: "SHA-256" },
            false,
            ["sign"]
          );
          const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadStr));
          const signature = Array.from(new Uint8Array(sigBuffer))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

          // Attempt delivery
          let httpStatus: number | null = null;
          let deliveryStatus = "pending";

          try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 10000);

            const resp = await fetch(ep.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-webhook-signature": signature,
                "x-webhook-event": event_type,
              },
              body: payloadStr,
              signal: controller.signal,
            });

            clearTimeout(timeout);
            httpStatus = resp.status;
            deliveryStatus = resp.ok ? "sent" : "failed";
          } catch {
            deliveryStatus = "failed";
          }

          // Record delivery
          await supabase.from("remittance_client_webhook_deliveries").insert({
            endpoint_id: ep.id,
            remittance_id: remittance_id || null,
            event_type,
            payload,
            status: deliveryStatus,
            http_status: httpStatus,
            attempt_count: 1,
            last_attempt_at: new Date().toISOString(),
          });

          deliveryResults.push({ endpoint_id: ep.id, status: deliveryStatus });
        }

        return json({
          event_type,
          endpoints_notified: deliveryResults.length,
          results: deliveryResults,
        });
      }

      default:
        return json({ error: "unknown_action", message: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    return safeErrorResponse(err, corsHeaders, "remittance-client-webhooks");
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
