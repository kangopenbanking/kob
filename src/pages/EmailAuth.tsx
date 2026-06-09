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
import { Loader2, Mail, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';

type AccountType = 'user' | 'institution';

export default function EmailAuth() {
  const [accountType, setAccountType] = useState<AccountType>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<null | 'verify' | 'magic'>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  const emailRedirectTo = `${window.location.origin}/auth/callback`;

  const startCooldown = () => {
    setResendCooldown(30);
    const iv = setInterval(() => {
      setResendCooldown((s) => {
        if (s <= 1) { clearInterval(iv); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    if (accountType === 'institution' && !orgName.trim()) {
      toast.error('Please enter your institution name');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          account_type: accountType,
          ...(accountType === 'institution' ? { organization_name: orgName.trim() } : {}),
        },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent('verify');
    startCooldown();
    toast.success('Verification email sent. Check your inbox.');
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo,
        shouldCreateUser: true,
        data: { account_type: accountType },
      },
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setSent('magic');
    startCooldown();
    toast.success('Magic link sent. Check your inbox.');
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !email) return;
    setLoading(true);
    let error;
    if (sent === 'verify') {
      ({ error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo } }));
    } else {
      ({ error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo, shouldCreateUser: true, data: { account_type: accountType } },
      }));
    }
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    startCooldown();
    toast.success('Email resent.');
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Mail className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Check your inbox</CardTitle>
            <CardDescription>
              {sent === 'verify'
                ? 'We sent a verification link to'
                : 'We sent a passwordless sign-in link to'}
              <br />
              <span className="font-medium text-foreground">{email}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              variant="outline"
              className="w-full"
              onClick={handleResend}
              disabled={loading || resendCooldown > 0}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend email'}
            </Button>
            <Button variant="ghost" className="w-full" onClick={() => { setSent(null); }}>
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
            <RadioGroup
              value={accountType}
              onValueChange={(v) => setAccountType(v as AccountType)}
              className="grid grid-cols-2 gap-2"
            >
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Mail className="h-4 w-4 mr-2" />}
                  Send verification email
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="magic">
              <form onSubmit={handleMagicLink} className="space-y-3 pt-3">
                <div className="space-y-1.5">
                  <Label htmlFor="magic-email">Email</Label>
                  <Input id="magic-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                  Send magic link
                </Button>
                <p className="text-xs text-muted-foreground text-center">No password needed — we'll email you a one-click sign-in link.</p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="text-center text-sm">
            <Link to="/auth" className="text-muted-foreground hover:text-foreground">Back to all sign-in options</Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
