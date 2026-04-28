import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const requestFormat = `curl -X POST https://api.kangopenbanking.com/v1/{endpoint} \\
  -H "Authorization: Bearer {your_secret_key}" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: {unique_uuid}" \\
  -H "x-fapi-interaction-id: {correlation_uuid}" \\
  -d '{...request_body...}'`;

const standardResponse = `{
  "data": {
    "id": "ch_abc123def456",
    "status": "successful",
    "amount": "5000",
    "currency": "XAF"
  },
  "meta": {
    "request_id": "req_550e8400e29b",
    "timestamp": "2026-03-27T14:32:00Z",
    "api_version": "4.6.0"
  }
}`;

const paginatedResponse = `{
  "data": [
    { "id": "ch_001", "amount": "5000", "status": "successful" },
    { "id": "ch_002", "amount": "3000", "status": "pending" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "has_next": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9"
  },
  "meta": {
    "request_id": "req_a1b2c3d4",
    "timestamp": "2026-03-27T14:32:00Z"
  }
}`;

const errorResponse = `{
  "type": "https://api.kangopenbanking.com/v1/errors/insufficient-funds",
  "title": "Insufficient Funds",
  "status": 422,
  "detail": "The account balance of 2,000 XAF is insufficient for the 5,000 XAF charge.",
  "instance": "https://api.kangopenbanking.com/v1/errors/log/err_a1b2c3d4",
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-03-27T14:32:00Z"
}`;

export default function ApiReferenceOverview() {
  return (
    <>
      <Helmet>
        <title>API Reference | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Kang Open Banking API reference. Base URLs, request format, response envelopes, HTTP status codes, error format (RFC 7807), rate limits, and pagination." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/api-reference" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">API Reference</h1>
          <p className="text-lg text-muted-foreground">
            Everything you need to know about making requests to the Kang Open Banking API: base URLs, authentication, envelopes, error handling, and pagination.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="base-urls">Base URLs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Environment</th>
                  <th className="text-left p-3 font-medium text-foreground">Base URL</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border">
                  <td className="p-3 font-medium text-foreground">Production</td>
                  <td className="p-3 font-mono text-sm text-muted-foreground">https://api.kangopenbanking.com/v1</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="p-3 font-medium text-foreground">Sandbox</td>
                  <td className="p-3 font-mono text-sm text-muted-foreground">https://api.kangopenbanking.com/v1</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="request-format">Request Format</h2>
          <CodeBlock examples={[{ code: requestFormat, language: "bash" }]} title="Standard Request" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="responses">Response Envelopes</h2>
          <h3 className="text-lg font-semibold text-foreground mb-3">Single Resource (StandardResponse)</h3>
          <CodeBlock examples={[{ code: standardResponse, language: "json" }]} title="StandardResponse Envelope" />
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">List (PaginatedResponse)</h3>
          <CodeBlock examples={[{ code: paginatedResponse, language: "json" }]} title="PaginatedResponse Envelope" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="status-codes">HTTP Status Codes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Code</th>
                  <th className="text-left p-3 font-medium text-foreground">Meaning</th>
                  <th className="text-left p-3 font-medium text-foreground">When It Occurs</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["200", "OK", "Successful GET/PATCH/PUT"],
                  ["201", "Created", "Successful POST"],
                  ["204", "No Content", "Successful DELETE"],
                  ["400", "Bad Request", "Missing/invalid parameters"],
                  ["401", "Unauthorized", "Missing/invalid API key"],
                  ["403", "Forbidden", "API key lacks required scope"],
                  ["404", "Not Found", "Resource doesn't exist"],
                  ["409", "Conflict", "Idempotency key reused differently"],
                  ["422", "Unprocessable", "Valid format but business rule violation"],
                  ["429", "Too Many Requests", "Rate limit exceeded"],
                  ["500", "Server Error", "Our problem — retry with backoff"],
                ].map(([code, meaning, when]) => (
                  <tr key={code} className="border-t border-border">
                    <td className="p-3 font-mono font-medium text-foreground">{code}</td>
                    <td className="p-3 text-foreground">{meaning}</td>
                    <td className="p-3 text-muted-foreground">{when}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="errors">Error Format (RFC 7807)</h2>
          <CodeBlock examples={[{ code: errorResponse, language: "json" }]} title="application/problem+json" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="rate-limits">Rate Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Tier</th>
                  <th className="text-left p-3 font-medium text-foreground">Requests/Minute</th>
                  <th className="text-left p-3 font-medium text-foreground">Requests/Day</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sandbox", "60", "1,000"],
                  ["Production (Starter)", "300", "10,000"],
                  ["Production (Growth)", "1,000", "100,000"],
                  ["Production (Scale)", "5,000", "Unlimited"],
                ].map(([tier, perMin, perDay]) => (
                  <tr key={tier} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{tier}</td>
                    <td className="p-3 text-muted-foreground">{perMin}</td>
                    <td className="p-3 text-muted-foreground">{perDay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mt-3">
            Rate limit headers returned on every response: <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">X-RateLimit-Limit</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">X-RateLimit-Remaining</code>, <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">X-RateLimit-Reset</code>
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="pagination">Pagination</h2>
          <CodeBlock examples={[{ code: `# Page-based
GET /v1/gateway/charges?page=2&limit=20

# Cursor-based (recommended for large datasets)
GET /v1/gateway/charges?cursor=eyJpZCI6IjEyMyJ9&limit=20`, language: "bash" }]} title="Pagination" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="idempotency">Idempotency</h2>
          <CodeBlock examples={[{ code: `# Safe to retry — server deduplicates by Idempotency-Key
curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Idempotency-Key: order_12345_attempt_1" \\
  ...same body...

# Returns the SAME response as the original request
# Keys expire after 24 hours`, language: "bash" }]} title="Idempotency" />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
