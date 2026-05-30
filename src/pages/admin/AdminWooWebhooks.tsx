// Admin · WooCommerce webhook & settlement console.
// Shows per-merchant deliveries, retries, recent transactions with settlement
// status, and any reconciliation mismatches flagged by the scheduled job.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, RefreshCw, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Tx = {
  id: string; merchant_id: string; transaction_ref: string; status: string;
  amount: number; currency: string; woocommerce_order_id: string;
  kob_transaction_id: string | null; error_message: string | null; created_at: string;
};
type InboxRow = { id: string; source: string; event_id: string | null; status: string; attempt_count: number; created_at: string; processing_error: string | null };
type MismatchRow = { id: string; mismatch_type: string; platform_status: string | null; provider_status: string | null; platform_amount: number | null; provider_amount: number | null; provider_ref: string | null; resolution_status: string; created_at: string };

const STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default", pending: "secondary", processing: "secondary",
  failed: "destructive", refunded: "outline",
};

export default function AdminWooWebhooks() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reconciling, setReconciling] = useState(false);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [inbox, setInbox] = useState<InboxRow[]>([]);
  const [mismatches, setMismatches] = useState<MismatchRow[]>([]);
  const [merchantFilter, setMerchantFilter] = useState("");

  const load = async () => {
    setRefreshing(true);
    const [{ data: t }, { data: i }, { data: m }] = await Promise.all([
      supabase.from("woocommerce_transactions").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("webhook_inbox").select("id,source,event_id,status,attempt_count,created_at,processing_error").in("source", ["woocommerce", "woocommerce_inbound"]).order("created_at", { ascending: false }).limit(100),
      supabase.from("reconciliation_mismatches").select("id,mismatch_type,platform_status,provider_status,platform_amount,provider_amount,provider_ref,resolution_status,created_at").eq("entity_type", "woocommerce_transaction").order("created_at", { ascending: false }).limit(100),
    ]);
    setTxs((t as Tx[]) || []);
    setInbox((i as InboxRow[]) || []);
    setMismatches((m as MismatchRow[]) || []);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => { load(); }, []);

  const runReconcile = async () => {
    setReconciling(true);
    try {
      const { data, error } = await supabase.functions.invoke("woocommerce-reconciliation", { body: { hours: 24 } });
      if (error) throw error;
      toast.success(`Reconciliation complete: ${data?.matched ?? 0} matched, ${data?.mismatched ?? 0} mismatched`);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Reconciliation failed");
    } finally {
      setReconciling(false);
    }
  };

  const filteredTxs = useMemo(() =>
    merchantFilter ? txs.filter(t => t.merchant_id.includes(merchantFilter)) : txs,
    [txs, merchantFilter]
  );

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      <SEO title="WooCommerce Webhook Console" description="Admin view of WooCommerce webhook deliveries, settlements, and reconciliation mismatches." />
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">WooCommerce webhooks & settlement</h1>
          <p className="text-sm text-muted-foreground">Live status, retries, and reconciliation across every Woo merchant.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={runReconcile} disabled={reconciling}>
            <PlayCircle className="h-4 w-4 mr-2" /> {reconciling ? "Reconciling…" : "Run reconciliation"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">Transactions ({txs.length})</TabsTrigger>
          <TabsTrigger value="deliveries">Deliveries ({inbox.length})</TabsTrigger>
          <TabsTrigger value="mismatches">Mismatches ({mismatches.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Recent transactions</CardTitle>
              <CardDescription>Settlement status per WooCommerce order.</CardDescription>
              <Input placeholder="Filter by merchant id…" value={merchantFilter} onChange={e => setMerchantFilter(e.target.value)} className="max-w-sm mt-2" />
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Tx ref</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Charge link</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTxs.map(t => (
                    <TableRow key={t.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell className="font-mono text-xs">{t.woocommerce_order_id}</TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">{t.transaction_ref}</TableCell>
                      <TableCell className="text-sm">{t.amount} {t.currency}</TableCell>
                      <TableCell><Badge variant={STATUS_VARIANT[t.status] || "outline"}>{t.status}</Badge></TableCell>
                      <TableCell className="font-mono text-xs">{t.kob_transaction_id?.slice(0, 8) ?? "—"}</TableCell>
                    </TableRow>
                  ))}
                  {filteredTxs.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No transactions in window.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deliveries">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Webhook deliveries</CardTitle>
              <CardDescription>Notify + inbound events, with attempt counts and processing errors.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Event id</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Attempts</TableHead>
                    <TableHead>Error</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inbox.map(i => (
                    <TableRow key={i.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(i.created_at), "MMM d, HH:mm:ss")}</TableCell>
                      <TableCell className="text-xs"><Badge variant="outline">{i.source}</Badge></TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[220px]">{i.event_id ?? "—"}</TableCell>
                      <TableCell><Badge variant={i.status === "processed" ? "default" : i.status === "failed" ? "destructive" : "secondary"}>{i.status}</Badge></TableCell>
                      <TableCell className="text-xs">{i.attempt_count}</TableCell>
                      <TableCell className="text-xs text-destructive truncate max-w-[260px]">{i.processing_error ?? ""}</TableCell>
                    </TableRow>
                  ))}
                  {inbox.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No deliveries yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="mismatches">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Reconciliation mismatches</CardTitle>
              <CardDescription>Flagged by the scheduled gateway-vs-Woo reconciliation job.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>When</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Tx ref</TableHead>
                    <TableHead>Platform</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Resolution</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mismatches.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(m.created_at), "MMM d, HH:mm")}</TableCell>
                      <TableCell><Badge variant="outline">{m.mismatch_type}</Badge></TableCell>
                      <TableCell className="font-mono text-xs truncate max-w-[200px]">{m.provider_ref ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.platform_status ?? "—"} · {m.platform_amount ?? "—"}</TableCell>
                      <TableCell className="text-xs">{m.provider_status ?? "—"} · {m.provider_amount ?? "—"}</TableCell>
                      <TableCell><Badge variant={m.resolution_status === "open" ? "destructive" : "default"}>{m.resolution_status}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {mismatches.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No mismatches flagged. Settlement is clean.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
