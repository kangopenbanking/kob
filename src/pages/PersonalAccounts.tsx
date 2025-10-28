import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Wallet, 
  ArrowUpRight, 
  ArrowDownLeft,
  Send,
  Download,
  Plus,
  Eye,
  EyeOff,
  FileText,
  CreditCard
} from "lucide-react";

const PersonalAccounts = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [showBalances, setShowBalances] = useState(true);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);

  useEffect(() => {
    checkAuthAndFetchData();
  }, []);

  const checkAuthAndFetchData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    await fetchPersonalAccounts(user.id);
    setLoading(false);
  };

  const fetchPersonalAccounts = async (userId: string) => {
    // Fetch personal current accounts only
    const { data: accountData } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("account_type", "Personal")
      .eq("account_subtype", "Current")
      .eq("is_active", true);
    
    if (accountData && accountData.length > 0) {
      setAccounts(accountData);
      setSelectedAccount(accountData[0].id);
      
      // Fetch balances
      const { data: balanceData } = await supabase
        .from("account_balances")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("updated_at", { ascending: false });
      
      if (balanceData) setBalances(balanceData);

      // Fetch recent transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("booking_datetime", { ascending: false })
        .limit(20);
      
      if (txData) setTransactions(txData);
    }
  };

  const formatCurrency = (amount: number, currency: string = "XAF") => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  const getAccountBalance = (accountId: string) => {
    const balance = balances.find(b => b.account_id === accountId && b.balance_type === "InterimAvailable");
    return balance ? parseFloat(balance.amount) : 0;
  };

  const getAccountTransactions = (accountId: string) => {
    return transactions.filter(tx => tx.account_id === accountId);
  };

  const handleQuickAction = (action: string) => {
    switch (action) {
      case 'transfer':
        navigate('/payments', { state: { tab: 'bank-transfer' } });
        break;
      case 'pay-bills':
        toast({ title: "Coming soon", description: "Bill payment feature will be available soon." });
        break;
      case 'mobile-money':
        navigate('/mobile-money');
        break;
      case 'card-payment':
        navigate('/payments', { state: { tab: 'card-payment' } });
        break;
      case 'statement':
        toast({ title: "Generating statement", description: "Your statement is being prepared..." });
        break;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading your accounts...</p>
      </div>
    );
  }

  const currentAccount = accounts.find(a => a.id === selectedAccount);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">Personal Current Accounts</h1>
              <p className="text-muted-foreground">
                Manage your everyday banking and transactions
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowBalances(!showBalances)}>
              {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showBalances ? "Hide" : "Show"} Balances
            </Button>
          </div>
        </div>

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Wallet className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Personal Current Accounts</h3>
              <p className="text-muted-foreground mb-6">
                You don't have any personal current accounts yet. Open one to get started.
              </p>
              <Button onClick={() => toast({ title: "Coming soon", description: "Account opening will be available soon." })}>
                <Plus className="mr-2 h-4 w-4" />
                Open New Account
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Account List Sidebar */}
            <div className="lg:col-span-1 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Your Accounts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {accounts.map((account) => (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccount(account.id)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                        selectedAccount === account.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{account.nickname || account.account_holder_name}</span>
                        <Badge variant="outline" className="text-xs">{account.currency}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {account.identification_value}
                      </p>
                      <p className="text-xl font-bold">
                        {showBalances ? formatCurrency(getAccountBalance(account.id), account.currency) : "••••••"}
                      </p>
                    </button>
                  ))}
                  <Button variant="outline" className="w-full" onClick={() => toast({ title: "Coming soon" })}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Account
                  </Button>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction('transfer')}>
                    <Send className="mr-2 h-4 w-4" />
                    Send Money
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction('mobile-money')}>
                    <ArrowUpRight className="mr-2 h-4 w-4" />
                    Mobile Money
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction('card-payment')}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    Card Payment
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction('pay-bills')}>
                    <FileText className="mr-2 h-4 w-4" />
                    Pay Bills
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={() => handleQuickAction('statement')}>
                    <Download className="mr-2 h-4 w-4" />
                    Download Statement
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Main Account Details */}
            <div className="lg:col-span-2 space-y-6">
              {currentAccount && (
                <>
                  {/* Account Overview */}
                  <Card className="bg-gradient-to-br from-primary/10 to-accent/10">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle>{currentAccount.nickname || currentAccount.account_holder_name}</CardTitle>
                          <CardDescription>{currentAccount.account_subtype} Account</CardDescription>
                        </div>
                        <Badge>{currentAccount.is_active ? "Active" : "Inactive"}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm text-muted-foreground">Available Balance</p>
                          <p className="text-4xl font-bold">
                            {showBalances ? formatCurrency(getAccountBalance(currentAccount.id), currentAccount.currency) : "••••••"}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                          <div>
                            <p className="text-sm text-muted-foreground">Account Number</p>
                            <p className="font-mono font-semibold">{currentAccount.identification_value}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Currency</p>
                            <p className="font-semibold">{currentAccount.currency}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Institution</p>
                            <p className="font-semibold">{currentAccount.institution_name || "KOB"}</p>
                          </div>
                          <div>
                            <p className="text-sm text-muted-foreground">Opened</p>
                            <p className="font-semibold">{new Date(currentAccount.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Transactions */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Recent Transactions</CardTitle>
                      <CardDescription>Latest activity on this account</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="all">
                        <TabsList className="grid w-full grid-cols-3">
                          <TabsTrigger value="all">All</TabsTrigger>
                          <TabsTrigger value="credit">Money In</TabsTrigger>
                          <TabsTrigger value="debit">Money Out</TabsTrigger>
                        </TabsList>
                        <TabsContent value="all" className="space-y-3 mt-4">
                          {getAccountTransactions(currentAccount.id).map((tx) => (
                            <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                              <div className="flex items-center gap-3">
                                {tx.credit_debit_indicator === "Credit" ? (
                                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                                    <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  </div>
                                ) : (
                                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                                    <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  </div>
                                )}
                                <div>
                                  <p className="font-medium">{tx.transaction_information || "Transaction"}</p>
                                  <p className="text-sm text-muted-foreground">
                                    {new Date(tx.booking_datetime).toLocaleString()}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className={`font-bold ${tx.credit_debit_indicator === "Credit" ? "text-green-600" : "text-red-600"}`}>
                                  {tx.credit_debit_indicator === "Credit" ? "+" : "-"}
                                  {showBalances ? formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency) : "••••"}
                                </p>
                                <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                              </div>
                            </div>
                          ))}
                          {getAccountTransactions(currentAccount.id).length === 0 && (
                            <p className="text-center text-muted-foreground py-8">
                              No transactions yet.
                            </p>
                          )}
                        </TabsContent>
                        <TabsContent value="credit" className="space-y-3 mt-4">
                          {getAccountTransactions(currentAccount.id)
                            .filter(tx => tx.credit_debit_indicator === "Credit")
                            .map((tx) => (
                              <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                                    <ArrowDownLeft className="h-4 w-4 text-green-600 dark:text-green-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{tx.transaction_information || "Transaction"}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(tx.booking_datetime).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-green-600">
                                    +{showBalances ? formatCurrency(parseFloat(tx.amount), tx.currency) : "••••"}
                                  </p>
                                  <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                                </div>
                              </div>
                            ))}
                        </TabsContent>
                        <TabsContent value="debit" className="space-y-3 mt-4">
                          {getAccountTransactions(currentAccount.id)
                            .filter(tx => tx.credit_debit_indicator === "Debit")
                            .map((tx) => (
                              <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                                    <ArrowUpRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                                  </div>
                                  <div>
                                    <p className="font-medium">{tx.transaction_information || "Transaction"}</p>
                                    <p className="text-sm text-muted-foreground">
                                      {new Date(tx.booking_datetime).toLocaleString()}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-bold text-red-600">
                                    -{showBalances ? formatCurrency(parseFloat(tx.amount), tx.currency) : "••••"}
                                  </p>
                                  <Badge variant="outline" className="text-xs">{tx.status}</Badge>
                                </div>
                              </div>
                            ))}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PersonalAccounts;
