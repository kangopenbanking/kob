import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ShoppingCart, 
  Store, 
  TrendingUp, 
  CreditCard, 
  ExternalLink,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2
} from "lucide-react";
import { Link } from "react-router-dom";

interface WooCommerceMerchant {
  id: string;
  store_name: string;
  store_url: string;
  status: string;
  created_at: string;
}

interface WooCommerceTransaction {
  id: string;
  woocommerce_order_id: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  payment_method: string;
}

// Helper to safely fetch data avoiding deep type instantiation
async function fetchMerchants(userId: string): Promise<WooCommerceMerchant[]> {
  const client: any = supabase;
  const { data } = await client
    .from("woocommerce_merchants")
    .select("*")
    .eq("user_id", userId);
  
  return (data || []).map((m: any) => ({
    id: String(m.id || ''),
    store_name: String(m.store_name || ''),
    store_url: String(m.store_url || ''),
    status: String(m.status || ''),
    created_at: String(m.created_at || '')
  }));
}

async function fetchTransactions(merchantIds: string[]): Promise<WooCommerceTransaction[]> {
  const client: any = supabase;
  const { data } = await client
    .from("woocommerce_transactions")
    .select("*")
    .in("merchant_id", merchantIds)
    .limit(50);
  
  return (data || []).map((t: any) => ({
    id: String(t.id || ''),
    woocommerce_order_id: String(t.woocommerce_order_id || ''),
    amount: Number(t.amount || 0),
    currency: String(t.currency || 'XAF'),
    status: String(t.status || ''),
    created_at: String(t.created_at || ''),
    payment_method: String(t.payment_method || '')
  }));
}

export default function WooCommerceDashboard() {
  const navigate = useNavigate();
  const [merchants, setMerchants] = useState<WooCommerceMerchant[]>([]);
  const [transactions, setTransactions] = useState<WooCommerceTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTransactions: 0,
    totalVolume: 0,
    activeStores: 0,
    successRate: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      // Get institution
      const { data: institutionData } = await supabase
        .from("institutions")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!institutionData) {
        setLoading(false);
        return;
      }

      const institutionId = institutionData.id;

      // Load merchants using helper
      const merchantsData = await fetchMerchants(institutionId);
      setMerchants(merchantsData);

      // Load transactions
      if (merchantsData.length > 0) {
        const merchantIds = merchantsData.map(m => m.id);
        const transactionsData = await fetchTransactions(merchantIds);
        setTransactions(transactionsData);

        // Calculate stats
        const totalVolume = transactionsData.reduce((sum, t) => sum + t.amount, 0);
        const successfulTransactions = transactionsData.filter(t => t.status === 'completed').length;
        const successRate = transactionsData.length ? (successfulTransactions / transactionsData.length) * 100 : 0;

        setStats({
          totalTransactions: transactionsData.length,
          totalVolume,
          activeStores: merchantsData.filter(m => m.status === 'active').length,
          successRate: Math.round(successRate),
        });
      }
    } catch (error) {
      console.error("Error loading WooCommerce data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (merchants.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">WooCommerce Integration</h1>
          <p className="text-muted-foreground mt-2">
            Accept payments through your WooCommerce store with KOB
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <ShoppingCart className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No WooCommerce Stores Connected</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              Connect your WooCommerce store to accept payments via Mobile Money, 
              bank transfers, and cards through KOB's payment infrastructure.
            </p>
            <div className="flex gap-3">
              <Link to="/integrations/woocommerce-merchant-register">
                <Button>
                  <Store className="h-4 w-4 mr-2" />
                  Register Your Store
                </Button>
              </Link>
              <Link to="/integrations/woocommerce-docs">
                <Button variant="outline">
                  <FileText className="h-4 w-4 mr-2" />
                  View Documentation
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Why Use Woo for Kang?</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4">
                <CreditCard className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold mb-2">Multiple Payment Methods</h4>
                <p className="text-sm text-muted-foreground">
                  Accept MTN Mobile Money, Orange Money, bank transfers, and cards
                </p>
              </div>
              <div className="text-center p-4">
                <TrendingUp className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold mb-2">Real-time Analytics</h4>
                <p className="text-sm text-muted-foreground">
                  Track transactions and revenue in your dashboard
                </p>
              </div>
              <div className="text-center p-4">
                <CheckCircle className="h-8 w-8 mx-auto mb-3 text-primary" />
                <h4 className="font-semibold mb-2">Easy Integration</h4>
                <p className="text-sm text-muted-foreground">
                  Install our plugin and start accepting payments in minutes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">WooCommerce Integration</h1>
          <p className="text-muted-foreground mt-2">
            Manage your connected WooCommerce stores and transactions
          </p>
        </div>
        <Link to="/integrations/woocommerce-merchant-register">
          <Button>
            <Store className="h-4 w-4 mr-2" />
            Add Store
          </Button>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Stores</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeStores}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalTransactions}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalVolume.toLocaleString()} XAF</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.successRate}%</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="stores" className="space-y-4">
        <TabsList>
          <TabsTrigger value="stores">Connected Stores</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="stores" className="space-y-4">
          <div className="grid gap-4">
            {merchants.map((merchant) => (
              <Card key={merchant.id}>
                <CardContent className="flex items-center justify-between py-4">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Store className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold">{merchant.store_name}</h4>
                      <a 
                        href={merchant.store_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1"
                      >
                        {merchant.store_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant={merchant.status === 'active' ? 'default' : 'secondary'}>
                      {merchant.status}
                    </Badge>
                    <p className="text-sm text-muted-foreground">
                      Connected {new Date(merchant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
              <CardDescription>
                Transactions processed through your WooCommerce stores
              </CardDescription>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div 
                      key={tx.id} 
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <div>
                        <p className="font-medium">Order #{tx.woocommerce_order_id}</p>
                        <p className="text-sm text-muted-foreground">
                          {tx.payment_method} • {new Date(tx.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{tx.amount.toLocaleString()} {tx.currency}</p>
                        <Badge variant={tx.status === 'completed' ? 'default' : 'secondary'}>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Link to="/woo-for-kang">
              <Button variant="outline" size="sm">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Woo for Kang Plugin
              </Button>
            </Link>
            <Link to="/integrations/woocommerce-docs">
              <Button variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Documentation
              </Button>
            </Link>
            <Link to="/integrations/woocommerce-plugin-code">
              <Button variant="outline" size="sm">
                <ExternalLink className="h-4 w-4 mr-2" />
                Plugin Source Code
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
