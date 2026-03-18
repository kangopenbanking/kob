import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Layers } from "lucide-react";

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
        console.warn("batch table query failed:", error.message);
        return [];
      }
      return data || [];
    },
  });

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  if (batches.length === 0) {
    return (
      <div className="text-center py-16">
        <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3">
          <Layers className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <p className="text-sm font-medium text-muted-foreground">No batch payouts found</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Batch disbursements created via the API will appear here</p>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      completed: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800",
      failed: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800",
      processing: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800",
      pending: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
    };
    return (
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${map[status] || "bg-muted text-muted-foreground border-border"}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto rounded-xl border border-border/30">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            {["Date", "Batch ID", "Items", "Total Amount", "Completed", "Failed", "Status"].map((h) => (
              <TableHead key={h} className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{h}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {batches.map((batch: any, index: number) => (
            <motion.tr
              key={batch.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: index * 0.02 }}
              className="border-b border-border/20 transition-colors hover:bg-muted/20"
            >
              <TableCell className="text-[11px] font-mono text-muted-foreground py-3">{format(new Date(batch.created_at), "MMM dd, HH:mm")}</TableCell>
              <TableCell className="text-[11px] font-mono text-muted-foreground py-3">{batch.id?.slice(0, 8)}…</TableCell>
              <TableCell className="text-sm font-medium py-3">{batch.total_items || batch.item_count || "—"}</TableCell>
              <TableCell className="text-sm font-semibold tabular-nums py-3">{formatCurrency(batch.total_amount || 0, batch.currency)}</TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 tabular-nums">
                  {batch.completed_items || batch.completed_count || 0}
                </span>
              </TableCell>
              <TableCell className="py-3">
                <span className="inline-flex items-center rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-semibold text-red-700 tabular-nums">
                  {batch.failed_items || batch.failed_count || 0}
                </span>
              </TableCell>
              <TableCell className="py-3">{statusBadge(batch.status)}</TableCell>
            </motion.tr>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
