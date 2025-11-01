import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, TrendingUp, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";

interface FacilitatedPaymentsCardProps {
  institutionId: string;
}

export function FacilitatedPaymentsCard({ institutionId }: FacilitatedPaymentsCardProps) {
  const [loading, setLoading] = useState(false);
  const [settlementBalance, setSettlementBalance] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Calculate current settlement balance
      await calculateBalance();

      // Load facilitated transactions
      const { data: mmTxs, error: mmError } = await supabase
        .from('mobile_money_transactions')
        .select('*')
        .eq('facilitated_institution_id', institutionId)
        .eq('is_kob_facilitated', true)
        .order('created_at', { ascending: false })
        .limit(20);

      const { data: btTxs, error: btError } = await supabase
        .from('bank_transfer_transactions')
        .select('*')
        .eq('facilitated_institution_id', institutionId)
        .eq('is_kob_facilitated', true)
        .order('created_at', { ascending: false })
        .limit(20);

      if (mmError) throw mmError;
      if (btError) throw btError;

      const allTxs = [
        ...(mmTxs || []).map(tx => ({ ...tx, type: 'mobile_money' })),
        ...(btTxs || []).map(tx => ({ ...tx, type: 'bank_transfer' }))
      ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      setTransactions(allTxs);

      // Load settlements
      const { data: settlementData, error: settlementError } = await supabase
        .from('settlement_transactions')
        .select('*')
        .eq('institution_id', institutionId)
        .order('created_at', { ascending: false });

      if (settlementError) throw settlementError;
      setSettlements(settlementData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateBalance = async () => {
    try {
      const periodEnd = new Date().toISOString();
      const periodStart = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();

      const { data, error } = await supabase.functions.invoke('settlement-calculate', {
        body: {
          period_start: periodStart,
          period_end: periodEnd
        }
      });

      if (error) throw error;
      setSettlementBalance(data);
    } catch (error: any) {
      console.error('Error calculating balance:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "outline",
      processing: "secondary",
      completed: "default",
      failed: "destructive",
    };
    return <Badge variant={variants[status] || "outline"}>{status}</Badge>;
  };

  if (loading && !settlementBalance) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Settlement Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Inflows</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settlementBalance?.total_inflows?.toLocaleString() || 0} XAF
            </div>
            <p className="text-xs text-muted-foreground">Collections this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outflows</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-600 rotate-180" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settlementBalance?.total_outflows?.toLocaleString() || 0} XAF
            </div>
            <p className="text-xs text-muted-foreground">Transfers this period</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">KOB Fees</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settlementBalance?.total_kob_fees?.toLocaleString() || 0} XAF
            </div>
            <p className="text-xs text-muted-foreground">Facilitation fees charged</p>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net Balance</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">
              {settlementBalance?.net_settlement_amount?.toLocaleString() || 0} XAF
            </div>
            <p className="text-xs text-muted-foreground">Available for settlement</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for Transactions and Settlements */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Facilitated Payments</CardTitle>
              <CardDescription>Transactions processed through KOB Mobile Money Gateway</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="transactions">
            <TabsList>
              <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
              <TabsTrigger value="settlements">Settlement History</TabsTrigger>
            </TabsList>

            <TabsContent value="transactions" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ref</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>KOB Fee</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((tx) => (
                    <TableRow key={tx.id}>
                      <TableCell className="font-mono text-xs">{tx.transaction_ref}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {tx.type === 'mobile_money' ? 'Mobile Money' : 'Bank Transfer'}
                        </Badge>
                      </TableCell>
                      <TableCell>{tx.amount?.toLocaleString()} {tx.currency}</TableCell>
                      <TableCell className="text-red-600">
                        {tx.kob_fee_amount?.toLocaleString()} {tx.currency}
                      </TableCell>
                      <TableCell>{getStatusBadge(tx.status)}</TableCell>
                      <TableCell>{format(new Date(tx.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                    </TableRow>
                  ))}
                  {transactions.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>

            <TabsContent value="settlements" className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Settlement Ref</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {settlements.map((settlement) => (
                    <TableRow key={settlement.id}>
                      <TableCell className="font-mono text-xs">{settlement.settlement_ref}</TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(settlement.period_start), 'MMM dd')} - {format(new Date(settlement.period_end), 'MMM dd')}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {settlement.net_settlement_amount?.toLocaleString()} XAF
                      </TableCell>
                      <TableCell>
                        {settlement.settlement_method === 'bank_transfer' ? 'Bank' : 'Mobile Money'}
                      </TableCell>
                      <TableCell>{getStatusBadge(settlement.settlement_status)}</TableCell>
                      <TableCell>{format(new Date(settlement.created_at), 'MMM dd, yyyy')}</TableCell>
                    </TableRow>
                  ))}
                  {settlements.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        No settlements yet
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}