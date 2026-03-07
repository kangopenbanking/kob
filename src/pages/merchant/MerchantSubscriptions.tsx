import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Loader2, Search, RefreshCw, Users, CheckCircle2, PauseCircle, XCircle, Download } from "lucide-react";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function MerchantSubscriptions() {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selectedSub, setSelectedSub] = useState<any>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      const { data: s } = await supabase.from("gateway_subscriptions").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setSubs(s || []);
    }
    setLoading(false);
  };

  const filtered = subs.filter(s => {
    if (search && !(s.customer_email?.toLowerCase().includes(search.toLowerCase()) || s.customer_id?.toLowerCase().includes(search.toLowerCase()))) return false;
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    return true;
  });

  const statuses = [...new Set(subs.map(s => s.status).filter(Boolean))];
  const activeCount = subs.filter(s => s.status === "active").length;
  const pausedCount = subs.filter(s => s.status === "paused" || s.status === "suspended").length;
  const cancelledCount = subs.filter(s => s.status === "cancelled").length;

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  const exportCSV = () => {
    const headers = ["Customer", "Status", "Plan", "Next Charge", "Created"];
    const rows = filtered.map(s => [s.customer_email || s.customer_id, s.status, s.plan_id || "", s.next_charge_date || "", s.created_at || ""]);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `subscriptions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage recurring billing and active subscribers</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2">
            <Download className="h-4 w-4" />Export
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
            <RefreshCw className="h-4 w-4" />Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}
        className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Subscriptions" value={subs.length.toLocaleString()} icon={<Users className="h-5 w-5" />} />
        <StatCard title="Active" value={activeCount.toLocaleString()} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Paused / Suspended" value={pausedCount.toLocaleString()} icon={<PauseCircle className="h-5 w-5" />} />
        <StatCard title="Cancelled" value={cancelledCount.toLocaleString()} icon={<XCircle className="h-5 w-5" />} />
      </motion.div>

      {/* Filters */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}
        className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search by customer email..." className="pl-9 h-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
          <SelectTrigger className="w-[160px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </motion.div>

      {/* Table */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="p-0">
            {paged.length === 0 ? (
              <EmptyState icon={<RefreshCw className="h-6 w-6 text-muted-foreground" />} title="No subscriptions found" description={search || statusFilter !== "all" ? "Adjust your filters" : "Subscriptions will appear when customers subscribe to your plans"} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40">
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Customer</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Amount</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Interval</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Charge</th>
                      <th className="text-left py-3 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map(s => (
                      <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors" onClick={() => setSelectedSub(s)}>
                        <td className="py-3 px-4 truncate max-w-[200px]">{s.customer_email || s.customer_id || "—"}</td>
                        <td className="py-3 px-4">
                          <Badge variant={s.status === "active" ? "default" : s.status === "cancelled" ? "destructive" : "secondary"} className="text-xs">
                            {s.status}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-semibold">{s.amount ? `${Number(s.amount).toLocaleString()} ${s.currency || "XAF"}` : "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{s.interval || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{s.next_charge_date ? format(new Date(s.next_charge_date), "MMM d, yyyy") : "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground whitespace-nowrap">{s.created_at ? format(new Date(s.created_at), "MMM d, yyyy") : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedSub} onOpenChange={o => !o && setSelectedSub(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedSub && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <RefreshCw className="h-5 w-5 text-primary" />
                  Subscription Details
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{selectedSub.id}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">
                    {selectedSub.amount ? `${Number(selectedSub.amount).toLocaleString()} ${selectedSub.currency || "XAF"}` : "Flexible"}
                  </span>
                  <Badge variant={selectedSub.status === "active" ? "default" : selectedSub.status === "cancelled" ? "destructive" : "secondary"}>
                    {selectedSub.status}
                  </Badge>
                </div>
                <Separator />
                <div className="space-y-3">
                  {[
                    ["Customer", selectedSub.customer_email || selectedSub.customer_id],
                    ["Interval", selectedSub.interval],
                    ["Plan ID", selectedSub.plan_id],
                    ["Next Charge", selectedSub.next_charge_date ? format(new Date(selectedSub.next_charge_date), "MMM d, yyyy") : null],
                    ["Created", selectedSub.created_at ? format(new Date(selectedSub.created_at), "MMM d, yyyy HH:mm") : null],
                    ["Cancelled At", selectedSub.cancelled_at ? format(new Date(selectedSub.cancelled_at), "MMM d, yyyy HH:mm") : null],
                  ].filter(([, v]) => v).map(([label, value]) => (
                    <div key={label as string} className="flex justify-between items-start py-1.5">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className="text-sm font-medium text-right max-w-[60%] break-all">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
