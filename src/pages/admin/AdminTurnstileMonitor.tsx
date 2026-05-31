// Admin · Cloudflare Turnstile monitor.
//
// Reads `security_audit_logs` rows with `event_category = 'turnstile'`
// written by `supabase/functions/_shared/turnstile.ts#logTurnstileDecision`.
// Shows 7-day pass/fail counts, top error reasons, per-endpoint breakdown,
// and a daily trend of denied (bot-attempt) requests.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, ShieldCheck, ShieldAlert, Bot } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";

type Row = {
  id: string;
  event_type: string;
  ip_address: string | null;
  blocked: boolean;
  metadata: Record<string, any> | null;
  created_at: string;
};

const ENDPOINTS = [
  "developer-register-app",
  "sandbox-create-account",
  "sandbox-create-api-key",
];

export default function AdminTurnstileMonitor() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const sinceIso = subDays(new Date(), 7).toISOString();
    const { data } = await supabase
      .from("security_audit_logs")
      .select("id, event_type, ip_address, blocked, metadata, created_at")
      .eq("event_category", "turnstile")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const stats = useMemo(() => {
    const allowed = rows.filter((r) => !r.blocked).length;
    const denied = rows.filter((r) => r.blocked).length;
    const shadowDenied = rows.filter((r) => r.blocked && r.metadata?.shadow).length;
    const enforcedDenied = denied - shadowDenied;
    return { allowed, denied, shadowDenied, enforcedDenied, total: rows.length };
  }, [rows]);

  const byEndpoint = useMemo(() => {
    const m: Record<string, { allowed: number; denied: number }> = {};
    for (const e of ENDPOINTS) m[e] = { allowed: 0, denied: 0 };
    for (const r of rows) {
      const ep = (r.metadata?.endpoint as string) ?? r.event_type.replace(/^turnstile\./, "");
      if (!m[ep]) m[ep] = { allowed: 0, denied: 0 };
      if (r.blocked) m[ep].denied += 1; else m[ep].allowed += 1;
    }
    return m;
  }, [rows]);

  const topReasons = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.blocked) continue;
      const reason = (r.metadata?.reason as string) ?? "unknown";
      m.set(reason, (m.get(reason) ?? 0) + 1);
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [rows]);

  const dailyTrend = useMemo(() => {
    const buckets: { day: string; allowed: number; denied: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(new Date(), i));
      buckets.push({ day: format(d, "MMM d"), allowed: 0, denied: 0 });
    }
    for (const r of rows) {
      const d = startOfDay(new Date(r.created_at));
      const label = format(d, "MMM d");
      const bucket = buckets.find((b) => b.day === label);
      if (!bucket) continue;
      if (r.blocked) bucket.denied += 1; else bucket.allowed += 1;
    }
    return buckets;
  }, [rows]);

  const maxBar = useMemo(() => {
    const m = Math.max(1, ...dailyTrend.map((b) => Math.max(b.allowed, b.denied)));
    return m;
  }, [dailyTrend]);

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <SEO title="Turnstile monitor" description="Cloudflare Turnstile pass/fail and bot-attempt trends" />
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Turnstile monitor</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Last 7 days of Cloudflare Turnstile decisions on developer key issuance and sandbox endpoints.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Allowed</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> {stats.allowed}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Denied (total)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" /> {stats.denied}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Bot-blocked (enforced)</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Bot className="h-5 w-5 text-destructive" /> {stats.enforcedDenied}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Shadow-only fails</CardDescription>
            <CardTitle className="text-2xl">{stats.shadowDenied}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Bot-attempt trend (7 days)</CardTitle>
          <CardDescription>Daily allowed vs denied verifications</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {dailyTrend.map((b) => (
              <div key={b.day} className="grid grid-cols-[80px_1fr_80px_1fr_60px] gap-2 items-center text-xs">
                <span className="text-muted-foreground">{b.day}</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-primary"
                    style={{ width: `${(b.allowed / maxBar) * 100}%` }}
                  />
                </div>
                <span className="text-right text-muted-foreground">{b.allowed} ok</span>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-destructive"
                    style={{ width: `${(b.denied / maxBar) * 100}%` }}
                  />
                </div>
                <span className="text-right text-muted-foreground">{b.denied} fail</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Per-endpoint breakdown</CardTitle>
            <CardDescription>Allowed and denied counts in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Allowed</TableHead>
                  <TableHead className="text-right">Denied</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(byEndpoint).map(([ep, v]) => (
                  <TableRow key={ep}>
                    <TableCell className="font-mono text-xs">{ep}</TableCell>
                    <TableCell className="text-right">{v.allowed}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={v.denied > 0 ? "destructive" : "outline"}>{v.denied}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top failure reasons</CardTitle>
            <CardDescription>Structured `reason` from verifier; Cloudflare error codes in metadata</CardDescription>
          </CardHeader>
          <CardContent>
            {topReasons.length === 0 ? (
              <p className="text-sm text-muted-foreground">No failures recorded in the last 7 days.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reason</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topReasons.map(([reason, count]) => (
                    <TableRow key={reason}>
                      <TableCell className="font-mono text-xs">{reason}</TableCell>
                      <TableCell className="text-right">{count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent decisions</CardTitle>
          <CardDescription>Latest 100 events — most recent first</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Hostname</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Mode</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 100).map((r) => {
                    const reason = (r.metadata?.reason as string) ?? "—";
                    const ep = (r.metadata?.endpoint as string) ?? r.event_type;
                    const host = (r.metadata?.hostname as string) ?? "—";
                    const shadow = !!r.metadata?.shadow;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">{format(new Date(r.created_at), "MMM d, HH:mm:ss")}</TableCell>
                        <TableCell className="text-xs">{ep}</TableCell>
                        <TableCell>
                          <Badge variant={r.blocked ? "destructive" : "default"}>
                            {r.blocked ? "denied" : "allowed"}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-xs">{reason}</TableCell>
                        <TableCell className="font-mono text-xs">{host}</TableCell>
                        <TableCell className="font-mono text-xs">{r.ip_address ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant={shadow ? "secondary" : "outline"}>{shadow ? "shadow" : "enforce"}</Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {rows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        No Turnstile events in the last 7 days.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
