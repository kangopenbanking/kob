import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, UserCheck, Building2, CheckCircle, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { DocumentUploader } from "@/components/kyc/DocumentUploader";

interface FormState {
  fullName: string;
  dateOfBirth: string;
  nationality: string;
  phone: string;
  idType: string;
  idNumber: string;
  idExpiry: string;
  addressLine1: string;
  addressCity: string;
  addressCountry: string;
  sourceOfFunds: string;
  occupation: string;
  employerName: string;
  annualIncome: string;
  purposeOfAccount: string;
  taxId: string;
  businessName: string;
  businessType: string;
  registrationNumber: string;
  registrationCountry: string;
  industry: string;
  annualTurnover: string;
  businessDescription: string;
  pepDeclaration: boolean;
  sanctionsDeclaration: boolean;
  accuracyDeclaration: boolean;
}

const initial: FormState = {
  fullName: "", dateOfBirth: "", nationality: "", phone: "",
  idType: "", idNumber: "", idExpiry: "", addressLine1: "", addressCity: "", addressCountry: "",
  sourceOfFunds: "", occupation: "", employerName: "", annualIncome: "", purposeOfAccount: "", taxId: "",
  businessName: "", businessType: "", registrationNumber: "", registrationCountry: "", industry: "", annualTurnover: "", businessDescription: "",
  pepDeclaration: false, sanctionsDeclaration: false, accuracyDeclaration: false,
};

interface DocPaths {
  idFront: string;
  idBack: string;
  selfie: string;
  proofOfAddress: string;
  // KYB docs
  registrationCertificate: string;
  articlesOfAssociation: string;
  taxCertificate: string;
  businessProofOfAddress: string;
  bankStatement: string;
  boardResolution: string;
  uboDeclaration: string;
}

const initialDocs: DocPaths = {
  idFront: "", idBack: "", selfie: "", proofOfAddress: "",
  registrationCertificate: "", articlesOfAssociation: "", taxCertificate: "",
  businessProofOfAddress: "", bankStatement: "", boardResolution: "", uboDeclaration: "",
};

