import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Calendar, Building2, Smartphone } from "lucide-react";

interface LiveFeePreviewProps {
  estimate: (amount: number) => number;
  transactionType: string;
  feeScope: string;
  effectiveFrom: string;
  effectiveUntil?: string;
  institutionType?: "bank" | "credit_union" | "fintech" | "developer" | string;
}

const APP_SOURCE_HINT: Record<string, "consumer" | "banking" | undefined> = {
  statement_download_consumer: "consumer",
  statement_download_banking: "banking",
};

/**
 * Shows the exact fee an end-user would be charged for the values currently
 * entered in the form, for a sample amount / app / institution-type / date.
 * Local computation only — mirrors the resolver priority so admins can
 * sanity-check before saving.
 */
export function LiveFeePreview({
  estimate,
  transactionType,
  feeScope,
  effectiveFrom,
  effectiveUntil,
  institutionType,
}: LiveFeePreviewProps) {
  const [amount, setAmount] = useState<number>(25000);
  const [appSource, setAppSource] = useState<"consumer" | "banking">(
    APP_SOURCE_HINT[transactionType] ?? "consumer",
  );
  const [previewType, setPreviewType] = useState<string>(
    institutionType || (feeScope === "platform" ? "bank" : "bank"),
  );
  const [asOf, setAsOf] = useState<string>(effectiveFrom || new Date().toISOString().split("T")[0]);

  const dateActive = useMemo(() => {
    if (!effectiveFrom) return true;
    if (asOf < effectiveFrom) return false;
    if (effectiveUntil && asOf > effectiveUntil) return false;
    return true;
  }, [asOf, effectiveFrom, effectiveUntil]);

  const fee = useMemo(() => Math.round(estimate(amount)), [estimate, amount]);
  const effectiveRate = amount > 0 ? (fee / amount) * 100 : 0;

  return (
    <div className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-bold text-foreground">Live Fee Preview</h4>
        </div>
        <Badge variant={dateActive ? "default" : "destructive"} className="text-[10px] font-semibold">
          {dateActive ? "Active on selected date" : "Outside effective period"}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Sample amount (XAF)</Label>
          <Input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="h-9 text-sm rounded-lg bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Preview date
          </Label>
          <Input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-9 text-sm rounded-lg bg-background"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Smartphone className="h-3 w-3" /> App source
          </Label>
          <Select value={appSource} onValueChange={(v) => setAppSource(v as any)}>
            <SelectTrigger className="h-9 text-sm rounded-lg bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="consumer">Consumers App</SelectItem>
              <SelectItem value="banking">Banking App</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-muted-foreground flex items-center gap-1">
            <Building2 className="h-3 w-3" /> Institution type
          </Label>
          <Select value={previewType} onValueChange={setPreviewType}>
            <SelectTrigger className="h-9 text-sm rounded-lg bg-background"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="bank">Bank</SelectItem>
              <SelectItem value="credit_union">Credit Union</SelectItem>
              <SelectItem value="fintech">Fintech</SelectItem>
              <SelectItem value="developer">Developer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-lg bg-background border p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Resolved fee</p>
          <p className="text-2xl font-bold text-primary mt-1">
            {dateActive ? `${fee.toLocaleString()} XAF` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            on {amount.toLocaleString()} XAF
          </p>
        </div>
        <div className="rounded-lg bg-background border p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Effective rate</p>
          <p className="text-2xl font-bold text-foreground mt-1">
            {dateActive ? `${effectiveRate.toFixed(2)}%` : "—"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">of transaction value</p>
        </div>
        <div className="rounded-lg bg-background border p-3 text-center">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Scope match</p>
          <p className="text-sm font-bold text-foreground mt-2 leading-tight">
            {feeScope === "platform"
              ? `Platform default → all ${previewType}s`
              : institutionType === previewType
                ? "Direct match"
                : "Override (does not apply to this type)"}
          </p>
          <p className="text-[10px] text-muted-foreground mt-1">{appSource} app</p>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground leading-tight">
        Mirrors the server resolver priority: app + institution overrides → app-level overrides → platform fee_structures → global default.
        Save the structure to apply these rates live.
      </p>
    </div>
  );
}
