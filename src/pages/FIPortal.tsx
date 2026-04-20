import { FacilitatedPaymentsCard } from "@/components/institution/FacilitatedPaymentsCard";
import { CreditApiIntegrationWidget } from "@/components/credit-api/CreditApiIntegrationWidget";
import { FIPortalRevenueChart } from "@/components/institution/FIPortalRevenueChart";
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
  Wallet,
  MapPin,
  Banknote,
  PiggyBank,
  Shield,
  BookOpen,
  CreditCard,
  ArrowUpDown,
  CheckCircle2,
  Clock,
  ChevronRight,
  LayoutDashboard,
  Building2,
  Plug,
  FileCheck,
  ArrowRightLeft,
} from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { TranslationHarvester } from "@/components/i18n/TranslationHarvester";

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
  const [revenueTransactions, setRevenueTransactions] = useState<{ amount: number; created_at: string }[]>([]);

  useEffect(() => { checkAuthAndInstitution(); }, []);

  const resolveInstitution = async (userId: string) => {
    // Check ownership first
    const { data: ownedInst } = await supabase.from("institutions").select("*").eq("user_id", userId).maybeSingle();
    if (ownedInst) return ownedInst;
    // Check staff assignment via RPC
    const { data: staffInstId } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
    if (staffInstId) {
      const { data: staffInst } = await supabase.from("institutions").select("*").eq("id", staffInstId).maybeSingle();
      return staffInst;
    }
    return null;
  };

  const checkAuthAndInstitution = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Check if user is admin — admins can access all dashboards
      const { data: isAdmin } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin' as any,
      });

      const inst = await resolveInstitution(user.id);

      if (!inst && isAdmin) {
        // Admin with no institution — show portal in admin overview mode
        setInstitution({ id: 'admin-overview', name: 'Admin Overview', status: 'approved', institution_type: 'admin' });
        setLoading(false);
        return;
      }

      if (!inst) { navigate('/register'); return; }
      if (inst.status === 'pending' || inst.status === 'rejected') { navigate('/pending-approval'); return; }
      setInstitution(inst);
      await loadMetrics(inst.id);
    } catch (error) {
      console.error("FI Portal load error:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadMetrics = async (instId: string) => {
    
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    
    // Get institution's accounts first, then scope queries
    const { data: instAccounts } = await supabase.from("accounts").select("id").eq("institution_id", instId).eq("is_active", true);
    const accountIds = instAccounts?.map(a => a.id) || [];
    
    let txCount = 0;
    let totalVolume = 0;
    if (accountIds.length > 0) {
      const { data: transactions } = await supabase
        .from("transactions")
        .select("amount, created_at")
        .in("account_id", accountIds)
        .gte("created_at", thirtyDaysAgo);
      txCount = transactions?.length || 0;
      totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
      setRevenueTransactions(transactions?.map(t => ({ amount: Number(t.amount), created_at: t.created_at })) || []);
    }
    
    const { data: apiUsage } = await supabase
      .from("api_usage_metrics")
      .select("id", { count: "exact" })
      .eq("institution_id", instId)
      .gte("created_at", thirtyDaysAgo);
    
    setMetrics({
      totalTransactions: txCount,
      totalVolume,
      activeAccounts: accountIds.length,
      apiCalls: apiUsage?.length || 0,
    });
  };

  if (!institution && !loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full border-border/60">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
              <Shield className="h-6 w-6 text-muted-foreground" />
            </div>
            <CardTitle className="text-lg">Financial Institution Portal</CardTitle>
            <CardDescription>No institution registration found. Please register first.</CardDescription>
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
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="grid gap-4 md:grid-cols-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isDeveloper = institution?.institution_type === 'developer';
  const sandboxCreds = institution?.sandbox_credentials as any;

  const quickActions = [
    { label: "Accounts", icon: Wallet, path: "/fi-portal/accounts", desc: "Manage accounts", color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
    { label: "Branches", icon: MapPin, path: "/fi-portal/branches", desc: "Branch network", color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
    { label: "Loans", icon: Banknote, path: "/fi-portal/loans", desc: "Lending products", color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
    { label: "Savings", icon: PiggyBank, path: "/fi-portal/savings", desc: "Savings products", color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
    { label: "Customers", icon: Users, path: "/fi-portal/customers", desc: "KYC & compliance", color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
    { label: "Transactions", icon: ArrowUpDown, path: "/fi-portal/transactions", desc: "Transaction history", color: "text-fi-indigo bg-fi-indigo/10 border-fi-indigo/20" },
    { label: "Payments", icon: CreditCard, path: "/fi-portal/payments", desc: "Payment processing", color: "text-fi-rose bg-fi-rose/10 border-fi-rose/20" },
    { label: "Ledger", icon: BookOpen, path: "/fi-portal/ledger", desc: "Chart of accounts", color: "text-fi-cyan bg-fi-cyan/10 border-fi-cyan/20" },
  ];

  return (
    <div className="space-y-8">
      <TranslationHarvester category="fi-portal" />
      {/* Page Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-blue/10 border border-fi-blue/20">
            <LayoutDashboard className="h-5 w-5 text-fi-blue" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{institution?.institution_name}</h1>
            <p className="text-sm text-muted-foreground">
              {isDeveloper ? "Developer Sandbox" : "Banking Operations Dashboard"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <Badge variant="outline" className="border-border text-muted-foreground">
            <CheckCircle2 className="h-3 w-3 mr-1.5" />
            {institution?.status === 'approved' ? 'Active' : institution?.status}
          </Badge>
        </div>
      </div>

      {/* Developer Sandbox Credentials */}
      {isDeveloper && sandboxCreds && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fi-blue/10 border border-fi-blue/20">
                <Activity className="h-4 w-4 text-fi-blue" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Sandbox API Credentials</CardTitle>
                <CardDescription className="text-xs">Use these to test your integration</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client ID</p>
                <code className="text-xs font-mono break-all">{sandboxCreds.client_id}</code>
              </div>
              <div className="rounded-lg border border-border bg-muted/50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Client Secret</p>
                <code className="text-xs font-mono break-all">{sandboxCreds.client_secret}</code>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-border bg-muted/50 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Sandbox URL</p>
              <code className="text-xs font-mono break-all">{sandboxCreds.sandbox_url}</code>
            </div>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" asChild><Link to="/documentation">API Docs</Link></Button>
              <Button variant="outline" size="sm" asChild><Link to="/developer">Developer Portal</Link></Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: t('transactions'), value: metrics.totalTransactions.toLocaleString(), sub: "Last 30 days", icon: Activity, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
          { label: "Volume", value: `${metrics.totalVolume.toLocaleString()} XAF`, sub: "Total processed", icon: DollarSign, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: t('accounts'), value: metrics.activeAccounts.toLocaleString(), sub: "Active accounts", icon: Users, color: "text-fi-purple bg-fi-purple/10 border-fi-purple/20" },
          { label: t('apiUsage'), value: metrics.apiCalls.toLocaleString(), sub: "API calls (30d)", icon: TrendingUp, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/60">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
                  <p className="mt-2 text-2xl font-bold tracking-tight">{stat.value}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{stat.sub}</p>
                </div>
                <div className={`flex h-9 w-9 items-center justify-center rounded-lg border ${stat.color}`}>
                  <stat.icon className="h-4 w-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {quickActions.map((action) => (
            <Link
              key={action.path}
              to={action.path}
              className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-4 hover:border-primary/30 hover:shadow-sm transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${action.color}`}>
                  <action.icon className="h-4 w-4" />
                </div>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
              </div>
              <div>
                <p className="text-sm font-medium">{action.label}</p>
                <p className="text-[11px] text-muted-foreground">{action.desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Banking Dashboard Quick Access */}
      <Card className="border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-fi-indigo/10 border border-fi-indigo/20">
                <Building2 className="h-4 w-4 text-fi-indigo" />
              </div>
              <div>
                <CardTitle className="text-sm font-semibold">Banking Dashboard</CardTitle>
                <CardDescription className="text-xs">Connector management, approvals, transfers and reporting</CardDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/fi-portal/banking">
                Open Dashboard
                <ChevronRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Connectors", icon: Plug, path: "/fi-portal/banking/connector-setup", desc: "Setup & configure" },
              { label: "Approvals", icon: FileCheck, path: "/fi-portal/banking/approvals", desc: "Review queue" },
              { label: "Transfers", icon: ArrowRightLeft, path: "/fi-portal/banking/transfers", desc: "Send & track" },
              { label: "Reports", icon: Receipt, path: "/fi-portal/banking/reports", desc: "COBAC statements" },
            ].map((item) => (
              <Link
                key={item.path}
                to={item.path}
                className="group flex items-center gap-3 rounded-lg border border-border/40 bg-muted/30 p-3 hover:border-primary/30 hover:bg-muted/50 transition-all duration-200"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border/50 bg-background">
                  <item.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-5">
        <TabsList className="inline-flex h-9 items-center rounded-lg bg-muted p-1 text-muted-foreground">
          <TabsTrigger value="overview" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Overview</TabsTrigger>
          <TabsTrigger value="fees" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Fees & Billing</TabsTrigger>
          <TabsTrigger value="credit-api" className="rounded-md px-3 text-xs font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Credit API</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <FIPortalRevenueChart transactions={revenueTransactions} />
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-green/10 border border-fi-green/20">
                    <CheckCircle2 className="h-4 w-4 text-fi-green" />
                  </div>
                  <CardTitle className="text-sm font-semibold">System Status</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { label: "API Gateway", value: "Operational" },
                    { label: "Response Time", value: "245ms" },
                    { label: "Success Rate", value: "99.8%" },
                    { label: "Uptime (30d)", value: "99.99%" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center justify-between py-1.5 border-b border-border/40 last:border-0">
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{item.value}</span>
                        <span className="h-1.5 w-1.5 rounded-full bg-fi-green" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-indigo/10 border border-fi-indigo/20">
                    <Clock className="h-4 w-4 text-fi-indigo" />
                  </div>
                  <CardTitle className="text-sm font-semibold">Recent Activity</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {[
                    { label: "New account opened", time: "2 min ago", icon: Wallet, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
                    { label: "Loan application received", time: "15 min ago", icon: Banknote, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
                    { label: "Payment processed", time: "1 hr ago", icon: CreditCard, color: "text-fi-rose bg-fi-rose/10 border-fi-rose/20" },
                    { label: "KYC verification completed", time: "2 hrs ago", icon: Shield, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
                  ].map((item) => (
                    <div key={item.label} className="flex items-center gap-3 py-1.5 border-b border-border/40 last:border-0">
                      <div className={`flex h-7 w-7 items-center justify-center rounded-md border ${item.color}`}>
                        <item.icon className="h-3.5 w-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{item.label}</p>
                        <p className="text-[11px] text-muted-foreground">{item.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          {institution?.use_kob_flutterwave && <FacilitatedPaymentsCard institutionId={institution.id} />}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-amber/10 border border-fi-amber/20">
                  <Receipt className="h-4 w-4 text-fi-amber" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Transaction Fees & Billing</CardTitle>
                  <CardDescription className="text-xs">Fee structure and recent charges</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {institution?.id && <FeesDashboardWidget institutionId={institution.id} />}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credit-api" className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-teal/10 border border-fi-teal/20">
                  <TrendingUp className="h-4 w-4 text-fi-teal" />
                </div>
                <div>
                  <CardTitle className="text-sm font-semibold">Credit Scoring API</CardTitle>
                  <CardDescription className="text-xs">Query customer credit scores for lending decisions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {institution?.id ? <CreditApiIntegrationWidget institutionId={institution.id} /> : <p className="text-muted-foreground text-sm">Contact admin for Credit API credentials</p>}
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

  useEffect(() => { if (institutionId) loadFeeData(); }, [institutionId]);

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

  if (loading) return <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Fees This Month</p>
          </div>
          <p className="text-xl font-bold">{totalFeesThisMonth.toLocaleString()} XAF</p>
        </div>
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Total Transactions</p>
          </div>
          <p className="text-xl font-bold">{fees.length}</p>
        </div>
      </div>

      {structures.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Fee Structures</h4>
          <div className="space-y-1.5">
            {structures.map(structure => (
              <div key={structure.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{structure.transaction_type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">
                    {structure.fee_model === 'fixed' && `Fixed: ${structure.fixed_amount} XAF`}
                    {structure.fee_model === 'percentage' && `${structure.percentage_rate}%`}
                    {structure.fee_model === 'hybrid' && `${structure.fixed_amount} XAF + ${structure.percentage_rate}%`}
                    {structure.fee_model === 'tiered' && 'Tiered pricing'}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">Since {new Date(structure.effective_from).toLocaleDateString()}</Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {fees.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Fees</h4>
          <div className="space-y-1.5">
            {fees.slice(0, 8).map(fee => (
              <div key={fee.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
                <div>
                  <p className="text-sm font-medium">{fee.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">{fee.transaction_ref}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold">{Number(fee.final_fee).toLocaleString()} XAF</p>
                  <Badge variant={fee.billing_status === 'paid' ? 'default' : 'outline'} className="text-[10px]">{fee.billing_status}</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {fees.length === 0 && structures.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Receipt className="h-8 w-8 mx-auto mb-2 opacity-30" />
          <p className="text-xs">No fees or billing data yet</p>
        </div>
      )}
    </div>
  );
}
