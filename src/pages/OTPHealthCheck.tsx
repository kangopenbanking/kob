import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  isFirebaseConfigured,
  checkRuntimeDomainAuthorized,
  setupRecaptchaVerifier,
  FIREBASE_ENV,
} from '@/lib/firebase';
import { resolveOTPSettings } from '@/lib/otpProviderConfig';
import { useOTPProviderSettings } from '@/hooks/useOTPProviderSettings';

type CheckState = 'pending' | 'pass' | 'fail' | 'warn';
interface Check { label: string; state: CheckState; detail?: string }

function StatusIcon({ s }: { s: CheckState }) {
  if (s === 'pass') return <CheckCircle2 className="h-4 w-4 text-green-600" aria-hidden="true" />;
  if (s === 'fail') return <XCircle className="h-4 w-4 text-destructive" aria-hidden="true" />;
  if (s === 'warn') return <AlertTriangle className="h-4 w-4 text-amber-500" aria-hidden="true" />;
  return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />;
}

export default function OTPHealthCheck() {
  const { settings: adminSettings, loading: loadingAdmin } = useOTPProviderSettings();
  const [checks, setChecks] = useState<Check[]>([]);
  const [running, setRunning] = useState(false);

  const run = async () => {
    setRunning(true);
    const results: Check[] = [];

    // 1. Firebase SDK configured
    results.push({
      label: 'Firebase SDK configured',
      state: isFirebaseConfigured ? 'pass' : 'fail',
      detail: isFirebaseConfigured ? undefined : 'VITE_FIREBASE_API_KEY / VITE_FIREBASE_PROJECT_ID are missing.',
    });

    // 2. Runtime hostname authorized
    const dom = checkRuntimeDomainAuthorized();
    results.push({
      label: `Hostname "${dom.host}" is in the ${FIREBASE_ENV} authorized list`,
      state: dom.ok ? 'pass' : 'warn',
      detail: dom.ok ? undefined : `Add it in Firebase Console → Authentication → Settings → Authorized domains. Expected: ${dom.expected.join(', ')}`,
    });

    // 3. Identity Toolkit reachable (anonymous public config endpoint)
    try {
      const apiKey = (import.meta as any).env?.VITE_FIREBASE_API_KEY;
      const projectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID;
      if (apiKey && projectId) {
        const r = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/config?key=${apiKey}`, { method: 'GET' });
        results.push({
          label: 'Identity Toolkit reachable',
          state: r.ok ? 'pass' : (r.status === 403 ? 'warn' : 'fail'),
          detail: r.ok ? `HTTP 200` : `HTTP ${r.status} — credentials may be restricted (this is normal for browser-restricted keys).`,
        });
      } else {
        results.push({ label: 'Identity Toolkit reachable', state: 'warn', detail: 'Skipped — missing API key/project id.' });
      }
    } catch (e: any) {
      results.push({ label: 'Identity Toolkit reachable', state: 'fail', detail: e?.message || 'Network error' });
    }

    // 4. reCAPTCHA v2 Invisible verifier instantiates
    try {
      let containerId = 'otp-health-recaptcha';
      let host = document.getElementById(containerId);
      if (!host) {
        host = document.createElement('div');
        host.id = containerId;
        host.style.display = 'none';
        document.body.appendChild(host);
      } else {
        host.innerHTML = '';
      }
      const v = setupRecaptchaVerifier(containerId);
      await v.render();
      results.push({ label: 'reCAPTCHA v2 Invisible widget rendered', state: 'pass' });
      try { v.clear(); } catch { /* noop */ }
    } catch (e: any) {
      results.push({
        label: 'reCAPTCHA v2 Invisible widget rendered',
        state: 'fail',
        detail: e?.message || 'Verifier failed to initialize',
      });
    }

    // 5. Admin provider settings
    const resolved = resolveOTPSettings();
    results.push({
      label: `Provider mode: ${resolved.mode} (source: ${resolved.source})`,
      state: 'pass',
      detail: `Firebase: ${resolved.firebase_enabled ? 'enabled' : 'disabled'} • SMS fallback: ${resolved.sms_fallback_enabled ? 'enabled' : 'disabled'}`,
    });

    setChecks(results);
    setRunning(false);
  };

  useEffect(() => {
    if (!loadingAdmin) void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingAdmin]);

  const allPass = checks.length > 0 && checks.every((c) => c.state === 'pass');
  const anyFail = checks.some((c) => c.state === 'fail');

  return (
    <div className="container mx-auto max-w-2xl py-10 px-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phone verification health</CardTitle>
              <CardDescription>
                Live preflight of Firebase phone OTP and reCAPTCHA v2 Invisible for this environment.
              </CardDescription>
            </div>
            <Badge variant={allPass ? 'default' : anyFail ? 'destructive' : 'secondary'}>
              {running ? 'Running' : allPass ? 'Healthy' : anyFail ? 'Degraded' : 'Warnings'}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border/50 divide-y divide-border/50">
            {checks.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Running checks…
              </div>
            )}
            {checks.map((c, i) => (
              <div key={i} className="p-3 flex items-start gap-3">
                <StatusIcon s={c.state} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{c.label}</div>
                  {c.detail && <div className="text-xs text-muted-foreground mt-0.5">{c.detail}</div>}
                </div>
              </div>
            ))}
          </div>
          {adminSettings && (
            <div className="text-xs text-muted-foreground">
              Admin settings last updated {new Date(adminSettings.updated_at).toLocaleString()} for environment <strong>{adminSettings.environment}</strong>, scope <strong>{adminSettings.role_scope}</strong>.
            </div>
          )}
          <div className="flex justify-end">
            <Button variant="outline" onClick={run} disabled={running}>
              <RefreshCw className={`h-4 w-4 mr-2 ${running ? 'animate-spin' : ''}`} /> Re-run checks
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
