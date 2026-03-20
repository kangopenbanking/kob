import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, merchant_id, domain } = body;

    // Verify merchant ownership
    const { data: merchant, error: mErr } = await supabase
      .from("gateway_merchants")
      .select("id, user_id, custom_domain, domain_verification_status, plan_tier")
      .eq("id", merchant_id)
      .single();

    if (mErr || !merchant) {
      return new Response(
        JSON.stringify({ error: "Merchant not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin or owner
    const { data: adminRole } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    const isOwner = merchant.user_id === user.id;
    const isAdmin = !!adminRole;

    if (!isOwner && !isAdmin) {
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "verify") {
      // Validate domain format
      const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9\-_.]+\.[a-zA-Z]{2,}$/;
      if (!domain || !domainRegex.test(domain.trim())) {
        return new Response(
          JSON.stringify({ error: "Invalid domain format", status: "invalid" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const cleanDomain = domain.trim().toLowerCase();
      const cnameTarget = "checkout.kangopenbanking.com";

      // Perform actual DNS CNAME lookup via DNS-over-HTTPS (Cloudflare)
      let dnsVerified = false;
      let dnsRecords: string[] = [];

      try {
        const dnsRes = await fetch(
          `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=CNAME`,
          { headers: { Accept: "application/dns-json" } }
        );
        const dnsData = await dnsRes.json();

        if (dnsData.Answer && Array.isArray(dnsData.Answer)) {
          dnsRecords = dnsData.Answer
            .filter((a: any) => a.type === 5) // CNAME type
            .map((a: any) => (a.data || "").replace(/\.$/, "").toLowerCase());

          dnsVerified = dnsRecords.some(
            (r) => r === cnameTarget || r.endsWith("." + cnameTarget)
          );
        }
      } catch (dnsErr) {
        console.error("DNS lookup error:", dnsErr);
      }

      // Also check A record as fallback (some providers flatten CNAME)
      if (!dnsVerified) {
        try {
          const aRes = await fetch(
            `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cleanDomain)}&type=A`,
            { headers: { Accept: "application/dns-json" } }
          );
          const aData = await aRes.json();
          if (aData.Answer && Array.isArray(aData.Answer)) {
            // If there are A records, check if domain resolves (CNAME may be flattened)
            const aRecords = aData.Answer.filter((a: any) => a.type === 1);
            if (aRecords.length > 0) {
              // Also resolve the CNAME target to compare IPs
              const targetRes = await fetch(
                `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(cnameTarget)}&type=A`,
                { headers: { Accept: "application/dns-json" } }
              );
              const targetData = await targetRes.json();
              if (targetData.Answer) {
                const targetIPs = new Set(
                  targetData.Answer.filter((a: any) => a.type === 1).map((a: any) => a.data)
                );
                const domainIPs = aRecords.map((a: any) => a.data);
                dnsVerified = domainIPs.some((ip: string) => targetIPs.has(ip));
              }
            }
          }
        } catch {
          // Ignore A record check failures
        }
      }

      const newStatus = dnsVerified ? "verified" : "pending";
      const updateData: any = {
        custom_domain: cleanDomain,
        domain_verification_status: newStatus,
        domain_cname_target: cnameTarget,
        updated_at: new Date().toISOString(),
      };

      if (dnsVerified) {
        updateData.domain_verified_at = new Date().toISOString();
        updateData.domain_ssl_status = "provisioning";
      }

      await supabase
        .from("gateway_merchants")
        .update(updateData)
        .eq("id", merchant_id);

      // Audit log
      await supabase.from("audit_logs").insert({
        action_type: dnsVerified ? "domain_verified" : "domain_verification_attempted",
        entity_type: "gateway_merchants",
        entity_id: merchant_id,
        performed_by: user.id,
        details: {
          domain: cleanDomain,
          dns_records: dnsRecords,
          verified: dnsVerified,
          cname_target: cnameTarget,
        },
      });

      return new Response(
        JSON.stringify({
          status: newStatus,
          domain: cleanDomain,
          verified: dnsVerified,
          dns_records: dnsRecords,
          cname_target: cnameTarget,
          message: dnsVerified
            ? "Domain verified successfully. SSL certificate is being provisioned."
            : "CNAME record not found. Please add a CNAME record pointing to " + cnameTarget + " and try again.",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "remove") {
      await supabase
        .from("gateway_merchants")
        .update({
          custom_domain: null,
          domain_verification_status: "none",
          domain_verified_at: null,
          domain_ssl_status: "none",
          updated_at: new Date().toISOString(),
        })
        .eq("id", merchant_id);

      await supabase.from("audit_logs").insert({
        action_type: "domain_removed",
        entity_type: "gateway_merchants",
        entity_id: merchant_id,
        performed_by: user.id,
        details: { previous_domain: merchant.custom_domain },
      });

      return new Response(
        JSON.stringify({ status: "removed", message: "Custom domain removed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      return new Response(
        JSON.stringify({
          domain: merchant.custom_domain,
          verification_status: merchant.domain_verification_status,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Unknown action. Use: verify, remove, status" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("verify-custom-domain error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
