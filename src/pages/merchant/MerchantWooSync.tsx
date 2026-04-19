import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, Plug, AlertTriangle, Package } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const STATUS_CONFIG: Record<string, { label: string; icon: any; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  connected: { label: "Connected", icon: CheckCircle2, variant: "default" },
  disconnected: { label: "Disconnected", icon: XCircle, variant: "secondary" },
  error: { label: "Error", icon: AlertTriangle, variant: "destructive" },
};

const RUN_STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  success: { label: "Success", variant: "default" },
  running: { label: "Running", variant: "secondary" },
  failed: { label: "Failed", variant: "destructive" },
};

export default function MerchantWooSync() {
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<any[]>([]);
  const [syncRuns, setSyncRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return setLoading(false);

    const { data: merchant } = await supabase
      .from("gateway_merchants")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!merchant) return setLoading(false);
    setMerchantId(merchant.id);

    const intRes = await (supabase as any)
      .from("merchant_integrations")
      .select("*")
      .eq("merchant_id", merchant.id)
      .eq("type", "woocommerce")
      .order("created_at", { ascending: false });

    const runRes = await (supabase as any)
      .from("integration_sync_runs")
      .select("*, merchant_integrations(base_url)")
      .eq("merchant_id", merchant.id)
      .order("started_at", { ascending: false })
      .limit(50);

    setIntegrations(intRes.data || []);
    setSyncRuns(runRes.data || []);
    setLoading(false);
  };

  const triggerSync = async (integrationId: string) => {
    setSyncing(integrationId);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("pos-inventory-sync", {
        body: { merchant_id: merchantId, integration_id: integrationId },
      });

      if (response.error) throw response.error;
      toast.success("Sync triggered successfully");
      setTimeout(loadData, 1500);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Failed to trigger sync"));
    } finally {
      setSyncing(null);
    }
  };

  const importProducts = async (integrationId: string) => {
    setSyncing(integrationId + "_import");
    try {
      const response = await supabase.functions.invoke("pos-woo-connector", {
        body: {
          action: "import_products",
          merchant_id: merchantId,
          integration_id: integrationId,
          mode: "incremental",
          include: "both",
          merge_strategy: "woo_source_of_truth",
        },
      });

      if (response.error) throw response.error;
      const result = response.data;
      toast.success(`Import complete: ${result?.imported || 0} products synced`);
      loadData();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Failed to import products"));
    } finally {
      setSyncing(null);
    }
  };

  const totalRuns = syncRuns.length;
  const successRuns = syncRuns.filter(r => r.status === "success").length;
  const failedRuns = syncRuns.filter(r => r.status === "failed").length;
  const lastRun = syncRuns[0];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">WooCommerce Sync</h1>
        <p className="text-muted-foreground">Monitor and manage product synchronization with your WooCommerce stores</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Connected Stores", value: integrations.filter(i => i.status === "connected").length, icon: Plug, color: "text-primary" },
          { label: "Total Sync Runs", value: totalRuns, icon: RefreshCw, color: "text-muted-foreground" },
          { label: "Successful", value: successRuns, icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Failed", value: failedRuns, icon: XCircle, color: "text-destructive" },
        ].map(stat => (
          <Card key={stat.label}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Connected Stores */}
      <Card>
        <CardHeader>
          <CardTitle>Connected WooCommerce Stores</CardTitle>
          <CardDescription>
            {integrations.length === 0
              ? "No stores connected yet. Use the WooCommerce connector to link a store."
              : `${integrations.length} store${integrations.length > 1 ? "s" : ""} configured`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {integrations.length === 0 ? (
            <div className="py-8 text-center">
              <Plug className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="text-sm text-muted-foreground">
                Connect a WooCommerce store via{" "}
                <span className="font-medium text-foreground">Settings → Integrations</span>{" "}
                or the POS connector API.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {integrations.map(integration => {
                const cfg = STATUS_CONFIG[integration.status] || STATUS_CONFIG.disconnected;
                const StatusIcon = cfg.icon;
                const isSyncing = syncing === integration.id;
                const isImporting = syncing === integration.id + "_import";
                return (
                  <div key={integration.id} className="flex items-center justify-between rounded-lg border bg-card p-4 gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{integration.base_url || "Unknown Store"}</p>
                        <Badge variant={cfg.variant} className="shrink-0 gap-1 text-xs">
                          <StatusIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Merge strategy: <span className="font-mono">{integration.settings_json?.sync_strategy || "woo_source_of_truth"}</span>
                        {integration.last_sync_at && (
                          <> · Last sync: {format(new Date(integration.last_sync_at), "MMM d, HH:mm")}</>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => importProducts(integration.id)}
                        disabled={!!syncing}
                        className="gap-1"
                      >
                        {isImporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Package className="h-3.5 w-3.5" />}
                        Import
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => triggerSync(integration.id)}
                        disabled={!!syncing}
                        className="gap-1"
                      >
                        {isSyncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        Sync Now
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Run History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Sync History</CardTitle>
              <CardDescription>Last 50 synchronization runs</CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadData} className="gap-1">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {syncRuns.length === 0 ? (
            <div className="py-12 text-center">
              <Clock className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No sync runs yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Store</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Errors</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncRuns.map(run => {
                  const runCfg = RUN_STATUS_CONFIG[run.status] || { label: run.status, variant: "outline" as const };
                  const duration = run.finished_at && run.started_at
                    ? Math.round((new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000)
                    : null;
                  const productsSynced = run.summary_json?.products_synced ?? run.summary_json?.imported ?? null;
                  return (
                    <TableRow key={run.id}>
                      <TableCell className="text-xs font-mono text-muted-foreground max-w-[160px] truncate">
                        {run.merchant_integrations?.base_url || run.integration_id?.slice(0, 8) + "..."}
                      </TableCell>
                      <TableCell>
                        <Badge variant={runCfg.variant} className="text-xs">{runCfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {productsSynced != null ? (
                          <span>{productsSynced} synced</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {duration != null ? `${duration}s` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {run.started_at ? format(new Date(run.started_at), "MMM d, HH:mm:ss") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                        {run.error_message || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
