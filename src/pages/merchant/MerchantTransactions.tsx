import { useEffect, useState } from "react";
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { DateRangePicker, type DateRange } from "@/components/ui/date-range-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Download, Search, ArrowUpDown, CheckCircle2, XCircle, DollarSign, Clock } from "lucide-react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantTransactions() {
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(subDays(new Date(), 29)),
    to: endOfDay(new Date()),
  });

  useEffect(() => { loadData(); }, [page, pageSize, dateRange]);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const from = (page - 1) * pageSize;
      const { data, count } = await supabase.from("gateway_charges")
        .select("*", { count: "exact" })
        .eq("merchant_id", m.id)
        .gte("created_at", dateRange.from.toISOString())
        .lte("created_at", dateRange.to.toISOString())
        .order("created_at", { ascending: false })
        .range(from, from + pageSize - 1);
      setCharges(data || []);
      setTotalCount(count || 0);
    }
    setLoading(false);
  };

  const filtered = charges.filter(c => {
    if (search && !(c.tx_ref?.toLowerCase().includes(search.toLowerCase()) || c.customer_email?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter !== "all" && c.status !== statusFilter) return false;
    if (channelFilter !== "all" && c.channel !== channelFilter) return false;
    return true;
  });

  const channels = [...new Set(charges.map(c => c.channel).filter(Boolean))];
  const statuses = [...new Set(charges.map(c => c.status).filter(Boolean))];
  const successfulTotal = filtered.filter(c => c.status === "successful").reduce((s, c) => s + Number(c.amount || 0), 0);
  const successCount = filtered.filter(c => c.status === "successful").length;
  const failedCount = filtered.filter(c => c.status === "failed").length;
  const pendingCount = filtered.filter(c => c.status === "pending").length;
  const currency = charges[0]?.currency || "XAF";

  const exportCSV = () => {
    const headers = ["Reference", "Amount", "Currency", "Status", "Channel", "Customer Email", "Date"];
    const rows = filtered.map(c => [c.tx_ref, c.amount, c.currency, c.status, c.channel, c.customer_email || "", c.created_at]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="space-y-2">
        {[0,1,2,3,4,5].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalCount.toLocaleString()} total · {successfulTotal.toLocaleString()} {currency} collected
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker value={dateRange} onChange={r => { setDateRange(r); setPage(1); }} />
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />Export
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Volume" value={`${successfulTotal.toLocaleString()} ${currency}`}
          icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Successful" value={successCount.toLocaleString()}
          icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Failed" value={failedCount.toLocaleString()}
          icon={<XCircle className="h-5 w-5" />} />
        <StatCard title="Pending" value={pendingCount.toLocaleString()}
          icon={<Clock className="h-5 w-5" />} />
      </motion.div>

      {/* Filters */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}
        className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by reference or email..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Channel" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Channels</SelectItem>
            {channels.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {filtered.length === 0 ? (
              <EmptyState icon={<ArrowUpDown className="h-6 w-6 text-muted-foreground" />} title="No transactions found" description="Adjust your filters or date range, or create a test charge to get started." action={{ label: "Create Test Charge", onClick: () => window.location.href = "/merchant" }} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reference</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Channel</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(c => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedTx(c)}>
                        <td className="py-3 px-4 font-mono text-xs">{c.tx_ref}</td>
                        <td className="py-3 px-4 font-semibold">{Number(c.amount).toLocaleString()} {c.currency}</td>
                        <td className="py-3 px-4">
                          <Badge variant={c.status === "successful" ? "default" : c.status === "failed" ? "destructive" : "secondary"} className="text-xs">
                            {c.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-muted-foreground">{c.channel || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground truncate max-w-[180px]">{c.customer_email || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{c.created_at ? format(new Date(c.created_at), "MMM d, yyyy HH:mm") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DataTablePagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
          </CardContent>
        </Card>
      </motion.div>

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
