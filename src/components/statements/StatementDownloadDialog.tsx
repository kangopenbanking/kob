import React, { useMemo, useState } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
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
import {
  generateStatementPdf,
  type StatementInput,
  type StatementSource,
  type StatementTx,
} from "@/lib/statements/generateStatementPdf";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export interface StatementDownloadDialogProps {
  source: StatementSource;
  /** Provider that resolves the data needed to render the statement for a period. */
  getStatementInput: (range: {
    from: string;
    to: string;
  }) => Promise<Omit<StatementInput, "source" | "period"> | null>;
  /** Optional trigger override. */
  trigger?: React.ReactNode;
  /** Optional list of years to populate; defaults to last 6 years. */
  years?: number[];
}

export const StatementDownloadDialog: React.FC<StatementDownloadDialogProps> = ({
  source,
  getStatementInput,
  trigger,
  years,
}) => {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [year, setYear] = useState<string>(String(now.getFullYear()));
  const [month, setMonth] = useState<string>("all");
  const [loading, setLoading] = useState(false);

  const yearOptions = useMemo(() => {
    if (years && years.length) return years;
    const out: number[] = [];
    for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) out.push(y);
    return out;
  }, [years]);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const y = parseInt(year, 10);
      let from: Date;
      let to: Date;
      if (month === "all") {
        from = new Date(y, 0, 1);
        to = new Date(y, 11, 31, 23, 59, 59);
      } else {
        const m = parseInt(month, 10);
        from = new Date(y, m, 1);
        to = new Date(y, m + 1, 0, 23, 59, 59);
      }
      const fromIso = from.toISOString();
      const toIso = to.toISOString();

      const base = await getStatementInput({ from: fromIso, to: toIso });
      if (!base) {
        toast.error("No statement data available for this period.");
        return;
      }
      if (!base.transactions || base.transactions.length === 0) {
        toast.error("No transactions found for the selected period.");
        return;
      }

      await generateStatementPdf({
        source,
        period: { from: fromIso, to: toIso },
        ...base,
      });
      toast.success("Statement downloaded.");
      setOpen(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Could not generate the statement. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-1.5 rounded-xl font-semibold">
            <Download className="h-4 w-4" strokeWidth={2} />
            Statement
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Download statement
          </DialogTitle>
          <DialogDescription>
            Choose a period to download your account statement as a PDF.
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
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            className="rounded-xl"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleDownload}
            disabled={loading}
            className="rounded-xl gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {loading ? "Preparing..." : "Download PDF"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export type { StatementTx };
