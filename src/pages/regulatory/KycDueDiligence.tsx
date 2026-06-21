import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Shield, UserCheck, Building2, CheckCircle, AlertTriangle, Loader2, ArrowRight, ArrowLeft, FileText, Camera, User, Briefcase, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentUploader } from "@/components/kyc/DocumentUploader";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

// ─── Types ──────────────────────────────────────────────
interface FormState {
  fullName: string; dateOfBirth: string; nationality: string; phone: string;
  idType: string; idNumber: string; idExpiry: string; addressLine1: string; addressCity: string; addressCountry: string;
  sourceOfFunds: string; occupation: string; employerName: string; annualIncome: string; purposeOfAccount: string; taxId: string;
  businessName: string; businessType: string; registrationNumber: string; registrationCountry: string; industry: string; annualTurnover: string; businessDescription: string;
  pepDeclaration: boolean; sanctionsDeclaration: boolean; accuracyDeclaration: boolean;
}

const initial: FormState = {
  fullName: "", dateOfBirth: "", nationality: "", phone: "",
  idType: "", idNumber: "", idExpiry: "", addressLine1: "", addressCity: "", addressCountry: "",
  sourceOfFunds: "", occupation: "", employerName: "", annualIncome: "", purposeOfAccount: "", taxId: "",
  businessName: "", businessType: "", registrationNumber: "", registrationCountry: "", industry: "", annualTurnover: "", businessDescription: "",
  pepDeclaration: false, sanctionsDeclaration: false, accuracyDeclaration: false,
};

interface DocPaths {
  idFront: string; idBack: string; selfie: string; proofOfAddress: string;
  registrationCertificate: string; articlesOfAssociation: string; taxCertificate: string;
  businessProofOfAddress: string; bankStatement: string; boardResolution: string; uboDeclaration: string;
}

const initialDocs: DocPaths = {
  idFront: "", idBack: "", selfie: "", proofOfAddress: "",
  registrationCertificate: "", articlesOfAssociation: "", taxCertificate: "",
  businessProofOfAddress: "", bankStatement: "", boardResolution: "", uboDeclaration: "",
};

// ─── Step Definitions ───────────────────────────────────
const individualSteps = [
  { id: "type", label: "Verification Type", icon: Shield },
  { id: "personal", label: "Personal Info", icon: User },
  { id: "identity", label: "Identity Document", icon: FileText },
  { id: "documents", label: "Upload Documents", icon: Camera },
  { id: "enhanced", label: "Enhanced Due Diligence", icon: UserCheck },
  { id: "declarations", label: "Declarations & Submit", icon: CheckCircle },
];

const businessSteps = [
  { id: "type", label: "Verification Type", icon: Shield },
  { id: "business-info", label: "Business Details", icon: Building2 },
  { id: "business-address", label: "Business Address", icon: Globe },
  { id: "business-docs", label: "Upload Documents", icon: FileText },
  { id: "declarations", label: "Declarations & Submit", icon: CheckCircle },
];

