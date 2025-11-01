import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { FacilitatedPaymentsCard } from "@/components/institution/FacilitatedPaymentsCard";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingUp, Users, DollarSign, Receipt } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageContext";

export default function FIPortal() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [institution, setInstitution] = useState<any>(null);
  const [metrics, setMetrics] = useState({
    totalTransactions: 0,
    totalVolume: 0,
    activeAccounts: 0,
    apiCalls: 0,
  });

  const checkAuthAndInstitution = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    await loadInstitution();
    await loadMetrics();
  };

  useEffect(() => {
    checkAuthAndInstitution();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }
  };

  const loadInstitution = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("institutions")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!data) {
      navigate('/register');
      return;
    }

    // Check institution status
    if (data.status === 'pending') {
      navigate('/pending-approval');
      return;
    } else if (data.status === 'rejected') {
      navigate('/pending-approval');
      return;
    }

    setInstitution(data);
  };

  const loadMetrics = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get institution
    const { data: inst } = await supabase
      .from("institutions")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!inst) return;

    // Get metrics
    const { data: transactions } = await supabase
      .from("transactions")
      .select("amount", { count: "exact" })
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const { data: accounts } = await supabase
      .from("accounts")
      .select("id", { count: "exact" })
      .eq("is_active", true);

    const { data: apiUsage } = await supabase
      .from("api_usage_metrics")
      .select("id", { count: "exact" })
      .eq("institution_id", inst.id)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    const totalVolume = transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    setMetrics({
      totalTransactions: transactions?.length || 0,
      totalVolume,
      activeAccounts: accounts?.length || 0,
      apiCalls: apiUsage?.length || 0,
    });
  };

  if (!institution) {
    return (
      <InstitutionLayout>
        <Card>
          <CardHeader>
            <CardTitle>Financial Institution Portal</CardTitle>
            <CardDescription>
              No institution registration found. Please register your institution first.
            </CardDescription>
          </CardHeader>
        </Card>
      </InstitutionLayout>
    );
  }

  const isDeveloper = institution.institution_type === 'developer';
  const sandboxCreds = institution.sandbox_credentials as any;

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t('fiDashboard')}</h1>
          <p className="text-muted-foreground mt-2">{institution.institution_name}</p>
          {isDeveloper && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">🚀 Developer Mode Active</h3>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                You have access to sandbox environment and API credentials
              </p>
            </div>
          )}
        </div>

      {/* Sandbox Credentials for Developers */}
      {isDeveloper && sandboxCreds && (
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-blue-600" />
              Sandbox API Credentials
            </CardTitle>
            <CardDescription>
              Use these credentials to test your integration in our sandbox environment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Client ID</p>
                  <code className="text-sm font-mono">{sandboxCreds.client_id}</code>
                </div>
                <div className="p-4 bg-muted rounded-lg">
                  <p className="text-xs font-semibold text-muted-foreground mb-1">Client Secret</p>
                  <code className="text-sm font-mono">{sandboxCreds.client_secret}</code>
                </div>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Sandbox URL</p>
                <code className="text-sm font-mono">{sandboxCreds.sandbox_url}</code>
              </div>
              <div className="flex gap-2 flex-wrap">
                <a href="/documentation" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  📚 API Documentation
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="/developer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                  🔧 Developer Portal
                </a>
                <span className="text-muted-foreground">•</span>
                <a href="https://github.com/kob-platform/examples" className="text-sm text-blue-600 dark:text-blue-400 hover:underline" target="_blank" rel="noopener">
                  💻 Code Examples
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('transactions')}</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalTransactions}</div>
            <p className="text-xs text-muted-foreground">Last 30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Volume</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalVolume.toLocaleString()} XAF</div>
            <p className="text-xs text-muted-foreground">Total processed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('accounts')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.activeAccounts}</div>
            <p className="text-xs text-muted-foreground">Active accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('apiUsage')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.apiCalls}</div>
            <p className="text-xs text-muted-foreground">API calls</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">{t('transactions')}</TabsTrigger>
          <TabsTrigger value="analytics">{t('analytics')}</TabsTrigger>
          <TabsTrigger value="compliance">{t('compliance')}</TabsTrigger>
          <TabsTrigger value="fees">Fees & Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>System Status</CardTitle>
              <CardDescription>Real-time system health and performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span>API Status</span>
                  <span className="text-green-600 font-medium">Operational</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Response Time</span>
                  <span className="font-medium">245ms</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Success Rate</span>
                  <span className="font-medium">99.8%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>Monitor transaction activity in real-time</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Transaction monitoring interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance Analytics</CardTitle>
              <CardDescription>Detailed insights and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Analytics dashboard coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Reports</CardTitle>
              <CardDescription>Regulatory reporting and audit trails</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Compliance reporting interface coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fees" className="space-y-4">
          {institution?.use_kob_flutterwave && (
            <FacilitatedPaymentsCard institutionId={institution.id} />
          )}
          
          <Card>
            <CardHeader>
              <CardTitle>Transaction Fees & Billing</CardTitle>
              <CardDescription>Your current fee structure and recent charges</CardDescription>
            </CardHeader>
            <CardContent>
              {institution?.id && <FeesDashboardWidget institutionId={institution.id} />}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </InstitutionLayout>
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
    const { data: feesData } = await supabase
      .from('transaction_fees')
      .select('*')
      .eq('institution_id', institutionId)
      .order('transaction_date', { ascending: false })
      .limit(20);
    
    const { data: structuresData } = await supabase
      .from('fee_structures')
      .select('*')
      .eq('institution_id', institutionId)
      .eq('is_active', true);
    
    setFees(feesData || []);
    setStructures(structuresData || []);
    setLoading(false);
  };

  const totalFeesThisMonth = fees
    .filter(f => new Date(f.transaction_date) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1))
    .reduce((sum, f) => sum + Number(f.final_fee), 0);

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading fee data...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Receipt className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Fees This Month</p>
            </div>
            <p className="text-3xl font-bold">{totalFeesThisMonth.toLocaleString()} XAF</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1">
              <Activity className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Total Transactions</p>
            </div>
            <p className="text-3xl font-bold">{fees.length}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Your Fee Structures</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {structures.map(structure => (
              <div key={structure.id} className="p-4 border rounded-lg flex justify-between items-center hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">{structure.transaction_type.replace(/_/g, ' ').toUpperCase()}</p>
                  <p className="text-sm text-muted-foreground">
                    {structure.fee_model === 'fixed' && `Fixed: ${structure.fixed_amount} XAF`}
                    {structure.fee_model === 'percentage' && `${structure.percentage_rate}%`}
                    {structure.fee_model === 'hybrid' && `${structure.fixed_amount} XAF + ${structure.percentage_rate}%`}
                    {structure.fee_model === 'tiered' && 'Tiered pricing'}
                  </p>
                </div>
                <span className="text-xs bg-muted px-2 py-1 rounded">
                  Since {new Date(structure.effective_from).toLocaleDateString()}
                </span>
              </div>
            ))}
            {structures.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No fee structures configured yet</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Transaction Fees</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {fees.slice(0, 10).map(fee => (
              <div key={fee.id} className="p-4 border rounded-lg flex justify-between items-center hover:bg-muted/50 transition-colors">
                <div>
                  <p className="font-medium">{fee.transaction_type.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-muted-foreground">{fee.transaction_ref}</p>
                  <p className="text-xs text-muted-foreground">{new Date(fee.transaction_date).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{Number(fee.final_fee).toLocaleString()} XAF</p>
                  <span className={`text-xs px-2 py-1 rounded ${
                    fee.billing_status === 'paid' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' :
                    fee.billing_status === 'invoiced' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100' :
                    'bg-muted text-muted-foreground'
                  }`}>
                    {fee.billing_status}
                  </span>
                </div>
              </div>
            ))}
            {fees.length === 0 && (
              <p className="text-center text-muted-foreground py-4">No transaction fees yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
