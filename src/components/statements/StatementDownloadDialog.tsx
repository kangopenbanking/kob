import React, { useMemo, useState } from "react";
import { ArrowLeft, Download, FileText, Loader2, ShieldCheck } from "lucide-react";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { downloadStatementReceipt } from "@/lib/statements/receipt";

type StatementSource = "customer" | "banking";

export interface StatementPreviewData {
  customer: { full_name: string; address_lines?: string[] };
  account: { account_no: string; currency: string; holder_name?: string };
  bank: { name: string; address_lines?: string[] };
  tx_count: number;
  preview_serial: string;
}

export interface StatementDownloadDialogProps {
  source: StatementSource;
  /** Banking app: pass the institution id so the server scopes the statement correctly. */
  institutionId?: string;
  /** Returns light-weight preview data (customer + account + bank + tx count). */
  getPreviewData: (range: { from: string; to: string }) => Promise<StatementPreviewData | null>;
  trigger?: React.ReactNode;
  years?: number[];
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Visual placeholder so users can confirm the unique serial barcode shape before download. */
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
    <div className="flex h-10 items-end gap-[1px]">
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

  const yearOptions = useMemo(() => {
    if (years && years.length) return years;
    const out: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) out.push(y);
    return out;
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
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/statements-generate-pdf`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token ?? ""}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            source,
            institution_id: institutionId,
            period_from: range.from,
            period_to: range.to,
          }),
        }
      );
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Server returned ${resp.status}`);
      }
      const serial = resp.headers.get("X-Statement-Serial") || preview.preview_serial;
      const txCount = parseInt(resp.headers.get("X-Statement-Tx-Count") || String(preview.tx_count), 10);
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${source === "customer" ? "KANG" : "BANK"}-Statement-${serial}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Receipt
      downloadStatementReceipt({
        source,
        serial,
        period_from: range.from,
        period_to: range.to,
        tx_count: txCount,
        account_no: preview.account.account_no,
        user_label: preview.customer.full_name,
        bank_name: preview.bank.name,
      });

      toast.success("Statement and receipt downloaded.");
      setOpen(false);
      setStep("select");
      setPreview(null);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || "Could not generate the statement. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) {
          setStep("select");
          setPreview(null);
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
      <DialogContent className="max-w-[92vw] sm:max-w-lg rounded-2xl">
        {step === "select" ? (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Download statement
              </DialogTitle>
              <DialogDescription>
                Choose a period to preview your statement before downloading the PDF.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 gap-3 py-2">
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

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)} className="rounded-xl" disabled={previewing}>
                Cancel
              </Button>
              <Button onClick={handlePreview} disabled={previewing} className="rounded-xl gap-2">
                {previewing ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                {previewing ? "Preparing..." : "Preview statement"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Confirm before download
              </DialogTitle>
              <DialogDescription>
                Review the details below. A unique serial and barcode are issued at download time.
              </DialogDescription>
            </DialogHeader>

            {preview && (
              <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Period</p>
                  <p className="font-semibold text-foreground">{periodLabel}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account holder</p>
                    <p className="font-semibold text-foreground">{preview.customer.full_name}</p>
                    {(preview.customer.address_lines || []).map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{l}</p>
                    ))}
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Issuing bank</p>
                    <p className="font-semibold text-foreground">{preview.bank.name}</p>
                    {(preview.bank.address_lines || []).map((l, i) => (
                      <p key={i} className="text-xs text-muted-foreground">{l}</p>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Account</p>
                    <p className="font-mono text-xs text-foreground">{preview.account.account_no}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Transactions</p>
                    <p className="font-semibold text-foreground">{preview.tx_count}</p>
                  </div>
                </div>
                <div className="border-t pt-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Barcode preview</p>
                  <BarcodePreview value={preview.preview_serial} />
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    Preview reference: {preview.preview_serial}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Final serial is allocated server-side and will appear on the PDF.
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setStep("select")}
                className="rounded-xl gap-2"
                disabled={downloading}
              >
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
              <Button onClick={handleConfirmDownload} disabled={downloading} className="rounded-xl gap-2">
                {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {downloading ? "Generating PDF..." : "Download PDF"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
