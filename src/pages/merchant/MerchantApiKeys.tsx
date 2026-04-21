import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Key, Eye, EyeOff, Plus, Copy, RotateCw, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

async function invokeKeysFunction(body: Record<string, unknown>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase.functions.invoke("gateway-merchant-keys", {
    body,
  });

  if (error) throw new Error(error.message || "Edge function error");
  // The edge function returns error details in the body for non-2xx
  if (data?.status && data.status >= 400) throw new Error(data.detail || data.title || "Request failed");
  return data;
}

export default function MerchantApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", environment: "sandbox" });
  const [createdKey, setCreatedKey] = useState<{ public_key: string; secret_key: string; merchant_id: string } | null>(null);

  // Revoke confirmation
  const [revokeTarget, setRevokeTarget] = useState<{ id: string; label: string } | null>(null);
  const [revoking, setRevoking] = useState(false);

  // Rotate confirmation
  const [rotateTarget, setRotateTarget] = useState<{ id: string; label: string; environment: string } | null>(null);
  const [rotating, setRotating] = useState(false);
  const [rotatedKey, setRotatedKey] = useState<{ public_key: string; secret_key: string; merchant_id: string } | null>(null);

  useEffect(() => { loadMerchant(); }, []);

  const loadMerchant = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      await loadKeys(m.id);
    }
    setLoading(false);
  };

  const loadKeys = async (mId: string) => {
    try {
      const result = await invokeKeysFunction({ action: "list", merchant_id: mId });
      setKeys(result?.data || []);
    } catch (err: any) {
      console.error("Failed to load keys:", err);
      toast.error("Failed to load API keys");
    }
  };

  const handleCreate = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const result = await invokeKeysFunction({
        action: "create",
        merchant_id: merchantId,
        environment: form.environment,
        label: form.label || `${form.environment} key`,
      });
      setCreatedKey({ public_key: result.public_key, secret_key: result.secret_key, merchant_id: result.merchant_id || merchantId });
      await loadKeys(merchantId);
      toast.success("API key generated successfully");
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setCreatedKey(null);
    setForm({ label: "", environment: "sandbox" });
  };

  const confirmRevoke = async () => {
    if (!revokeTarget || !merchantId) return;
    setRevoking(true);
    try {
      await invokeKeysFunction({
        action: "revoke",
        key_id: revokeTarget.id,
        merchant_id: merchantId,
      });
      toast.success("API key revoked");
      await loadKeys(merchantId);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setRevoking(false);
      setRevokeTarget(null);
    }
  };

  const confirmRotate = async () => {
    if (!rotateTarget || !merchantId) return;
    setRotating(true);
    try {
      const result = await invokeKeysFunction({
        action: "rotate",
        key_id: rotateTarget.id,
        merchant_id: merchantId,
        environment: rotateTarget.environment,
        label: `${rotateTarget.label} (rotated)`,
      });
      setRotatedKey({ public_key: result.public_key, secret_key: result.secret_key, merchant_id: result.merchant_id || merchantId });
      await loadKeys(merchantId);
      toast.success("API key rotated successfully");
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err));
    } finally {
      setRotating(false);
      setRotateTarget(null);
    }
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-muted-foreground">Generate and manage your API credentials</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) handleCloseDialog(); else setDialogOpen(true); }}>
          <DialogTrigger asChild>
            <Button className="gap-2"><Plus className="h-4 w-4" /> Generate Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{createdKey ? "API Key Created" : "Generate API Key"}</DialogTitle>
              <DialogDescription>{createdKey ? "Copy your keys now — they won't be shown again." : "Create a new API key for your integration"}</DialogDescription>
            </DialogHeader>
            {createdKey ? (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Merchant ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{createdKey.merchant_id}</code>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdKey.merchant_id); toast.success("Merchant ID copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Public Key</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{createdKey.public_key}</code>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdKey.public_key); toast.success("Public key copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Secret Key</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{createdKey.secret_key}</code>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(createdKey.secret_key); toast.success("Secret key copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                  <p>⚠️ This is the only time the secret key will be displayed. Store it securely.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Label</Label>
                  <Input placeholder="e.g., My Website" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Select value={form.environment} onValueChange={v => setForm(f => ({ ...f, environment: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                      <SelectItem value="live">Production (Live)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  <p>⚠️ The secret key will only be shown once after creation. Make sure to copy it.</p>
                </div>
              </div>
            )}
            <DialogFooter>
              {createdKey ? (
                <Button onClick={handleCloseDialog}>Done</Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCloseDialog}>Cancel</Button>
                  <Button onClick={handleCreate} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Generate
                  </Button>
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No API keys yet</p>
            <p className="text-sm text-muted-foreground mt-1">Generate your first API key to start integrating</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {keys.map(k => (
            <Card key={k.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{k.label || "API Key"}</CardTitle>
                    <Badge variant={k.environment === "live" ? "default" : "secondary"}>{k.environment === "live" ? "production" : k.environment}</Badge>
                  </div>
                  <Badge variant={k.is_active ? "default" : "outline"}>{k.is_active ? "Active" : "Revoked"}</Badge>
                </div>
                <CardDescription>
                  Created {k.created_at ? format(new Date(k.created_at), "MMM d, yyyy") : "—"}
                  {k.revoked_at ? ` · Revoked ${format(new Date(k.revoked_at), "MMM d, yyyy")}` : ""}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 font-mono text-sm bg-muted/50 p-3 rounded-md">
                  <span className="flex-1 truncate">
                    {visibleKeys.has(k.id) ? (k.public_key || k.api_key_prefix || "pk_••••") + "••••••••" : "••••••••••••••••••••"}
                  </span>
                  <Button variant="ghost" size="sm" onClick={() => toggleVisibility(k.id)}>
                    {visibleKeys.has(k.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => {
                    navigator.clipboard.writeText(k.public_key || k.api_key_prefix || "");
                    toast.success("Public key prefix copied");
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  {k.is_active && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={() => setRotateTarget({ id: k.id, label: k.label || "API Key", environment: k.environment })}
                      >
                        <RotateCw className="h-4 w-4 mr-1" /> Rotate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setRevokeTarget({ id: k.id, label: k.label || "API Key" })}
                      >
                        Revoke
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={v => { if (!v) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" /> Revoke API Key
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to revoke <strong>{revokeTarget?.label}</strong>? This action cannot be undone. Any integrations using this key will stop working immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRevoke} disabled={revoking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {revoking && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Revoke Key
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rotate confirmation / result */}
      <Dialog open={!!rotateTarget || !!rotatedKey} onOpenChange={v => { if (!v) { setRotateTarget(null); setRotatedKey(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{rotatedKey ? "New Key Generated" : "Rotate API Key"}</DialogTitle>
            <DialogDescription>
              {rotatedKey
                ? "Your old key has been revoked. Copy the new keys below."
                : `This will revoke "${rotateTarget?.label}" and generate a new key in its place.`}
            </DialogDescription>
          </DialogHeader>
          {rotatedKey ? (
            <div className="space-y-4">
                <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Merchant ID</Label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{rotatedKey.merchant_id}</code>
                      <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(rotatedKey.merchant_id); toast.success("Merchant ID copied"); }}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">New Public Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{rotatedKey.public_key}</code>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(rotatedKey.public_key); toast.success("Public key copied"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">New Secret Key</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm font-mono break-all select-all bg-background p-2 rounded border">{rotatedKey.secret_key}</code>
                    <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(rotatedKey.secret_key); toast.success("Secret key copied"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                <p>⚠️ Store these keys securely. The secret key will not be shown again.</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
              <p>⚠️ The old key will be immediately revoked. Integrations must be updated to the new key.</p>
            </div>
          )}
          <DialogFooter>
            {rotatedKey ? (
              <Button onClick={() => { setRotatedKey(null); setRotateTarget(null); }}>Done</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRotateTarget(null)} disabled={rotating}>Cancel</Button>
                <Button onClick={confirmRotate} disabled={rotating} variant="destructive">
                  {rotating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Rotate Key
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
