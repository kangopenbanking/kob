import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Key, Plus, Copy, RefreshCw, Shield, Clock, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

interface ApiClient {
  id: string; client_id: string; client_name: string; scopes: string[]; grant_types: string[];
  redirect_uris: string[]; is_active: boolean; created_at: string; expires_at: string | null; last_rotated_at: string | null;
}

export default function InstitutionApiClients() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [clients, setClients] = useState<ApiClient[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [secretDialogOpen, setSecretDialogOpen] = useState(false);
  const [newClientName, setNewClientName] = useState("");
  const [newRedirectUri, setNewRedirectUri] = useState("");
  const [creating, setCreating] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newClientSecret, setNewClientSecret] = useState("");

  useEffect(() => { loadClients(); }, []);

  const loadClients = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const instId = await resolveInstitutionId(user.id);
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);
      const { data, error } = await supabase.from("api_clients").select("*").eq("institution_id", instId).order("created_at", { ascending: false });
      if (error) throw error;
      setClients((data || []).map((c: any) => ({
        id: c.id, client_id: c.client_id, client_name: c.client_name,
        scopes: Array.isArray(c.scopes) ? c.scopes.map(String) : [],
        grant_types: Array.isArray(c.grant_types) ? c.grant_types.map(String) : [],
        redirect_uris: Array.isArray(c.redirect_uris) ? c.redirect_uris.map(String) : [],
        is_active: c.is_active ?? true, created_at: c.created_at || '',
        expires_at: c.expires_at, last_rotated_at: c.last_rotated_at,
      })));
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const createClient = async () => {
    if (!newClientName || !institutionId) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data, error } = await supabase.functions.invoke('institution-create-client', {
        body: { client_name: newClientName, institution_id: institutionId, redirect_uris: newRedirectUri ? [newRedirectUri] : [], scopes: ['accounts', 'transactions', 'payments'], grant_types: ['authorization_code', 'client_credentials'] },
      });
      if (error) throw error;
      setNewClientId(data.client_id); setNewClientSecret(data.client_secret);
      setCreateDialogOpen(false); setSecretDialogOpen(true);
      setNewClientName(""); setNewRedirectUri("");
      toast({ title: "API Client Created" });
      loadClients();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const copyToClipboard = (text: string, label: string) => { navigator.clipboard.writeText(text); toast({ title: "Copied!", description: `${label} copied to clipboard` }); };

  const toggleClientStatus = async (clientId: string, currentStatus: boolean) => {
    const { error } = await supabase.from("api_clients").update({ is_active: !currentStatus }).eq("id", clientId);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: currentStatus ? "Client Deactivated" : "Client Activated" }); loadClients();
  };

  const activeCount = clients.filter(c => c.is_active).length;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-amber/10 border border-fi-amber/20"><Key className="h-5 w-5 text-fi-amber" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Clients</h1>
            <p className="text-sm text-muted-foreground">Manage OAuth2 API clients and credentials</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadClients} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Create Client</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create New API Client</DialogTitle><DialogDescription>Create a new OAuth2 client for API access</DialogDescription></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label className="text-xs font-semibold">Client Name</Label><Input placeholder="My Application" value={newClientName} onChange={e => setNewClientName(e.target.value)} className="h-10" /></div>
                <div className="space-y-2"><Label className="text-xs font-semibold">Redirect URI (Optional)</Label><Input placeholder="https://myapp.com/callback" value={newRedirectUri} onChange={e => setNewRedirectUri(e.target.value)} className="h-10" /></div>
                <Button className="w-full" onClick={createClient} disabled={!newClientName || creating}>{creating ? "Creating..." : "Create Client"}</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={secretDialogOpen} onOpenChange={setSecretDialogOpen}>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle>API Client Created</DialogTitle><DialogDescription>Save these credentials securely. The secret will not be shown again.</DialogDescription></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                  <p className="text-xs text-destructive">Store your client secret in a secure location. You will not be able to view it again.</p>
                </div>
                {[{ label: "Client ID", value: newClientId }, { label: "Client Secret", value: newClientSecret }].map(item => (
                  <div key={item.label} className="space-y-1.5">
                    <Label className="text-xs font-semibold">{item.label}</Label>
                    <div className="flex gap-2"><Input value={item.value} readOnly className="font-mono text-xs h-10" /><Button variant="outline" size="sm" onClick={() => copyToClipboard(item.value, item.label)}><Copy className="h-3.5 w-3.5" /></Button></div>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Exchange for an access token (client_credentials)</Label>
                  <pre className="text-[11px] font-mono bg-muted rounded-md p-3 overflow-x-auto whitespace-pre-wrap">{`curl -X POST https://api.kangopenbanking.com/v1/oauth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=${newClientId}" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=accounts transactions payments"`}</pre>
                  <p className="text-[11px] text-muted-foreground">RFC 6749 §4.4 — Client Credentials Grant. Tokens expire after 3600s.</p>
                </div>
                <Button className="w-full" onClick={() => { setSecretDialogOpen(false); setNewClientId(""); setNewClientSecret(""); }}>I've saved my credentials</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Total Clients", value: clients.length, icon: Key, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
          { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Inactive", value: clients.length - activeCount, icon: XCircle, color: "text-muted-foreground bg-muted border-border" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="space-y-3">
        {loading ? [1,2].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />) : clients.length === 0 ? (
          <Card className="border-border/60"><CardContent className="py-16 text-center"><Key className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" /><p className="text-sm font-medium mb-1">No API Clients</p><p className="text-xs text-muted-foreground mb-4">Create your first API client to start integrating</p><Button size="sm" onClick={() => setCreateDialogOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Create Client</Button></CardContent></Card>
        ) : clients.map(client => (
          <Card key={client.id} className={`border-border/60 ${!client.is_active ? 'opacity-60' : ''}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-amber/10 border border-fi-amber/20"><Key className="h-3.5 w-3.5 text-fi-amber" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">{client.client_name}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1"><Clock className="h-3 w-3" />Created {format(new Date(client.created_at), "PP")}</CardDescription>
                  </div>
                </div>
                <Badge variant={client.is_active ? "default" : "secondary"} className="text-[10px]">
                  {client.is_active ? <><CheckCircle2 className="h-3 w-3 mr-1" />Active</> : <><XCircle className="h-3 w-3 mr-1" />Inactive</>}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Client ID</p>
                  <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(client.client_id, "Client ID")}><Copy className="h-3 w-3" /></Button>
                </div>
                <code className="text-xs font-mono">{client.client_id}</code>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {client.scopes.map(scope => <Badge key={scope} variant="outline" className="text-[10px]"><Shield className="h-2.5 w-2.5 mr-1" />{scope}</Badge>)}
              </div>
              <div className="flex gap-2 pt-2 border-t border-border/40">
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => toggleClientStatus(client.id, client.is_active)}>
                  {client.is_active ? <><XCircle className="h-3 w-3 mr-1.5" />Deactivate</> : <><CheckCircle2 className="h-3 w-3 mr-1.5" />Activate</>}
                </Button>
                <Button variant="outline" size="sm" className="text-xs h-8"><RefreshCw className="h-3 w-3 mr-1.5" />Rotate Secret</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive"><AlertTriangle className="h-4 w-4" />Security Best Practices</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-destructive/80 space-y-1.5">
            <p>• Never expose client secrets in client-side code or public repositories</p>
            <p>• Rotate secrets regularly (every 90 days recommended)</p>
            <p>• Use separate clients for development and production</p>
            <p>• Monitor API usage for unusual patterns</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
