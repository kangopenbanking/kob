import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
    // Fetch savings products
    const { data: productsData } = await supabase
      .from("savings_products")
      .select("*")
      .eq("is_active", true)
      .order("savings_type");
    
    if (productsData) setProducts(productsData);

    // Fetch user's savings accounts
    const { data: accountsData } = await supabase
      .from("savings_accounts")
      .select("*, savings_products(*), accounts(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (accountsData) {
      setSavingsAccounts(accountsData);
      if (accountsData.length > 0) {
        setSelectedAccount(accountsData[0].id);
      }
    }

    // Fetch transactions
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
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'XAF'
    }).format(amount);
  };

  const getTotalSavings = () => {
    return savingsAccounts.reduce((sum, acc) => sum + parseFloat(acc.current_balance || 0), 0);
  };

  const getTotalInterest = () => {
    return savingsAccounts.reduce((sum, acc) => sum + parseFloat(acc.total_interest_earned || 0), 0);
  };

  const handleTransaction = (type: 'deposit' | 'withdraw') => {
    setTransactionType(type);
    setShowTransactionForm(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading savings...</p>
      </div>
    );
  }

  const currentAccount = savingsAccounts.find(a => a.id === selectedAccount);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Savings Accounts</h1>
              <p className="text-muted-foreground">
                Build your wealth with competitive interest rates
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowBalances(!showBalances)}>
              {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showBalances ? "Hide" : "Show"} Balances
            </Button>
          </div>
        </div>

        {/* Total Savings Summary */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Savings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">
                {showBalances ? formatCurrency(getTotalSavings()) : "••••••"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Interest Earned</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-green-600">
                {showBalances ? formatCurrency(getTotalInterest()) : "••••••"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{savingsAccounts.length}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue={savingsAccounts.length === 0 ? "products" : "accounts"}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="accounts">
              <PiggyBank className="mr-2 h-4 w-4" />
              My Savings
            </TabsTrigger>
            <TabsTrigger value="products">
              <Target className="mr-2 h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <TrendingUp className="mr-2 h-4 w-4" />
              Transactions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            {savingsAccounts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <PiggyBank className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Savings Accounts</h3>
                  <p className="text-muted-foreground mb-6">
                    Start saving today and earn interest on your money
                  </p>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Open Savings Account
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
                <Card className="border-dashed border-2 hover:border-primary transition-colors cursor-pointer" onClick={() => setShowCreateForm(true)}>
                  <CardContent className="flex flex-col items-center justify-center h-full min-h-[200px]">
                    <Plus className="h-12 w-12 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">Open New Account</p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="products" className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              {products.map((product) => (
                <SavingsProductCard
                  key={product.id}
                  product={product}
                  onSelect={() => {
                    setShowCreateForm(true);
                  }}
                />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Transaction History</CardTitle>
                <CardDescription>All savings transactions across your accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? (
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                            <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                            <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium capitalize">{tx.transaction_type}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? "text-green-600" : "text-red-600"}`}>
                          {tx.transaction_type === 'deposit' || tx.transaction_type === 'interest' ? "+" : "-"}
                          {showBalances ? formatCurrency(parseFloat(tx.amount)) : "••••"}
                        </p>
                        <p className="text-xs text-muted-foreground">{tx.reference}</p>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No transactions yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Create Savings Form Dialog */}
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

        {/* Transaction Form Dialog */}
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
    </div>
  );
};

export default Savings;
