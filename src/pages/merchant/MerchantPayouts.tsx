import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, Banknote, Clock, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export default function MerchantPayouts() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any>(null);

  useEffect(() => { loadData(); }, [page, pageSize]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const from = (page - 1) * pageSize;
      const { data, count } = await supabase.from("gateway_payouts").select("*", { count: "exact" }).eq("merchant_id", m.id).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      setPayouts(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const filtered = payouts.filter(p => {
    if (search && !p.payout_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const statuses = [...new Set(payouts.map(p => p.status).filter(Boolean))];
  const totalAmount = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
  const completedAmount = filtered.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = filtered.filter(p => p.status === "pending" || p.status === "processing").length;

  const exportCSV = () => {
    const headers = ["Reference", "Amount", "Currency", "Status", "Destination", "Date"];
    const rows = filtered.map(p => [p.payout_ref, p.amount, p.currency, p.status, p.destination_type, p.created_at]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `payouts-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Payouts</h1><p className="text-muted-foreground">View and track your payout history</p></div>
        <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Export</Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Payouts" value={`${totalAmount.toLocaleString()} XAF`} icon={<Banknote className="h-5 w-5" />} />
        <StatCard title="Completed" value={`${completedAmount.toLocaleString()} XAF`} icon={<CheckCircle2 className="h-5 w-5" />} />
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
            <EmptyState icon={<Banknote className="h-6 w-6 text-muted-foreground" />} title="No payouts found" description="Payouts will appear here once settlements are processed" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Reference</th><th className="text-left py-3 px-4">Amount</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Destination</th><th className="text-left py-3 px-4">Date</th></tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedTx(p)}>
                      <td className="py-3 px-4 font-mono text-xs">{p.payout_ref}</td>
                      <td className="py-3 px-4 font-medium">{Number(p.amount).toLocaleString()} {p.currency}</td>
                      <td className="py-3 px-4"><Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge></td>
                      <td className="py-3 px-4">{p.destination_type}</td>
                      <td className="py-3 px-4 text-muted-foreground">{p.created_at ? format(new Date(p.created_at), "MMM d, yyyy") : "-"}</td>
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
