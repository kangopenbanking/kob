import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { TransactionDetailSheet } from "@/components/ui/transaction-detail-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { PinConfirmDialog } from "@/components/pwa/PinConfirmDialog";
import { Loader2, Download, Search, Banknote, Clock, CheckCircle2, ArrowUpRight, Building2, Smartphone, Globe, CreditCard, Wallet, Check, AlertCircle } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { PayoutSchedule } from "@/components/merchant/PayoutSchedule";

export default function MerchantPayouts() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedTx, setSelectedTx] = useState<any>(null);
  const [merchantId, setMerchantId] = useState<string | null>(null);

  // Withdrawal dialog state
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [settlementAccounts, setSettlementAccounts] = useState<any[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [withdrawLoading, setWithdrawLoading] = useState(false);
  const [pinDialog, setPinDialog] = useState<{ open: boolean; amount: number; accountId: string }>({ open: false, amount: 0, accountId: '' });

  useEffect(() => { loadData(); }, [page, pageSize]);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const from = (page - 1) * pageSize;
      const { data, count } = await supabase.from("gateway_payouts").select("*", { count: "exact" }).eq("merchant_id", m.id).order("created_at", { ascending: false }).range(from, from + pageSize - 1);
      setPayouts(data || []);
      setTotalCount(count || 0);

      // Load settlement accounts
      const { data: accounts } = await supabase
        .from("gateway_merchant_settlement_accounts")
        .select("*")
        .eq("merchant_id", m.id)
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      setSettlementAccounts((accounts || []).slice(0, 2));

      // Load wallet balance
      const { data: wallet } = await supabase
        .from("gateway_merchant_wallets")
        .select("available_balance")
        .eq("merchant_id", m.id)
        .eq("currency", "XAF")
        .maybeSingle();
      setWalletBalance(wallet?.available_balance || 0);
    }
    setLoading(false);
  };

  const filtered = payouts.filter(p => {
    if (search && !p.tx_ref?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== "all" && p.status !== statusFilter) return false;
    return true;
  });

  const statuses = [...new Set(payouts.map(p => p.status).filter(Boolean))];
  const totalAmount = filtered.reduce((s, p) => s + Number(p.amount || 0), 0);
  const completedAmount = filtered.filter(p => p.status === "completed").reduce((s, p) => s + Number(p.amount || 0), 0);
  const pendingCount = filtered.filter(p => ["pending", "processing", "pending_approval"].includes(p.status)).length;

  const formatXAF = (n: number) => new Intl.NumberFormat('fr-CM', { style: 'currency', currency: 'XAF', minimumFractionDigits: 0 }).format(n);
  const numAmount = Number(withdrawAmount) || 0;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'mobile_money': return Smartphone;
      case 'paypal': return Globe;
      case 'card': return CreditCard;
      case 'kob_wallet': return Wallet;
      default: return Building2;
    }
  };

  const getAccountLabel = (type: string) => {
    switch (type) {
      case 'bank_transfer': return 'Bank Transfer';
      case 'mobile_money': return 'Mobile Money';
      case 'paypal': return 'PayPal';
      case 'card': return 'Card';
      case 'kob_wallet': return 'Kang Wallet';
      case 'rtgs': return 'RTGS / Wire';
      default: return type;
    }
  };

  const getAccountSummary = (a: any) => {
    const meta = (a.metadata as any) || {};
    switch (a.account_type) {
      case 'mobile_money': return a.phone_number || '';
      case 'paypal': return meta.paypal_email || '';
      case 'card': return `•••• ${meta.card_last4 || ''}`;
      case 'kob_wallet': return a.account_name || 'Consumer Wallet';
      default: return a.account_number ? `****${a.account_number.slice(-4)}` : '';
    }
  };

  const openWithdraw = () => {
    setWithdrawAmount("");
    setSelectedAccountId(settlementAccounts.find(a => a.is_default)?.id || settlementAccounts[0]?.id || null);
    setWithdrawOpen(true);
  };

  const handleWithdrawSubmit = () => {
    if (numAmount < 1000) { toast.error("Minimum withdrawal is 1,000 XAF"); return; }
    if (numAmount > walletBalance) { toast.error("Insufficient balance"); return; }
    if (!selectedAccountId) { toast.error("Select a withdrawal account"); return; }
    setPinDialog({ open: true, amount: numAmount, accountId: selectedAccountId });
  };

  const handlePinConfirmed = async (pin: string) => {
    setWithdrawLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-request-payout", {
        body: {
          merchant_id: merchantId,
          amount: pinDialog.amount,
          currency: "XAF",
          settlement_account_id: pinDialog.accountId,
          pin,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const isInstant = data?.transfer_type === "instant";
      toast.success(isInstant ? "Funds transferred to your Kang wallet instantly!" : "Withdrawal request submitted");
      setWithdrawOpen(false);
      loadData();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Withdrawal failed"));
    } finally {
      setWithdrawLoading(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Reference", "Amount", "Currency", "Status", "Channel", "Date"];
    const rows = filtered.map(p => [p.tx_ref, p.amount, p.currency, p.status, p.channel, p.created_at]);
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
        <div className="flex gap-2">
          <Button size="sm" className="gap-2" onClick={openWithdraw} disabled={walletBalance < 1000 || settlementAccounts.length === 0}>
            <ArrowUpRight className="h-4 w-4" />New Withdrawal
          </Button>
          <Button variant="outline" size="sm" onClick={exportCSV} className="gap-2"><Download className="h-4 w-4" />Export</Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Total Payouts" value={formatXAF(totalAmount)} icon={<Banknote className="h-5 w-5" />} />
        <StatCard title="Completed" value={formatXAF(completedAmount)} icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard title="Pending" value={String(pendingCount)} icon={<Clock className="h-5 w-5" />} />
      </div>

      {/* Payout Schedule */}
      <PayoutSchedule />


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
            <EmptyState icon={<Banknote className="h-6 w-6 text-muted-foreground" />} title="No payouts found" description="Payouts will appear here once settlements are processed" action={{ label: "Add Settlement Account", onClick: () => window.location.href = "/merchant/settlement-accounts" }} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50"><th className="text-left py-3 px-4">Reference</th><th className="text-left py-3 px-4">Amount</th><th className="text-left py-3 px-4">Status</th><th className="text-left py-3 px-4">Channel</th><th className="text-left py-3 px-4">Date</th></tr></thead>
                <tbody>
                  {filtered.map(p => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedTx(p)}>
                      <td className="py-3 px-4 font-mono text-xs">{p.tx_ref}</td>
                      <td className="py-3 px-4 font-medium">{Number(p.amount).toLocaleString()} {p.currency}</td>
                      <td className="py-3 px-4"><Badge variant={p.status === "completed" ? "default" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge></td>
                      <td className="py-3 px-4">{p.channel}</td>
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

      {/* ============ Withdrawal Dialog ============ */}
      <Dialog open={withdrawOpen} onOpenChange={setWithdrawOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Withdrawal</DialogTitle>
            <DialogDescription>
              Available balance: <span className="font-semibold text-foreground">{formatXAF(walletBalance)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Amount (XAF)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">XAF</span>
                <Input type="number" placeholder="0" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} min={1000} className="pl-14 text-lg font-semibold h-12" />
              </div>
              <div className="flex gap-2">
                {[10000, 25000, 50000].map(p => (
                  <button key={p} type="button" onClick={() => setWithdrawAmount(String(p))} className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium border transition-colors",
                    numAmount === p ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:border-primary/40"
                  )}>
                    {formatXAF(p)}
                  </button>
                ))}
                <button type="button" onClick={() => setWithdrawAmount(String(walletBalance))} className="rounded-full px-3 py-1 text-xs font-medium border border-border bg-card text-muted-foreground hover:border-primary/40">
                  Max
                </button>
              </div>
            </div>

            {/* Account Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Withdraw To</Label>
              {settlementAccounts.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/60 p-4 text-center">
                  <AlertCircle className="h-5 w-5 text-muted-foreground/40 mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">No settlement accounts configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {settlementAccounts.map(a => {
                    const Icon = getAccountIcon(a.account_type);
                    const selected = selectedAccountId === a.id;
                    return (
                      <button key={a.id} type="button" onClick={() => setSelectedAccountId(a.id)} className={cn(
                        "w-full flex items-center gap-3 rounded-xl border p-3 text-left transition-all",
                        selected ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "border-border/40 hover:border-primary/30",
                      )}>
                        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", selected ? "bg-primary text-primary-foreground" : "bg-muted")}>
                          <Icon className="h-4 w-4" strokeWidth={1.8} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{a.account_name || a.bank_name}</p>
                          <p className="text-xs text-muted-foreground">{getAccountLabel(a.account_type)} · {getAccountSummary(a)}</p>
                        </div>
                        {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                        {a.account_type === 'kob_wallet' && <Badge variant="secondary" className="text-[9px] shrink-0">Instant</Badge>}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <Button onClick={handleWithdrawSubmit} disabled={numAmount < 1000 || numAmount > walletBalance || !selectedAccountId || withdrawLoading} className="w-full h-11 gap-2">
              {withdrawLoading ? <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</> : <>Withdraw {numAmount > 0 ? formatXAF(numAmount) : ''}</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <PinConfirmDialog
        open={pinDialog.open}
        onOpenChange={(open) => setPinDialog({ ...pinDialog, open })}
        onConfirmed={handlePinConfirmed}
        title="Confirm Withdrawal"
        description={`Enter your PIN to withdraw ${formatXAF(pinDialog.amount)}`}
      />
    </div>
  );
}
