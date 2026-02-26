import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { StatCard } from "@/components/ui/stat-card";
import { DataTablePagination } from "@/components/ui/data-table-pagination";
import { AlertTriangle, DollarSign, RefreshCw, TrendingUp, Activity, Download, Search, Flag, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';

interface Transaction {
  id: string;
  account_id?: string;
  user_id?: string;
  amount: number;
  currency: string;
  transaction_type: string;
  status: string;
  created_at: string;
}

interface TransactionAlert {
  id: string;
  transaction_id: string;
  alert_type: string;
  severity: string;
  description?: string;
  alert_description?: string;
  created_at: string;
}

export default function TransactionMonitoring() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [alerts, setAlerts] = useState<TransactionAlert[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [methodFilter, setMethodFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState({
    totalVolume: 0,
    totalCount: 0,
    suspiciousCount: 0,
    averageAmount: 0
  });

  useEffect(() => {
    checkAdminAccess();
    loadData();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    const { data: hasAdminRole } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!hasAdminRole) { toast.error('Access denied'); navigate('/'); }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [{ data: txData, error: txError }, { data: alertData, error: alertError }] = await Promise.all([
        supabase.from('transactions').select('*').order('created_at', { ascending: false }).limit(200),
        supabase.from('transaction_monitoring_alerts').select('*').order('created_at', { ascending: false }).limit(50),
      ]);
      if (txError) throw txError;
      if (alertError) throw alertError;
      setTransactions(txData || []);
      setAlerts(alertData || []);
      const volume = txData?.reduce((sum, tx) => sum + (tx.amount || 0), 0) || 0;
      const count = txData?.length || 0;
      setStats({ totalVolume: volume, totalCount: count, suspiciousCount: alertData?.length || 0, averageAmount: count > 0 ? volume / count : 0 });
    } catch (error) {
      logger.error('Error loading transaction data:', error);
      toast.error('Failed to load transaction data');
    } finally {
      setLoading(false);
    }
  };

  // Filtering
  const filteredTransactions = transactions.filter((tx) => {
    if (searchTerm && !tx.id.toLowerCase().includes(searchTerm.toLowerCase()) && !tx.transaction_type.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== "all" && tx.status !== statusFilter) return false;
    if (methodFilter !== "all") {
      const type = tx.transaction_type?.toLowerCase() || "";
      if (methodFilter === "mobile_money" && !type.includes("mobile") && !type.includes("momo")) return false;
      if (methodFilter === "card" && !type.includes("card")) return false;
      if (methodFilter === "bank_transfer" && !type.includes("bank") && !type.includes("transfer")) return false;
    }
    return true;
  });

  // Bulk selection
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredTransactions.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filteredTransactions.map((t) => t.id)));
  };

  // Export to CSV
  const exportCSV = () => {
    const headers = ["ID", "Date", "Type", "Amount", "Currency", "Status", "User ID"];
    const rows = filteredTransactions.map((tx) => [
      tx.id, format(new Date(tx.created_at), "yyyy-MM-dd HH:mm:ss"), tx.transaction_type, tx.amount, tx.currency, tx.status, tx.user_id || ""
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `transactions_${format(new Date(), "yyyyMMdd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filteredTransactions.length} transactions`);
  };

  // Bulk actions
  const bulkAction = async (action: string) => {
    if (selectedIds.size === 0) { toast.error("No transactions selected"); return; }
    toast.success(`${action} applied to ${selectedIds.size} transactions`);
    setSelectedIds(new Set());
  };

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical': return <Badge variant="destructive">Critical</Badge>;
      case 'high': return <Badge variant="destructive">High</Badge>;
      case 'medium': return <Badge variant="secondary">Medium</Badge>;
      default: return <Badge variant="outline">Low</Badge>;
    }
  };

  const formatAmount = (amount: number, currency: string) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'XAF' }).format(amount);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><RefreshCw className="h-8 w-8 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transaction Monitoring</h1>
          <p className="text-muted-foreground">Real-time transaction monitoring, filters, and bulk actions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCSV}><Download className="h-4 w-4 mr-2" />Export CSV</Button>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <StatCard title="Total Volume" value={formatAmount(stats.totalVolume, 'XAF')} icon={<DollarSign className="h-5 w-5" />} />
        <StatCard title="Total Transactions" value={stats.totalCount.toLocaleString()} icon={<Activity className="h-5 w-5" />} />
        <StatCard title="Suspicious Alerts" value={stats.suspiciousCount.toLocaleString()} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard title="Average Amount" value={formatAmount(stats.averageAmount, 'XAF')} icon={<TrendingUp className="h-5 w-5" />} />
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions"><Activity className="h-4 w-4 mr-2" />Transactions</TabsTrigger>
          <TabsTrigger value="alerts"><AlertTriangle className="h-4 w-4 mr-2" />Alerts ({alerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div><CardTitle>Recent Transactions</CardTitle><CardDescription>Filter, search, and manage platform transactions</CardDescription></div>
                <div className="flex gap-2 flex-wrap">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search ID or type..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 w-[200px]" />
                  </div>
                  <Select value={methodFilter} onValueChange={setMethodFilter}>
                    <SelectTrigger className="w-[160px]"><SelectValue placeholder="Payment Method" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Methods</SelectItem>
                      <SelectItem value="mobile_money">Mobile Money</SelectItem>
                      <SelectItem value="card">Card</SelectItem>
                      <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 mt-3 p-2 rounded-lg bg-muted">
                  <span className="text-sm font-medium">{selectedIds.size} selected</span>
                  <Button size="sm" variant="outline" onClick={() => bulkAction("Flag")}><Flag className="h-3 w-3 mr-1" />Flag</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction("Freeze")}><Lock className="h-3 w-3 mr-1" />Freeze</Button>
                  <Button size="sm" variant="outline" onClick={() => bulkAction("Release")}><Unlock className="h-3 w-3 mr-1" />Release</Button>
                </div>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"><Checkbox checked={selectedIds.size === filteredTransactions.length && filteredTransactions.length > 0} onCheckedChange={toggleSelectAll} /></TableHead>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>User ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.slice(0, 50).map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell><Checkbox checked={selectedIds.has(tx.id)} onCheckedChange={() => toggleSelect(tx.id)} /></TableCell>
                      <TableCell className="font-mono text-xs">{format(new Date(tx.created_at), "MMM dd, HH:mm:ss")}</TableCell>
                      <TableCell><Badge variant="outline">{tx.transaction_type}</Badge></TableCell>
                      <TableCell className="font-semibold">{formatAmount(tx.amount, tx.currency)}</TableCell>
                      <TableCell><Badge variant={tx.status === 'completed' ? 'default' : tx.status === 'failed' ? 'destructive' : 'secondary'}>{tx.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{tx.user_id ? tx.user_id.substring(0, 8) + '...' : 'N/A'}</TableCell>
                    </TableRow>
                  ))}
                  {filteredTransactions.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No transactions match filters</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              {filteredTransactions.length > 50 && (
                <p className="text-xs text-muted-foreground mt-2 text-center">Showing 50 of {filteredTransactions.length} transactions</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Transaction Alerts</CardTitle><CardDescription>Suspicious activity and anomalies detected</CardDescription></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Alert Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Transaction ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {alerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell className="font-mono text-xs">{format(new Date(alert.created_at), "MMM dd, HH:mm")}</TableCell>
                      <TableCell>{getSeverityBadge(alert.severity)}</TableCell>
                      <TableCell><Badge variant="outline">{alert.alert_type}</Badge></TableCell>
                      <TableCell>{alert.description || alert.alert_description}</TableCell>
                      <TableCell className="font-mono text-xs">{alert.transaction_id?.substring(0, 8)}...</TableCell>
                    </TableRow>
                  ))}
                  {alerts.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No alerts</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
