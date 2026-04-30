import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Key,
  Copy,
  RotateCw,
  Trash2,
  ShieldCheck,
  AlertTriangle,
  Eye,
  EyeOff,
  Plus,
  History,
} from "lucide-react";
import { AuthRequiredAlert } from "@/components/developer/AuthRequiredAlert";

type Environment = "sandbox" | "production";

interface MerchantApiKey {
  id: string;
  key_prefix: string;
  label: string | null;
  status: "active" | "rotated" | "revoked" | "expired";
  key_version?: number;
  activated_at?: string | null;
  expires_at?: string | null;
  grace_until?: string | null;
  created_at: string;
  environment?: Environment;
  permissions?: string[];
}

interface AuditEntry {
  id: string;
  action_type: string;
  entity_id: string;
  details?: Record<string, unknown> | null;
  performed_by?: string | null;
  created_at: string;
}

const PERMISSIONS: Array<{ id: string; label: string; description: string }> = [
  { id: "charges:read", label: "charges:read", description: "List and retrieve charges." },
  { id: "charges:write", label: "charges:write", description: "Create charges, capture, refund." },
  { id: "payouts:read", label: "payouts:read", description: "List payouts and statements." },
  { id: "payouts:write", label: "payouts:write", description: "Initiate payouts (server-to-server)." },
  { id: "customers:read", label: "customers:read", description: "Read customer profiles." },
  { id: "customers:write", label: "customers:write", description: "Create/update customers." },
  { id: "webhooks:manage", label: "webhooks:manage", description: "Create, rotate, and replay webhook deliveries." },
  { id: "settlements:read", label: "settlements:read", description: "Read settlements and statements." },
];

function shortDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return value;
  }
}

function statusVariant(status: MerchantApiKey["status"]) {
  switch (status) {
    case "active": return "default" as const;
    case "rotated": return "secondary" as const;
    case "revoked": return "destructive" as const;
    case "expired": return "outline" as const;
  }
}

