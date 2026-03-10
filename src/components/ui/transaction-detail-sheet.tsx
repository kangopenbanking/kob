import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { CheckCircle2, Clock, XCircle, AlertCircle, Circle } from "lucide-react";

interface TransactionDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Record<string, any> | null;
}

const statusConfig: Record<string, { icon: any; color: string; variant: "default" | "secondary" | "destructive" }> = {
  successful: { icon: CheckCircle2, color: "text-emerald-600", variant: "default" },
  completed: { icon: CheckCircle2, color: "text-emerald-600", variant: "default" },
  settled: { icon: CheckCircle2, color: "text-emerald-600", variant: "default" },
  pending: { icon: Clock, color: "text-amber-500", variant: "secondary" },
  processing: { icon: Clock, color: "text-amber-500", variant: "secondary" },
  failed: { icon: XCircle, color: "text-destructive", variant: "destructive" },
  reversed: { icon: AlertCircle, color: "text-destructive", variant: "destructive" },
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—") return null;
  return (
    <div className="flex justify-between items-start py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right max-w-[60%] break-all">{value}</span>
    </div>
  );
}

export function TransactionDetailSheet({ open, onOpenChange, transaction: tx }: TransactionDetailSheetProps) {
  if (!tx) return null;

  const ref = tx.tx_ref || tx.charge_ref || tx.payout_ref || tx.settlement_ref || tx.refund_ref || tx.transaction_ref || tx.id;
  const status = tx.status || "unknown";
  const cfg = statusConfig[status] || { icon: Circle, color: "text-muted-foreground", variant: "secondary" as const };
  const StatusIcon = cfg.icon;

  const timelineEvents = [
    tx.created_at && { label: "Created", time: tx.created_at },
    tx.processing_at && { label: "Processing", time: tx.processing_at },
    tx.completed_at && { label: "Completed", time: tx.completed_at },
    tx.settled_at && { label: "Settled", time: tx.settled_at },
    tx.failed_at && { label: "Failed", time: tx.failed_at },
    tx.reversed_at && { label: "Reversed", time: tx.reversed_at },
  ].filter(Boolean) as { label: string; time: string }[];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
            Transaction Details
          </SheetTitle>
          <SheetDescription className="font-mono text-xs">{ref}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {/* Amount + Status */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">
              {Number(tx.amount || tx.gross_amount || tx.net_amount || 0).toLocaleString()} {tx.currency || "XAF"}
            </span>
            <Badge variant={cfg.variant}>{status}</Badge>
          </div>

          <Separator />

          {/* Details */}
          <div className="divide-y divide-border">
            <DetailRow label="Channel" value={tx.channel} />
            <DetailRow label="Customer" value={tx.customer_email} />
            <DetailRow label="Destination" value={tx.destination_type} />
            <DetailRow label="Reason" value={tx.reason} />
            <DetailRow label="Fees" value={tx.total_fees ? `${Number(tx.total_fees).toLocaleString()} ${tx.currency || "XAF"}` : undefined} />
            <DetailRow label="Net Amount" value={tx.net_amount ? `${Number(tx.net_amount).toLocaleString()} ${tx.currency || "XAF"}` : undefined} />
            <DetailRow label="Error" value={tx.error_message} />
            <DetailRow label="Provider Ref" value={tx.provider_reference} />
          </div>

          {/* Timeline */}
          {timelineEvents.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-3">Timeline</p>
                <div className="space-y-3">
                  {timelineEvents.map((evt, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className="mt-0.5">
                        <div className={`h-2.5 w-2.5 rounded-full ${i === timelineEvents.length - 1 ? "bg-primary" : "bg-muted-foreground/40"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{evt.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(evt.time), "MMM d, yyyy HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Provider metadata */}
          {tx.provider_response && (
            <>
              <Separator />
              <div>
                <p className="text-sm font-semibold mb-2">Provider Response</p>
                <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto max-h-40">
                  {typeof tx.provider_response === "string" ? tx.provider_response : JSON.stringify(tx.provider_response, null, 2)}
                </pre>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
