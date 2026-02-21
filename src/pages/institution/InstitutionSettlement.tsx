import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, Clock, CheckCircle2, AlertCircle, RefreshCw, Download, Banknote } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Settlement {
  id: string;
  settlement_ref: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string;
  period_end: string;
  transaction_count: number;
  total_fees: number;
  net_amount: number;
  created_at: string;
  settled_at: string | null;
}

export default function InstitutionSettlement() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [pendingBalance, setPendingBalance] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: institution } = await supabase
        .from("institutions")
        .select("id, settlement_frequency, minimum_settlement_amount, settlement_bank_account")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);

      // Load settlement transactions
      const { data: settlementData } = await supabase
        .from("settlement_transactions")
        .select("*")
        .eq("institution_id", institution.id)
        .order("created_at", { ascending: false })
        .limit(50);

      const mapped: Settlement[] = (settlementData || []).map((s: any) => ({
        id: s.id,
        settlement_ref: s.settlement_ref || s.id.slice(0, 8),
        amount: Number(s.gross_amount || 0),
        currency: s.currency || 'XAF',
        status: s.status || 'pending',
        period_start: s.period_start || s.created_at,
        period_end: s.period_end || s.created_at,
        transaction_count: s.transaction_count || 0,
        total_fees: Number(s.total_kob_fees || 0),
        net_amount: Number(s.net_amount || 0),
        created_at: s.created_at,
        settled_at: s.settled_at,
      }));

      setSettlements(mapped);

      // Calculate pending balance from unsettled transactions
      const { data: pendingTx } = await supabase
        .from("mobile_money_transactions")
        .select("amount")
        .eq("facilitated_institution_id", institution.id)
        .eq("is_kob_facilitated", true)
        .is("settlement_id", null)
        .eq("status", "completed");

      const pending = (pendingTx || []).reduce((sum, t) => sum + Number(t.amount || 0), 0);
      setPendingBalance(pending);
    } catch (error: any) {
      toast({ title: "Error loading settlements", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'processing': return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"><Clock className="h-3 w-3 mr-1" />Processing</Badge>;
      case 'failed': return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
      default: return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Settlement</h1>
            <p className="text-muted-foreground">Track payouts and settlement cycles</p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />Refresh
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending Balance</CardTitle>
              <Banknote className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingBalance.toLocaleString()} XAF</div>
              <p className="text-xs text-muted-foreground">Awaiting next settlement</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Settled</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {settlements.filter(s => s.status === 'completed').reduce((sum, s) => sum + s.net_amount, 0).toLocaleString()} XAF
              </div>
              <p className="text-xs text-muted-foreground">All time</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Settlements</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{settlements.length}</div>
              <p className="text-xs text-muted-foreground">Total settlement cycles</p>
            </CardContent>
          </Card>
        </div>

        {/* Settlement History */}
        <Card>
          <CardHeader>
            <CardTitle>Settlement History</CardTitle>
            <CardDescription>All settlement payouts to your bank account</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-20 w-full" />)}</div>
            ) : settlements.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No settlements yet</p>
                <p className="text-sm mt-1">Settlements are processed automatically based on your schedule</p>
              </div>
            ) : (
              <div className="space-y-3">
                {settlements.map(settlement => (
                  <div key={settlement.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">Settlement #{settlement.settlement_ref}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(settlement.period_start), "MMM d")} – {format(new Date(settlement.period_end), "MMM d, yyyy")}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {settlement.transaction_count} transactions · {settlement.total_fees.toLocaleString()} XAF fees
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">{settlement.net_amount.toLocaleString()} XAF</p>
                      {getStatusBadge(settlement.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </InstitutionLayout>
  );
}
