import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import {
  ArrowUpDown, Download, Search, ArrowUpRight, ArrowDownLeft, RefreshCw, DollarSign, CheckCircle2, Clock, XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const fmt = (n: number) =>
  new Intl.NumberFormat("fr-CM", { style: "currency", currency: "XAF", minimumFractionDigits: 0 }).format(n);

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  status: string;
  credit_debit_indicator: string;
  booking_datetime: string;
  transaction_information: string;
  account_id: string;
  transaction_type: string;
  [key: string]: any;
}

export default function InstitutionTransactions() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  useEffect(() => { loadData(); }, [page, pageSize, statusFilter, typeFilter]);

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

      let query = supabase.from("transactions").select("*", { count: "exact" }).eq("institution_id", institutionId);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("credit_debit_indicator", typeFilter === "credit" ? "Credit" : "Debit");

      const from = (page - 1) * pageSize;
      const { data, count, error } = await query.order("booking_datetime", { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;

      setTransactions(
        (data || []).map((t: any) => ({
          ...t,
          amount: Number(t.amount) || 0,
          currency: t.currency || "XAF",
          status: t.status || "unknown",
          credit_debit_indicator: t.credit_debit_indicator || "Debit",
          booking_datetime: t.booking_datetime || t.created_at,
          transaction_information: t.transaction_information || "",
          account_id: t.account_id || "",
          transaction_type: t.transaction_type || "",
        }))
      );
      setTotalCount(count || 0);
    } catch (error: any) {
      toast({ title: "Error loading transactions", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filtered = transactions.filter(
    (t) =>
      t.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.transaction_information?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      t.id?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalVolume = filtered.reduce((s, t) => s + t.amount, 0);
  const creditCount = filtered.filter((t) => t.credit_debit_indicator === "Credit").length;
  const debitCount = filtered.filter((t) => t.credit_debit_indicator === "Debit").length;
  const pendingCount = filtered.filter((t) => t.status === "pending").length;

  const exportCSV = () => {
    const csv = [
      ["ID", "Amount", "Currency", "Type", "Status", "Date", "Description"].join(","),
      ...filtered.map((t) =>
        [t.id, t.amount, t.currency, t.credit_debit_indicator, t.status, t.booking_datetime, `"${t.transaction_information || ""}"`].join(",")
      ),
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
            <ArrowUpDown className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Transactions</h1>
            <p className="text-muted-foreground text-sm">Monitor and manage all transaction activity</p>
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
        <StatCard title="Total Transactions" value={totalCount.toLocaleString()} icon={<ArrowUpDown className="h-5 w-5" />} />
        <StatCard title="Total Volume" value={fmt(totalVolume)} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Credits / Debits" value={`${creditCount} / ${debitCount}`} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Pending" value={pendingCount.toLocaleString()} icon={<Clock className="h-5 w-5" />} />
      </motion.div>

      {/* Filters */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 h-10" />
              </div>
              <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
                <SelectTrigger className="w-[160px] h-10"><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="credit">Credit</SelectItem>
                  <SelectItem value="debit">Debit</SelectItem>
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
              <EmptyState icon={<ArrowUpDown className="h-6 w-6 text-muted-foreground" />} title="No transactions found" description="Adjust your filters or check back later" />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent bg-muted/40">
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground w-10" />
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Type</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Description</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground text-right">Amount</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Status</TableHead>
                      <TableHead className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((t) => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedTx(t)}>
                        <TableCell>
                          <div className={`p-1.5 rounded-full inline-flex ${t.credit_debit_indicator === "Credit" ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"}`}>
                            {t.credit_debit_indicator === "Credit" ? <ArrowDownLeft className="h-3.5 w-3.5" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{t.transaction_type || "Transaction"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{t.transaction_information || "—"}</TableCell>
                        <TableCell className={`text-sm font-bold text-right ${t.credit_debit_indicator === "Credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                          {t.credit_debit_indicator === "Credit" ? "+" : "-"}{fmt(t.amount)}
                        </TableCell>
                        <TableCell>
                          <Badge variant={t.status === "completed" ? "default" : t.status === "pending" ? "secondary" : "destructive"} className="text-[10px] uppercase tracking-wider font-semibold">
                            {t.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {t.booking_datetime ? format(new Date(t.booking_datetime), "PP") : "—"}
                        </TableCell>
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

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={(o) => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
