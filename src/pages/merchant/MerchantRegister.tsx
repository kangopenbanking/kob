import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Store, ArrowRight, ArrowLeft, CheckCircle2, Building2, Globe, Mail, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { MandatoryPinSetupStep } from "@/components/auth/MandatoryPinSetupStep";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const STEPS = [
  { title: "Business Information", description: "Tell us about your business" },
  { title: "Contact Details", description: "How can we reach you?" },
  { title: "Business Settings", description: "Configure your account preferences" },
  { title: "Review & Submit", description: "Confirm your details" },
];

const BUSINESS_TYPES = [
  "sole_proprietorship", "partnership", "limited_company", "ngo",
  "cooperative", "freelancer", "e_commerce", "saas", "marketplace", "other",
];

const COUNTRIES = [
  { code: "CM", name: "Cameroon", currency: "XAF" },
  { code: "NG", name: "Nigeria", currency: "NGN" },
  { code: "GH", name: "Ghana", currency: "GHS" },
  { code: "KE", name: "Kenya", currency: "KES" },
  { code: "SN", name: "Senegal", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", currency: "XOF" },
  { code: "GA", name: "Gabon", currency: "XAF" },
  { code: "CD", name: "DR Congo", currency: "CDF" },
];

export default function MerchantRegister() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [form, setForm] = useState({
    business_name: "",
    business_type: "",
    business_description: "",
    country: "CM",
    website_url: "",
    business_email: "",
    business_phone: "",
    contact_name: "",
    default_currency: "XAF",
    callback_url: "",
  });

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const selectedCountry = COUNTRIES.find(c => c.code === form.country);

  const canProceed = () => {
    if (step === 0) return form.business_name.trim().length >= 2 && form.business_type;
    if (step === 1) return form.business_email.trim().includes("@");
    return true;
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in first");
        navigate("/auth");
        return;
      }

      // Check if already has a merchant account
      const { data: existing } = await supabase.from("gateway_merchants").select("id").eq("user_id", user.id).maybeSingle();
      if (existing) {
        toast.info("You already have a merchant account");
        navigate("/merchant");
        return;
      }

      const { error } = await supabase.from("gateway_merchants").insert({
        user_id: user.id,
        business_name: form.business_name.trim(),
        business_email: form.business_email.trim() || null,
        business_phone: form.business_phone.trim() || null,
        status: "draft",
        kyb_status: "not_submitted",
        environment: "sandbox",
        metadata: {
          business_type: form.business_type,
          business_description: form.business_description,
          country: form.country,
          website_url: form.website_url,
          contact_name: form.contact_name,
          default_currency: form.default_currency || selectedCountry?.currency || "XAF",
          callback_url: form.callback_url,
        },
      });

      if (error) throw error;

      toast.success("Merchant account created! Welcome aboard 🎉");
      // Check if user needs PIN setup
      const { data: profile } = await supabase.from("profiles").select("pin_code_hash").eq("id", user.id).maybeSingle();
      if (!profile?.pin_code_hash) {
        setShowPinSetup(true);
      } else {
        setTimeout(() => navigate("/merchant"), 500);
      }
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Failed to create merchant account"));
    } finally {
      setSubmitting(false);
    }
  };

  if (showPinSetup) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <Card className="border-border/60 shadow-lg">
            <CardContent className="pt-6">
              <MandatoryPinSetupStep onComplete={() => navigate("/merchant")} />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-primary text-primary-foreground mx-auto">
            <Store className="h-7 w-7" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Start Accepting Payments</h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Set up your merchant account in minutes. Accept Mobile Money, cards, and bank transfers across Africa.
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 justify-center">
          {STEPS.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
                i < step ? "bg-primary text-primary-foreground" :
                i === step ? "bg-primary text-primary-foreground ring-4 ring-primary/20" :
                "bg-muted text-muted-foreground"
              }`}>
                {i < step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && <div className={`h-0.5 w-8 ${i < step ? "bg-primary" : "bg-muted"}`} />}
            </div>
          ))}
        </div>

        <Card className="border-border/60 shadow-lg">
          <CardHeader>
            <CardTitle>{STEPS[step].title}</CardTitle>
            <CardDescription>{STEPS[step].description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Step 0: Business Info */}
            {step === 0 && (
              <>
                <div className="space-y-2">
                  <Label>Business Name *</Label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="Acme Technologies Ltd" value={form.business_name} onChange={e => update("business_name", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Business Type *</Label>
                  <Select value={form.business_type} onValueChange={v => update("business_type", v)}>
                    <SelectTrigger><SelectValue placeholder="Select business type" /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map(t => (
                        <SelectItem key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Country</Label>
                  <Select value={form.country} onValueChange={v => {
                    update("country", v);
                    const c = COUNTRIES.find(c => c.code === v);
                    if (c) update("default_currency", c.currency);
                  }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Business Description</Label>
                  <Textarea placeholder="Briefly describe what your business does..." value={form.business_description} onChange={e => update("business_description", e.target.value)} rows={3} />
                </div>
              </>
            )}

            {/* Step 1: Contact Details */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label>Business Email *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" type="email" placeholder="billing@acme.com" value={form.business_email} onChange={e => update("business_email", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Business Phone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="+237 6XX XXX XXX" value={form.business_phone} onChange={e => update("business_phone", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Contact Person Name</Label>
                  <Input placeholder="John Doe" value={form.contact_name} onChange={e => update("contact_name", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input className="pl-9" placeholder="https://www.acme.com" value={form.website_url} onChange={e => update("website_url", e.target.value)} />
                  </div>
                </div>
              </>
            )}

            {/* Step 2: Settings */}
            {step === 2 && (
              <>
                <div className="space-y-2">
                  <Label>Default Currency</Label>
                  <Select value={form.default_currency} onValueChange={v => update("default_currency", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XAF">XAF (CFA Franc BEAC)</SelectItem>
                      <SelectItem value="XOF">XOF (CFA Franc BCEAO)</SelectItem>
                      <SelectItem value="NGN">NGN (Nigerian Naira)</SelectItem>
                      <SelectItem value="GHS">GHS (Ghanaian Cedi)</SelectItem>
                      <SelectItem value="KES">KES (Kenyan Shilling)</SelectItem>
                      <SelectItem value="USD">USD (US Dollar)</SelectItem>
                      <SelectItem value="EUR">EUR (Euro)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Webhook/Callback URL (optional)</Label>
                  <Input placeholder="https://api.acme.com/webhooks/kob" value={form.callback_url} onChange={e => update("callback_url", e.target.value)} />
                  <p className="text-xs text-muted-foreground">We'll send real-time payment notifications to this URL</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-2">
                  <p className="text-sm font-medium">What happens next?</p>
                  <ul className="text-sm text-muted-foreground space-y-1.5">
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Your account starts in <Badge variant="secondary" className="text-xs">Sandbox</Badge> mode</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Complete KYB verification to go live</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Get sandbox API keys immediately</li>
                    <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />Test with MTN MoMo, Orange Money, and Cards</li>
                  </ul>
                </div>
              </>
            )}

            {/* Step 3: Review */}
            {step === 3 && (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Business Name</p>
                    <p className="font-medium">{form.business_name}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Business Type</p>
                    <p className="font-medium">{form.business_type.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Country</p>
                    <p className="font-medium">{selectedCountry?.name || form.country}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Currency</p>
                    <p className="font-medium">{form.default_currency}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Email</p>
                    <p className="font-medium">{form.business_email || "—"}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Phone</p>
                    <p className="font-medium">{form.business_phone || "—"}</p>
                  </div>
                </div>
                {form.business_description && (
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{form.business_description}</p>
                  </div>
                )}
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    By creating your account, you agree to our Terms of Service and Merchant Agreement. Your account will start in sandbox mode for testing.
                  </p>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-3 pt-4">
              {step > 0 && (
                <Button variant="outline" onClick={() => setStep(s => s - 1)} className="gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Button>
              )}
              <div className="flex-1" />
              {step < STEPS.length - 1 ? (
                <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()} className="gap-2">
                  Continue <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Create Merchant Account
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account? <a href="/auth" className="text-primary hover:underline">Sign in</a>
        </p>
      </div>
    </div>
  );
}
