import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { DocumentUploader } from "@/components/kyc/DocumentUploader";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Building2, MapPin, FileText, CheckCircle, ArrowRight, ArrowLeft, Loader2, Briefcase, DollarSign } from "lucide-react";

interface BusinessKYCFormProps {
  accountId: string | null;
  onSuccess: () => void;
  onCancel: () => void;
}

const steps = [
  { id: "business", label: "Business Info", icon: Building2 },
  { id: "address", label: "Address", icon: MapPin },
  { id: "financial", label: "Financial", icon: DollarSign },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "review", label: "Review & Submit", icon: CheckCircle },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 60 : -60, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -60 : 60, opacity: 0 }),
};

export const BusinessKYCForm = ({ accountId, onSuccess, onCancel }: BusinessKYCFormProps) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const [formData, setFormData] = useState({
    business_name: "", registration_number: "", business_type: "", industry: "",
    vat_number: "", tax_id: "", registration_date: "",
    street: "", city: "", state: "", postal_code: "", country: "CM",
    business_description: "", annual_turnover: "", number_of_employees: "",
  });
  const [docUrls, setDocUrls] = useState({
    registration_certificate: "", articles_of_association: "",
    tax_certificate: "", proof_of_address: "", bank_statement: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);


  const next = useCallback(() => { setDirection(1); setStep(s => Math.min(s + 1, steps.length - 1)); }, []);
  const prev = useCallback(() => { setDirection(-1); setStep(s => Math.max(s - 1, 0)); }, []);
  const progressPct = ((step + 1) / steps.length) * 100;
  const isLast = step === steps.length - 1;

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { submitBusinessKyb } = await import('@/lib/kycGateway');
      const data = await submitBusinessKyb({
        account_id: accountId,
        business_name: formData.business_name,
        registration_number: formData.registration_number,
        business_type: formData.business_type,
        industry: formData.industry,
        vat_number: formData.vat_number || null,
        tax_id: formData.tax_id || null,
        registration_date: formData.registration_date || null,
        business_address: { street: formData.street, city: formData.city, state: formData.state, postal_code: formData.postal_code, country: formData.country },
        business_description: formData.business_description,
        annual_turnover: formData.annual_turnover ? parseFloat(formData.annual_turnover) : null,
        number_of_employees: formData.number_of_employees ? parseInt(formData.number_of_employees) : null,
        registration_certificate_url: docUrls.registration_certificate || null,
        articles_of_association_url: docUrls.articles_of_association || null,
        tax_certificate_url: docUrls.tax_certificate || null,
        proof_of_address_url: docUrls.proof_of_address || null,
        bank_statement_url: docUrls.bank_statement || null,
      });
      toast({ title: "Success", description: "Business KYC submitted for verification" });
      onSuccess();
    } catch (error: any) {
      toast({ title: "Submission Failed", description: error.message || "Failed to submit.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (steps[step].id) {
      case "business": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Business Information</h2>
            <p className="text-sm text-muted-foreground">Provide your registered business details.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <Label>Business Name <span className="text-destructive">*</span></Label>
              <Input value={formData.business_name} onChange={(e) => setFormData({ ...formData, business_name: e.target.value })} className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label>Registration Number <span className="text-destructive">*</span></Label>
              <Input value={formData.registration_number} onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })} className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label>Registration Date</Label>
              <Input type="date" value={formData.registration_date} onChange={(e) => setFormData({ ...formData, registration_date: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Business Type <span className="text-destructive">*</span></Label>
              <Select value={formData.business_type} onValueChange={(v) => setFormData({ ...formData, business_type: v })}>
                <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sole_proprietorship">Sole Proprietorship</SelectItem>
                  <SelectItem value="partnership">Partnership</SelectItem>
                  <SelectItem value="limited_company">Limited Company</SelectItem>
                  <SelectItem value="cooperative">Cooperative</SelectItem>
                  <SelectItem value="ngo">NGO</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Industry <span className="text-destructive">*</span></Label>
              <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} placeholder="e.g., Technology, Retail" className="h-11" required />
            </div>
          </div>
        </div>
      );
      case "address": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Business Address</h2>
            <p className="text-sm text-muted-foreground">Registered business address details.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2 md:col-span-2">
              <Label>Street Address <span className="text-destructive">*</span></Label>
              <Input value={formData.street} onChange={(e) => setFormData({ ...formData, street: e.target.value })} placeholder="Street address" className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label>City <span className="text-destructive">*</span></Label>
              <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} className="h-11" required />
            </div>
            <div className="space-y-2">
              <Label>State/Region</Label>
              <Input value={formData.state} onChange={(e) => setFormData({ ...formData, state: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Postal Code</Label>
              <Input value={formData.postal_code} onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <Input value={formData.country} readOnly className="h-11 bg-muted" />
            </div>
          </div>
        </div>
      );
      case "financial": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Financial & Tax Details</h2>
            <p className="text-sm text-muted-foreground">Optional financial information for your business.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <Label>VAT Number</Label>
              <Input value={formData.vat_number} onChange={(e) => setFormData({ ...formData, vat_number: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Tax ID</Label>
              <Input value={formData.tax_id} onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Annual Turnover (XAF)</Label>
              <Input type="number" value={formData.annual_turnover} onChange={(e) => setFormData({ ...formData, annual_turnover: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2">
              <Label>Number of Employees</Label>
              <Input type="number" value={formData.number_of_employees} onChange={(e) => setFormData({ ...formData, number_of_employees: e.target.value })} className="h-11" />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Business Description</Label>
              <Textarea value={formData.business_description} onChange={(e) => setFormData({ ...formData, business_description: e.target.value })} placeholder="Describe your business activities" rows={4} />
            </div>
          </div>
        </div>
      );
      case "documents": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Upload Business Documents</h2>
            <p className="text-sm text-muted-foreground">Upload official documents. Max 10MB per file.</p>
          </div>
          {userId && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <DocumentUploader label="Registration Certificate (RCCM)" documentType="registration_certificate" userId={userId} folder="kyb" required description="Official registration document" onUploadComplete={(p) => setDocUrls(d => ({ ...d, registration_certificate: p }))} onRemove={() => setDocUrls(d => ({ ...d, registration_certificate: "" }))} />
              <DocumentUploader label="Articles of Association" documentType="articles_of_association" userId={userId} folder="kyb" required description="Company bylaws or statutes" onUploadComplete={(p) => setDocUrls(d => ({ ...d, articles_of_association: p }))} onRemove={() => setDocUrls(d => ({ ...d, articles_of_association: "" }))} />
              <DocumentUploader label="Tax Certificate / Patente" documentType="tax_certificate" userId={userId} folder="kyb" description="Tax registration (optional)" onUploadComplete={(p) => setDocUrls(d => ({ ...d, tax_certificate: p }))} onRemove={() => setDocUrls(d => ({ ...d, tax_certificate: "" }))} />
              <DocumentUploader label="Proof of Business Address" documentType="proof_of_address" userId={userId} folder="kyb" required description="Utility bill or lease" onUploadComplete={(p) => setDocUrls(d => ({ ...d, proof_of_address: p }))} onRemove={() => setDocUrls(d => ({ ...d, proof_of_address: "" }))} />
              <DocumentUploader label="Bank Statement" documentType="bank_statement" userId={userId} folder="kyb" description="Latest 3 months (optional)" onUploadComplete={(p) => setDocUrls(d => ({ ...d, bank_statement: p }))} onRemove={() => setDocUrls(d => ({ ...d, bank_statement: "" }))} />
            </div>
          )}
        </div>
      );
      case "review": return (
        <div className="space-y-6">
          <div>
            <h2 className="text-xl font-semibold mb-1">Review & Submit</h2>
            <p className="text-sm text-muted-foreground">Review your information before submitting.</p>
          </div>
          <div className="space-y-4">
            <ReviewSection title="Business" items={[
              ["Name", formData.business_name],
              ["Registration #", formData.registration_number],
              ["Type", formData.business_type],
              ["Industry", formData.industry],
            ]} />
            <ReviewSection title="Address" items={[
              ["Street", formData.street],
              ["City", formData.city],
              ["Country", formData.country],
            ]} />
            <ReviewSection title="Documents" items={[
              ["Registration Certificate", docUrls.registration_certificate ? "✓ Uploaded" : "✗ Missing"],
              ["Articles of Association", docUrls.articles_of_association ? "✓ Uploaded" : "✗ Missing"],
              ["Proof of Address", docUrls.proof_of_address ? "✓ Uploaded" : "✗ Missing"],
            ]} />
          </div>
        </div>
      );
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Progress */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">Step {step + 1} of {steps.length}</span>
        <Badge variant="outline" className="text-xs">{steps[step].label}</Badge>
      </div>
      <Progress value={progressPct} className="h-1.5" />

      {/* Stepper pills */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {steps.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.id} className="flex items-center">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap",
                isActive && "bg-primary text-primary-foreground shadow-sm",
                isDone && "bg-primary/10 text-primary",
                !isActive && !isDone && "bg-muted text-muted-foreground"
              )}>
                {isDone ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </div>
              {i < steps.length - 1 && <div className={cn("w-4 h-0.5 mx-0.5", i < step ? "bg-primary" : "bg-muted")} />}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      <Card className="border-0 shadow-lg">
        <CardContent className="p-6 md:p-8 min-h-[280px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <div className="flex gap-2">
          {step > 0 ? (
            <Button variant="outline" onClick={prev} className="gap-2">
              <ArrowLeft className="h-4 w-4" /> Previous
            </Button>
          ) : (
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          )}
        </div>
        {isLast ? (
          <Button onClick={handleSubmit} disabled={loading} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {loading ? "Submitting..." : "Submit for Verification"}
          </Button>
        ) : (
          <Button onClick={next} className="gap-2">
            Next <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};

// ─── Review Section Helper ──────────────────
function ReviewSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <h4 className="text-sm font-semibold mb-2">{title}</h4>
        <div className="grid gap-1.5">
          {items.map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className={cn("font-medium", value?.startsWith("✗") && "text-destructive", value?.startsWith("✓") && "text-primary")}>{value || "—"}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
