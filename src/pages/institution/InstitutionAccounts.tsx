import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { StatCard } from "@/components/ui/stat-card";
import { RefreshCw, Wallet, TrendingUp, Plus, MoreHorizontal, Eye, Ban, Power, ArrowDownLeft, ArrowUpRight, Search, Download, Users } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { motion } from "framer-motion";
import { useStaffPermissions } from "@/hooks/useStaffPermissions";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function InstitutionAccounts() {
  const navigate = useNavigate();
  const { isOwner, isStaff } = useStaffPermissions();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, any[]>>({});
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Detail sheet
  const [detailAccount, setDetailAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);

  // Teller
  const [tellerOpen, setTellerOpen] = useState(false);
  const [tellerAccount, setTellerAccount] = useState<any>(null);
  const [tellerOp, setTellerOp] = useState<'deposit' | 'withdraw'>('deposit');
  const [tellerAmount, setTellerAmount] = useState('');
  const [tellerDesc, setTellerDesc] = useState('');
  const [tellerSaving, setTellerSaving] = useState(false);

  const [form, setForm] = useState({
    account_holder_name: "", account_type: "Personal" as "Personal" | "Business",
    account_subtype: "CurrentAccount" as any, currency: "XAF",
    identification_value: "", nickname: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Resolve institution_id for owners or staff
      let instId: string | null = null;
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { instId = institution.id; }
      else {
        const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
        if (staffInst) instId = staffInst;
      }
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const { data: accts } = await supabase.from("accounts").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      setAccounts(accts || []);
      if (accts && accts.length > 0) {
        const { data: bals } = await supabase.from("account_balances").select("*").in("account_id", accts.map(a => a.id));
        const grouped: Record<string, any[]> = {};
        (bals || []).forEach(b => { if (!grouped[b.account_id]) grouped[b.account_id] = []; grouped[b.account_id].push(b); });
        setBalances(grouped);
      }
    } catch (error) { console.error("Error loading accounts:", error); }
    finally { setLoading(false); }
  };

  const getBalance = (accountId: string) => {
    const bals = balances[accountId] || [];
    const avail = bals.find(b => b.balance_type === 'ClosingAvailable' || b.balance_type === 'InterimAvailable');
    return avail ? Number(avail.amount) : null;
  };

  const totalBalance = Object.values(balances).flat()
    .filter(b => b.balance_type === 'ClosingAvailable' || b.balance_type === 'InterimAvailable')
    .reduce((sum, b) => sum + Number(b.amount || 0), 0);

  const activeAccounts = accounts.filter(a => a.is_active);
  const frozenAccounts = accounts.filter(a => !a.is_active);
  const personalAccounts = accounts.filter(a => a.account_type === 'Personal');
  const businessAccounts = accounts.filter(a => a.account_type === 'Business');

  const filtered = useMemo(() => {
    if (!search.trim()) return accounts;
    const q = search.toLowerCase();
    return accounts.filter(a => a.account_holder_name?.toLowerCase().includes(q) || a.account_id?.toLowerCase().includes(q) || a.nickname?.toLowerCase().includes(q));
  }, [accounts, search]);

  const paginated = useMemo(() => filtered.slice((page - 1) * pageSize, page * pageSize), [filtered, page, pageSize]);

  const resetForm = () => setForm({ account_holder_name: "", account_type: "Personal", account_subtype: "CurrentAccount", currency: "XAF", identification_value: "", nickname: "" });

  const handleCreate = async () => {
    if (!institutionId || !form.account_holder_name || !form.identification_value) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const accountId = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const { error } = await supabase.from("accounts").insert({
        institution_id: institutionId, user_id: user.id,
        account_holder_name: form.account_holder_name, account_type: form.account_type,
        account_subtype: form.account_subtype, currency: form.currency,
        account_id: accountId, identification_scheme: "LOCAL_BANK" as any,
        identification_value: form.identification_value, nickname: form.nickname || null,
        opened_date: new Date().toISOString().split('T')[0], is_active: true,
      });
      if (error) throw error;
      toast({ title: "Account opened successfully" });
      setCreateOpen(false);
      resetForm();
      loadData();
    } catch (e: any) { toast({ title: "Error opening account", description: e.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const toggleActive = async (account: any) => {
    try {
      const { error } = await supabase.from("accounts").update({ is_active: !account.is_active }).eq("id", account.id);
      if (error) throw error;
      toast({ title: `Account ${account.is_active ? "frozen" : "activated"}` });
      loadData();
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const openTellerOp = (account: any, op: 'deposit' | 'withdraw') => {
    setTellerAccount(account); setTellerOp(op); setTellerAmount(''); setTellerDesc(''); setTellerOpen(true);
  };

  const handleTellerTransaction = async () => {
    if (!tellerAccount || !tellerAmount || !institutionId) return;
    const amt = parseFloat(tellerAmount);
    if (isNaN(amt) || amt <= 0) { toast({ title: "Invalid amount", variant: "destructive" }); return; }
    setTellerSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('teller-transaction', {
        body: { account_id: tellerAccount.id, amount: amt, operation: tellerOp, description: tellerDesc || undefined, institution_id: institutionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Handle approval-required response from withdrawal policy engine
      if (data?.requires_approval) {
        toast({
          title: "Approval Required",
          description: data.message || `This withdrawal of ${amt.toLocaleString()} requires manager approval. Request ID: ${data.withdrawal_request_id?.substring(0, 8) || 'pending'}`,
        });
        setTellerOpen(false);
        return;
      }

      toast({ title: `${tellerOp === 'deposit' ? 'Deposit' : 'Withdrawal'} Successful`, description: `${data.currency} ${amt.toLocaleString()} — New balance: ${data.balance_after?.toLocaleString()} ${data.currency}` });
      setTellerOpen(false);
      loadData();
    } catch (e: any) { toast({ title: "Transaction failed", description: e.message, variant: "destructive" }); }
    finally { setTellerSaving(false); }
  };

  const viewTransactions = async (account: any) => {
    setDetailAccount(account);
    setTxLoading(true);
    try {
      const { data } = await supabase.from("transactions").select("*").eq("account_id", account.id).order("created_at", { ascending: false }).limit(50);
      setTransactions(data || []);
    } catch { setTransactions([]); }
    finally { setTxLoading(false); }
  };

  const exportCSV = () => {
    const headers = ["Account Holder", "Account ID", "Type", "Subtype", "Currency", "Balance", "Status", "Opened"];
    const rows = filtered.map(a => [a.account_holder_name, a.account_id, a.account_type, a.account_subtype, a.currency, getBalance(a.id) ?? '', a.is_active ? 'Active' : 'Frozen', a.opened_date || '']);
    const csv = [headers, ...rows].map(r => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.download = `accounts-${format(new Date(), 'yyyy-MM-dd')}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  const AccountTable = ({ accts }: { accts: any[] }) => accts.length === 0 ? (
    <div className="text-center py-16 text-muted-foreground">
      <Wallet className="h-12 w-12 mx-auto mb-4 opacity-20" />
      <p className="text-sm font-medium">No accounts found</p>
      <p className="text-xs mt-1">Adjust your search or create a new account</p>
    </div>
  ) : (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent border-border/40">
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account Holder</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Account ID</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Type</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Currency</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground text-right">Balance</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
          <TableHead className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Opened</TableHead>
          <TableHead className="w-10" />
        </TableRow>
      </TableHeader>
      <TableBody>{accts.map(account => {
        const bal = getBalance(account.id);
        return (
          <TableRow key={account.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => viewTransactions(account)}>
            <TableCell className="font-medium text-sm">{account.account_holder_name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{account.account_id}</TableCell>
            <TableCell><Badge variant="outline" className="text-[10px] font-medium">{account.account_subtype || account.account_type}</Badge></TableCell>
            <TableCell className="text-sm font-medium">{account.currency}</TableCell>
            <TableCell className="text-sm font-semibold text-right tabular-nums">{bal !== null ? `${bal.toLocaleString()}` : '—'}</TableCell>
            <TableCell>
              <Badge variant={account.is_active ? "default" : "secondary"} className="text-[10px]">
                <span className={`inline-block h-1.5 w-1.5 rounded-full mr-1.5 ${account.is_active ? 'bg-emerald-400' : 'bg-muted-foreground/50'}`} />
                {account.is_active ? "Active" : "Frozen"}
              </Badge>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">{account.opened_date ? format(new Date(account.opened_date), 'PP') : '—'}</TableCell>
            <TableCell onClick={e => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => viewTransactions(account)}><Eye className="h-3.5 w-3.5 mr-2" />View Transactions</DropdownMenuItem>
                  {account.is_active && (
                    <>
                      <DropdownMenuItem onClick={() => openTellerOp(account, 'deposit')}><ArrowDownLeft className="h-3.5 w-3.5 mr-2" />Deposit</DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openTellerOp(account, 'withdraw')}><ArrowUpRight className="h-3.5 w-3.5 mr-2" />Withdraw</DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem onClick={() => toggleActive(account)}>{account.is_active ? <><Ban className="h-3.5 w-3.5 mr-2" />Freeze</> : <><Power className="h-3.5 w-3.5 mr-2" />Activate</>}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        );
      })}</TableBody>
    </Table>
  );

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Accounts</h1>
            <p className="text-xs text-muted-foreground">Manage institution accounts, balances & teller operations</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={createOpen} onOpenChange={o => { setCreateOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Open Account</Button></DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader><DialogTitle>Open New Account</DialogTitle></DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2"><Label>Account Holder Name *</Label><Input value={form.account_holder_name} onChange={e => setForm(f => ({ ...f, account_holder_name: e.target.value }))} placeholder="John Doe" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Account Type</Label>
                    <Select value={form.account_type} onValueChange={v => setForm(f => ({ ...f, account_type: v as any }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Personal">Personal</SelectItem><SelectItem value="Business">Business</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Sub-Type</Label>
                    <Select value={form.account_subtype} onValueChange={v => setForm(f => ({ ...f, account_subtype: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="CurrentAccount">Current Account</SelectItem><SelectItem value="Savings">Savings</SelectItem><SelectItem value="Loan">Loan</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>Currency</Label>
                    <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="XAF">XAF</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2"><Label>Identification *</Label><Input value={form.identification_value} onChange={e => setForm(f => ({ ...f, identification_value: e.target.value }))} placeholder="National ID / Passport" /></div>
                </div>
                <div className="space-y-2"><Label>Nickname</Label><Input value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} placeholder="Optional nickname" /></div>
                <DialogFooter><Button onClick={handleCreate} disabled={saving || !form.account_holder_name || !form.identification_value}>{saving ? "Opening..." : "Open Account"}</Button></DialogFooter>
              </div>
            </DialogContent>
          </Dialog>
          <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5 mr-1.5" />Export</Button>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div custom={1} variants={fadeUp} className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <StatCard title="Total Accounts" value={loading ? "..." : accounts.length} icon={<Wallet className="h-4 w-4" />} />
        <StatCard title="Active Accounts" value={loading ? "..." : activeAccounts.length} icon={<TrendingUp className="h-4 w-4" />} />
        <StatCard title="Frozen Accounts" value={loading ? "..." : frozenAccounts.length} icon={<Ban className="h-4 w-4" />} />
        <StatCard title="Total Balance" value={loading ? "..." : `${totalBalance.toLocaleString()} XAF`} icon={<Users className="h-4 w-4" />} />
      </motion.div>

      {/* Search + Tabs */}
      <motion.div custom={2} variants={fadeUp}>
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Search accounts..." className="pl-9 h-9 text-sm" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
          </div>
        </div>

        <Tabs defaultValue="all" className="space-y-4">
          <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
            <TabsTrigger value="all" className="rounded-md px-3 text-xs font-medium">All ({accounts.length})</TabsTrigger>
            <TabsTrigger value="personal" className="rounded-md px-3 text-xs font-medium">Personal ({personalAccounts.length})</TabsTrigger>
            <TabsTrigger value="business" className="rounded-md px-3 text-xs font-medium">Business ({businessAccounts.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Card className="border-border/60">
              <CardContent className="p-0">
                {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : (
                  <>
                    <AccountTable accts={paginated} />
                    <DataTablePagination page={page} pageSize={pageSize} totalCount={filtered.length} onPageChange={setPage} onPageSizeChange={s => { setPageSize(s); setPage(1); }} />
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="personal">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : <AccountTable accts={personalAccounts.filter(a => !search || a.account_holder_name?.toLowerCase().includes(search.toLowerCase()))} />}
            </CardContent></Card>
          </TabsContent>
          <TabsContent value="business">
            <Card className="border-border/60"><CardContent className="p-0">
              {loading ? <div className="space-y-3 p-6">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : <AccountTable accts={businessAccounts.filter(a => !search || a.account_holder_name?.toLowerCase().includes(search.toLowerCase()))} />}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Account Detail Sheet */}
      <Sheet open={!!detailAccount} onOpenChange={o => { if (!o) setDetailAccount(null); }}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2"><Wallet className="h-5 w-5 text-primary" />Account Details</SheetTitle>
          </SheetHeader>
          {detailAccount && (
            <div className="mt-6 space-y-4">
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                <p className="text-lg font-bold">{detailAccount.account_holder_name}</p>
                <p className="font-mono text-xs text-muted-foreground">{detailAccount.account_id}</p>
                <div className="flex items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-[10px]">{detailAccount.account_subtype}</Badge>
                  <Badge variant={detailAccount.is_active ? "default" : "secondary"} className="text-[10px]">{detailAccount.is_active ? "Active" : "Frozen"}</Badge>
                </div>
              </div>
              <div className="flex justify-between items-center py-2">
                <span className="text-sm text-muted-foreground">Balance</span>
                <span className="text-xl font-bold tabular-nums">{(getBalance(detailAccount.id) ?? 0).toLocaleString()} {detailAccount.currency}</span>
              </div>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-3">Recent Transactions</p>
                {txLoading ? <div className="space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : transactions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No transactions found</p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-auto">
                    {transactions.map(tx => (
                      <div key={tx.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                        <div>
                          <p className="text-sm font-medium">{tx.description || tx.reference || '—'}</p>
                          <p className="text-xs text-muted-foreground">{tx.created_at ? format(new Date(tx.created_at), 'PP HH:mm') : '—'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold tabular-nums">{Number(tx.amount || 0).toLocaleString()} {tx.currency || 'XAF'}</p>
                          <Badge variant={tx.status === 'completed' ? "default" : "outline"} className="text-[10px]">{tx.status || '—'}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {detailAccount.is_active && (
                <>
                  <Separator />
                  <div className="flex gap-2">
                    <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { setDetailAccount(null); openTellerOp(detailAccount, 'deposit'); }}>
                      <ArrowDownLeft className="h-3.5 w-3.5 mr-1.5" />Deposit
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => { setDetailAccount(null); openTellerOp(detailAccount, 'withdraw'); }}>
                      <ArrowUpRight className="h-3.5 w-3.5 mr-1.5" />Withdraw
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Teller Dialog */}
      <Dialog open={tellerOpen} onOpenChange={o => { if (!o) setTellerOpen(false); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tellerOp === 'deposit' ? <ArrowDownLeft className="h-5 w-5 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 text-destructive" />}
              {tellerOp === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </DialogTitle>
          </DialogHeader>
          {tellerAccount && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border p-3 bg-muted/50">
                <p className="text-sm font-medium">{tellerAccount.account_holder_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{tellerAccount.account_id}</p>
                <p className="text-xs text-muted-foreground mt-1">Current balance: <span className="font-semibold">{(getBalance(tellerAccount.id) ?? 0).toLocaleString()} {tellerAccount.currency}</span></p>
              </div>
              <div className="space-y-2">
                <Label>Amount ({tellerAccount.currency}) *</Label>
                <Input type="number" min="1" step="any" placeholder="0.00" value={tellerAmount} onChange={e => setTellerAmount(e.target.value)} autoFocus />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea placeholder={`Teller ${tellerOp} description...`} value={tellerDesc} onChange={e => setTellerDesc(e.target.value)} rows={2} />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTellerOpen(false)}>Cancel</Button>
                <Button onClick={handleTellerTransaction} disabled={tellerSaving || !tellerAmount || parseFloat(tellerAmount) <= 0}
                  className={tellerOp === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-destructive hover:bg-destructive/90'}>
                  {tellerSaving ? 'Processing...' : tellerOp === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
