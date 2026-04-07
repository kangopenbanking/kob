import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Webhook, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

export default function MerchantWebhooks() {
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ url: "", events: "charge.success" });

  const EVENT_TYPES = [
    "charge.success", "charge.failed", "payout.completed", "payout.failed",
    "refund.completed", "dispute.created", "subscription.activated", "subscription.cancelled",
  ];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_merchant_webhooks").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setWebhooks(data || []);
    }
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!merchantId || !form.url) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("gateway-webhook-endpoints", {
        body: {
          action: "create",
          merchant_id: merchantId,
          url: form.url,
          events: form.events.split(",").map(e => e.trim()),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Webhook endpoint added");
      setDialogOpen(false);
      setForm({ url: "", events: "charge.success" });
      loadData();
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("gateway_merchant_webhooks").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success(`Webhook ${current ? "disabled" : "enabled"}`); loadData(); }
  };

  const deleteWebhook = async (id: string) => {
    const { error } = await supabase.from("gateway_merchant_webhooks").delete().eq("id", id);
    if (error) toast.error(extractEdgeFunctionError(error));
    else { toast.success("Webhook deleted"); loadData(); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Webhooks</h1><p className="text-muted-foreground">Configure webhook endpoints for real-time notifications</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Add Endpoint</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Webhook Endpoint</DialogTitle>
              <DialogDescription>We'll send event notifications to this URL</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Endpoint URL</Label>
                <Input placeholder="https://api.example.com/webhooks/kob" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Events (comma-separated)</Label>
                <Input placeholder="charge.success, payout.completed" value={form.events} onChange={e => setForm(f => ({ ...f, events: e.target.value }))} />
                <div className="flex flex-wrap gap-1 mt-2">
                  {EVENT_TYPES.map(e => (
                    <Badge key={e} variant="outline" className="cursor-pointer text-xs hover:bg-muted"
                      onClick={() => setForm(f => ({ ...f, events: f.events ? `${f.events}, ${e}` : e }))}>
                      {e}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.url}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Add Endpoint</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {webhooks.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Webhook className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No webhooks configured yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add an endpoint to receive real-time payment event notifications</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {webhooks.map(w => (
            <Card key={w.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 min-w-0">
                    <Webhook className="h-4 w-4 text-muted-foreground shrink-0" />
                    <CardTitle className="text-base truncate">{w.url}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={w.is_active ? "default" : "secondary"}>{w.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                </div>
                <CardDescription>Events: {Array.isArray(w.events) ? w.events.join(", ") : "All"}</CardDescription>
              </CardHeader>
              <CardContent className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Created {w.created_at ? format(new Date(w.created_at), "MMM d, yyyy") : "—"}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => toggleActive(w.id, w.is_active)}>{w.is_active ? "Disable" : "Enable"}</Button>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteWebhook(w.id)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
