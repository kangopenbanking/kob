import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, DollarSign, ArrowUpDown, TrendingUp, AlertCircle, CheckCircle2, Key, Webhook, Building2, ShieldCheck, ArrowRight, Rocket } from "lucide-react";
import { format } from "date-fns";

interface SetupStep {
  key: string;
  title: string;
  description: string;
  icon: any;
  completed: boolean;
  path: string;
}

export default function MerchantDashboard() {
  const navigate = useNavigate();
  const [merchant, setMerchant] = useState<any>(null);
  const [charges, setCharges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalRevenue: 0, txCount: 0, successRate: 0 });
  const [setupSteps, setSetupSteps] = useState<SetupStep[]>([]);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: m } = await supabase.from("gateway_merchants").select("*").eq("user_id", user.id).maybeSingle();
      setMerchant(m);

      if (m) {
        // Load charges
        const { data: ch } = await supabase.from("gateway_charges").select("*").eq("merchant_id", m.id).order("created_at", { ascending: false }).limit(10);
        setCharges(ch || []);

        // Compute stats
        const { data: allCh } = await supabase.from("gateway_charges").select("amount, status, currency").eq("merchant_id", m.id);
        if (allCh) {
          const total = allCh.filter(c => c.status === "successful").reduce((s, c) => s + Number(c.amount), 0);
          const success = allCh.filter(c => c.status === "successful").length;
          setStats({ totalRevenue: total, txCount: allCh.length, successRate: allCh.length > 0 ? Math.round((success / allCh.length) * 100) : 0 });
        }

        // Check setup steps
        const [apiKeysRes, webhooksRes, settlementRes] = await Promise.all([
          supabase.from("gateway_merchant_api_keys").select("id").eq("merchant_id", m.id).limit(1),
          supabase.from("gateway_merchant_webhooks").select("id").eq("merchant_id", m.id).limit(1),
          supabase.from("gateway_merchant_settlement_accounts").select("id").eq("merchant_id", m.id).limit(1),
        ]);

        setSetupSteps([
          { key: "kyb", title: "Complete KYB Verification", description: "Submit your business documents to go live", icon: ShieldCheck, completed: m.kyb_status === "verified" || m.status === "active", path: "/merchant/kyb" },
          { key: "api_keys", title: "Generate API Keys", description: "Get your sandbox keys to start integrating", icon: Key, completed: (apiKeysRes.data?.length || 0) > 0, path: "/merchant/api-keys" },
          { key: "webhooks", title: "Configure Webhooks", description: "Set up real-time payment notifications", icon: Webhook, completed: (webhooksRes.data?.length || 0) > 0, path: "/merchant/webhooks" },
          { key: "settlement", title: "Add Settlement Account", description: "Add a bank or mobile money account for payouts", icon: Building2, completed: (settlementRes.data?.length || 0) > 0, path: "/merchant/settlement-accounts" },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  // No merchant account — show onboarding CTA
  if (!merchant) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-lg mx-auto text-center">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Rocket className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">Welcome to the Merchant Portal</h2>
          <p className="text-muted-foreground mt-2">
            You haven't set up your merchant account yet. Get started in minutes and begin accepting payments across Africa.
          </p>
        </div>
        <Button size="lg" onClick={() => navigate("/merchant-register")} className="gap-2">
          Create Your Merchant Account <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  const completedSteps = setupSteps.filter(s => s.completed).length;
  const setupProgress = setupSteps.length > 0 ? Math.round((completedSteps / setupSteps.length) * 100) : 0;
  const showSetup = setupProgress < 100;

  const statusColor = (s: string) => {
    if (s === "active" || s === "verified") return "default";
    if (s === "submitted" || s === "under_review") return "secondary";
    return "outline";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{merchant.business_name}</h1>
        <p className="text-muted-foreground">Welcome to your merchant dashboard</p>
      </div>

      {/* KYB Banner */}
      {merchant.kyb_status !== "verified" && merchant.status !== "active" && (
        <Card className="border-amber-500/50 bg-amber-50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
              <div>
                <p className="font-medium">KYB Verification: <Badge variant={statusColor(merchant.kyb_status)}>{merchant.kyb_status?.replace(/_/g, " ").toUpperCase()}</Badge></p>
                <p className="text-sm text-muted-foreground">Complete your KYB to accept live payments.</p>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={() => navigate("/merchant/kyb")}>Complete KYB</Button>
          </CardContent>
        </Card>
      )}

      {/* Setup Checklist */}
      {showSetup && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">Getting Started</CardTitle>
                <CardDescription>{completedSteps} of {setupSteps.length} steps completed</CardDescription>
              </div>
              <Badge variant="secondary">{setupProgress}%</Badge>
            </div>
            <div className="w-full bg-muted rounded-full h-2 mt-2">
              <div className="bg-primary rounded-full h-2 transition-all duration-500" style={{ width: `${setupProgress}%` }} />
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {setupSteps.map(s => (
              <div key={s.key}
                className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${s.completed ? "opacity-60" : ""}`}
                onClick={() => navigate(s.path)}
              >
                {s.completed ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <s.icon className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${s.completed ? "line-through" : ""}`}>{s.title}</p>
                  <p className="text-xs text-muted-foreground">{s.description}</p>
                </div>
                {!s.completed && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRevenue.toLocaleString()} {(merchant.metadata as any)?.default_currency || "XAF"}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.txCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{stats.successRate}%</div></CardContent>
        </Card>
      </div>

      {/* Recent Transactions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Recent Transactions</CardTitle>
            <CardDescription>Latest 10 charges</CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate("/merchant/transactions")}>View All</Button>
        </CardHeader>
        <CardContent>
          {charges.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-muted-foreground">No transactions yet</p>
              <p className="text-sm text-muted-foreground">Start integrating with our API to accept your first payment</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left py-2 px-3">Reference</th><th className="text-left py-2 px-3">Amount</th><th className="text-left py-2 px-3">Status</th><th className="text-left py-2 px-3">Channel</th><th className="text-left py-2 px-3">Date</th></tr></thead>
                <tbody>
                  {charges.map(c => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2 px-3 font-mono text-xs">{c.charge_ref?.slice(0, 16)}</td>
                      <td className="py-2 px-3">{Number(c.amount).toLocaleString()} {c.currency}</td>
                      <td className="py-2 px-3"><Badge variant={c.status === "successful" ? "default" : "secondary"}>{c.status}</Badge></td>
                      <td className="py-2 px-3">{c.channel}</td>
                      <td className="py-2 px-3">{c.created_at ? format(new Date(c.created_at), "MMM d, HH:mm") : "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
