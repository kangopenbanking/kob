import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plug, Plus, Trash2, Activity, ShieldCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type OwnerType = "institution" | "merchant" | "developer";
type ConnectorId = "mtn_momo" | "orange_money" | "flutterwave" | "soap_bank";

interface Props {
  ownerType: OwnerType;
  ownerId: string;
}

interface Row {
  id: string;
  connector_id: ConnectorId;
  environment: "sandbox" | "live";
  country: string;
  enabled: boolean;
  priority: number;
  display_name: string | null;
  health_status: "unknown" | "healthy" | "degraded" | "unhealthy";
  last_health_check_at: string | null;
  last_health_error: string | null;
}

const CONNECTOR_FIELDS: Record<ConnectorId, { label: string; key: string; placeholder?: string }[]> = {
  mtn_momo: [
    { label: "Subscription Key", key: "subscription_key", placeholder: "Ocp-Apim-Subscription-Key" },
    { label: "API User", key: "api_user", placeholder: "UUID v4" },
    { label: "API Key", key: "api_key" },
    { label: "Target Environment", key: "target_environment", placeholder: "sandbox or mtncameroon" },
  ],
  orange_money: [
    { label: "Client ID", key: "client_id" },
    { label: "Client Secret", key: "client_secret" },
    { label: "Merchant Key", key: "merchant_key" },
  ],
  flutterwave: [
    { label: "Secret Key", key: "secret_key", placeholder: "FLWSECK-..." },
  ],
  soap_bank: [
    { label: "Endpoint URL", key: "endpoint_url", placeholder: "https://core.bank.example/services/PaymentService" },
    { label: "WS-Security Username", key: "username" },
    { label: "WS-Security Password", key: "password" },
    { label: "Service Namespace", key: "service_namespace", placeholder: "http://bank.example/payments" },
    { label: "Initiate Operation", key: "operation_initiate", placeholder: "InitiatePayment" },
    { label: "Status Operation", key: "operation_status", placeholder: "GetPaymentStatus" },
  ],
};

const CONNECTOR_LABELS: Record<ConnectorId, string> = {
  mtn_momo: "MTN MoMo (Direct)",
  orange_money: "Orange Money (Direct)",
  flutterwave: "Flutterwave (Tenant)",
  soap_bank: "SOAP Bank (Legacy Core)",
};

