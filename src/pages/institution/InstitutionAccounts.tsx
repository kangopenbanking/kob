import { useState, useEffect } from "react";
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
import { RefreshCw, Wallet, TrendingUp, Plus, MoreHorizontal, Eye, Ban, Power, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { toast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function InstitutionAccounts() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<Record<string, any[]>>({});
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailAccount, setDetailAccount] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [txLoading, setTxLoading] = useState(false);
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
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
      const { data: accts } = await supabase.from("accounts").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
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

  const personalAccounts = accounts.filter(a => a.account_type === 'Personal');
  const businessAccounts = accounts.filter(a => a.account_type === 'Business');

  const resetForm = () => setForm({ account_holder_name: "", account_type: "Personal", account_subtype: "CurrentAccount", currency: "XAF", identification_value: "", nickname: "" });

  const handleCreate = async () => {
    if (!institutionId || !form.account_holder_name || !form.identification_value) return;
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const accountId = `ACC-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
      const { error } = await supabase.from("accounts").insert({
        institution_id: institutionId,
        user_id: user.id,
        account_holder_name: form.account_holder_name,
        account_type: form.account_type,
        account_subtype: form.account_subtype,
        currency: form.currency,
        account_id: accountId,
        identification_scheme: "LOCAL_BANK" as any,
        identification_value: form.identification_value,
        nickname: form.nickname || null,
        opened_date: new Date().toISOString().split('T')[0],
        is_active: true,
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
    setTellerAccount(account);
    setTellerOp(op);
    setTellerAmount('');
    setTellerDesc('');
    setTellerOpen(true);
  };

  const handleTellerTransaction = async () => {
    if (!tellerAccount || !tellerAmount || !institutionId) return;
    const amt = parseFloat(tellerAmount);
    if (isNaN(amt) || amt <= 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setTellerSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('teller-transaction', {
        body: {
          account_id: tellerAccount.id,
          amount: amt,
          operation: tellerOp,
          description: tellerDesc || undefined,
          institution_id: institutionId,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({
        title: `${tellerOp === 'deposit' ? 'Deposit' : 'Withdrawal'} Successful`,
        description: `${data.currency} ${amt.toLocaleString()} — New balance: ${data.balance_after?.toLocaleString()} ${data.currency}`,
      });
      setTellerOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Transaction failed", description: e.message, variant: "destructive" });
    } finally {
      setTellerSaving(false);
    }
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

  const AccountTable = ({ accts }: { accts: any[] }) => accts.length === 0 ? (
    <div className="text-center py-12 text-muted-foreground"><Wallet className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No accounts found</p></div>
  ) : (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="text-xs">Account Holder</TableHead><TableHead className="text-xs">Account ID</TableHead>
          <TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Currency</TableHead>
          <TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Status</TableHead>
          <TableHead className="text-xs">Opened</TableHead><TableHead className="text-xs w-10"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{accts.map(account => {
        const bal = getBalance(account.id);
        return (
          <TableRow key={account.id}>
            <TableCell className="font-medium text-sm">{account.account_holder_name}</TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">{account.account_id}</TableCell>
            <TableCell><Badge variant="outline" className="text-[10px]">{account.account_subtype || account.account_type}</Badge></TableCell>
            <TableCell className="text-sm">{account.currency}</TableCell>
            <TableCell className="text-sm font-medium">{bal !== null ? `${bal.toLocaleString()} ${account.currency}` : '--'}</TableCell>
            <TableCell><Badge variant={account.is_active ? "default" : "secondary"} className="text-[10px]">{account.is_active ? "Active" : "Frozen"}</Badge></TableCell>
            <TableCell className="text-xs text-muted-foreground">{account.opened_date ? format(new Date(account.opened_date), 'PP') : '--'}</TableCell>
            <TableCell>
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-blue/10 border border-fi-blue/20"><Wallet className="h-5 w-5 text-fi-blue" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Accounts</h1>
            <p className="text-xs text-muted-foreground">Manage institution accounts and balances</p>
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
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Accounts", value: accounts.length, icon: Wallet, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
          { label: "Active Accounts", value: accounts.filter(a => a.is_active).length, icon: TrendingUp, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Total Balance", value: `${totalBalance.toLocaleString()} XAF`, icon: Wallet, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-20" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="all" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="all" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">All ({accounts.length})</TabsTrigger>
          <TabsTrigger value="personal" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Personal ({personalAccounts.length})</TabsTrigger>
          <TabsTrigger value="business" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Business ({businessAccounts.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="all"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">All Accounts</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : <AccountTable accts={accounts} />}</CardContent></Card></TabsContent>
        <TabsContent value="personal"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Personal Accounts</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : <AccountTable accts={personalAccounts} />}</CardContent></Card></TabsContent>
        <TabsContent value="business"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Business Accounts</CardTitle></CardHeader><CardContent>{loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : <AccountTable accts={businessAccounts} />}</CardContent></Card></TabsContent>
      </Tabs>

      {/* Transaction Detail Dialog */}
      <Dialog open={!!detailAccount} onOpenChange={o => { if (!o) setDetailAccount(null); }}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>Transactions — {detailAccount?.account_holder_name}</DialogTitle></DialogHeader>
          {txLoading ? <div className="space-y-3 py-4">{[1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div> : transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">No transactions found for this account</div>
          ) : (
            <div className="max-h-[400px] overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs text-right">Amount</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
                <TableBody>{transactions.map(tx => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-xs">{tx.created_at ? format(new Date(tx.created_at), 'PP') : '--'}</TableCell>
                    <TableCell className="text-sm">{tx.description || tx.reference || '--'}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{tx.transaction_type || '--'}</Badge></TableCell>
                    <TableCell className="text-sm text-right font-medium">{Number(tx.amount || 0).toLocaleString()} {tx.currency || 'XAF'}</TableCell>
                    <TableCell><Badge variant={tx.status === 'completed' ? "default" : "outline"} className="text-[10px]">{tx.status || '--'}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Teller Deposit/Withdraw Dialog */}
      <Dialog open={tellerOpen} onOpenChange={o => { if (!o) setTellerOpen(false); }}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {tellerOp === 'deposit' ? <ArrowDownLeft className="h-5 w-5 text-emerald-600" /> : <ArrowUpRight className="h-5 w-5 text-red-500" />}
              {tellerOp === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
            </DialogTitle>
          </DialogHeader>
          {tellerAccount && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg border border-border p-3 bg-muted/50">
                <p className="text-sm font-medium">{tellerAccount.account_holder_name}</p>
                <p className="text-xs text-muted-foreground font-mono">{tellerAccount.account_id}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Current balance: <span className="font-semibold">{(getBalance(tellerAccount.id) ?? 0).toLocaleString()} {tellerAccount.currency}</span>
                </p>
              </div>
              <div className="space-y-2">
                <Label>Amount ({tellerAccount.currency}) *</Label>
                <Input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="0.00"
                  value={tellerAmount}
                  onChange={e => setTellerAmount(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label>Description (optional)</Label>
                <Textarea
                  placeholder={`Teller ${tellerOp} description...`}
                  value={tellerDesc}
                  onChange={e => setTellerDesc(e.target.value)}
                  rows={2}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setTellerOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleTellerTransaction}
                  disabled={tellerSaving || !tellerAmount || parseFloat(tellerAmount) <= 0}
                  className={tellerOp === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}
                >
                  {tellerSaving ? 'Processing...' : tellerOp === 'deposit' ? 'Confirm Deposit' : 'Confirm Withdrawal'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
