import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  PiggyBank, 
  TrendingUp,
  Target,
  Plus,
  Eye,
  EyeOff,
  ArrowUpRight,
  ArrowDownLeft
} from "lucide-react";
import { SavingsProductCard } from "@/components/savings/SavingsProductCard";
import { CreateSavingsForm } from "@/components/savings/CreateSavingsForm";
import { SavingsAccountCard } from "@/components/savings/SavingsAccountCard";
import { SavingsTransactionForm } from "@/components/savings/SavingsTransactionForm";

const Savings = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw'>('deposit');

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await fetchSavingsData(user.id);
    setLoading(false);
  };

  const fetchSavingsData = async (userId: string) => {
    const { data: productsData } = await supabase
      .from("savings_products")
      .select("*")
      .eq("is_active", true)
      .order("savings_type");
    if (productsData) setProducts(productsData);

    const { data: accountsData } = await supabase
      .from("savings_accounts")
      .select("*, savings_products(*), accounts(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (accountsData) {
      setSavingsAccounts(accountsData);
      if (accountsData.length > 0) setSelectedAccount(accountsData[0].id);
    }

    if (accountsData && accountsData.length > 0) {
      const { data: txData } = await supabase
        .from("savings_transactions")
        .select("*")
        .in("savings_account_id", accountsData.map(a => a.id))
        .order("created_at", { ascending: false })
        .limit(50);
      if (txData) setTransactions(txData);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'XAF' }).format(amount);
  };

  const getTotalSavings = () => savingsAccounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0);
  const getTotalInterest = () => savingsAccounts.reduce((sum, acc) => sum + parseFloat(acc.total_interest_earned || 0), 0);

  const handleTransaction = (type: 'deposit' | 'withdraw') => {
    setTransactionType(type);
    setShowTransactionForm(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const currentAccount = savingsAccounts.find(a => a.id === selectedAccount);

  const summaryStats = [
    { label: "Total Savings", value: showBalances ? formatCurrency(getTotalSavings()) : "••••••", color: "bg-primary/10", icon: PiggyBank },
    { label: "Interest Earned", value: showBalances ? formatCurrency(getTotalInterest()) : "••••••", color: "bg-green-50 dark:bg-green-950", icon: TrendingUp, valueColor: "text-green-600 dark:text-green-400" },
    { label: "Active Accounts", value: String(savingsAccounts.length), color: "bg-purple-50 dark:bg-purple-950", icon: Target },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Savings Accounts</h1>
          <p className="text-muted-foreground mt-1">Build your wealth with competitive interest rates</p>
        </div>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowBalances(!showBalances)}>
          {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
          {showBalances ? "Hide" : "Show"} Balances
        </Button>
      </div>

      {/* Summary */}
      <div className="grid md:grid-cols-3 gap-4">
        {summaryStats.map((stat) => (
          <Card key={stat.label} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200">
            <CardContent className="p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.color}`}>
                  <stat.icon className="h-4 w-4 text-primary" />
                </div>
                <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
              </div>
              <p className={`text-2xl font-bold tracking-tight ${stat.valueColor || ''}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue={savingsAccounts.length === 0 ? "products" : "accounts"}>
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="accounts" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <PiggyBank className="mr-2 h-4 w-4" />My Savings
          </TabsTrigger>
          <TabsTrigger value="products" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Target className="mr-2 h-4 w-4" />Products
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <TrendingUp className="mr-2 h-4 w-4" />Transactions
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-6 mt-6">
          {savingsAccounts.length === 0 ? (
            <Card className="rounded-xl border-0 shadow-sm">
              <CardContent className="empty-state">
                <div className="empty-state-icon">
                  <PiggyBank className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No Savings Accounts</h3>
                <p className="text-sm text-muted-foreground mb-4">Start saving today and earn interest</p>
                <Button className="rounded-full" onClick={() => setShowCreateForm(true)}>
                  <Plus className="mr-2 h-4 w-4" />Open Savings Account
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {savingsAccounts.map((account) => (
                <SavingsAccountCard
                  key={account.id}
                  account={account}
                  showBalance={showBalances}
                  onSelect={() => setSelectedAccount(account.id)}
                  isSelected={selectedAccount === account.id}
                  onDeposit={() => handleTransaction('deposit')}
                  onWithdraw={() => handleTransaction('withdraw')}
                />
              ))}
              <Card className="rounded-xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-colors cursor-pointer" onClick={() => setShowCreateForm(true)}>
                <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted mb-2">
                    <Plus className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Open New Account</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="products" className="space-y-6 mt-6">
          <div className="grid md:grid-cols-2 gap-4">
            {products.map((product) => (
              <SavingsProductCard key={product.id} product={product} onSelect={() => setShowCreateForm(true)} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4 mt-6">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Transaction History</CardTitle>
              <CardDescription className="text-xs">All savings transactions across your accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="data-row flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-3">
                      {tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950">
                          <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                          <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium capitalize">{tx.transaction_type}</p>
                        <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? "+" : "-"}{showBalances ? formatCurrency(parseFloat(tx.amount)) : "••••"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{tx.reference}</p>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon"><TrendingUp className="h-6 w-6 text-muted-foreground" /></div>
                    <p className="text-sm text-muted-foreground">No transactions yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {showCreateForm && (
        <CreateSavingsForm
          products={products}
          onSuccess={() => {
            setShowCreateForm(false);
            checkAuthAndFetchData();
            toast({ title: "Savings account created successfully!" });
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {showTransactionForm && currentAccount && (
        <SavingsTransactionForm
          savingsAccount={currentAccount}
          type={transactionType}
          onSuccess={() => {
            setShowTransactionForm(false);
            checkAuthAndFetchData();
            toast({ title: `${transactionType === 'deposit' ? 'Deposit' : 'Withdrawal'} successful!` });
          }}
          onCancel={() => setShowTransactionForm(false)}
        />
      )}
    </div>
  );
};

export default Savings;
