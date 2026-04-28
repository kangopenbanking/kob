import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Shield, DollarSign, Code } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { PaymentConnectorsPanel } from "@/components/connectors/PaymentConnectorsPanel";

const fadeUp = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.05, duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const } }),
};

export default function InstitutionSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [settings, setSettings] = useState({
    settlement_frequency: 'weekly', minimum_settlement_amount: 0, use_kob_flutterwave: false, sandbox_access: false,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }
    const { data } = await supabase.from("institutions").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) {
      const { data: staffInst } = await supabase.rpc("get_staff_institution_id", { _user_id: user.id });
      if (!staffInst) { navigate('/register'); return; }
      const { data: inst } = await supabase.from("institutions").select("*").eq("id", staffInst).maybeSingle();
      if (inst) { setInstitution(inst); setSettings({ settlement_frequency: inst.settlement_frequency || 'weekly', minimum_settlement_amount: Number(inst.minimum_settlement_amount || 0), use_kob_flutterwave: inst.use_kob_flutterwave || false, sandbox_access: inst.sandbox_access || false }); }
    } else {
      setInstitution(data);
      setSettings({ settlement_frequency: data.settlement_frequency || 'weekly', minimum_settlement_amount: Number(data.minimum_settlement_amount || 0), use_kob_flutterwave: data.use_kob_flutterwave || false, sandbox_access: data.sandbox_access || false });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institution) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("institutions").update({
        settlement_frequency: settings.settlement_frequency, minimum_settlement_amount: settings.minimum_settlement_amount,
        use_kob_flutterwave: settings.use_kob_flutterwave, updated_at: new Date().toISOString(),
      }).eq("id", institution.id);
      if (error) throw error;
      toast({ title: "Settings Saved" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  if (loading) return <div className="space-y-6"><Skeleton className="h-24 w-full rounded-xl" /><Skeleton className="h-48 w-full rounded-xl" /></div>;

  return (
    <div className="space-y-6">
      <motion.div initial="hidden" animate="visible" custom={0} variants={fadeUp} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-fi-indigo/10 border border-fi-indigo/20"><Settings className="h-5 w-5 text-fi-indigo" /></div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
            <p className="text-sm text-muted-foreground">Configure institution platform settings</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} size="sm"><Save className="h-3.5 w-3.5 mr-1.5" />{saving ? "Saving..." : "Save Settings"}</Button>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={1} variants={fadeUp}>
        <Card className="border-border/60 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-fi-amber to-fi-rose" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-amber/10 border border-fi-amber/20"><DollarSign className="h-4 w-4 text-fi-amber" /></div>
              <div><CardTitle className="text-sm font-semibold">Settlement Configuration</CardTitle><CardDescription className="text-xs">Configure how and when you receive payouts</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Settlement Frequency</Label>
                <Select value={settings.settlement_frequency} onValueChange={v => setSettings(prev => ({ ...prev, settlement_frequency: v }))}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Minimum Settlement Amount (XAF)</Label>
                <Input type="number" className="h-10" value={settings.minimum_settlement_amount} onChange={e => setSettings(prev => ({ ...prev, minimum_settlement_amount: Number(e.target.value) }))} />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={2} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-green/10 border border-fi-green/20"><Shield className="h-4 w-4 text-fi-green" /></div>
              <div><CardTitle className="text-sm font-semibold">Payment Processing</CardTitle><CardDescription className="text-xs">Control payment gateway integrations</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4 hover:bg-muted/30 transition-colors">
              <div><p className="text-sm font-medium">KOB Facilitated Payments</p><p className="text-xs text-muted-foreground">Use KOB's infrastructure for Mobile Money and Bank Transfers</p></div>
              <Switch checked={settings.use_kob_flutterwave} onCheckedChange={v => setSettings(prev => ({ ...prev, use_kob_flutterwave: v }))} />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 p-4">
              <div><p className="text-sm font-medium">Sandbox Access</p><p className="text-xs text-muted-foreground">Access to sandbox/testing environment</p></div>
              <Switch checked={settings.sandbox_access} disabled />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={3} variants={fadeUp}>
        <PaymentConnectorsPanel ownerType="institution" ownerId={institution.id} />
      </motion.div>

      <motion.div initial="hidden" animate="visible" custom={4} variants={fadeUp}>
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-fi-cyan/10 border border-fi-cyan/20"><Code className="h-4 w-4 text-fi-cyan" /></div>
              <div><CardTitle className="text-sm font-semibold">API Configuration</CardTitle><CardDescription className="text-xs">V1 API integration settings</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {[
              { label: "Base URL", value: "https://api.kangopenbanking.com/v1" },
              { label: "Token Endpoint", value: "POST /v1/oauth/token" },
              { label: "Idempotency", value: "All POST requests require Idempotency-Key header (UUID v4, 24h expiry)" },
            ].map(item => (
              <div key={item.label} className="rounded-lg border border-border/60 bg-muted/30 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{item.label}</p>
                <code className="text-xs font-mono">{item.value}</code>
              </div>
            ))}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
