import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, FileText, CheckCircle2, AlertTriangle, Clock, RefreshCw, KeyRound } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

const resolveInstitutionId = async (userId: string): Promise<string | null> => {
  const { data: inst } = await supabase.from("institutions").select("id").eq("user_id", userId).maybeSingle();
  if (inst) return inst.id;
  const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: userId });
  return staffInst || null;
};

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
      const institutionId = await resolveInstitutionId(user.id);
      if (!institutionId) { navigate('/register'); return; }

      const { data: kyb } = await supabase
        .from("business_kyc").select("verification_status, verified_at, risk_rating")
        .eq("user_id", user.id).maybeSingle();
      setKybStatus(kyb);

      const { data: reportData } = await supabase
        .from("compliance_reports").select("*").order("created_at", { ascending: false }).limit(20);
      setReports(reportData || []);

      const { data: clients } = await supabase
        .from("api_clients").select("client_id").eq("institution_id", institutionId);
      const clientIds = (clients || []).map(c => c.client_id);

      if (clientIds.length > 0) {
        const { data: consentData } = await supabase
          .from("aisp_consents").select("status").in("client_id", clientIds);
        setConsents({
          active: (consentData || []).filter(c => c.status === 'Authorised').length,
          revoked: (consentData || []).filter(c => c.status === 'Revoked').length,
          expired: (consentData || []).filter(c => c.status === 'Expired').length,
        });
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-green/10 border border-fi-green/20">
            <Shield className="h-5 w-5 text-fi-green" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Compliance</h1>
            <p className="text-sm text-muted-foreground">Regulatory compliance, KYB status, and consent overview</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </motion.div>

      {/* KYB Status */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
        <Card className="border-border/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-fi-green to-fi-teal" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-green/10 border border-fi-green/20"><Shield className="h-4 w-4 text-fi-green" /></div>
              <CardTitle className="text-sm font-semibold">KYB Verification Status</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-20 w-full" /> : (
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
                  <Badge variant={kybStatus?.verification_status === 'verified' ? 'default' : 'outline'} className="text-xs">
                    {kybStatus?.verification_status === 'verified' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                    {kybStatus?.verification_status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
                    {kybStatus?.verification_status || 'Not submitted'}
                  </Badge>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Risk Rating</p>
                  <p className="text-sm font-semibold">{kybStatus?.risk_rating || 'N/A'}</p>
                </div>
                <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Verified At</p>
                  <p className="text-sm font-semibold">{kybStatus?.verified_at ? format(new Date(kybStatus.verified_at), "PPP") : 'Pending'}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Consent Overview */}
      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Active Consents", value: consents.active, icon: KeyRound, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Revoked", value: consents.revoked, icon: AlertTriangle, color: "text-destructive bg-destructive/10 border-destructive/20" },
          { label: "Expired", value: consents.expired, icon: Clock, color: "text-muted-foreground bg-muted border-border" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{loading ? <Skeleton className="h-8 w-16" /> : s.value}</div></CardContent>
          </Card>
        ))}
      </motion.div>

      {/* Compliance Reports */}
      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-indigo/10 border border-fi-indigo/20"><FileText className="h-4 w-4 text-fi-indigo" /></div>
              <div>
                <CardTitle className="text-sm font-semibold">Compliance Reports</CardTitle>
                <CardDescription className="text-xs">COBAC regulatory reports and audit trails</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div> : reports.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground"><FileText className="h-10 w-10 mx-auto mb-3 opacity-30" /><p className="text-sm">No compliance reports generated yet</p></div>
            ) : (
              <div className="space-y-2">
                {reports.map(report => (
                  <div key={report.id} className="flex items-center justify-between rounded-lg border border-border/60 p-3.5 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="text-sm font-medium">{report.report_type} Report</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(report.report_period_start), "MMM d")} – {format(new Date(report.report_period_end), "MMM d, yyyy")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{report.total_transactions} transactions</p>
                      <p className="text-xs text-muted-foreground">{report.total_api_calls} API calls</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
