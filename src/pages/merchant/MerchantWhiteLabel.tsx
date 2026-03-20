import { useState } from "react";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Globe, FileText, CreditCard, Mail, Shield, ExternalLink, Save,
  CheckCircle2, Loader2, AlertCircle, Copy, Trash2, RefreshCw,
  Clock, XCircle, Wifi,
} from "lucide-react";
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

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; description: string }> = {
  none: { label: "Not Configured", color: "text-muted-foreground", icon: Globe, description: "No custom domain has been set up yet." },
  pending: { label: "Pending Verification", color: "text-amber-600", icon: Clock, description: "DNS records not yet detected. This can take up to 72 hours to propagate." },
  verified: { label: "Verified", color: "text-green-600", icon: CheckCircle2, description: "Domain ownership confirmed. SSL certificate is being provisioned." },
  active: { label: "Active", color: "text-green-600", icon: Wifi, description: "Your custom domain is live and serving your checkout pages." },
  failed: { label: "Verification Failed", color: "text-destructive", icon: XCircle, description: "DNS records are incorrect or not pointing to the right target." },
};

export default function MerchantWhiteLabel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState(defaultWhiteLabel);
  const [domainInput, setDomainInput] = useState("");

  const { data: merchant, isLoading } = useQuery({
    queryKey: ["merchant-white-label"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { data } = await (supabase as any)
        .from("gateway_merchants")
        .select("id, business_name, white_label_config, plan_tier, custom_domain, domain_verification_status, domain_verified_at, domain_ssl_status, domain_cname_target")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data?.white_label_config) {
        setConfig({ ...defaultWhiteLabel, ...data.white_label_config });
      }
      if (data?.custom_domain) {
        setDomainInput(data.custom_domain);
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant");
      const { error } = await (supabase as any)
        .from("gateway_merchants")
        .update({
          white_label_config: config,
          updated_at: new Date().toISOString(),
        })
        .eq("id", merchant.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-white-label"] });
      toast.success("White-label settings saved successfully");
    },
    onError: () => toast.error("Failed to save white-label settings. Please try again."),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant");
      const { data, error } = await supabase.functions.invoke("verify-custom-domain", {
        body: { action: "verify", merchant_id: merchant.id, domain: domainInput.trim() },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["merchant-white-label"] });
      if (data?.verified) {
        toast.success("Domain verified! SSL certificate is being provisioned.");
      } else {
        toast.warning(data?.message || "CNAME record not found. Please check your DNS settings and try again.");
      }
    },
    onError: (err: any) => {
      toast.error(err?.message || "DNS verification failed. Please check your domain settings.");
    },
  });

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (!merchant?.id) throw new Error("No merchant");
      const { data, error } = await supabase.functions.invoke("verify-custom-domain", {
        body: { action: "remove", merchant_id: merchant.id },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      setDomainInput("");
      queryClient.invalidateQueries({ queryKey: ["merchant-white-label"] });
      toast.success("Custom domain removed successfully");
    },
    onError: () => toast.error("Failed to remove domain. Please try again."),
  });

  const updateField = (key: string, value: any) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const { isAdmin } = useIsAdmin();
  const isEnterprise = merchant?.plan_tier === "enterprise" || isAdmin;

  const domainStatus = merchant?.domain_verification_status || "none";
  const statusInfo = STATUS_CONFIG[domainStatus] || STATUS_CONFIG.none;
  const StatusIcon = statusInfo.icon;
  const cnameTarget = merchant?.domain_cname_target || "checkout.kangopenbanking.com";
  const hasDomain = !!merchant?.custom_domain;

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
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Save Changes
            </Button>
          )}
        </div>
      </div>

      {!isEnterprise && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-8 text-center space-y-4">
          <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-amber-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Enterprise Feature</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            White-label customization requires an Enterprise plan. Upgrade to remove platform branding and use your own domain, emails, and checkout.
          </p>
          <Button
            variant="outline"
            className="border-amber-500/30 text-amber-700 hover:bg-amber-500/10"
            onClick={() => navigate("/biz/enterprise")}
          >
            <ExternalLink className="h-4 w-4 mr-1.5" /> Upgrade to Enterprise
          </Button>
        </div>
      )}

      {isEnterprise && (
        <>
          {/* Custom Domain */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Globe className="h-5 w-5" /> Custom Domain
                  </CardTitle>
                  <CardDescription>
                    Use your own domain for payment pages and checkout
                  </CardDescription>
                </div>
                {hasDomain && (
                  <Badge
                    variant="outline"
                    className={`${statusInfo.color} border-current/20 gap-1.5`}
                  >
                    <StatusIcon className="h-3 w-3" />
                    {statusInfo.label}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Domain Input */}
              <div className="space-y-2">
                <Label>Payment Domain</Label>
                <div className="flex gap-3">
                  <Input
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="pay.yourdomain.com"
                    className="flex-1"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => verifyMutation.mutate()}
                    disabled={verifyMutation.isPending || !domainInput.trim()}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4 mr-1.5" />
                    )}
                    {verifyMutation.isPending ? "Verifying…" : "Verify DNS"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Use a subdomain like <code className="text-xs bg-muted px-1 rounded">pay.yourdomain.com</code> or <code className="text-xs bg-muted px-1 rounded">checkout.yourdomain.com</code>
                </p>
              </div>

              {/* DNS Instructions */}
              <div className="rounded-xl border border-border bg-muted/30 p-5 space-y-4">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4 text-primary" /> DNS Configuration Required
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Add the following <strong>CNAME</strong> record at your domain registrar (e.g., GoDaddy, Namecheap, Cloudflare):
                </p>

                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/60">
                      <tr>
                        <th className="px-4 py-2 text-left font-bold text-foreground">Type</th>
                        <th className="px-4 py-2 text-left font-bold text-foreground">Name</th>
                        <th className="px-4 py-2 text-left font-bold text-foreground">Value</th>
                        <th className="px-4 py-2 text-left font-bold text-foreground">TTL</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td className="px-4 py-2.5 border-t border-border font-mono">CNAME</td>
                        <td className="px-4 py-2.5 border-t border-border font-mono">
                          {domainInput ? domainInput.split('.')[0] : 'pay'}
                        </td>
                        <td className="px-4 py-2.5 border-t border-border">
                          <div className="flex items-center gap-2">
                            <code className="font-mono text-primary">{cnameTarget}</code>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 shrink-0"
                              onClick={() => {
                                navigator.clipboard.writeText(cnameTarget);
                                toast.success("CNAME target copied to clipboard");
                              }}
                            >
                              <Copy className="w-3 h-3" />
                            </Button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 border-t border-border font-mono">Auto / 3600</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="text-xs text-muted-foreground space-y-1.5">
                  <p>• DNS propagation can take <strong>up to 72 hours</strong>, but usually completes within 30 minutes.</p>
                  <p>• If using <strong>Cloudflare</strong>, set the proxy status to <strong>"DNS Only"</strong> (grey cloud icon).</p>
                  <p>• Remove any existing A or CNAME records for the same subdomain first.</p>
                  <p>• Use <a href="https://dnschecker.org" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">DNSChecker.org</a> to verify your records are visible globally.</p>
                </div>
              </div>

              {/* Domain Status Panel */}
              {hasDomain && (
                <div className={`rounded-xl border p-4 space-y-3 ${
                  domainStatus === 'verified' || domainStatus === 'active'
                    ? 'border-green-500/20 bg-green-500/5'
                    : domainStatus === 'pending'
                    ? 'border-amber-500/20 bg-amber-500/5'
                    : domainStatus === 'failed'
                    ? 'border-destructive/20 bg-destructive/5'
                    : 'border-border bg-muted/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon className={`h-4 w-4 ${statusInfo.color}`} />
                      <span className={`text-sm font-semibold ${statusInfo.color}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {(domainStatus === 'pending' || domainStatus === 'failed') && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => verifyMutation.mutate()}
                          disabled={verifyMutation.isPending}
                          className="gap-1.5 text-xs"
                        >
                          <RefreshCw className={`h-3 w-3 ${verifyMutation.isPending ? 'animate-spin' : ''}`} />
                          Retry
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (confirm("Remove this custom domain? Your checkout will revert to the default Kang domain.")) {
                            removeMutation.mutate();
                          }
                        }}
                        disabled={removeMutation.isPending}
                        className="gap-1.5 text-xs text-destructive hover:text-destructive"
                      >
                        {removeMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                        Remove
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">{statusInfo.description}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>Domain: <code className="bg-muted px-1 rounded font-mono">{merchant?.custom_domain}</code></span>
                    {merchant?.domain_verified_at && (
                      <span>Verified: {new Date(merchant.domain_verified_at).toLocaleDateString()}</span>
                    )}
                  </div>
                </div>
              )}

              {/* SSL Status */}
              {(domainStatus === 'verified' || domainStatus === 'active') && (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                  <Shield className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-sm font-medium text-green-700">SSL Certificate</p>
                    <p className="text-xs text-muted-foreground">
                      {merchant?.domain_ssl_status === 'active'
                        ? 'SSL certificate is active. Your checkout is served over HTTPS.'
                        : 'SSL certificate is being provisioned automatically. This may take a few minutes.'}
                    </p>
                  </div>
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
        </>
      )}
    </div>
  );
}