export function PaymentConnectorsPanel({ ownerType, ownerId }: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [connector, setConnector] = useState<ConnectorId>("mtn_momo");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [country, setCountry] = useState("CM");
  const [priority, setPriority] = useState(100);
  const [displayName, setDisplayName] = useState("");
  const [creds, setCreds] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("tenant-connectors-list", {
      method: "GET" as never,
      // pass query via body workaround: list endpoint reads search params from URL,
      // but invoke doesn't expose URL params; do a direct table query instead.
    } as never).catch(() => ({ data: null, error: null } as { data: null; error: null }));

    // Fallback: direct table query (RLS scoped)
    if (!data) {
      const { data: rowsData, error: qErr } = await supabase
        .from("tenant_payment_connectors")
        .select("id, connector_id, environment, country, enabled, priority, display_name, health_status, last_health_check_at, last_health_error")
        .eq("owner_type", ownerType)
        .eq("owner_id", ownerId)
        .order("priority", { ascending: true });
      if (qErr) {
        toast({ title: "Failed to load connectors", description: qErr.message, variant: "destructive" });
      } else {
        setRows((rowsData || []) as Row[]);
      }
    } else {
      setRows((data as { connectors: Row[] }).connectors || []);
    }
    setLoading(false);
  }, [ownerType, ownerId, toast]);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => {
    setConnector("mtn_momo");
    setEnvironment("sandbox");
    setCountry("CM");
    setPriority(100);
    setDisplayName("");
    setCreds({});
  };

  const handleCreate = async () => {
    const required = CONNECTOR_FIELDS[connector].map(f => f.key).filter(k => k !== "target_environment");
    const missing = required.filter(k => !creds[k]?.trim());
    if (missing.length > 0) {
      toast({ title: "Missing credentials", description: `Required: ${missing.join(", ")}`, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("tenant-connectors-manage", {
      body: {
        action: "create",
        owner_type: ownerType,
        owner_id: ownerId,
        connector_id: connector,
        environment,
        country,
        priority,
        display_name: displayName || undefined,
        credentials: creds,
      },
    });
    setSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({ title: "Failed to add connector", description: error?.message || (data as { error?: string }).error, variant: "destructive" });
      return;
    }
    toast({ title: "Connector added" });
    setOpen(false);
    resetForm();
    load();
  };

  const handleToggle = async (row: Row, enabled: boolean) => {
    const { error } = await supabase.functions.invoke("tenant-connectors-manage", {
      body: { action: "update", id: row.id, enabled },
    });
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
    } else {
      load();
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remove this connector? This action cannot be undone.")) return;
    const { error } = await supabase.functions.invoke("tenant-connectors-manage", {
      body: { action: "delete", id },
    });
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Connector removed" });
      load();
    }
  };

  const handleTest = async (id: string) => {
    setTestingId(id);
    const { data, error } = await supabase.functions.invoke("tenant-connectors-test", { body: { id } });
    setTestingId(null);
    if (error) {
      toast({ title: "Health check failed", description: error.message, variant: "destructive" });
      return;
    }
    const result = (data as { result?: { healthy: boolean; latency_ms?: number; error?: string } })?.result;
    toast({
      title: result?.healthy ? "Connector healthy" : "Connector unhealthy",
      description: result?.healthy ? `Latency ${result.latency_ms}ms` : result?.error || "Unknown error",
      variant: result?.healthy ? "default" : "destructive",
    });
    load();
  };

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 border border-primary/20">
              <Plug className="h-4 w-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-sm font-semibold">Payment Connectors (BYO)</CardTitle>
              <CardDescription className="text-xs">
                Bring your own MTN MoMo or Orange Money API keys. Flutterwave (managed by KOB) is always available as fallback.
              </CardDescription>
            </div>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <Plus className="h-3.5 w-3.5 mr-1.5" /> Add Connector
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Add Payment Connector</DialogTitle>
                <DialogDescription>
                  Credentials are encrypted at rest and never returned to your client.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Provider</Label>
                    <Select value={connector} onValueChange={(v) => { setConnector(v as ConnectorId); setCreds({}); }}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mtn_momo">MTN MoMo</SelectItem>
                        <SelectItem value="orange_money">Orange Money</SelectItem>
                        <SelectItem value="flutterwave">Flutterwave</SelectItem>
                        <SelectItem value="soap_bank">SOAP Bank (Legacy Core)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Environment</Label>
                    <Select value={environment} onValueChange={(v) => setEnvironment(v as "sandbox" | "live")}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sandbox">Sandbox</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Country</Label>
                    <Input className="h-9" value={country} onChange={(e) => setCountry(e.target.value.toUpperCase())} maxLength={3} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Priority (lower = first)</Label>
                    <Input className="h-9" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Display Name (optional)</Label>
                  <Input className="h-9" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. MTN Production CM" />
                </div>
                <div className="space-y-2 pt-2 border-t border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground">Credentials</p>
                  {CONNECTOR_FIELDS[connector].map((f) => (
                    <div key={f.key} className="space-y-1.5">
                      <Label className="text-xs">{f.label}</Label>
                      <Input
                        className="h-9 font-mono text-xs"
                        type={f.key.includes("secret") || f.key.includes("key") ? "password" : "text"}
                        placeholder={f.placeholder}
                        value={creds[f.key] || ""}
                        onChange={(e) => setCreds({ ...creds, [f.key]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" size="sm" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
                <Button size="sm" onClick={handleCreate} disabled={saving}>
                  <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                  {saving ? "Saving..." : "Save Connector"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          <p className="text-xs text-muted-foreground py-4 text-center">Loading...</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/60 p-6 text-center">
            <p className="text-sm font-medium">No custom connectors yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              All mobile-money charges currently use the KOB-managed Flutterwave rail.
            </p>
          </div>
        ) : (
          rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3 hover:bg-muted/30 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{row.display_name || CONNECTOR_LABELS[row.connector_id]}</span>
                  <Badge variant="outline" className="text-[10px]">{row.environment}</Badge>
                  <Badge variant="outline" className="text-[10px]">{row.country}</Badge>
                  <Badge variant="outline" className="text-[10px]">P{row.priority}</Badge>
                  <Badge
                    variant={row.health_status === "healthy" ? "default" : row.health_status === "unhealthy" ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    {row.health_status}
                  </Badge>
                </div>
                {row.last_health_error && (
                  <p className="text-[11px] text-destructive mt-1 truncate">{row.last_health_error}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={row.enabled} onCheckedChange={(v) => handleToggle(row, v)} />
                <Button size="sm" variant="outline" onClick={() => handleTest(row.id)} disabled={testingId === row.id}>
                  <Activity className="h-3.5 w-3.5 mr-1" />
                  {testingId === row.id ? "Testing..." : "Test"}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(row.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
