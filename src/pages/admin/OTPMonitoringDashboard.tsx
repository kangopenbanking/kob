import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ShieldAlert, Activity, Ban, RefreshCw } from "lucide-react";

type OtpLog = {
  id: string;
  ip_address: string;
  phone_hash: string;
  phone_country_code: string | null;
  region: string | null;
  status: "requested" | "verified" | "failed" | "blocked";
  error_code: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type IpBlock = {
  ip_address: string;
  reason: string;
  blocked_until: string | null;
  created_at: string;
  metadata: Record<string, unknown>;
};

export default function OTPMonitoringDashboard() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<OtpLog[]>([]);
  const [blocks, setBlocks] = useState<IpBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    const [{ data: logRows, error: logErr }, { data: blockRows, error: blockErr }] = await Promise.all([
      supabase
        .from("otp_request_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase
        .from("otp_ip_block")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
    ]);
    if (logErr || blockErr) {
      toast({ title: "Failed to load OTP data", description: logErr?.message || blockErr?.message, variant: "destructive" });
    }
    setLogs((logRows as OtpLog[]) || []);
    setBlocks((blockRows as IpBlock[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const totals = useMemo(() => {
    const verified = logs.filter((l) => l.status === "verified").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    const blocked = logs.filter((l) => l.status === "blocked").length;
    const requested = logs.length;
    const successRate = requested ? Math.round((verified / requested) * 100) : 0;
    return { verified, failed, blocked, requested, successRate };
  }, [logs]);

  const byRegion = useMemo(() => {
    const map = new Map<string, { total: number; verified: number; failed: number; blocked: number }>();
    for (const l of logs) {
      const key = l.region || "unknown";
      const row = map.get(key) || { total: 0, verified: 0, failed: 0, blocked: 0 };
      row.total += 1;
      if (l.status === "verified") row.verified += 1;
      else if (l.status === "failed") row.failed += 1;
      else if (l.status === "blocked") row.blocked += 1;
      map.set(key, row);
    }
    return Array.from(map.entries())
      .map(([region, v]) => ({
        region,
        ...v,
        successRate: v.total ? Math.round((v.verified / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);
  }, [logs]);

  const suspiciousIps = useMemo(() => {
    // Multiple distinct phones from same IP in last hour, or rapid retries (>=10 in 5 min)
    const cutoffHour = Date.now() - 60 * 60 * 1000;
    const cutoff5 = Date.now() - 5 * 60 * 1000;
    const ipMap = new Map<string, { phones: Set<string>; rapid: number; total: number }>();
    for (const l of logs) {
      const t = new Date(l.created_at).getTime();
      if (t < cutoffHour) continue;
      const entry = ipMap.get(l.ip_address) || { phones: new Set<string>(), rapid: 0, total: 0 };
      entry.phones.add(l.phone_hash);
      entry.total += 1;
      if (t >= cutoff5) entry.rapid += 1;
      ipMap.set(l.ip_address, entry);
    }
    return Array.from(ipMap.entries())
      .map(([ip, v]) => ({ ip, distinctPhones: v.phones.size, rapid: v.rapid, total: v.total }))
      .filter((r) => r.distinctPhones >= 3 || r.rapid >= 5)
      .sort((a, b) => b.distinctPhones - a.distinctPhones);
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!search.trim()) return logs;
    const q = search.toLowerCase();
    return logs.filter(
      (l) =>
        l.ip_address.toLowerCase().includes(q) ||
        l.phone_hash.toLowerCase().includes(q) ||
        (l.region || "").toLowerCase().includes(q) ||
        (l.error_code || "").toLowerCase().includes(q),
    );
  }, [logs, search]);

  const blockIp = async (ip: string, reason: string) => {
    const { error } = await supabase.from("otp_ip_block").upsert({
      ip_address: ip,
      reason,
      blocked_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) {
      toast({ title: "Failed to block IP", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "IP blocked", description: `${ip} blocked for 24 hours.` });
    load();
  };

  const unblockIp = async (ip: string) => {
    const { error } = await supabase.from("otp_ip_block").delete().eq("ip_address", ip);
    if (error) {
      toast({ title: "Failed to unblock", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "IP unblocked", description: ip });
    load();
  };

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">OTP Monitoring &amp; Alerting</h1>
          <p className="text-sm text-muted-foreground">
            IP-aware OTP request log, abuse detection, and regional delivery health.
          </p>
        </div>
        <Button variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Total Requests</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.requested}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Verified</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.verified}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Failed</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.failed}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Blocked</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.blocked}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-xs font-medium text-muted-foreground">Success Rate</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.successRate}%</CardContent>
        </Card>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview"><Activity className="mr-2 h-4 w-4" />Overview</TabsTrigger>
          <TabsTrigger value="suspicious"><ShieldAlert className="mr-2 h-4 w-4" />Suspicious</TabsTrigger>
          <TabsTrigger value="blocks"><Ban className="mr-2 h-4 w-4" />Blocked IPs</TabsTrigger>
          <TabsTrigger value="logs">Recent Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <Card>
            <CardHeader><CardTitle>Success / Failure by Region</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Verified</TableHead>
                    <TableHead className="text-right">Failed</TableHead>
                    <TableHead className="text-right">Blocked</TableHead>
                    <TableHead className="text-right">Success</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {byRegion.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No data yet.</TableCell></TableRow>
                  )}
                  {byRegion.map((r) => (
                    <TableRow key={r.region}>
                      <TableCell className="font-medium">{r.region}</TableCell>
                      <TableCell className="text-right">{r.total}</TableCell>
                      <TableCell className="text-right">{r.verified}</TableCell>
                      <TableCell className="text-right">{r.failed}</TableCell>
                      <TableCell className="text-right">{r.blocked}</TableCell>
                      <TableCell className="text-right">{r.successRate}%</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suspicious">
          <Card>
            <CardHeader>
              <CardTitle>Suspicious IP patterns</CardTitle>
              <p className="text-sm text-muted-foreground">
                IPs hitting 3+ distinct phones in the last hour or 5+ rapid retries in 5 minutes.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead className="text-right">Distinct phones (1h)</TableHead>
                    <TableHead className="text-right">Requests (5m)</TableHead>
                    <TableHead className="text-right">Total (1h)</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {suspiciousIps.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No suspicious patterns detected.</TableCell></TableRow>
                  )}
                  {suspiciousIps.map((s) => (
                    <TableRow key={s.ip}>
                      <TableCell className="font-mono text-xs">{s.ip}</TableCell>
                      <TableCell className="text-right">{s.distinctPhones}</TableCell>
                      <TableCell className="text-right">{s.rapid}</TableCell>
                      <TableCell className="text-right">{s.total}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => blockIp(s.ip, "manual_admin_block")}>
                          Block 24h
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="blocks">
          <Card>
            <CardHeader><CardTitle>Currently blocked IPs</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Until</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {blocks.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No blocked IPs.</TableCell></TableRow>
                  )}
                  {blocks.map((b) => (
                    <TableRow key={b.ip_address}>
                      <TableCell className="font-mono text-xs">{b.ip_address}</TableCell>
                      <TableCell><Badge variant="outline">{b.reason}</Badge></TableCell>
                      <TableCell>{b.blocked_until ? new Date(b.blocked_until).toLocaleString() : "Permanent"}</TableCell>
                      <TableCell>{new Date(b.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => unblockIp(b.ip_address)}>
                          Unblock
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="logs">
          <Card>
            <CardHeader>
              <CardTitle>Recent OTP requests</CardTitle>
              <Input
                placeholder="Filter by IP, phone hash, region, or error code"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mt-2 max-w-md"
              />
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>IP</TableHead>
                    <TableHead>Phone (hash)</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No log entries.</TableCell></TableRow>
                  )}
                  {filteredLogs.slice(0, 200).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-mono text-xs">{l.ip_address}</TableCell>
                      <TableCell className="font-mono text-xs">{l.phone_hash.slice(0, 12)}…</TableCell>
                      <TableCell>{l.region || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={l.status === "verified" ? "default" : l.status === "blocked" ? "destructive" : "outline"}>
                          {l.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{l.error_code || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
