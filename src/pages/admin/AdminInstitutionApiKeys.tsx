// Admin console — institution API key lifecycle + usage observability.
// Create / rotate / suspend / resume / revoke keys, view per-key call volume
// and last rate-limit hit.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, KeyRound, RotateCw, PauseCircle, PlayCircle, ShieldOff, Plus, Copy } from "lucide-react";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { format } from "date-fns";

interface ApiKeyRow {
  id: string;
  merchant_id: string;
  key_prefix: string | null;
  label: string | null;
  environment: string | null;
  status: string;
  created_at: string;
  suspended_at: string | null;
  suspended_reason: string | null;
}

interface ApiKeyRow {
  id: string;
  merchant_id: string;
  api_key_prefix: string | null;
  label: string | null;
  environment: string | null;
  status: string;
  created_at: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
}
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [newMerchantId, setNewMerchantId] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newEnv, setNewEnv] = useState<"sandbox" | "production">("sandbox");
  const [newKeyPlaintext, setNewKeyPlaintext] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("gateway_merchant_api_keys")
      .select("id, merchant_id, api_key_prefix, label, environment, status, created_at, suspended_at, suspended_reason")
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) toast.error(error.message);
    setKeys(((data ?? []) as unknown) as ApiKeyRow[]);
    setLoading(false);

    // Best-effort usage aggregation (last 24h / 7d). The gateway_request_logs
    // table may not exist in every environment — fail silently in that case.
    try {
      const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const sb = supabase as any;
      const [d24, d7] = await Promise.all([
        sb.from("gateway_request_logs").select("api_key_id, status_code").gte("created_at", since24).limit(10000),
        sb.from("gateway_request_logs").select("api_key_id").gte("created_at", since7).limit(10000),
      ]);
      const map: Record<string, UsageRow> = {};
      for (const r of (d24.data as any[]) ?? []) {
        const id = r.api_key_id;
        if (!id) continue;
        map[id] ??= { api_key_id: id, calls_24h: 0, calls_7d: 0, error_rate_pct: 0, last_rate_limited_at: null };
        map[id].calls_24h++;
        if (r.status_code === 429) map[id].last_rate_limited_at = new Date().toISOString();
        if (r.status_code >= 400) map[id].error_rate_pct += 1;
      }
      for (const r of (d7.data as any[]) ?? []) {
        const id = r.api_key_id;
        if (!id) continue;
        map[id] ??= { api_key_id: id, calls_24h: 0, calls_7d: 0, error_rate_pct: 0, last_rate_limited_at: null };
        map[id].calls_7d++;
      }
      for (const id of Object.keys(map)) {
        const u = map[id];
        u.error_rate_pct = u.calls_24h ? Math.round((u.error_rate_pct / u.calls_24h) * 100) : 0;
      }
      setUsage(map);
    } catch {
      /* ignore — table may not exist in this env */
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(
    () => keys.filter((k) => !filter || (k.label ?? "").toLowerCase().includes(filter.toLowerCase()) || (k.api_key_prefix ?? "").includes(filter)),
    [keys, filter],
  );

  async function callFn(fn: string, body: Record<string, unknown>) {
    const { data, error } = await supabase.functions.invoke(fn, { body });
    if (error) throw error;
    return data;
  }

  async function createKey() {
    if (!newMerchantId) return toast.error("merchant_id required");
    setBusy("create");
    try {
      const res = (await callFn("api-keys-create", {
        merchant_id: newMerchantId,
        label: newLabel || undefined,
        environment: newEnv,
      })) as { api_key: string };
      setNewKeyPlaintext(res.api_key);
      await load();
    } catch (e) {
      toast.error(await extractEdgeFunctionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function rotate(id: string) {
    setBusy(id);
    try {
      const res = (await callFn("api-keys-rotate", { api_client_id: id })) as { api_key?: string };
      if (res?.api_key) {
        setNewKeyPlaintext(res.api_key);
        setCreateOpen(true);
      }
      toast.success("Key rotated");
      await load();
    } catch (e) {
      toast.error(await extractEdgeFunctionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function suspend(id: string, action: "suspend" | "resume") {
    setBusy(id);
    try {
      await callFn("api-keys-suspend", { api_key_id: id, action });
      toast.success(action === "suspend" ? "Key suspended" : "Key resumed");
      await load();
    } catch (e) {
      toast.error(await extractEdgeFunctionError(e));
    } finally {
      setBusy(null);
    }
  }

  async function revoke(id: string) {
    if (!confirm("Revoke this key permanently? Integrations using it will start receiving 401.")) return;
    setBusy(id);
    try {
      await callFn("api-keys-revoke", { api_key_id: id });
      toast.success("Key revoked");
      await load();
    } catch (e) {
      toast.error(await extractEdgeFunctionError(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6 p-6">
      <SEO title="Institution API keys — Admin" description="Create, rotate, suspend, and revoke institution API keys; review per-key usage and rate-limit health." />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Institution API keys</h1>
          <p className="text-sm text-muted-foreground">Lifecycle and usage telemetry for institution-scoped API keys.</p>
        </div>
        <Button onClick={() => { setNewKeyPlaintext(null); setCreateOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> New key
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "keys" | "usage")}>
        <TabsList>
          <TabsTrigger value="keys">Keys</TabsTrigger>
          <TabsTrigger value="usage">Usage &amp; rate limits</TabsTrigger>
        </TabsList>

        <TabsContent value="keys">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> All keys</CardTitle>
              <CardDescription>{filtered.length} of {keys.length} keys.</CardDescription>
              <Input placeholder="Filter by label or prefix" value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-sm" />
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Prefix</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Env</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((k) => (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono text-xs">{k.key_prefix ?? "—"}</TableCell>
                        <TableCell>{k.label ?? "—"}</TableCell>
                        <TableCell><Badge variant="outline">{k.environment ?? "sandbox"}</Badge></TableCell>
                        <TableCell>
                          <Badge variant={k.status === "active" ? "default" : k.status === "suspended" ? "secondary" : "destructive"}>
                            {k.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs">
                          {k.created_at ? format(new Date(k.created_at), "yyyy-MM-dd HH:mm") : "—"}
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost" disabled={busy === k.id || k.status === "revoked"} onClick={() => rotate(k.id)}>
                            <RotateCw className="h-4 w-4" />
                          </Button>
                          {k.status === "suspended" ? (
                            <Button size="sm" variant="ghost" disabled={busy === k.id} onClick={() => suspend(k.id, "resume")}>
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" disabled={busy === k.id || k.status === "revoked"} onClick={() => suspend(k.id, "suspend")}>
                              <PauseCircle className="h-4 w-4" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled={busy === k.id || k.status === "revoked"} onClick={() => revoke(k.id)}>
                            <ShieldOff className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usage">
          <Card>
            <CardHeader>
              <CardTitle>Usage &amp; rate limits</CardTitle>
              <CardDescription>Per-key call counts and last 429 hit. Rolling 24-hour and 7-day windows.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Prefix</TableHead>
                    <TableHead>Label</TableHead>
                    <TableHead className="text-right">Calls (24h)</TableHead>
                    <TableHead className="text-right">Calls (7d)</TableHead>
                    <TableHead className="text-right">Error rate</TableHead>
                    <TableHead>Last 429</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((k) => {
                    const u = usage[k.id];
                    return (
                      <TableRow key={k.id}>
                        <TableCell className="font-mono text-xs">{k.key_prefix ?? "—"}</TableCell>
                        <TableCell>{k.label ?? "—"}</TableCell>
                        <TableCell className="text-right">{u?.calls_24h ?? "—"}</TableCell>
                        <TableCell className="text-right">{u?.calls_7d ?? "—"}</TableCell>
                        <TableCell className="text-right">{u ? `${u.error_rate_pct}%` : "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u?.last_rate_limited_at ? format(new Date(u.last_rate_limited_at), "yyyy-MM-dd HH:mm") : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setNewKeyPlaintext(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{newKeyPlaintext ? "New API key (shown once)" : "Create API key"}</DialogTitle>
            <DialogDescription>
              {newKeyPlaintext
                ? "Copy this key now. For security, the plaintext value will never be displayed again."
                : "Mint a new institution-scoped API key. The plaintext value will only be visible once."}
            </DialogDescription>
          </DialogHeader>
          {newKeyPlaintext ? (
            <div className="space-y-3">
              <code className="block break-all rounded border bg-muted p-3 text-xs">{newKeyPlaintext}</code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { navigator.clipboard.writeText(newKeyPlaintext); toast.success("Copied"); }}
              >
                <Copy className="mr-2 h-4 w-4" /> Copy
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Merchant / institution UUID</Label>
                <Input value={newMerchantId} onChange={(e) => setNewMerchantId(e.target.value)} placeholder="00000000-0000-0000-0000-000000000000" />
              </div>
              <div>
                <Label>Label</Label>
                <Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. CI/CD sandbox key" />
              </div>
              <div>
                <Label>Environment</Label>
                <Select value={newEnv} onValueChange={(v) => setNewEnv(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="production">Production</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setCreateOpen(false); setNewKeyPlaintext(null); }}>Close</Button>
            {!newKeyPlaintext && (
              <Button onClick={createKey} disabled={busy === "create"}>
                {busy === "create" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Create
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
