import { Helmet } from "react-helmet-async";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function GoLiveChecklist() {
  return (
    <>
      <Helmet>
        <title>Go-Live Checklist | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Pre-production checklist for launching with the Kang Open Banking API. Security, integration, compliance, and go-live action items." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/go-live" />
        <meta property="og:type" content="article" />
        <meta property="og:url" content="https://kangopenbanking.com/developer/guides/go-live" />
        <meta property="og:title" content="Go-Live Checklist | Kang Open Banking" />
        <meta property="og:description" content="Pre-production launch checklist — security, integration, compliance, and operational readiness." />
        <meta property="og:image" content="https://kangopenbanking.com/images/og-social.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://kangopenbanking.com/images/og-social.png" />
        <meta name="twitter:title" content="Go-Live Checklist | Kang Open Banking" />
        <meta name="twitter:description" content="Pre-production launch checklist for the Kang Open Banking API." />
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
          { title: "Observability Setup", id: "observability", items: [
            "Structured logging: log every API response with request_id, status, and latency",
            "Webhook monitoring: track delivery success rate and average processing time",
            "Error rate alerting: alert when 4xx or 5xx rate exceeds 5% over a 5-minute window",
            "Latency tracking: monitor p50, p95, and p99 API response times",
            "Dead-letter queue monitoring: alert when failed webhook deliveries accumulate",
            "Settlement reconciliation: automated daily check that charges minus payouts equals expected balance",
            "Health endpoint polling: check /v1/health every 60 seconds with alerting on consecutive failures",
          ]},
          { title: "Go-Live Action", id: "go-live", items: [
            "Switch environment from sandbox to production in your API client configuration",
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

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="logging-example">Structured API Logging</h2>
          <p className="text-muted-foreground mb-4 text-sm">Log every API interaction with structured metadata for debugging and monitoring:</p>
          <CodeBlock
            title="Structured API Response Logging"
            examples={[
              {
                language: "javascript",
                label: "Node.js",
                code: `async function loggedApiCall(method, url, body, idempotencyKey) {
  const start = Date.now();
  const response = await fetch(url, {
    method,
    headers: {
      'Authorization': \`Bearer \${process.env.KOB_SECRET_KEY}\`,
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const latencyMs = Date.now() - start;
  const data = await response.json();

  // Structured log entry
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    method,
    url,
    status: response.status,
    latency_ms: latencyMs,
    request_id: data.error_id || data.id,
    idempotency_key: idempotencyKey,
    replayed: response.headers.get('X-Idempotent-Replayed') === 'true',
    rate_limit_remaining: response.headers.get('X-RateLimit-Remaining'),
    success: response.status < 400,
  }));

  return { response, data };
}`
              },
              {
                language: "python",
                label: "Python",
                code: `import logging, time, json, requests

logger = logging.getLogger("kob_api")

def logged_api_call(method, url, body=None, idempotency_key=None):
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    if idempotency_key:
        headers["Idempotency-Key"] = idempotency_key

    start = time.monotonic()
    resp = requests.request(method, url, json=body, headers=headers)
    latency_ms = (time.monotonic() - start) * 1000

    logger.info(json.dumps({
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": method, "url": url,
        "status": resp.status_code,
        "latency_ms": round(latency_ms, 1),
        "request_id": resp.json().get("error_id") or resp.json().get("id"),
        "success": resp.status_code < 400,
    }))
    return resp`
              },
            ]}
          />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="verify-code">Production Verification Code</h2>
          <p className="text-muted-foreground mb-4 text-sm">Run this quick verification after switching to production keys:</p>
          <CodeBlock
            title="Verify Production Connection"
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_live_YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: go-live-verify-001" \\
  -d '{"merchant_id":"YOUR_MERCHANT_ID","amount":100,"currency":"XAF","channel":"mobile_money","customer_phone":"+237677000001","tx_ref":"go_live_test_001"}'`
              },
              {
                language: "javascript",
                label: "Node.js",
                code: `const kob = new KangOpenBanking({ apiKey: 'sk_live_YOUR_KEY' });
const charge = await kob.charges.create({
  merchant_id: 'YOUR_MERCHANT_ID',
  amount: 100, currency: 'XAF', channel: 'mobile_money',
  customer_phone: '+237677000001', tx_ref: 'go_live_test_001',
});
console.log('Production charge:', charge.data.status);`
              },
              {
                language: "python",
                label: "Python",
                code: `kob = KangOpenBanking(api_key="sk_live_YOUR_KEY")
charge = kob.charges.create(
    merchant_id="YOUR_MERCHANT_ID",
    amount=100, currency="XAF", channel="mobile_money",
    customer_phone="+237677000001", tx_ref="go_live_test_001",
)
print("Production charge:", charge["data"]["status"])`
              },
              {
                language: "php",
                label: "PHP",
                code: `$kob = new KangClient('sk_live_YOUR_KEY');
$charge = $kob->charges->create([
    'merchant_id' => 'YOUR_MERCHANT_ID',
    'amount' => 100, 'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '+237677000001',
    'tx_ref' => 'go_live_test_001',
]);
echo $charge['data']['status'];`
              },
              {
                language: "go",
                label: "Go",
                code: `body, _ := json.Marshal(map[string]interface{}{
    "merchant_id": "YOUR_MERCHANT_ID", "amount": 100,
    "currency": "XAF", "channel": "mobile_money",
    "customer_phone": "+237677000001", "tx_ref": "go_live_test_001",
})
req, _ := http.NewRequest("POST",
    "https://api.kangopenbanking.com/v1/gateway-charges-router",
    bytes.NewBuffer(body))
req.Header.Set("Authorization", "Bearer sk_live_YOUR_KEY")
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)
fmt.Println("Status:", resp.Status)`
              },
              {
                language: "java",
                label: "Java",
                code: `String body = """
    {"merchant_id":"YOUR_MERCHANT_ID","amount":100,
     "currency":"XAF","channel":"mobile_money",
     "customer_phone":"+237677000001","tx_ref":"go_live_test_001"}""";
HttpRequest req = HttpRequest.newBuilder()
    .uri(URI.create("https://api.kangopenbanking.com/v1/gateway-charges-router"))
    .header("Authorization", "Bearer sk_live_YOUR_KEY")
    .header("Content-Type", "application/json")
    .POST(HttpRequest.BodyPublishers.ofString(body)).build();
var resp = HttpClient.newHttpClient()
    .send(req, HttpResponse.BodyHandlers.ofString());
System.out.println(resp.body());`
              }
            ]}
          />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
