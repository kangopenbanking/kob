import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Webhook, Plus, RefreshCw, CheckCircle2, XCircle, Copy, Trash2, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const AVAILABLE_EVENTS = [
  "payment.completed", "payment.failed", "payment.pending",
  "consent.created", "consent.revoked", "consent.expired",
  "transaction.created", "settlement.completed", "settlement.failed",
];

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

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      // Get client_id for this institution
      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      const { data: clients } = await supabase
        .from("api_clients").select("client_id").eq("institution_id", institution.id);

      const clientIds = (clients || []).map(c => c.client_id);

      if (clientIds.length > 0) {
        const { data: webhookData } = await supabase
          .from("webhooks").select("*").in("client_id", clientIds).order("created_at", { ascending: false });
        setWebhooks(webhookData || []);

        const webhookIds = (webhookData || []).map(w => w.id);
        if (webhookIds.length > 0) {
          const { data: deliveryData } = await supabase
            .from("webhook_deliveries").select("*").in("webhook_id", webhookIds)
            .order("created_at", { ascending: false }).limit(50);
          setDeliveries(deliveryData || []);
        }
      }
    } catch (error: any) {
      toast({ title: "Error loading webhooks", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const createWebhook = async () => {
    if (!newUrl || newEvents.length === 0) return;
    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: institution } = await supabase
        .from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) return;

      const { data: clients } = await supabase
        .from("api_clients").select("client_id").eq("institution_id", institution.id).limit(1);

      if (!clients || clients.length === 0) {
        toast({ title: "No API Client", description: "Create an API client first before adding webhooks.", variant: "destructive" });
        return;
      }

      // Generate a webhook secret
      const secret = `whsec_${crypto.randomUUID().replace(/-/g, '')}`;

      const { error } = await supabase.from("webhooks").insert({
        client_id: clients[0].client_id,
        institution_id: institution.id,
        webhook_url: newUrl,
        url: newUrl,
        events: newEvents,
        secret,
        is_active: true,
      });

      if (error) throw error;

      toast({ title: "Webhook Created", description: "Your webhook endpoint has been registered." });
      setCreateOpen(false);
      setNewUrl("");
      setNewEvents([]);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const toggleEvent = (event: string) => {
    setNewEvents(prev => prev.includes(event) ? prev.filter(e => e !== event) : [...prev, event]);
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from("webhooks").delete().eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Webhook deleted" });
    loadData();
  };

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Webhooks</h1>
            <p className="text-muted-foreground">Receive real-time event notifications via HTTP callbacks</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="h-4 w-4 mr-2" />Add Webhook</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Register Webhook Endpoint</DialogTitle>
                  <DialogDescription>We'll send HTTP POST requests to your URL when events occur.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Endpoint URL</Label>
                    <Input placeholder="https://yourapp.com/webhooks/kob" value={newUrl} onChange={e => setNewUrl(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Events to subscribe</Label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto">
                      {AVAILABLE_EVENTS.map(event => (
                        <div key={event} className="flex items-center gap-2">
                          <Checkbox checked={newEvents.includes(event)} onCheckedChange={() => toggleEvent(event)} id={event} />
                          <label htmlFor={event} className="text-sm font-mono cursor-pointer">{event}</label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
                  <Button onClick={createWebhook} disabled={!newUrl || newEvents.length === 0 || creating}>
                    {creating ? "Creating..." : "Create Webhook"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Webhook Endpoints */}
        <div className="space-y-4">
          {loading ? (
            [1,2].map(i => <Card key={i}><CardContent className="py-6"><Skeleton className="h-20 w-full" /></CardContent></Card>)
          ) : webhooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-semibold mb-2">No Webhooks Configured</h3>
                <p className="text-muted-foreground mb-4">Add a webhook endpoint to receive event notifications</p>
                <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-2" />Add Webhook</Button>
              </CardContent>
            </Card>
          ) : (
            webhooks.map(webhook => (
              <Card key={webhook.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Webhook className="h-4 w-4" />
                        {webhook.url}
                      </CardTitle>
                      <CardDescription>Created {format(new Date(webhook.created_at), "PPP")}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {webhook.is_active ? (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"><CheckCircle2 className="h-3 w-3 mr-1" />Active</Badge>
                      ) : (
                        <Badge variant="secondary"><XCircle className="h-3 w-3 mr-1" />Inactive</Badge>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => deleteWebhook(webhook.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(Array.isArray(webhook.events) ? webhook.events : []).map((event: string) => (
                      <Badge key={event} variant="outline" className="font-mono text-xs">{event}</Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Recent Deliveries */}
        {deliveries.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Deliveries</CardTitle>
              <CardDescription>Last 50 webhook delivery attempts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deliveries.slice(0, 20).map(delivery => (
                  <div key={delivery.id} className="flex items-center justify-between p-3 border rounded-lg text-sm">
                    <div>
                      <span className="font-mono">{delivery.event_type}</span>
                      <span className="text-muted-foreground ml-2">{format(new Date(delivery.created_at), "PPp")}</span>
                    </div>
                    <Badge variant={delivery.status === 'delivered' ? 'default' : delivery.status === 'failed' ? 'destructive' : 'secondary'}>
                      {delivery.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </InstitutionLayout>
  );
}
