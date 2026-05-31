import React, { useMemo, useState, useEffect, useCallback } from "react";
import { AlertCircle, ArrowLeft, Download, FileText, Loader2, ShieldCheck, Wallet } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadStatementReceipt } from "@/lib/statements/receipt";

type StatementSource = "customer" | "banking";

export interface StatementPreviewData {
  customer: { full_name: string; address_lines?: string[] };
  account: { account_no: string; currency: string; holder_name?: string; institution_type?: string | null };
  bank: { name: string; address_lines?: string[] };
  tx_count: number;
  preview_serial: string;
}

export interface StatementDownloadDialogProps {
  source: StatementSource;
  institutionId?: string;
  getPreviewData: (range: { from: string; to: string }) => Promise<StatementPreviewData | null>;
  trigger?: React.ReactNode;
  years?: number[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const BarcodePreview: React.FC<{ value: string }> = ({ value }) => {
  const bars = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
    return Array.from({ length: 60 }, (_, i) => {
      const seed = (hash ^ (i * 2654435761)) >>> 0;
      return { w: 1 + ((seed >> 4) & 0x7) * 0.6, on: (seed & 1) === 1 };
    });
  }, [value]);
  return (
    <div className="flex h-10 items-end gap-[1px] overflow-hidden">
      {bars.map((b, i) => (
        <div
          key={i}
          className="h-full"
          style={{ width: `${b.w}px`, background: b.on ? "hsl(var(--foreground))" : "transparent" }}
        />
      ))}
    </div>
  );
};

interface EffectiveFee {
  amount: number;
  currency: string;
  enabled: boolean;
  is_free: boolean;
}

interface FeeError {
  kind: "insufficient" | "no_balance" | "conflict" | "generic";
  message: string;
  available?: number;
  shortfall?: number;
  currency?: string;
}

