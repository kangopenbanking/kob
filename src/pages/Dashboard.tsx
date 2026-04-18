import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import {
  Wallet, CreditCard, ArrowUpDown, Users, CalendarClock, Shield,
  TrendingUp, Eye, EyeOff, Settings, ArrowUpRight, ArrowDownRight,
  Smartphone, PiggyBank, Landmark,
} from "lucide-react";
import { BalanceWidget } from "@/components/dashboard/widgets/BalanceWidget";
import { QuickActionsWidget } from "@/components/dashboard/widgets/QuickActionsWidget";
import { TransactionsWidget } from "@/components/dashboard/widgets/TransactionsWidget";
import { CreditScoreWidget } from "@/components/dashboard/widgets/CreditScoreWidget";
import { SavingsGoalsWidget } from "@/components/dashboard/widgets/SavingsGoalsWidget";
import { ActivityFeedWidget } from "@/components/dashboard/widgets/ActivityFeedWidget";
import { WidgetCustomizer } from "@/components/dashboard/WidgetCustomizer";
import { NoCreditScoreCTA } from "@/components/credit/NoCreditScoreCTA";
import { useDashboardData } from "@/hooks/useDashboardData";
import { format } from "date-fns";
import { motion } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  }),
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [showBalances, setShowBalances] = useState(true);
  const [customizerOpen, setCustomizerOpen] = useState(false);

  const {
    loading, accounts, balances, transactions, consents, beneficiaries,
    standingOrders, payments, widgets, creditScore, savingsGoals, activityFeed,
    revokeConsent, hideWidget, removeWidget, refreshWidgets,
  } = useDashboardData();

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  const getAccountBalance = (accountId: string) => {
    const balance = balances.find(b => b.account_id === accountId && b.balance_type === "ClosingAvailable");
    return balance ? parseFloat(balance.amount) : 0;
  };

  const getTotalBalance = () =>
    balances.filter(b => b.balance_type === "ClosingAvailable").reduce((sum, b) => sum + parseFloat(b.amount), 0);

  if (loading) {
    return (
      <div className="space-y-6 max-w-[1400px] mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const quickServices = [
    { label: "Mobile Money", icon: Smartphone, path: "/mobile-money", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
    { label: "Payments", icon: Wallet, path: "/payments", color: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
    { label: "Savings", icon: PiggyBank, path: "/savings", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
    { label: "Virtual Cards", icon: CreditCard, path: "/virtual-cards", color: "bg-violet-500/10 text-violet-600 dark:text-violet-400", soon: true },
    { label: "Credit Score", icon: TrendingUp, path: "/credit-score", color: "bg-rose-500/10 text-rose-600 dark:text-rose-400" },
    { label: "Banking Ops", icon: Landmark, path: "/banking-ops", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your finances · <span className="text-foreground/70">{format(new Date(), "EEEE, MMMM d")}</span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowBalances(!showBalances)}>
            {showBalances ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            {showBalances ? "Hide" : "Show"}
          </Button>
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setCustomizerOpen(true)}>
            <Settings className="h-3.5 w-3.5" /> Customize
          </Button>
        </div>
      </motion.div>

      {/* Stats Row */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { title: "Total Balance", value: showBalances ? formatCurrency(getTotalBalance()) : "••••••", sub: `${accounts.length} account${accounts.length !== 1 ? "s" : ""}`, icon: Wallet, iconBg: "bg-primary/10 text-primary" },
          { title: "Credit Score", value: creditScore ? `${creditScore}` : "—", sub: creditScore && creditScore >= 700 ? "Good standing" : creditScore ? "Needs improvement" : "Not scored", icon: TrendingUp, iconBg: creditScore && creditScore >= 700 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
          { title: "Transactions", value: transactions.length.toString(), sub: "Recent activity", icon: ArrowUpDown, iconBg: "bg-sky-500/10 text-sky-600 dark:text-sky-400" },
          { title: "Savings Goals", value: savingsGoals.length.toString(), sub: savingsGoals.length > 0 ? "Active goals" : "No goals yet", icon: PiggyBank, iconBg: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
        ].map((stat, i) => (
          <motion.div key={stat.title} custom={i} variants={fadeUp} initial="hidden" animate="visible">
            <Card className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="space-y-1.5">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.title}</p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                    <p className="text-xs text-muted-foreground">{stat.sub}</p>
                  </div>
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                    <stat.icon className="h-5 w-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Widgets Grid */}
      {widgets.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {widgets.some(w => w.widget_type === "balance") && (
              <BalanceWidget id={widgets.find(w => w.widget_type === "balance")?.id} balance={getTotalBalance()} onHide={hideWidget} onRemove={removeWidget} />
            )}
            {widgets.some(w => w.widget_type === "quick_actions") && (
              <QuickActionsWidget id={widgets.find(w => w.widget_type === "quick_actions")?.id} onHide={hideWidget} onRemove={removeWidget} />
            )}
            {widgets.some(w => w.widget_type === "credit_score") && creditScore && (
              <CreditScoreWidget id={widgets.find(w => w.widget_type === "credit_score")?.id} score={creditScore} onHide={hideWidget} onRemove={removeWidget} />
            )}
            {widgets.some(w => w.widget_type === "credit_score") && !creditScore && (
              <div className="md:col-span-1">
                <NoCreditScoreCTA variant="dashboard" invalidateKeys={[['dashboard-data']]} />
              </div>
            )}
            {widgets.some(w => w.widget_type === "savings_goals") && (
              <SavingsGoalsWidget id={widgets.find(w => w.widget_type === "savings_goals")?.id} goals={savingsGoals} onHide={hideWidget} onRemove={removeWidget} />
            )}
            {widgets.some(w => w.widget_type === "transactions") && (
              <TransactionsWidget
                id={widgets.find(w => w.widget_type === "transactions")?.id}
                transactions={transactions.map(tx => ({ id: tx.id, amount: parseFloat(tx.amount), currency: tx.currency, type: tx.credit_debit_indicator === "Credit" ? "credit" : "debit", description: tx.transaction_information || "Transaction", date: tx.booking_datetime, status: tx.status }))}
                onHide={hideWidget} onRemove={removeWidget}
              />
            )}
            {widgets.some(w => w.widget_type === "activity_feed") && (
              <ActivityFeedWidget id={widgets.find(w => w.widget_type === "activity_feed")?.id} activities={activityFeed} onHide={hideWidget} onRemove={removeWidget} />
            )}
          </div>
        </motion.div>
      )}

      {/* Quick Services */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold text-foreground">Quick Services</h2>
        </div>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {quickServices.map((svc: any) => (
            <Card key={svc.label} className="cursor-pointer hover:shadow-md transition-all group border-border/60 relative" onClick={() => navigate(svc.path)}>
              {svc.soon && (
                <Badge variant="secondary" className="absolute -top-2 -right-2 text-[10px] px-1.5 py-0 z-10">Soon</Badge>
              )}
              <CardContent className="p-4 flex flex-col items-center gap-2.5 text-center">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${svc.color} transition-transform group-hover:scale-110 ${svc.soon ? 'opacity-50' : ''}`}>
                  <svc.icon className="h-5 w-5" />
                </div>
                <p className={`text-xs font-semibold ${svc.soon ? 'text-muted-foreground' : ''}`}>{svc.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </motion.div>

      {/* Main Content Tabs */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
        <Tabs defaultValue="accounts" className="space-y-4">
          <TabsList className="inline-flex h-10 items-center rounded-lg bg-muted p-1 text-muted-foreground">
            <TabsTrigger value="accounts" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Wallet className="mr-1.5 h-3.5 w-3.5" /> Accounts
            </TabsTrigger>
            <TabsTrigger value="transactions" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5" /> Transactions
            </TabsTrigger>
            <TabsTrigger value="payments" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <CreditCard className="mr-1.5 h-3.5 w-3.5" /> Payments
            </TabsTrigger>
            <TabsTrigger value="consents" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Shield className="mr-1.5 h-3.5 w-3.5" /> Consents
            </TabsTrigger>
            <TabsTrigger value="beneficiaries" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">
              <Users className="mr-1.5 h-3.5 w-3.5" /> Beneficiaries
            </TabsTrigger>
          </TabsList>

          {/* Accounts Tab */}
          <TabsContent value="accounts" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {accounts.map((account) => (
                <Card key={account.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-sm font-semibold">{account.nickname || account.account_holder_name}</CardTitle>
                      <Badge variant="secondary" className="text-[10px]">{account.account_type}</Badge>
                    </div>
                    <CardDescription className="text-xs">{account.account_subtype} · {account.currency}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Account Number</p>
                        <p className="font-mono text-sm text-foreground/80">{account.identification_value}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground mb-0.5">Available Balance</p>
                        <p className="text-2xl font-bold tracking-tight">
                          {showBalances ? formatCurrency(getAccountBalance(account.id), account.currency) : "••••••"}
                        </p>
                      </div>
                      <Badge variant={account.is_active ? "default" : "destructive"} className="text-[10px]">
                        {account.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
              {accounts.length === 0 && (
                <Card className="md:col-span-2">
                  <CardContent className="py-12 text-center">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                      <Wallet className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">No accounts found. Add an account to get started.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Transactions</CardTitle>
                <CardDescription>Your latest account activity</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {transactions.map((tx) => (
                    <div key={tx.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tx.credit_debit_indicator === "Credit" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                          {tx.credit_debit_indicator === "Credit" ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{tx.transaction_information || "Transaction"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(tx.booking_datetime).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${tx.credit_debit_indicator === "Credit" ? "text-emerald-600 dark:text-emerald-400" : "text-destructive"}`}>
                          {tx.credit_debit_indicator === "Credit" ? "+" : "-"}
                          {showBalances ? formatCurrency(Math.abs(parseFloat(tx.amount)), tx.currency) : "••••"}
                        </p>
                        <Badge variant="outline" className="text-[10px]">{tx.status}</Badge>
                      </div>
                    </div>
                  ))}
                  {transactions.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <ArrowUpDown className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No transactions yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payments Tab */}
          <TabsContent value="payments">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Payment History</CardTitle>
                <CardDescription>Your initiated payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div key={payment.id} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <Badge variant="secondary" className="text-[10px]">{payment.status}</Badge>
                        <p className="text-xs text-muted-foreground">{new Date(payment.created_at).toLocaleString()}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold">
                            {showBalances ? formatCurrency(parseFloat(payment.instructed_amount.Amount), payment.instructed_amount.Currency) : "••••••"}
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
                    <div className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No payments yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Consents Tab */}
          <TabsContent value="consents">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Active Consents</CardTitle>
                <CardDescription>Manage third-party access to your accounts</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {consents.map((consent) => (
                    <div key={consent.id} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <Badge variant={consent.status === "Authorised" ? "default" : "secondary"} className="text-[10px]">{consent.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-1.5">Client: {consent.client_id}</p>
                        </div>
                        {consent.status === "Authorised" && (
                          <Button size="sm" variant="destructive" className="text-xs h-8" onClick={() => revokeConsent(consent.consent_id)}>
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
                            {Array.isArray(consent.permissions) ? consent.permissions.map((perm: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-[10px]">{perm}</Badge>
                            )) : <Badge variant="outline" className="text-[10px]">N/A</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {consents.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <Shield className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No active consents.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Beneficiaries Tab */}
          <TabsContent value="beneficiaries" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Saved Beneficiaries</CardTitle>
                <CardDescription>Your saved payment recipients</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {beneficiaries.map((ben) => (
                    <div key={ben.id} className="flex items-center justify-between py-3 px-3 rounded-lg hover:bg-muted/30 transition-colors">
                      <div>
                        <p className="text-sm font-medium">{ben.beneficiary_name}</p>
                        <p className="text-xs text-muted-foreground font-mono">{ben.identification_value}</p>
                        {ben.reference && <p className="text-[10px] text-muted-foreground mt-0.5">Ref: {ben.reference}</p>}
                      </div>
                      <Badge variant="outline" className="text-[10px]">{ben.identification_scheme}</Badge>
                    </div>
                  ))}
                  {beneficiaries.length === 0 && (
                    <div className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <Users className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No saved beneficiaries yet.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Standing Orders</CardTitle>
                <CardDescription>Your recurring payments</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {standingOrders.map((so) => (
                    <div key={so.id} className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <CalendarClock className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">{so.creditor_name}</p>
                        </div>
                        <Badge variant={so.status === "Active" ? "default" : "secondary"} className="text-[10px]">{so.status}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Amount</p>
                          <p className="font-semibold">{showBalances ? formatCurrency(parseFloat(so.next_payment_amount), so.currency) : "••••••"}</p>
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
                    <div className="py-12 text-center">
                      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mx-auto mb-3">
                        <CalendarClock className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <p className="text-sm text-muted-foreground">No standing orders set up.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>

      <WidgetCustomizer open={customizerOpen} onOpenChange={setCustomizerOpen} onUpdate={refreshWidgets} />
    </div>
  );
};

export default Dashboard;
