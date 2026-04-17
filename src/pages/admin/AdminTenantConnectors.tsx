import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plug,
  Search,
  Activity,
  ShieldCheck,
  PowerOff,
  Power,
  Trash2,
  RefreshCw,
} from "lucide-react";

type Row = {
  id: string;
  owner_type: "institution" | "merchant" | "developer";
  owner_id: string;
  connector_id: "mtn_momo" | "orange_money" | "flutterwave";
  environment: "sandbox" | "live";
  country: string;
  enabled: boolean;
  priority: number;
  display_name: string | null;
  health_status: "unknown" | "healthy" | "degraded" | "unhealthy";
  last_health_check_at: string | null;
  last_health_error: string | null;
  created_at: string;
  updated_at: string;
};

const healthVariant: Record<Row["health_status"], string> = {
  healthy: "bg-primary text-primary-foreground",
  degraded: "bg-amber-500 text-white",
  unhealthy: "bg-destructive text-destructive-foreground",
  unknown: "bg-muted text-foreground",
};

export default function AdminTenantConnectors() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState<string>("all");
  const [healthFilter, setHealthFilter] = useState<string>("all");
  const [audit, setAudit] = useState<any[] | null>(null);
  const [auditTitle, setAuditTitle] = useState("");
  const [pollHealth, setPollHealth] = useState<{ pending: number; oldest_minutes: number | null; terminal_24h: number; failed_24h: number } | null>(null);
  const [trail, setTrail] = useState<any[] | null>(null);
  const [trailTitle, setTrailTitle] = useState("");
  const { toast } = useToast();

  const loadPollHealth = async () => {
    const { data: pending } = await supabase
      .from("byo_charge_polls")
      .select("created_at", { count: "exact" })
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1);
    const { count: pendingCount } = await supabase
      .from("byo_charge_polls")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending");
    const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    const { count: terminal24 } = await supabase
      .from("byo_charge_polls")
      .select("id", { count: "exact", head: true })
      .in("status", ["successful"])
      .gte("terminal_at", since);
    const { count: failed24 } = await supabase
      .from("byo_charge_polls")
      .select("id", { count: "exact", head: true })
      .in("status", ["failed", "expired"])
      .gte("terminal_at", since);
    const oldest = pending?.[0]?.created_at
      ? Math.round((Date.now() - new Date(pending[0].created_at).getTime()) / 60000)
      : null;
    setPollHealth({
      pending: pendingCount ?? 0,
      oldest_minutes: oldest,
      terminal_24h: terminal24 ?? 0,
      failed_24h: failed24 ?? 0,
    });
  };

  const viewRoutingTrail = async (row: Row) => {
    setTrailTitle(`${row.connector_id} · routing attempts`);
    const { data, error } = await supabase
      .from("byo_routing_attempts")
      .select("attempted_at, connector_id, attempt_index, success, error_message, charge_id")
      .eq("tenant_connector_id", row.id)
      .order("attempted_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({ title: "Could not load routing trail", description: error.message, variant: "destructive" });
      return;
    }
    setTrail(data ?? []);
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tenant_payment_connectors")
      .select(
        "id, owner_type, owner_id, connector_id, environment, country, enabled, priority, display_name, health_status, last_health_check_at, last_health_error, created_at, updated_at"
      )
      .order("created_at", { ascending: false });
    if (error) {
      toast({
        title: "Failed to load connectors",
        description: error.message,
        variant: "destructive",
      });
    } else {
      setRows((data ?? []) as Row[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    loadPollHealth();
  }, []);

  const filtered = rows.filter((r) => {
    if (ownerFilter !== "all" && r.owner_type !== ownerFilter) return false;
    if (healthFilter !== "all" && r.health_status !== healthFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !r.owner_id.toLowerCase().includes(q) &&
        !r.connector_id.includes(q) &&
        !r.country.toLowerCase().includes(q) &&
        !(r.display_name ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const counts = {
    total: rows.length,
    healthy: rows.filter((r) => r.health_status === "healthy").length,
    degraded: rows.filter(
      (r) => r.health_status === "degraded" || r.health_status === "unhealthy"
    ).length,
    disabled: rows.filter((r) => !r.enabled).length,
  };

  const toggle = async (row: Row) => {
    const { error } = await supabase
      .from("tenant_payment_connectors")
      .update({ enabled: !row.enabled })
      .eq("id", row.id);
    if (error) {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: row.enabled ? "Connector disabled" : "Connector enabled",
      });
      load();
    }
  };

  const remove = async (row: Row) => {
    if (!confirm(`Permanently delete this ${row.connector_id} connector?`))
      return;
    const { error } = await supabase
      .from("tenant_payment_connectors")
      .delete()
      .eq("id", row.id);
    if (error) {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({ title: "Connector removed" });
      load();
    }
  };

  const test = async (row: Row) => {
    toast({ title: "Running health check…" });
    const { data, error } = await supabase.functions.invoke(
      "tenant-connectors-test",
      { body: { id: row.id } }
    );
    if (error) {
      toast({
        title: "Health check failed",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: `Health: ${data?.health_status ?? "unknown"}`,
        description: data?.message ?? "",
      });
      load();
    }
  };

  const viewAudit = async (row: Row) => {
    setAuditTitle(`${row.connector_id} · ${row.owner_type}`);
    const { data, error } = await supabase
      .from("audit_logs")
      .select("created_at, action_type, performed_by, details")
      .eq("entity_type", "tenant_payment_connector")
      .eq("entity_id", row.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast({
        title: "Could not load audit trail",
        description: error.message,
        variant: "destructive",
      });
      return;
    }
    setAudit(data ?? []);
  };

  return (
    <div className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Plug className="h-7 w-7 text-primary" />
            Tenant Payment Connectors
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
            Oversight of all Bring-Your-Own MTN MoMo, Orange Money and tenant
            Flutterwave rails registered by institutions, merchants and
            developers. Credentials are AES-GCM encrypted and never visible
            here.
          </p>
        </div>
        <Button onClick={load} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total connectors" value={counts.total} icon={Plug} />
        <StatCard label="Healthy" value={counts.healthy} icon={ShieldCheck} />
        <StatCard label="Degraded / Unhealthy" value={counts.degraded} icon={Activity} />
        <StatCard label="Disabled" value={counts.disabled} icon={PowerOff} />
      </div>

      <Card className="border-2 border-primary/20">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Poll queue health (BYO direct rails)
          </CardTitle>
          <CardDescription>
            Reconciliation status for MTN/Orange/SOAP charges that providers do not push reliably.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MiniStat label="Pending" value={pollHealth?.pending ?? 0} />
            <MiniStat label="Oldest pending" value={pollHealth?.oldest_minutes != null ? `${pollHealth.oldest_minutes}m` : "—"} />
            <MiniStat label="Settled (24h)" value={pollHealth?.terminal_24h ?? 0} />
            <MiniStat label="Failed/expired (24h)" value={pollHealth?.failed_24h ?? 0} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Registered connectors</CardTitle>
          <CardDescription>
            Audit the routing fleet, force a health check, disable a faulty
            rail, or remove credentials on tenant request.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search owner ID, connector, country…"
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Owner type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All owner types</SelectItem>
                <SelectItem value="institution">Institution</SelectItem>
                <SelectItem value="merchant">Merchant</SelectItem>
                <SelectItem value="developer">Developer</SelectItem>
              </SelectContent>
            </Select>
            <Select value={healthFilter} onValueChange={setHealthFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Health" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All health states</SelectItem>
                <SelectItem value="healthy">Healthy</SelectItem>
                <SelectItem value="degraded">Degraded</SelectItem>
                <SelectItem value="unhealthy">Unhealthy</SelectItem>
                <SelectItem value="unknown">Unknown</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Connector</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>Country / Env</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Health</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Loading…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No connectors registered yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>
                        <div className="font-medium">{r.connector_id}</div>
                        {r.display_name && (
                          <div className="text-xs text-muted-foreground">
                            {r.display_name}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {r.owner_type}
                        </Badge>
                        <div className="text-xs text-muted-foreground font-mono mt-1 truncate max-w-[180px]">
                          {r.owner_id}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div>{r.country}</div>
                        <div className="text-xs text-muted-foreground capitalize">
                          {r.environment}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{r.priority}</TableCell>
                      <TableCell>
                        <Badge className={healthVariant[r.health_status]}>
                          {r.health_status}
                        </Badge>
                        {r.last_health_error && (
                          <div className="text-xs text-destructive mt-1 max-w-[180px] truncate">
                            {r.last_health_error}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {r.enabled ? (
                          <Badge className="bg-primary text-primary-foreground">Enabled</Badge>
                        ) : (
                          <Badge variant="outline">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => test(r)} title="Health check">
                            <Activity className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggle(r)} title={r.enabled ? "Disable" : "Enable"}>
                            {r.enabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => viewAudit(r)} title="Audit trail">
                            <ShieldCheck className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => viewRoutingTrail(r)} title="Routing attempts">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => remove(r)} title="Delete">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={audit !== null} onOpenChange={(o) => !o && setAudit(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Audit trail · {auditTitle}</DialogTitle>
            <DialogDescription>
              Last 50 mutations recorded for this connector.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {audit?.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No audit events recorded.
              </p>
            )}
            {audit?.map((e, i) => (
              <div key={i} className="border rounded-md p-3 text-xs">
                <div className="flex justify-between gap-3 mb-1">
                  <span className="font-mono font-semibold">{e.action_type}</span>
                  <span className="text-muted-foreground">
                    {new Date(e.created_at).toLocaleString()}
                  </span>
                </div>
                {e.details && (
                  <pre className="text-muted-foreground overflow-x-auto mt-2">
                    {JSON.stringify(e.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Card className="border-2">
      <CardContent className="p-5 flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </p>
          <p className="text-3xl font-bold mt-1">{value}</p>
        </div>
        <Icon className="h-8 w-8 text-primary opacity-80" />
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-3 bg-muted/30">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">{label}</p>
      <p className="text-2xl font-bold mt-1">{value}</p>
    </div>
  );
}
