// Admin — Kang Agent oversight
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { RefreshCw, Users, Ban, DollarSign, BookOpen } from "lucide-react";

type Sub = {
  user_id: string;
  status: "trial" | "active" | "suspended";
  questions_asked_count: number;
  free_questions_limit: number;
  current_period_end: string | null;
  last_payment_status: string;
  updated_at: string;
};
type Log = {
  id: string;
  user_id: string;
  payment_reference: string;
  amount: number;
  currency: string;
  status: "success" | "failed";
  reason: string | null;
  triggered_by: string;
  created_at: string;
};

export default function AdminKangAgent() {
  const navigate = useNavigate();
  const [checkingRole, setCheckingRole] = useState(true);
  const [subs, setSubs] = useState<Sub[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  // Filters
  const [userFilter, setUserFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }
      const { data: isAdmin } = await (supabase as any).rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (!isAdmin) { toast.error("Admin access required"); navigate("/"); return; }
      setCheckingRole(false);
      await refresh();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setLoading(true);
    const db = supabase as any;
    const [{ data: s }, { data: l }] = await Promise.all([
      db.from("kang_subscriptions")
        .select("user_id, status, questions_asked_count, free_questions_limit, current_period_end, last_payment_status, updated_at")
        .order("updated_at", { ascending: false }).limit(500),
      db.from("kang_billing_logs")
        .select("id, user_id, payment_reference, amount, currency, status, reason, triggered_by, created_at")
        .order("created_at", { ascending: false }).limit(500),
    ]);
    setSubs((s as Sub[]) ?? []);
    setLogs((l as Log[]) ?? []);
    setLoading(false);
  }

  const filteredSubs = useMemo(() => subs.filter((r) => {
    if (userFilter && !r.user_id.toLowerCase().includes(userFilter.toLowerCase())) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  }), [subs, userFilter, statusFilter]);

  const filteredLogs = useMemo(() => logs.filter((r) => {
    if (userFilter && !r.user_id.toLowerCase().includes(userFilter.toLowerCase())) return false;
    if (statusFilter !== "all" && statusFilter !== "trial" && r.status !== (statusFilter === "active" ? "success" : "failed")) return false;
    if (fromDate && new Date(r.created_at) < new Date(fromDate)) return false;
    if (toDate && new Date(r.created_at) > new Date(toDate + "T23:59:59")) return false;
    return true;
  }), [logs, userFilter, statusFilter, fromDate, toDate]);

  const stats = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const revenue = logs
      .filter((l) => l.status === "success" && l.created_at >= monthStart)
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);
    return {
      active: subs.filter((s) => s.status === "active").length,
      suspended: subs.filter((s) => s.status === "suspended").length,
      revenue,
    };
  }, [subs, logs]);

  async function retry(userId: string) {
    setRetrying(userId);
    try {
      const { data, error } = await supabase.functions.invoke("kang-admin-retry", { body: { user_id: userId } });
      if (error) throw error;
      const body: any = data;
      if (body?.success) {
        toast.success(`Retry succeeded. New balance: ${body.new_balance} ${body.currency}`);
      } else {
        toast.error(`Retry failed: ${body?.error ?? "unknown"} (balance ${body?.current_balance ?? "?"} ${body?.currency ?? ""})`);
      }
      await refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Retry request failed");
    } finally {
      setRetrying(null);
    }
  }

  if (checkingRole) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>;

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Kang Agent</h1>
          <p className="text-xs text-muted-foreground">Subscriptions, billing, and manual retries</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate("/admin/kang-agent/knowledge")}>
            <BookOpen className="h-4 w-4 mr-1.5" /> Knowledge Base
          </Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Active Subscriptions</p>
            <p className="text-xl font-semibold">{stats.active}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
            <Ban className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Suspended</p>
            <p className="text-xl font-semibold">{stats.suspended}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
            <DollarSign className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Revenue (this month)</p>
            <p className="text-xl font-semibold">{Math.round(stats.revenue).toLocaleString()} XAF</p>
          </div>
        </Card>
      </div>

      <Card className="p-3 md:p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <Input placeholder="Filter by User ID…" value={userFilter} onChange={(e) => setUserFilter(e.target.value)} />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
            </SelectContent>
          </Select>
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label="From date" />
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label="To date" />
        </div>
      </Card>

      <Tabs defaultValue="subscriptions" className="w-full">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscriptions ({filteredSubs.length})</TabsTrigger>
          <TabsTrigger value="billing">Billing Logs ({filteredLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Questions</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Last Payment</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSubs.map((s) => (
                  <TableRow key={s.user_id}>
                    <TableCell className="font-mono text-xs">{s.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>
                      <Badge variant={s.status === "active" ? "default" : s.status === "suspended" ? "destructive" : "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.questions_asked_count}/{s.free_questions_limit}</TableCell>
                    <TableCell className="text-xs">{s.current_period_end ? new Date(s.current_period_end).toLocaleDateString() : "—"}</TableCell>
                    <TableCell className="text-xs">{s.last_payment_status}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={retrying === s.user_id || s.status === "active"}
                        onClick={() => retry(s.user_id)}
                      >
                        {retrying === s.user_id ? (
                          <><RefreshCw className="h-3 w-3 mr-1 animate-spin" /> Retrying…</>
                        ) : "Retry"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredSubs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No subscriptions match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                    <TableCell className="font-mono text-xs">{l.user_id.slice(0, 8)}…</TableCell>
                    <TableCell className="font-mono text-xs">{l.payment_reference.slice(0, 8)}…</TableCell>
                    <TableCell className="text-xs">{Math.round(l.amount).toLocaleString()} {l.currency}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={l.status === "success" ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400" : "border-destructive/40 text-destructive"}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.triggered_by}</TableCell>
                    <TableCell className="text-xs max-w-[240px] truncate">{l.reason ?? "—"}</TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No billing logs match.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
