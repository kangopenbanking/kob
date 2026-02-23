import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle, Upload, FileText } from "lucide-react";
import { toast } from "sonner";

const statusConfig: Record<string, { icon: any; color: string; label: string; description: string }> = {
  not_submitted: { icon: Clock, color: "text-muted-foreground", label: "Not Submitted", description: "Submit your business documents to begin the verification process" },
  draft: { icon: Clock, color: "text-muted-foreground", label: "Draft", description: "Complete and submit your KYB application" },
  submitted: { icon: Clock, color: "text-blue-500", label: "Submitted", description: "Your documents are awaiting review by our compliance team" },
  under_review: { icon: AlertCircle, color: "text-amber-500", label: "Under Review", description: "Our team is reviewing your business documents" },
  verified: { icon: CheckCircle2, color: "text-green-500", label: "Verified", description: "Your business has been verified. You can now accept live payments." },
  active: { icon: CheckCircle2, color: "text-green-500", label: "Active", description: "Your account is fully active and processing live payments" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected", description: "Your KYB application was not approved. Please contact support." },
  suspended: { icon: XCircle, color: "text-destructive", label: "Suspended", description: "Your account has been suspended. Contact support for assistance." },
};

const KYB_STEPS = [
  { key: "business_info", title: "Business Information", description: "Legal name, registration number, address" },
  { key: "identity", title: "Identity Verification", description: "ID document of business owner/director" },
  { key: "business_docs", title: "Business Documents", description: "Registration certificate, tax ID" },
  { key: "bank_info", title: "Bank Information", description: "Bank statement or proof of bank account" },
];

export default function MerchantKYB() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    setMerchant(data);
    setLoading(false);
  };

  const handleSubmitKYB = async () => {
    if (!merchant) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("gateway_merchants").update({
        kyb_status: "submitted",
        status: "submitted",
      }).eq("id", merchant.id);
      if (error) throw error;
      toast.success("KYB application submitted for review");
      loadData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <div className="text-center py-20 text-muted-foreground">No merchant account found</div>;

  const cfg = statusConfig[merchant.kyb_status] || statusConfig.not_submitted;
  const StatusIcon = cfg.icon;
  const canSubmit = merchant.kyb_status === "not_submitted" || merchant.kyb_status === "draft";
  const meta = (merchant.metadata as any) || {};

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">KYB Verification</h1><p className="text-muted-foreground">Know Your Business verification for live payments</p></div>

      {/* Status Card */}
      <Card className={merchant.kyb_status === "verified" || merchant.status === "active" ? "border-green-500/30 bg-green-50 dark:bg-green-950/10" : ""}>
        <CardHeader>
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-8 w-8 ${cfg.color}`} />
            <div>
              <CardTitle className="text-lg">{cfg.label}</CardTitle>
              <p className="text-sm text-muted-foreground">{cfg.description}</p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Business Information Summary */}
      <Card>
        <CardHeader><CardTitle className="text-base">Business Information</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div><span className="text-sm text-muted-foreground">Business Name</span><p className="font-medium">{merchant.business_name}</p></div>
            <div><span className="text-sm text-muted-foreground">Business Type</span><p className="font-medium">{meta.business_type?.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()) || "—"}</p></div>
            <div><span className="text-sm text-muted-foreground">Country</span><p className="font-medium">{meta.country || "—"}</p></div>
            <div><span className="text-sm text-muted-foreground">Environment</span><p className="font-medium"><Badge variant="secondary">{merchant.environment || "sandbox"}</Badge></p></div>
            <div><span className="text-sm text-muted-foreground">Email</span><p className="font-medium">{merchant.business_email || "—"}</p></div>
            <div><span className="text-sm text-muted-foreground">Phone</span><p className="font-medium">{merchant.business_phone || "—"}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* KYB Checklist */}
      {canSubmit && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verification Checklist</CardTitle>
            <p className="text-sm text-muted-foreground">Complete these steps to submit your KYB application</p>
          </CardHeader>
          <CardContent className="space-y-3">
            {KYB_STEPS.map((step, i) => (
              <div key={step.key} className="flex items-center gap-3 p-3 rounded-lg border">
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">{i + 1}</div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.description}</p>
                </div>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}

            <div className="pt-4">
              <Button onClick={handleSubmitKYB} disabled={submitting} className="w-full gap-2">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                Submit KYB Application
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Our compliance team typically reviews applications within 2-3 business days
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
