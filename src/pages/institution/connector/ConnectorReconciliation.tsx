import { ConnectorPageHeader } from "@/components/institution/connector/ConnectorPageHeader";
import { StatusBadge } from "@/components/institution/connector/StatusBadge";
import { ConnectorEmptyState } from "@/components/institution/connector/ConnectorEmptyState";
import { useBankConnector } from "@/hooks/useBankConnector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ArrowUpDown, Download, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

export default function ConnectorReconciliation() {
  const { bankId, loading: bankLoading } = useBankConnector();

  const { data: batches, isLoading } = useQuery({
    queryKey: ["connector-reconciliation", bankId],
    queryFn: async () => {
      if (!bankId) return [];
      const { data } = await supabase
        .from("bank_batch_jobs")
        .select("id, batch_type, status, created_at, totals_json")
        .eq("bank_id", bankId)
        .order("created_at", { ascending: false })
        .limit(50);

      // For each batch, get item status counts
      const enriched = await Promise.all((data ?? []).map(async (b) => {
        const { data: items } = await supabase
          .from("bank_batch_items")
          .select("status")
          .eq("batch_id", b.id);
        const executed = items?.filter((i) => i.status === "executed").length ?? 0;
        const failed = items?.filter((i) => i.status === "failed").length ?? 0;
        const pending = items?.filter((i) => i.status === "pending" || i.status === "submitted").length ?? 0;
        return { ...b, executed, failed, pending, total: items?.length ?? 0 };
      }));
      return enriched;
    },
    enabled: !!bankId,
  });

  const totalExpected = batches?.reduce((s, b) => s + ((b.totals_json as any)?.total_amount ?? 0), 0) ?? 0;
  const totalExecuted = batches?.reduce((s, b) => {
    const perItem = ((b.totals_json as any)?.total_amount ?? 0) / Math.max(b.total, 1);
    return s + perItem * b.executed;
  }, 0) ?? 0;
  const totalMismatches = batches?.reduce((s, b) => s + b.failed, 0) ?? 0;

  const exportCSV = () => {
    if (!batches || batches.length === 0) return;
    const header = "batch_id,type,status,items_total,executed,failed,pending,total_amount";
    const rows = batches.map((b) => {
      const totals = b.totals_json as any;
      return `${b.id},${b.batch_type},${b.status},${b.total},${b.executed},${b.failed},${b.pending},${totals?.total_amount ?? 0}`;
    });
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reconciliation_report.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (bankLoading) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ArrowUpDown} title="Reconciliation" description="Loading..." />
        <div className="flex items-center justify-center min-h-[300px]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </div>
    );
  }

  if (!bankId) {
    return (
      <div className="space-y-6">
        <ConnectorPageHeader icon={ArrowUpDown} title="Reconciliation" description="Compare expected vs actual payment execution" />
        <ConnectorEmptyState icon={ArrowUpDown} title="No Bank Connected" description="Link a bank profile to view reconciliation data." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConnectorPageHeader icon={ArrowUpDown} title="Reconciliation" description="Compare expected vs actual payment execution results">
        <Button variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10" onClick={exportCSV} disabled={!batches?.length}>
          <Download className="h-4 w-4 mr-2" /> Export CSV
        </Button>
      </ConnectorPageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Expected Total</p>
              <p className="text-xl font-bold">{totalExpected.toLocaleString()} XAF</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Executed Total</p>
              <p className="text-xl font-bold">{Math.round(totalExecuted).toLocaleString()} XAF</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <AlertTriangle className="h-8 w-8 text-orange-500" />
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wide">Failed Items</p>
              <p className="text-xl font-bold">{totalMismatches}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Batch Reconciliation Table */}
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Batch Reconciliation</CardTitle></CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : batches && batches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 font-medium">Batch</th>
                    <th className="text-left p-3 font-medium">Type</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-center p-3 font-medium">Total</th>
                    <th className="text-center p-3 font-medium">Executed</th>
                    <th className="text-center p-3 font-medium">Failed</th>
                    <th className="text-center p-3 font-medium">Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <tr key={b.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="p-3 font-mono text-xs">{b.id.slice(0, 8)}</td>
                      <td className="p-3 capitalize">{b.batch_type.replace(/_/g, " ")}</td>
                      <td className="p-3"><StatusBadge status={b.status} /></td>
                      <td className="p-3 text-center">{b.total}</td>
                      <td className="p-3 text-center text-green-600 font-medium">{b.executed}</td>
                      <td className="p-3 text-center text-red-500 font-medium">{b.failed}</td>
                      <td className="p-3 text-center text-muted-foreground">{b.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ConnectorEmptyState
              icon={ArrowUpDown}
              title="No Reconciliation Data"
              description="Create batch payments and upload status files to see reconciliation results."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
