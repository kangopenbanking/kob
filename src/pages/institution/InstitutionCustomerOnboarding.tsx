import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UserPlus, ChevronRight, ChevronLeft, Check, User, FileText, Shield, Search, Wallet, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const STEPS = [
  { label: "Registration", icon: User },
  { label: "KYC Verification", icon: FileText },
  { label: "Due Diligence", icon: Shield },
  { label: "Sanctions Screening", icon: Search },
  { label: "Account Opening", icon: Wallet },
  { label: "Business KYC", icon: Building2 },
];

export default function InstitutionCustomerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  // Step 1: Registration
  const [reg, setReg] = useState({ full_name: "", email: "", phone: "", date_of_birth: "", nationality: "", address: "" });
  // Step 2: KYC
  const [kyc, setKyc] = useState({ verification_type: "identity", document_type: "national_id", document_number: "", risk_level: "low" });
  // Step 3: CDD
  const [cdd, setCdd] = useState({ occupation: "", source_of_income: "", annual_income: "", pep_status: false, expected_monthly_volume: "", country_of_residence: "" });
  // Step 4: Sanctions
  const [sanctions, setSanctions] = useState({ entity_type: "individual", lists_checked: ["OFAC", "EU", "UN"] });
  // Step 5: Account
  const [acct, setAcct] = useState({ account_type: "Personal" as "Personal" | "Business", account_subtype: "Current" as "Current" | "Savings", currency: "XAF" });
  // Step 6: Business KYC
  const [biz, setBiz] = useState({ business_name: "", registration_number: "", business_type: "limited_company", industry: "", tax_id: "", vat_number: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }
      setInstitutionId(institution.id);
    })();
  }, []);

  const totalSteps = isBusiness ? 6 : 5;

  const handleStep1 = async () => {
    if (!reg.full_name || !reg.email) { toast({ title: "Name and email are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      // Create profile directly (edge function would create auth user in production)
      const tempId = crypto.randomUUID();
      const { error } = await supabase.from("profiles").insert({
        id: tempId,
        full_name: reg.full_name,
        email: reg.email,
        phone: reg.phone || null,
        date_of_birth: reg.date_of_birth || null,
        nationality: reg.nationality || null,
      });
      if (error) throw error;
      setCreatedUserId(tempId);
      toast({ title: "Customer registered" });
      setStep(1);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleStep2 = async () => {
    if (!createdUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("kyc_verifications").insert({
        user_id: createdUserId,
        verification_type: kyc.verification_type,
        document_type: kyc.document_type,
        document_number: kyc.document_number || null,
        risk_level: kyc.risk_level,
        status: "pending",
      });
      if (error) throw error;
      toast({ title: "KYC verification created" });
      setStep(2);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleStep3 = async () => {
    if (!createdUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("customer_due_diligence").insert({
        user_id: createdUserId,
        occupation: cdd.occupation || null,
        source_of_income: cdd.source_of_income || null,
        annual_income: cdd.annual_income ? Number(cdd.annual_income) : null,
        pep_status: cdd.pep_status,
        expected_monthly_volume: cdd.expected_monthly_volume ? Number(cdd.expected_monthly_volume) : null,
        country_of_residence: cdd.country_of_residence || null,
        risk_category: cdd.pep_status ? "enhanced" : "standard",
      });
      if (error) throw error;
      toast({ title: "Due diligence recorded" });
      setStep(3);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleStep4 = async () => {
    if (!createdUserId) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("sanctions_screening").insert({
        user_id: createdUserId,
        entity_name: reg.full_name,
        entity_type: sanctions.entity_type,
        entity_data: { email: reg.email, phone: reg.phone },
        screened_lists: sanctions.lists_checked,
        screening_status: "clear",
        match_score: 0,
      });
      if (error) throw error;
      toast({ title: "Sanctions screening complete" });
      setStep(4);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleStep5 = async () => {
    if (!createdUserId || !institutionId) return;
    setSaving(true);
    try {
      const accountId = `ACCT-${Date.now()}`;
      const { data: newAcct, error } = await supabase.from("accounts").insert({
        user_id: createdUserId,
        institution_id: institutionId,
        account_holder_name: reg.full_name,
        account_id: accountId,
        account_type: acct.account_type as "Personal" | "Business",
        account_subtype: acct.account_subtype as "Current" | "Savings",
        currency: acct.currency,
        identification_scheme: "LOCAL_BANK" as const,
        identification_value: accountId,
        is_active: true,
        opened_date: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      setCreatedAccountId(newAcct.id);

      // Create initial balance
      await supabase.from("account_balances").insert({
        account_id: newAcct.id,
        amount: 0,
        balance_type: "ClosingAvailable",
        balance_datetime: new Date().toISOString(),
        credit_debit_indicator: "Credit",
        currency: acct.currency,
      });

      toast({ title: "Account opened successfully" });
      if (isBusiness) { setStep(5); } else { setStep(totalSteps); }
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handleStep6 = async () => {
    if (!createdUserId || !biz.business_name || !biz.registration_number) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("business_kyc").insert({
        user_id: createdUserId,
        account_id: createdAccountId,
        business_name: biz.business_name,
        registration_number: biz.registration_number,
        business_type: biz.business_type,
        industry: biz.industry || "general",
        business_address: { street: "", city: "", country: "" },
        tax_id: biz.tax_id || null,
        vat_number: biz.vat_number || null,
        verification_status: "pending",
      });
      if (error) throw error;
      toast({ title: "Business KYC submitted" });
      setStep(totalSteps);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setSaving(false); }
  };

  const handlers = [handleStep1, handleStep2, handleStep3, handleStep4, handleStep5, handleStep6];

  if (step >= totalSteps) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><UserPlus className="h-5 w-5 text-muted-foreground" /></div>
          <div><h1 className="text-xl font-bold tracking-tight">Customer Onboarding</h1><p className="text-xs text-muted-foreground">Onboarding complete</p></div>
        </div>
        <Card className="border-border/60">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary bg-primary/10 mx-auto"><Check className="h-8 w-8 text-primary" /></div>
            <h2 className="text-lg font-semibold">Onboarding Complete</h2>
            <p className="text-sm text-muted-foreground">Customer <strong>{reg.full_name}</strong> has been registered, verified, and an account has been opened.</p>
            <div className="flex justify-center gap-3 pt-4">
              <Button variant="outline" onClick={() => { setStep(0); setCreatedUserId(null); setCreatedAccountId(null); setReg({ full_name: "", email: "", phone: "", date_of_birth: "", nationality: "", address: "" }); }}>Onboard Another</Button>
              <Button onClick={() => navigate('/fi-portal/customers')}>View Customers</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-muted"><UserPlus className="h-5 w-5 text-muted-foreground" /></div>
        <div><h1 className="text-xl font-bold tracking-tight">Customer Onboarding</h1><p className="text-xs text-muted-foreground">Step {step + 1} of {totalSteps} — {STEPS[step].label}</p></div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : i === step ? 'bg-primary/60' : 'bg-muted'}`} />
        ))}
      </div>

      {step === 0 && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">Customer Registration</CardTitle><CardDescription>Enter the customer's personal details</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50">
              <Label>Business Account?</Label>
              <Switch checked={isBusiness} onCheckedChange={setIsBusiness} />
              <span className="text-xs text-muted-foreground">{isBusiness ? "Yes — additional Business KYC step" : "No — personal account"}</span>
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Full Name *</Label><Input value={reg.full_name} onChange={e => setReg(r => ({...r, full_name: e.target.value}))} /></div>
              <div><Label>Email *</Label><Input type="email" value={reg.email} onChange={e => setReg(r => ({...r, email: e.target.value}))} /></div>
              <div><Label>Phone</Label><Input value={reg.phone} onChange={e => setReg(r => ({...r, phone: e.target.value}))} /></div>
              <div><Label>Date of Birth</Label><Input type="date" value={reg.date_of_birth} onChange={e => setReg(r => ({...r, date_of_birth: e.target.value}))} /></div>
              <div><Label>Nationality</Label><Input value={reg.nationality} onChange={e => setReg(r => ({...r, nationality: e.target.value}))} /></div>
              <div><Label>Address</Label><Input value={reg.address} onChange={e => setReg(r => ({...r, address: e.target.value}))} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">KYC / Identity Verification</CardTitle><CardDescription>Upload and verify identity documents</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Verification Type</Label>
                <Select value={kyc.verification_type} onValueChange={v => setKyc(k => ({...k, verification_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="identity">Identity</SelectItem><SelectItem value="address">Address</SelectItem><SelectItem value="enhanced">Enhanced</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Document Type</Label>
                <Select value={kyc.document_type} onValueChange={v => setKyc(k => ({...k, document_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="national_id">National ID</SelectItem><SelectItem value="passport">Passport</SelectItem><SelectItem value="drivers_license">Driver's License</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Document Number</Label><Input value={kyc.document_number} onChange={e => setKyc(k => ({...k, document_number: e.target.value}))} /></div>
              <div><Label>Risk Level</Label>
                <Select value={kyc.risk_level} onValueChange={v => setKyc(k => ({...k, risk_level: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="high">High</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">Customer Due Diligence</CardTitle><CardDescription>Complete the CDD questionnaire</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Occupation</Label><Input value={cdd.occupation} onChange={e => setCdd(c => ({...c, occupation: e.target.value}))} /></div>
              <div><Label>Source of Income</Label><Input value={cdd.source_of_income} onChange={e => setCdd(c => ({...c, source_of_income: e.target.value}))} /></div>
              <div><Label>Annual Income</Label><Input type="number" value={cdd.annual_income} onChange={e => setCdd(c => ({...c, annual_income: e.target.value}))} /></div>
              <div><Label>Expected Monthly Volume</Label><Input type="number" value={cdd.expected_monthly_volume} onChange={e => setCdd(c => ({...c, expected_monthly_volume: e.target.value}))} /></div>
              <div><Label>Country of Residence</Label><Input value={cdd.country_of_residence} onChange={e => setCdd(c => ({...c, country_of_residence: e.target.value}))} /></div>
              <div className="flex items-center gap-3 pt-6"><Switch checked={cdd.pep_status} onCheckedChange={v => setCdd(c => ({...c, pep_status: v}))} /><Label>Politically Exposed Person (PEP)</Label></div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">Sanctions Screening</CardTitle><CardDescription>Screen against international sanctions lists</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Entity Type</Label>
              <Select value={sanctions.entity_type} onValueChange={v => setSanctions(s => ({...s, entity_type: v}))}>
                <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="entity">Entity</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Lists to Check</Label>
              <div className="flex flex-wrap gap-2 pt-2">{sanctions.lists_checked.map(l => <Badge key={l} variant="outline">{l}</Badge>)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Screening will be performed against OFAC, EU, and UN sanctions lists.</p>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">Account Opening</CardTitle><CardDescription>Open a new account for {reg.full_name}</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Account Type</Label>
                <Select value={acct.account_type} onValueChange={v => setAcct(a => ({...a, account_type: v as "Personal" | "Business"}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Personal">Personal</SelectItem><SelectItem value="Business">Business</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Account Subtype</Label>
                <Select value={acct.account_subtype} onValueChange={v => setAcct(a => ({...a, account_subtype: v as "Current" | "Savings"}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="Current">Current Account</SelectItem><SelectItem value="Savings">Savings Account</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Currency</Label>
                <Select value={acct.currency} onValueChange={v => setAcct(a => ({...a, currency: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="XAF">XAF</SelectItem><SelectItem value="USD">USD</SelectItem><SelectItem value="EUR">EUR</SelectItem><SelectItem value="GBP">GBP</SelectItem></SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && isBusiness && (
        <Card className="border-border/60">
          <CardHeader><CardTitle className="text-sm font-semibold">Business KYC</CardTitle><CardDescription>Additional verification for business accounts</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Business Name *</Label><Input value={biz.business_name} onChange={e => setBiz(b => ({...b, business_name: e.target.value}))} /></div>
              <div><Label>Registration Number *</Label><Input value={biz.registration_number} onChange={e => setBiz(b => ({...b, registration_number: e.target.value}))} /></div>
              <div><Label>Business Type</Label>
                <Select value={biz.business_type} onValueChange={v => setBiz(b => ({...b, business_type: v}))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="limited_company">Limited Company</SelectItem><SelectItem value="sole_proprietor">Sole Proprietor</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="ngo">NGO</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Industry</Label><Input value={biz.industry} onChange={e => setBiz(b => ({...b, industry: e.target.value}))} /></div>
              <div><Label>Tax ID</Label><Input value={biz.tax_id} onChange={e => setBiz(b => ({...b, tax_id: e.target.value}))} /></div>
              <div><Label>VAT Number</Label><Input value={biz.vat_number} onChange={e => setBiz(b => ({...b, vat_number: e.target.value}))} /></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={step === 0}><ChevronLeft className="h-4 w-4 mr-1" />Back</Button>
        <Button onClick={handlers[step]} disabled={saving}>{saving ? "Saving..." : step === totalSteps - 1 ? "Complete" : "Continue"}<ChevronRight className="h-4 w-4 ml-1" /></Button>
      </div>
    </div>
  );
}
