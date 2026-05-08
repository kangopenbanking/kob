import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';

type Env = 'development' | 'preview' | 'production';
type Scope = 'all' | 'admin' | 'user';

interface Row {
  id: string;
  environment: Env;
  role_scope: Scope;
  firebase_enabled: boolean;
  sms_fallback_enabled: boolean;
  notes: string | null;
  updated_at: string;
}

const ENVS: Env[] = ['development', 'preview', 'production'];
const SCOPES: Scope[] = ['all', 'admin', 'user'];

export default function OTPProviderSettings() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('otp_provider_settings')
      .select('*')
      .order('environment')
      .order('role_scope');
    if (error) toast.error(error.message);
    setRows((data || []) as Row[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const upsert = async (env: Env, scope: Scope, patch: Partial<Row>) => {
    const existing = rows.find((r) => r.environment === env && r.role_scope === scope);
    setSavingId(existing?.id || `${env}:${scope}`);
    const payload = {
      environment: env,
      role_scope: scope,
      firebase_enabled: patch.firebase_enabled ?? existing?.firebase_enabled ?? true,
      sms_fallback_enabled: patch.sms_fallback_enabled ?? existing?.sms_fallback_enabled ?? true,
      notes: patch.notes ?? existing?.notes ?? null,
    };
    const { error } = await (supabase as any)
      .from('otp_provider_settings')
      .upsert(payload, { onConflict: 'environment,role_scope' });
    if (error) toast.error(error.message);
    else toast.success(`Saved ${env} / ${scope}`);
    setSavingId(null);
    await load();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader
        icon={ShieldCheck}
        title="Phone OTP providers"
        description="Enable or disable Firebase and SMS fallback per environment and per role. Changes take effect on the next OTP request."
      />

      <div className="grid gap-4">
        {ENVS.flatMap((env) =>
          SCOPES.map((scope) => {
            const row = rows.find((r) => r.environment === env && r.role_scope === scope);
            const isSaving = savingId === (row?.id || `${env}:${scope}`);
            return (
              <Card key={`${env}:${scope}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {env} <span className="text-muted-foreground font-normal">·</span>{' '}
                        <span className="text-sm font-normal text-muted-foreground">role scope: {scope}</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {row ? `Updated ${new Date(row.updated_at).toLocaleString()}` : 'No record yet — saving will create one.'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Badge variant={row?.firebase_enabled ? 'default' : 'secondary'}>Firebase {row?.firebase_enabled ? 'on' : 'off'}</Badge>
                      <Badge variant={row?.sms_fallback_enabled ? 'default' : 'secondary'}>SMS {row?.sms_fallback_enabled ? 'on' : 'off'}</Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                    <Label htmlFor={`fb-${env}-${scope}`}>Firebase phone verification</Label>
                    <Switch
                      id={`fb-${env}-${scope}`}
                      checked={!!row?.firebase_enabled}
                      onCheckedChange={(v) => upsert(env, scope, { firebase_enabled: v })}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2">
                    <Label htmlFor={`sms-${env}-${scope}`}>SMS fallback (Vonage)</Label>
                    <Switch
                      id={`sms-${env}-${scope}`}
                      checked={!!row?.sms_fallback_enabled}
                      onCheckedChange={(v) => upsert(env, scope, { sms_fallback_enabled: v })}
                      disabled={isSaving}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`notes-${env}-${scope}`} className="text-xs text-muted-foreground">Notes</Label>
                    <Textarea
                      id={`notes-${env}-${scope}`}
                      defaultValue={row?.notes || ''}
                      onBlur={(e) => {
                        const val = e.currentTarget.value;
                        if ((row?.notes || '') !== val) void upsert(env, scope, { notes: val });
                      }}
                      placeholder="Operational note (optional)"
                      rows={2}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isSaving}
                      onClick={() => upsert(env, scope, {})}
                    >
                      {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
                      Save
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
