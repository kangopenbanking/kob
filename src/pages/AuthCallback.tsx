// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle2, XCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your email…');

  useEffect(() => {
    const run = async () => {
      // Supabase parses tokens from the URL hash and sets the session automatically.
      // Give it a tick to process, then read the session.
      await new Promise((r) => setTimeout(r, 200));
      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) {
        // Try error in hash
        const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        const err = hash.get('error_description') || error?.message || 'Link is invalid or expired.';
        setStatus('error');
        setMessage(err);
        return;
      }
      setStatus('success');
      setMessage('Your email is verified and you are signed in.');
      const accountType = (data.session.user.user_metadata as any)?.account_type;
      setTimeout(() => {
        if (accountType === 'institution') navigate('/institution', { replace: true });
        else navigate('/app', { replace: true });
      }, 1500);
    };
    run();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            {status === 'loading' && <Loader2 className="h-6 w-6 text-primary animate-spin" />}
            {status === 'success' && <CheckCircle2 className="h-6 w-6 text-primary" />}
            {status === 'error' && <XCircle className="h-6 w-6 text-destructive" />}
          </div>
          <CardTitle>
            {status === 'loading' && 'Verifying…'}
            {status === 'success' && 'Email confirmed'}
            {status === 'error' && 'Verification failed'}
          </CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        {status === 'error' && (
          <CardContent className="space-y-2">
            <Button asChild className="w-full"><Link to="/auth/email">Request a new link</Link></Button>
            <Button asChild variant="ghost" className="w-full"><Link to="/auth">Back to sign-in</Link></Button>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
