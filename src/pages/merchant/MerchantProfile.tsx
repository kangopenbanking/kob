import { useEffect, useState } from "react";
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Store, Save, Shield, Globe, Phone, Mail, Building2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

export default function MerchantProfile() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    business_name: "", business_email: "", business_phone: "",
    website_url: "", callback_url: "", business_type: "",
    business_description: "", country: "", default_currency: "XAF",
    support_email: "", support_phone: "", logo_url: "",
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
        support_email: meta.support_email || "",
        support_phone: meta.support_phone || "",
        logo_url: meta.logo_url || "",
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!merchant) return;
    if (!form.business_name.trim()) { toast.error("Business name is required"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from("gateway_merchants").update({
        business_name: form.business_name,
        business_email: form.business_email || null,
        business_phone: form.business_phone || null,
        metadata: {
          ...(merchant.metadata as any || {}),
          website_url: form.website_url, callback_url: form.callback_url,
          business_type: form.business_type, business_description: form.business_description,
          country: form.country, default_currency: form.default_currency,
          support_email: form.support_email, support_phone: form.support_phone,
          logo_url: form.logo_url,
        },
      }).eq("id", merchant.id);
      if (error) throw error;
      toast.success("Profile updated successfully");
      loadData();
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <EmptyState icon={<Store className="h-6 w-6 text-muted-foreground" />} title="No merchant account found" description="Complete merchant onboarding to manage your business profile." />;

  const kybBadge = () => {
    const status = merchant.kyb_status || "not_submitted";
    const v = ["verified", "approved"].includes(status) ? "default" : status === "rejected" ? "destructive" : "secondary";
    return <Badge variant={v as any}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold">Business Profile</h1><p className="text-muted-foreground">Manage your business information and settings</p></div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
        </Button>
      </div>

      {/* Account Overview */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2"><CreditCard className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">ID:</span><span className="font-mono text-xs">{merchant.id}</span></div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Status:</span><Badge variant="outline">{merchant.status}</Badge></div>
            <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">KYB:</span>{kybBadge()}</div>
            <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-muted-foreground">Environment:</span><Badge variant="secondary">{merchant.environment || "sandbox"}</Badge></div>
            <div className="flex items-center gap-2"><span className="text-muted-foreground">Created:</span><span>{format(new Date(merchant.created_at), "MMM d, yyyy")}</span></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Business Details */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
              <CardTitle className="text-base">Business Details</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Business Name *</Label><Input value={form.business_name} onChange={e => setForm(f => ({ ...f, business_name: e.target.value }))} /></div>
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
            <div className="space-y-2"><Label>Description</Label><Textarea value={form.business_description} onChange={e => setForm(f => ({ ...f, business_description: e.target.value }))} rows={3} placeholder="What does your business do?" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Country</Label><Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="e.g. Cameroon" /></div>
              <div className="space-y-2">
                <Label>Default Currency</Label>
                <Select value={form.default_currency} onValueChange={v => setForm(f => ({ ...f, default_currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["XAF","XOF","NGN","GHS","KES","USD","EUR"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2"><Label>Logo URL</Label><Input value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))} placeholder="https://..." /></div>
          </CardContent>
        </Card>

        {/* Contact & Integration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Mail className="h-5 w-5 text-primary" /></div>
              <CardTitle className="text-base">Contact & Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> Business Email</Label><Input type="email" value={form.business_email} onChange={e => setForm(f => ({ ...f, business_email: e.target.value }))} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" /> Business Phone</Label><Input value={form.business_phone} onChange={e => setForm(f => ({ ...f, business_phone: e.target.value }))} /></div>
            <div className="space-y-2"><Label className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" /> Website URL</Label><Input value={form.website_url} onChange={e => setForm(f => ({ ...f, website_url: e.target.value }))} placeholder="https://yourbusiness.com" /></div>
            <div className="space-y-2"><Label>Webhook / Callback URL</Label><Input value={form.callback_url} onChange={e => setForm(f => ({ ...f, callback_url: e.target.value }))} placeholder="https://yourbusiness.com/webhooks" /><p className="text-xs text-muted-foreground">Real-time payment notifications sent here</p></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Support Email</Label><Input type="email" value={form.support_email} onChange={e => setForm(f => ({ ...f, support_email: e.target.value }))} placeholder="support@..." /></div>
              <div className="space-y-2"><Label>Support Phone</Label><Input value={form.support_phone} onChange={e => setForm(f => ({ ...f, support_phone: e.target.value }))} /></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Risk Limits */}
      <Card>
        <CardHeader><CardTitle className="text-base">Risk & Transaction Limits</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3 text-sm">
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Single Charge Limit</span><p className="text-lg font-semibold">{merchant.single_charge_limit ? Number(merchant.single_charge_limit).toLocaleString() : "Unlimited"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Daily Charge Limit</span><p className="text-lg font-semibold">{merchant.daily_charge_limit ? Number(merchant.daily_charge_limit).toLocaleString() : "Unlimited"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Daily Payout Limit</span><p className="text-lg font-semibold">{merchant.daily_payout_limit ? Number(merchant.daily_payout_limit).toLocaleString() : "Unlimited"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Monthly Volume Limit</span><p className="text-lg font-semibold">{merchant.monthly_volume_limit ? Number(merchant.monthly_volume_limit).toLocaleString() : "Unlimited"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Fee Bearer</span><p className="text-lg font-semibold capitalize">{merchant.fee_bearer || "merchant"}</p></div>
            <div className="rounded-lg bg-muted/50 p-3"><span className="text-muted-foreground">Velocity</span><p className="text-lg font-semibold">{merchant.velocity_max_charges || "—"} / {merchant.velocity_window_minutes || "—"} min</p></div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">Risk limits are configured by the platform. Contact support to request changes.</p>
        </CardContent>
      </Card>
    </div>
  );
}
