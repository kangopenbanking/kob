import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import {
  DollarSign, Clock, CheckCircle2, AlertCircle, RefreshCw, Download, Banknote, Search, TrendingUp, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

interface Settlement {
  id: string;
  settlement_ref: string;
  gross_amount: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  transaction_count: number;
  total_fees: number;
  net_amount: number;
  created_at: string;
  settled_at: string | null;
  settlement_method: string | null;
  settlement_destination: any;
  error_message: string | null;
  metadata: any;
  [key: string]: any;
}

export default function InstitutionSettlement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [pendingBalance, setPendingBalance] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedSettlement, setSelectedSettlement] = useState<Settlement | null>(null);

  useEffect(() => { loadData(); }, [page, pageSize, statusFilter]);

  const resolveInstitutionId = async (userId: string): Promise<string | null> => {
    const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
    if (inst) return inst.id;
    const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
    return staffInst || null;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const institutionId = await resolveInstitutionId(user.id);
      if (!institutionId) { navigate("/register"); return; }

      let query = supabase.from("settlement_transactions").select("*", { count: "exact" }).eq("institution_id", institutionId);
      if (statusFilter !== "all") query = query.eq("settlement_status", statusFilter);

      const from = (page - 1) * pageSize;
      const { data: settlementData, count, error } = await query.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;

      const mapped: Settlement[] = (settlementData || []).map((s: any) => ({
        ...s,
        settlement_ref: s.settlement_ref || s.id.slice(0, 8),
        gross_amount: Number(s.total_inflows || 0),
        currency: s.currency || "XAF",
        status: s.settlement_status || "pending",
        period_start: s.period_start || s.created_at,
        period_end: s.period_end || s.created_at,
        transaction_count: s.transaction_count || 0,
        total_fees: Number(s.kob_fees_charged || 0),
        net_amount: Number(s.net_settlement_amount || 0),
        settled_at: s.settled_at || null,
        settlement_method: s.settlement_method || null,
        error_message: s.error_message || null,
      }));

      setSettlements(mapped);
      setTotalCount(count || 0);

      // Calculate pending balance
      const { data: pendingMm } = await supabase
        .from("mobile_money_transactions").select("amount")
        .eq("facilitated_institution_id", institutionId).eq("is_kob_facilitated", true)
        .is("settlement_id", null).eq("status", "completed");
      const { data: pendingBt } = await supabase
        .from("bank_transfer_transactions").select("amount")
        .eq("facilitated_institution_id", institutionId).eq("is_kob_facilitated", true)
        .is("settlement_id", null).eq("status", "completed");

      const mmPending = (pendingMm || []).reduce((s, t) => s + Number(t.amount || 0), 0);
      const btPending = (pendingBt || []).reduce((s, t) => s + Number(t.amount || 0), 0);
      setPendingBalance(mmPending + btPending);
    } catch (error: any) {
      toast({ title: "Error loading settlements", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = settlements.filter((s) =>
    s.settlement_ref?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalSettled = settlements.filter((s) => s.status === "completed").reduce((sum, s) => sum + s.net_amount, 0);
  const totalFees = settlements.reduce((sum, s) => sum + s.total_fees, 0);
  const completedCount = settlements.filter((s) => s.status === "completed").length;

  const exportCSV = () => {
    const rows = [
      ["Reference", "Period Start", "Period End", "Gross", "Fees", "Net Amount", "Status", "Date"].join(","),
      ...filtered.map((s) =>
        [s.settlement_ref, s.period_start, s.period_end, s.gross_amount, s.total_fees, s.net_amount, s.status, s.created_at].join(",")
      ),
    ].join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `settlements-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any; label: string }> = {
      completed: { variant: "default", icon: CheckCircle2, label: "Completed" },
      processing: { variant: "secondary", icon: Clock, label: "Processing" },
      failed: { variant: "destructive", icon: XCircle, label: "Failed" },
      pending: { variant: "secondary", icon: Clock, label: "Pending" },
    };
    const cfg = map[status] || map.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant={cfg.variant} className="gap-1 text-[10px] uppercase tracking-wider font-semibold">
        <Icon className="h-3 w-3" />
        {cfg.label}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <Banknote className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Settlement</h1>
            <p className="text-muted-foreground text-sm">Track payouts and settlement cycles</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV}>
            <Download className="h-4 w-4 mr-2" />Export
          </Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-4">
        <StatCard title="Pending Balance" value={fmt(pendingBalance)} icon={<Clock className="h-5 w-5" />} />
        <StatCard title="Total Settled" value={fmt(totalSettled)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Total Fees" value={fmt(totalFees)} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard title="Completed" value={`${completedCount} / ${totalCount}`} icon={<CheckCircle2 className="h-5 w-5" />} />
      </motion.div>

      {/* Filters */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by reference..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60 overflow-hidden">
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-4">{[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
            ) : filtered.length === 0 ? (
              <EmptyState icon={<DollarSign className="h-6 w-6 text-muted-foreground" />} title="No settlements found" description="Settlements are processed automatically based on your schedule" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40">
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Reference</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Period</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Gross</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Fees</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Net Amount</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((s) => (
                      <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedSettlement(s)}>
                        <TableCell className="font-mono text-xs font-semibold text-primary">{s.settlement_ref}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(new Date(s.period_start), "MMM d")} – {format(new Date(s.period_end), "MMM d, yy")}
                        </TableCell>
                        <TableCell className="text-sm font-medium text-right">{fmt(s.gross_amount)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground text-right">{fmt(s.total_fees)}</TableCell>
                        <TableCell className="text-sm font-bold text-right">{fmt(s.net_amount)}</TableCell>
                        <TableCell>{statusBadge(s.status)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{format(new Date(s.created_at), "PP")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
            <DataTablePagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Detail Sheet */}
      <Sheet open={!!selectedSettlement} onOpenChange={(o) => !o && setSelectedSettlement(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          {selectedSettlement && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <Banknote className="h-5 w-5 text-primary" />Settlement Details
                </SheetTitle>
                <SheetDescription className="font-mono text-xs">{selectedSettlement.settlement_ref}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{fmt(selectedSettlement.net_amount)}</span>
                  {statusBadge(selectedSettlement.status)}
                </div>
                <Separator />
                <div className="space-y-2">
                  {[
                    { label: "Settlement Period", value: `${format(new Date(selectedSettlement.period_start), "PP")} – ${format(new Date(selectedSettlement.period_end), "PP")}` },
                    { label: "Gross Amount", value: fmt(selectedSettlement.gross_amount) },
                    { label: "KOB Fees", value: fmt(selectedSettlement.total_fees) },
                    { label: "Net Payout", value: fmt(selectedSettlement.net_amount) },
                    { label: "Transactions", value: String(selectedSettlement.transaction_count) },
                    { label: "Method", value: selectedSettlement.settlement_method || "—" },
                    { label: "Created", value: format(new Date(selectedSettlement.created_at), "PPp") },
                    { label: "Settled At", value: selectedSettlement.settled_at ? format(new Date(selectedSettlement.settled_at), "PPp") : "—" },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-start py-1.5">
                      <span className="text-sm text-muted-foreground">{row.label}</span>
                      <span className="text-sm font-medium text-right max-w-[55%] break-all">{row.value}</span>
                    </div>
                  ))}
                </div>
                {selectedSettlement.error_message && (
                  <>
                    <Separator />
                    <div className="rounded-lg bg-destructive/10 p-3">
                      <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                      <p className="text-xs text-destructive/80">{selectedSettlement.error_message}</p>
                    </div>
                  </>
                )}
                {selectedSettlement.settlement_destination && (
                  <>
                    <Separator />
                    <div>
                      <p className="text-sm font-semibold mb-2">Destination Account</p>
                      <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                        {JSON.stringify(selectedSettlement.settlement_destination, null, 2)}
                      </pre>
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
