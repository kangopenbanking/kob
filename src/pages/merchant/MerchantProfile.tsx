import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Store, Save } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export default function MerchantProfile() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: "", business_email: "", business_phone: "",
    website_url: "", callback_url: "", business_type: "",
    business_description: "", country: "", default_currency: "XAF",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setMerchant(data);
      const meta = (data.metadata as any) || {};
      setForm({
        business_name: data.business_name || "",
        business_email: data.business_email || "",
        business_phone: data.business_phone || "",
        website_url: meta.website_url || "",
        callback_url: meta.callback_url || "",
        business_type: meta.business_type || "",
        business_description: meta.business_description || "",
        country: meta.country || "",
        default_currency: meta.default_currency || "XAF",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!merchant) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_merchants").update({
        business_name: form.business_name,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        metadata: {
          ...(merchant.metadata as any || {}),
          website_url: form.website_url,
          callback_url: form.callback_url,
          business_type: form.business_type,
          business_description: form.business_description,
          country: form.country,
          default_currency: form.default_currency,
        },
      }).eq("id", merchant.id);
      if (error) throw error;
      toast.success("Profile updated");
      loadData();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <div className="text-center py-20 text-muted-foreground">No merchant account found</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Business Profile</h1><p className="text-muted-foreground">Manage your business information</p></div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Store className="h-5 w-5 text-primary" /></div>
              <CardTitle className="text-base">Business Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select value={form.business_type} onValueChange={v => setForm(f => ({ ...f, business_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  {["sole_proprietorship","partnership","limited_company","ngo","cooperative","freelancer","e_commerce","saas","marketplace","other"].map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.business_description} onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))} rows={3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={form.default_currency} onValueChange={v => setForm(f => ({ ...f, default_currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="XAF">XAF</SelectItem><SelectItem value="XOF">XOF</SelectItem>
                    <SelectItem value="NGN">NGN</SelectItem><SelectItem value="GHS">GHS</SelectItem>
                    <SelectItem value="KES">KES</SelectItem><SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Contact & Integration</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Business Email</Label>
              <Input type="email" value={form.business_email} onChange={e => setForm(f => ({ ...f, business_email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Business Phone</Label>
              <Input value={form.business_phone} onChange={e => setForm(f => ({ ...f, business_phone: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Website URL</Label>
              <Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Webhook/Callback URL</Label>
              <Input value={form.callback_url} onChange={e => setForm(f => ({ ...f, callback_url: e.target.value }))} />
              <p className="text-xs text-muted-foreground">Real-time payment notifications will be sent here</p>
            </div>
            <div className="rounded-lg bg-muted/50 p-3 space-y-1 text-sm">
              <p className="text-muted-foreground">Account ID: <span className="font-mono text-foreground">{merchant.id}</span></p>
              <p className="text-muted-foreground">Environment: <span className="font-medium text-foreground">{merchant.environment || "sandbox"}</span></p>
              <p className="text-muted-foreground">Status: <span className="font-medium text-foreground">{merchant.status}</span></p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
