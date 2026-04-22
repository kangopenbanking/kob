// Admin-only: server-side render of the three support email templates with
// real test data and the canonical kangopenbanking.com links. Returns HTML
// strings the admin UI can drop into an iframe for an exact-fidelity preview.
/// <reference types="npm:@types/react@18.3.1" />
import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/render@0.0.17";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

import { TEMPLATES } from "../_shared/transactional-email-templates/registry.ts";
import { SUPPORT_PORTAL_URL, APP_BASE_URL } from "../_shared/sendSupportEmail.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPPORT_TEMPLATE_NAMES = [
  "support-agent-invite",
  "support-new-chat-agent",
  "support-sla-supervisor",
] as const;

type Name = typeof SUPPORT_TEMPLATE_NAMES[number];

const SAMPLE_DATA: Record<Name, Record<string, unknown>> = {
  "support-agent-invite": {
    agentName: "Marie K.",
    departmentName: "Technical Support",
    portalUrl: SUPPORT_PORTAL_URL,
    inviteSent: true,
  },
  "support-new-chat-agent": {
    agentName: "Marie K.",
    departmentName: "Technical Support",
    subject: "Card declined on payment",
    customerName: "John Doe",
    channel: "website",
    portalUrl: `${APP_BASE_URL}/admin/support-chat?conversation=demo`,
  },
  "support-sla-supervisor": {
    subject: "SLA at risk · Technical Support",
    summaryLines: [
      "A live support chat has reached 80% of its 15-minute response target.",
      "Subject: Card declined on payment.",
      "No agent has responded yet.",
    ],
    deepLink: `${APP_BASE_URL}/admin/support-chat?conversation=demo`,
    severity: "warning",
  },
};

function resolveSubject(entry: { subject: any }, data: Record<string, any>): string {
  return typeof entry.subject === "function" ? entry.subject(data) : String(entry.subject || "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden — admin role required" }, 403);

    const url = new URL(req.url);
    const requested = (url.searchParams.get("template") || "").trim();

    const previews: Array<{
      name: string;
      displayName: string;
      subject: string;
      html: string;
    }> = [];

    const targets = requested
      ? SUPPORT_TEMPLATE_NAMES.filter((n) => n === requested)
      : SUPPORT_TEMPLATE_NAMES;

    for (const name of targets) {
      const entry = (TEMPLATES as Record<string, any>)[name];
      if (!entry) continue;
      const data = SAMPLE_DATA[name];
      const html = await renderAsync(React.createElement(entry.component, data));
      previews.push({
        name,
        displayName: entry.displayName || name,
        subject: resolveSubject(entry, data),
        html,
      });
    }

    return json({ previews, portalUrl: SUPPORT_PORTAL_URL, appBaseUrl: APP_BASE_URL });
  } catch (e: any) {
    console.error("support-email-preview error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
