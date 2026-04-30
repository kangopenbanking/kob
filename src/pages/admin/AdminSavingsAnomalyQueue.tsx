import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type AnomalyRow = {
  id: string;
  entity_id: string;
  performed_by: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

/**
 * Admin savings anomaly review queue.
 * Reads `savings_withdrawal` audit rows where the amount exceeds the
 * anomaly threshold or the account was locked at withdrawal time.
 */
export default function AdminSavingsAnomalyQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState<AnomalyRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, entity_id, performed_by, details, created_at")
      .eq("entity_type", "savings_account")
      .eq("action_type", "savings_withdrawal")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      toast({ title: "Failed to load queue", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }
    // Filter client-side for anomalies (large or locked withdrawals)
    const filtered = (data ?? []).filter((r: any) => {
      const d = r.details ?? {};
      return Number(d.amount ?? 0) >= 500_000 || d.was_locked === true;
    });
    setRows(filtered as AnomalyRow[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Savings Anomaly Queue</h1>
          <p className="text-sm text-muted-foreground">
            Large (≥ 500,000 XAF) or locked-account savings withdrawals flagged for review.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <AlertTriangle className="h-4 w-4" /> Flagged withdrawals
          </CardTitle>
          <Badge variant="secondary">{rows.length}</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No flagged savings withdrawals.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead>Flag</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const d = r.details ?? {};
                  const isLocked = d.was_locked === true;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{d.transaction_ref ?? r.entity_id.slice(0, 8)}</TableCell>
                      <TableCell>{d.amount != null ? new Intl.NumberFormat("fr-CM").format(Number(d.amount)) + " XAF" : "—"}</TableCell>
                      <TableCell>{d.remaining_balance != null ? new Intl.NumberFormat("fr-CM").format(Number(d.remaining_balance)) + " XAF" : "—"}</TableCell>
                      <TableCell>
                        {isLocked
                          ? <Badge variant="destructive">Locked account</Badge>
                          : <Badge variant="outline">Large withdrawal</Badge>}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{r.performed_by?.slice(0, 8) ?? "—"}</TableCell>
                      <TableCell>{new Date(r.created_at).toLocaleString()}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
