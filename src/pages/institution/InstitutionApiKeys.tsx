import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Key, Copy, RefreshCw, Shield, Clock, CheckCircle2, XCircle, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { GoLiveToggle } from "@/components/shared/GoLiveToggle";

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

interface ApiCredential {
  id: string;
  api_key: string;
  environment: string;
  is_active: boolean;
  created_at: string;
  last_used_at: string | null;
}

export default function InstitutionApiKeys() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [credentials, setCredentials] = useState<ApiCredential[]>([]);
  const [institutionId, setInstitutionId] = useState<string | null>(null);
  const [visibleKeys, setVisibleKeys] = useState<Record<string, boolean>>({});

  useEffect(() => { loadCredentials(); }, []);

  const loadCredentials = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const instId = await resolveInstitutionId(user.id);
      if (!instId) { navigate('/register'); return; }
      setInstitutionId(instId);

      const { data, error } = await supabase
        .from("api_credentials")
        .select("*")
        .eq("institution_id", instId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCredentials(data || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied!", description: `${label} copied to clipboard` });
  };

  const toggleKeyVisibility = (id: string) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const maskKey = (key: string) => `${key.substring(0, 8)}${"•".repeat(24)}${key.substring(key.length - 4)}`;

  const sandboxKeys = credentials.filter(c => c.environment === "sandbox");
  const productionKeys = credentials.filter(c => c.environment === "production");

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-amber/10 border border-fi-amber/20">
            <Key className="h-5 w-5 text-fi-amber" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">API Keys</h1>
            <p className="text-sm text-muted-foreground">Manage your API keys for sandbox and production environments</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadCredentials} disabled={loading}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </Button>
      </motion.div>

      {institutionId && <GoLiveToggle entity="institution" entityId={institutionId} />}

      {/* KPI Cards */}
      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp} className="grid gap-4 md:grid-cols-4">
        {[
          { label: "Total Keys", value: credentials.length, icon: Key, color: "text-fi-amber bg-fi-amber/10 border-fi-amber/20" },
          { label: "Active", value: credentials.filter(c => c.is_active).length, icon: CheckCircle2, color: "text-fi-green bg-fi-green/10 border-fi-green/20" },
          { label: "Sandbox", value: sandboxKeys.length, icon: Shield, color: "text-fi-blue bg-fi-blue/10 border-fi-blue/20" },
          { label: "Production", value: productionKeys.length, icon: Shield, color: "text-fi-teal bg-fi-teal/10 border-fi-teal/20" },
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

      {/* API Keys List */}
      {["sandbox", "production"].map((env, idx) => {
        const envKeys = env === "sandbox" ? sandboxKeys : productionKeys;
        return (
          <motion.div key={env} initial="hidden" animate="visible" custom={idx + 2} variants={fadeUp} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Badge variant={env === "production" ? "default" : "secondary"} className="text-[10px]">
                {env === "production" ? "Production" : "Sandbox"}
              </Badge>
              Keys ({envKeys.length})
            </h2>

            {loading ? (
              <Skeleton className="h-24 w-full rounded-xl" />
            ) : envKeys.length === 0 ? (
              <Card className="border-border/60 border-dashed">
                <CardContent className="py-8 text-center">
                  <Key className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-xs text-muted-foreground">
                    No {env} API keys. Create an API client first to generate keys.
                  </p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => navigate("/fi-portal/api-clients")}>
                    Go to API Clients
                  </Button>
                </CardContent>
              </Card>
            ) : envKeys.map(cred => (
              <Card key={cred.id} className={`border-border/60 ${!cred.is_active ? "opacity-60" : ""}`}>
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant={cred.is_active ? "default" : "secondary"} className="text-[10px]">
                        {cred.is_active ? <><CheckCircle2 className="h-3 w-3 mr-1" />Active</> : <><XCircle className="h-3 w-3 mr-1" />Inactive</>}
                      </Badge>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Created {format(new Date(cred.created_at), "PP")}
                      </span>
                    </div>
                    {cred.last_used_at && (
                      <span className="text-[10px] text-muted-foreground">
                        Last used: {format(new Date(cred.last_used_at), "PP")}
                      </span>
                    )}
                  </div>

                  <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">API Key</p>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => toggleKeyVisibility(cred.id)}>
                          {visibleKeys[cred.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => copyToClipboard(cred.api_key, "API Key")}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <code className="text-xs font-mono break-all">
                      {visibleKeys[cred.id] ? cred.api_key : maskKey(cred.api_key)}
                    </code>
                  </div>
                </CardContent>
              </Card>
            ))}
          </motion.div>
        );
      })}

      {/* Security Notice */}
      <motion.div initial="hidden" animate="visible" custom={5} variants={fadeUp}>
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-4 w-4" />Security Best Practices
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-destructive/80 space-y-1.5">
            <p>• Never expose API keys in client-side code or public repositories</p>
            <p>• Use sandbox keys for development and testing only</p>
            <p>• Rotate production keys periodically (every 90 days recommended)</p>
            <p>• Monitor usage patterns via the Analytics dashboard</p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
