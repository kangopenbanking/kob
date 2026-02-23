import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";

const statusConfig: Record<string, { icon: any; color: string; label: string }> = {
  draft: { icon: Clock, color: "text-muted-foreground", label: "Draft" },
  submitted: { icon: Clock, color: "text-blue-500", label: "Submitted" },
  under_review: { icon: AlertCircle, color: "text-amber-500", label: "Under Review" },
  verified: { icon: CheckCircle2, color: "text-green-500", label: "Verified" },
  active: { icon: CheckCircle2, color: "text-green-500", label: "Active" },
  rejected: { icon: XCircle, color: "text-destructive", label: "Rejected" },
  suspended: { icon: XCircle, color: "text-destructive", label: "Suspended" },
};

export default function MerchantKYB() {
  const [merchant, setMerchant] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
    setMerchant(data);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!merchant) return <div className="text-center py-20 text-muted-foreground">No merchant account found</div>;

  const cfg = statusConfig[merchant.kyb_status] || statusConfig.draft;
  const StatusIcon = cfg.icon;

  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-bold">KYB Verification</h1><p className="text-muted-foreground">Your Know Your Business verification status</p></div>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <StatusIcon className={`h-8 w-8 ${cfg.color}`} />
            <div>
              <CardTitle className="text-lg">{cfg.label}</CardTitle>
              <p className="text-sm text-muted-foreground">Current KYB status for {merchant.business_name}</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div><span className="text-sm text-muted-foreground">Business Name</span><p className="font-medium">{merchant.business_name}</p></div>
            <div><span className="text-sm text-muted-foreground">Business Type</span><p className="font-medium">{merchant.business_type || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Country</span><p className="font-medium">{merchant.country || "-"}</p></div>
            <div><span className="text-sm text-muted-foreground">Environment</span><p className="font-medium"><Badge variant="secondary">{merchant.environment || "sandbox"}</Badge></p></div>
            <div><span className="text-sm text-muted-foreground">Default Currency</span><p className="font-medium">{merchant.default_currency || "XAF"}</p></div>
            <div><span className="text-sm text-muted-foreground">Contact Email</span><p className="font-medium">{merchant.contact_email || "-"}</p></div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
