import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Globe, FileText, CreditCard, Mail, Shield, ExternalLink, Save, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

const defaultWhiteLabel = {
  custom_domain: "",
  custom_domain_verified: false,
  hide_platform_branding: false,
  custom_email_domain: "",
  custom_email_from_name: "",
  branded_receipts: true,
  branded_checkout: true,
  branded_emails: false,
  custom_terms_url: "",
  custom_privacy_url: "",
  custom_support_email: "",
  custom_support_url: "",
};

export default function MerchantWhiteLabel() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(defaultWhiteLabel);

  const { data: merchant, isLoading } = useQuery({
    queryKey: ["merchant-white-label"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name, white_label_config, plan_tier, custom_domain")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.white_label_config) {
        setConfig({ ...defaultWhiteLabel, ...data.white_label_config, custom_domain: data.custom_domain || "" });
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant");
      const { custom_domain, ...wlConfig } = config;
      const { error } = await (supabase as any)
        .from("gateway_merchants")
        .update({
          white_label_config: wlConfig,
          custom_domain: custom_domain || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-white-label"] });
      toast.success("White-label settings saved");
    },
    onError: () => toast.error("Failed to save settings"),
  });

  const updateField = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const isEnterprise = merchant?.plan_tier === "enterprise";

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => <div key={i} className="h-40 bg-muted animate-pulse rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">White-Label Options</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Remove platform branding and use your own domain, emails, and checkout
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!isEnterprise && (
            <Badge variant="secondary" className="text-xs">Enterprise Feature</Badge>
          )}
          {isEnterprise && (
            <Button size="sm" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              <Save className="h-4 w-4 mr-1" /> Save Changes
            </Button>
          )}
        </div>
      </div>

      {!isEnterprise && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-6 text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Enterprise Feature</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            White-label customization requires an Enterprise plan. Upgrade to remove platform branding and use your own domain, emails, and checkout.
          </p>
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
            onClick={() => toast.info('Contact support to upgrade your plan.')}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Contact Sales
          </Button>
        </div>
      )}

      {isEnterprise && <>
      {/* Custom Domain */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Globe className="h-5 w-5" /> Custom Domain
          </CardTitle>
          <CardDescription>
            Use your own domain for payment pages and checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Payment Domain</Label>
            <div className="flex gap-3">
              <Input
                value={config.custom_domain}
                onChange={(e) => updateField("custom_domain", e.target.value)}
                placeholder="pay.yourdomain.com"
                className="flex-1"
              />
              <Button variant="outline" size="sm">
                <Shield className="h-4 w-4 mr-1" /> Verify DNS
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Add a CNAME record pointing to checkout.kangopenbanking.com
            </p>
          </div>

          {config.custom_domain_verified && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-700">
              <CheckCircle2 className="h-4 w-4" />
              <span className="text-sm font-medium">Domain verified and active</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Branding Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5" /> Branding Controls
          </CardTitle>
          <CardDescription>Control platform branding visibility</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            { key: "hide_platform_branding", label: "Hide Platform Branding", desc: "Remove all KANG branding from customer-facing pages" },
            { key: "branded_receipts", label: "Branded Receipts", desc: "Use your branding on payment receipts" },
            { key: "branded_checkout", label: "Branded Checkout", desc: "Use your branding on checkout pages" },
            { key: "branded_emails", label: "Branded Emails", desc: "Use your branding on transactional emails" },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between p-4 rounded-xl border border-border">
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={(config as any)[key]}
                onCheckedChange={(v) => updateField(key, v)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Custom Email */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Mail className="h-5 w-5" /> Email Configuration
          </CardTitle>
          <CardDescription>Customize transactional email sender details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>From Name</Label>
              <Input
                value={config.custom_email_from_name}
                onChange={(e) => updateField("custom_email_from_name", e.target.value)}
                placeholder="Your Business Name"
              />
            </div>
            <div className="space-y-2">
              <Label>Email Domain</Label>
              <Input
                value={config.custom_email_domain}
                onChange={(e) => updateField("custom_email_domain", e.target.value)}
                placeholder="mail.yourdomain.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legal & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5" /> Legal & Support Links
          </CardTitle>
          <CardDescription>Provide your own legal pages and support channels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Terms of Service URL</Label>
              <Input
                value={config.custom_terms_url}
                onChange={(e) => updateField("custom_terms_url", e.target.value)}
                placeholder="https://yourdomain.com/terms"
              />
            </div>
            <div className="space-y-2">
              <Label>Privacy Policy URL</Label>
              <Input
                value={config.custom_privacy_url}
                onChange={(e) => updateField("custom_privacy_url", e.target.value)}
                placeholder="https://yourdomain.com/privacy"
              />
            </div>
            <div className="space-y-2">
              <Label>Support Email</Label>
              <Input
                value={config.custom_support_email}
                onChange={(e) => updateField("custom_support_email", e.target.value)}
                placeholder="support@yourdomain.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Support URL</Label>
              <Input
                value={config.custom_support_url}
                onChange={(e) => updateField("custom_support_url", e.target.value)}
                placeholder="https://help.yourdomain.com"
              />
            </div>
          </div>
        </CardContent>
      </Card>
      </>}
    </div>
  );
}
