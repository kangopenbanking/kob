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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Webhook, Plus, RefreshCw, CheckCircle2, XCircle, Trash2, Send, Clock } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const AVAILABLE_EVENTS = [
  "payment.completed", "payment.failed", "payment.pending",
  "consent.created", "consent.revoked", "consent.expired",
  "transaction.created", "settlement.completed", "settlement.failed",
];

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

export default function InstitutionWebhooks() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const [institutionId, setInstitutionId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const instId = await resolveInstitutionId(user.id);
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const { data: clients } = await supabase.from("api_clients").select("client_id").eq("institution_id", instId);
      const clientIds = (clients || []).map(c => c.client_id);
      if (clientIds.length > 0) {
        const { data: webhookData } = await supabase.from("webhooks").select("*").in("client_id", clientIds).order("created_at", { ascending: false });
        setWebhooks(webhookData || []);
        const webhookIds = (webhookData || []).map(w => w.id);
        if (webhookIds.length > 0) {
          const { data: deliveryData } = await supabase.from("webhook_deliveries").select("*").in("webhook_id", webhookIds).order("created_at", { ascending: false }).limit(50);
          setDeliveries(deliveryData || []);
        }
      }
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  const createWebhook = async () => {
    if (!newUrl || newEvents.length === 0 || !institutionId) return;
    setCreating(true);
    try {
      const { data: clients } = await supabase.from("api_clients").select("client_id").eq("institution_id", institutionId).limit(1);
      if (!clients?.length) { toast({ title: "No API Client", description: "Create an API client first.", variant: "destructive" }); return; }
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;
      const { error } = await supabase.from("webhooks").insert({
        client_id: clients[0].client_id, institution_id: institutionId, webhook_url: newUrl, url: newUrl, events: newEvents, secret, is_active: true,
      });
      if (error) throw error;
      toast({ title: "Webhook Created" });
      setCreateOpen(false); setNewUrl(""); setNewEvents([]); loadData();
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setCreating(false); }
  };

  const toggleEvent = (event: string) => { setNewEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]); };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from("webhooks").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Webhook deleted" }); loadData();
  };

  const delivered = deliveries.filter(d => d.status === 'delivered').length;
  const failed = deliveries.filter(d => d.status === 'failed').length;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-teal/10 border border-fi-teal/20"><Webhook className="h-5 w-5 text-fi-teal" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Webhooks</h1>
            <p className="text-sm text-muted-foreground">Real-time event notifications via HTTP callbacks</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button size="sm"><Plus className="h-3.5 w-3.5 mr-1.5" />Add Webhook</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Register Webhook Endpoint</DialogTitle><DialogDescription>We'll send HTTP POST requests when events occur.</DialogDescription></DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2"><Label className="text-xs font-semibold">Endpoint URL</Label><Input placeholder="https://yourapp.com/webhooks" value={newUrl} onChange={e => setNewUrl(e.target.value)} className="h-10" /></div>
                <div className="space-y-2">
                  <Label className="text-xs font-semibold">Events to subscribe</Label>
                  <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                    {AVAILABLE_EVENTS.map(event => (
                      <label key={event} className="flex items-center gap-2 rounded-md border border-border/60 px-3 py-2 text-xs cursor-pointer hover:bg-muted/50 transition-colors">
                        <Checkbox checked={newEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} />
                        <span className="font-mono">{event}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button className="w-full" onClick={createWebhook} disabled={!newUrl || newEvents.length === 0 || creating}>{creating ? "Creating..." : "Create Webhook"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Endpoints", value: webhooks.length, icon: Webhook, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
          { label: "Delivered", value: delivered, icon: CheckCircle2, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Failed", value: failed, icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/20" },
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
        {loading ? [1,2].map(i => <Skeleton key={i} className="h-24 w-full rounded-xl" />) : webhooks.length === 0 ? (
          <Card className="border-border/60"><CardContent className="py-16 text-center"><Webhook className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-30" /><p className="text-sm font-medium mb-1">No Webhooks Configured</p><p className="text-xs text-muted-foreground mb-4">Add an endpoint to receive event notifications</p><Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1.5" />Add Webhook</Button></CardContent></Card>
        ) : webhooks.map(webhook => (
          <Card key={webhook.id} className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-teal/10 border border-fi-teal/20"><Webhook className="h-3.5 w-3.5 text-fi-teal" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold font-mono">{webhook.url}</CardTitle>
                    <CardDescription className="text-xs">Created {format(new Date(webhook.created_at), "PP")}</CardDescription>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={webhook.is_active ? "default" : "secondary"} className="text-[10px]">{webhook.is_active ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteWebhook(webhook.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent><div className="flex flex-wrap gap-1.5">{(Array.isArray(webhook.events) ? webhook.events : []).map((event: string) => <Badge key={event} variant="outline" className="font-mono text-[10px]">{event}</Badge>)}</div></CardContent>
          </Card>
        ))}
      </motion.div>

      {deliveries.length > 0 && (
        <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-indigo/10 border border-fi-indigo/20"><Send className="h-3.5 w-3.5 text-fi-indigo" /></div>
                <div><CardTitle className="text-sm font-semibold">Recent Deliveries</CardTitle><CardDescription className="text-xs">Last 50 webhook delivery attempts</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="hover:bg-transparent bg-muted/40">
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Event</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Date</TableHead>
                  <TableHead className="text-[11px] font-semibold uppercase tracking-wider">Status</TableHead>
                </TableRow></TableHeader>
                <TableBody>{deliveries.slice(0, 20).map(delivery => (
                  <TableRow key={delivery.id}>
                    <TableCell className="font-mono text-xs">{delivery.event_type}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(delivery.created_at), "PPp")}</TableCell>
                    <TableCell><Badge variant={delivery.status === 'delivered' ? 'default' : delivery.status === 'failed' ? 'destructive' : 'secondary'} className="text-[10px]">{delivery.status}</Badge></TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
