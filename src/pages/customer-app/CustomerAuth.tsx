import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft, ArrowRight, Phone, Shield, Loader2, AlertCircle,
  Building2, UserPlus, Mail, Lock, User, Eye, EyeOff, Fingerprint, Smartphone, KeyRound,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { toast } from 'sonner';
import kangLogo from '@/assets/kang-logo.png';
import authBanner from '@/assets/auth-banner.png';
import { API_CONFIG } from '@/config/api';
import { MandatoryPinSetupStep } from '@/components/auth/MandatoryPinSetupStep';

import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

type AuthMode = 'welcome' | 'input' | 'otp' | 'pin' | 'verifying' | 'email-sent' | 'forgot-password' | 'reset-pin' | 'setup-pin';
type AuthTab = 'phone' | 'email';
type AuthIntent = 'signin' | 'signup';

const CustomerAuth: React.FC = () => {
  const { data: supportedCountries = [] } = useSupportedCountries('consumer');
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('welcome');
  const [tab, setTab] = useState<AuthTab>('phone');
  const [intent, setIntent] = useState<AuthIntent>('signin');

  // Phone state
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const fullPhone = `${countryCode}${phoneNumber}`;

  // Email state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // PIN state
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  // Reset PIN state
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetPinLoading, setResetPinLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  // General loading
  const [loading, setLoading] = useState(false);

  const { step: otpStep, loading: otpLoading, error: otpError, sendOTP, verifyOTP, reset: resetOTP } = useFirebasePhoneAuth();

  useEffect(() => {
    if (otpStep === 'otp' && mode === 'input') setMode('otp');
    if (otpStep === 'verifying') setMode('verifying');
  }, [otpStep, mode]);

  // Auto-submit PIN
  useEffect(() => {
    if (mode === 'pin' && pin.length === 6 && !pinLoading) {
      handlePinLogin();
    }
  }, [pin, mode]);

  const navigateAfterAuth = async (userId?: string) => {
    // Retry getUser up to 3 times to handle session propagation delay
    let id = userId;
    if (!id) {
      for (let i = 0; i < 3; i++) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) { id = user.id; break; }
        await new Promise(r => setTimeout(r, 500));
      }
    }
    if (!id) { navigate('/app/register', { replace: true }); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('linked_account_type, pin_code_hash')
      .eq('id', id)
      .maybeSingle();

    if (!profile) { navigate('/app/register', { replace: true }); return; }

    // Check if user needs PIN setup
    if (!(profile as any)?.pin_code_hash) {
      setMode('setup-pin');
      return;
    }

    const lat = (profile as any)?.linked_account_type;
    if (lat && lat !== 'none') {
      navigate('/app/home', { replace: true });
    } else {
      // null or 'none' — user needs onboarding
      navigate('/app/onboarding', { replace: true });
    }
  };

  const handlePhoneContinue = async () => {
    if (phoneNumber.length < 6) { toast.error('Please enter a valid phone number'); return; }
    setLoading(true);
    try {
      if (intent === 'signup') {
        await sendOTP(fullPhone);
        setMode('otp');
      } else {
        const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
          body: { phone_number: fullPhone },
        });
        if (error) {
          toast.error('Could not verify account. Please try again.');
        } else if (data?.has_pin) {
          setMode('pin');
        } else {
          await sendOTP(fullPhone);
          setMode('otp');
        }
      }
    } catch {
      toast.error('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (pin.length !== 6) return;
    setPinLoading(true);
    setPinError(null);
    try {
      // Auto-solve captcha
      const { data: captchaData, error: captchaError } = await supabase.functions.invoke('captcha-generate', { body: {} });
      if (captchaError) throw captchaError;
      const solveCaptcha = (q: string): number => {
        const match = q.match(/(\d+)\s*([+\-*])\s*(\d+)/);
        if (!match) return 0;
        const [, a, op, b] = match;
        if (op === '+') return parseInt(a) + parseInt(b);
        if (op === '-') return parseInt(a) - parseInt(b);
        if (op === '*') return parseInt(a) * parseInt(b);
        return 0;
      };
      await supabase.functions.invoke('captcha-verify', {
        body: { session_id: captchaData.session_id, answer: solveCaptcha(captchaData.question) },
      });

      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: { phone_number: fullPhone, pin_code: pin, captcha_session_id: captchaData.session_id },
      });
      if (error) {
        // Parse structured error from edge function context body
        let parsed: any = null;
        try {
          const body = error.context?.body;
          if (body) {
            parsed = typeof body === 'string' ? JSON.parse(body) : body;
          } else if (typeof error.message === 'string') {
            parsed = JSON.parse(error.message);
          }
        } catch { /* not JSON */ }

        if (parsed?.locked) {
          setPinError(parsed.error || 'Account temporarily locked. Please try again later.');
          setPin('');
          return;
        }
        if (parsed?.remaining_attempts !== undefined) {
          setPinError(`Invalid PIN. ${parsed.remaining_attempts} attempt${parsed.remaining_attempts !== 1 ? 's' : ''} remaining.`);
          setPin('');
          return;
        }
        throw new Error(parsed?.error || extractEdgeFunctionError(error, 'PIN login failed'));
      }

      if (data?.success && data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        toast.success('Welcome back!');
        await navigateAfterAuth(data.user_id);
      } else {
        const remaining = data?.remaining_attempts;
        setPinError(`Invalid PIN.${remaining !== undefined ? ` ${remaining} attempts remaining.` : ''}`);
        setPin('');
      }
    } catch (err: any) {
      setPinError(err.message || 'PIN login failed');
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  // Track whether user initiated PIN reset flow (needs OTP first)
  const [pendingPinReset, setPendingPinReset] = useState(false);

  const handleVerifyOTP = async (code: string) => {
    if (code.length !== 6) return;
    const success = await verifyOTP(code);
    if (success) {
      toast.success('Verified!');
      // If user was resetting their PIN, go to reset-pin screen now that OTP is verified
      if (pendingPinReset) {
        setPendingPinReset(false);
        setMode('reset-pin');
        return;
      }
      // Both signup and signin flow through navigateAfterAuth
      // which handles PIN check and linked_account_type routing
      await navigateAfterAuth();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (intent === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { full_name: fullName }, emailRedirectTo: `${window.location.origin}/app/auth` },
        });
        if (error) throw error;
        // If auto-confirmed (e.g. after email click), go to PIN setup
        if (signUpData?.session) {
          setMode('setup-pin');
        } else {
          setMode('email-sent');
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success('Welcome back!');
        await navigateAfterAuth();
      }
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Authentication failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast.error('Please enter your email'); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/app/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast.success('Password reset email sent!');
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to send reset email'));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (newPin.length !== 6 || confirmNewPin.length !== 6) {
      toast.error('Please enter a 6-digit PIN');
      return;
    }
    if (newPin !== confirmNewPin) {
      toast.error('PINs do not match');
      return;
    }
    setResetPinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pin-code-reset', {
        body: { phone_number: fullPhone, new_pin_code: newPin },
      });
      if (error) throw error;
      if (data?.success) {
        toast.success('PIN reset successfully! Please sign in.');
        setNewPin('');
        setConfirmNewPin('');
        setMode('input');
      } else {
        throw new Error(data?.error || 'Failed to reset PIN');
      }
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, 'Failed to reset PIN'));
    } finally {
      setResetPinLoading(false);
    }
  };

  const handleBack = () => {
    if (mode === 'otp') { resetOTP(); setPendingPinReset(false); setMode('input'); }
    else if (mode === 'pin') { setMode('input'); setPin(''); setPinError(null); }
    else if (mode === 'input') { setMode('welcome'); }
    else if (mode === 'forgot-password') { setMode('input'); setForgotSent(false); setForgotEmail(''); }
    else if (mode === 'reset-pin') { setMode('pin'); setNewPin(''); setConfirmNewPin(''); }
    else { navigate('/app'); }
  };

  const headerTitle = () => {
    switch (mode) {
      case 'welcome': return 'Kang';
      case 'input': return intent === 'signup' ? 'Create Account' : 'Welcome Back';
      case 'pin': return 'Enter Your PIN';
      case 'otp': return 'Verify Code';
      case 'verifying': return 'Verifying...';
      case 'email-sent': return 'Check Your Email';
      case 'forgot-password': return 'Reset Password';
      case 'reset-pin': return 'Reset PIN';
      case 'setup-pin': return 'Set Your PIN';
    }
  };

  const headerSubtitle = () => {
    switch (mode) {
      case 'welcome': return 'Your money, simplified.';
      case 'input': return intent === 'signup' ? 'Sign up to get started' : 'Sign in to your account';
      case 'pin': return `Logging in as ${countryCode} ${phoneNumber}`;
      case 'otp': return `Code sent to ${countryCode} ${phoneNumber}`;
      case 'verifying': return 'Please wait...';
      case 'email-sent': return 'Almost there!';
      case 'forgot-password': return 'Enter your email to receive a reset link';
      case 'reset-pin': return 'Set a new 6-digit PIN';
      case 'setup-pin': return 'Required for secure access';
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-primary/5 via-background to-background">
      <div id="recaptcha-container" />

      {/* Hero Header */}
      <div className="relative overflow-hidden px-6 pb-16 pt-12" style={{ minHeight: 220 }}>
        <img src={authBanner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-primary/60" />
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[hsl(0,0%,100%)]/[0.08]" />
        <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />
        <div className="absolute right-8 bottom-12 h-16 w-16 rounded-full bg-[hsl(0,0%,100%)]/[0.06]" />

        {mode !== 'welcome' && (
          <button onClick={handleBack} className="relative z-10 mb-4 flex h-9 w-9 items-center justify-center rounded-xl bg-[hsl(0,0%,100%)]/15">
            <ArrowLeft className="h-4 w-4 text-primary-foreground" strokeWidth={2} />
          </button>
        )}

        <motion.div
          key={mode}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20 shadow-lg backdrop-blur-sm">
            <img src={kangLogo} alt="Kang" className="h-10 w-10 rounded-xl object-contain" />
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">{headerTitle()}</h1>
          <p className="mt-1 text-sm text-primary-foreground/70">{headerSubtitle()}</p>
        </motion.div>
      </div>

      {/* Main Card */}
      <div className="relative z-10 -mt-8 flex flex-1 flex-col px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-black/5"
        >
          <AnimatePresence mode="wait">
            {/* Welcome */}
            {mode === 'welcome' && (
              <motion.div key="welcome" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="flex flex-col gap-4">
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Secure & Simple</p>
                    <p className="text-[11px] text-muted-foreground">PIN-protected access to your finances</p>
                  </div>
                </div>

                <Button
                  onClick={() => { setIntent('signin'); setMode('input'); }}
                  className="h-14 gap-2 rounded-xl text-base font-semibold shadow-md shadow-primary/20"
                  size="lg"
                >
                  Sign In
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Button>
                <Button
                  onClick={() => { setIntent('signup'); setMode('input'); }}
                  variant="outline"
                  className="h-14 gap-2 rounded-xl border-border/60 text-base font-semibold"
                  size="lg"
                >
                  <UserPlus className="h-5 w-5" strokeWidth={1.5} />
                  Create Account
                </Button>
              </motion.div>
            )}

            {/* Input Step (Phone / Email Tabs) */}
            {mode === 'input' && (
              <motion.div key="input" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} transition={{ duration: 0.25 }} className="flex flex-col gap-5">
                {/* Tab Switcher */}
                <div className="flex rounded-xl bg-muted p-1">
                  <button
                    onClick={() => setTab('phone')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${tab === 'phone' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Phone className="h-4 w-4" strokeWidth={1.5} />
                    Phone
                  </button>
                  <button
                    onClick={() => setTab('email')}
                    className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-all ${tab === 'email' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    <Mail className="h-4 w-4" strokeWidth={1.5} />
                    Email
                  </button>
                </div>

                <AnimatePresence mode="wait">
                  {tab === 'phone' && (
                    <motion.div key="phone-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="flex flex-col gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Phone Number</Label>
                        <div className="flex gap-2">
                          <Select value={countryCode} onValueChange={setCountryCode}>
                            <SelectTrigger className="w-[110px] rounded-xl border-border/60">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {supportedCountries.map(cc => (
                                <SelectItem key={`${cc.dial_code}-${cc.code}`} value={cc.dial_code}>{cc.flag} {cc.dial_code}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div className="relative flex-1">
                            <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                            <Input
                              type="tel"
                              placeholder="6 XX XX XX XX"
                              value={phoneNumber}
                              onChange={e => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                              className="rounded-xl border-border/60 pl-10"
                            />
                          </div>
                        </div>
                      </div>

                      <Button
                        onClick={handlePhoneContinue}
                        disabled={loading || otpLoading || phoneNumber.length < 6}
                        className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20"
                        size="lg"
                      >
                        {loading ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <>Continue <ArrowRight className="h-4 w-4" strokeWidth={2} /></>
                        )}
                      </Button>
                    </motion.div>
                  )}

                  {tab === 'email' && (
                    <motion.div key="email-tab" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                      <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                        {intent === 'signup' && (
                          <div className="space-y-2">
                            <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                            <div className="relative">
                              <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                              <Input id="fullName" placeholder="John Doe" value={fullName} onChange={e => setFullName(e.target.value)} className="rounded-xl border-border/60 pl-10" required />
                            </div>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                          <div className="relative">
                            <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                            <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} className="rounded-xl border-border/60 pl-10" required />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                          <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                            <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={password} onChange={e => setPassword(e.target.value)} className="rounded-xl border-border/60 pl-10 pr-10" required minLength={8} />
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                            </button>
                          </div>
                        </div>

                        <Button type="submit" className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20" size="lg" disabled={loading}>
                          {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
                            <>{intent === 'signin' ? 'Sign In' : 'Create Account'} <ArrowRight className="h-4 w-4" strokeWidth={2} /></>
                          )}
                        </Button>

                        {intent === 'signin' && (
                          <Button
                            type="button"
                            variant="link"
                            className="w-full text-sm text-primary"
                            onClick={() => { setForgotEmail(email); setMode('forgot-password'); }}
                          >
                            Forgot Password?
                          </Button>
                        )}
                      </form>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* PIN Entry */}
            {mode === 'pin' && (
              <motion.div key="pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Fingerprint className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Enter your 6-digit security PIN</p>
                  {pinError && (
                    <motion.p initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="mt-2 text-sm font-medium text-destructive">
                      {pinError}
                    </motion.p>
                  )}
                </div>

                <div className="py-2">
                  <InputOTP maxLength={6} value={pin} onChange={val => { setPin(val); setPinError(null); }}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-xl border-border/60 text-lg font-bold shadow-sm" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {pinLoading && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying PIN...
                  </motion.div>
                )}

                <div className="flex w-full flex-col gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setPin(''); setPinError(null);
                      await sendOTP(fullPhone);
                      setMode('otp');
                    }}
                    className="w-full gap-2 text-sm"
                  >
                    <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                    Forgot PIN? Use OTP instead
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setPin(''); setPinError(null);
                      setPendingPinReset(true);
                      await sendOTP(fullPhone);
                      setMode('otp');
                    }}
                    className="w-full gap-2 text-sm text-destructive"
                  >
                    <Lock className="h-4 w-4" strokeWidth={1.5} />
                    Reset My PIN
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setMode('input'); setPin(''); setPinError(null); setPhoneNumber(''); }} className="gap-1.5 text-xs text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Change phone number
                  </Button>
                </div>
              </motion.div>
            )}

            {/* OTP Verification */}
            {mode === 'otp' && (
              <motion.div key="otp" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Smartphone className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Enter the 6-digit code</p>
                  <p className="mt-1 text-xs text-muted-foreground">Sent to {countryCode} {phoneNumber}</p>
                </div>

                <div className="py-2">
                  <InputOTP maxLength={6} onChange={val => { if (val.length === 6) handleVerifyOTP(val); }}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot key={i} index={i} className="h-14 w-12 rounded-xl border-border/60 text-lg font-bold shadow-sm" />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {otpError && (
                  <div className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs">{otpError}</span>
                  </div>
                )}
                {otpLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}

                <div className="flex gap-4">
                  <Button variant="ghost" size="sm" onClick={() => { setMode('input'); resetOTP(); }} className="text-xs text-muted-foreground gap-1">
                    <ArrowLeft className="h-3 w-3" /> Change Number
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => sendOTP(fullPhone)} disabled={otpLoading} className="text-xs text-primary">
                    Resend Code
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Email Sent Confirmation */}
            {mode === 'email-sent' && (
              <motion.div key="email-sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold text-foreground">Verification email sent to</p>
                  <p className="text-sm font-bold text-primary">{email}</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    Please check your inbox and click the verification link to activate your account. Check your spam folder if you don't see it.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const { error } = await supabase.auth.resend({ type: 'signup', email });
                      if (error) throw error;
                      toast.success('Verification email resent! Check your inbox.');
                    } catch (err: any) {
                      toast.error(extractEdgeFunctionError(err, 'Failed to resend verification email'));
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full gap-2 rounded-xl py-5 text-sm font-semibold"
                >
                  <Mail className="h-4 w-4" />
                  {loading ? 'Sending...' : 'Resend Verification Email'}
                </Button>
                <Button
                  onClick={() => { setMode('input'); setIntent('signin'); }}
                  className="w-full gap-2 rounded-xl py-5 text-sm font-semibold"
                  variant="outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Button>
              </motion.div>
            )}

            {/* Forgot Password */}
            {mode === 'forgot-password' && (
              <motion.div key="forgot-password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                {forgotSent ? (
                  <div className="text-center space-y-3 w-full">
                    <p className="text-sm font-semibold text-foreground">Reset link sent!</p>
                    <p className="text-sm font-bold text-primary">{forgotEmail}</p>
                    <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">
                      Check your email and click the link to reset your password. Check spam if you don't see it.
                    </p>
                    <Button onClick={() => { setMode('input'); setForgotSent(false); }} variant="outline" className="w-full gap-2 rounded-xl py-5 mt-4">
                      <ArrowLeft className="h-4 w-4" /> Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        <Input
                          type="email"
                          placeholder="you@example.com"
                          value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          className="rounded-xl border-border/60 pl-10"
                        />
                      </div>
                    </div>
                    <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail} className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20" size="lg">
                      {forgotLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Send Reset Link <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setMode('input')} className="w-full gap-1.5 text-xs text-muted-foreground">
                      <ArrowLeft className="h-3 w-3" /> Back to Sign In
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Reset PIN */}
            {mode === 'reset-pin' && (
              <motion.div key="reset-pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <KeyRound className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">First, verify your OTP above</p>
                  <p className="text-xs text-muted-foreground mt-1">Then enter your new 6-digit PIN below</p>
                </div>

                <div className="w-full space-y-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">New PIN</Label>
                    <InputOTP maxLength={6} value={newPin} onChange={setNewPin}>
                      <InputOTPGroup className="gap-2 justify-center">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <InputOTPSlot key={i} index={i} className="h-12 w-10 rounded-xl border-border/60 text-lg font-bold shadow-sm" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Confirm New PIN</Label>
                    <InputOTP maxLength={6} value={confirmNewPin} onChange={setConfirmNewPin}>
                      <InputOTPGroup className="gap-2 justify-center">
                        {[0, 1, 2, 3, 4, 5].map(i => (
                          <InputOTPSlot key={i} index={i} className="h-12 w-10 rounded-xl border-border/60 text-lg font-bold shadow-sm" />
                        ))}
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    onClick={handleResetPin}
                    disabled={resetPinLoading || newPin.length !== 6 || confirmNewPin.length !== 6}
                    className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20"
                    size="lg"
                  >
                    {resetPinLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Reset PIN <ArrowRight className="h-4 w-4" /></>}
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => { setMode('input'); setNewPin(''); setConfirmNewPin(''); }} className="w-full gap-1.5 text-xs text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Mandatory PIN Setup after signup */}
            {mode === 'setup-pin' && (
              <motion.div key="setup-pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <MandatoryPinSetupStep onComplete={() => navigateAfterAuth()} />
              </motion.div>
            )}

            {mode === 'verifying' && (
              <motion.div key="verifying" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center gap-4 py-12">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm font-semibold text-foreground">Verifying...</p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Trust Badges */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-8 flex flex-col items-center gap-3 pb-8">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>256-bit SSL encrypted</span>
            <span className="mx-1">·</span>
            <span>COBAC Licensed</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40">© {new Date().getFullYear()} Kang. All rights reserved.</p>
        </motion.div>
      </div>
    </div>
  );
};

export default CustomerAuth;
