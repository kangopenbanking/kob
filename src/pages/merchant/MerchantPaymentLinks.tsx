import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Link2, Copy, Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MerchantPaymentLinks() {
  const [links, setLinks] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", amount: "", currency: "XAF", redirect_url: "" });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data: m } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
    if (m) {
      setMerchantId(m.id);
      const { data } = await supabase.from("gateway_payment_links").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false });
      setLinks(data || []);
    }
    setLoading(false);
  };

  const generateSlug = (title: string) => title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") + "-" + Math.random().toString(36).substring(2, 8);

  const handleCreate = async () => {
    if (!merchantId || !form.title) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_payment_links").insert({
        merchant_id: merchantId,
        title: form.title,
        description: form.description || null,
        amount: form.amount ? Number(form.amount) : null,
        currency: form.currency,
        slug: generateSlug(form.title),
        status: "active",
        redirect_url: form.redirect_url || null,
      });
      if (error) throw error;
      toast.success("Payment link created");
      setDialogOpen(false);
      setForm({ title: "", description: "", amount: "", currency: "XAF", redirect_url: "" });
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/pay/${slug}`);
    toast.success("Payment link copied!");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("gateway_payment_links").update({ status: current ? "inactive" : "active" }).eq("id", id);
    toast.success(`Link ${current ? "deactivated" : "activated"}`);
    loadData();
  };

  const deleteLink = async (id: string) => {
    await supabase.from("gateway_payment_links").delete().eq("id", id);
    toast.success("Payment link deleted");
    loadData();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Payment Links</h1><p className="text-muted-foreground">Create and share no-code payment pages</p></div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild><Button className="gap-2"><Plus className="h-4 w-4" /> Create Link</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Payment Link</DialogTitle>
              <DialogDescription>Generate a shareable link to collect payments</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Title *</Label><Input placeholder="Product name or payment description" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
              <div className="space-y-2"><Label>Description</Label><Input placeholder="Optional details" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="grid gap-4 grid-cols-2">
                <div className="space-y-2"><Label>Amount (leave empty for flexible)</Label><Input type="number" placeholder="5000" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} /></div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="XAF">XAF</SelectItem><SelectItem value="XOF">XOF</SelectItem><SelectItem value="NGN">NGN</SelectItem><SelectItem value="USD">USD</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2"><Label>Redirect URL (after payment)</Label><Input placeholder="https://yoursite.com/thank-you" value={form.redirect_url} onChange={e => setForm(f => ({ ...f, redirect_url: e.target.value }))} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate} disabled={saving || !form.title}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Create Link</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {links.length === 0 ? (
        <Card><CardContent className="py-12 text-center">
          <Link2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">No payment links yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first payment link to start accepting payments without code</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4">
          {links.map(l => (
            <Card key={l.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium truncate">{l.title}</p>
                      <Badge variant={l.status === "active" ? "default" : "secondary"}>{l.status === "active" ? "Active" : "Inactive"}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {l.amount ? `${Number(l.amount).toLocaleString()} ${l.currency}` : "Flexible amount"} · Created {l.created_at ? format(new Date(l.created_at), "MMM d, yyyy") : "—"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => copyLink(l.slug)} title="Copy link"><Copy className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => window.open(`/pay/${l.slug}`, "_blank")} title="Open"><ExternalLink className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => toggleActive(l.id, l.status === "active")}>{l.status === "active" ? "Disable" : "Enable"}</Button>
                    <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteLink(l.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
