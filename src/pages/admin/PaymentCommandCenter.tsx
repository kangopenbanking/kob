import { useState, useEffect, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Activity, CreditCard, DollarSign, AlertTriangle, RefreshCw, Search,
  Zap, Shield, CheckCircle2, XCircle, Clock, TrendingUp, Wifi, WifiOff,
  ArrowLeftRight, BarChart3, Webhook, Store
} from "lucide-react";
import { format, subHours, startOfDay, endOfDay } from "date-fns";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

/* ───────── helpers ───────── */
const statusColor = (s: string) => {
  switch (s) {
    case "successful": return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
    case "failed": return "bg-destructive/15 text-destructive border-destructive/30";
    case "pending": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const severityColor = (s: string) => {
  switch (s) {
    case "critical": return "bg-destructive/15 text-destructive border-destructive/30";
    case "high": return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30";
    case "medium": return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
    case "low": return "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

const fmt = (d: string | null) => d ? format(new Date(d), "MMM dd, HH:mm:ss") : "—";
const fmtShort = (d: string | null) => d ? format(new Date(d), "HH:mm:ss") : "—";
const currency = (n: number | null, c = "XAF") => n != null ? `${c} ${n.toLocaleString()}` : "—";

/* ───────── OVERVIEW TAB ───────── */
function OverviewTab() {
  const todayStart = startOfDay(new Date()).toISOString();
  const todayEnd = endOfDay(new Date()).toISOString();

  const { data: charges } = useQuery({
    queryKey: ["pcc-overview", todayStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_charges")
        .select("id, status, amount, created_at")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd);
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  const { data: refunds } = useQuery({
    queryKey: ["pcc-refunds-today", todayStart],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_refunds")
        .select("id")
        .gte("created_at", todayStart)
        .lte("created_at", todayEnd)
        .eq("status", "successful");
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const total = charges?.length ?? 0;
  const successful = charges?.filter(c => c.status === "successful").length ?? 0;
  const failed = charges?.filter(c => c.status === "failed").length ?? 0;
  const pending = charges?.filter(c => c.status === "pending").length ?? 0;

  // Sparkline from hourly buckets
  const sparkline = useMemo(() => {
    if (!charges?.length) return [];
    const buckets: Record<number, number> = {};
    charges.forEach(c => {
      const h = new Date(c.created_at).getHours();
      buckets[h] = (buckets[h] || 0) + 1;
    });
    return Array.from({ length: 24 }, (_, i) => buckets[i] || 0);
  }, [charges]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard title="Total Payments Today" value={total} icon={<CreditCard />} sparklineData={sparkline} />
      <StatCard title="Successful" value={successful} icon={<CheckCircle2 />} trend={total ? { value: Math.round((successful / total) * 100), label: "success rate" } : undefined} />
      <StatCard title="Failed" value={failed} icon={<XCircle />} trend={total ? { value: -Math.round((failed / total) * 100), label: "failure rate" } : undefined} />
      <StatCard title="Pending" value={pending} icon={<Clock />} />
      <StatCard title="Refunds Processed" value={refunds?.length ?? 0} icon={<RefreshCw />} />
      <StatCard title="Active Providers" value={3} icon={<Zap />} />
    </div>
  );
}

/* ───────── LIVE TRANSACTIONS TAB ───────── */
function LiveTransactionsTab({ searchTxRef }: { searchTxRef: string }) {
  const queryClient = useQueryClient();
  const [transactions, setTransactions] = useState<any[]>([]);

  const { data: initial } = useQuery({
    queryKey: ["pcc-live-tx", searchTxRef],
    queryFn: async () => {
      let q = supabase
        .from("gateway_charges")
        .select("id, tx_ref, channel, merchant_id, amount, currency, status, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (searchTxRef) q = q.ilike("tx_ref", `%${searchTxRef}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (initial) setTransactions(initial);
  }, [initial]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("pcc-charges-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "gateway_charges" }, (payload) => {
        if (payload.eventType === "INSERT") {
          setTransactions(prev => [payload.new as any, ...prev.slice(0, 99)]);
        } else if (payload.eventType === "UPDATE") {
          setTransactions(prev => prev.map(t => t.id === (payload.new as any).id ? payload.new as any : t));
        }
        queryClient.invalidateQueries({ queryKey: ["pcc-overview"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Wifi className="h-4 w-4 text-emerald-500 animate-pulse" /> Live Transaction Stream
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>TX Ref</TableHead>
                <TableHead>Provider</TableHead>
                <TableHead>Merchant</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No transactions found</TableCell></TableRow>
              )}
              {transactions.map((tx) => (
                <TableRow key={tx.id} className="animate-in fade-in-0 duration-300">
                  <TableCell className="font-mono text-xs">{tx.tx_ref?.slice(0, 16) ?? "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-xs">{tx.channel ?? "—"}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{tx.merchant_id?.slice(0, 8) ?? "—"}</TableCell>
                  <TableCell className="text-right font-medium">{currency(tx.amount, tx.currency)}</TableCell>
                  <TableCell><Badge className={statusColor(tx.status)}>{tx.status}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmtShort(tx.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── PROVIDER HEALTH TAB ───────── */
function ProviderHealthTab() {
  const since24h = subHours(new Date(), 24).toISOString();

  const { data: lastCharges } = useQuery({
    queryKey: ["pcc-provider-last-charge"],
    queryFn: async () => {
      const providers = ["stripe", "flutterwave", "paypal"];
      const results: Record<string, any> = {};
      for (const p of providers) {
        const { data } = await supabase
          .from("gateway_charges")
          .select("created_at")
          .eq("channel", p)
          .eq("status", "successful")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        results[p] = data;
      }
      return results;
    },
    refetchInterval: 30000,
  });

  const { data: errorCounts } = useQuery({
    queryKey: ["pcc-provider-errors", since24h],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_usage_metrics")
        .select("endpoint, status_code")
        .gte("created_at", since24h)
        .gte("status_code", 400);
      const counts: Record<string, number> = { stripe: 0, flutterwave: 0, paypal: 0 };
      data?.forEach(d => {
        if (d.endpoint?.includes("stripe")) counts.stripe++;
        else if (d.endpoint?.includes("flutterwave")) counts.flutterwave++;
        else if (d.endpoint?.includes("paypal")) counts.paypal++;
      });
      return counts;
    },
    refetchInterval: 30000,
  });

  const providers = [
    { name: "Stripe", key: "stripe", icon: <CreditCard className="h-5 w-5" /> },
    { name: "Flutterwave", key: "flutterwave", icon: <Zap className="h-5 w-5" /> },
    { name: "PayPal", key: "paypal", icon: <DollarSign className="h-5 w-5" /> },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {providers.map(p => {
        const errors = errorCounts?.[p.key] ?? 0;
        const status = errors > 20 ? "down" : errors > 5 ? "degraded" : "operational";
        const statusBadge = status === "operational"
          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30"
          : status === "degraded"
            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"
            : "bg-destructive/15 text-destructive border-destructive/30";
        return (
          <Card key={p.key}>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">{p.icon}{p.name}</div>
                <Badge className={statusBadge}>{status}</Badge>
              </div>
              <div className="text-sm space-y-1 text-muted-foreground">
                <p>Last success: <span className="text-foreground">{fmt(lastCharges?.[p.key]?.created_at)}</span></p>
                <p>Errors (24h): <span className={errors > 5 ? "text-destructive font-medium" : "text-foreground"}>{errors}</span></p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ───────── WEBHOOK MONITOR TAB ───────── */
function WebhookMonitorTab() {
  const { data: webhooks, isLoading } = useQuery({
    queryKey: ["pcc-webhooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("webhook_inbox")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: 10000,
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2"><Webhook className="h-4 w-4" /> Webhook Event Log</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="max-h-[520px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Event Type</TableHead>
                <TableHead>Idempotency Key</TableHead>
                <TableHead>Processed</TableHead>
                <TableHead>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!webhooks?.length && (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">{isLoading ? "Loading…" : "No webhook events"}</TableCell></TableRow>
              )}
              {webhooks?.map((w: any) => (
                <TableRow key={w.id}>
                  <TableCell><Badge variant="outline">{w.provider ?? "—"}</Badge></TableCell>
                  <TableCell className="text-xs font-mono">{w.event_type ?? "—"}</TableCell>
                  <TableCell className="text-xs font-mono truncate max-w-[180px]">{w.idempotency_key ?? "—"}</TableCell>
                  <TableCell>
                    <Badge className={w.processed ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-destructive/15 text-destructive border-destructive/30"}>
                      {w.processed ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{fmt(w.received_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ───────── MERCHANT BALANCES TAB ───────── */
function MerchantBalancesTab() {
  const [search, setSearch] = useState("");

  const { data: wallets } = useQuery({
    queryKey: ["pcc-merchant-wallets"],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_merchant_wallets")
        .select("*, gateway_merchants(business_name)")
        .order("updated_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(() => {
    if (!wallets) return [];
    if (!search) return wallets;
    const s = search.toLowerCase();
    return wallets.filter((w: any) =>
      (w.gateway_merchants?.business_name ?? "").toLowerCase().includes(s) ||
      w.merchant_id?.toLowerCase().includes(s)
    );
  }, [wallets, search]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search merchant…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Merchant</TableHead>
                  <TableHead>Currency</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Ledger</TableHead>
                  <TableHead>Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!filtered.length && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No wallets found</TableCell></TableRow>
                )}
                {filtered.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="font-medium">{(w.gateway_merchants as any)?.business_name ?? w.merchant_id?.slice(0, 8)}</TableCell>
                    <TableCell>{w.currency}</TableCell>
                    <TableCell className="text-right">{currency(w.available_balance, w.currency)}</TableCell>
                    <TableCell className="text-right">{currency(w.pending_balance, w.currency)}</TableCell>
                    <TableCell className="text-right">{currency(w.ledger_balance, w.currency)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(w.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── ERROR & ALERT CENTER TAB ───────── */
function ErrorAlertTab() {
  const [severity, setSeverity] = useState("all");

  const { data: alerts } = useQuery({
    queryKey: ["pcc-alerts", severity],
    queryFn: async () => {
      let q = supabase
        .from("system_alerts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (severity !== "all") q = q.eq("severity", severity);
      const { data } = await q;
      return data ?? [];
    },
    refetchInterval: 15000,
  });

  return (
    <div className="space-y-4">
      <Select value={severity} onValueChange={setSeverity}>
        <SelectTrigger className="w-[180px]"><SelectValue placeholder="All severities" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Severities</SelectItem>
          <SelectItem value="critical">Critical</SelectItem>
          <SelectItem value="high">High</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="low">Low</SelectItem>
        </SelectContent>
      </Select>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!alerts?.length && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No alerts</TableCell></TableRow>
                )}
                {alerts?.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell><Badge className={severityColor(a.severity)}>{a.severity}</Badge></TableCell>
                    <TableCell className="text-sm">{a.alert_type ?? a.type ?? "—"}</TableCell>
                    <TableCell className="text-sm max-w-[300px] truncate">{a.message ?? a.description ?? "—"}</TableCell>
                    <TableCell><Badge variant="outline">{a.status ?? "open"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(a.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── RECONCILIATION TAB ───────── */
function ReconciliationTab() {
  const [running, setRunning] = useState(false);

  const { data: mismatches, refetch } = useQuery({
    queryKey: ["pcc-recon-mismatches"],
    queryFn: async () => {
      const { data } = await supabase
        .from("reconciliation_mismatches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const triggerReconciliation = useCallback(async () => {
    setRunning(true);
    try {
      const { error } = await supabase.functions.invoke("gateway-reconciliation", { body: { action: "run" } });
      if (error) throw error;
      toast.success("Reconciliation triggered");
      refetch();
    } catch {
      toast.error("Failed to trigger reconciliation");
    } finally {
      setRunning(false);
    }
  }, [refetch]);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button onClick={triggerReconciliation} disabled={running} size="sm">
          <RefreshCw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
          {running ? "Running…" : "Run Reconciliation"}
        </Button>
        <span className="text-sm text-muted-foreground">{mismatches?.length ?? 0} mismatches found</span>
      </div>
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[520px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Mismatch</TableHead>
                  <TableHead>DB Value</TableHead>
                  <TableHead>Provider Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!mismatches?.length && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No mismatches</TableCell></TableRow>
                )}
                {mismatches?.map((m: any) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-sm">{m.entity_type}</TableCell>
                    <TableCell className="font-mono text-xs">{m.entity_id?.slice(0, 12)}</TableCell>
                    <TableCell><Badge variant="outline">{m.mismatch_type}</Badge></TableCell>
                    <TableCell className="text-xs">{m.db_value ?? "—"}</TableCell>
                    <TableCell className="text-xs">{m.provider_value ?? "—"}</TableCell>
                    <TableCell><Badge className={m.status === "resolved" ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" : "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30"}>{m.status}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmt(m.created_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── PERFORMANCE TAB ───────── */
function PerformanceTab() {
  const lastHour = subHours(new Date(), 1).toISOString();

  const { data: chargesByMin } = useQuery({
    queryKey: ["pcc-perf-charges", lastHour],
    queryFn: async () => {
      const { data } = await supabase
        .from("gateway_charges")
        .select("created_at")
        .gte("created_at", lastHour);
      if (!data?.length) return [];
      const buckets: Record<string, number> = {};
      data.forEach(c => {
        const key = format(new Date(c.created_at), "HH:mm");
        buckets[key] = (buckets[key] || 0) + 1;
      });
      return Object.entries(buckets).map(([time, count]) => ({ time, count })).sort((a, b) => a.time.localeCompare(b.time));
    },
    refetchInterval: 15000,
  });

  const { data: apiPerf } = useQuery({
    queryKey: ["pcc-perf-api", lastHour],
    queryFn: async () => {
      const { data } = await supabase
        .from("api_usage_metrics")
        .select("created_at, response_time_ms")
        .gte("created_at", lastHour)
        .not("response_time_ms", "is", null)
        .limit(500);
      if (!data?.length) return [];
      const buckets: Record<string, { total: number; count: number }> = {};
      data.forEach(d => {
        const key = format(new Date(d.created_at!), "HH:mm");
        if (!buckets[key]) buckets[key] = { total: 0, count: 0 };
        buckets[key].total += d.response_time_ms ?? 0;
        buckets[key].count++;
      });
      return Object.entries(buckets)
        .map(([time, b]) => ({ time, avg_ms: Math.round(b.total / b.count) }))
        .sort((a, b) => a.time.localeCompare(b.time));
    },
    refetchInterval: 30000,
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Payments / Minute (Last Hour)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chargesByMin ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">API Response Time (ms)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={apiPerf ?? []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <YAxis tick={{ fontSize: 10 }} className="text-muted-foreground" />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
                <defs>
                  <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="avg_ms" stroke="hsl(var(--primary))" fill="url(#apiGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ───────── MAIN PAGE ───────── */
export default function PaymentCommandCenter() {
  const [searchTxRef, setSearchTxRef] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Payment Command Center</h1>
          <p className="text-sm text-muted-foreground mt-1">Real-time monitoring, debugging, and reconciliation across all payment providers.</p>
        </div>
        <div className="relative max-w-xs w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tx_ref…"
            value={searchTxRef}
            onChange={e => setSearchTxRef(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="live">Live Transactions</TabsTrigger>
          <TabsTrigger value="providers">Provider Health</TabsTrigger>
          <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger value="wallets">Merchant Balances</TabsTrigger>
          <TabsTrigger value="alerts">Errors & Alerts</TabsTrigger>
          <TabsTrigger value="reconciliation">Reconciliation</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="live"><LiveTransactionsTab searchTxRef={searchTxRef} /></TabsContent>
        <TabsContent value="providers"><ProviderHealthTab /></TabsContent>
        <TabsContent value="webhooks"><WebhookMonitorTab /></TabsContent>
        <TabsContent value="wallets"><MerchantBalancesTab /></TabsContent>
        <TabsContent value="alerts"><ErrorAlertTab /></TabsContent>
        <TabsContent value="reconciliation"><ReconciliationTab /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
      </Tabs>
    </div>
  );
}
