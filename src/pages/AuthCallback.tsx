// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle, Clock } from 'lucide-react';

type Status = 'loading' | 'success' | 'expired' | 'error';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('loading');
  const [message, setMessage] = useState('Verifying your link…');

  useEffect(() => {
    (async () => {
      // Supabase parses tokens from the URL hash and sets the session automatically.
      await new Promise((r) => setTimeout(r, 250));

      const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
      const search = new URLSearchParams(window.location.search);
      const errCode = hash.get('error_code') || search.get('error_code');
      const errDesc = hash.get('error_description') || search.get('error_description');

      if (errCode === 'otp_expired' || errCode === 'access_denied' || /expired/i.test(errDesc ?? '')) {
        setStatus('expired');
        setMessage(decodeURIComponent(errDesc ?? 'This link has expired.').replace(/\+/g, ' '));
        return;
      }

      const { data: userRes, error } = await supabase.auth.getUser();
      if (error || !userRes.user) {
        setStatus('error');
        setMessage(decodeURIComponent(errDesc ?? error?.message ?? 'Link is invalid or already used.').replace(/\+/g, ' '));
        return;
      }

      // Persist external SSO identifier if it was supplied at signup/magic time.
      const meta = (userRes.user.user_metadata ?? {}) as Record<string, any>;
      const provider = meta.external_provider;
      const externalId = meta.external_id;
      if (provider && externalId) {
        await supabase
          .from('user_external_identifiers')
          .upsert(
            {
              user_id: userRes.user.id,
              provider: String(provider),
              external_id: String(externalId),
              email: userRes.user.email ?? null,
              verified_at: new Date().toISOString(),
              metadata: { account_type: meta.account_type ?? null, organization_name: meta.organization_name ?? null },
            },
            { onConflict: 'provider,external_id' }
          );
      }

      setStatus('success');
      setMessage('Email verified — you are signed in.');
      setTimeout(() => {
        if (meta.account_type === 'institution') navigate('/institution', { replace: true });
        else navigate('/app', { replace: true });
      }, 1500);
    })();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-6 w-6 text-primary" />}
            {status === 'expired' && <Clock className="h-6 w-6 text-destructive" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-destructive" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying…'}
            {status === 'success' && 'Email confirmed'}
            {status === 'expired' && 'This link has expired'}
            {status === 'error' && 'Verification failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {(status === 'expired' || status === 'error') && (
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-3 text-sm space-y-1">
              <p className="font-medium">What to do next</p>
              <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
                <li>{status === 'expired' ? 'Magic links are valid for 15 minutes; verification links for 24 hours.' : 'The link may have already been used or tampered with.'}</li>
                <li>Request a fresh link below — your account is unaffected.</li>
                <li>Use the most recent email; older links stop working once a new one is sent.</li>
              </ol>
            </div>
            <Button asChild className="w-full"><Link to="/auth/email">Request a new link</Link></Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/auth">Back to sign-in</Link></Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
