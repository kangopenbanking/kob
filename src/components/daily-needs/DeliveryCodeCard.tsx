import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props { code: string | null | undefined; }

/**
 * Large, prominent delivery code card shown to the customer.
 * The customer reads this 4–6 digit code to the driver as proof
 * of delivery before the driver marks the order as delivered.
 */
export function DeliveryCodeCard({ code }: Props) {
  const [copied, setCopied] = useState(false);
  if (!code) return null;

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success("Code copied");
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy code");
    }
  };

  return (
    <Card className="p-5 border-primary/40 bg-primary/5">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-primary">
            <ShieldCheck className="size-3.5" />
            Delivery code
          </div>
          <p className="text-3xl font-bold font-mono tracking-[0.4em] text-foreground">{code}</p>
          <p className="text-xs text-muted-foreground">Share with the driver at handover.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onCopy} aria-label="Copy delivery code">
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </div>
    </Card>
  );
}
