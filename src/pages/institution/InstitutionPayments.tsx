import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { CreditCard, Smartphone, Building2, RefreshCw, CheckCircle2, Clock, XCircle, Search, Download, DollarSign } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const statusBadge = (status: string) => {
  switch (status) {
    case 'completed': return <Badge variant="default" className="text-[10px]"><span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 bg-emerald-400" />Completed</Badge>;
    case 'pending': return <Badge variant="secondary" className="text-[10px]"><span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 bg-amber-400" />Pending</Badge>;
    case 'failed': return <Badge variant="destructive" className="text-[10px]"><span className="inline-block h-1.5 w-1.5 rounded-full mr-1.5 bg-red-400" />Failed</Badge>;
    default: return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
  }
};

export default function InstitutionPayments() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [mobileMoneyTx, setMobileMoneyTx] = useState<any[]>([]);
  const [cardTx, setCardTx] = useState<any[]>([]);
  const [bankTx, setBankTx] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [activeTab, setActiveTab] = useState("mobile-money");

  useEffect(() => { loadData(); }, [statusFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { instId = institution.id; }
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      let mmQuery = supabase.from("mobile_money_transactions").select("*").eq("facilitated_institution_id", instId).order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") mmQuery = mmQuery.eq("status", statusFilter);
      const { data: mm } = await mmQuery;
      setMobileMoneyTx(mm || []);

      let cardQuery = supabase.from("card_payment_transactions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") cardQuery = cardQuery.eq("status", statusFilter);
      const { data: cards } = await cardQuery;
      setCardTx(cards || []);

      let bankQuery = supabase.from("bank_transfer_transactions").select("*").eq("facilitated_institution_id", instId).order("created_at", { ascending: false }).limit(200);
      if (statusFilter !== "all") bankQuery = bankQuery.eq("status", statusFilter);
      const { data: bank } = await bankQuery;
      setBankTx(bank || []);
    } catch (error: any) {
      toast({ title: "Error loading payments", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const allTx = useMemo(() => [...mobileMoneyTx, ...cardTx, ...bankTx], [mobileMoneyTx, cardTx, bankTx]);
  const totalVolume = allTx.reduce((s, t) => s + Number(t.amount || 0), 0);
  const completedCount = allTx.filter(t => t.status === 'completed').length;
  const pendingCount = allTx.filter(t => t.status === 'pending').length;

  const currentData = useMemo(() => {
    let data: any[] = [];
    if (activeTab === 'mobile-money') data = mobileMoneyTx;
    else if (activeTab === 'cards') data = cardTx;
    else data = bankTx;
    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(t => t.transaction_ref?.toLowerCase().includes(q) || t.narration?.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q) || t.phone_number?.includes(q));
    }
    return data;
  }, [activeTab, mobileMoneyTx, cardTx, bankTx, search]);

  const paginatedData = useMemo(() => currentData.slice((page - 1) * pageSize, page * pageSize), [currentData, page, pageSize]);

  const exportCSV = () => {
    const headers = ["Ref", "Amount", "Currency", "Status", "Type", "Date"];
    const rows = currentData.map(t => [t.transaction_ref || t.id, t.amount, t.currency || 'XAF', t.status, t.transaction_type || '', t.created_at || '']);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `payments-${activeTab}-${format(new Date(), 'yyyy-MM-dd')}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const PaymentTable = ({ payments }: { payments: any[] }) => payments.length === 0 ? (
    <div className="text-center py-16 text-muted-foreground"><CreditCard className="h-12 w-12 mx-auto mb-4 opacity-20" /><p className="text-sm font-medium">No payments found</p></div>
  ) : (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-border/40">
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Reference</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Description</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Amount</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Date</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{payments.map(t => (
        <TableRow key={t.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => setSelectedTx(t)}>
          <TableCell className="font-mono text-xs text-muted-foreground">{(t.transaction_ref || t.id || '').slice(0, 16)}</TableCell>
          <TableCell className="text-sm">{t.narration || t.description || t.transaction_type || '—'}</TableCell>
          <TableCell className="text-sm font-semibold text-right tabular-nums">{Number(t.amount).toLocaleString()} {t.currency || 'XAF'}</TableCell>
          <TableCell>{statusBadge(t.status)}</TableCell>
          <TableCell className="text-xs text-muted-foreground">{t.created_at ? format(new Date(t.created_at), 'PP HH:mm') : '—'}</TableCell>
        </TableRow>
      ))}</TableBody>
    </Table>
  );

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><CreditCard className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Payments</h1>
            <p className="text-xs text-muted-foreground">Monitor Mobile Money, Cards & Bank Transfers</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Select value={statusFilter} onValueChange={v => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Volume" value={loading ? "..." : `${totalVolume.toLocaleString()} XAF`} icon={<DollarSign className="h-4 w-4" />} />
        <StatCard title="Mobile Money" value={loading ? "..." : mobileMoneyTx.length} icon={<Smartphone className="h-4 w-4" />} />
        <StatCard title="Completed" value={loading ? "..." : completedCount} icon={<CheckCircle2 className="h-4 w-4" />} />
        <StatCard title="Pending" value={loading ? "..." : pendingCount} icon={<Clock className="h-4 w-4" />} />
      </motion.div>

      {/* Search + Tabs */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search payments..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={v => { setActiveTab(v); setPage(1); }} className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="mobile-money" className="rounded-md px-3 text-xs font-medium">
              <Smartphone className="h-3.5 w-3.5 mr-1.5" />Mobile Money ({mobileMoneyTx.length})
            </TabsTrigger>
            <TabsTrigger value="cards" className="rounded-md px-3 text-xs font-medium">
              <CreditCard className="h-3.5 w-3.5 mr-1.5" />Cards ({cardTx.length})
            </TabsTrigger>
            <TabsTrigger value="bank" className="rounded-md px-3 text-xs font-medium">
              <Building2 className="h-3.5 w-3.5 mr-1.5" />Bank Transfers ({bankTx.length})
            </TabsTrigger>
          </TabsList>

          {['mobile-money', 'cards', 'bank'].map(tab => (
            <TabsContent key={tab} value={tab}>
              <Card className="border-border/60"><CardContent className="p-0">
                {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
                  <>
                    <PaymentTable payments={paginatedData} />
                    <DataTablePagination page={page} pageSize={pageSize} totalCount={currentData.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
                  </>
                )}
              </CardContent></Card>
            </TabsContent>
          ))}
        </Tabs>
      </motion.div>

      {/* Transaction Detail Sheet */}
      <TransactionDetailSheet open={!!selectedTx} onOpenChange={o => { if (!o) setSelectedTx(null); }} transaction={selectedTx} />
    </motion.div>
  );
}