export default function KycDueDiligence() {
  const [form, setForm] = useState<FormState>(initial);
  const [docs, setDocs] = useState<DocPaths>(initialDocs);
  const [tab, setTab] = useState("individual");
  const [submitting, setSubmitting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user ID on mount
  useState(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  });

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

  const getPublicUrl = (path: string) => {
    if (!path) return "";
    const { data } = supabase.storage.from("kyc-documents").getPublicUrl(path);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.accuracyDeclaration) {
      toast.error("You must confirm the accuracy declaration before submitting.");
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error("You must be logged in to submit KYC.");
      return;
    }

    setSubmitting(true);

    try {
      if (tab === "individual") {
        // Validate required docs
        if (!docs.idFront) { toast.error("Please upload your ID document (front)."); setSubmitting(false); return; }
        if (!docs.selfie) { toast.error("Please upload a selfie photo."); setSubmitting(false); return; }
        if (!docs.proofOfAddress) { toast.error("Please upload proof of address."); setSubmitting(false); return; }

        const { data, error } = await supabase.functions.invoke("kyc-submit", {
          body: {
            verification_type: "identity",
            document_type: form.idType || "national_id",
            document_number: form.idNumber,
            document_country: form.nationality || "CM",
            document_expiry_date: form.idExpiry,
            document_front_url: getPublicUrl(docs.idFront),
            document_back_url: docs.idBack ? getPublicUrl(docs.idBack) : undefined,
            selfie_url: getPublicUrl(docs.selfie),
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("KYC verification submitted successfully. You will be notified once reviewed.");
      } else {
        // Business KYB
        if (!docs.registrationCertificate) { toast.error("Please upload registration certificate."); setSubmitting(false); return; }
        if (!docs.articlesOfAssociation) { toast.error("Please upload articles of association."); setSubmitting(false); return; }
        if (!docs.businessProofOfAddress) { toast.error("Please upload business proof of address."); setSubmitting(false); return; }

        const { data, error } = await supabase.functions.invoke("business-kyc-submit", {
          body: {
            business_name: form.businessName,
            registration_number: form.registrationNumber,
            business_type: form.businessType,
            industry: form.industry,
            business_address: {
              street: form.addressLine1,
              city: form.addressCity,
              country: form.registrationCountry || "CM",
            },
            business_description: form.businessDescription,
            annual_turnover: form.annualTurnover ? parseFloat(form.annualTurnover) : null,
            registration_certificate_url: getPublicUrl(docs.registrationCertificate),
            articles_of_association_url: getPublicUrl(docs.articlesOfAssociation),
            tax_certificate_url: docs.taxCertificate ? getPublicUrl(docs.taxCertificate) : null,
            proof_of_address_url: getPublicUrl(docs.businessProofOfAddress),
            bank_statement_url: docs.bankStatement ? getPublicUrl(docs.bankStatement) : null,
          },
        });

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        toast.success("Business KYB submitted successfully. You will be notified once reviewed.");
      }

      setForm(initial);
      setDocs(initialDocs);
    } catch (err: any) {
      toast.error(err.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">KYC / Customer Due Diligence</Badge>
        <h1 className="text-3xl font-bold mb-2">Know Your Customer Verification</h1>
        <p className="text-muted-foreground">Complete the applicable tier of verification to access Kang Open Banking services. Per CEMAC AML Regulation No. 01/03 and COBAC Instruction on CDD.</p>
      </div>

      {/* Tier Guide */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Shield className="h-4 w-4 text-primary" /> Tier 1 — Basic</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>≤ 100,000 XAF/day</p>
            <p>Name, DOB, phone verification</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><UserCheck className="h-4 w-4 text-primary" /> Tier 2 — Standard</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>≤ 1,000,000 XAF/day</p>
            <p>Government ID + proof of address</p>
          </CardContent>
        </Card>
        <Card className="border-primary/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /> Tier 3 / Business</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-1">
            <p>≤ 10,000,000 XAF/day</p>
            <p>Source of funds + EDD / KYB</p>
          </CardContent>
        </Card>
      </div>

      <form onSubmit={handleSubmit}>
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="individual">Individual KYC</TabsTrigger>
            <TabsTrigger value="business">Business KYB</TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="space-y-6 mt-6">
            {/* Tier 1 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tier 1 — Basic Information</CardTitle>
                <CardDescription>Required for all users</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Legal Name *</Label>
                  <Input id="fullName" value={form.fullName} onChange={set("fullName")} placeholder="As it appears on your ID" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth *</Label>
                  <Input id="dateOfBirth" type="date" value={form.dateOfBirth} onChange={set("dateOfBirth")} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nationality">Nationality *</Label>
                  <Select value={form.nationality} onValueChange={setSelect("nationality")}>
                    <SelectTrigger><SelectValue placeholder="Select nationality" /></SelectTrigger>
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
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input id="phone" type="tel" value={form.phone} onChange={set("phone")} placeholder="+237 6XX XXX XXX" required />
                </div>
              </CardContent>
            </Card>

            {/* Tier 2 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tier 2 — Identity Verification</CardTitle>
                <CardDescription>Required for transactions up to 1,000,000 XAF/day</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>ID Document Type *</Label>
                    <Select value={form.idType} onValueChange={setSelect("idType")}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="national_id">National ID Card (CNI)</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="drivers_license">Driver's License</SelectItem>
                        <SelectItem value="residence_permit">Residence Permit</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idNumber">ID Number *</Label>
                    <Input id="idNumber" value={form.idNumber} onChange={set("idNumber")} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="idExpiry">Expiry Date *</Label>
                    <Input id="idExpiry" type="date" value={form.idExpiry} onChange={set("idExpiry")} />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="addressLine1">Residential Address *</Label>
                    <Input id="addressLine1" value={form.addressLine1} onChange={set("addressLine1")} placeholder="Street address" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="addressCity">City *</Label>
                    <Input id="addressCity" value={form.addressCity} onChange={set("addressCity")} />
                  </div>
                </div>

                {/* Document Upload Section */}
                {userId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <DocumentUploader
                      label="ID Document — Front"
                      documentType="id_front"
                      userId={userId}
                      folder="kyc"
                      required
                      description="Passport, National ID, or Driver's License"
                      onUploadComplete={setDoc("idFront")}
                      onRemove={clearDoc("idFront")}
                    />
                    <DocumentUploader
                      label="ID Document — Back"
                      documentType="id_back"
                      userId={userId}
                      folder="kyc"
                      description="Required for National ID cards"
                      onUploadComplete={setDoc("idBack")}
                      onRemove={clearDoc("idBack")}
                    />
                    <DocumentUploader
                      label="Selfie / Liveness Photo"
                      documentType="selfie"
                      userId={userId}
                      folder="kyc"
                      required
                      accept="image/jpeg,image/png,image/webp"
                      description="Clear photo of your face for identity verification"
                      onUploadComplete={setDoc("selfie")}
                      onRemove={clearDoc("selfie")}
                    />
                    <DocumentUploader
                      label="Proof of Address"
                      documentType="proof_of_address"
                      userId={userId}
                      folder="kyc"
                      required
                      description="Utility bill or bank statement (less than 3 months old)"
                      onUploadComplete={setDoc("proofOfAddress")}
                      onRemove={clearDoc("proofOfAddress")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Tier 3 — Enhanced */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tier 3 — Enhanced Due Diligence</CardTitle>
                <CardDescription>Required for transactions up to 10,000,000 XAF/day or high-risk profiles</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Source of Funds *</Label>
                  <Select value={form.sourceOfFunds} onValueChange={setSelect("sourceOfFunds")}>
                    <SelectTrigger><SelectValue placeholder="Select source" /></SelectTrigger>
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
                  <Label htmlFor="occupation">Occupation *</Label>
                  <Input id="occupation" value={form.occupation} onChange={set("occupation")} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="employerName">Employer Name</Label>
                  <Input id="employerName" value={form.employerName} onChange={set("employerName")} />
                </div>
                <div className="space-y-2">
                  <Label>Annual Income Range</Label>
                  <Select value={form.annualIncome} onValueChange={setSelect("annualIncome")}>
                    <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0-5m">Below 5,000,000 XAF</SelectItem>
                      <SelectItem value="5m-25m">5,000,000 – 25,000,000 XAF</SelectItem>
                      <SelectItem value="25m-100m">25,000,000 – 100,000,000 XAF</SelectItem>
                      <SelectItem value="100m+">Above 100,000,000 XAF</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Purpose of Account *</Label>
                  <Select value={form.purposeOfAccount} onValueChange={setSelect("purposeOfAccount")}>
                    <SelectTrigger><SelectValue placeholder="Select purpose" /></SelectTrigger>
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
                  <Input id="taxId" value={form.taxId} onChange={set("taxId")} placeholder="Optional" />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Business KYB — Know Your Business</CardTitle>
                <CardDescription>Required for all business/merchant accounts per COBAC Regulation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Registered Business Name *</Label>
                    <Input id="businessName" value={form.businessName} onChange={set("businessName")} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Business Type *</Label>
                    <Select value={form.businessType} onValueChange={setSelect("businessType")}>
                      <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
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
                    <Label htmlFor="registrationNumber">RCCM / Registration Number *</Label>
                    <Input id="registrationNumber" value={form.registrationNumber} onChange={set("registrationNumber")} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Country of Registration *</Label>
                    <Select value={form.registrationCountry} onValueChange={setSelect("registrationCountry")}>
                      <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
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
                    <Label>Industry *</Label>
                    <Select value={form.industry} onValueChange={setSelect("industry")}>
                      <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
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
                      <SelectTrigger><SelectValue placeholder="Select range" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0-50m">Below 50M XAF</SelectItem>
                        <SelectItem value="50m-500m">50M – 500M XAF</SelectItem>
                        <SelectItem value="500m-5b">500M – 5B XAF</SelectItem>
                        <SelectItem value="5b+">Above 5B XAF</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="businessDescription">Business Description *</Label>
                  <Textarea id="businessDescription" value={form.businessDescription} onChange={set("businessDescription")} placeholder="Describe your business activities, products/services, and target market" rows={3} />
                </div>

                {/* Business Document Uploads */}
                {userId && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <DocumentUploader
                      label="Registration Certificate (RCCM)"
                      documentType="registration_certificate"
                      userId={userId}
                      folder="kyb"
                      required
                      description="Official business registration certificate"
                      onUploadComplete={setDoc("registrationCertificate")}
                      onRemove={clearDoc("registrationCertificate")}
                    />
                    <DocumentUploader
                      label="Articles of Association / Statutes"
                      documentType="articles_of_association"
                      userId={userId}
                      folder="kyb"
                      required
                      description="Company bylaws or statutes"
                      onUploadComplete={setDoc("articlesOfAssociation")}
                      onRemove={clearDoc("articlesOfAssociation")}
                    />
                    <DocumentUploader
                      label="Tax Certificate / Patente"
                      documentType="tax_certificate"
                      userId={userId}
                      folder="kyb"
                      description="Current tax registration certificate (optional)"
                      onUploadComplete={setDoc("taxCertificate")}
                      onRemove={clearDoc("taxCertificate")}
                    />
                    <DocumentUploader
                      label="Proof of Business Address"
                      documentType="business_proof_of_address"
                      userId={userId}
                      folder="kyb"
                      required
                      description="Utility bill or lease agreement"
                      onUploadComplete={setDoc("businessProofOfAddress")}
                      onRemove={clearDoc("businessProofOfAddress")}
                    />
                    <DocumentUploader
                      label="Bank Statement"
                      documentType="bank_statement"
                      userId={userId}
                      folder="kyb"
                      description="Latest 3 months (optional)"
                      onUploadComplete={setDoc("bankStatement")}
                      onRemove={clearDoc("bankStatement")}
                    />
                    <DocumentUploader
                      label="Board Resolution"
                      documentType="board_resolution"
                      userId={userId}
                      folder="kyb"
                      description="For companies with boards (optional)"
                      onUploadComplete={setDoc("boardResolution")}
                      onRemove={clearDoc("boardResolution")}
                    />
                    <DocumentUploader
                      label="UBO Declaration Document"
                      documentType="ubo_declaration"
                      userId={userId}
                      folder="kyb"
                      description="Beneficial ownership declaration (optional)"
                      onUploadComplete={setDoc("uboDeclaration")}
                      onRemove={clearDoc("uboDeclaration")}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Declarations */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Declarations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox id="pep" checked={form.pepDeclaration} onCheckedChange={toggle("pepDeclaration")} />
              <label htmlFor="pep" className="text-sm leading-relaxed cursor-pointer">
                I declare that I am <strong>not</strong> a Politically Exposed Person (PEP), nor a family member or close associate of a PEP, as defined by FATF Recommendation 12 and CEMAC AML Regulation Article 15. If my PEP status changes, I will notify Kang Open Banking immediately.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="sanctions" checked={form.sanctionsDeclaration} onCheckedChange={toggle("sanctionsDeclaration")} />
              <label htmlFor="sanctions" className="text-sm leading-relaxed cursor-pointer">
                I confirm that I am <strong>not</strong> subject to any sanctions imposed by the United Nations, European Union, US OFAC, or any CEMAC member state, and I am not acting on behalf of any sanctioned person or entity.
              </label>
            </div>
            <div className="flex items-start gap-3">
              <Checkbox id="accuracy" checked={form.accuracyDeclaration} onCheckedChange={toggle("accuracyDeclaration")} />
              <label htmlFor="accuracy" className="text-sm leading-relaxed cursor-pointer">
                I declare that all information provided in this form is <strong>true, accurate, and complete</strong>. I understand that providing false information may result in account termination and reporting to the relevant authorities. I consent to Kang Open Banking verifying my identity through third-party verification services.
              </label>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => { setForm(initial); setDocs(initialDocs); }}>Reset Form</Button>
          <Button type="submit" className="gap-2" disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            {submitting ? "Submitting..." : "Submit KYC Application"}
          </Button>
        </div>
      </form>
    </div>
  );
}
