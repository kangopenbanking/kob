import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw, Download } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

export default function InstitutionCompliance() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [kybStatus, setKybStatus] = useState<any>(null);
  const [consents, setConsents] = useState({ active: 0, revoked: 0, expired: 0 });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }

      const { data: institution } = await supabase
        .from("institutions").select("id, verification_step, kyb_verified_at")
        .eq("user_id", user.id).maybeSingle();
      if (!institution) { navigate('/register'); return; }

      // KYB status
      const { data: kyb } = await supabase
        .from("business_kyc").select("verification_status, verified_at, risk_rating")
        .eq("user_id", user.id).maybeSingle();
      setKybStatus(kyb);

      // Compliance reports
      const { data: reportData } = await supabase
        .from("compliance_reports").select("*")
        .order("created_at", { ascending: false }).limit(20);
      setReports(reportData || []);

      // Consent stats
      const { data: clients } = await supabase
        .from("api_clients").select("client_id").eq("institution_id", institution.id);
      const clientIds = (clients || []).map(c => c.client_id);

      if (clientIds.length > 0) {
        const { data: consentData } = await supabase
          .from("aisp_consents").select("status").in("client_id", clientIds);

        const active = (consentData || []).filter(c => c.status === 'Authorised').length;
        const revoked = (consentData || []).filter(c => c.status === 'Revoked').length;
        const expired = (consentData || []).filter(c => c.status === 'Expired').length;
        setConsents({ active, revoked, expired });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Compliance</h1>
            <p className="text-muted-foreground">Regulatory compliance, KYB status, and consent management</p>
          </div>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>

        {/* KYB Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />KYB Verification Status</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-20 w-full" /> : (
              <div className="grid gap-4 md:grid-cols-3">
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Status</p>
                  <Badge className={
                    kybStatus?.verification_status === 'verified' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                    kybStatus?.verification_status === 'pending' ? 'bg-yellow-100 text-yellow-800' : ''
                  }>
                    {kybStatus?.verification_status === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {kybStatus?.verification_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {kybStatus?.verification_status || 'Not submitted'}
                  </Badge>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Risk Rating</p>
                  <p className="font-semibold">{kybStatus?.risk_rating || 'N/A'}</p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <p className="text-sm text-muted-foreground mb-1">Verified At</p>
                  <p className="font-semibold">
                    {kybStatus?.verified_at ? format(new Date(kybStatus.verified_at), "PPP") : 'Pending'}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Consent Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Consent Management (AISP/PISP)</CardTitle>
            <CardDescription>Overview of customer consents issued through your API clients</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="p-4 rounded-lg border text-center">
                <p className="text-3xl font-bold text-green-600">{consents.active}</p>
                <p className="text-sm text-muted-foreground">Active Consents</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-3xl font-bold text-red-600">{consents.revoked}</p>
                <p className="text-sm text-muted-foreground">Revoked</p>
              </div>
              <div className="p-4 rounded-lg border text-center">
                <p className="text-3xl font-bold text-muted-foreground">{consents.expired}</p>
                <p className="text-sm text-muted-foreground">Expired</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Reports */}
        <Card>
          <CardHeader>
            <CardTitle>Compliance Reports</CardTitle>
            <CardDescription>COBAC regulatory reports and audit trails</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-40 w-full" /> : reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No compliance reports generated yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map(report => (
                  <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                    <div>
                      <p className="font-medium">{report.report_type} Report</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(report.report_period_start), "MMM d")} – {format(new Date(report.report_period_end), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right text-sm text-muted-foreground">
                      <p>{report.total_transactions} transactions</p>
                      <p>{report.total_api_calls} API calls</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </InstitutionLayout>
  );
}
