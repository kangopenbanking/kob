// Phase 3 — Merchant Export Center
// Additive page: filters + client-side CSV/JSON export of transactions,
// settlements, fees; downloadable monthly statements via existing
// gateway-merchant-statement edge function. RLS scopes data to merchant owner.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, FileText, Receipt, Landmark, Coins } from "lucide-react";
import { toast } from "sonner";
import { format as fmtDate } from "date-fns";

type Resource = "transactions" | "settlements" | "fees";
type ExportFormat = "csv" | "json";

const TABLE_MAP: Record<Resource, { table: string; dateCol: string; currencyCol: string; envCol?: string }> = {
  transactions: { table: "gateway_charges", dateCol: "created_at", currencyCol: "currency", envCol: "environment" },
  settlements:  { table: "gateway_settlements", dateCol: "created_at", currencyCol: "currency" },
  fees:         { table: "gateway_fee_ledger", dateCol: "created_at", currencyCol: "currency" },
};

function toCSV(rows: any[]): string {
  if (!rows.length) return "";
  const cols = Array.from(rows.reduce((s, r) => { Object.keys(r).forEach(k => s.add(k)); return s; }, new Set<string>()));
  const esc = (v: any) => {
    if (v === null || v === undefined) return "";
    const s = typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map(r => cols.map(c => esc(r[c])).join(","))].join("\n");
}

function downloadBlob(name: string, data: string, mime: string) {
  const url = URL.createObjectURL(new Blob([data], { type: mime }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export default function MerchantExportCenter() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const monthAgo = useMemo(() => {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statementBusy, setStatementBusy] = useState(false);

  const [resource, setResource] = useState<Resource>("transactions");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [environment, setEnvironment] = useState<"all" | "sandbox" | "live">("all");
  const [currency, setCurrency] = useState<string>("all");
  const [format, setFormat] = useState<ExportFormat>("csv");

  const [statementMonth, setStatementMonth] = useState(today.slice(0, 7));
  const [statementFormat, setStatementFormat] = useState<"pdf" | "csv">("pdf");

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: m } = await supabase
        .from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
      setMerchantId(m?.id ?? null);
      setLoading(false);
    })();
  }, []);

  const runExport = async () => {
    if (!merchantId) { toast.error("No merchant profile found."); return; }
    setBusy(true);
    try {
      const cfg = TABLE_MAP[resource];
      let q = supabase.from(cfg.table as any).select("*").eq("merchant_id", merchantId)
        .gte(cfg.dateCol, from).lte(cfg.dateCol, `${to}T23:59:59`);
      if (currency !== "all") q = q.eq(cfg.currencyCol, currency);
      if (cfg.envCol && environment !== "all") q = q.eq(cfg.envCol, environment);

      const { data, error } = await q.order(cfg.dateCol, { ascending: false }).limit(10000);
      if (error) throw error;
      const rows = data ?? [];
      if (!rows.length) { toast.message("No rows match these filters."); return; }

      const stamp = `${resource}_${from}_to_${to}`;
      if (format === "csv") downloadBlob(`${stamp}.csv`, toCSV(rows), "text/csv");
      else downloadBlob(`${stamp}.json`, JSON.stringify(rows, null, 2), "application/json");

      toast.success(`Exported ${rows.length} rows.`);
    } catch (e: any) {
      toast.error(e?.message || "Could not export. Please try again.");
    } finally { setBusy(false); }
  };

  const downloadStatement = async () => {
    if (!merchantId) return;
    setStatementBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-merchant-statement", {
        body: { merchant_id: merchantId, month: statementMonth, format: statementFormat },
      });
      if (error) throw error;
      const url = (data as any)?.url ?? (data as any)?.download_url;
      if (url) {
        window.open(url, "_blank", "noopener,noreferrer");
        toast.success("Statement ready.");
      } else if (data) {
        downloadBlob(`statement_${statementMonth}.${statementFormat}`, JSON.stringify(data, null, 2), "application/json");
        toast.success("Statement downloaded.");
      }
    } catch (e: any) {
      toast.error(e?.message || "Could not generate statement.");
    } finally { setStatementBusy(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!merchantId) {
    return (
      <Card><CardContent className="py-12 text-center text-muted-foreground">
        No merchant profile found for your account. Complete merchant onboarding first.
      </CardContent></Card>
    );
  }

  const ResourceIcon = resource === "transactions" ? Receipt : resource === "settlements" ? Landmark : Coins;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Export Center</h1>
        <p className="text-muted-foreground">Download transactions, settlements, fees and monthly statements.</p>
      </div>

      <Tabs defaultValue="data">
        <TabsList>
          <TabsTrigger value="data">Data exports</TabsTrigger>
          <TabsTrigger value="statements">Statements</TabsTrigger>
        </TabsList>

        <TabsContent value="data" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <ResourceIcon className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Filtered export</CardTitle>
              </div>
              <CardDescription>
                Returns rows scoped to your merchant account. Up to 10,000 rows per export — narrow the date range for larger windows.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Resource</Label>
                  <Select value={resource} onValueChange={(v) => setResource(v as Resource)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transactions">Transactions</SelectItem>
                      <SelectItem value="settlements">Settlements</SelectItem>
                      <SelectItem value="fees">Fees</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>From</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>To</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Environment</Label>
                  <Select value={environment} onValueChange={(v) => setEnvironment(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                      <SelectItem value="live">Live</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="XAF">XAF</SelectItem>
                      <SelectItem value="XOF">XOF</SelectItem>
                      <SelectItem value="USD">USD</SelectItem>
                      <SelectItem value="EUR">EUR</SelectItem>
                      <SelectItem value="NGN">NGN</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="csv">CSV</SelectItem>
                      <SelectItem value="json">JSON</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Badge variant="outline">{resource} · {from} → {to}</Badge>
                <Button onClick={runExport} disabled={busy} className="gap-2">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Export
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statements" className="mt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <CardTitle>Monthly statement</CardTitle>
              </div>
              <CardDescription>Signed PDF or CSV statement covering one calendar month.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label>Month</Label>
                  <Input type="month" value={statementMonth} onChange={(e) => setStatementMonth(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>Format</Label>
                  <Select value={statementFormat} onValueChange={(v) => setStatementFormat(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pdf">PDF</SelectItem>
                      <SelectItem value="csv">CSV</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={downloadStatement} disabled={statementBusy} className="gap-2 w-full">
                    {statementBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download statement
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Generated as of {fmtDate(new Date(), "PPP")}. Statements are delivered as signed URLs valid for 15 minutes.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
