import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Clock, CheckCircle, XCircle, RefreshCw, RotateCcw, Copy, ExternalLink } from "lucide-react";
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
  payout,
  open,
  onOpenChange,
  onRetry,
  onReverse,
  onCancel,
  retryPending,
  reversePending,
  cancelPending,
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

  const statusIcon: Record<string, any> = {
    pending: <Clock className="h-4 w-4 text-yellow-600" />,
    processing: <RefreshCw className="h-4 w-4 text-blue-600 animate-spin" />,
    completed: <CheckCircle className="h-4 w-4 text-emerald-600" />,
    failed: <XCircle className="h-4 w-4 text-destructive" />,
  };

  const rows: { label: string; value: string | React.ReactNode }[] = [
    { label: "Payout ID", value: (
      <button onClick={() => copyToClipboard(payout.id)} className="flex items-center gap-1 font-mono text-xs hover:text-primary">
        {payout.id.slice(0, 12)}… <Copy className="h-3 w-3" />
      </button>
    )},
    { label: "Type", value: isConsumer ? "Consumer Withdrawal" : "Merchant Payout" },
    { label: "Status", value: (
      <div className="flex items-center gap-1.5">{statusIcon[payout.status]}{payout.status}</div>
    )},
    { label: "Amount", value: formatCurrency(payout.amount, payout.currency) },
    { label: "Fee", value: payout.fee_amount ? formatCurrency(payout.fee_amount, payout.currency) : "—" },
    { label: "Net Amount", value: formatCurrency((payout.amount || 0) - (payout.fee_amount || 0), payout.currency) },
    { label: "Currency", value: payout.currency || "XAF" },
    { label: "Channel", value: payout.channel || "—" },
    { label: "Provider", value: payout.provider || "—" },
    { label: "Beneficiary", value: payout.beneficiary_name || "—" },
    { label: "Destination", value: payout.destination_account || "—" },
    { label: "Reference", value: payout.tx_ref ? (
      <button onClick={() => copyToClipboard(payout.tx_ref)} className="flex items-center gap-1 font-mono text-xs hover:text-primary">
        {payout.tx_ref} <Copy className="h-3 w-3" />
      </button>
    ) : "—" },
    { label: "Provider Ref", value: payout.provider_ref || "—" },
    ...(payout.gateway_merchants?.business_name ? [{ label: "Merchant", value: payout.gateway_merchants.business_name }] : []),
    { label: "Created", value: format(new Date(payout.created_at), "PPpp") },
    ...(payout.completed_at ? [{ label: "Completed", value: format(new Date(payout.completed_at), "PPpp") }] : []),
    ...(payout.error_message ? [{ label: "Error", value: <span className="text-destructive text-xs">{payout.error_message}</span> }] : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Payout Details
            {isHighValue && <Badge variant="destructive" className="text-[10px]">High Value</Badge>}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex justify-between items-start py-1.5">
              <span className="text-xs text-muted-foreground shrink-0">{row.label}</span>
              <span className="text-sm font-medium text-right ml-4">{row.value}</span>
            </div>
          ))}
        </div>

        <Separator className="my-6" />

        <div className="flex flex-col gap-2">
          {payout.status === "failed" && (
            <Button onClick={() => onRetry(payout.id)} disabled={retryPending} variant="outline" className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" />Retry Payout
            </Button>
          )}
          {payout.status === "pending" && (
            <Button onClick={() => onCancel(payout.id)} disabled={cancelPending} variant="secondary" className="w-full">
              <XCircle className="h-4 w-4 mr-2" />Cancel Payout
            </Button>
          )}
          {(payout.status === "processing" || payout.status === "pending") && (
            <Button onClick={() => onReverse(payout.id)} disabled={reversePending} variant="destructive" className="w-full">
              <RotateCcw className="h-4 w-4 mr-2" />Reverse & Restore Balance
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
