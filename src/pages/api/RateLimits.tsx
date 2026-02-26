import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function RateLimits() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">Rate Limits</h1>
        <p className="text-xl text-muted-foreground">Request rate limits by client tier with Retry-After guidance.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>Rate Limit Tiers</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Tier</th><th className="text-left p-3 font-semibold">Requests/Min</th><th className="text-left p-3 font-semibold">Requests/Hour</th><th className="text-left p-3 font-semibold">Monthly Limit</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">Sandbox</td><td className="p-3">60</td><td className="p-3">1,000</td><td className="p-3">10,000</td></tr>
                  <tr className="border-b"><td className="p-3">Standard</td><td className="p-3">300</td><td className="p-3">10,000</td><td className="p-3">100,000</td></tr>
                  <tr className="border-b"><td className="p-3">Professional</td><td className="p-3">1,000</td><td className="p-3">50,000</td><td className="p-3">1,000,000</td></tr>
                  <tr><td className="p-3">Enterprise</td><td className="p-3">Custom</td><td className="p-3">Custom</td><td className="p-3">Unlimited</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Rate Limit Headers</CardTitle></CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs text-muted-foreground">{`# Every response includes:
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 287
X-RateLimit-Reset: 1740000060

# When rate limited (429):
Retry-After: 30
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 0`}</pre></div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Retry Strategy</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>When receiving a <code className="text-xs bg-muted px-1 rounded">429 Too Many Requests</code> response:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Read the <code className="text-xs bg-muted px-1 rounded">Retry-After</code> header for wait time in seconds</li>
              <li>Implement exponential backoff: 1s → 2s → 4s → 8s (max 60s)</li>
              <li>Add jitter to prevent thundering herd</li>
              <li>Use the same <code className="text-xs bg-muted px-1 rounded">Idempotency-Key</code> when retrying write operations</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
