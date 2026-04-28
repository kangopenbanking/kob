// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShieldCheck, GitBranch, Layers, AlertTriangle, Clock, Webhook, Gauge, FileCode2 } from "lucide-react";

interface SpecExt {
  info?: { version?: string };
  "x-api-standards"?: any;
  "x-pagination"?: any;
  "x-error-catalog"?: any;
  "x-deprecation-policy"?: any;
  "x-rate-limits"?: any;
  "x-sla"?: any;
  "x-sandbox"?: any;
  "x-webhook-policy"?: any;
  "x-webhook-events"?: string[];
}

export default function InternationalStandards() {
  const [spec, setSpec] = useState<SpecExt | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/openapi.json")
      .then((r) => r.json())
      .then(setSpec)
      .catch((e) => setError(String(e)));
  }, []);

  return (
    <div className="container mx-auto max-w-5xl py-12 px-4 space-y-8">
      <Helmet>
        <title>International API Standards — Kang Open Banking</title>
        <meta
          name="description"
          content="Kang Open Banking API standards: REST design, cursor pagination, RFC 7807 errors, deprecation policy, rate limits, SLA, sandbox guarantees, and webhook reliability."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/standards" />
      </Helmet>

      <header className="space-y-3">
        <Badge variant="outline" className="border-foreground/20">
          <ShieldCheck className="h-3.5 w-3.5 mr-1.5" /> Public commitment
        </Badge>
        <h1 className="text-4xl font-semibold tracking-tight">International API Standards</h1>
        <p className="text-muted-foreground max-w-3xl">
          A single canonical base URL, predictable REST design, cursor pagination, RFC 7807 errors,
          documented deprecation windows, transparent rate limits, deterministic sandbox, and
          production-grade webhooks. This page is generated from the live OpenAPI specification.
        </p>
        {spec?.info?.version && (
          <p className="text-xs text-muted-foreground">
            OpenAPI version <code className="px-1.5 py-0.5 rounded bg-muted">{spec.info.version}</code>
          </p>
        )}
        {error && <p className="text-sm text-destructive">Failed to load spec: {error}</p>}
      </header>

      <Tabs defaultValue="rest" className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="rest"><Layers className="h-4 w-4 mr-1.5" />REST</TabsTrigger>
          <TabsTrigger value="pagination"><GitBranch className="h-4 w-4 mr-1.5" />Pagination</TabsTrigger>
          <TabsTrigger value="errors"><AlertTriangle className="h-4 w-4 mr-1.5" />Errors</TabsTrigger>
          <TabsTrigger value="deprecation"><Clock className="h-4 w-4 mr-1.5" />Deprecation</TabsTrigger>
          <TabsTrigger value="rate-limits"><Gauge className="h-4 w-4 mr-1.5" />Rate limits</TabsTrigger>
          <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1.5" />Webhooks</TabsTrigger>
          <TabsTrigger value="sandbox"><FileCode2 className="h-4 w-4 mr-1.5" />Sandbox & SLA</TabsTrigger>
        </TabsList>

        <TabsContent value="rest">
          <Card>
            <CardHeader>
              <CardTitle>One canonical base URL — pure REST</CardTitle>
              <CardDescription>
                Every endpoint is reachable at <code>https://api.kangopenbanking.com/v1</code>.
                Internal routing (Supabase, edge function names) is never exposed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="text-sm bg-muted rounded-md p-4 overflow-x-auto">{`POST   /v1/charges
GET    /v1/charges/{id}
GET    /v1/charges?limit=25&starting_after=ch_abc

POST   /v1/payouts
POST   /v1/refunds
POST   /v1/oauth/token`}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="pagination">
          <Card>
            <CardHeader>
              <CardTitle>Cursor pagination</CardTitle>
              <CardDescription>
                Default limit {spec?.["x-pagination"]?.default_limit ?? 25}. Maximum {spec?.["x-pagination"]?.max_limit ?? 100}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parameter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell><code>limit</code></TableCell><TableCell>integer</TableCell><TableCell>1–100, default 25</TableCell></TableRow>
                  <TableRow><TableCell><code>starting_after</code></TableCell><TableCell>string</TableCell><TableCell>Resource id — returns the page after</TableCell></TableRow>
                  <TableRow><TableCell><code>ending_before</code></TableCell><TableCell>string</TableCell><TableCell>Resource id — returns the page before</TableCell></TableRow>
                </TableBody>
              </Table>
              <pre className="text-sm bg-muted rounded-md p-4 overflow-x-auto">{`{
  "object": "list",
  "data": [ { "id": "ch_123", ... } ],
  "has_more": true,
  "next_cursor": "ch_123"
}`}</pre>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="errors">
          <Card>
            <CardHeader>
              <CardTitle>Standardized error envelope</CardTitle>
              <CardDescription>
                Every 4xx / 5xx response uses the same shape. Trace with <code>error_id</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <pre className="text-sm bg-muted rounded-md p-4 overflow-x-auto">{`{
  "error": "invalid_request_error",
  "error_code": "PAY_003",
  "message": "Amount must be greater than 0",
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-04-28T10:00:00Z",
  "details": { "amount": "must be > 0" }
}`}</pre>
              <Table>
                <TableHeader><TableRow><TableHead>HTTP</TableHead><TableHead>error</TableHead></TableRow></TableHeader>
                <TableBody>
                  {Object.entries(spec?.["x-error-catalog"]?.http_status_map ?? {
                    "400":"invalid_request_error","401":"authentication_error","403":"permission_error",
                    "404":"not_found_error","409":"idempotency_error","422":"validation_error",
                    "429":"rate_limit_error","500":"api_error"
                  }).map(([code, name]) => (
                    <TableRow key={code}><TableCell>{code}</TableCell><TableCell><code>{String(name)}</code></TableCell></TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deprecation">
          <Card>
            <CardHeader>
              <CardTitle>Deprecation & versioning policy</CardTitle>
              <CardDescription>
                Minimum {spec?.["x-deprecation-policy"]?.minimum_notice_days ?? 180} days notice. Path-based major versions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>Deprecated endpoints emit <code>Deprecation</code>, <code>Sunset</code>, and <code>Link</code> response headers.</p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Never remove a documented response field without a major version bump</li>
                <li>Never tighten a request schema in place</li>
                <li>Never repurpose an enum value</li>
                <li>Major versions remain supported ≥ 12 months after successor GA</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rate-limits">
          <Card>
            <CardHeader>
              <CardTitle>Rate limits</CardTitle>
              <CardDescription>
                Headers: <code>X-RateLimit-Limit</code>, <code>X-RateLimit-Remaining</code>, <code>X-RateLimit-Reset</code>, <code>Retry-After</code>.
                429 responses follow RFC 7807 (<code>application/problem+json</code>).
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader><TableRow><TableHead>Tier</TableHead><TableHead>Limit</TableHead><TableHead>Window</TableHead><TableHead>Per</TableHead></TableRow></TableHeader>
                <TableBody>
                  {Object.entries(spec?.["x-rate-limits"]?.tiers ?? {}).map(([k, v]: any) => (
                    <TableRow key={k}>
                      <TableCell><code>{k}</code></TableCell>
                      <TableCell>{v.limit}</TableCell>
                      <TableCell>{v.window}</TableCell>
                      <TableCell>{v.per}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="webhooks">
          <Card>
            <CardHeader>
              <CardTitle>Production-grade webhooks</CardTitle>
              <CardDescription>
                At-least-once delivery, HMAC-SHA256 signatures, replay protection by <code>X-Webhook-ID</code>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Retry schedule (seconds)</div>
                  <div className="font-mono mt-1">{(spec?.["x-webhook-policy"]?.retry_schedule_seconds ?? []).join(", ")}</div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-muted-foreground text-xs">Max attempts</div>
                  <div className="font-mono mt-1">{spec?.["x-webhook-policy"]?.max_attempts ?? 7}</div>
                </div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs mb-1">Documented event types</div>
                <div className="flex flex-wrap gap-1.5">
                  {(spec?.["x-webhook-events"] ?? []).map((e) => (
                    <Badge key={e} variant="outline" className="font-mono text-xs">{e}</Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sandbox">
          <Card>
            <CardHeader>
              <CardTitle>Sandbox & SLA</CardTitle>
              <CardDescription>
                Sandbox is permanently free (Standing Order P3). Same base URL, deterministic responses.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-medium mb-2 text-sm">Magic amounts</h3>
                <Table>
                  <TableHeader><TableRow><TableHead>Amount</TableHead><TableHead>Outcome</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {Object.entries(spec?.["x-sandbox"]?.magic_amounts ?? {}).map(([k, v]) => (
                      <TableRow key={k}><TableCell><code>{k}</code></TableCell><TableCell>{String(v)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div>
                <h3 className="font-medium mb-2 text-sm">SLA targets</h3>
                <ul className="text-sm space-y-1">
                  <li>Uptime: <strong>{spec?.["x-sla"]?.uptime_target ?? "99.95%"}</strong></li>
                  <li>p95 latency: auth {spec?.["x-sla"]?.p95_latency_ms?.auth}ms · gateway {spec?.["x-sla"]?.p95_latency_ms?.gateway}ms · aisp {spec?.["x-sla"]?.p95_latency_ms?.aisp}ms</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
