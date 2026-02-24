import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Upload, FileText, Building2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";

const statusConfig: Record<string, { icon: any; color: string; label: string; description: string }> = {
  not_submitted: { icon: Clock, color: "text-muted-foreground", label: "Not Submitted", description: "Submit your business documents to begin the verification process" },
  draft: { icon: Clock, color: "text-muted-foreground", label: "Draft", description: "Complete and submit your KYB application" },
  submitted: { icon: Clock, color: "text-blue-500", label: "Submitted", description: "Your documents are awaiting review by our compliance team" },
  under_review: { icon: AlertCircle, color: "text-amber-500", label: "Under Review", description: "Our team is reviewing your business documents" },
  verified: { icon: CheckCircle2, color: "text-green-500", label: "Verified", description: "Your business has been verified. You can now accept live payments." },
  approved: { icon: CheckCircle2, color: "text-green-500", label: "Approved", description: "Your KYB application has been approved." },
  active: { icon: CheckCircle2, color: "text-green-500", label: "Active", description: "Your account is fully active and processing live payments" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected", description: "Your KYB application was not approved. You may resubmit with corrections." },
  suspended: { icon: XCircle, color: "text-destructive", label: "Suspended", description: "Your account has been suspended. Contact support for assistance." },
};

export default function MerchantKYB() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    registration_number: "",
    tax_id: "",
    business_address: "",
    director_name: "",
    director_id_number: "",
    additional_notes: "",
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
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
    }
    setLoading(false);
  };

  const handleSaveDraft = async () => {
    if (!merchant) return;
    setSubmitting(true);
    try {
      const meta = (merchant.metadata as any) || {};
      const { error } = await supabase.from("gateway_merchants").update({
        metadata: { ...meta, kyb_submission: { ...form, saved_at: new Date().toISOString() } },
      }).eq("id", merchant.id);
      if (error) throw error;
      toast.success("Draft saved");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const handleSubmitKYB = async () => {
    if (!merchant) return;
    if (!form.registration_number || !form.business_address) {
      toast.error("Registration number and business address are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("gateway-merchant-kyb", {
        body: { documents: [], registration_number: form.registration_number, tax_id: form.tax_id, business_address: form.business_address, director_name: form.director_name, director_id_number: form.director_id_number, additional_notes: form.additional_notes },
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      // Fallback: direct update if edge function not available
      if (res.error) {
        const meta = (merchant.metadata as any) || {};
        await supabase.from("gateway_merchants").update({
          kyb_status: "submitted",
          metadata: { ...meta, kyb_submission: { ...form, submitted_at: new Date().toISOString() } },
        }).eq("id", merchant.id);
      }
      toast.success("KYB application submitted for review");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <div className="text-center py-20 text-muted-foreground">No merchant account found</div>;

  const cfg = statusConfig[merchant.kyb_status] || statusConfig.not_submitted;
  const StatusIcon = cfg.icon;
  const canSubmit = ["not_submitted", "draft", "rejected"].includes(merchant.kyb_status);
  const meta = (merchant.metadata as any) || {};
  const reviewNotes = meta.kyb_review;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">KYB Verification</h1><p className="text-muted-foreground">Know Your Business verification for live payments</p></div>

      {/* Status Card */}
      <Card className={["verified", "approved", "active"].includes(merchant.kyb_status) ? "border-green-500/30 bg-green-50 dark:bg-green-950/10" : merchant.kyb_status === "rejected" ? "border-destructive/30 bg-destructive/5" : ""}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-8 w-8 ${cfg.color}`} />
            <div className="flex-1">
              <CardTitle className="text-lg">{cfg.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{cfg.description}</p>
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

      {/* Business Summary */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Building2 className="h-5 w-5 text-primary" /></div>
            <CardTitle className="text-base">Business Summary</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div><span className="text-sm text-muted-foreground">Business Name</span><p className="font-medium">{merchant.business_name}</p></div>
            <div><span className="text-sm text-muted-foreground">Business Type</span><p className="font-medium">{meta.business_type?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "—"}</p></div>
            <div><span className="text-sm text-muted-foreground">Email</span><p className="font-medium">{merchant.business_email || "—"}</p></div>
            <div><span className="text-sm text-muted-foreground">Environment</span><p><Badge variant="secondary">{merchant.environment || "sandbox"}</Badge></p></div>
          </div>
        </CardContent>
      </Card>

      {/* KYB Form */}
      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-5 w-5" /> KYB Application</CardTitle>
            <p className="text-sm text-muted-foreground">Complete the fields below and submit for verification</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Registration Number *</Label>
                <Input value={form.registration_number} onChange={e => setForm(f => ({ ...f, registration_number: e.target.value }))} placeholder="e.g. RC-123456" />
              </div>
              <div className="space-y-2">
                <Label>Tax ID</Label>
                <Input value={form.tax_id} onChange={e => setForm(f => ({ ...f, tax_id: e.target.value }))} placeholder="e.g. TIN-789012" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Business Address *</Label>
              <Textarea value={form.business_address} onChange={e => setForm(f => ({ ...f, business_address: e.target.value }))} rows={2} placeholder="Full registered business address" />
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Director / Owner Name</Label>
                <Input value={form.director_name} onChange={e => setForm(f => ({ ...f, director_name: e.target.value }))} placeholder="Full legal name" />
              </div>
              <div className="space-y-2">
                <Label>Director ID Number</Label>
                <Input value={form.director_id_number} onChange={e => setForm(f => ({ ...f, director_id_number: e.target.value }))} placeholder="National ID or passport number" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea value={form.additional_notes} onChange={e => setForm(f => ({ ...f, additional_notes: e.target.value }))} rows={2} placeholder="Any additional information for the review team" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={submitting}>Save Draft</Button>
              <Button onClick={handleSubmitKYB} disabled={submitting} className="flex-1 gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Submit KYB Application
              </Button>
            </div>
            <p className="text-xs text-center text-muted-foreground">Our compliance team typically reviews applications within 2-3 business days</p>
          </CardContent>
        </Card>
      )}

      {/* Submitted Info */}
      {!canSubmit && meta.kyb_submission && (
        <Card>
          <CardHeader><CardTitle className="text-base">Submitted Documents</CardTitle></CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2 text-sm">
              <div><span className="text-muted-foreground">Registration #</span><p className="font-mono">{meta.kyb_submission.registration_number}</p></div>
              <div><span className="text-muted-foreground">Tax ID</span><p className="font-mono">{meta.kyb_submission.tax_id || "—"}</p></div>
              <div><span className="text-muted-foreground">Business Address</span><p>{meta.kyb_submission.business_address}</p></div>
              <div><span className="text-muted-foreground">Submitted</span><p>{meta.kyb_submission.submitted_at ? new Date(meta.kyb_submission.submitted_at).toLocaleDateString() : "—"}</p></div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
