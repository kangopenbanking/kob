// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// Admin magic-link request. Send-side enforces admin role; the response
// is deliberately uniform to prevent email enumeration.
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Shield, Mail, Clock, ArrowLeft, RefreshCw } from 'lucide-react';

export default function AdminMagicLink() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | { expiresAt: string }>(null);
  const [cooldown, setCooldown] = useState(0);

  const startCooldown = (s = 30) => {
    setCooldown(s);
    const iv = setInterval(() => setCooldown((c) => { if (c <= 1) { clearInterval(iv); return 0; } return c - 1; }), 1000);
  };

  const send = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke('email-auth-request', {
      body: {
        action: 'admin_magic',
        email: email.trim().toLowerCase(),
        accountType: 'institution',
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) { toast.error('Could not process request.'); return; }
    const d = data as any;
    if (d?.error === 'rate_limited' || d?.error === 'blocked') {
      toast.error(`Too many requests. Try again in ${Math.ceil((d.retry_after_seconds ?? 1800) / 60)} min.`);
      return;
    }
    setSent({ expiresAt: d?.expires_at ?? new Date(Date.now() + 15 * 60_000).toISOString() });
    startCooldown();
    toast.success('If the email is registered as an institution admin, a magic link has been sent.');
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); if (!email) return; send(); };

  if (sent) {
    const expires = new Date(sent.expiresAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check the inbox</CardTitle>
            <CardDescription>
              If <span className="font-medium text-foreground">{email}</span> is registered as an institution admin,
              a one-click sign-in link is on its way.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium"><Clock className="h-4 w-4" /> Link expires in 15 minutes</div>
              <p className="text-muted-foreground mt-1">Valid until {expires}. Access is restricted to admin accounts only.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={send} disabled={loading || cooldown > 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => setSent(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Use a different email
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2"><Shield className="h-5 w-5 text-primary" /><CardTitle>Admin magic link</CardTitle></div>
          <CardDescription>For institution administrators. Access is restricted to accounts with the admin role.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="admin-email">Admin email</Label>
              <Input id="admin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@yourbank.com" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
              Send admin magic link
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Non-admin emails receive the same on-screen response — no link is sent.
            </p>
          </form>
          <div className="text-center text-sm mt-4">
            <Link to="/auth/email" className="text-muted-foreground hover:text-foreground">Standard email sign-in</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
