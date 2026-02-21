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
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      const { data: prods } = await supabase
        .from("savings_products").select("*").eq("institution_id", institution.id).order("created_at", { ascending: false });
      setProducts(prods || []);

      const productIds = (prods || []).map(p => p.id);
      if (productIds.length > 0) {
        const { data: accts } = await supabase
          .from("savings_accounts").select("*").in("product_id", productIds).order("created_at", { ascending: false });
        setSavingsAccounts(accts || []);

        const acctIds = (accts || []).map(a => a.id);
        if (acctIds.length > 0) {
          const { data: txns } = await supabase
            .from("savings_transactions").select("*").in("savings_account_id", acctIds).order("created_at", { ascending: false }).limit(100);
          setTransactions(txns || []);

          const { data: interest } = await supabase
            .from("interest_accruals").select("*").in("savings_account_id", acctIds).order("accrual_date", { ascending: false }).limit(100);
          setInterestAccruals(interest || []);
        }
      }
    } catch (error) {
      console.error("Error loading savings:", error);
    } finally { setLoading(false); }
  };

  const totalBalance = savingsAccounts.reduce((sum, a) => sum + Number(a.current_balance || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings</h1>
          <p className="text-muted-foreground">Manage savings products, accounts, and interest</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Products</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : products.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Accounts</CardTitle><PiggyBank className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : savingsAccounts.length}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total Balance</CardTitle><ArrowUpDown className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : `${totalBalance.toLocaleString()} XAF`}</div></CardContent></Card>
        <Card><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Interest Accruals</CardTitle><Percent className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : interestAccruals.length}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="interest">Interest</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <Card><CardHeader><CardTitle>Savings Products</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No savings products</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Product</TableHead><TableHead>Code</TableHead><TableHead>Type</TableHead><TableHead>Interest Rate</TableHead><TableHead>Min Opening</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{products.map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.product_name}</TableCell>
                    <TableCell className="font-mono text-xs">{p.product_code}</TableCell>
                    <TableCell><Badge variant="outline">{p.savings_type}</Badge></TableCell>
                    <TableCell>{p.base_interest_rate}%</TableCell>
                    <TableCell>{Number(p.min_opening_balance).toLocaleString()} XAF</TableCell>
                    <TableCell><Badge variant={p.is_active ? "default" : "secondary"}>{p.is_active ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card><CardHeader><CardTitle>Savings Accounts</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : savingsAccounts.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><PiggyBank className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No savings accounts</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Account</TableHead><TableHead>Type</TableHead><TableHead>Balance</TableHead><TableHead>Interest Rate</TableHead><TableHead>Interest Earned</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                <TableBody>{savingsAccounts.map(a => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.account_name || a.account_id}</TableCell>
                    <TableCell><Badge variant="outline">{a.savings_type}</Badge></TableCell>
                    <TableCell>{Number(a.current_balance).toLocaleString()} XAF</TableCell>
                    <TableCell>{a.current_interest_rate}%</TableCell>
                    <TableCell>{Number(a.total_interest_earned).toLocaleString()} XAF</TableCell>
                    <TableCell><Badge variant={a.status === 'active' ? "default" : "secondary"}>{a.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="transactions">
          <Card><CardHeader><CardTitle>Recent Transactions</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : transactions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><ArrowUpDown className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No transactions</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Type</TableHead><TableHead>Amount</TableHead><TableHead>Balance After</TableHead><TableHead>Description</TableHead><TableHead>Date</TableHead></TableRow></TableHeader>
                <TableBody>{transactions.map(t => (
                  <TableRow key={t.id}>
                    <TableCell><Badge variant={t.transaction_type === 'deposit' ? "default" : "outline"}>{t.transaction_type}</Badge></TableCell>
                    <TableCell className="font-medium">{Number(t.amount).toLocaleString()} XAF</TableCell>
                    <TableCell>{Number(t.balance_after).toLocaleString()} XAF</TableCell>
                    <TableCell className="max-w-[200px] truncate">{t.description || '—'}</TableCell>
                    <TableCell>{t.created_at ? format(new Date(t.created_at), 'PP') : '—'}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="interest">
          <Card><CardHeader><CardTitle>Interest Accruals</CardTitle></CardHeader><CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div> : interestAccruals.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground"><Percent className="h-12 w-12 mx-auto mb-4 opacity-50" /><p>No interest accruals</p></div>
            ) : (
              <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Rate</TableHead><TableHead>Accrued</TableHead><TableHead>Balance Before</TableHead><TableHead>Balance After</TableHead></TableRow></TableHeader>
                <TableBody>{interestAccruals.map(i => (
                  <TableRow key={i.id}>
                    <TableCell>{format(new Date(i.accrual_date), 'PP')}</TableCell>
                    <TableCell>{i.interest_rate}%</TableCell>
                    <TableCell className="font-medium">{Number(i.accrued_amount).toLocaleString()} XAF</TableCell>
                    <TableCell>{Number(i.balance_before).toLocaleString()}</TableCell>
                    <TableCell>{Number(i.balance_after).toLocaleString()}</TableCell>
                  </TableRow>
                ))}</TableBody></Table>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
