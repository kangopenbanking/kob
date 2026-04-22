import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Headphones, Mail, Lock, Eye, EyeOff, Loader2, ArrowRight, KeyRound, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import kangLogo from '@/assets/kang-logo.png';

/**
 * Dedicated branded sign-in for Support Agents.
 * URL: /support-agent
 * Authenticates via email + password, then routes to /admin/support-chat.
 * Admins can also use this page; non-agents are blocked with a friendly message.
 */
const SupportAgentLogin: React.FC = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // If already signed in & has agent/admin role, jump straight in.
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;
      const { data: isAgent } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'support_agent' as any });
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' as any });
      if (isAgent || isAdmin) navigate('/admin/support-chat', { replace: true });
    })();
    return () => { mounted = false; };
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      toast({ title: 'Missing details', description: 'Enter your email and password to continue.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error || !data.user) throw new Error(error?.message || 'Invalid credentials');

      const { data: isAgent } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'support_agent' as any });
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: data.user.id, _role: 'admin' as any });
      if (!isAgent && !isAdmin) {
        await supabase.auth.signOut();
        throw new Error('This account is not authorized for the support workspace. Contact your administrator.');
      }
      toast({ title: 'Welcome back', description: 'Signing you into the support workspace…' });
      navigate('/admin/support-chat', { replace: true });
    } catch (err: any) {
      toast({ title: 'Sign-in failed', description: err?.message || 'Could not sign in.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: 'Email required', description: 'Enter your email so we can send a reset link.', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: 'Reset link sent', description: 'Check your inbox for instructions to set a new password.' });
      setMode('login');
    } catch (err: any) {
      toast({ title: 'Could not send reset', description: err?.message || 'Try again in a moment.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-12">
        <div className="grid w-full gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Brand panel */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden flex-col justify-between rounded-2xl border border-border bg-card p-10 lg:flex"
          >
            <div>
              <img src={kangLogo} alt="Kang Open Banking" className="h-10 w-auto" />
              <div className="mt-12 inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
                <Headphones className="h-3.5 w-3.5" /> Support Workspace
              </div>
              <h1 className="mt-5 text-3xl font-semibold tracking-tight text-foreground">
                Welcome back, agent.
              </h1>
              <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
                Sign in to claim live conversations, manage SLAs and collaborate with your team
                across departments.
              </p>
            </div>
            <ul className="mt-10 space-y-4 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 text-foreground" />
                <span>Encrypted sessions with single-active-session enforcement.</span>
              </li>
              <li className="flex items-start gap-3">
                <KeyRound className="mt-0.5 h-4 w-4 text-foreground" />
                <span>Forgotten your password? Reset it with a one-time link sent to your inbox.</span>
              </li>
              <li className="flex items-start gap-3">
                <Headphones className="mt-0.5 h-4 w-4 text-foreground" />
                <span>Heartbeat presence keeps your availability accurate while you work.</span>
              </li>
            </ul>
          </motion.div>

          {/* Form panel */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center"
          >
            <Card className="w-full border-border shadow-sm">
              <CardContent className="p-8 sm:p-10">
                <div className="mb-8 flex items-center justify-between lg:hidden">
                  <img src={kangLogo} alt="Kang" className="h-8 w-auto" />
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Headphones className="h-3.5 w-3.5" /> Support
                  </span>
                </div>

                <h2 className="text-2xl font-semibold text-foreground">
                  {mode === 'login' ? 'Sign in to support' : 'Reset your password'}
                </h2>
                <p className="mt-1.5 text-sm text-muted-foreground">
                  {mode === 'login'
                    ? 'Use the email address your administrator invited.'
                    : 'We will email you a secure link to set a new password.'}
                </p>

                <form onSubmit={mode === 'login' ? handleLogin : handleForgot} className="mt-8 space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Work email</Label>
                    <div className="relative">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        autoComplete="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="agent@kangopenbanking.com"
                        className="h-11 pl-9"
                      />
                    </div>
                  </div>

                  {mode === 'login' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                        <button
                          type="button"
                          className="text-xs font-medium text-foreground underline-offset-4 hover:underline"
                          onClick={() => setMode('forgot')}
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="password"
                          type={showPassword ? 'text' : 'password'}
                          autoComplete="current-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••"
                          className="h-11 pl-9 pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((s) => !s)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  )}

                  <Button type="submit" disabled={loading} className="h-11 w-full text-sm font-medium">
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="mr-2 h-4 w-4" />
                    )}
                    {mode === 'login' ? 'Sign in to support workspace' : 'Send reset link'}
                  </Button>

                  {mode === 'forgot' && (
                    <button
                      type="button"
                      onClick={() => setMode('login')}
                      className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
                    >
                      ← Back to sign in
                    </button>
                  )}
                </form>

                <div className="mt-8 rounded-lg border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">Need access?</p>
                  <p className="mt-1">
                    Support agents are invited by an administrator. If you have not received an
                    invitation email, please contact your team lead.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default SupportAgentLogin;
