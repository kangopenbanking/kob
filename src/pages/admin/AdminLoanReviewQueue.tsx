import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type LoanAuditRow = {
  id: string;
  entity_id: string;
  performed_by: string | null;
  details: Record<string, any> | null;
  created_at: string;
};

/**
 * Admin loan review queue.
 * Reads recent `loan_application_submitted` audit_logs rows so admins
 * see new loan applications immediately, no matter which institution
 * they came from.
 */
export default function AdminLoanReviewQueue() {
  const { toast } = useToast();
  const [rows, setRows] = useState<LoanAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, entity_id, performed_by, details, created_at")
      .eq("entity_type", "loan_application")
      .eq("action_type", "loan_application_submitted")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: "Failed to load queue", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as LoanAuditRow[]);
    }
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Loan Review Queue</h1>
          <p className="text-sm text-muted-foreground">
            Loan applications awaiting admin review across all institutions.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <FileText className="h-4 w-4" /> Recent applications
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
              No pending loan applications.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application #</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead>Tenure</TableHead>
                  <TableHead>Credit score</TableHead>
                  <TableHead>Auto decision</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const d = r.details ?? {};
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono text-xs">{d.application_number ?? r.entity_id.slice(0, 8)}</TableCell>
                      <TableCell>{d.requested_amount != null ? new Intl.NumberFormat("fr-CM").format(Number(d.requested_amount)) + " XAF" : "—"}</TableCell>
                      <TableCell>{d.tenure_months ?? "—"}</TableCell>
                      <TableCell>{d.credit_score ?? "—"}</TableCell>
                      <TableCell>
                        {d.auto_decision ? <Badge variant="outline">{d.auto_decision}</Badge> : "—"}
                      </TableCell>
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
