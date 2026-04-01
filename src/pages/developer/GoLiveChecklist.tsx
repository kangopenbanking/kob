import { Helmet } from "react-helmet-async";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function GoLiveChecklist() {
  return (
    <>
      <Helmet>
        <title>Go-Live Checklist | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Pre-production checklist for launching with the Kang Open Banking API. Security, integration, compliance, and go-live action items." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/go-live" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Go-Live Checklist</h1>
          <p className="text-lg text-muted-foreground">
            Complete this checklist before switching from sandbox to production. Every item is specific to the Kang Open Banking API.
          </p>
        </div>

        {[
          { title: "Security", id: "security", items: [
            "Secret key stored in environment variable, NOT hardcoded",
            "Webhook signature verification implemented and tested (HMAC-SHA256)",
            "Idempotency-Key sent on all POST requests",
            "Error handling for all 4xx and 5xx responses",
            "TLS 1.2+ enforced on all outbound connections",
            "API keys scoped with minimum required permissions (restricted keys)",
            "Production keys IP-allowlisted to your server IPs",
            "Refresh token reuse detection handled (re-authenticate on 401)",
          ]},
          { title: "Integration", id: "integration", items: [
            "Tested all payment channels in sandbox (MoMo, Orange, card, bank transfer)",
            "Webhook handler returns 200 within 5 seconds",
            "Pagination implemented on all list endpoint calls",
            "Rate limit handling implemented (respect X-RateLimit-Remaining header)",
            "Retry logic with exponential backoff on 5xx errors",
            "Timeout handling for mobile money (30s max wait, then poll)",
            "Currency always set to XAF (or correct target currency)",
            "Amount validation: minimum 100 XAF, maximum per-channel limits",
          ]},
          { title: "Compliance (for financial apps)", id: "compliance", items: [
            "KYC collected before processing payments above 500,000 XAF",
            "SAR process in place for suspicious transactions",
            "Data residency requirements reviewed (COBAC — data must remain in CEMAC)",
            "AML screening integrated for new customer onboarding",
            "Transaction monitoring active for threshold-based reporting",
            "Privacy policy updated to cover financial data handling",
          ]},
          { title: "Monitoring", id: "monitoring", items: [
            "API health monitoring configured (poll /v1/health or subscribe to status page)",
            "Alert on webhook delivery failures",
            "Log all API responses with request_id for support debugging",
            "Dashboard access configured for operations team",
          ]},
          { title: "Go-Live Action", id: "go-live", items: [
            "Switch base URL from sandbox.kangopenbanking.com to api.kangopenbanking.com",
            "Switch API key from sk_test_... to sk_live_...",
            "Update webhook URLs to production endpoints",
            "Verify first production transaction with a small amount (100 XAF)",
            "Confirm webhook delivery on production endpoint",
          ]},
        ].map((section) => (
          <section key={section.id}>
            <h2 className="text-2xl font-semibold text-foreground mb-4" id={section.id}>{section.title}</h2>
            <div className="border border-border rounded-lg p-4">
              <ul className="space-y-3">
                {section.items.map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <span className="mt-0.5 w-4 h-4 border border-border rounded flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ))}

        <DocNavigation
          previousPage={{ title: "ISO 20022", path: "/developer/iso20022" }}
          nextPage={{ title: "Migration Guide", path: "/developer/guides/migrate" }}
        />
      </div>
    </>
  );
}
