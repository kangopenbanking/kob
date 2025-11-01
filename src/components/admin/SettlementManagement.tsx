import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, TrendingUp, DollarSign, Calendar, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";

export function SettlementManagement() {
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load institutions with facilitation enabled
      const { data: instData, error: instError } = await supabase
        .from('institutions')
        .select('id, institution_name, use_kob_flutterwave, settlement_frequency, minimum_settlement_amount, settlement_bank_account')
        .eq('use_kob_flutterwave', true)
        .eq('is_active', true);

      if (instError) throw instError;
      setInstitutions(instData || []);

      // Load recent settlements
      const { data: settlementData, error: settlementError } = await supabase
        .from('settlement_transactions')
        .select('*, institutions(institution_name)')
        .order('created_at', { ascending: false })
        .limit(50);

      if (settlementError) throw settlementError;
      setSettlements(settlementData || []);
    } catch (error: any) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const calculateSettlement = async (institutionId: string) => {
    try {
      const periodEnd = new Date().toISOString();
      const periodStart = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();

      const { data, error } = await supabase.functions.invoke('settlement-calculate', {
        body: { 
          institution_id: institutionId,
          period_start: periodStart,
          period_end: periodEnd 
        }
      });

      if (error) throw error;
      
      return data;
    } catch (error: any) {
      console.error('Error calculating settlement:', error);
      toast.error('Failed to calculate settlement');
      return null;
    }
  };

  const processSettlement = async (institutionId: string) => {
    setProcessing(institutionId);
    try {
      const periodEnd = new Date().toISOString();
      const periodStart = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString();

      const { data, error } = await supabase.functions.invoke('settlement-process', {
        body: {
          institution_id: institutionId,
          period_start: periodStart,
          period_end: periodEnd
        }
      });

      if (error) throw error;

      toast.success('Settlement processed successfully');
      loadData();
    } catch (error: any) {
      console.error('Error processing settlement:', error);
      toast.error(error.message || 'Failed to process settlement');
    } finally {
      setProcessing(null);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Institutions</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{institutions.length}</div>
            <p className="text-xs text-muted-foreground">Using KOB facilitation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Settlements</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settlements.filter(s => s.settlement_status === 'pending').length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting processing</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {settlements.filter(s => {
                const date = new Date(s.created_at);
                const now = new Date();
                return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
              }).length}
            </div>
            <p className="text-xs text-muted-foreground">Settlements processed</p>
          </CardContent>
        </Card>
      </div>

      {/* Institutions Ready for Settlement */}
      <Card>
        <CardHeader>
          <CardTitle>Institutions - Settlement Actions</CardTitle>
          <CardDescription>Process settlements for facilitated institutions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Institution</TableHead>
                <TableHead>Frequency</TableHead>
                <TableHead>Min. Amount</TableHead>
                <TableHead>Settlement Method</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {institutions.map((inst) => (
                <TableRow key={inst.id}>
                  <TableCell className="font-medium">{inst.institution_name}</TableCell>
                  <TableCell>{inst.settlement_frequency}</TableCell>
                  <TableCell>{inst.minimum_settlement_amount?.toLocaleString()} XAF</TableCell>
                  <TableCell>
                    {inst.settlement_bank_account?.type === 'bank_transfer' ? 'Bank Transfer' : 'Mobile Money'}
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => processSettlement(inst.id)}
                      disabled={processing === inst.id}
                    >
                      {processing === inst.id ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing</>
                      ) : (
                        'Process Settlement'
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {institutions.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No institutions with facilitation enabled
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recent Settlements */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Settlements</CardTitle>
          <CardDescription>Settlement transaction history</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Settlement Ref</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead>Period</TableHead>
                <TableHead>Net Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {settlements.map((settlement) => (
                <TableRow key={settlement.id}>
                  <TableCell className="font-mono text-sm">{settlement.settlement_ref}</TableCell>
                  <TableCell>{settlement.institutions?.institution_name}</TableCell>
                  <TableCell className="text-sm">
                    {format(new Date(settlement.period_start), 'MMM dd')} - {format(new Date(settlement.period_end), 'MMM dd, yyyy')}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {settlement.net_settlement_amount?.toLocaleString()} XAF
                  </TableCell>
                  <TableCell>{getStatusBadge(settlement.settlement_status)}</TableCell>
                  <TableCell>{format(new Date(settlement.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                </TableRow>
              ))}
              {settlements.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No settlements found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}