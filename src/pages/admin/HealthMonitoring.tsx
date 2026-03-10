import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Server,
  Zap,
  Database,
  Shield,
  CreditCard,
  Landmark,
  Smartphone,
  Lock,
  Webhook,
  FileText,
  Globe
} from "lucide-react";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'down' | 'unknown';
  responseTime?: number;
  lastChecked: string;
  message?: string;
  category: string;
}

interface FunctionCategory {
  name: string;
  icon: any;
  functions: string[];
}

const FUNCTION_CATEGORIES: FunctionCategory[] = [
  {
    name: 'Core Health',
    icon: Activity,
    functions: ['api-health', 'system-health-check', 'crediq-health-check']
  },
  {
    name: 'OAuth & OIDC',
    icon: Lock,
    functions: ['jwks-endpoint', 'oidc-config', 'oauth-authorize', 'oauth-token', 'oauth-introspect', 'par-endpoint']
  },
  {
    name: 'AISP (Account Info)',
    icon: Database,
    functions: ['aisp-create-consent', 'aisp-accounts', 'aisp-balances', 'aisp-transactions', 'aisp-beneficiaries', 'aisp-standing-orders', 'aisp-direct-debits']
  },
  {
    name: 'PISP (Payments)',
    icon: CreditCard,
    functions: ['pisp-create-consent', 'pisp-domestic-payment', 'pisp-payment-details', 'pisp-payment-submission']
  },
  {
    name: 'Mobile Money',
    icon: Smartphone,
    functions: ['mobile-money-charge', 'mobile-money-transfer', 'mobile-money-verify', 'mobile-money-to-bank']
  },
  {
    name: 'Banking Operations',
    icon: Landmark,
    functions: ['bank-sync', 'bank-reconcile', 'bank-import-transactions', 'bulk-transfers', 'flutterwave-list-banks', 'flutterwave-verify-bank', 'flutterwave-bank-transfer']
  },
  {
    name: 'Payment Processing',
    icon: CreditCard,
    functions: ['stripe-payment-intent', 'stripe-confirm-payment', 'stripe-save-card']
  },
  {
    name: 'Authentication',
    icon: Shield,
    functions: ['phone-auth-send-otp', 'phone-auth-verify-otp', 'pin-code-set', 'pin-code-verify', 'sca-initiate', 'sca-verify', 'captcha-generate', 'captcha-verify']
  },
  {
    name: 'Compliance & Security',
    icon: Shield,
    functions: ['transaction-monitor', 'sanctions-screen', 'certificate-upload', 'certificate-list', 'certificate-revoke', 'certificate-expiry-monitor']
  },
  {
    name: 'SWIFT & ISO20022',
    icon: Globe,
    functions: ['swift-mt103-parser', 'swift-mt940-parser', 'swift-mt103-generator', 'iso20022-pain001-parser', 'iso20022-camt053-parser', 'iso20022-pacs008-generator', 'iso20022-pacs002-generator', 'validate-iban', 'validate-bic']
  },
  {
    name: 'Webhooks & Events',
    icon: Webhook,
    functions: ['webhook-delivery', 'flutterwave-transfer-webhook']
  },
  {
    name: 'Documentation',
    icon: FileText,
    functions: ['public-api-spec', 'postman-collection']
  },
  {
    name: 'CrediQ',
    icon: Activity,
    functions: ['crediq-generate-baseline-score', 'crediq-calculate-health-metrics', 'crediq-generate-action-plan', 'crediq-emails']
  }
];

