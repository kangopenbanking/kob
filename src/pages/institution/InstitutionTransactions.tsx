import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { EmptyState } from "@/components/ui/empty-state";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { 
  ArrowUpDown, Download, Search, ArrowUpRight, ArrowDownLeft, Calendar, RefreshCw, DollarSign, CheckCircle2
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

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

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      let query = supabase.from("transactions").select("*", { count: "exact" }).eq("institution_id", institution.id);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (typeFilter !== "all") query = query.eq("credit_debit_indicator", typeFilter === "credit" ? "Credit" : "Debit");

      const from = (page - 1) * pageSize;
      const { data, count, error } = await query.order("booking_datetime", { ascending: false }).range(from, from + pageSize - 1);
      if (error) throw error;

      const mapped: Transaction[] = (data || []).map((t: any) => ({
        ...t,
        amount: Number(t.amount) || 0,
        currency: t.currency || 'XAF',
        status: t.status || 'unknown',
        credit_debit_indicator: t.credit_debit_indicator || 'Debit',
        booking_datetime: t.booking_datetime || t.created_at,
        transaction_information: t.transaction_information || '',
        account_id: t.account_id || '',
        transaction_type: t.transaction_type || ''
      }));

      setTransactions(mapped);
      setTotalCount(count || 0);
    } catch (error: any) {
      toast({ title: "Error loading transactions", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const filteredTransactions = transactions.filter(t =>
    t.transaction_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.transaction_information?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalVolume = filteredTransactions.reduce((s, t) => s + t.amount, 0);
  const creditCount = filteredTransactions.filter(t => t.credit_debit_indicator === "Credit").length;

  const exportTransactions = () => {
    const csv = [
      ["ID", "Amount", "Currency", "Type", "Status", "Date", "Description"].join(","),
      ...filteredTransactions.map(t => [t.id, t.amount, t.currency, t.credit_debit_indicator, t.status, t.booking_datetime, `"${t.transaction_information || ''}"`].join(","))
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `transactions-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">Monitor and manage all transaction activity</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          <Button variant="outline" size="sm" onClick={exportTransactions}><Download className="h-4 w-4 mr-2" />Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Transactions" value={totalCount.toLocaleString()} icon={<ArrowUpDown className="h-5 w-5" />} />
        <StatCard title="Total Volume" value={`${totalVolume.toLocaleString()} XAF`} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Credits" value={creditCount.toLocaleString()} icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search transactions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10" />
            </div>
            <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={v => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="credit">Credit</SelectItem>
                <SelectItem value="debit">Debit</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Transactions */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-4">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
          ) : filteredTransactions.length === 0 ? (
            <EmptyState icon={<ArrowUpDown className="h-6 w-6 text-muted-foreground" />} title="No transactions found" description="Adjust your filters or check back later" />
          ) : (
            <div className="divide-y">
              {filteredTransactions.map(transaction => (
                <div key={transaction.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => setSelectedTx(transaction)}>
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-full ${
                      transaction.credit_debit_indicator === "Credit" 
                        ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400" 
                        : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400"
                    }`}>
                      {transaction.credit_debit_indicator === "Credit" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{transaction.transaction_type || "Transaction"}</p>
                      <p className="text-xs text-muted-foreground">{transaction.transaction_information || "No description"}</p>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        {transaction.booking_datetime ? format(new Date(transaction.booking_datetime), "PPp") : "N/A"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold text-sm ${transaction.credit_debit_indicator === "Credit" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                      {transaction.credit_debit_indicator === "Credit" ? "+" : "-"}{transaction.amount.toLocaleString()} {transaction.currency}
                    </p>
                    <Badge variant={transaction.status === "completed" ? "default" : transaction.status === "pending" ? "secondary" : "destructive"} className="text-xs">
                      {transaction.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
          <DataTablePagination page={page} pageSize={pageSize} totalCount={totalCount} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
        </CardContent>
      </Card>

      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => !o && setSelectedTx(null)} transaction={selectedTx} />
    </div>
  );
}
