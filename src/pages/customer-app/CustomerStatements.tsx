import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, FileDown, Loader2, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, subDays } from "date-fns";

export default function CustomerStatements() {
  const nav = useNavigate();
  const [range, setRange] = useState("30");
  const [from, setFrom] = useState(format(subDays(new Date(), 30), "yyyy-MM-dd"));
  const [to, setTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [busy, setBusy] = useState<"csv" | "pdf" | null>(null);

  const updateRange = (v: string) => {
    setRange(v);
    if (v !== "custom") {
      setFrom(format(subDays(new Date(), parseInt(v)), "yyyy-MM-dd"));
      setTo(format(new Date(), "yyyy-MM-dd"));
    }
  };

  const fetchTx = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not signed in");
    const { data, error } = await supabase
      .from("transactions")
      .select("created_at, type, amount, currency, status, description, reference")
      .eq("user_id", user.id)
      .gte("created_at", `${from}T00:00:00`)
      .lte("created_at", `${to}T23:59:59`)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (error) throw error;
    return data || [];
  };

  const downloadCSV = async () => {
    setBusy("csv");
    try {
      const rows = await fetchTx();
      if (rows.length === 0) { toast.info("No transactions in this period"); setBusy(null); return; }
      const header = ["Date", "Type", "Amount", "Currency", "Status", "Description", "Reference"];
      const lines = [header.join(",")].concat(
        rows.map((r: any) => [
          r.created_at, r.type || "", r.amount ?? "", r.currency || "", r.status || "",
          `"${(r.description || "").replace(/"/g, '""')}"`, r.reference || "",
        ].join(","))
      );
      const blob = new Blob([lines.join("\n")], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `statement_${from}_${to}.csv`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${rows.length} transactions`);
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
    setBusy(null);
  };

  const downloadPDF = async () => {
    setBusy("pdf");
    try {
      const rows = await fetchTx();
      if (rows.length === 0) { toast.info("No transactions in this period"); setBusy(null); return; }
      const html = `<!doctype html><html><head><meta charset="utf-8"><title>Statement ${from} to ${to}</title>
        <style>body{font-family:system-ui,sans-serif;padding:24px;color:#111}h1{font-size:20px;margin:0 0 4px}
        .meta{color:#666;font-size:12px;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th,td{text-align:left;padding:8px;border-bottom:1px solid #eee}
        th{background:#f5f5f5}</style></head><body>
        <h1>Account Statement</h1>
        <div class="meta">Period: ${from} to ${to} · ${rows.length} transactions</div>
        <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Amount</th><th>Status</th></tr></thead><tbody>
        ${rows.map((r: any) => `<tr><td>${new Date(r.created_at).toLocaleString()}</td><td>${r.type || ""}</td><td>${r.description || ""}</td><td>${r.amount || ""} ${r.currency || ""}</td><td>${r.status || ""}</td></tr>`).join("")}
        </tbody></table></body></html>`;
      const w = window.open("", "_blank");
      if (!w) { toast.error("Allow pop-ups to download PDF"); setBusy(null); return; }
      w.document.write(html); w.document.close();
      setTimeout(() => w.print(), 400);
      toast.success("Statement opened — use Print → Save as PDF");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
    setBusy(null);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav(-1)} className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Statements</h1>
          <p className="text-xs text-muted-foreground">Export your transaction history</p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <Card className="border-border bg-card p-4 space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Period</Label>
            <Select value={range} onValueChange={updateRange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="365">Last 12 months</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {range === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">From</Label>
                <Input type="date" value={from} onChange={e => setFrom(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">To</Label>
                <Input type="date" value={to} onChange={e => setTo(e.target.value)} />
              </div>
            </div>
          )}
        </Card>

        <Card className="border-border bg-card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileDown className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">Download</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={downloadCSV} disabled={!!busy}>
              {busy === "csv" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileSpreadsheet className="h-5 w-5" />}
              <span className="text-xs font-semibold">CSV</span>
            </Button>
            <Button variant="outline" className="h-20 flex-col gap-2" onClick={downloadPDF} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
              <span className="text-xs font-semibold">PDF</span>
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">Statements include up to 1,000 transactions per export.</p>
        </Card>
      </div>
    </div>
  );
}
