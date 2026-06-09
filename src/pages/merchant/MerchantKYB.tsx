import { useEffect, useState, useCallback } from "react";
import { EmptyState } from '@/components/ui/empty-state';
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Loader2, CheckCircle2, Clock, XCircle, AlertCircle,
  Upload, FileText, Building2, User, MapPin, ShieldCheck,
  ChevronLeft, ChevronRight, Check, Eye
} from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { DocumentUploader } from "@/components/kyc/DocumentUploader";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

const statusConfig: Record<string, { icon: any; color: string; label: string; description: string }> = {
  not_submitted: { icon: Clock, color: "text-muted-foreground", label: "Not Submitted", description: "Submit your business documents to begin verification" },
  draft: { icon: Clock, color: "text-muted-foreground", label: "Draft", description: "Complete and submit your KYB application" },
  submitted: { icon: Clock, color: "text-blue-500", label: "Submitted", description: "Your documents are awaiting review by our compliance team" },
  under_review: { icon: AlertCircle, color: "text-amber-500", label: "Under Review", description: "Our team is reviewing your business documents" },
  verified: { icon: CheckCircle2, color: "text-green-500", label: "Verified", description: "Your business has been verified. You can now accept live payments." },
  approved: { icon: CheckCircle2, color: "text-green-500", label: "Approved", description: "Your KYB application has been approved." },
  active: { icon: CheckCircle2, color: "text-green-500", label: "Active", description: "Your account is fully active and processing live payments" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected", description: "Your KYB application was not approved. You may resubmit with corrections." },
  suspended: { icon: XCircle, color: "text-destructive", label: "Suspended", description: "Your account has been suspended. Contact support." },
};

const steps = [
  { id: 0, label: "Business Info", icon: Building2 },
  { id: 1, label: "Director Details", icon: User },
  { id: 2, label: "Address", icon: MapPin },
  { id: 3, label: "Documents", icon: Upload },
  { id: 4, label: "Review & Submit", icon: ShieldCheck },
];

const slideVariants = {
  enter: (d: number) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (d: number) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
};

export default function MerchantKYB() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [userId, setUserId] = useState("");

  const [form, setForm] = useState({
    registration_number: "",
    tax_id: "",
    business_address: "",
    director_name: "",
    director_id_number: "",
    additional_notes: "",
  });

  const [docs, setDocs] = useState({
    registration_certificate: "",
    tax_certificate: "",
    proof_of_address: "",
    director_id_document: "",
    bank_statement: "",
    articles_of_association: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    if (data) {
      setMerchant(data);
      const meta = (data.metadata as any) || {};
      const kyb = meta.kyb_submission || {};
      setForm({
        registration_number: kyb.registration_number || "",
        tax_id: kyb.tax_id || "",
        business_address: kyb.business_address || "",
        director_name: kyb.director_name || "",
        director_id_number: kyb.director_id_number || "",
        additional_notes: kyb.additional_notes || "",
      });
      setDocs({
        registration_certificate: kyb.registration_certificate_url || "",
        tax_certificate: kyb.tax_certificate_url || "",
        proof_of_address: kyb.proof_of_address_url || "",
        director_id_document: kyb.director_id_document_url || "",
        bank_statement: kyb.bank_statement_url || "",
        articles_of_association: kyb.articles_of_association_url || "",
      });
    }
    setLoading(false);
  };

  const goTo = (s: number) => {
    setDirection(s > step ? 1 : -1);
    setStep(s);
  };

  const next = () => { if (step < steps.length - 1) goTo(step + 1); };
  const prev = () => { if (step > 0) goTo(step - 1); };

  const progressPct = ((step + 1) / steps.length) * 100;

  const handleSaveDraft = async () => {
    if (!merchant) return;
    setSubmitting(true);
    try {
      const meta = (merchant.metadata as any) || {};
      const { error } = await supabase.from("gateway_merchants").update({
        metadata: {
          ...meta,
          kyb_submission: {
            ...form,
            registration_certificate_url: docs.registration_certificate,
            tax_certificate_url: docs.tax_certificate,
            proof_of_address_url: docs.proof_of_address,
            director_id_document_url: docs.director_id_document,
            bank_statement_url: docs.bank_statement,
            articles_of_association_url: docs.articles_of_association,
            saved_at: new Date().toISOString(),
          },
        },
      }).eq("id", merchant.id);
      if (error) throw error;
      toast.success("Draft saved successfully");
      loadData();
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSubmitting(false); }
  };

  // Build server-validated documents[] payload from the uploaded storage
  // paths. The backend's validateKybDocuments() requires {type, url,
  // mime_type, size_bytes} per entry; without this the submission is
  // rejected as `invalid_documents`. We pull size + mime from Storage
  // metadata so the client doesn't have to track it after upload.
  const buildDocumentsPayload = async () => {
    const entries: Array<[string, string]> = [
      ["registration_certificate", docs.registration_certificate],
      ["tax_certificate", docs.tax_certificate],
      ["proof_of_address", docs.proof_of_address],
      ["director_id_document", docs.director_id_document],
      ["bank_statement", docs.bank_statement],
      ["articles_of_association", docs.articles_of_association],
    ].filter(([, path]) => !!path) as Array<[string, string]>;

    const guessMime = (path: string): string => {
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      if (ext === "pdf") return "application/pdf";
      if (ext === "png") return "image/png";
      if (ext === "webp") return "image/webp";
      if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
      return "application/octet-stream";
    };

    const out: Array<{ type: string; url: string; mime_type: string; size_bytes: number }> = [];
    for (const [type, path] of entries) {
      let size = 0;
      let mime = guessMime(path);
      try {
        const folder = path.includes("/") ? path.substring(0, path.lastIndexOf("/")) : "";
        const name = path.split("/").pop()!;
        const { data: list } = await supabase.storage.from("kyc-documents").list(folder, { search: name, limit: 1 });
        const meta = list?.[0]?.metadata as { size?: number; mimetype?: string } | undefined;
        if (meta?.size) size = Number(meta.size);
        if (meta?.mimetype) mime = String(meta.mimetype);
      } catch {
        // fall back to guessed mime / zero size — backend will reject if size==0
      }
      out.push({ type, url: path, mime_type: mime, size_bytes: size });
    }
    return out;
  };

  const handleSubmitKYB = async () => {
    if (!merchant) return;
    if (!form.registration_number || !form.business_address) {
      toast.error("Registration number and business address are required");
      return;
    }
    if (!docs.registration_certificate || !docs.proof_of_address) {
      toast.error("Registration Certificate and Proof of Address are required");
      return;
    }
    setSubmitting(true);
    try {
      const documents = await buildDocumentsPayload();
      const missingSize = documents.find((d) => !d.size_bytes);
      if (missingSize) {
        throw new Error(`Could not read file metadata for ${missingSize.type}. Please re-upload it.`);
      }
      const res = await supabase.functions.invoke("gateway-merchant-kyb", {
        body: {
          merchant_id: merchant.id,
          action: 'submit',
          documents,
          ...form,
          registration_certificate_url: docs.registration_certificate || null,
          articles_of_association_url: docs.articles_of_association || null,
          tax_certificate_url: docs.tax_certificate || null,
          proof_of_address_url: docs.proof_of_address || null,
          bank_statement_url: docs.bank_statement || null,
          director_id_document_url: docs.director_id_document || null,
        },
      });
      if (res.error) {
        throw new Error(res.error.message || 'Failed to submit KYB. Please try again.');
      }
      toast.success("KYB application submitted for review");
      loadData();
    } catch (err: any) { toast.error(extractEdgeFunctionError(err)); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <EmptyState icon={<ShieldCheck className="h-6 w-6 text-muted-foreground" />} title="No merchant account found" description="Set up your merchant account to begin KYB verification." />;

  const cfg = statusConfig[merchant.kyb_status] || statusConfig.not_submitted;
  const StatusIcon = cfg.icon;
  const canSubmit = ["not_submitted", "draft", "rejected"].includes(merchant.kyb_status);
  const meta = (merchant.metadata as any) || {};
  const reviewNotes = meta.kyb_review;

  // --- Status Card (always visible) ---
  const statusCard = (
    <Card className={cn(
      "border transition-colors",
      ["verified", "approved", "active"].includes(merchant.kyb_status) && "border-green-500/30 bg-green-50 dark:bg-green-950/10",
      merchant.kyb_status === "rejected" && "border-destructive/30 bg-destructive/5"
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className={cn("h-11 w-11 rounded-xl flex items-center justify-center", 
            ["verified","approved","active"].includes(merchant.kyb_status) ? "bg-green-500/10" : merchant.kyb_status === "rejected" ? "bg-destructive/10" : "bg-primary/10"
          )}>
            <StatusIcon className={cn("h-6 w-6", cfg.color)} />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{cfg.label}</CardTitle>
            <p className="text-sm text-muted-foreground mt-0.5">{cfg.description}</p>
          </div>
          <Badge variant={["verified", "approved", "active"].includes(merchant.kyb_status) ? "default" : "secondary"}>
            {merchant.kyb_status}
          </Badge>
        </div>
      </CardHeader>
      {reviewNotes && (
        <CardContent className="pt-0">
          <div className="rounded-lg bg-muted/50 p-3 text-sm">
            <p className="font-medium mb-1">Review Notes</p>
            <p className="text-muted-foreground">{reviewNotes.reason || "No additional notes"}</p>
            {reviewNotes.reviewed_at && <p className="text-xs text-muted-foreground mt-1">Reviewed: {new Date(reviewNotes.reviewed_at).toLocaleDateString()}</p>}
          </div>
        </CardContent>
      )}
    </Card>
  );

  // --- If not submittable, show read-only ---
  if (!canSubmit) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <div><h1 className="text-2xl font-bold">KYB Verification</h1><p className="text-muted-foreground">Know Your Business verification for live payments</p></div>
        {statusCard}
        {meta.kyb_submission && (
          <Card>
            <CardHeader><CardTitle className="text-base">Submitted Information</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 text-sm">
                <div><span className="text-muted-foreground">Registration #</span><p className="font-mono font-medium">{meta.kyb_submission.registration_number}</p></div>
                <div><span className="text-muted-foreground">Tax ID</span><p className="font-mono font-medium">{meta.kyb_submission.tax_id || "—"}</p></div>
                <div className="md:col-span-2"><span className="text-muted-foreground">Business Address</span><p className="font-medium">{meta.kyb_submission.business_address}</p></div>
                <div><span className="text-muted-foreground">Director</span><p className="font-medium">{meta.kyb_submission.director_name || "—"}</p></div>
                <div><span className="text-muted-foreground">Submitted</span><p className="font-medium">{meta.kyb_submission.submitted_at ? new Date(meta.kyb_submission.submitted_at).toLocaleDateString() : "—"}</p></div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // --- Multi-step wizard ---
  const renderStep = () => {
    switch (step) {
      case 0:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">Business Information</h3>
                <p className="text-sm text-muted-foreground">Provide your official business registration details</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Registration Number <span className="text-destructive">*</span></Label>
                <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} placeholder="e.g. RC-123456" />
              </div>
              <div className="space-y-2">
                <Label>Tax ID / TIN</Label>
                <Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="e.g. TIN-789012" />
              </div>
            </div>
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4">
                <div className="grid gap-3 md:grid-cols-2 text-sm">
                  <div><span className="text-muted-foreground">Business Name</span><p className="font-medium">{merchant.business_name}</p></div>
                  <div><span className="text-muted-foreground">Business Type</span><p className="font-medium">{(meta.business_type || "").replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "—"}</p></div>
                  <div><span className="text-muted-foreground">Email</span><p className="font-medium">{merchant.business_email || "—"}</p></div>
                  <div><span className="text-muted-foreground">Environment</span><p><Badge variant="secondary">{merchant.environment || "sandbox"}</Badge></p></div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 1:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><User className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">Director / Owner Details</h3>
                <p className="text-sm text-muted-foreground">Provide details about the primary business director or owner</p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Full Legal Name</Label>
                <Input value={form.director_name} onChange={e => setForm(f => ({ ...f, director_name: e.target.value }))} placeholder="As it appears on official documents" />
              </div>
              <div className="space-y-2">
                <Label>ID / Passport Number</Label>
                <Input value={form.director_id_number} onChange={e => setForm(f => ({ ...f, director_id_number: e.target.value }))} placeholder="National ID or passport number" />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><MapPin className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">Business Address</h3>
                <p className="text-sm text-muted-foreground">Provide your official registered business address</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Full Registered Address <span className="text-destructive">*</span></Label>
                <Textarea value={form.business_address} onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))} rows={3} placeholder="Street, City, Region, Country" />
              </div>
              <div className="space-y-2">
                <Label>Additional Notes</Label>
                <Textarea value={form.additional_notes} onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))} rows={2} placeholder="Any additional information for the review team" />
              </div>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Upload className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">Upload Documents</h3>
                <p className="text-sm text-muted-foreground">Upload your business verification documents. All files max 10MB.</p>
              </div>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <DocumentUploader
                label="Registration Certificate (RCCM)"
                documentType="registration_certificate"
                userId={userId}
                folder="kyb"
                required
                description="Official business registration certificate"
                onUploadComplete={(p) => setDocs(d => ({ ...d, registration_certificate: p }))}
                onRemove={() => setDocs(d => ({ ...d, registration_certificate: "" }))}
                existingPath={docs.registration_certificate || undefined}
              />
              <DocumentUploader
                label="Tax Certificate"
                documentType="tax_certificate"
                userId={userId}
                folder="kyb"
                description="Tax registration or clearance certificate"
                onUploadComplete={(p) => setDocs(d => ({ ...d, tax_certificate: p }))}
                onRemove={() => setDocs(d => ({ ...d, tax_certificate: "" }))}
                existingPath={docs.tax_certificate || undefined}
              />
              <DocumentUploader
                label="Proof of Address"
                documentType="proof_of_address"
                userId={userId}
                folder="kyb"
                required
                description="Utility bill or bank statement (< 3 months)"
                onUploadComplete={(p) => setDocs(d => ({ ...d, proof_of_address: p }))}
                onRemove={() => setDocs(d => ({ ...d, proof_of_address: "" }))}
                existingPath={docs.proof_of_address || undefined}
              />
              <DocumentUploader
                label="Director ID Document"
                documentType="director_id"
                userId={userId}
                folder="kyb"
                description="National ID card or passport of director"
                onUploadComplete={(p) => setDocs(d => ({ ...d, director_id_document: p }))}
                onRemove={() => setDocs(d => ({ ...d, director_id_document: "" }))}
                existingPath={docs.director_id_document || undefined}
              />
              <DocumentUploader
                label="Bank Statement"
                documentType="bank_statement"
                userId={userId}
                folder="kyb"
                description="Recent business bank statement"
                onUploadComplete={(p) => setDocs(d => ({ ...d, bank_statement: p }))}
                onRemove={() => setDocs(d => ({ ...d, bank_statement: "" }))}
                existingPath={docs.bank_statement || undefined}
              />
              <DocumentUploader
                label="Articles of Association"
                documentType="articles_of_association"
                userId={userId}
                folder="kyb"
                description="Company articles or memorandum of association"
                onUploadComplete={(p) => setDocs(d => ({ ...d, articles_of_association: p }))}
                onRemove={() => setDocs(d => ({ ...d, articles_of_association: "" }))}
                existingPath={docs.articles_of_association || undefined}
              />
            </div>
          </div>
        );

      case 4:
        const docEntries = [
          { label: "Registration Certificate", val: docs.registration_certificate },
          { label: "Tax Certificate", val: docs.tax_certificate },
          { label: "Proof of Address", val: docs.proof_of_address },
          { label: "Director ID", val: docs.director_id_document },
          { label: "Bank Statement", val: docs.bank_statement },
          { label: "Articles of Association", val: docs.articles_of_association },
        ];
        return (
          <div className="space-y-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center"><Eye className="h-5 w-5 text-primary" /></div>
              <div>
                <h3 className="font-semibold">Review & Submit</h3>
                <p className="text-sm text-muted-foreground">Verify your information before submitting</p>
              </div>
            </div>

            <Card className="bg-muted/20">
              <CardContent className="p-4 space-y-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Business Details</p>
                  <div className="grid gap-3 md:grid-cols-2 text-sm">
                    <div><span className="text-muted-foreground">Business Name</span><p className="font-medium">{merchant.business_name}</p></div>
                    <div><span className="text-muted-foreground">Registration #</span><p className="font-mono font-medium">{form.registration_number || "—"}</p></div>
                    <div><span className="text-muted-foreground">Tax ID</span><p className="font-mono font-medium">{form.tax_id || "—"}</p></div>
                    <div><span className="text-muted-foreground">Director</span><p className="font-medium">{form.director_name || "—"}</p></div>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Address</p>
                  <p className="text-sm">{form.business_address || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Documents ({docEntries.filter(d => d.val).length}/{docEntries.length})</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {docEntries.map(d => (
                      <div key={d.label} className="flex items-center gap-2 text-sm">
                        {d.val ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" /> : <Clock className="h-4 w-4 text-muted-foreground shrink-0" />}
                        <span className={d.val ? "text-foreground" : "text-muted-foreground"}>{d.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {form.additional_notes && (
              <Card className="bg-muted/20">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm">{form.additional_notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div><h1 className="text-2xl font-bold">KYB Verification</h1><p className="text-muted-foreground">Know Your Business verification for live payments</p></div>

      {statusCard}

      {/* Progress */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Step {step + 1} of {steps.length}</span>
          <span className="font-medium">{Math.round(progressPct)}%</span>
        </div>
        <Progress value={progressPct} className="h-2" />

        {/* Step pills */}
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {steps.map((s) => {
            const StepIcon = s.icon;
            const isCompleted = s.id < step;
            const isCurrent = s.id === step;
            return (
              <button
                key={s.id}
                onClick={() => goTo(s.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  isCurrent && "bg-primary text-primary-foreground shadow-sm",
                  isCompleted && !isCurrent && "bg-primary/10 text-primary",
                  !isCurrent && !isCompleted && "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {isCompleted ? <Check className="h-3 w-3" /> : <StepIcon className="h-3 w-3" />}
                <span className="hidden sm:inline">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Animated step content */}
      <Card>
        <CardContent className="p-6">
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
      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={prev} disabled={step === 0} className="gap-1.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <Button variant="outline" onClick={handleSaveDraft} disabled={submitting} className="gap-1.5">
          Save Draft
        </Button>
        <div className="flex-1" />
        {step < steps.length - 1 ? (
          <Button onClick={next} className="gap-1.5">
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmitKYB} disabled={submitting} className="gap-1.5">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Submit KYB Application
          </Button>
        )}
      </div>
      <p className="text-xs text-center text-muted-foreground pb-4">Our compliance team typically reviews applications within 2–3 business days</p>
    </div>
  );
}
