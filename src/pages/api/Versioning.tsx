import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function Versioning() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">API Versioning</h1>
        <p className="text-xl text-muted-foreground">Versioning strategy, deprecation policy, and backward compatibility guarantees.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>Versioning Strategy</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>All Kang Open Banking API endpoints use the <code className="text-xs bg-muted px-1 rounded">/v1/</code> path prefix. The version is embedded in the URL path, not in headers.</p>
            <div className="bg-muted rounded-lg p-4"><pre className="text-xs">https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router
https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts
https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token</pre></div>
            <p>We follow semantic versioning (SemVer) for documentation releases but maintain a single API version (<code className="text-xs bg-muted px-1 rounded">v1</code>) for endpoint paths.</p>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Backward Compatibility</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>We guarantee backward compatibility within the v1 API. The following changes are considered <strong>non-breaking</strong>:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Adding new optional request parameters</li>
              <li>Adding new response fields</li>
              <li>Adding new endpoints</li>
              <li>Adding new webhook event types</li>
              <li>Adding new enum values (where documented as extensible)</li>
            </ul>
            <p className="mt-4">The following changes are considered <strong>breaking</strong> and would require a new API version:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Removing or renaming existing fields</li>
              <li>Changing field types or formats</li>
              <li>Changing authentication requirements</li>
              <li>Removing endpoints</li>
              <li>Changing error code semantics</li>
            </ul>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Deprecation Policy</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Deprecated endpoints and features follow this lifecycle:</p>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4"><Badge variant="secondary" className="mb-2">Phase 1</Badge><h4 className="font-semibold text-foreground">Announcement</h4><p>6 months notice via changelog, API response headers, and developer portal.</p></div>
              <div className="border rounded-lg p-4"><Badge variant="secondary" className="mb-2">Phase 2</Badge><h4 className="font-semibold text-foreground">Sunset Warning</h4><p>Deprecated endpoints return <code className="text-xs bg-muted px-1 rounded">Sunset</code> and <code className="text-xs bg-muted px-1 rounded">Deprecation</code> headers.</p></div>
              <div className="border rounded-lg p-4"><Badge variant="secondary" className="mb-2">Phase 3</Badge><h4 className="font-semibold text-foreground">Removal</h4><p>Endpoint removed after sunset date. Returns 410 Gone.</p></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
