import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, PiggyBank, Percent, ArrowUpDown } from "lucide-react";
import { format } from "date-fns";

export default function InstitutionSavings() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [interestAccruals, setInterestAccruals] = useState<any[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      const { data: prods } = await supabase.from("savings_products").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setProducts(prods || []);
      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: accts } = await supabase.from("savings_accounts").select("*").in("product_id", productIds).order("created_at", { ascending: false });
        setSavingsAccounts(accts || []);
        const acctIds = (accts || []).map(a => a.id);
        if (acctIds.length > 0) {
          const { data: txns } = await supabase.from("savings_transactions").select("*").in("savings_account_id", acctIds).order("created_at", { ascending: false }).limit(100);
          setTransactions(txns || []);
          const { data: interest } = await supabase.from("interest_accruals").select("*").in("savings_account_id", acctIds).order("accrual_date", { ascending: false }).limit(100);
          setInterestAccruals(interest || []);
        }
      }
    } catch (error) { console.error("Error loading savings:", error); }
    finally { setLoading(false); }
  };

  const totalBalance = savingsAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-fi-green/10 border border-fi-green/20"><PiggyBank className="h-5 w-5 text-fi-green" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Savings</h1>
            <p className="text-xs text-muted-foreground">Manage savings products, accounts, and interest</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Products", value: products.length, icon: PiggyBank, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Accounts", value: savingsAccounts.length, icon: PiggyBank, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
          { label: "Total Balance", value: `${totalBalance.toLocaleString()} XAF`, icon: ArrowUpDown, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
          { label: "Interest Accruals", value: interestAccruals.length, icon: Percent, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1">
          <TabsTrigger value="products" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Products</TabsTrigger>
          <TabsTrigger value="accounts" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Accounts</TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Transactions</TabsTrigger>
          <TabsTrigger value="interest" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm">Interest</TabsTrigger>
        </TabsList>

        <TabsContent value="products"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Savings Products</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : products.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No savings products</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Product</TableHead><TableHead className="text-xs">Code</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Interest Rate</TableHead><TableHead className="text-xs">Min Opening</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{products.map(p => (<TableRow key={p.id}><TableCell className="font-medium text-sm">{p.product_name}</TableCell><TableCell className="font-mono text-xs text-muted-foreground">{p.product_code}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{p.savings_type}</Badge></TableCell><TableCell className="text-sm">{p.base_interest_rate}%</TableCell><TableCell className="text-sm">{Number(p.min_opening_balance).toLocaleString()} XAF</TableCell><TableCell><Badge variant={p.is_active ? "default" : "secondary"} className="text-[10px]">{p.is_active ? "Active" : "Inactive"}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="accounts"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Savings Accounts</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : savingsAccounts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><PiggyBank className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No savings accounts</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Account</TableHead><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Balance</TableHead><TableHead className="text-xs">Interest Rate</TableHead><TableHead className="text-xs">Interest Earned</TableHead><TableHead className="text-xs">Status</TableHead></TableRow></TableHeader>
              <TableBody>{savingsAccounts.map(a => (<TableRow key={a.id}><TableCell className="font-medium text-sm">{a.account_name || a.account_id}</TableCell><TableCell><Badge variant="outline" className="text-[10px]">{a.savings_type}</Badge></TableCell><TableCell className="text-sm">{Number(a.current_balance).toLocaleString()} XAF</TableCell><TableCell className="text-sm">{a.current_interest_rate}%</TableCell><TableCell className="text-sm">{Number(a.total_interest_earned).toLocaleString()} XAF</TableCell><TableCell><Badge variant={a.status === 'active' ? "default" : "secondary"} className="text-[10px]">{a.status}</Badge></TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="transactions"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Recent Transactions</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : transactions.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><ArrowUpDown className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No transactions</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Type</TableHead><TableHead className="text-xs">Amount</TableHead><TableHead className="text-xs">Balance After</TableHead><TableHead className="text-xs">Description</TableHead><TableHead className="text-xs">Date</TableHead></TableRow></TableHeader>
              <TableBody>{transactions.map(t => (<TableRow key={t.id}><TableCell><Badge variant={t.transaction_type === 'deposit' ? "default" : "outline"} className="text-[10px]">{t.transaction_type}</Badge></TableCell><TableCell className="font-medium text-sm">{Number(t.amount).toLocaleString()} XAF</TableCell><TableCell className="text-sm">{Number(t.balance_after).toLocaleString()} XAF</TableCell><TableCell className="max-w-[200px] truncate text-sm">{t.description || '--'}</TableCell><TableCell className="text-xs text-muted-foreground">{t.created_at ? format(new Date(t.created_at), 'PP') : '--'}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>

        <TabsContent value="interest"><Card className="border-border/60"><CardHeader><CardTitle className="text-sm font-semibold">Interest Accruals</CardTitle></CardHeader><CardContent>
          {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : interestAccruals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground"><Percent className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No interest accruals</p></div>
          ) : (
            <Table><TableHeader><TableRow className="hover:bg-transparent"><TableHead className="text-xs">Date</TableHead><TableHead className="text-xs">Rate</TableHead><TableHead className="text-xs">Accrued</TableHead><TableHead className="text-xs">Balance Before</TableHead><TableHead className="text-xs">Balance After</TableHead></TableRow></TableHeader>
              <TableBody>{interestAccruals.map(i => (<TableRow key={i.id}><TableCell className="text-sm">{format(new Date(i.accrual_date), 'PP')}</TableCell><TableCell className="text-sm">{i.interest_rate}%</TableCell><TableCell className="font-medium text-sm">{Number(i.accrued_amount).toLocaleString()} XAF</TableCell><TableCell className="text-sm">{Number(i.balance_before).toLocaleString()}</TableCell><TableCell className="text-sm">{Number(i.balance_after).toLocaleString()}</TableCell></TableRow>))}</TableBody></Table>
          )}
        </CardContent></Card></TabsContent>
      </Tabs>
    </div>
  );
}
