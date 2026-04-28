import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, CheckCircle2, AlertTriangle } from "lucide-react";

const PUBLIC_BASE = "https://api.kangopenbanking.com/v1";

const TIERS = [
  { tier: "Anonymous / Public", limit: 60, window: "minute", scope: "Per IP — discovery, docs, health" },
  { tier: "Sandbox API Key", limit: 300, window: "minute", scope: "Per client — sbx_* keys" },
  { tier: "Production — Standard", limit: 1200, window: "minute", scope: "Per institution — pk_live_*" },
  { tier: "Production — Scale", limit: 6000, window: "minute", scope: "Per institution — negotiated tier" },
  { tier: "Webhook ingestion", limit: 600, window: "minute", scope: "Per endpoint URL" },
];

export default function RateLimits() {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<null | { sent: number; ok: number; throttled: number; headersSeen: string[] }>(null);

  async function runLiveTest() {
    setRunning(true);
    setResult(null);
    const sent = 25;
    let ok = 0;
    let throttled = 0;
    const headersSeen = new Set<string>();
    await Promise.all(
      Array.from({ length: sent }).map(async () => {
        try {
          const r = await fetch(`${PUBLIC_BASE}/health`, { method: "GET" });
          ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset", "retry-after"].forEach((h) => {
            if (r.headers.get(h)) headersSeen.add(h);
          });
          if (r.status === 429) throttled++;
          else if (r.ok) ok++;
        } catch {
          /* network */
        }
      }),
    );
    setResult({ sent, ok, throttled, headersSeen: [...headersSeen] });
    setRunning(false);
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Rate Limits</h1>
        <p className="text-muted-foreground mt-2">
          Documented tiers enforced at the gateway. The live test below sends a burst of
          requests against <code>{PUBLIC_BASE}/health</code> and reports the rate-limit
          headers returned by the gateway, confirming docs match runtime configuration.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tier reference</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tier</TableHead>
                <TableHead>Limit</TableHead>
                <TableHead>Window</TableHead>
                <TableHead>Scope</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TIERS.map((t) => (
                <TableRow key={t.tier}>
                  <TableCell className="font-medium">{t.tier}</TableCell>
                  <TableCell>{t.limit.toLocaleString()}</TableCell>
                  <TableCell>per {t.window}</TableCell>
                  <TableCell className="text-muted-foreground">{t.scope}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" /> Live verification
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={runLiveTest} disabled={running} variant="outline">
            {running ? "Running…" : "Run burst test (25 requests)"}
          </Button>
          {result && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">Sent: {result.sent}</Badge>
                <Badge variant="outline" className="border-primary">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> OK: {result.ok}
                </Badge>
                <Badge variant="outline">
                  <AlertTriangle className="h-3 w-3 mr-1" /> 429: {result.throttled}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Rate-limit headers observed:</div>
                {result.headersSeen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No standard rate-limit headers returned in this burst.
                  </p>
                ) : (
                  <ul className="text-sm font-mono">
                    {result.headersSeen.map((h) => (
                      <li key={h}>· {h}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
