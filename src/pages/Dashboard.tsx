import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  EyeOff,
  Settings
} from "lucide-react";
import { BalanceWidget } from "@/components/dashboard/widgets/BalanceWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { TransactionsWidget } from "@/components/dashboard/widgets/TransactionsWidget";
import { CreditScoreWidget } from "@/components/dashboard/widgets/CreditScoreWidget";
import { SavingsGoalsWidget } from "@/components/dashboard/widgets/SavingsGoalsWidget";
import { ActivityFeedWidget } from "@/components/dashboard/widgets/ActivityFeedWidget";
import { WidgetCustomizer } from "@/components/dashboard/WidgetCustomizer";

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
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [widgets, setWidgets] = useState<any[]>([]);
  const [creditScore, setCreditScore] = useState<number | null>(null);
  const [savingsGoals, setSavingsGoals] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);

  useEffect(() => {
    checkAuth();
    loadWidgets();
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

  const loadWidgets = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("dashboard_widgets")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_visible", true)
      .order("position");

    if (data) setWidgets(data);
  };

  const handleHideWidget = async (widgetId: string) => {
    await supabase
      .from("dashboard_widgets")
      .update({ is_visible: false })
      .eq("id", widgetId);
    
    loadWidgets();
    toast({ title: "Widget hidden" });
  };

  const handleRemoveWidget = async (widgetId: string) => {
    await supabase
      .from("dashboard_widgets")
      .delete()
      .eq("id", widgetId);
    
    loadWidgets();
    toast({ title: "Widget removed" });
  };

  const fetchAllData = async (userId: string) => {
    await Promise.all([
      fetchAccounts(userId),
      fetchConsents(userId),
      fetchPayments(userId),
      fetchCreditScore(userId),
      fetchSavingsGoals(userId),
      fetchActivityFeed(userId),
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
      
      const { data: balanceData } = await supabase
        .from("account_balances")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("updated_at", { ascending: false });
      
      if (balanceData) setBalances(balanceData);

      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .in("account_id", accountData.map(a => a.id))
        .order("booking_datetime", { ascending: false })
        .limit(10);
      
      if (txData) setTransactions(txData);

      const { data: benData } = await supabase
        .from("beneficiaries")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true);
      
      if (benData) setBeneficiaries(benData);

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

  const fetchCreditScore = async (userId: string) => {
    const { data } = await supabase
      .from("credit_scores")
      .select("score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    
    if (data) setCreditScore(data.score);
  };

  const fetchSavingsGoals = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("savings_accounts")
        .select("id, account_name, target_amount, available_balance, maturity_date, status")
        .eq("user_id", userId)
        .eq("status", "active");
      
      if (data) {
        const goals: any[] = [];
        data.forEach((account) => {
          goals.push({
            id: account.id,
            name: account.account_name,
            targetAmount: account.target_amount || 0,
            currentAmount: account.available_balance || 0,
            currency: "XAF",
            deadline: account.maturity_date,
          });
        });
        setSavingsGoals(goals);
      }
    } catch (error) {
      console.error("Error fetching savings goals:", error);
    }
  };

  const fetchActivityFeed = async (userId: string) => {
    const activities: any[] = [];
    
    const { data: txData } = await supabase
      .from("transactions")
      .select("id, transaction_information, booking_datetime")
      .order("booking_datetime", { ascending: false })
      .limit(5);
    
    if (txData) {
      txData.forEach((tx) => {
        activities.push({
          id: `tx-${tx.id}`,
          type: "info",
          title: "Transaction Processed",
          description: tx.transaction_information || "Transaction completed",
          timestamp: tx.booking_datetime,
        });
      });
    }

    const { data: consentData } = await supabase
      .from("aisp_consents")
      .select("id, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3);
    
    if (consentData) {
      consentData.forEach((consent) => {
        activities.push({
          id: `consent-${consent.id}`,
          type: consent.status === "Authorised" ? "success" : "pending",
          title: "Consent Updated",
          description: `Consent ${consent.status.toLowerCase()}`,
          timestamp: consent.created_at,
        });
      });
    }

    activities.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    setActivityFeed(activities.slice(0, 10));
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
      <div className="space-y-6">
        <div className="space-y-2">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Skeleton className="h-40 rounded-xl md:col-span-2" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Manage your accounts, consents, and transactions
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setShowBalances(!showBalances)}>
            {showBalances ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
            <span className="hidden sm:inline">{showBalances ? "Hide" : "Show"} Balances</span>
          </Button>
          <Button variant="outline" size="sm" className="rounded-full" onClick={() => setCustomizerOpen(true)}>
            <Settings className="mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Customize</span>
          </Button>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {widgets.some((w) => w.widget_type === "balance") && (
          <BalanceWidget
            id={widgets.find((w) => w.widget_type === "balance")?.id}
            balance={getTotalBalance()}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}
        
        {widgets.some((w) => w.widget_type === "quick_actions") && (
          <QuickActionsWidget
            id={widgets.find((w) => w.widget_type === "quick_actions")?.id}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}

        {widgets.some((w) => w.widget_type === "credit_score") && creditScore && (
          <CreditScoreWidget
            id={widgets.find((w) => w.widget_type === "credit_score")?.id}
            score={creditScore}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}

        {widgets.some((w) => w.widget_type === "savings_goals") && (
          <SavingsGoalsWidget
            id={widgets.find((w) => w.widget_type === "savings_goals")?.id}
            goals={savingsGoals}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}

        {widgets.some((w) => w.widget_type === "transactions") && (
          <TransactionsWidget
            id={widgets.find((w) => w.widget_type === "transactions")?.id}
            transactions={transactions.map((tx) => ({
              id: tx.id,
              amount: parseFloat(tx.amount),
              currency: tx.currency,
              type: tx.credit_debit_indicator === "Credit" ? "credit" : "debit",
              description: tx.transaction_information || "Transaction",
              date: tx.booking_datetime,
              status: tx.status,
            }))}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}

        {widgets.some((w) => w.widget_type === "activity_feed") && (
          <ActivityFeedWidget
            id={widgets.find((w) => w.widget_type === "activity_feed")?.id}
            activities={activityFeed}
            onHide={handleHideWidget}
            onRemove={handleRemoveWidget}
          />
        )}
      </div>

      {/* Total Balance Card */}
      <Card className="rounded-xl border-0 shadow-sm overflow-hidden">
        <div className="h-1 w-full bg-primary" />
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Wallet className="h-4 w-4 text-primary" />
            </div>
            Total Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-4xl font-bold tracking-tight">
            {showBalances ? formatCurrency(getTotalBalance()) : "••••••"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            Across {accounts.length} account{accounts.length !== 1 ? 's' : ''}
          </p>
        </CardContent>
      </Card>

      <Tabs defaultValue="accounts" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="accounts" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Wallet className="mr-2 h-4 w-4" />
            Accounts
          </TabsTrigger>
          <TabsTrigger value="transactions" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <ArrowUpDown className="mr-2 h-4 w-4" />
            Transactions
          </TabsTrigger>
          <TabsTrigger value="payments" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <CreditCard className="mr-2 h-4 w-4" />
            Payments
          </TabsTrigger>
          <TabsTrigger value="consents" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Shield className="mr-2 h-4 w-4" />
            Consents
          </TabsTrigger>
          <TabsTrigger value="beneficiaries" className="rounded-full px-4 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
            <Users className="mr-2 h-4 w-4" />
            Beneficiaries
          </TabsTrigger>
        </TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {accounts.map((account) => (
              <Card key={account.id} className="rounded-xl border-0 shadow-sm hover:shadow-md transition-all duration-200">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold">
                      {account.nickname || account.account_holder_name}
                    </CardTitle>
                    <span className="status-pill bg-muted text-muted-foreground">{account.account_type}</span>
                  </div>
                  <CardDescription className="text-xs">
                    {account.account_subtype} • {account.currency}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Account Number</p>
                      <p className="font-mono text-sm">{account.identification_value}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-0.5">Available Balance</p>
                      <p className="text-2xl font-bold tracking-tight">
                        {showBalances ? formatCurrency(getAccountBalance(account.id), account.currency) : "••••••"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      {account.is_active ? (
                        <span className="status-pill bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400">Active</span>
                      ) : (
                        <span className="status-pill bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400">Inactive</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {accounts.length === 0 && (
              <Card className="md:col-span-2 rounded-xl border-0 shadow-sm">
                <CardContent className="empty-state">
                  <div className="empty-state-icon">
                    <Wallet className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">No accounts found. Add an account to get started.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Recent Transactions</CardTitle>
              <CardDescription className="text-xs">Your latest account activity</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {transactions.map((tx) => (
                  <div key={tx.id} className="data-row flex items-center justify-between rounded-xl">
                    <div className="flex items-center gap-3">
                      {tx.credit_debit_indicator === "Credit" ? (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 dark:bg-green-950">
                          <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
                        </div>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950">
                          <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium">{tx.transaction_information || "Transaction"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(tx.booking_datetime).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${tx.credit_debit_indicator === "Credit" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
                        {tx.credit_debit_indicator === "Credit" ? "+" : "-"}{showBalances ? formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency) : "••••"}
                      </p>
                      <span className="status-pill bg-muted text-muted-foreground text-[10px]">{tx.status}</span>
                    </div>
                  </div>
                ))}
                {transactions.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <ArrowUpDown className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No transactions yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Payment History</CardTitle>
              <CardDescription className="text-xs">Your initiated payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="data-row rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="status-pill bg-muted text-muted-foreground">{payment.status}</span>
                      <p className="text-xs text-muted-foreground">
                        {new Date(payment.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          {showBalances ? formatCurrency(
                            parseFloat(payment.instructed_amount.Amount),
                            payment.instructed_amount.Currency
                          ) : "••••••"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Creditor</p>
                        <p className="font-medium text-sm">{payment.creditor_account.Name || "N/A"}</p>
                      </div>
                      {payment.reference && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Reference</p>
                          <p className="text-sm">{payment.reference}</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {payments.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <CreditCard className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No payments yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consents" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Active Consents</CardTitle>
              <CardDescription className="text-xs">Manage third-party access to your accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {consents.map((consent) => (
                  <div key={consent.id} className="rounded-xl bg-muted/30 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <span className={`status-pill ${consent.status === "Authorised" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                          {consent.status}
                        </span>
                        <p className="text-xs text-muted-foreground mt-1.5">
                          Client: {consent.client_id}
                        </p>
                      </div>
                      {consent.status === "Authorised" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          className="rounded-full text-xs"
                          onClick={() => revokeConsent(consent.consent_id)}
                        >
                          Revoke Access
                        </Button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Created</p>
                        <p className="text-sm">{new Date(consent.created_at).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="text-sm">{new Date(consent.expiration_date).toLocaleDateString()}</p>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-muted-foreground mb-1">Permissions</p>
                        <div className="flex flex-wrap gap-1">
                          {consent.permissions.map((perm: string, i: number) => (
                            <span key={i} className="status-pill bg-muted text-muted-foreground text-[10px]">
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {consents.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Shield className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No active consents.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="beneficiaries" className="space-y-4">
          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Saved Beneficiaries</CardTitle>
              <CardDescription className="text-xs">Your saved payment recipients</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {beneficiaries.map((ben) => (
                  <div key={ben.id} className="data-row flex items-center justify-between rounded-xl">
                    <div>
                      <p className="text-sm font-medium">{ben.beneficiary_name}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {ben.identification_value}
                      </p>
                      {ben.reference && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          Ref: {ben.reference}
                        </p>
                      )}
                    </div>
                    <span className="status-pill bg-muted text-muted-foreground">{ben.identification_scheme}</span>
                  </div>
                ))}
                {beneficiaries.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <Users className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No saved beneficiaries yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Standing Orders</CardTitle>
              <CardDescription className="text-xs">Your recurring payments</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {standingOrders.map((so) => (
                  <div key={so.id} className="data-row rounded-xl">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <p className="text-sm font-medium">{so.creditor_name}</p>
                      </div>
                      <span className={`status-pill ${so.status === "Active" ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400" : "bg-muted text-muted-foreground"}`}>
                        {so.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-xs text-muted-foreground">Amount</p>
                        <p className="font-semibold">
                          {showBalances ? formatCurrency(parseFloat(so.next_payment_amount), so.currency) : "••••••"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Frequency</p>
                        <p className="text-sm">{so.frequency}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Next Payment</p>
                        <p className="text-sm">{new Date(so.next_payment_date).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {standingOrders.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-state-icon">
                      <CalendarClock className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No standing orders set up.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      
      {/* Widget Customizer Dialog */}
      <WidgetCustomizer
        open={customizerOpen}
        onOpenChange={setCustomizerOpen}
        onUpdate={loadWidgets}
      />
    </div>
  );
};

export default Dashboard;
