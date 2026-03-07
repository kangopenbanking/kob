import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditApiIntegrationWidget } from "@/components/credit-api/CreditApiIntegrationWidget";
import { TrendingUp, Shield, Activity, RefreshCw, ExternalLink, Code } from "lucide-react";
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

export default function InstitutionCreditApi() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [queryCount, setQueryCount] = useState(0);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const instId = await resolveInstitutionId(user.id);
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);
      const { count } = await supabase.from("api_usage_metrics").select("id", { count: "exact", head: true }).eq("institution_id", instId).ilike("endpoint", "%credit%");
      setQueryCount(count || 0);
    } catch (error: any) { toast({ title: "Error", description: error.message, variant: "destructive" }); }
    finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-teal/10 border border-fi-teal/20"><TrendingUp className="h-5 w-5 text-fi-teal" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Credit Scoring API</h1>
            <p className="text-sm text-muted-foreground">Query customer credit scores for lending decisions</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}><RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh</Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-3">
        {[
          { label: "API Queries", value: loading ? null : queryCount, sub: "Total credit score queries", icon: Activity, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
          { label: "Endpoint", value: "POST /v1/credit/query", sub: "Score query endpoint", icon: Code, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
          { label: "Authentication", value: "OAuth 2.0 + JWT", sub: "Certificate-bound tokens", icon: Shield, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
        ].map(s => (
          <Card key={s.label} className="border-border/60">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{s.label}</CardTitle>
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg border ${s.color}`}><s.icon className="h-3.5 w-3.5" /></div>
            </CardHeader>
            <CardContent>
              {s.value === null ? <Skeleton className="h-6 w-16" /> : typeof s.value === 'number' ? <div className="text-2xl font-bold">{s.value}</div> : <code className="text-xs font-mono">{s.value}</code>}
              {s.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{s.sub}</p>}
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-fi-teal to-fi-blue" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-teal/10 border border-fi-teal/20"><TrendingUp className="h-4 w-4 text-fi-teal" /></div>
              <div><CardTitle className="text-sm font-semibold">Credit Score Query Tool</CardTitle><CardDescription className="text-xs">Test credit score queries using your API credentials</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>{institutionId ? <CreditApiIntegrationWidget institutionId={institutionId} /> : <p className="text-sm text-muted-foreground">Loading...</p>}</CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-indigo/10 border border-fi-indigo/20"><Code className="h-4 w-4 text-fi-indigo" /></div>
                <div><CardTitle className="text-sm font-semibold">API Reference</CardTitle><CardDescription className="text-xs">Integration documentation</CardDescription></div>
              </div>
              <Button variant="outline" size="sm" asChild><a href="/documentation" target="_blank"><ExternalLink className="h-3.5 w-3.5 mr-1.5" />Full Docs</a></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4 font-mono text-xs space-y-1">
              <p className="text-muted-foreground"># Request</p>
              <p>POST /v1/credit/query</p>
              <p>Authorization: Bearer {'<access_token>'}</p>
              <p>Idempotency-Key: {'<uuid>'}</p>
              <p className="mt-2">{'{'}</p>
              <p>  "phone_number": "+237677123456",</p>
              <p>  "consent_id": "consent_xyz"</p>
              <p>{'}'}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
