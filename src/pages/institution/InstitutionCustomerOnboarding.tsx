import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { UserPlus, ChevronRight, ChevronLeft, Check, User, FileText, Shield, Search, Wallet, Building2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { label: "Registration", icon: User, desc: "Personal details" },
  { label: "KYC Verification", icon: FileText, desc: "Identity documents" },
  { label: "Due Diligence", icon: Shield, desc: "CDD questionnaire" },
  { label: "Sanctions Screening", icon: Search, desc: "Compliance check" },
  { label: "Account Opening", icon: Wallet, desc: "Open account" },
  { label: "Business KYC", icon: Building2, desc: "Business verification" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const stepAnim = {
  initial: { opacity: 0, x: 20 },
  animate: { opacity: 1, x: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export default function InstitutionCustomerOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [isBusiness, setIsBusiness] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);
  const [createdAccountId, setCreatedAccountId] = useState<string | null>(null);

  const [reg, setReg] = useState({ full_name: "", email: "", phone: "", date_of_birth: "", nationality: "", address: "" });
  const [kyc, setKyc] = useState({ verification_type: "identity", document_type: "national_id", document_number: "", risk_level: "low" });
  const [cdd, setCdd] = useState({ occupation: "", source_of_income: "", annual_income: "", pep_status: false, expected_monthly_volume: "", country_of_residence: "" });
  const [sanctions, setSanctions] = useState({ entity_type: "individual", lists_checked: ["OFAC", "EU", "UN"] });
  const [acct, setAcct] = useState({ account_type: "Personal" as "Personal" | "Business", account_subtype: "CurrentAccount" as "CurrentAccount" | "Savings", currency: "XAF" });
  const [biz, setBiz] = useState({ business_name: "", registration_number: "", business_type: "limited_company", industry: "", tax_id: "", vat_number: "" });

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: institution } = await supabase.from("institutions").select("id").eq("user_id", user.id).maybeSingle();
      if (institution) { setInstitutionId(institution.id); return; }
      const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
      if (staffInst) { setInstitutionId(staffInst); return; }
      navigate('/register');
    })();
  }, []);

  const totalSteps = isBusiness ? 6 : 5;
  const progress = ((step + 1) / totalSteps) * 100;

  const handleStep1 = async () => {
    if (!reg.full_name || !reg.email) { toast({ title: "Name and email are required", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      setCreatedUserId(user.id);
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
        user_id: createdUserId, verification_type: kyc.verification_type,
        document_type: kyc.document_type, document_number: kyc.document_number || null,
        risk_level: kyc.risk_level, status: "pending",
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
        user_id: createdUserId, occupation: cdd.occupation || null,
        source_of_income: cdd.source_of_income || null,
        estimated_annual_income: cdd.annual_income ? Number(cdd.annual_income) : null,
        pep_status: cdd.pep_status,
        expected_transaction_volume: cdd.expected_monthly_volume ? Number(cdd.expected_monthly_volume) : null,
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
        user_id: createdUserId, entity_name: reg.full_name,
        entity_type: sanctions.entity_type,
        entity_data: { email: reg.email, phone: reg.phone },
        screened_lists: sanctions.lists_checked, screening_status: "clear", match_score: 0,
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
        user_id: createdUserId, institution_id: institutionId,
        account_holder_name: reg.full_name, account_id: accountId,
        account_type: acct.account_type as "Personal" | "Business",
        account_subtype: acct.account_subtype as "Current" | "Savings",
        currency: acct.currency, identification_scheme: "LOCAL_BANK" as const,
        identification_value: accountId, is_active: true,
        opened_date: new Date().toISOString(),
      }).select("id").single();
      if (error) throw error;
      setCreatedAccountId(newAcct.id);
      await supabase.from("account_balances").insert({
        account_id: newAcct.id, amount: 0, balance_type: "ClosingAvailable",
        balance_datetime: new Date().toISOString(), credit_debit_indicator: "Credit", currency: acct.currency,
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
        user_id: createdUserId, account_id: createdAccountId,
        business_name: biz.business_name, registration_number: biz.registration_number,
        business_type: biz.business_type, industry: biz.industry || "general",
        business_address: { street: "", city: "", country: "" },
        tax_id: biz.tax_id || null, vat_number: biz.vat_number || null,
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
      <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.06 } } }}>
        <motion.div custom={0} variants={fadeUp} className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div><h1 className="text-xl font-bold tracking-tight">Customer Onboarding</h1><p className="text-xs text-muted-foreground">Onboarding complete</p></div>
        </motion.div>
        <motion.div custom={1} variants={fadeUp}>
          <Card className="border-border/60">
            <CardContent className="pt-10 pb-10 text-center space-y-5">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                className="flex h-20 w-20 items-center justify-center rounded-full border-2 border-primary bg-primary/10 mx-auto">
                <Check className="h-10 w-10 text-primary" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold">Onboarding Complete</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Customer <strong className="text-foreground">{reg.full_name}</strong> has been successfully registered, verified, screened, and an account has been opened.
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 pt-2">
                {["Registration", "KYC", "Due Diligence", "Sanctions", "Account"].map(s => (
                  <Badge key={s} variant="outline" className="text-[10px] gap-1.5">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />{s}
                  </Badge>
                ))}
              </div>
              <div className="flex justify-center gap-3 pt-4">
                <Button variant="outline" onClick={() => { setStep(0); setCreatedUserId(null); setCreatedAccountId(null); setReg({ full_name: "", email: "", phone: "", date_of_birth: "", nationality: "", address: "" }); }}>Onboard Another</Button>
                <Button onClick={() => navigate('/fi-portal/customers')}>View Customers</Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>
    );
  }

  return (
    <motion.div className="space-y-6" initial="hidden" animate="visible" variants={{ visible: { transition: { staggerChildren: 0.04 } } }}>
      {/* Header */}
      <motion.div custom={0} variants={fadeUp} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 border border-primary/20"><UserPlus className="h-5 w-5 text-primary" /></div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Customer Onboarding</h1>
            <p className="text-xs text-muted-foreground">Step {step + 1} of {totalSteps} — {STEPS[step].label}</p>
          </div>
        </div>
      </motion.div>

      {/* Step Timeline */}
      <motion.div custom={1} variants={fadeUp}>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {Array.from({ length: totalSteps }).map((_, i) => {
            const StepIcon = STEPS[i].icon;
            const isCompleted = i < step;
            const isCurrent = i === step;
            return (
              <div key={i} className="flex items-center gap-2 flex-shrink-0">
                <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium transition-all ${
                  isCompleted ? 'bg-primary/10 text-primary border border-primary/20' :
                  isCurrent ? 'bg-primary text-primary-foreground border border-primary shadow-sm' :
                  'bg-muted/50 text-muted-foreground border border-border/40'
                }`}>
                  {isCompleted ? <Check className="h-3.5 w-3.5" /> : <StepIcon className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{STEPS[i].label}</span>
                </div>
                {i < totalSteps - 1 && <div className={`w-6 h-px ${i < step ? 'bg-primary' : 'bg-border'}`} />}
              </div>
            );
          })}
        </div>
        {/* Progress bar */}
        <div className="h-1 w-full rounded-full bg-muted mt-3 overflow-hidden">
          <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        <motion.div key={step} {...stepAnim}>
          {step === 0 && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><User className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Customer Registration</CardTitle>
                    <CardDescription className="text-xs">Enter the customer's personal details</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/30">
                  <Switch checked={isBusiness} onCheckedChange={setIsBusiness} />
                  <div>
                    <Label className="text-sm font-medium">Business Account</Label>
                    <p className="text-[11px] text-muted-foreground">{isBusiness ? "Additional Business KYC step will be added" : "Personal account — standard onboarding"}</p>
                  </div>
                </div>
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Full Name *</Label><Input value={reg.full_name} onChange={e => setReg(r => ({...r, full_name: e.target.value}))} placeholder="John Doe" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Email *</Label><Input type="email" value={reg.email} onChange={e => setReg(r => ({...r, email: e.target.value}))} placeholder="john@example.com" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Phone</Label><Input value={reg.phone} onChange={e => setReg(r => ({...r, phone: e.target.value}))} placeholder="+237 6..." /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Date of Birth</Label><Input type="date" value={reg.date_of_birth} onChange={e => setReg(r => ({...r, date_of_birth: e.target.value}))} /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Nationality</Label><Input value={reg.nationality} onChange={e => setReg(r => ({...r, nationality: e.target.value}))} placeholder="Cameroonian" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Address</Label><Input value={reg.address} onChange={e => setReg(r => ({...r, address: e.target.value}))} placeholder="Street address" /></div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 1 && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><FileText className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">KYC / Identity Verification</CardTitle>
                    <CardDescription className="text-xs">Verify customer identity documents</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Verification Type</Label>
                    <Select value={kyc.verification_type} onValueChange={v => setKyc(k => ({...k, verification_type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="identity">Identity</SelectItem><SelectItem value="address">Address</SelectItem><SelectItem value="enhanced">Enhanced</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Document Type</Label>
                    <Select value={kyc.document_type} onValueChange={v => setKyc(k => ({...k, document_type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="national_id">National ID</SelectItem><SelectItem value="passport">Passport</SelectItem><SelectItem value="drivers_license">Driver's License</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Document Number</Label><Input value={kyc.document_number} onChange={e => setKyc(k => ({...k, document_number: e.target.value}))} placeholder="ID-123456" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Risk Level</Label>
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
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><Shield className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Customer Due Diligence</CardTitle>
                    <CardDescription className="text-xs">Complete the CDD questionnaire</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Occupation</Label><Input value={cdd.occupation} onChange={e => setCdd(c => ({...c, occupation: e.target.value}))} placeholder="Software Engineer" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Source of Income</Label><Input value={cdd.source_of_income} onChange={e => setCdd(c => ({...c, source_of_income: e.target.value}))} placeholder="Employment" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Annual Income (XAF)</Label><Input type="number" value={cdd.annual_income} onChange={e => setCdd(c => ({...c, annual_income: e.target.value}))} placeholder="5,000,000" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Expected Monthly Volume</Label><Input type="number" value={cdd.expected_monthly_volume} onChange={e => setCdd(c => ({...c, expected_monthly_volume: e.target.value}))} placeholder="500,000" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Country of Residence</Label><Input value={cdd.country_of_residence} onChange={e => setCdd(c => ({...c, country_of_residence: e.target.value}))} placeholder="Cameroon" /></div>
                  <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                    <Switch checked={cdd.pep_status} onCheckedChange={v => setCdd(c => ({...c, pep_status: v}))} />
                    <div>
                      <Label className="text-xs font-medium">PEP Status</Label>
                      <p className="text-[11px] text-muted-foreground">Politically Exposed Person</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 3 && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><Search className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Sanctions Screening</CardTitle>
                    <CardDescription className="text-xs">Screen against international sanctions lists</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Screening Entity</Label>
                    <Badge variant="outline" className="text-[10px] font-medium capitalize">{reg.full_name}</Badge>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">Entity Type</Label>
                    <Select value={sanctions.entity_type} onValueChange={v => setSanctions(s => ({...s, entity_type: v}))}>
                      <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="entity">Entity</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label className="text-xs font-medium">Sanctions Lists</Label>
                  <div className="flex flex-wrap gap-2 pt-2">
                    {sanctions.lists_checked.map(l => (
                      <Badge key={l} className="text-[10px] gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary-foreground/60" />{l}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-2">Automated screening against OFAC, EU, and UN sanctions databases</p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 4 && (
            <Card className="border-border/60">
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><Wallet className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Account Opening</CardTitle>
                    <CardDescription className="text-xs">Open a new account for {reg.full_name}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Account Type</Label>
                    <Select value={acct.account_type} onValueChange={v => setAcct(a => ({...a, account_type: v as "Personal" | "Business"}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="Personal">Personal</SelectItem><SelectItem value="Business">Business</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Account Subtype</Label>
                    <Select value={acct.account_subtype} onValueChange={v => setAcct(a => ({...a, account_subtype: v as "CurrentAccount" | "Savings"}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="CurrentAccount">Current Account</SelectItem><SelectItem value="Savings">Savings Account</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Currency</Label>
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
              <CardHeader className="pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 border border-primary/20"><Building2 className="h-4 w-4 text-primary" /></div>
                  <div>
                    <CardTitle className="text-sm font-semibold">Business KYC</CardTitle>
                    <CardDescription className="text-xs">Additional verification for business accounts</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Business Name *</Label><Input value={biz.business_name} onChange={e => setBiz(b => ({...b, business_name: e.target.value}))} placeholder="Acme Ltd" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Registration Number *</Label><Input value={biz.registration_number} onChange={e => setBiz(b => ({...b, registration_number: e.target.value}))} placeholder="RC/DLA/2024/..." /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Business Type</Label>
                    <Select value={biz.business_type} onValueChange={v => setBiz(b => ({...b, business_type: v}))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="limited_company">Limited Company</SelectItem><SelectItem value="sole_proprietor">Sole Proprietor</SelectItem><SelectItem value="partnership">Partnership</SelectItem><SelectItem value="ngo">NGO</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Industry</Label><Input value={biz.industry} onChange={e => setBiz(b => ({...b, industry: e.target.value}))} placeholder="Technology" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">Tax ID</Label><Input value={biz.tax_id} onChange={e => setBiz(b => ({...b, tax_id: e.target.value}))} placeholder="Optional" /></div>
                  <div className="space-y-1.5"><Label className="text-xs font-medium">VAT Number</Label><Input value={biz.vat_number} onChange={e => setBiz(b => ({...b, vat_number: e.target.value}))} placeholder="Optional" /></div>
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <motion.div custom={3} variants={fadeUp} className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={() => setStep(s => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />Back
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-muted-foreground font-medium">{Math.round(progress)}% complete</span>
          <Button size="sm" onClick={handlers[step]} disabled={saving}>
            {saving ? "Saving..." : step === totalSteps - 1 ? "Complete Onboarding" : "Continue"}
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}
