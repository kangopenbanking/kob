import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Key, Eye, EyeOff, Plus, Copy, RotateCw, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MerchantApiKeys() {
  const [keys, setKeys] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ label: "", environment: "sandbox" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_merchant_api_keys").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setKeys(data || []);
    }
    setLoading(false);
  };

  const generateKey = () => {
    const prefix = form.environment === "production" ? "pk_live_" : "pk_test_";
    return prefix + Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, "0")).join("");
  };

  const handleCreate = async () => {
    if (!merchantId) return;
    setSaving(true);
    try {
      const key = generateKey();
      const { error } = await supabase.from("gateway_merchant_api_keys").insert({
        merchant_id: merchantId,
        key_prefix: key.substring(0, 12),
        key_hash: key, // In production this would be hashed
        environment: form.environment,
        label: form.label || `${form.environment} key`,
        is_active: true,
      });
      if (error) throw error;
      toast.success("API key generated! Copy it now — it won't be shown again in full.");
      navigator.clipboard.writeText(key);
      toast.info("Key copied to clipboard");
      setDialogOpen(false);
      setForm({ label: "", environment: "sandbox" });
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const revokeKey = async (id: string) => {
    await supabase.from("gateway_merchant_api_keys").update({ is_active: false }).eq("id", id);
    toast.success("API key revoked");
    loadData();
  };

  const toggleVisibility = (id: string) => {
    setVisibleKeys(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">API Keys</h1><p className="text-muted-foreground">Generate and manage your API credentials</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Generate Key</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate API Key</DialogTitle>
              <DialogDescription>Create a new API key for your integration</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Label</Label><Input placeholder="e.g., My Website" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} /></div>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={form.environment} onValueChange={v => setForm(f => ({ ...f, environment: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                    <SelectItem value="production">Production (Live)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                <p>⚠️ The full key will only be shown once after creation. Make sure to copy it.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Generate</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {keys.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Key className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No API keys yet</p>
          <p className="text-sm text-muted-foreground mt-1">Generate your first API key to start integrating</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {keys.map(k => (
            <Card key={k.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-base">{k.label || "API Key"}</CardTitle>
                    <Badge variant={k.environment === "production" ? "default" : "secondary"}>{k.environment}</Badge>
                  </div>
                  <Badge variant={k.is_active ? "default" : "outline"}>{k.is_active ? "Active" : "Revoked"}</Badge>
                </div>
                <CardDescription>Created {k.created_at ? format(new Date(k.created_at), "MMM d, yyyy") : "—"} · Last used {k.last_used_at ? format(new Date(k.last_used_at), "MMM d, yyyy HH:mm") : "never"}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 font-mono text-sm bg-muted/50 p-3 rounded-md">
                  <span className="flex-1 truncate">{visibleKeys.has(k.id) ? k.key_prefix + "••••••••••" : "••••••••••••••••"}</span>
                  <Button variant="ghost" size="sm" onClick={() => toggleVisibility(k.id)}>
                    {visibleKeys.has(k.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { navigator.clipboard.writeText(k.key_prefix); toast.success("Key prefix copied"); }}><Copy className="h-4 w-4" /></Button>
                  {k.is_active && (
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => revokeKey(k.id)}>Revoke</Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
