import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Store, Download, RefreshCw, Eye, EyeOff, Copy, CheckCircle, XCircle, Clock, ShoppingCart, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";

interface Merchant {
  id: string;
  store_name: string;
  store_url: string;
  admin_email: string;
  status: string | null;
  plugin_version: string | null;
  api_key_hash: string;
  webhook_url: string | null;
  created_at: string;
  last_sync_at: string | null;
}

interface Transaction {
  id: string;
  merchant_id: string;
  woocommerce_order_id: string;
  transaction_ref: string;
  payment_method: string;
  amount: number;
  currency: string;
  status: string;
  customer_email: string | null;
  customer_phone: string | null;
  created_at: string;
  error_message: string | null;
}

interface Stats {
  total_merchants: number;
  active_merchants: number;
  total_transactions: number;
  completed_transactions: number;
  total_volume: number;
}

export default function WooCommerceManagement() {
  const [loading, setLoading] = useState(true);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [stats, setStats] = useState<Stats>({
    total_merchants: 0,
    active_merchants: 0,
    total_transactions: 0,
    completed_transactions: 0,
    total_volume: 0
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load merchants
      const { data: merchantsData, error: merchantsError } = await supabase
        .from("woocommerce_merchants")
        .select("*")
        .order("created_at", { ascending: false });

      if (merchantsError) throw merchantsError;

      // Load transactions
      const { data: transactionsData, error: transactionsError } = await supabase
        .from("woocommerce_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (transactionsError) throw transactionsError;

      setMerchants(merchantsData || []);
      setTransactions(transactionsData || []);

      // Calculate stats
      const activeMerchants = merchantsData?.filter(m => m.status === 'active').length || 0;
      const completedTxs = transactionsData?.filter(t => t.status === "completed").length || 0;
      const totalVolume = transactionsData
        ?.filter(t => t.status === "completed")
        .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

      setStats({
        total_merchants: merchantsData?.length || 0,
        active_merchants: activeMerchants,
        total_transactions: transactionsData?.length || 0,
        completed_transactions: completedTxs,
        total_volume: totalVolume
      });

    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleMerchantStatus = async (merchantId: string, currentStatus: string | null) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      const { error } = await supabase
        .from("woocommerce_merchants")
        .update({ status: newStatus })
        .eq("id", merchantId);

      if (error) throw error;

      toast({
        title: "Merchant updated",
        description: `Merchant ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      });

      loadData();
    } catch (error: any) {
      toast({
        title: "Error updating merchant",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const toggleKeyVisibility = (merchantId: string) => {
    setVisibleKeys(prev => {
      const newSet = new Set(prev);
      if (newSet.has(merchantId)) {
        newSet.delete(merchantId);
      } else {
        newSet.add(merchantId);
      }
      return newSet;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied to clipboard",
      description: "API key copied successfully"
    });
  };

  const exportTransactions = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Session expired — please log in again");
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/woocommerce-transaction-sync?format=csv`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`
          }
        }
      );

      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `woocommerce-transactions-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();

      toast({
        title: "Export successful",
        description: "Transactions exported to CSV"
      });
    } catch (error: any) {
      toast({
        title: "Export failed",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive"; icon: any }> = {
      completed: { variant: "default", icon: CheckCircle },
      pending: { variant: "secondary", icon: Clock },
      failed: { variant: "destructive", icon: XCircle }
    };

    const config = variants[status] || variants.pending;
    const Icon = config.icon;

    return (
      <Badge variant={config.variant} className="gap-1">
        <Icon className="h-3 w-3" />
        {status}
      </Badge>
    );
  };

  const filteredMerchants = merchants.filter(merchant => {
    const matchesSearch = merchant.store_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         merchant.store_url.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         merchant.admin_email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || merchant.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="space-y-6">
      <AdminPageHeader icon={ShoppingCart} title="WooCommerce Integration" description="Manage merchants and monitor WooCommerce transactions" />
        <div className="flex items-center justify-center min-h-[300px]">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground"  />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <AdminPageHeader icon={ShoppingCart} title="WooCommerce Integration" description="Manage merchants, monitor transactions, and clear demo data" />
      <div className="flex items-center justify-end gap-2">
        <Button onClick={loadData} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={async () => {
            if (!confirm('Clear ALL WooCommerce demo data (legacy merchants, transactions, POS connector imports)? This cannot be undone.')) return;
            try {
              const { data: { session } } = await supabase.auth.getSession();
              const res = await supabase.functions.invoke('woocommerce-admin-clear-demo', {
                body: { scope: 'all' },
                headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : undefined,
              });
              if (res.error) throw res.error;
              toast({ title: 'Demo data cleared', description: `Removed: ${JSON.stringify((res.data as any)?.counts || {})}` });
              loadData();
            } catch (e: any) {
              toast({ title: 'Clear failed', description: e.message, variant: 'destructive' });
            }
          }}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Clear Demo Data
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Merchants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_merchants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Merchants</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.active_merchants}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_transactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.completed_transactions}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total_volume.toLocaleString()} XAF</div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <Tabs defaultValue="merchants" className="space-y-4">
        <TabsList>
          <TabsTrigger value="merchants">Merchants</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        <TabsContent value="merchants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Registered Merchants</CardTitle>
              <CardDescription>View and manage WooCommerce store integrations</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 mb-4">
                <Input
                  placeholder="Search merchants..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Store Name</TableHead>
                      <TableHead>URL</TableHead>
                      <TableHead>Admin Email</TableHead>
                      <TableHead>Plugin Version</TableHead>
                      <TableHead>API Key Hash</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Sync</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMerchants.map((merchant) => (
                      <TableRow key={merchant.id}>
                        <TableCell className="font-medium">{merchant.store_name}</TableCell>
                        <TableCell>
                          <a href={merchant.store_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                            {merchant.store_url}
                          </a>
                        </TableCell>
                        <TableCell>{merchant.admin_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{merchant.plugin_version || 'N/A'}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <code className="text-xs">
                              {visibleKeys.has(merchant.id) ? merchant.api_key_hash : "••••••••••••••••"}
                            </code>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleKeyVisibility(merchant.id)}
                            >
                              {visibleKeys.has(merchant.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(merchant.api_key_hash)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={merchant.status === 'active' ? "default" : "secondary"}>
                            {merchant.status || 'Pending'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {merchant.last_sync_at ? formatDistanceToNow(new Date(merchant.last_sync_at), { addSuffix: true }) : 'Never'}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleMerchantStatus(merchant.id, merchant.status)}
                          >
                            {merchant.status === 'active' ? "Deactivate" : "Activate"}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Transactions</CardTitle>
                  <CardDescription>Monitor WooCommerce payment transactions</CardDescription>
                </div>
                <Button onClick={exportTransactions} variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction ID</TableHead>
                      <TableHead>Order ID</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-mono text-xs">{tx.transaction_ref}</TableCell>
                        <TableCell>{tx.woocommerce_order_id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{tx.payment_method}</Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          {Number(tx.amount).toLocaleString()} {tx.currency}
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            {tx.customer_email && <div>{tx.customer_email}</div>}
                            {tx.customer_phone && <div className="text-muted-foreground">{tx.customer_phone}</div>}
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(tx.status)}</TableCell>
                        <TableCell>
                          {formatDistanceToNow(new Date(tx.created_at), { addSuffix: true })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
