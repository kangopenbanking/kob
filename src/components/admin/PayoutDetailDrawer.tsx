import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, RefreshCw, RotateCcw, Copy, Ban, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

interface PayoutDetailDrawerProps {
  payout: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRetry: (id: string) => void;
  onReverse: (id: string) => void;
  onCancel: (id: string) => void;
  retryPending?: boolean;
  reversePending?: boolean;
  cancelPending?: boolean;
}

export function PayoutDetailDrawer({
  payout, open, onOpenChange, onRetry, onReverse, onCancel,
  retryPending, reversePending, cancelPending,
}: PayoutDetailDrawerProps) {
  if (!payout) return null;

  const isConsumer = !payout.merchant_id;
  const isHighValue = payout.amount >= (isConsumer ? 1000000 : 5000000);

  const formatCurrency = (amount: number, currency: string = "XAF") =>
    new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const statusConfig: Record<string, { cls: string; icon: any; label: string }> = {
    pending: { cls: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock, label: "Pending" },
    processing: { cls: "bg-blue-50 text-blue-700 border-blue-200", icon: RefreshCw, label: "Processing" },
    completed: { cls: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: CheckCircle, label: "Completed" },
    failed: { cls: "bg-red-50 text-red-700 border-red-200", icon: XCircle, label: "Failed" },
    cancelled: { cls: "bg-gray-50 text-gray-600 border-gray-200", icon: Ban, label: "Cancelled" },
  };

  const cfg = statusConfig[payout.status] || statusConfig.pending;
  const StatusIcon = cfg.icon;

  const rows: { label: string; value: string | React.ReactNode }[] = [
    { label: "Payout ID", value: (
      <button onClick={() => copyToClipboard(payout.id)} className="flex items-center gap-1.5 font-mono text-[11px] hover:text-primary transition-colors group">
        {payout.id.slice(0, 12)}… <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    )},
    { label: "Type", value: isConsumer ? "Consumer Withdrawal" : "Merchant Payout" },
    { label: "Status", value: (
      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${cfg.cls}`}>
        <StatusIcon className={`h-3 w-3 ${payout.status === "processing" ? "animate-spin" : ""}`} />{cfg.label}
      </span>
    )},
    { label: "Amount", value: <span className="font-bold text-foreground">{formatCurrency(payout.amount, payout.currency)}</span> },
    { label: "Fee", value: payout.fee_amount ? formatCurrency(payout.fee_amount, payout.currency) : "—" },
    { label: "Net Amount", value: formatCurrency((payout.amount || 0) - (payout.fee_amount || 0), payout.currency) },
    { label: "Currency", value: payout.currency || "XAF" },
    { label: "Channel", value: payout.channel || "—" },
    { label: "Provider", value: payout.provider || "—" },
    { label: "Beneficiary", value: payout.beneficiary_name || "—" },
    { label: "Destination", value: payout.destination_account || "—" },
    { label: "Reference", value: payout.tx_ref ? (
      <button onClick={() => copyToClipboard(payout.tx_ref)} className="flex items-center gap-1.5 font-mono text-[11px] hover:text-primary transition-colors group">
        {payout.tx_ref} <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    ) : "—" },
    { label: "Provider Ref", value: payout.provider_ref || "—" },
    ...(payout.gateway_merchants?.business_name ? [{ label: "Merchant", value: payout.gateway_merchants.business_name }] : []),
    { label: "Created", value: format(new Date(payout.created_at), "PPpp") },
    ...(payout.completed_at ? [{ label: "Completed", value: format(new Date(payout.completed_at), "PPpp") }] : []),
    ...(payout.error_message ? [{ label: "Error", value: <span className="text-red-600 text-[11px] font-medium">{payout.error_message}</span> }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] overflow-y-auto p-0">
        <SheetHeader className="p-6 pb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            Payout Details
            {isHighValue && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                <AlertTriangle className="h-3 w-3" />High Value
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <Separator />

        <div className="p-6 space-y-1">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between items-start py-2 border-b border-border/20 last:border-0">
              <span className="text-[11px] text-muted-foreground font-medium shrink-0 uppercase tracking-wider">{row.label}</span>
              <span className="text-sm text-right ml-4">{row.value}</span>
            </div>
          ))}
        </div>

        <Separator />

        <div className="p-6 space-y-2">
          {payout.status === "failed" && (
            <Button onClick={() => onRetry(payout.id)} disabled={retryPending} variant="outline" className="w-full rounded-xl h-10 gap-2">
              <RefreshCw className="h-4 w-4" />Retry Payout
            </Button>
          )}
          {payout.status === "pending" && (
            <Button onClick={() => onCancel(payout.id)} disabled={cancelPending} variant="secondary" className="w-full rounded-xl h-10 gap-2">
              <Ban className="h-4 w-4" />Cancel Payout
            </Button>
          )}
          {(payout.status === "processing" || payout.status === "pending") && (
            <Button onClick={() => onReverse(payout.id)} disabled={reversePending} variant="destructive" className="w-full rounded-xl h-10 gap-2">
              <RotateCcw className="h-4 w-4" />Reverse & Restore Balance
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
