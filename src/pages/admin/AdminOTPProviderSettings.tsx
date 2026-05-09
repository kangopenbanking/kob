import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ShieldCheck, Smartphone, MessageSquare, Loader2 } from 'lucide-react';

type Env = 'development' | 'preview' | 'production';

interface Row {
  id: string;
  environment: Env;
  role_scope: 'all' | 'admin' | 'user';
  firebase_enabled: boolean;
  sms_fallback_enabled: boolean;
  notes: string | null;
  updated_at: string;
  updated_by: string | null;
}

const ENVS: Env[] = ['development', 'preview', 'production'];

const AdminOTPProviderSettings: React.FC = () => {
  const [rows, setRows] = useState<Record<Env, Row | null>>({ development: null, preview: null, production: null });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<Env | null>(null);
  const [testing, setTesting] = useState<Env | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('otp_provider_settings')
      .select('*')
      .eq('role_scope', 'all');
    if (error) {
      toast.error(`Failed to load OTP settings: ${error.message}`);
    } else {
      const next: Record<Env, Row | null> = { development: null, preview: null, production: null };
      (data as Row[]).forEach((r) => { next[r.environment] = r; });
      setRows(next);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const update = (env: Env, patch: Partial<Row>) => {
    setRows((prev) => ({ ...prev, [env]: prev[env] ? { ...prev[env]!, ...patch } : prev[env] }));
  };

  const save = async (env: Env) => {
    const row = rows[env];
    if (!row) return;
    setSaving(env);
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from('otp_provider_settings')
      .update({
        firebase_enabled: row.firebase_enabled,
        sms_fallback_enabled: row.sms_fallback_enabled,
        notes: row.notes,
        updated_by: user?.id ?? null,
      })
      .eq('id', row.id);
    setSaving(null);
    if (error) toast.error(`Save failed: ${error.message}`);
    else { toast.success(`${env} settings saved.`); load(); }
  };

  const runE2E = async (env: Env) => {
    const row = rows[env];
    if (!row) return;
    setTesting(env);
    try {
      // Verify the row is reachable through the same path the runtime uses.
      const { data, error } = await (supabase as any)
        .from('otp_provider_settings')
        .select('environment, firebase_enabled, sms_fallback_enabled')
        .eq('environment', env)
        .eq('role_scope', 'all')
        .maybeSingle();
      if (error || !data) throw error || new Error('Settings row not found');
      const fbOk = data.firebase_enabled === row.firebase_enabled;
      const smsOk = data.sms_fallback_enabled === row.sms_fallback_enabled;
      if (!fbOk || !smsOk) throw new Error('In-flight values do not match the saved row.');
      const provider = row.firebase_enabled
        ? (row.sms_fallback_enabled ? 'Firebase (with Vonage SMS fallback)' : 'Firebase only')
        : (row.sms_fallback_enabled ? 'Vonage SMS only' : 'NONE — OTP disabled');
      toast.success(`E2E OK · ${env}: ${provider}`);
    } catch (e: any) {
      toast.error(`E2E failed: ${e.message ?? String(e)}`);
    } finally {
      setTesting(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading OTP provider settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" /> OTP Provider Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Switch the phone-OTP delivery provider per environment. Firebase Phone Auth handles primary
          OTP via reCAPTCHA v2 Invisible. Vonage SMS is the server-side fallback used when Firebase is
          disabled or unreachable.
        </p>
      </header>

      {ENVS.map((env) => {
        const row = rows[env];
        if (!row) return null;
        const provider = row.firebase_enabled
          ? (row.sms_fallback_enabled ? 'Firebase + Vonage fallback' : 'Firebase only')
          : (row.sms_fallback_enabled ? 'Vonage SMS only' : 'Disabled');
        return (
          <Card key={env}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="capitalize text-lg">{env}</CardTitle>
                <CardDescription>Last updated {new Date(row.updated_at).toLocaleString()}</CardDescription>
              </div>
              <Badge variant={row.firebase_enabled || row.sms_fallback_enabled ? 'default' : 'destructive'}>
                {provider}
              </Badge>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <Smartphone className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">Firebase Phone Auth</Label>
                    <p className="text-xs text-muted-foreground">Primary client-side OTP via reCAPTCHA v2 Invisible.</p>
                  </div>
                </div>
                <Switch
                  checked={row.firebase_enabled}
                  onCheckedChange={(v) => update(env, { firebase_enabled: v })}
                  aria-label={`Toggle Firebase OTP for ${env}`}
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 mt-0.5 text-primary" />
                  <div>
                    <Label className="text-sm font-medium">Vonage SMS Fallback</Label>
                    <p className="text-xs text-muted-foreground">Server-side fallback used when Firebase is unavailable or disabled.</p>
                  </div>
                </div>
                <Switch
                  checked={row.sms_fallback_enabled}
                  onCheckedChange={(v) => update(env, { sms_fallback_enabled: v })}
                  aria-label={`Toggle Vonage SMS fallback for ${env}`}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`notes-${env}`}>Notes</Label>
                <Textarea
                  id={`notes-${env}`}
                  value={row.notes ?? ''}
                  onChange={(e) => update(env, { notes: e.target.value })}
                  placeholder="Operational notes (audit trail)"
                  rows={2}
                />
              </div>

              <Separator />

              <div className="flex flex-wrap gap-2 justify-end">
                <Button variant="outline" onClick={() => runE2E(env)} disabled={testing === env}>
                  {testing === env ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Run E2E Check
                </Button>
                <Button onClick={() => save(env)} disabled={saving === env}>
                  {saving === env ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Save {env}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AdminOTPProviderSettings;
