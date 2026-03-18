import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export function AdminBatchPayouts() {
  const { data: batches = [], isLoading } = useQuery({
    queryKey: ["admin-payout-batches"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gateway_payout_batches")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        // Table may not exist yet
        console.warn("batch table query failed:", error.message);
        return [];
      }
      return data || [];
    },
  });

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  if (isLoading) return <p className="text-center py-8 text-muted-foreground">Loading batches...</p>;

  if (batches.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p className="text-sm">No batch payouts found</p>
        <p className="text-xs mt-1">Batch disbursements created via the API will appear here</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Batch ID</TableHead>
            <TableHead>Items</TableHead>
            <TableHead>Total Amount</TableHead>
            <TableHead>Completed</TableHead>
            <TableHead>Failed</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch: any) => (
            <TableRow key={batch.id}>
              <TableCell className="text-xs font-mono">{format(new Date(batch.created_at), "MMM dd, HH:mm")}</TableCell>
              <TableCell className="text-xs font-mono">{batch.id?.slice(0, 8)}…</TableCell>
              <TableCell>{batch.total_items || batch.item_count || "—"}</TableCell>
              <TableCell className="font-semibold">{formatCurrency(batch.total_amount || 0, batch.currency)}</TableCell>
              <TableCell className="text-emerald-600">{batch.completed_items || batch.completed_count || 0}</TableCell>
              <TableCell className="text-destructive">{batch.failed_items || batch.failed_count || 0}</TableCell>
              <TableCell>
                <Badge variant={batch.status === "completed" ? "default" : batch.status === "failed" ? "destructive" : "secondary"}>
                  {batch.status}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
