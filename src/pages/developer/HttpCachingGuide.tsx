import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const HttpCachingGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="HTTP Caching | Kang Open Banking" description="Cache-Control, ETag, and conditional request headers for efficient API polling with the Kang Open Banking API." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">HTTP Caching &amp; Conditional Requests</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API returns standard HTTP caching headers on all GET endpoints. Use conditional requests
        to reduce bandwidth, respect rate limits, and comply with COBAC polling frequency requirements.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Header</th>
            <th className="text-left py-2 font-semibold">Direction</th>
            <th className="text-left py-2 font-semibold">Purpose</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">Cache-Control</td>
            <td>Response</td>
            <td>Caching directive (e.g. <code className="bg-muted px-1 rounded">max-age=300</code>)</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">ETag</td>
            <td>Response</td>
            <td>Entity tag for content versioning</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">Last-Modified</td>
            <td>Response</td>
            <td>Timestamp of last data change</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-mono text-xs">If-None-Match</td>
            <td>Request</td>
            <td>Send previous ETag to get 304 if unchanged</td>
          </tr>
          <tr>
            <td className="py-2 font-mono text-xs">If-Modified-Since</td>
            <td>Request</td>
            <td>Send previous Last-Modified to get 304 if unchanged</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Cache Policies by Resource Type</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Resource</th>
              <th className="text-left py-2 font-semibold">Cache-Control</th>
              <th className="text-left py-2 font-semibold">Rationale</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b">
              <td className="py-2">Account balances</td>
              <td className="font-mono text-xs">no-cache</td>
              <td>Always revalidate -- balance may change on every transaction</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Transaction history</td>
              <td className="font-mono text-xs">no-cache</td>
              <td>New transactions may appear at any time</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Exchange rates</td>
              <td className="font-mono text-xs">max-age=300, must-revalidate</td>
              <td>Rates update at most every 5 minutes</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Bank directory</td>
              <td className="font-mono text-xs">max-age=3600, must-revalidate</td>
              <td>Directory changes infrequently</td>
            </tr>
            <tr className="border-b">
              <td className="py-2">Supported currencies</td>
              <td className="font-mono text-xs">max-age=86400</td>
              <td>Changes only with API version updates</td>
            </tr>
            <tr>
              <td className="py-2">OpenAPI spec</td>
              <td className="font-mono text-xs">max-age=3600</td>
              <td>Changes only on API releases</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Conditional Request Example</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`# First request — get the ETag
curl -i https://api.kangopenbanking.com/v1/accounts/acc_123/balances \\
  -H "Authorization: Bearer sk_live_..."

# Response includes:
# ETag: "v1-balance-abc123"
# Cache-Control: no-cache

# Subsequent request — send ETag for conditional fetch
curl -i https://api.kangopenbanking.com/v1/accounts/acc_123/balances \\
  -H "Authorization: Bearer sk_live_..." \\
  -H "If-None-Match: \\"v1-balance-abc123\\""

# If unchanged: 304 Not Modified (no body, no bandwidth)
# If changed: 200 OK with new data and new ETag`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">AISP Polling with ETags</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`// Node.js — Efficient AISP polling
let lastETag = null;

async function pollAccountBalance(accountId) {
  const headers = { 'Authorization': 'Bearer ' + accessToken };
  if (lastETag) headers['If-None-Match'] = lastETag;
  
  const res = await fetch(
    \`https://api.kangopenbanking.com/v1/accounts/\${accountId}/balances\`,
    { headers }
  );
  
  if (res.status === 304) {
    console.log('Balance unchanged — no data transfer');
    return null; // Use cached value
  }
  
  lastETag = res.headers.get('ETag');
  return await res.json();
}`}
      </pre>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Best Practices</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Always store and send ETags on repeated GET requests to conserve rate limit quota</li>
        <li>Use <code className="bg-muted px-1 rounded">Cache-Control</code> directives to set local cache TTLs in your HTTP client</li>
        <li>For AISP data, combine conditional requests with webhooks to minimize polling frequency</li>
        <li>304 responses do not count against your rate limit quota</li>
        <li>ETags are opaque strings -- do not parse or construct them; treat them as cache keys</li>
      </ul>
    </div>

    <AutoDocNavigation />
  </div>
);

export default HttpCachingGuide;
