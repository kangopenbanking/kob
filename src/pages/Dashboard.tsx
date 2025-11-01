import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { 
  Wallet, 
  CreditCard, 
  ArrowUpDown, 
  Users, 
  CalendarClock,
  Shield,
  TrendingUp,
  TrendingDown,
  Eye,
  EyeOff
} from "lucide-react";

const Dashboard = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [balances, setBalances] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<any[]>([]);
  const [standingOrders, setStandingOrders] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [showBalances, setShowBalances] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const checkPersonalAccount = async () => {
      if (!user) return;
      
      const { data: isPersonal } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'personal'
      });

      if (isPersonal) {
        toast({
          title: "Personal Account Detected",
          description: "Redirecting to your credit score dashboard...",
        });
        navigate('/credit-score');
      }
    };

    if (user) {
      checkPersonalAccount();
    }
  }, [user, navigate, toast]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
    setUser(user);
    await fetchAllData(user.id);
    setLoading(false);
  };

  const fetchAllData = async (userId: string) => {
    await Promise.all([
      fetchAccounts(userId),
      fetchConsents(userId),
      fetchPayments(userId)
    ]);
  };

  const fetchAccounts = async (userId: string) => {
    const { data: accountData } = await supabase
      .from("accounts")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true);
    
    if (accountData && accountData.length > 0) {
      setAccounts(accountData);
      
      // Fetch balances for all accounts
      const { data: balanceData } = await supabase
        .from("account_balances")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("updated_at", { ascending: false });
      
      if (balanceData) setBalances(balanceData);

      // Fetch transactions
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("booking_datetime", { ascending: false })
        .limit(10);
      
      if (txData) setTransactions(txData);

      // Fetch beneficiaries
      const { data: benData } = await supabase
        .from("beneficiaries")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);
      
      if (benData) setBeneficiaries(benData);

      // Fetch standing orders
      const { data: soData } = await supabase
        .from("standing_orders")
        .select("*")
        .eq("user_id", userId);
      
      if (soData) setStandingOrders(soData);
    }
  };

  const fetchConsents = async (userId: string) => {
    const { data } = await supabase
      .from("aisp_consents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    
    if (data) setConsents(data);
  };

  const fetchPayments = async (userId: string) => {
    const { data } = await supabase
      .from("payments")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    
    if (data) setPayments(data);
  };

  const revokeConsent = async (consentId: string) => {
    const { error } = await supabase
      .from("aisp_consents")
      .update({ 
        status: "Revoked",
        revoked_at: new Date().toISOString(),
        revocation_reason: "User requested revocation"
      })
      .eq("consent_id", consentId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({ title: "Consent revoked successfully" });
      fetchConsents(user.id);
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

  const getTotalBalance = () => {
    return balances
      .filter(b => b.balance_type === "InterimAvailable")
      .reduce((sum, b) => sum + parseFloat(b.amount), 0);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold mb-2">My Dashboard</h1>
              <p className="text-muted-foreground">
                Manage your accounts, consents, and transactions
              </p>
            </div>
            <Button variant="outline" onClick={() => setShowBalances(!showBalances)}>
              {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
              {showBalances ? "Hide" : "Show"} Balances
            </Button>
          </div>
        </div>

        {/* Total Balance Card */}
        <Card className="mb-6 bg-gradient-to-br from-primary/10 to-accent/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Total Balance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">
              {showBalances ? formatCurrency(getTotalBalance()) : "••••••"}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Tabs defaultValue="accounts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="accounts">
              <Wallet className="mr-2 h-4 w-4" />
              Accounts
            </TabsTrigger>
            <TabsTrigger value="transactions">
              <ArrowUpDown className="mr-2 h-4 w-4" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="payments">
              <CreditCard className="mr-2 h-4 w-4" />
              Payments
            </TabsTrigger>
            <TabsTrigger value="consents">
              <Shield className="mr-2 h-4 w-4" />
              Consents
            </TabsTrigger>
            <TabsTrigger value="beneficiaries">
              <Users className="mr-2 h-4 w-4" />
              Beneficiaries
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        {account.nickname || account.account_holder_name}
                      </CardTitle>
                      <Badge variant="outline">{account.account_type}</Badge>
                    </div>
                    <CardDescription>
                      {account.account_subtype} • {account.currency}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="text-sm text-muted-foreground">Account Number</p>
                        <p className="font-mono">{account.identification_value}</p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Available Balance</p>
                        <p className="text-2xl font-bold">
                          {showBalances ? formatCurrency(getAccountBalance(account.id), account.currency) : "••••••"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 pt-2">
                        {account.is_active ? (
                          <Badge className="bg-green-500">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Inactive</Badge>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {accounts.length === 0 && (
                <Card className="md:col-span-2">
                  <CardContent className="py-8 text-center">
                    <p className="text-muted-foreground">No accounts found. Add an account to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="transactions" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Your latest account activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between p-3 border rounded">
                      <div className="flex items-center gap-3">
                        {tx.credit_debit_indicator === "Credit" ? (
                          <div className="p-2 bg-green-100 dark:bg-green-900 rounded-full">
                            <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                          </div>
                        ) : (
                          <div className="p-2 bg-red-100 dark:bg-red-900 rounded-full">
                            <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{tx.transaction_information || "Transaction"}</p>
                          <p className="text-sm text-muted-foreground">
                            {new Date(tx.booking_datetime).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`font-bold ${tx.credit_debit_indicator === "Credit" ? "text-green-600" : "text-red-600"}`}>
                          {tx.credit_debit_indicator === "Credit" ? "+" : "-"}
                          {showBalances ? formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency) : "••••"}
                        </p>
                        <Badge variant="outline">{tx.status}</Badge>
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

          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Payment History</CardTitle>
                <CardDescription>Your initiated payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline">{payment.status}</Badge>
                        <p className="text-sm text-muted-foreground">
                          {new Date(payment.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-bold">
                            {showBalances ? formatCurrency(
                              parseFloat(payment.instructed_amount.Amount),
                              payment.instructed_amount.Currency
                            ) : "••••••"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Creditor</p>
                          <p className="font-medium">{payment.creditor_account.Name || "N/A"}</p>
                        </div>
                        {payment.reference && (
                          <div className="col-span-2">
                            <p className="text-muted-foreground">Reference</p>
                            <p>{payment.reference}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {payments.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No payments yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="consents" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Active Consents</CardTitle>
                <CardDescription>Manage third-party access to your accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {consents.map((consent) => (
                    <div key={consent.id} className="p-4 border rounded">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Badge variant={consent.status === "Authorised" ? "default" : "outline"}>
                            {consent.status}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            Client: {consent.client_id}
                          </p>
                        </div>
                        {consent.status === "Authorised" && (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => revokeConsent(consent.consent_id)}
                          >
                            Revoke Access
                          </Button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Created</p>
                          <p>{new Date(consent.created_at).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Expires</p>
                          <p>{new Date(consent.expiration_date).toLocaleDateString()}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-muted-foreground mb-1">Permissions</p>
                          <div className="flex flex-wrap gap-1">
                            {consent.permissions.map((perm: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {perm}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {consents.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No active consents. You haven't authorized any third-party access yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="beneficiaries" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Saved Beneficiaries</CardTitle>
                <CardDescription>Your saved payment recipients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {beneficiaries.map((ben) => (
                    <div key={ben.id} className="flex items-center justify-between p-3 border rounded">
                      <div>
                        <p className="font-medium">{ben.beneficiary_name}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {ben.identification_value}
                        </p>
                        {ben.reference && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Ref: {ben.reference}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline">{ben.identification_scheme}</Badge>
                    </div>
                  ))}
                  {beneficiaries.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No saved beneficiaries yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Standing Orders</CardTitle>
                <CardDescription>Your recurring payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {standingOrders.map((so) => (
                    <div key={so.id} className="p-3 border rounded">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4" />
                          <p className="font-medium">{so.creditor_name}</p>
                        </div>
                        <Badge variant={so.status === "Active" ? "default" : "outline"}>
                          {so.status}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-muted-foreground">Amount</p>
                          <p className="font-bold">
                            {showBalances ? formatCurrency(parseFloat(so.next_payment_amount), so.currency) : "••••••"}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Frequency</p>
                          <p>{so.frequency}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Next Payment</p>
                          <p>{new Date(so.next_payment_date).toLocaleDateString()}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                  {standingOrders.length === 0 && (
                    <p className="text-center text-muted-foreground py-8">
                      No standing orders set up.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