export default function MerchantApiKeysManager() {
  const { toast } = useToast();
  const [authReady, setAuthReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [environment, setEnvironment] = useState<Environment>("sandbox");
  const [keys, setKeys] = useState<MerchantApiKey[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>(["charges:read", "charges:write"]);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [rotating, setRotating] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setIsAuthed(!!data.user);
      setAuthReady(true);
    });
    return () => { mounted = false; };
  }, []);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("api-keys-list", {
        body: { environment },
      });
      if (error) throw error;
      const list: MerchantApiKey[] = (data?.keys ?? data?.data ?? []).map((k: any) => ({
        ...k,
        environment: k.environment ?? environment,
        permissions: k.permissions ?? [],
      }));
      setKeys(list);
    } catch (e: any) {
      toast({ title: "Could not load keys", description: e?.message ?? String(e), variant: "destructive" });
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  const loadAudit = async () => {
    try {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, action_type, entity_id, details, performed_by, created_at")
        .in("action_type", [
          "api_key.created",
          "api_key.rotated",
          "api_key.revoked",
          "api_key.requested",
        ])
        .order("created_at", { ascending: false })
        .limit(25);
      if (error) throw error;
      setAudit((data ?? []) as AuditEntry[]);
    } catch {
      setAudit([]);
    }
  };

  useEffect(() => {
    if (!isAuthed) return;
    loadKeys();
    loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthed, environment]);

  const togglePerm = (id: string) => {
    setSelectedPerms((cur) => (cur.includes(id) ? cur.filter((p) => p !== id) : [...cur, id]));
  };

  const create = async () => {
    if (!newLabel.trim()) {
      toast({ title: "Label required", description: "Give the key a recognisable name.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("sandbox-create-api-key", {
        body: { key_name: newLabel.trim(), environment, permissions: selectedPerms },
      });
      if (error) throw error;
      const secret =
        data?.api_secret ?? data?.secret ?? data?.plaintext_secret ?? data?.client_secret ?? null;
      if (secret) {
        setRevealedSecret(secret);
        setShowSecret(false);
      }
      toast({ title: "API key created", description: "Copy the secret now — it will only be shown once." });
      setCreateOpen(false);
      setNewLabel("");
      await Promise.all([loadKeys(), loadAudit()]);
    } catch (e: any) {
      toast({ title: "Could not create key", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const rotate = async (id: string) => {
    setRotating(id);
    try {
      const { data, error } = await supabase.functions.invoke("api-keys-rotate", {
        body: { api_client_id: id, overlap_hours: 24 },
      });
      if (error) throw error;
      const secret = data?.new_secret ?? data?.secret ?? data?.plaintext_secret ?? null;
      if (secret) {
        setRevealedSecret(secret);
        setShowSecret(false);
      }
      toast({
        title: "Key rotated",
        description: "Old key remains valid for 24h to allow safe rollout.",
      });
      await Promise.all([loadKeys(), loadAudit()]);
    } catch (e: any) {
      toast({ title: "Rotation failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRotating(null);
    }
  };

  const revoke = async (id: string) => {
    if (!confirm("Revoke this key immediately? Active integrations will start receiving 401 responses.")) return;
    setRevoking(id);
    try {
      const { error } = await supabase.functions.invoke("api-keys-revoke", {
        body: { key_id: id },
      });
      if (error) throw error;
      toast({ title: "Key revoked", description: "All requests with this key will now be rejected." });
      await Promise.all([loadKeys(), loadAudit()]);
    } catch (e: any) {
      toast({ title: "Revocation failed", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setRevoking(null);
    }
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Copied", description: "Value copied to clipboard." });
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  };

  const envBadge = useMemo(
    () => (environment === "production" ? "destructive" : "secondary"),
    [environment],
  );

  return (
    <>
      <Helmet>
        <title>Merchant API keys — Kang Open Banking</title>
        <meta
          name="description"
          content="Request, create, rotate, and revoke sandbox and production API keys for the Kang Open Banking payment gateway. Per-key permissions, 24-hour rotation overlap, and full audit logging."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/merchants/api-keys" />
      </Helmet>

      <article className="mx-auto max-w-5xl px-6 py-10 space-y-8">
        <header className="space-y-2">
          <Badge variant="outline">Merchants → API keys</Badge>
          <h1 className="text-3xl font-bold tracking-tight">Merchant API key management</h1>
          <p className="text-muted-foreground max-w-3xl">
            Create restricted API keys for the sandbox and production environments,
            rotate them with a 24-hour overlap window, and revoke compromised keys
            immediately. Every action is recorded in the audit log.
          </p>
        </header>

        {!authReady ? (
          <Skeleton className="h-32 w-full" />
        ) : !isAuthed ? (
          <AuthRequiredAlert
            title="Sign in required"
            description="Please sign in with your merchant account to manage API keys. Public docs and the OpenAPI spec remain accessible without an account."
          />
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Environment</CardTitle>
                  <CardDescription>
                    Sandbox keys can only call test endpoints. Production keys move real money — store them in a secret manager.
                  </CardDescription>
                </div>
                <Badge variant={envBadge}>{environment}</Badge>
              </CardHeader>
              <CardContent>
                <Tabs
                  value={environment}
                  onValueChange={(v) => setEnvironment(v as Environment)}
                  className="w-full"
                >
                  <TabsList>
                    <TabsTrigger value="sandbox">Sandbox</TabsTrigger>
                    <TabsTrigger value="production">Production</TabsTrigger>
                  </TabsList>
                  <TabsContent value="production" className="mt-4">
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Production access</AlertTitle>
                      <AlertDescription>
                        Production keys are issued only to merchants whose KYB review has been approved.
                        Pending merchants see only their sandbox keys here.{" "}
                        <Link to="/developer/merchants" className="underline">Review the merchant onboarding checklist.</Link>
                      </AlertDescription>
                    </Alert>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {revealedSecret ? (
              <Card className="border-amber-500/50 bg-amber-50/40 dark:bg-amber-900/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ShieldCheck className="h-4 w-4" />
                    New secret — shown once
                  </CardTitle>
                  <CardDescription>
                    Copy this value to your secret manager now. We do not store the plaintext and cannot retrieve it later.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Input
                      readOnly
                      type={showSecret ? "text" : "password"}
                      value={revealedSecret}
                      className="font-mono text-sm"
                    />
                    <Button variant="outline" size="icon" onClick={() => setShowSecret((s) => !s)}>
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="icon" onClick={() => copy(revealedSecret)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setRevealedSecret(null)}>
                    I have saved this secret
                  </Button>
                </CardContent>
              </Card>
            ) : null}

            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Active keys</h2>
                <Button onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" /> New key
                </Button>
              </div>

              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : keys.length === 0 ? (
                <Card>
                  <CardContent className="py-10 text-center text-sm text-muted-foreground">
                    No keys yet for the {environment} environment. Create one to get started.
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  {keys.map((k) => (
                    <Card key={k.id}>
                      <CardContent className="flex items-start justify-between gap-4 py-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Key className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{k.label || "Unnamed key"}</span>
                            <Badge variant={statusVariant(k.status)}>{k.status}</Badge>
                          </div>
                          <code className="block font-mono text-xs text-muted-foreground">
                            {k.key_prefix}••••••••
                          </code>
                          <div className="flex flex-wrap gap-1 pt-1">
                            {(k.permissions ?? []).map((p) => (
                              <Badge key={p} variant="outline" className="text-[10px]">{p}</Badge>
                            ))}
                          </div>
                          <p className="text-xs text-muted-foreground pt-1">
                            Created {shortDate(k.created_at)}
                            {k.expires_at ? ` · Expires ${shortDate(k.expires_at)}` : ""}
                            {k.grace_until ? ` · Grace until ${shortDate(k.grace_until)}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => rotate(k.id)}
                            disabled={rotating === k.id || k.status !== "active"}
                          >
                            <RotateCw className="mr-1.5 h-3.5 w-3.5" />
                            {rotating === k.id ? "Rotating…" : "Rotate"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => revoke(k.id)}
                            disabled={revoking === k.id || k.status === "revoked"}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            {revoking === k.id ? "Revoking…" : "Revoke"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-lg font-semibold">Audit trail</h2>
              </div>
              {audit.length === 0 ? (
                <p className="text-sm text-muted-foreground">No key-related audit events yet.</p>
              ) : (
                <Card>
                  <CardContent className="divide-y p-0">
                    {audit.map((e) => (
                      <div key={e.id} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="font-mono text-xs">{e.action_type}</span>
                          <p className="text-xs text-muted-foreground">
                            {shortDate(e.created_at)} · key {e.entity_id?.slice(0, 8)}…
                          </p>
                        </div>
                        {e.details ? (
                          <code className="hidden sm:block max-w-md truncate text-[10px] text-muted-foreground">
                            {JSON.stringify(e.details)}
                          </code>
                        ) : null}
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </section>
          </>
        )}

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create a new {environment} key</DialogTitle>
              <DialogDescription>
                Choose the minimum set of permissions this key needs. You can rotate or revoke it at any time.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="key-label">Label</Label>
                <Input
                  id="key-label"
                  placeholder="e.g. Storefront server (eu-west-1)"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Permissions</Label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {PERMISSIONS.map((perm) => (
                    <label
                      key={perm.id}
                      className="flex items-start gap-2 rounded-md border p-2 text-sm cursor-pointer hover:bg-accent"
                    >
                      <Checkbox
                        checked={selectedPerms.includes(perm.id)}
                        onCheckedChange={() => togglePerm(perm.id)}
                      />
                      <span className="space-y-0.5">
                        <span className="block font-mono text-xs">{perm.label}</span>
                        <span className="block text-xs text-muted-foreground">{perm.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              {environment === "production" ? (
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    The plaintext secret is shown only once. Store it in your secret manager (AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault) before closing this dialog.
                  </AlertDescription>
                </Alert>
              ) : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button onClick={create} disabled={creating}>
                {creating ? "Creating…" : "Create key"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </article>
    </>
  );
}