function genIdemKey(): string {
  // Prefer native UUID; fall back to a v4-style polyfill for older browsers.
  // deno-lint-ignore no-explicit-any
  const c: any = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const StatementDownloadDialog: React.FC<StatementDownloadDialogProps> = ({
  source,
  institutionId,
  getPreviewData,
  trigger,
  years,
}) => {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>("all");
  const [step, setStep] = useState<"select" | "preview">("select");
  const [previewing, setPreviewing] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [preview, setPreview] = useState<StatementPreviewData | null>(null);
  const [fee, setFee] = useState<EffectiveFee | null>(null);
  const [feeError, setFeeError] = useState<FeeError | null>(null);
  /** Idempotency key is generated when a paid charge is about to be attempted and reused across retries until the dialog closes. */
  const [idemKey, setIdemKey] = useState<string>("");

  const resolveFee = useCallback(
    async (institutionType?: string | null) => {
      const { data, error } = await supabase.rpc("resolve_statement_fee", {
        p_source: source,
        p_institution_type: institutionType ?? null,
      });
      if (error || !data) return;
      // deno-lint-ignore no-explicit-any
      const d = data as any;
      setFee({
        amount: Number(d.fee_amount) || 0,
        currency: d.currency || "XAF",
        enabled: !!d.is_enabled,
        is_free: !!d.is_free,
      });
    },
    [source],
  );

  useEffect(() => {
    if (!open) return;
    void resolveFee(null);
  }, [open, resolveFee]);

  const yearOptions = useMemo(() => {
    if (years && years.length) return years;
    const out: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) out.push(y);
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [years]);

  const range = useMemo(() => {
    const y = parseInt(year, 10);
    let from: Date, to: Date;
    if (month === "all") {
      from = new Date(y, 0, 1);
      to = new Date(y, 11, 31, 23, 59, 59);
    } else {
      const m = parseInt(month, 10);
      from = new Date(y, m, 1);
      to = new Date(y, m + 1, 0, 23, 59, 59);
    }
    return { from: from.toISOString(), to: to.toISOString() };
  }, [year, month]);

  const periodLabel = useMemo(() => {
    const opts: Intl.DateTimeFormatOptions = { day: "2-digit", month: "short", year: "numeric" };
    return `${new Date(range.from).toLocaleDateString("en-GB", opts)} – ${new Date(range.to).toLocaleDateString("en-GB", opts)}`;
  }, [range]);

  const handlePreview = async () => {
    setPreviewing(true);
    setFeeError(null);
    try {
      const data = await getPreviewData(range);
      if (!data) {
        toast.error("No statement data available for this period.");
        return;
      }
      if (data.tx_count === 0) {
        toast.error("No transactions found for the selected period.");
        return;
      }
      setPreview(data);
      // Refresh fee resolution with institution type now that we know it
      void resolveFee(data.account.institution_type ?? null);
      setStep("preview");
    } catch (e) {
      console.error(e);
      toast.error("Could not prepare the preview. Please try again.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleConfirmDownload = async () => {
    if (!preview) return;
    setDownloading(true);
    setFeeError(null);
    try {
      // Allocate (or reuse) an idempotency key so retries never double-deduct.
      const key = idemKey || genIdemKey();
      if (!idemKey) setIdemKey(key);

      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/statements-generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "X-Idempotency-Key": key,
          },
          body: JSON.stringify({
            source,
            institution_id: institutionId,
            period_from: range.from,
            period_to: range.to,
            mode: "paid",
            idempotency_key: key,
          }),
        }
      );

      if (resp.status === 402) {
        const err = await resp.json().catch(() => ({}));
        setFeeError({
          kind: err.error === "no_balance" ? "no_balance" : "insufficient",
          message: err.message || "Payment is required to download this statement.",
          available: err.available,
          shortfall: err.shortfall,
          currency: err.currency || fee?.currency,
        });
        return;
      }
      if (resp.status === 409) {
        const err = await resp.json().catch(() => ({}));
        setFeeError({
          kind: "conflict",
          message: err.message || "We could not finalise the charge. Please refresh and try again.",
        });
        return;
      }
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.message || err.error || `Server returned ${resp.status}`);
      }

      const serial = resp.headers.get("X-Statement-Serial") || preview.preview_serial;
      const txCount = parseInt(resp.headers.get("X-Statement-Tx-Count") || String(preview.tx_count), 10);
      const feeCharged = Number(resp.headers.get("X-Statement-Fee-Charged") || "0");
      const feeStatus = (resp.headers.get("X-Statement-Fee-Status") || "waived") as "charged" | "waived" | "replayed";
      const feeCcy = resp.headers.get("X-Statement-Fee-Currency") || fee?.currency || "XAF";

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${source === "customer" ? "KANG" : "BANK"}-Statement-${serial}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      downloadStatementReceipt({
        source,
        serial,
        period_from: range.from,
        period_to: range.to,
        tx_count: txCount,
        account_no: preview.account.account_no,
        user_label: preview.customer.full_name,
        bank_name: preview.bank.name,
        fee_amount: feeCharged,
        fee_currency: feeCcy,
        fee_status: feeStatus,
        idempotency_key: key,
      });

      toast.success(
        feeStatus === "waived"
          ? "Statement downloaded — no fee applied."
          : feeStatus === "replayed"
          ? "Statement re-downloaded. Your balance was not charged again."
          : `Statement downloaded. ${feeCharged.toLocaleString()} ${feeCcy} deducted.`,
      );
      setOpen(false);
      setStep("select");
      setPreview(null);
      setIdemKey("");
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not generate the statement. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  const payLabel = fee?.enabled && fee.amount > 0
    ? `Pay ${fee.amount.toLocaleString()} ${fee.currency} & download`
    : "Download PDF";

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setStep("select");
          setPreview(null);
          setFeeError(null);
          setIdemKey("");
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl font-semibold">
            <Download className="h-4 w-4" strokeWidth={2} />
            Statement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="w-[calc(100vw-1rem)] max-w-[96vw] sm:max-w-lg md:max-w-xl max-h-[92dvh] overflow-y-auto rounded-2xl p-4 sm:p-6"
      >
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <FileText className="h-5 w-5" />
                Download statement
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Choose a period to preview your statement before downloading the PDF.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="stmt-year" className="text-xs font-semibold">Year</Label>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger id="stmt-year" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="stmt-month" className="text-xs font-semibold">Month</Label>
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger id="stmt-month" className="rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All year</SelectItem>
                    {MONTHS.map((m, i) => (
                      <SelectItem key={m} value={String(i)}>{m}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full sm:w-auto rounded-xl"
                disabled={previewing}
              >
                Cancel
              </Button>
              <Button
                onClick={handlePreview}
                disabled={previewing}
                className="w-full sm:w-auto rounded-xl gap-2"
              >
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {previewing ? "Preparing..." : "Preview statement"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
                <ShieldCheck className="h-5 w-5" />
                Confirm before download
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm">
                Review the details below. A unique serial and barcode are issued at download time.
              </DialogDescription>
            </DialogHeader>

            {feeError && (
              <Alert variant="destructive" className="rounded-xl">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="text-sm font-semibold">
                  {feeError.kind === "insufficient" || feeError.kind === "no_balance"
                    ? "Insufficient balance"
                    : feeError.kind === "conflict"
                    ? "Charge conflict"
                    : "Payment failed"}
                </AlertTitle>
                <AlertDescription className="space-y-2 text-xs sm:text-sm">
                  <p>{feeError.message}</p>
                  {feeError.kind === "insufficient" && typeof feeError.shortfall === "number" && (
                    <p className="font-medium">
                      Top up at least{" "}
                      <span className="font-mono">
                        {feeError.shortfall.toLocaleString()} {feeError.currency}
                      </span>{" "}
                      to continue.
                    </p>
                  )}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setFeeError(null)}
                      className="rounded-lg"
                    >
                      Retry
                    </Button>
                    {(feeError.kind === "insufficient" || feeError.kind === "no_balance") && (
                      <Button size="sm" variant="default" className="rounded-lg gap-1.5" asChild>
                        <a href="/app/wallet">
                          <Wallet className="h-3.5 w-3.5" />
                          Add funds
                        </a>
                      </Button>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {preview && (
              <div className="space-y-3 rounded-2xl border bg-card p-3 sm:p-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period</p>
                  <p className="font-semibold text-foreground break-words">{periodLabel}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account holder</p>
                    <p className="font-semibold text-foreground break-words">{preview.customer.full_name}</p>
                    {(preview.customer.address_lines || []).map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground break-words">{l}</p>
                    ))}
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Issuing bank</p>
                    <p className="font-semibold text-foreground break-words">{preview.bank.name}</p>
                    {(preview.bank.address_lines || []).map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground break-words">{l}</p>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account</p>
                    <p className="font-mono text-[11px] sm:text-xs text-foreground break-all">{preview.account.account_no}</p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transactions</p>
                    <p className="font-semibold text-foreground">{preview.tx_count}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Barcode preview</p>
                  <div className="overflow-x-auto">
                    <BarcodePreview value={preview.preview_serial} />
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground break-all">
                    Preview reference: {preview.preview_serial}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Final serial is allocated server-side and will appear on the PDF.
                  </p>
                </div>
                <div className="border-t pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Download fee
                  </p>
                  {fee?.enabled && fee.amount > 0 ? (
                    <p className="text-sm font-semibold text-foreground">
                      {fee.amount.toLocaleString()} {fee.currency}{" "}
                      <span className="font-normal text-muted-foreground">
                        will be deducted from your balance when you download.
                      </span>
                    </p>
                  ) : (
                    <p className="text-sm font-semibold text-foreground">
                      Free — no fee applied.
                    </p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    Viewing this preview is always free. Retries reuse the same secure charge token.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col-reverse gap-2 sm:flex-row sm:gap-2">
              <Button
                variant="outline"
                onClick={() => { setStep("select"); setFeeError(null); }}
                className="w-full sm:w-auto rounded-xl gap-2"
                disabled={downloading}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleConfirmDownload}
                disabled={downloading}
                className="w-full sm:w-auto rounded-xl gap-2"
              >
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span className="truncate">
                  {downloading ? "Generating PDF..." : payLabel}
                </span>
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
