// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Loader2, Mail, CheckCircle2, ArrowLeft, RefreshCw, Clock } from 'lucide-react';

type AccountType = 'user' | 'institution';
type Action = 'signup' | 'magic' | 'resend';

export default function EmailAuth() {
  const [accountType, setAccountType] = useState<AccountType>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [externalProvider, setExternalProvider] = useState('');
  const [externalId, setExternalId] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | { type: 'verify' | 'magic'; expiresAt: string; expiresInSeconds: number }>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailRedirectTo = `${window.location.origin}/auth/callback`;

  const startCooldown = (seconds = 30) => {
    setResendCooldown(seconds);
    const iv = setInterval(() => {
      setResendCooldown((s) => { if (s <= 1) { clearInterval(iv); return 0; } return s - 1; });
    }, 1000);
  };

  const call = async (action: Action) => {
    const { data, error } = await supabase.functions.invoke('email-auth-request', {
      body: {
        action,
        email: email.trim().toLowerCase(),
        password: action === 'signup' ? password : undefined,
        accountType,
        organizationName: accountType === 'institution' ? orgName.trim() : undefined,
        externalProvider: externalProvider.trim() || undefined,
        externalId: externalId.trim() || undefined,
        redirectTo: emailRedirectTo,
      },
    });
    if (error || (data as any)?.error) {
      const code = (data as any)?.error ?? error?.message ?? 'send_failed';
      const retry = (data as any)?.retry_after_seconds;
      if (code === 'rate_limited' || code === 'blocked') {
        toast.error(`Too many requests. Try again in ${Math.ceil((retry ?? 1800) / 60)} min.`);
        startCooldown(Math.min(retry ?? 60, 300));
      } else if (code === 'invalid_email') {
        toast.error('Enter a valid email.');
      } else if (code === 'invalid_password') {
        toast.error('Password must be 8+ characters.');
      } else {
        toast.error((data as any)?.message ?? 'Could not send email.');
      }
      return null;
    }
    return data as { expires_at: string; expires_in_seconds: number };
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await call('signup');
    setLoading(false);
    if (!res) return;
    setSent({ type: 'verify', expiresAt: res.expires_at, expiresInSeconds: res.expires_in_seconds });
    startCooldown();
    toast.success('Verification email sent.');
  };

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true);
    const res = await call('magic');
    setLoading(false);
    if (!res) return;
    setSent({ type: 'magic', expiresAt: res.expires_at, expiresInSeconds: res.expires_in_seconds });
    startCooldown();
    toast.success('Magic link sent.');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !sent) return;
    setLoading(true);
    const res = await call(sent.type === 'verify' ? 'resend' : 'magic');
    setLoading(false);
    if (!res) return;
    setSent({ ...sent, expiresAt: res.expires_at, expiresInSeconds: res.expires_in_seconds });
    startCooldown();
    toast.success('Email resent.');
  };

  if (sent) {
    const expiresStr = new Date(sent.expiresAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' });
    const minutes = Math.round(sent.expiresInSeconds / 60);
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>
              We sent a {sent.type === 'verify' ? 'verification' : 'sign-in'} link to<br />
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border bg-muted/50 p-3 text-sm">
              <div className="flex items-center gap-2 font-medium">
                <Clock className="h-4 w-4" /> Link expires in {minutes} minutes
              </div>
              <p className="text-muted-foreground mt-1">Valid until {expiresStr}. After that you'll need a fresh link.</p>
            </div>
            <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-5">
              <li>Open the email and click the secure link.</li>
              <li>You'll return to the app and be signed in automatically.</li>
              <li>If you don't see it, check spam or use Resend below.</li>
            </ol>
            <Button variant="outline" className="w-full" onClick={handleResend} disabled={loading || resendCooldown > 0}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
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
          <CardTitle>Email sign-in</CardTitle>
          <CardDescription>Verify your email or sign in passwordlessly.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Account type</Label>
            <RadioGroup value={accountType} onValueChange={(v) => setAccountType(v as AccountType)} className="grid grid-cols-2 gap-2">
              <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="user" /> User
              </Label>
              <Label className="flex items-center gap-2 border rounded-md p-3 cursor-pointer hover:bg-accent">
                <RadioGroupItem value="institution" /> Institution
              </Label>
            </RadioGroup>
          </div>

          <Tabs defaultValue="signup">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="signup">Verify email</TabsTrigger>
              <TabsTrigger value="magic">Magic link</TabsTrigger>
            </TabsList>

            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-3 pt-3">
                {accountType === 'institution' && (
                  <div className="space-y-1.5">
                    <Label htmlFor="org">Institution name</Label>
                    <Input id="org" value={orgName} onChange={(e) => setOrgName(e.target.value)} required />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="signup-pwd">Password</Label>
                  <Input id="signup-pwd" type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">Optional: link an SSO identifier</summary>
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <Input placeholder="Provider (okta, azure_ad…)" value={externalProvider} onChange={(e) => setExternalProvider(e.target.value)} />
                    <Input placeholder="External ID" value={externalId} onChange={(e) => setExternalId(e.target.value)} />
                  </div>
                  <p className="text-xs text-muted-foreground pt-1">Saved after you confirm your email so future SSO integrations can match this account.</p>
                </details>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send verification email
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form onSubmit={handleMagic} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input id="magic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Send magic link
                </Button>
                <p className="text-xs text-muted-foreground text-center">Magic links expire 15 minutes after we send them.</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm space-x-3">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">All sign-in options</Link>
            <span className="text-muted-foreground">·</span>
            <Link to="/auth/admin-magic" className="text-muted-foreground hover:text-foreground">Admin magic link</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
