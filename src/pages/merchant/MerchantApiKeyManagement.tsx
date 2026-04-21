import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Key, Plus, Copy, RefreshCw, Shield, Clock, AlertTriangle, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MerchantApiKeyManagement() {
  const queryClient = useQueryClient();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyEnv, setNewKeyEnv] = useState("sandbox");
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [createdCredentials, setCreatedCredentials] = useState<any | null>(null);

  const { data: merchant } = useQuery({
    queryKey: ["merchant-for-api-keys"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name, api_keys_count")
        .eq("user_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: apiKeys = [], isLoading } = useQuery({
    queryKey: ["merchant-api-keys", merchant?.id],
    enabled: !!merchant?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gateway_merchant_keys")
        .select("*")
        .eq("merchant_id", merchant.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant");
      const { data, error } = await supabase.functions.invoke("gateway-merchant-keys", {
        body: { action: "create", merchant_id: merchant.id, label: newKeyName, environment: newKeyEnv },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["merchant-api-keys"] });
      setShowCreateDialog(false);
      setNewKeyName("");
      // Show the full credentials dialog (secret key shown only once)
      setCreatedCredentials({
        ...data,
        merchant_id: merchant?.id,
        environment: newKeyEnv,
      });
      toast.success("API key created — copy your secret key now");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to create API key"),
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const { error } = await (supabase as any)
        .from("gateway_merchant_keys")
        .update({ is_active: false, revoked_at: new Date().toISOString() })
        .eq("id", keyId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-api-keys"] });
      toast.success("API key revoked");
    },
  });

  const toggleKeyVisibility = (keyId: string) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      next.has(keyId) ? next.delete(keyId) : next.add(keyId);
      return next;
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  const maskKey = (key: string) => key.slice(0, 8) + "..." + key.slice(-4);

  const liveKeys = apiKeys.filter((k: any) => k.environment === "live" && k.is_active);
  const sandboxKeys = apiKeys.filter((k: any) => k.environment === "sandbox" && k.is_active);
  const revokedKeys = apiKeys.filter((k: any) => !k.is_active);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">API Key Management</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your integration keys for live and sandbox environments
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Key</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Key</DialogTitle>
              <DialogDescription>Generate a new API key for your integration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Key Label</Label>
                <Input
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g., Mobile App, Website Checkout"
                />
              </div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={newKeyEnv} onValueChange={setNewKeyEnv}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                    <SelectItem value="live">Live</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={() => createKeyMutation.mutate()}
                disabled={!newKeyName || createKeyMutation.isPending}
              >
                {createKeyMutation.isPending ? "Creating..." : "Generate Key"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{liveKeys.length}</p>
                <p className="text-xs text-muted-foreground">Live Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Key className="h-5 w-5 text-accent-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{sandboxKeys.length}</p>
                <p className="text-xs text-muted-foreground">Sandbox Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{revokedKeys.length}</p>
                <p className="text-xs text-muted-foreground">Revoked Keys</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Keys Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Active Keys</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : apiKeys.filter((k: any) => k.is_active).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Key className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">No API keys yet</p>
              <p className="text-sm">Create your first key to start integrating</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Public Key</TableHead>
                  <TableHead>Environment</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Last Used</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apiKeys.filter((k: any) => k.is_active).map((key: any) => (
                  <TableRow key={key.id}>
                    <TableCell className="font-medium">{key.label || "Unnamed"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                          {visibleKeys.has(key.id) ? key.public_key : maskKey(key.public_key || "pk_...")}
                        </code>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => toggleKeyVisibility(key.id)}
                        >
                          {visibleKeys.has(key.id) ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          onClick={() => copyToClipboard(key.public_key || "")}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={key.environment === "live" ? "default" : "secondary"} className="text-xs">
                        {key.environment}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.created_at ? format(new Date(key.created_at), "MMM d, yyyy") : "-"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {key.last_used_at ? format(new Date(key.last_used_at), "MMM d, HH:mm") : "Never"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => revokeKeyMutation.mutate(key.id)}
                        disabled={revokeKeyMutation.isPending}
                      >
                        Revoke
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Security Tips */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Security Best Practices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { icon: Shield, title: "Never expose secret keys", desc: "Keep secret keys server-side only. Use public keys for client-side." },
              { icon: RefreshCw, title: "Rotate keys regularly", desc: "Rotate production keys every 90 days for maximum security." },
              { icon: Clock, title: "Monitor key usage", desc: "Review last-used timestamps to detect unused or compromised keys." },
              { icon: AlertTriangle, title: "Revoke compromised keys", desc: "Immediately revoke any key suspected of being compromised." },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex gap-3 p-3 rounded-lg border border-border">
                <Icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Credentials Display Dialog (shown once after creation) */}
      <Dialog open={!!createdCredentials} onOpenChange={(open) => !open && setCreatedCredentials(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              API Credentials Generated
            </DialogTitle>
            <DialogDescription>
              Save these credentials securely. The <strong>secret key</strong> will not be shown again.
            </DialogDescription>
          </DialogHeader>

          {createdCredentials && (
            <div className="space-y-4 pt-2">
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">
                  Copy the secret key now and store it in a secure vault. For security, we never display it again.
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Merchant ID</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {createdCredentials.merchant_id}
                  </code>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => copyToClipboard(createdCredentials.merchant_id)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Public Key (publishable, safe for client)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {createdCredentials.public_key}
                  </code>
                  <Button variant="outline" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => copyToClipboard(createdCredentials.public_key)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Secret Key (server-side only — shown once)</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-foreground/5 border border-primary/30 px-3 py-2 rounded font-mono break-all">
                    {createdCredentials.secret_key}
                  </code>
                  <Button variant="default" size="icon" className="h-9 w-9 shrink-0"
                    onClick={() => copyToClipboard(createdCredentials.secret_key)}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-2">
                Environment: <Badge variant="secondary" className="text-xs">{createdCredentials.environment}</Badge>
              </div>

              <Button className="w-full" onClick={() => setCreatedCredentials(null)}>
                I've Saved My Credentials
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
