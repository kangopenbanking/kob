import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { InstitutionLayout } from "@/components/institution/InstitutionLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings, Save, Bell, Shield, DollarSign } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function InstitutionSettings() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [institution, setInstitution] = useState<any>(null);
  const [settings, setSettings] = useState({
    settlement_frequency: 'weekly',
    minimum_settlement_amount: 0,
    use_kob_flutterwave: false,
    sandbox_access: false,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate('/auth'); return; }

    const { data } = await supabase
      .from("institutions").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) { navigate('/register'); return; }

    setInstitution(data);
    setSettings({
      settlement_frequency: data.settlement_frequency || 'weekly',
      minimum_settlement_amount: Number(data.minimum_settlement_amount || 0),
      use_kob_flutterwave: data.use_kob_flutterwave || false,
      sandbox_access: data.sandbox_access || false,
    });
    setLoading(false);
  };

  const handleSave = async () => {
    if (!institution) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("institutions").update({
          settlement_frequency: settings.settlement_frequency,
          minimum_settlement_amount: settings.minimum_settlement_amount,
          use_kob_flutterwave: settings.use_kob_flutterwave,
          updated_at: new Date().toISOString(),
        }).eq("id", institution.id);

      if (error) throw error;
      toast({ title: "Settings Saved", description: "Your settings have been updated." });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <InstitutionLayout><Card><CardContent className="py-12 text-center text-muted-foreground">Loading...</CardContent></Card></InstitutionLayout>;

  return (
    <InstitutionLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure your institution's platform settings</p>
        </div>

        {/* Settlement Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><DollarSign className="h-5 w-5" />Settlement Configuration</CardTitle>
            <CardDescription>Configure how and when you receive payouts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Settlement Frequency</Label>
                <Select value={settings.settlement_frequency} onValueChange={v => setSettings(prev => ({ ...prev, settlement_frequency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="biweekly">Bi-weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Minimum Settlement Amount (XAF)</Label>
                <Input type="number" value={settings.minimum_settlement_amount}
                  onChange={e => setSettings(prev => ({ ...prev, minimum_settlement_amount: Number(e.target.value) }))} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Payment Processing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Shield className="h-5 w-5" />Payment Processing</CardTitle>
            <CardDescription>Control payment gateway integrations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">KOB Facilitated Payments</p>
                <p className="text-sm text-muted-foreground">Use KOB's payment infrastructure for Mobile Money and Bank Transfers</p>
              </div>
              <Switch checked={settings.use_kob_flutterwave}
                onCheckedChange={v => setSettings(prev => ({ ...prev, use_kob_flutterwave: v }))} />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium">Sandbox Access</p>
                <p className="text-sm text-muted-foreground">Access to sandbox/testing environment</p>
              </div>
              <Switch checked={settings.sandbox_access} disabled />
            </div>
          </CardContent>
        </Card>

        {/* API Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5" />API Configuration</CardTitle>
            <CardDescription>V1 API integration settings</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Base URL</p>
                <code className="text-sm font-mono">https://api.kangopenbanking.com/v1</code>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Token Endpoint</p>
                <code className="text-sm font-mono">POST /v1/oauth/token</code>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Idempotency</p>
                <p className="text-sm">All POST requests require <code className="font-mono bg-background px-1 rounded">Idempotency-Key</code> header (UUID v4, 24h expiry)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />{saving ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </div>
    </InstitutionLayout>
  );
}
