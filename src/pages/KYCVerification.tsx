import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, CheckCircle, AlertCircle, Clock, XCircle, Info } from "lucide-react";

type KycStatus = "pending" | "approved" | "rejected" | "info_requested" | null;

interface KycRecord {
  id: string;
  status: KycStatus;
  created_at: string;
  updated_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
  verification_type: string | null;
  document_type: string | null;
  document_number: string | null;
  document_country: string | null;
  document_expiry_date: string | null;
  verification_method?: string | null;
  didit_session_id?: string | null;
}


const ACCEPTED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

function validateFile(file: File): string | null {
  if (!ACCEPTED_MIME.includes(file.type)) return "Only JPG, PNG, WebP or PDF files are accepted.";
  if (file.size > MAX_BYTES) return "File must be smaller than 10 MB.";
  return null;
}

export default function KYCVerification() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetchingStatus, setFetchingStatus] = useState(true);
  const [latest, setLatest] = useState<KycRecord | null>(null);
  const [formData, setFormData] = useState({
    verification_type: "identity",
    document_type: "",
    document_number: "",
    document_country: "",
    document_expiry_date: "",
  });
  const [files, setFiles] = useState<{ front: File | null; back: File | null; selfie: File | null }>({
    front: null,
    back: null,
    selfie: null,
  });
  const { toast } = useToast();

  const loadLatest = async () => {
    setFetchingStatus(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("kyc_verifications")
        .select("id, status, created_at, updated_at, verified_at, rejection_reason, verification_type, document_type, document_number, document_country, document_expiry_date, verification_method, didit_session_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (data) {
        setLatest(data as KycRecord);
        const method = (data as any).verification_method as string | null;
        const hasDiditSession = !!(data as any).didit_session_id;

        // Never re-collect information Didit already owns.
        // - Approved users go to the wizard success screen.
        // - Pending Didit sessions go to the dedicated resume page.
        if (data.status === "approved") {
          navigate("/app/kyc", { replace: true });
          return;
        }
        if ((data.status === "pending" || data.status === "manual_review") && (method === "didit" || hasDiditSession)) {
          navigate("/app/kyc/resume", { replace: true });
          return;
        }

        // Prefill on rejection so the user can resubmit easily (manual fallback only).
        if (data.status === "rejected" || data.status === "info_requested") {
          setFormData({
            verification_type: data.verification_type || "identity",
            document_type: data.document_type || "",
            document_number: data.document_number || "",
            document_country: data.document_country || "",
            document_expiry_date: data.document_expiry_date || "",
          });
        }
      }
    } finally {
      setFetchingStatus(false);
    }
  };

  useEffect(() => {
    loadLatest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const uploadFile = async (file: File, type: string): Promise<string> => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Not authenticated");
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;
    const { error: uploadError } = await supabase.storage.from("kyc-documents").upload(fileName, file);
    if (uploadError) throw uploadError;
    return fileName;
  };

  const onFilePick = (slot: "front" | "back" | "selfie", file: File | null) => {
    if (file) {
      const err = validateFile(file);
      if (err) {
        toast({ title: "Invalid file", description: err, variant: "destructive" });
        return;
      }
    }
    setFiles((f) => ({ ...f, [slot]: file }));
  };

  const canSubmitNew = !latest || latest.status === "rejected" || latest.status === "info_requested";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNew) return;
    if (!files.front || !files.selfie) {
      toast({ title: "Missing documents", description: "Document front and selfie are required.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const document_front_url = await uploadFile(files.front, "front");
      const document_back_url = files.back ? await uploadFile(files.back, "back") : undefined;
      const selfie_url = await uploadFile(files.selfie, "selfie");

      const { submitIdentityKyc } = await import("@/lib/kycGateway");
      const data = await submitIdentityKyc({
        ...formData,
        document_front_url,
        document_back_url,
        selfie_url,
      } as any);

      toast({ title: "Submitted", description: "Your verification was received and is now under review." });
      setFiles({ front: null, back: null, selfie: null });
      await loadLatest();
    } catch (err: any) {
      console.error("Error submitting KYC:", err);
      toast({
        title: "Submission failed",
        description: err.message || err.error || "Failed to submit KYC verification",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStatusCard = () => {
    if (fetchingStatus) {
      return (
        <Card className="mb-6">
          <CardContent className="py-6">
            <p className="text-sm text-muted-foreground">Loading verification status…</p>
          </CardContent>
        </Card>
      );
    }
    if (!latest) return null;

    const formatted = new Date(latest.updated_at || latest.created_at).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (latest.status === "approved") {
      return (
        <Alert className="mb-6 border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <AlertTitle>Identity verified</AlertTitle>
          <AlertDescription>
            Your verification was approved on {formatted}. Full account access is enabled.
          </AlertDescription>
        </Alert>
      );
    }
    if (latest.status === "pending") {
      return (
        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950/20">
          <Clock className="h-5 w-5 text-blue-600" />
          <AlertTitle>Verification under review</AlertTitle>
          <AlertDescription>
            We received your documents on {formatted}. Reviews typically take 1–2 business days. You will be
            notified by email and in-app as soon as a decision is made.
          </AlertDescription>
        </Alert>
      );
    }
    if (latest.status === "rejected") {
      return (
        <Alert className="mb-6 border-red-200 bg-red-50 dark:bg-red-950/20" variant="destructive">
          <XCircle className="h-5 w-5" />
          <AlertTitle>Verification not approved</AlertTitle>
          <AlertDescription>
            <p>Reviewed on {formatted}.</p>
            {latest.rejection_reason && (
              <p className="mt-2"><strong>Reason:</strong> {latest.rejection_reason}</p>
            )}
            <p className="mt-2">We've prefilled the form below — please review and resubmit.</p>
          </AlertDescription>
        </Alert>
      );
    }
    if (latest.status === "info_requested") {
      return (
        <Alert className="mb-6 border-amber-200 bg-amber-50 dark:bg-amber-950/20">
          <Info className="h-5 w-5 text-amber-600" />
          <AlertTitle>Additional information requested</AlertTitle>
          <AlertDescription>
            Our reviewer needs more information. {latest.rejection_reason || "Please update your submission."}
          </AlertDescription>
        </Alert>
      );
    }
    return null;
  };



  const isMobileApp = useMemo(() => {
    if (typeof window === "undefined") return false;
    try {
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as any).standalone === true ||
        document.referrer.includes("android-app://");
      const fromApp =
        window.location.pathname.startsWith("/app") ||
        document.referrer.includes("/app/") ||
        sessionStorage.getItem("kyc_return_to_app") === "1";
      const narrow = window.innerWidth < 768;
      return standalone || fromApp || narrow;
    } catch {
      return false;
    }
  }, []);

  // Remember return target when arriving from the customer PWA
  useEffect(() => {
    if (document.referrer.includes("/app/")) {
      sessionStorage.setItem("kyc_return_to_app", "1");
    }
  }, []);

  const body = (
    <>
      {renderStatusCard()}

      {canSubmitNew && (
        <Card className="rounded-2xl shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-semibold">{latest?.status === "rejected" ? "Resubmit verification" : "Submit verification"}</CardTitle>
            <CardDescription className="text-[12px]">
              Provide your identification documents. Accepted formats: JPG, PNG, WebP, PDF (max 10 MB each).
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verification_type">Verification type</Label>
                <Select value={formData.verification_type} onValueChange={(v) => setFormData({ ...formData, verification_type: v })}>
                  <SelectTrigger id="verification_type"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="identity">Identity verification</SelectItem>
                    <SelectItem value="address">Address verification</SelectItem>
                    <SelectItem value="business">Business verification</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_type">Document type</Label>
                <Select value={formData.document_type} onValueChange={(v) => setFormData({ ...formData, document_type: v })} required>
                  <SelectTrigger id="document_type"><SelectValue placeholder="Select document type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passport">Passport</SelectItem>
                    <SelectItem value="national_id">National ID card</SelectItem>
                    <SelectItem value="drivers_license">Driver's license</SelectItem>
                    <SelectItem value="utility_bill">Utility bill</SelectItem>
                    <SelectItem value="bank_statement">Bank statement</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_number">Document number</Label>
                <Input id="document_number" value={formData.document_number}
                  onChange={(e) => setFormData({ ...formData, document_number: e.target.value })}
                  placeholder="Enter document number" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_country">Country of issue</Label>
                <Input id="document_country" value={formData.document_country}
                  onChange={(e) => setFormData({ ...formData, document_country: e.target.value })}
                  placeholder="e.g., Cameroon" required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="document_expiry_date">Expiry date</Label>
                <Input id="document_expiry_date" type="date" value={formData.document_expiry_date}
                  onChange={(e) => setFormData({ ...formData, document_expiry_date: e.target.value })} required />
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="document-front">Document front *</Label>
                  <Input id="document-front" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                    capture="environment"
                    onChange={(e) => onFilePick("front", e.target.files?.[0] || null)} />
                  {files.front && <p className="text-sm text-muted-foreground">Selected: {files.front.name}</p>}
                </div>

                {formData.document_type !== "passport" && (
                  <div className="space-y-2">
                    <Label htmlFor="document-back">Document back</Label>
                    <Input id="document-back" type="file" accept="image/jpeg,image/png,image/webp,application/pdf"
                      capture="environment"
                      onChange={(e) => onFilePick("back", e.target.files?.[0] || null)} />
                    {files.back && <p className="text-sm text-muted-foreground">Selected: {files.back.name}</p>}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="selfie">Selfie photo *</Label>
                  <Input id="selfie" type="file" accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={(e) => onFilePick("selfie", e.target.files?.[0] || null)} />
                  {files.selfie && <p className="text-sm text-muted-foreground">Selected: {files.selfie.name}</p>}
                </div>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Ensure all details are clearly visible and your document is valid. Your data is encrypted and stored securely.
                </AlertDescription>
              </Alert>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Submitting…" : latest?.status === "rejected" ? "Resubmit for verification" : "Submit for verification"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </>
  );

  if (isMobileApp) {
    return (
      <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-background">
        <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
          <button
            onClick={() => {
              if (window.history.length > 1) navigate(-1);
              else navigate("/app/kyc");
            }}
            className="rounded-full p-2 hover:bg-muted"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Identity</p>
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">Identity verification</h1>
          </div>
        </header>
        <div className="flex-1 space-y-4 px-4 pb-24 pt-4">{body}</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="mb-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Identity
        </p>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-foreground">
          Identity verification
        </h1>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Complete your verification to unlock full account access.
        </p>
      </div>

      {body}
    </div>
  );
}

