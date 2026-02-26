import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Idempotency() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">Idempotency Guide</h1>
        <p className="text-xl text-muted-foreground">Prevent duplicate operations with the mandatory Idempotency-Key header.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>How It Works</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>The <code className="text-xs bg-muted px-1 rounded">Idempotency-Key</code> header is <strong>mandatory</strong> on all POST and PUT requests. When the API receives a request with an idempotency key it has seen before (within 24 hours), it returns the cached response without re-executing the operation.</p>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs">{`POST /v1/gateway/charges
Idempotency-Key: charge_abc123_attempt1
Content-Type: application/json

{ "amount": 50000, "currency": "XAF", ... }

# First request: processes charge, caches response
# Second request (same key): returns cached response
# Response header: X-Idempotent-Replayed: true`}</pre></div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Key Requirements</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-2">
              <li>Keys must be unique per operation (use UUIDs or deterministic hashes)</li>
              <li>Keys expire after <strong>24 hours</strong> (automated TTL cleanup)</li>
              <li>Keys are scoped to the authenticated client</li>
              <li>Omitting the header on POST/PUT returns <code className="text-xs bg-muted px-1 rounded">400 Bad Request</code></li>
              <li>Maximum key length: 255 characters</li>
            </ul>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Best Practices</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">✅ Do</h4><ul className="list-disc list-inside space-y-1"><li>Use UUIDv4 for each unique operation</li><li>Store the key with the request for retry</li><li>Retry with the same key on network errors</li></ul></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">❌ Don't</h4><ul className="list-disc list-inside space-y-1"><li>Generate a new key for each retry attempt</li><li>Reuse keys across different operations</li><li>Use sequential or predictable keys</li></ul></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