export default function HealthMonitoring() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [healthChecks, setHealthChecks] = useState<HealthCheck[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    runHealthChecks();
  }, []);

  const runHealthChecks = async () => {
    setLoading(true);
    const checks: HealthCheck[] = [];

    try {
      // Test Core Health Endpoints
      const coreHealthChecks = ['api-health', 'system-health-check', 'crediq-health-check'];
      
      for (const funcName of coreHealthChecks) {
        const startTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke(funcName);
          const responseTime = Date.now() - startTime;
          
          checks.push({
            name: funcName,
            status: error ? 'down' : 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            message: error ? error.message : 'Operational',
            category: 'Core Health'
          });
        } catch (error: any) {
          checks.push({
            name: funcName,
            status: 'down',
            lastChecked: new Date().toISOString(),
            message: error.message,
            category: 'Core Health'
          });
        }
      }

      // Test OAuth endpoints
      const oauthChecks = ['jwks-endpoint', 'oidc-config'];
      for (const funcName of oauthChecks) {
        const startTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke(funcName);
          const responseTime = Date.now() - startTime;
          
          checks.push({
            name: funcName,
            status: error ? 'down' : 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            message: error ? error.message : 'Operational',
            category: 'OAuth & OIDC'
          });
        } catch (error: any) {
          checks.push({
            name: funcName,
            status: 'down',
            lastChecked: new Date().toISOString(),
            message: error.message,
            category: 'OAuth & OIDC'
          });
        }
      }

      // Test Documentation endpoints
      const docChecks = ['public-api-spec'];
      for (const funcName of docChecks) {
        const startTime = Date.now();
        try {
          const { data, error } = await supabase.functions.invoke(funcName);
          const responseTime = Date.now() - startTime;
          
          checks.push({
            name: funcName,
            status: error ? 'down' : 'healthy',
            responseTime,
            lastChecked: new Date().toISOString(),
            message: error ? error.message : 'Operational',
            category: 'Documentation'
          });
        } catch (error: any) {
          checks.push({
            name: funcName,
            status: 'down',
            lastChecked: new Date().toISOString(),
            message: error.message,
            category: 'Documentation'
          });
        }
      }

      setHealthChecks(checks);
      setLastRefresh(new Date());
      
      const healthyCount = checks.filter(c => c.status === 'healthy').length;
      const downCount = checks.filter(c => c.status === 'down').length;
      
      toast({
        title: "Health Check Complete",
        description: `${healthyCount} healthy, ${downCount} down out of ${checks.length} functions checked`
      });
    } catch (error: any) {
      console.error('Error running health checks:', error);
      toast({
        title: "Health Check Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: any; icon: any; color: string }> = {
      'healthy': { variant: 'default', icon: CheckCircle2, color: 'text-green-600' },
      'degraded': { variant: 'secondary', icon: AlertCircle, color: 'text-yellow-600' },
      'down': { variant: 'destructive', icon: AlertCircle, color: 'text-red-600' },
      'unknown': { variant: 'outline', icon: Clock, color: 'text-gray-600' }
    };

    const config = variants[status] || variants.unknown;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="flex items-center gap-1 w-fit">
        <Icon className={`h-3 w-3 ${config.color}`} />
        {status}
      </Badge>
    );
  };

  const getCategoryStats = (categoryName: string) => {
    const categoryChecks = healthChecks.filter(c => c.category === categoryName);
    const healthy = categoryChecks.filter(c => c.status === 'healthy').length;
    const total = categoryChecks.length;
    const avgResponseTime = categoryChecks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / categoryChecks.length;
    
    return { healthy, total, avgResponseTime: Math.round(avgResponseTime) };
  };

  const getOverallStats = () => {
    const total = healthChecks.length;
    const healthy = healthChecks.filter(c => c.status === 'healthy').length;
    const degraded = healthChecks.filter(c => c.status === 'degraded').length;
    const down = healthChecks.filter(c => c.status === 'down').length;
    const avgResponseTime = healthChecks.reduce((sum, c) => sum + (c.responseTime || 0), 0) / total;
    
    return { total, healthy, degraded, down, avgResponseTime: Math.round(avgResponseTime) };
  };

  const stats = getOverallStats();

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold">Edge Functions Health Monitor</h1>
            <p className="text-muted-foreground mt-2">
              Real-time health status of all 83 edge functions
            </p>
          </div>
          <Button onClick={runHealthChecks} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Checking...' : 'Refresh'}
          </Button>
        </div>

        {/* Overall Stats */}
        <div className="grid md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Total Functions</p>
                  <p className="text-3xl font-bold">{stats.total || 83}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Server className="h-6 w-6 text-primary" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Monitored edge functions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Healthy</p>
                  <p className="text-3xl font-bold text-green-600">{stats.healthy}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Operational functions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Down</p>
                  <p className="text-3xl font-bold text-red-600">{stats.down}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-red-100 flex items-center justify-center">
                  <AlertCircle className="h-6 w-6 text-red-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Failed functions
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Avg Response</p>
                  <p className="text-3xl font-bold">{stats.avgResponseTime || 0}ms</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Zap className="h-6 w-6 text-blue-600" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Average latency
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Last Refresh */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="h-4 w-4" />
          Last checked: {lastRefresh.toLocaleString()}
        </div>

        {/* Function Categories */}
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="core">Core Services</TabsTrigger>
            <TabsTrigger value="banking">Banking</TabsTrigger>
            <TabsTrigger value="all">All Functions</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {FUNCTION_CATEGORIES.map((category) => {
                const stats = getCategoryStats(category.name);
                const Icon = category.icon;
                const healthPercentage = stats.total > 0 ? (stats.healthy / stats.total) * 100 : 0;
                
                return (
                  <Card key={category.name}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <Icon className="h-5 w-5" />
                        {category.name}
                      </CardTitle>
                      <CardDescription>
                        {stats.healthy} / {stats.total || category.functions.length} healthy
                        {stats.avgResponseTime > 0 && ` • ${stats.avgResponseTime}ms avg`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="w-full bg-secondary rounded-full h-2">
                        <div 
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${healthPercentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        {category.functions.length} functions in category
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="core" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Core Health Endpoints</CardTitle>
                <CardDescription>Critical system health monitoring functions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {healthChecks.filter(c => c.category === 'Core Health').map((check) => (
                    <div key={check.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Activity className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{check.name}</p>
                          <p className="text-sm text-muted-foreground">{check.message}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {check.responseTime && (
                          <span className="text-sm text-muted-foreground">{check.responseTime}ms</span>
                        )}
                        {getStatusBadge(check.status)}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="banking" className="space-y-4">
            {['Mobile Money', 'Banking Operations', 'Payment Processing'].map(categoryName => {
              const categoryChecks = healthChecks.filter(c => c.category === categoryName);
              if (categoryChecks.length === 0) return null;
              
              return (
                <Card key={categoryName}>
                  <CardHeader>
                    <CardTitle>{categoryName}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {categoryChecks.map((check) => (
                        <div key={check.name} className="flex items-center justify-between p-3 border rounded-lg">
                          <div className="flex items-center gap-3">
                            <Server className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="font-medium">{check.name}</p>
                              <p className="text-sm text-muted-foreground">{check.message}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {check.responseTime && (
                              <span className="text-sm text-muted-foreground">{check.responseTime}ms</span>
                            )}
                            {getStatusBadge(check.status)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </TabsContent>

          <TabsContent value="all" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>All Edge Functions ({FUNCTION_CATEGORIES.reduce((sum, cat) => sum + cat.functions.length, 0)})</CardTitle>
                <CardDescription>Complete list of all edge functions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {FUNCTION_CATEGORIES.map((category) => (
                    <div key={category.name}>
                      <h3 className="font-semibold mb-3 flex items-center gap-2">
                        <category.icon className="h-5 w-5" />
                        {category.name}
                      </h3>
                      <div className="grid md:grid-cols-2 gap-2">
                        {category.functions.map((funcName) => {
                          const check = healthChecks.find(c => c.name === funcName);
                          return (
                            <div key={funcName} className="flex items-center justify-between p-2 border rounded text-sm">
                              <span className="font-mono">{funcName}</span>
                              {check ? getStatusBadge(check.status) : (
                                <Badge variant="outline" className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Not Tested
                                </Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
