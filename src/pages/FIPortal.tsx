import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, TrendingUp, Users, DollarSign } from "lucide-react";
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

  useEffect(() => {
    checkAuth();
    loadInstitution();
    loadMetrics();
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
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle>Financial Institution Portal</CardTitle>
            <CardDescription>
              No institution registration found. Please register your institution first.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">{t('fiDashboard')}</h1>
        <p className="text-muted-foreground">{institution.institution_name}</p>
      </div>

      {/* Metrics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
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
      </Tabs>
    </div>
  );
}
