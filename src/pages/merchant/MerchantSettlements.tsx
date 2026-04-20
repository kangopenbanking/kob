import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Search, Landmark, CheckCircle2, Clock, Receipt, Zap, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const CYCLE_OPTIONS = [
  { value: "instant", label: "Instant (every minute)", description: "Funds sweep from pending to available within 60 seconds. Best for high-velocity merchants." },
  { value: "daily", label: "Daily (recommended)", description: "Funds settle once per day at 02:00 UTC." },
  { value: "weekly", label: "Weekly", description: "Funds settle every Monday at 02:00 UTC." },
  { value: "monthly", label: "Monthly", description: "Funds settle on the 1st of each month at 02:00 UTC." },
];

export default function MerchantSettlements() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [cycle, setCycle] = useState<string>("daily");
  const [savingCycle, setSavingCycle] = useState(false);
  const [settlingNow, setSettlingNow] = useState(false);

  useEffect(() => { loadData(); }, [page, pageSize]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id, settlement_frequency").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      setCycle(m.settlement_frequency || "daily");
      const from = (page - 1) * pageSize;
      const { data, count } = await supabase.from("gateway_settlements").select("*", { count: "exact" }).eq("merchant_id", m.id).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      setSettlements(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const updateCycle = async (newCycle: string) => {
    if (!merchantId || newCycle === cycle) return;
    setSavingCycle(true);
    const { error } = await supabase.from("gateway_merchants").update({ settlement_frequency: newCycle }).eq("id", merchantId);
    setSavingCycle(false);
    if (error) {
      toast.error("Could not update cycle. Please try again.");
      return;
    }
    setCycle(newCycle);
    toast.success(`Settlement cycle updated to ${newCycle}.`);
  };

  const settleNow = async () => {
    setSettlingNow(true);
    try {
      const { data, error } = await supabase.functions.invoke("merchant-settle-now", { body: {} });
      if (error) throw error;
      const total = data?.settled?.length || 0;
      if (total === 0) {
        toast.message("No pending balance to settle right now.");
      } else {
        toast.success(`Settled ${total} wallet${total > 1 ? "s" : ""}.`);
        loadData();
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not settle now. Please try again.");
    } finally {
      setSettlingNow(false);
    }
  };

  const filtered = settlements.filter(s => {
    if (search && !s.id?.toLowerCase().includes(search.toLowerCase()) && !s.payout_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const statuses = [...new Set(settlements.map(s => s.status).filter(Boolean))];
  const totalSettled = filtered.filter(s => s.status === "settled").reduce((sum, s) => sum + Number(s.net_amount || 0), 0);
  const totalFees = filtered.reduce((sum, s) => sum + Number(s.fees_total || 0), 0);
  const pendingCount = filtered.filter(s => s.status !== "settled").length;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Settlements</h1>
          <p className="text-muted-foreground">Settlement batches and breakdowns</p>
        </div>
        <Button onClick={settleNow} disabled={settlingNow} variant="outline">
          {settlingNow ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          Settle Now
        </Button>
      </div>

      {/* Settlement cycle */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Settlement Cycle</CardTitle>
          <CardDescription>Choose how often pending funds are released to your available balance.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select value={cycle} onValueChange={updateCycle} disabled={savingCycle}>
              <SelectTrigger className="w-full sm:w-[280px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CYCLE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {savingCycle && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-sm text-muted-foreground">
            {CYCLE_OPTIONS.find(o => o.value === cycle)?.description}
          </p>
          {cycle === "instant" && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
              <AlertTriangle className="h-4 w-4 mt-0.5 text-amber-600 shrink-0" />
              <span className="text-foreground">
                Instant settlement runs every minute and may incur additional payout-rail fees. Daily is recommended for most merchants.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Settled" value={`${totalSettled.toLocaleString()} XAF`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Fees Deducted" value={`${totalFees.toLocaleString()} XAF`} icon={<Receipt className="h-5 w-5" />} />
        <StatCard title="Pending" value={String(pendingCount)} icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by reference..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <EmptyState icon={<Landmark className="h-6 w-6 text-muted-foreground" />} title="No settlements found" description="Settlements are created automatically from successful charges" action={{ label: "View Transactions", onClick: () => window.location.href = "/merchant/transactions" }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Reference</th><th className="text-left py-3 px-4">Gross</th><th className="text-left py-3 px-4">Fees</th><th className="text-left py-3 px-4">Net</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Period</th></tr></thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedTx(s)}>
                      <td className="py-3 px-4 font-mono text-xs">{s.payout_ref || s.id.slice(0, 8)}</td>
                      <td className="py-3 px-4">{Number(s.amount || 0).toLocaleString()} {s.currency}</td>
                      <td className="py-3 px-4 text-muted-foreground">{Number(s.fees_total || 0).toLocaleString()}</td>
                      <td className="py-3 px-4 font-medium">{Number(s.net_amount || 0).toLocaleString()}</td>
                      <td className="py-3 px-4"><Badge variant={s.status === "settled" ? "default" : "secondary"}>{s.status}</Badge></td>
                      <td className="py-3 px-4 text-muted-foreground">{s.period_start ? format(new Date(s.period_start), "MMM d") : "-"} – {s.period_end ? format(new Date(s.period_end), "MMM d") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <DataTablePagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