// ─── Stepper Component ──────────────────────────────────
function FlowStepper({ steps, currentStep }: { steps: typeof individualSteps; currentStep: number }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isCompleted = i < currentStep;
        return (
          <div key={step.id} className="flex items-center">
            <div className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-full text-xs font-medium transition-all whitespace-nowrap",
              isActive && "bg-primary text-primary-foreground shadow-md",
              isCompleted && "bg-primary/10 text-primary",
              !isActive && !isCompleted && "bg-muted text-muted-foreground"
            )}>
              {isCompleted ? (
                <CheckCircle className="h-3.5 w-3.5" />
              ) : (
                <Icon className="h-3.5 w-3.5" />
              )}
              <span className="hidden sm:inline">{step.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("w-6 h-0.5 mx-1", i < currentStep ? "bg-primary" : "bg-muted")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Animation Wrapper ──────────────────────────────────
const slideVariants = {
  enter: (direction: number) => ({ x: direction > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -80 : 80, opacity: 0 }),
};

function StepWrapper({ children, direction }: { children: React.ReactNode; direction: number }) {
  return (
    <motion.div
      custom={direction}
      variants={slideVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      {children}
    </motion.div>
  );
}

// ─── Main Component ─────────────────────────────────────
export default function KycDueDiligence() {
  const [form, setForm] = useState<FormState>(initial);
  const [docs, setDocs] = useState<DocPaths>(initialDocs);
  const [flowType, setFlowType] = useState<"individual" | "business" | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const set = (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [field]: e.target.value }));
  const setSelect = (field: keyof FormState) => (val: string) =>
    setForm(f => ({ ...f, [field]: val }));
  const toggle = (field: keyof FormState) => () =>
    setForm(f => ({ ...f, [field]: !f[field] }));
  const setDoc = (field: keyof DocPaths) => (path: string) =>
    setDocs(d => ({ ...d, [field]: path }));
  const clearDoc = (field: keyof DocPaths) => () =>
    setDocs(d => ({ ...d, [field]: "" }));

  const steps = flowType === "business" ? businessSteps : individualSteps;
  const totalSteps = steps.length;
  const progressPct = flowType ? ((step + 1) / totalSteps) * 100 : 0;

  const next = useCallback(() => { setDirection(1); setStep(s => Math.min(s + 1, totalSteps - 1)); }, [totalSteps]);
  const prev = useCallback(() => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); }, []);

  // Documents are stored as storage paths (private bucket, signed URLs used for viewing)

  const handleSubmit = async () => {
    if (!form.accuracyDeclaration) { toast.error("You must confirm the accuracy declaration."); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("You must be logged in."); return; }
    setSubmitting(true);
    try {
      if (flowType === "individual") {
        if (!docs.idFront) { toast.error("Upload your ID document (front)."); setSubmitting(false); return; }
        if (!docs.selfie) { toast.error("Upload a selfie photo."); setSubmitting(false); return; }
        const { submitIdentityKyc } = await import("@/lib/kycGateway");
        await submitIdentityKyc({
          verification_type: "identity",
          document_type: form.idType || "national_id",
          document_number: form.idNumber,
          document_country: form.nationality || "CM",
          document_expiry_date: form.idExpiry,
          document_front_url: docs.idFront,
          document_back_url: docs.idBack || undefined,
          selfie_url: docs.selfie,
        });
        toast.success("KYC submitted successfully!");
      } else {
        if (!docs.registrationCertificate) { toast.error("Upload registration certificate."); setSubmitting(false); return; }
        if (!docs.articlesOfAssociation) { toast.error("Upload articles of association."); setSubmitting(false); return; }
        const { submitBusinessKyb } = await import("@/lib/kycGateway");
        await submitBusinessKyb({
          business_name: form.businessName, registration_number: form.registrationNumber,
          business_type: form.businessType, industry: form.industry,
          business_address: { street: form.addressLine1, city: form.addressCity, country: form.registrationCountry || "CM" },
          business_description: form.businessDescription,
          annual_turnover: form.annualTurnover ? parseFloat(form.annualTurnover) : null,
          registration_certificate_url: docs.registrationCertificate,
          articles_of_association_url: docs.articlesOfAssociation,
          tax_certificate_url: docs.taxCertificate || null,
          proof_of_address_url: docs.businessProofOfAddress || null,
          bank_statement_url: docs.bankStatement || null,
        });
        toast.success("Business KYB submitted successfully!");
      }
      setForm(initial); setDocs(initialDocs); setFlowType(null); setStep(0);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Submission failed."));
    } finally {
      setSubmitting(false);
    }
  };

  // ─── TYPE SELECTION SCREEN ──────────────
  if (!flowType) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-10">
          <Badge variant="outline" className="mb-4">KYC / Customer Due Diligence</Badge>
          <h1 className="text-3xl font-bold mb-3">Know Your Customer Verification</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">Complete verification to access Kang Open Banking services. Per CEMAC AML Regulation No. 01/03.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="cursor-pointer border-2 hover:border-primary/50 transition-all group h-full"
              onClick={() => { setFlowType("individual"); setStep(0); }}
            >
              <CardContent className="p-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                  <User className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Individual KYC</h3>
                <p className="text-sm text-muted-foreground">Personal identity verification with government ID, selfie, and proof of address.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary" className="text-xs">Tier 1: ≤100K XAF</Badge>
                  <Badge variant="secondary" className="text-xs">Tier 2: ≤1M XAF</Badge>
                  <Badge variant="secondary" className="text-xs">Tier 3: ≤10M XAF</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card
              className="cursor-pointer border-2 hover:border-primary/50 transition-all group h-full"
              onClick={() => { setFlowType("business"); setStep(0); }}
            >
              <CardContent className="p-8 text-center space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto group-hover:bg-primary/20 transition-colors">
                  <Building2 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Business KYB</h3>
                <p className="text-sm text-muted-foreground">Business entity verification with RCCM, articles of association, and financial documents.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Badge variant="secondary" className="text-xs">COBAC Compliant</Badge>
                  <Badge variant="secondary" className="text-xs">CEMAC Regulation</Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  // ─── STEP CONTENT RENDERERS ─────────────
  const renderIndividualStep = () => {
    const currentId = individualSteps[step]?.id;
    switch (currentId) {
      case "type": return null; // handled above
      case "personal": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Personal Information</h2>
            <p className="text-sm text-muted-foreground">Basic details as they appear on your government ID.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Legal Name <span className="text-destructive">*</span></Label>
              <Input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="As it appears on your ID" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Date of Birth <span className="text-destructive">*</span></Label>
              <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Nationality <span className="text-destructive">*</span></Label>
              <Select value={form.nationality} onValueChange={setSelect("nationality")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select nationality" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CM">Cameroonian</SelectItem>
                  <SelectItem value="NG">Nigerian</SelectItem>
                  <SelectItem value="GH">Ghanaian</SelectItem>
                  <SelectItem value="KE">Kenyan</SelectItem>
                  <SelectItem value="ZA">South African</SelectItem>
                  <SelectItem value="FR">French</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number <span className="text-destructive">*</span></Label>
              <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+237 6XX XXX XXX" className="h-11" />
            </div>
          </div>
        </div>
      );
      case "identity": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Identity Document</h2>
            <p className="text-sm text-muted-foreground">Select your government-issued ID type and provide the details.</p>
          </div>
          <div className="grid grid-cols-1 gap-5">
            <div className="space-y-2">
              <Label>ID Document Type <span className="text-destructive">*</span></Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { value: "national_id", label: "National ID (CNI)", icon: "🪪" },
                  { value: "passport", label: "Passport", icon: "📕" },
                  { value: "drivers_license", label: "Driver's License", icon: "🚗" },
                  { value: "residence_permit", label: "Residence Permit", icon: "🏠" },
                ].map(opt => (
                  <Card
                    key={opt.value}
                    className={cn(
                      "cursor-pointer border-2 transition-all p-4 text-center",
                      form.idType === opt.value ? "border-primary bg-primary/5" : "hover:border-primary/30"
                    )}
                    onClick={() => setSelect("idType")(opt.value)}
                  >
                    <div className="text-2xl mb-2">{opt.icon}</div>
                    <p className="text-xs font-medium">{opt.label}</p>
                  </Card>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="idNumber">ID Number <span className="text-destructive">*</span></Label>
                <Input id="idNumber" value={form.idNumber} onChange={set("idNumber")} placeholder="Enter ID number" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="idExpiry">Expiry Date <span className="text-destructive">*</span></Label>
                <Input id="idExpiry" type="date" value={form.idExpiry} onChange={set("idExpiry")} className="h-11" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label htmlFor="addressLine1">Residential Address <span className="text-destructive">*</span></Label>
                <Input id="addressLine1" value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street address" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="addressCity">City <span className="text-destructive">*</span></Label>
                <Input id="addressCity" value={form.addressCity} onChange={set("addressCity")} className="h-11" />
              </div>
            </div>
          </div>
        </div>
      );
      case "documents": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Upload Documents</h2>
            <p className="text-sm text-muted-foreground">Upload clear photos or scans of your documents. Max 10MB per file.</p>
          </div>
          {userId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DocumentUploader label="ID Document — Front" documentType="id_front" userId={userId} folder="kyc" required description="Passport, National ID, or Driver's License" onUploadComplete={setDoc("idFront")} onRemove={clearDoc("idFront")} />
              <DocumentUploader label="ID Document — Back" documentType="id_back" userId={userId} folder="kyc" description="Required for National ID cards" onUploadComplete={setDoc("idBack")} onRemove={clearDoc("idBack")} />
              <DocumentUploader label="Selfie / Liveness Photo" documentType="selfie" userId={userId} folder="kyc" required accept="image/jpeg,image/png,image/webp" description="Clear photo of your face" onUploadComplete={setDoc("selfie")} onRemove={clearDoc("selfie")} />
              <DocumentUploader label="Proof of Address" documentType="proof_of_address" userId={userId} folder="kyc" required description="Utility bill or bank statement (< 3 months)" onUploadComplete={setDoc("proofOfAddress")} onRemove={clearDoc("proofOfAddress")} />
            </div>
          )}
        </div>
      );
      case "enhanced": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Enhanced Due Diligence</h2>
            <p className="text-sm text-muted-foreground">Required for higher transaction limits (up to 10,000,000 XAF/day).</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>Source of Funds</Label>
              <Select value={form.sourceOfFunds} onValueChange={setSelect("sourceOfFunds")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select source" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="salary">Salary / Employment</SelectItem>
                  <SelectItem value="business">Business Income</SelectItem>
                  <SelectItem value="investment">Investment Returns</SelectItem>
                  <SelectItem value="inheritance">Inheritance</SelectItem>
                  <SelectItem value="savings">Personal Savings</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input id="occupation" value={form.occupation} onChange={set("occupation")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="employerName">Employer Name</Label>
              <Input id="employerName" value={form.employerName} onChange={set("employerName")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Annual Income Range</Label>
              <Select value={form.annualIncome} onValueChange={setSelect("annualIncome")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-5m">Below 5M XAF</SelectItem>
                  <SelectItem value="5m-25m">5M – 25M XAF</SelectItem>
                  <SelectItem value="25m-100m">25M – 100M XAF</SelectItem>
                  <SelectItem value="100m+">Above 100M XAF</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Purpose of Account</Label>
              <Select value={form.purposeOfAccount} onValueChange={setSelect("purposeOfAccount")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select purpose" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="personal_payments">Personal Payments</SelectItem>
                  <SelectItem value="business_payments">Business Payments</SelectItem>
                  <SelectItem value="remittances">Remittances</SelectItem>
                  <SelectItem value="savings">Savings</SelectItem>
                  <SelectItem value="trading">Trading / Investment</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="taxId">Tax ID (NIU)</Label>
              <Input id="taxId" value={form.taxId} onChange={set("taxId")} placeholder="Optional" className="h-11" />
            </div>
          </div>
        </div>
      );
      case "declarations": return renderDeclarations();
      default: return null;
    }
  };

  const renderBusinessStep = () => {
    const currentId = businessSteps[step]?.id;
    switch (currentId) {
      case "type": return null;
      case "business-info": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Business Details</h2>
            <p className="text-sm text-muted-foreground">Provide your registered business information.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessName">Registered Business Name <span className="text-destructive">*</span></Label>
              <Input id="businessName" value={form.businessName} onChange={set("businessName")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Business Type <span className="text-destructive">*</span></Label>
              <Select value={form.businessType} onValueChange={setSelect("businessType")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sa">Société Anonyme (SA)</SelectItem>
                  <SelectItem value="sarl">SARL</SelectItem>
                  <SelectItem value="sas">SAS</SelectItem>
                  <SelectItem value="gie">GIE</SelectItem>
                  <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                  <SelectItem value="ngo">NGO / Association</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="registrationNumber">RCCM / Registration Number <span className="text-destructive">*</span></Label>
              <Input id="registrationNumber" value={form.registrationNumber} onChange={set("registrationNumber")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Country <span className="text-destructive">*</span></Label>
              <Select value={form.registrationCountry} onValueChange={setSelect("registrationCountry")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select country" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CM">Cameroon</SelectItem>
                  <SelectItem value="GA">Gabon</SelectItem>
                  <SelectItem value="CG">Congo</SelectItem>
                  <SelectItem value="TD">Chad</SelectItem>
                  <SelectItem value="CF">Central African Republic</SelectItem>
                  <SelectItem value="GQ">Equatorial Guinea</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Industry <span className="text-destructive">*</span></Label>
              <Select value={form.industry} onValueChange={setSelect("industry")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fintech">Fintech / Financial Services</SelectItem>
                  <SelectItem value="retail">Retail / E-Commerce</SelectItem>
                  <SelectItem value="telecom">Telecommunications</SelectItem>
                  <SelectItem value="agriculture">Agriculture</SelectItem>
                  <SelectItem value="healthcare">Healthcare</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Annual Turnover</Label>
              <Select value={form.annualTurnover} onValueChange={setSelect("annualTurnover")}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select range" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-50m">Below 50M XAF</SelectItem>
                  <SelectItem value="50m-500m">50M – 500M XAF</SelectItem>
                  <SelectItem value="500m-5b">500M – 5B XAF</SelectItem>
                  <SelectItem value="5b+">Above 5B XAF</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      );
      case "business-address": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Business Address & Description</h2>
            <p className="text-sm text-muted-foreground">Provide your registered business address.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="addressLine1">Street Address <span className="text-destructive">*</span></Label>
              <Input id="addressLine1" value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street address" className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCity">City <span className="text-destructive">*</span></Label>
              <Input id="addressCity" value={form.addressCity} onChange={set("addressCity")} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="addressCountry">Country</Label>
              <Input id="addressCountry" value={form.registrationCountry || "CM"} readOnly className="h-11 bg-muted" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="businessDescription">Business Description <span className="text-destructive">*</span></Label>
              <Textarea id="businessDescription" value={form.businessDescription} onChange={set("businessDescription")} placeholder="Describe your business activities, products/services, and target market" rows={4} />
            </div>
          </div>
        </div>
      );
      case "business-docs": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Upload Business Documents</h2>
            <p className="text-sm text-muted-foreground">Upload official business documents. Max 10MB per file.</p>
          </div>
          {userId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DocumentUploader label="Registration Certificate (RCCM)" documentType="registration_certificate" userId={userId} folder="kyb" required description="Official business registration certificate" onUploadComplete={setDoc("registrationCertificate")} onRemove={clearDoc("registrationCertificate")} />
              <DocumentUploader label="Articles of Association" documentType="articles_of_association" userId={userId} folder="kyb" required description="Company bylaws or statutes" onUploadComplete={setDoc("articlesOfAssociation")} onRemove={clearDoc("articlesOfAssociation")} />
              <DocumentUploader label="Tax Certificate / Patente" documentType="tax_certificate" userId={userId} folder="kyb" description="Tax registration (optional)" onUploadComplete={setDoc("taxCertificate")} onRemove={clearDoc("taxCertificate")} />
              <DocumentUploader label="Proof of Business Address" documentType="business_proof_of_address" userId={userId} folder="kyb" required description="Utility bill or lease" onUploadComplete={setDoc("businessProofOfAddress")} onRemove={clearDoc("businessProofOfAddress")} />
              <DocumentUploader label="Bank Statement" documentType="bank_statement" userId={userId} folder="kyb" description="Latest 3 months (optional)" onUploadComplete={setDoc("bankStatement")} onRemove={clearDoc("bankStatement")} />
              <DocumentUploader label="Board Resolution" documentType="board_resolution" userId={userId} folder="kyb" description="For companies with boards (optional)" onUploadComplete={setDoc("boardResolution")} onRemove={clearDoc("boardResolution")} />
              <DocumentUploader label="UBO Declaration" documentType="ubo_declaration" userId={userId} folder="kyb" description="Beneficial ownership (optional)" onUploadComplete={setDoc("uboDeclaration")} onRemove={clearDoc("uboDeclaration")} />
            </div>
          )}
        </div>
      );
      case "declarations": return renderDeclarations();
      default: return null;
    }
  };

  const renderDeclarations = () => (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Declarations & Submit</h2>
        <p className="text-sm text-muted-foreground">Please review and confirm the following declarations.</p>
      </div>
      <div className="space-y-5">
        <Card className={cn("border-2 transition-all", form.pepDeclaration ? "border-primary/30 bg-primary/5" : "")}>
          <CardContent className="p-4 flex items-start gap-3">
            <Checkbox id="pep" checked={form.pepDeclaration} onCheckedChange={toggle("pepDeclaration")} className="mt-1" />
            <label htmlFor="pep" className="text-sm leading-relaxed cursor-pointer">
              I declare that I am <strong>not</strong> a Politically Exposed Person (PEP), nor a family member or close associate of a PEP, as defined by FATF Recommendation 12 and CEMAC AML Regulation Article 15.
            </label>
          </CardContent>
        </Card>
        <Card className={cn("border-2 transition-all", form.sanctionsDeclaration ? "border-primary/30 bg-primary/5" : "")}>
          <CardContent className="p-4 flex items-start gap-3">
            <Checkbox id="sanctions" checked={form.sanctionsDeclaration} onCheckedChange={toggle("sanctionsDeclaration")} className="mt-1" />
            <label htmlFor="sanctions" className="text-sm leading-relaxed cursor-pointer">
              I confirm that I am <strong>not</strong> subject to any sanctions imposed by the UN, EU, US OFAC, or any CEMAC member state.
            </label>
          </CardContent>
        </Card>
        <Card className={cn("border-2 transition-all", form.accuracyDeclaration ? "border-primary/30 bg-primary/5" : "")}>
          <CardContent className="p-4 flex items-start gap-3">
            <Checkbox id="accuracy" checked={form.accuracyDeclaration} onCheckedChange={toggle("accuracyDeclaration")} className="mt-1" />
            <label htmlFor="accuracy" className="text-sm leading-relaxed cursor-pointer">
              I declare that all information provided is <strong>true, accurate, and complete</strong>. I consent to identity verification through third-party services.
            </label>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const isLastStep = step === totalSteps - 1;

  // ─── FLOW LAYOUT ─────────────────────────
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={() => { setFlowType(null); setStep(0); }} className="text-muted-foreground">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div className="flex-1">
          <h1 className="text-lg font-semibold">{flowType === "individual" ? "Individual KYC" : "Business KYB"}</h1>
        </div>
        <Badge variant="outline" className="text-xs">Step {step + 1} of {totalSteps}</Badge>
      </div>

      {/* Progress */}
      <Progress value={progressPct} className="h-1.5 mb-6" />

      {/* Stepper */}
      <FlowStepper steps={steps} currentStep={step} />

      {/* Step Content */}
      <Card className="mt-6 border-0 shadow-lg">
        <CardContent className="p-6 md:p-8 min-h-[320px]">
          <AnimatePresence mode="wait" custom={direction}>
            <StepWrapper key={step} direction={direction}>
              {flowType === "individual" ? renderIndividualStep() : renderBusinessStep()}
            </StepWrapper>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={prev} disabled={step === 0} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Previous
        </Button>
        {isLastStep ? (
          <Button onClick={handleSubmit} disabled={submitting || !form.accuracyDeclaration} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {submitting ? "Submitting..." : "Submit Application"}
          </Button>
        ) : (
          <Button onClick={next} className="gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
