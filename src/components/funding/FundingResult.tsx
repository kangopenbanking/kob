import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, ArrowRight, Copy, Clock } from "lucide-react";
import { StripeCardConfirm } from "./StripeCardConfirm";
import { MobileMoneyConfirm } from "./MobileMoneyConfirm";
import { toast } from "sonner";

interface FundingResultProps {
  result: any;
  fmt: (n: number) => string;
  onSuccess?: () => void;
}

export const FundingResult = ({ result, fmt, onSuccess }: FundingResultProps) => {
  const copyRef = () => {
    navigator.clipboard.writeText(result.reference);
    toast.success("Reference copied!");
  };

  return (
    <Card className="border-primary/20 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-secondary" />
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3 text-lg">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          </div>
          <div className="flex-1">
            <span>Funding Intent Created</span>
            <Badge variant="secondary" className="ml-2 text-xs">
              {result.status?.replace(/_/g, " ")}
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Amount", value: fmt(result.amount), icon: "💰" },
            { label: "Fee", value: fmt(result.fee_amount), icon: "📊" },
            { label: "Provider", value: result.provider, icon: "🏦" },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-foreground">{item.value}</p>
            </div>
          ))}
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground mb-0.5">Reference</p>
            <div className="flex items-center gap-1">
              <p className="text-xs font-mono font-semibold text-foreground truncate">{result.reference}</p>
              <button onClick={copyRef} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
                <Copy className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {result.next_action?.redirect_url && (
          <Button className="w-full" size="lg">
            <a href={result.next_action.redirect_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full justify-center">
              Complete Payment <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        )}
        {result.next_action?.approval_url && (
          <Button className="w-full" variant="outline" size="lg">
            <a href={result.next_action.approval_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 w-full justify-center">
              Approve on PayPal <ArrowRight className="h-4 w-4" />
            </a>
          </Button>
        )}
        {result.next_action?.type === "stripe_confirm" && result.next_action?.client_secret && (
          <StripeCardConfirm
            clientSecret={result.next_action.client_secret}
            fundingIntentId={result.id}
            amount={result.amount}
            currency={result.currency}
            onSuccess={onSuccess}
          />
        )}
        {result.next_action?.type === "mobile_money_confirm" && (
          <MobileMoneyConfirm
            fundingIntentId={result.id}
            message={result.next_action?.message}
            onSuccess={onSuccess}
          />
        )}
        {result.next_action?.type === "bank_transfer_instructions" && (
          <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Clock className="h-4 w-4 text-primary" /> Bank Transfer Instructions
            </div>
            {[
              { label: "Bank", value: result.next_action.bank_name },
              { label: "Account", value: result.next_action.account_number },
              { label: "Name", value: result.next_action.account_name },
              { label: "Reference", value: result.next_action.reference, mono: true },
            ].map((item) => (
              <div key={item.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className={`font-medium text-foreground ${item.mono ? "font-mono" : ""}`}>{item.value}</span>
              </div>
            ))}
            {result.next_action.instructions && (
              <p className="text-xs text-muted-foreground mt-3 pt-3 border-t border-border">{result.next_action.instructions}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
