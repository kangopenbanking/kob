import { FacilitatedPaymentsCard } from "@/components/institution/FacilitatedPaymentsCard";
import { CreditApiIntegrationWidget } from "@/components/credit-api/CreditApiIntegrationWidget";
import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  TrendingUp,
  Users,
  DollarSign,
  Receipt,
  ArrowRight,
  Wallet,
  MapPin,
  Banknote,
  PiggyBank,
  Shield,
  BookOpen,
  CreditCard,
  ArrowUpDown,
  CheckCircle2,
  AlertCircle,
  Clock,
  ChevronRight,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FIPortal() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [institution, setInstitution] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    totalVolume: 0,
    activeAccounts: 0,
    apiCalls: 0,
  });

  useEffect(() => {
    checkAuthAndInstitution();
  }, []);

  const checkAuthAndInstitution = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    await loadInstitution();
    await loadMetrics();
    setLoading(false);
  };

  const loadInstitution = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("institutions").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) { navigate('/register'); return; }
    if (data.status === 'pending' || data.status === 'rejected') { navigate('/pending-approval'); return; }
    setInstitution(data);
  };

  const loadMetrics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
    if (!inst) return;

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: transactions } = await supabase.from("transactions").select("amount", { count: "exact" }).gte("created_at", thirtyDaysAgo);
    const { data: accounts } = await supabase.from("accounts").select("id", { count: "exact" }).eq("is_active", true);
    const { data: apiUsage } = await supabase.from("api_usage_metrics").select("id", { count: "exact" }).eq("institution_id", inst.id).gte("created_at", thirtyDaysAgo);
    const totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    setMetrics({
      totalTransactions: transactions?.length || 0,
      totalVolume,
      activeAccounts: accounts?.length || 0,
      apiCalls: apiUsage?.length || 0,
    });
  };

  if (!institution && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <Shield className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="text-xl">Financial Institution Portal</CardTitle>
            <CardDescription>No institution registration found. Please register your institution first.</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => navigate('/register')}>Register Institution</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isDeveloper = institution?.institution_type === 'developer';
  const sandboxCreds = institution?.sandbox_credentials as any;

  const quickActions = [
    { label: "Accounts", icon: Wallet, path: "/fi-portal/accounts", desc: "Manage accounts & balances", color: "text-primary" },
    { label: "Branches", icon: MapPin, path: "/fi-portal/branches", desc: "Branch network", color: "text-emerald-600 dark:text-emerald-400" },
    { label: "Loans", icon: Banknote, path: "/fi-portal/loans", desc: "Lending products", color: "text-amber-600 dark:text-amber-400" },
    { label: "Savings", icon: PiggyBank, path: "/fi-portal/savings", desc: "Savings products", color: "text-violet-600 dark:text-violet-400" },
    { label: "Customers", icon: Users, path: "/fi-portal/customers", desc: "KYC & compliance", color: "text-rose-600 dark:text-rose-400" },
    { label: "Transactions", icon: ArrowUpDown, path: "/fi-portal/transactions", desc: "Transaction history", color: "text-sky-600 dark:text-sky-400" },
    { label: "Payments", icon: CreditCard, path: "/fi-portal/payments", desc: "Payment processing", color: "text-teal-600 dark:text-teal-400" },
    { label: "Ledger", icon: BookOpen, path: "/fi-portal/ledger", desc: "Chart of accounts", color: "text-indigo-600 dark:text-indigo-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary-foreground/10 p-8 text-primary-foreground">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmZmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02ek0xOCAzNmMzLjMxNCAwIDYgMi42ODYgNiA2cy0yLjY4NiA2LTYgNi02LTIuNjg2LTYtNiAyLjY4Ni02IDYtNnoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-50" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-primary-foreground/70 mb-1">Welcome back</p>
              <h1 className="text-3xl font-bold tracking-tight">{institution?.institution_name}</h1>
              <p className="mt-1 text-sm text-primary-foreground/80">
                {isDeveloper ? "Developer Sandbox" : "Banking Operations Dashboard"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-primary-foreground/30 text-primary-foreground bg-primary-foreground/10 backdrop-blur-sm">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {institution?.status === 'approved' ? 'Active' : institution?.status}
              </Badge>
            </div>
          </div>
          {isDeveloper && (
            <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary-foreground/10 backdrop-blur-sm px-3 py-2 text-sm">
              <Activity className="h-4 w-4" />
              <span>Developer mode — sandbox credentials available below</span>
            </div>
          )}
        </div>
      </div>

      {/* Sandbox Credentials for Developers */}
      {isDeveloper && sandboxCreds && (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Activity className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">Sandbox API Credentials</CardTitle>
                <CardDescription>Use these credentials to test your integration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg bg-muted/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client ID</p>
                <code className="text-sm font-mono break-all">{sandboxCreds.client_id}</code>
              </div>
              <div className="rounded-lg bg-muted/80 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client Secret</p>
                <code className="text-sm font-mono break-all">{sandboxCreds.client_secret}</code>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-muted/80 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Sandbox URL</p>
              <code className="text-sm font-mono break-all">{sandboxCreds.sandbox_url}</code>
            </div>
            <div className="mt-3 flex gap-3 flex-wrap">
              <Button variant="outline" size="sm" asChild><Link to="/documentation">📚 API Docs</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/developer">🔧 Developer Portal</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('transactions'), value: metrics.totalTransactions.toLocaleString(), sub: "Last 30 days", icon: Activity, gradient: "from-primary/10 to-primary/5", iconBg: "bg-primary/10", iconColor: "text-primary" },
          { label: "Volume", value: `${metrics.totalVolume.toLocaleString()} XAF`, sub: "Total processed", icon: DollarSign, gradient: "from-emerald-500/10 to-emerald-500/5", iconBg: "bg-emerald-500/10", iconColor: "text-emerald-600 dark:text-emerald-400" },
          { label: t('accounts'), value: metrics.activeAccounts.toLocaleString(), sub: "Active accounts", icon: Users, gradient: "from-violet-500/10 to-violet-500/5", iconBg: "bg-violet-500/10", iconColor: "text-violet-600 dark:text-violet-400" },
          { label: t('apiUsage'), value: metrics.apiCalls.toLocaleString(), sub: "API calls (30d)", icon: TrendingUp, gradient: "from-amber-500/10 to-amber-500/5", iconBg: "bg-amber-500/10", iconColor: "text-amber-600 dark:text-amber-400" },
        ].map((stat) => (
          <Card key={stat.label} className={`relative overflow-hidden border-0 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br ${stat.gradient}`}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
                </div>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${stat.iconBg}`}>
                  <stat.icon className={`h-5 w-5 ${stat.iconColor}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold tracking-tight">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="group relative flex flex-col gap-2 rounded-xl border bg-card p-4 hover:shadow-md hover:border-primary/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg bg-muted ${action.color}`}>
                  <action.icon className="h-4.5 w-4.5" />
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
              <div>
                <p className="text-sm font-semibold">{action.label}</p>
                <p className="text-xs text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="inline-flex h-10 items-center rounded-full bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="overview" className="rounded-full px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="fees" className="rounded-full px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Fees & Billing</TabsTrigger>
          <TabsTrigger value="credit-api" className="rounded-full px-4 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Credit API</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <CardTitle className="text-base">System Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "API Gateway", value: "Operational", status: "ok" },
                    { label: "Response Time", value: "245ms", status: "ok" },
                    { label: "Success Rate", value: "99.8%", status: "ok" },
                    { label: "Uptime (30d)", value: "99.99%", status: "ok" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                      <span className="text-sm text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{item.value}</span>
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "New account opened", time: "2 min ago", icon: Wallet },
                    { label: "Loan application received", time: "15 min ago", icon: Banknote },
                    { label: "Payment processed", time: "1 hr ago", icon: CreditCard },
                    { label: "KYC verification completed", time: "2 hrs ago", icon: Shield },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                        <item.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          {institution?.use_kob_flutterwave && (
            <FacilitatedPaymentsCard institutionId={institution.id} />
          )}
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                  <Receipt className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Transaction Fees & Billing</CardTitle>
                  <CardDescription>Fee structure and recent charges</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {institution?.id && <FeesDashboardWidget institutionId={institution.id} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit-api" className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <TrendingUp className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <CardTitle className="text-base">Credit Scoring API</CardTitle>
                  <CardDescription>Query customer credit scores for lending decisions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {institution?.id ? (
                <CreditApiIntegrationWidget institutionId={institution.id} />
              ) : (
                <p className="text-muted-foreground">Contact admin to get Credit API credentials</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeesDashboardWidget({ institutionId }: { institutionId: string }) {
  const [fees, setFees] = useState<any[]>([]);
  const [structures, setStructures] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (institutionId) loadFeeData();
  }, [institutionId]);

  const loadFeeData = async () => {
    setLoading(true);
    const { data: feesData } = await supabase.from('transaction_fees').select('*').eq('institution_id', institutionId).order('transaction_date', { ascending: false }).limit(20);
    const { data: structuresData } = await supabase.from('fee_structures').select('*').eq('institution_id', institutionId).eq('is_active', true);
    setFees(feesData || []);
    setStructures(structuresData || []);
    setLoading(false);
  };

  const totalFeesThisMonth = fees
    .filter(f => new Date(f.transaction_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .reduce((sum, f) => sum + Number(f.final_fee), 0);

  if (loading) {
    return <div className="space-y-3"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fees This Month</p>
          </div>
          <p className="text-2xl font-bold">{totalFeesThisMonth.toLocaleString()} XAF</p>
        </div>
        <div className="rounded-xl bg-muted/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Transactions</p>
          </div>
          <p className="text-2xl font-bold">{fees.length}</p>
        </div>
      </div>

      {structures.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Fee Structures</h4>
          <div className="space-y-2">
            {structures.map(structure => (
              <div key={structure.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{structure.transaction_type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {structure.fee_model === 'fixed' && `Fixed: ${structure.fixed_amount} XAF`}
                    {structure.fee_model === 'percentage' && `${structure.percentage_rate}%`}
                    {structure.fee_model === 'hybrid' && `${structure.fixed_amount} XAF + ${structure.percentage_rate}%`}
                    {structure.fee_model === 'tiered' && 'Tiered pricing'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  Since {new Date(structure.effective_from).toLocaleDateString()}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {fees.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-3">Recent Transaction Fees</h4>
          <div className="space-y-2">
            {fees.slice(0, 8).map(fee => (
              <div key={fee.id} className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{fee.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground font-mono">{fee.transaction_ref}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{Number(fee.final_fee).toLocaleString()} XAF</p>
                  <Badge variant={fee.billing_status === 'paid' ? 'default' : fee.billing_status === 'invoiced' ? 'secondary' : 'outline'} className="text-[10px]">
                    {fee.billing_status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fees.length === 0 && structures.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Receipt className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No fees or billing data yet</p>
        </div>
      )}
    </div>
  );
}
