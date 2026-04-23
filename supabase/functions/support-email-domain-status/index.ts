// Returns DKIM / SPF / DMARC / MX deliverability snapshot for the
// support sender domain. Uses Cloudflare DNS-over-HTTPS so no extra
// secrets are needed. Admin-only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SENDER_DOMAIN = "notify.info.kangfintechsolutions.com";

async function dohQuery(name: string, type: string) {
  const url = `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=${type}`;
  const r = await fetch(url, { headers: { Accept: "application/dns-json" } });
  if (!r.ok) return { ok: false, records: [] as string[] };
  const j = await r.json();
  const records: string[] = (j.Answer || j.Authority || [])
    .map((a: any) => String(a.data || ""))
    .map((s: string) => s.replace(/^"|"$/g, "").replace(/" "/g, ""));
  return { ok: j.Status === 0 && (j.Answer?.length ?? 0) > 0, records };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    const [mx, spf, dmarc, dkim, ns] = await Promise.all([
      dohQuery(SENDER_DOMAIN, "MX"),
      dohQuery(SENDER_DOMAIN, "TXT"),
      dohQuery(`_dmarc.${SENDER_DOMAIN}`, "TXT"),
      dohQuery(`lovable._domainkey.${SENDER_DOMAIN}`, "TXT"),
      dohQuery(SENDER_DOMAIN, "NS"),
    ]);

    const spfRecord = spf.records.find((r) => r.toLowerCase().startsWith("v=spf1"));
    const dmarcRecord = dmarc.records.find((r) => r.toLowerCase().startsWith("v=dmarc1"));
    const dkimRecord = dkim.records.find((r) => r.toLowerCase().includes("v=dkim1") || r.toLowerCase().includes("p="));

    return json({
      domain: SENDER_DOMAIN,
      checked_at: new Date().toISOString(),
      ns: { ok: ns.ok, records: ns.records },
      mx: { ok: mx.ok, records: mx.records },
      spf: { ok: !!spfRecord, value: spfRecord || null },
      dmarc: { ok: !!dmarcRecord, value: dmarcRecord || null },
      dkim: { ok: !!dkimRecord, value: dkimRecord || null, selector: "lovable" },
      overall_ok: !!(mx.ok && spfRecord && dmarcRecord && dkimRecord),
    });
  } catch (e: any) {
    console.error("support-email-domain-status error:", e);
    return json({ error: e?.message || "Internal error" }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
