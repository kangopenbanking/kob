import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const RateLimitsGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Rate Limits | Kang Open Banking" description="API rate limiting policies, per-endpoint limits, Retry-After header handling, and best practices." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Rate Limits</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API enforces rate limits to ensure fair usage and platform stability. 
        Limits are applied per API key and vary by endpoint category and your plan tier.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Endpoint Category</th>
            <th className="text-left py-2 font-semibold">Sandbox</th>
            <th className="text-left py-2 font-semibold">Production</th>
            <th className="text-left py-2 font-semibold">Window</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b"><td className="py-2">Charges (POST)</td><td>100</td><td>1,000</td><td>1 minute</td></tr>
          <tr className="border-b"><td className="py-2">Payouts (POST)</td><td>50</td><td>500</td><td>1 minute</td></tr>
          <tr className="border-b"><td className="py-2">Wallets (CRUD)</td><td>200</td><td>2,000</td><td>1 minute</td></tr>
          <tr className="border-b"><td className="py-2">Read endpoints (GET)</td><td>500</td><td>5,000</td><td>1 minute</td></tr>
          <tr className="border-b"><td className="py-2">Webhooks v2 management</td><td>30</td><td>100</td><td>1 minute</td></tr>
          <tr className="border-b"><td className="py-2">Compliance screening</td><td>50</td><td>500</td><td>1 minute</td></tr>
          <tr><td className="py-2">OIDC / Token</td><td>60</td><td>120</td><td>1 minute</td></tr>
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Rate Limit Headers</h3>
      <p className="text-sm text-muted-foreground mb-2">Every API response includes rate limit information in the headers:</p>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1709290800
Retry-After: 12   # Only present on 429 responses`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Handling 429 Responses</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`async function apiCallWithRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const response = await fn();
    if (response.status !== 429) return response;
    
    const retryAfter = parseInt(
      response.headers.get('Retry-After') || '1'
    );
    await new Promise(r => setTimeout(r, retryAfter * 1000));
  }
  throw new Error('Rate limit exceeded after retries');
}`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Implement exponential backoff with jitter for retries</li>
        <li>Cache read responses where possible to reduce API calls</li>
        <li>Use webhooks instead of polling for status updates</li>
        <li>Batch operations when supported (e.g. bulk payouts)</li>
        <li>Contact support for higher rate limits on enterprise plans</li>
      </ul>
    </div>

    <DocNavigation
      previousPage={{ title: "Error Codes", path: "/developer/api/error-codes" }}
      nextPage={{ title: "Idempotency", path: "/developer/api/idempotency" }}
    />
  </div>
);

export default RateLimitsGuide;
