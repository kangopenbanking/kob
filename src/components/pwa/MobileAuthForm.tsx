import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, ArrowLeft, Phone, Smartphone, KeyRound, Shield, Fingerprint } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from './TenantProvider';
import { supabase } from '@/integrations/supabase/client';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { enforceSingleSession } from '@/hooks/useSingleSession';
import { useToast } from '@/hooks/use-toast';
import { sounds } from '@/lib/sounds';
import { API_CONFIG } from '@/config/api';
import kangLogo from '@/assets/kang-logo.png';
import { MandatoryPinSetupStep } from '@/components/auth/MandatoryPinSetupStep';

import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import { SafeImage } from "@/components/common/SafeImage";

type AuthStep = 'phone' | 'pin' | 'otp' | 'email' | 'email-sent' | 'forgot-password' | 'reset-pin' | 'setup-pin';

interface MobileAuthFormProps {
  onAuthSuccess: () => void;
  onApplyAccount?: () => void;
}

export const MobileAuthForm: React.FC<MobileAuthFormProps> = ({ onAuthSuccess, onApplyAccount }) => {
  const { data: supportedCountries = [] } = useSupportedCountries('banking');
  const { toast } = useToast();
  const tenant = useTenant();
  const [step, setStep] = useState<AuthStep>('phone');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });

  // Phone auth state
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  // MobileAuthForm is login-only (signup happens elsewhere); default opts are fine.
  const firebasePhone = useFirebasePhoneAuth({ otpType: 'login', countryCode });

  // PIN login state
  const [pinCode, setPinCode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [userHasPin, setUserHasPin] = useState(false);
  const [checkingPin, setCheckingPin] = useState(false);

  // Reset PIN state
  const [newPin, setNewPin] = useState('');
  const [confirmNewPin, setConfirmNewPin] = useState('');
  const [resetPinLoading, setResetPinLoading] = useState(false);

  // Forgot password state
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  const fullPhone = `${countryCode}${phoneNumber}`;

  const handleCheckPin = async () => {
    if (!phoneNumber || phoneNumber.length < 6) return;
    setCheckingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: fullPhone },
      });
      if (!error && data?.has_pin) {
        setUserHasPin(true);
      } else {
        setUserHasPin(false);
      }
    } catch {
      setUserHasPin(false);
    } finally {
      setCheckingPin(false);
    }
  };

  const handleContinue = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast({ title: 'Invalid', description: 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    setLoading(true);
    await handleCheckPin();
    setLoading(false);
    // After checking, go to PIN if user has one, otherwise send OTP
    // We use a small delay to let state update
    setTimeout(() => {
      // Re-read the state via a ref-like approach
    }, 100);
  };

  // Effect to transition after pin check
  useEffect(() => {
    if (!checkingPin && phoneNumber.length >= 6 && loading === false) {
      // Only auto-transition after explicit continue
    }
  }, [checkingPin, userHasPin]);

  const handleGoToPin = () => {
    setPinCode('');
    setPinError(null);
    setStep('pin');
  };

  const handleGoToOtp = async () => {
    setStep('otp');
    const fp = `${countryCode}${phoneNumber}`;
    await firebasePhone.sendOTP(fp);
  };

  const handlePhoneContinue = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast({ title: 'Invalid', description: 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: fullPhone },
      });
      if (error) {
        toast({ title: 'Error', description: 'Could not verify account. Please try again.', variant: 'destructive' });
      } else if (data?.has_pin) {
        setUserHasPin(true);
        setStep('pin');
      } else {
        setUserHasPin(false);
        // Send OTP directly
        await firebasePhone.sendOTP(fullPhone);
        setStep('otp');
      }
    } catch {
      toast({ title: 'Error', description: 'Connection error. Please try again.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (pinCode.length !== 6) return;
    setPinLoading(true);
    setPinError(null);
    try {
      // Generate captcha
      const { data: captchaData, error: captchaError } = await supabase.functions.invoke('captcha-generate', { body: {} });
      if (captchaError) throw captchaError;

      // Solve the simple math captcha (e.g. "1 + 1")
      const solveCaptcha = (q: string): number => {
        const match = q.match(/(\d+)\s*([+\-*])\s*(\d+)/);
        if (!match) return 0;
        const [, a, op, b] = match;
        if (op === '+') return parseInt(a) + parseInt(b);
        if (op === '-') return parseInt(a) - parseInt(b);
        if (op === '*') return parseInt(a) * parseInt(b);
        return 0;
      };
      const captchaAnswer = solveCaptcha(captchaData.question);

      // Auto-verify captcha
      const { error: verifyError } = await supabase.functions.invoke('captcha-verify', {
        body: { session_id: captchaData.session_id, answer: captchaAnswer },
      });
      if (verifyError) throw verifyError;

      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: { phone_number: fullPhone, pin_code: pinCode, captcha_session_id: captchaData.session_id },
      });
      if (error) {
        try {
          const parsed = typeof error === 'object' && error.message ? JSON.parse(error.message) : null;
          if (parsed?.locked) throw new Error(parsed.error || 'Account locked');
          if (parsed?.remaining_attempts !== undefined) {
            sounds.error();
            setPinError(`Invalid PIN. ${parsed.remaining_attempts} attempts remaining.`);
            setPinCode('');
            return;
          }
          throw new Error(parsed?.error || error.message || 'PIN login failed');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw error;
          throw parseErr;
        }
      }

      if (data?.success && data?.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
        const { data: { session } } = await supabase.auth.getSession();
        if (session) await enforceSingleSession(session.access_token);
        sounds.success();
        toast({ title: 'Welcome back!', description: 'Login successful!' });
        onAuthSuccess();
      } else {
        sounds.error();
        const remaining = data?.remaining_attempts;
        setPinError(`Invalid PIN.${remaining !== undefined ? ` ${remaining} attempts remaining.` : ''}`);
        setPinCode('');
      }
    } catch (err: any) {
      sounds.error();
      setPinError(err.message || 'PIN login failed');
      setPinCode('');
    } finally {
      setPinLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast({ title: 'Invalid', description: 'Please enter the 6-digit code', variant: 'destructive' });
      return;
    }
    const success = await firebasePhone.verifyOTP(otpCode);
    if (success) {
      // Retry session retrieval to handle propagation delay
      let session = null;
      for (let i = 0; i < 3; i++) {
        const { data } = await supabase.auth.getSession();
        if (data.session) { session = data.session; break; }
        await new Promise(r => setTimeout(r, 500));
      }
      if (session) await enforceSingleSession(session.access_token);
      // Check if user has a PIN set — if not, require setup
      const { data: profile } = await supabase
        .from('profiles')
        .select('pin_code_hash')
        .eq('id', session?.user?.id || '')
        .maybeSingle();
      if (!profile?.pin_code_hash) {
        setStep('setup-pin');
        return;
      }
      sounds.success();
      onAuthSuccess();
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: { data: { full_name: form.fullName }, emailRedirectTo: `${window.location.origin}${window.location.pathname}` },
        });
        if (error) throw error;
        if (signUpData?.session) {
          setStep('setup-pin');
        } else {
          setStep('email-sent');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password });
        if (error) throw error;
        if (data.session) await enforceSingleSession(data.session.access_token);
        sounds.success();
        onAuthSuccess();
      }
    } catch (err: any) {
      sounds.error();
      toast({ title: 'Error', description: err.message || 'Authentication failed', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!forgotEmail) { toast({ title: 'Required', description: 'Please enter your email', variant: 'destructive' }); return; }
    setForgotLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
      toast({ title: 'Email sent', description: 'Password reset email sent!' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to send reset email', variant: 'destructive' });
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPin = async () => {
    if (newPin.length !== 6 || confirmNewPin.length !== 6) { toast({ title: 'Invalid', description: 'Please enter a 6-digit PIN', variant: 'destructive' }); return; }
    if (newPin !== confirmNewPin) { toast({ title: 'Mismatch', description: 'PINs do not match', variant: 'destructive' }); return; }
    setResetPinLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('pin-code-reset', {
        body: { phone_number: fullPhone, new_pin_code: newPin },
      });
      if (error) throw error;
      if (data?.success) {
        sounds.success();
        toast({ title: 'PIN Reset', description: 'PIN reset successfully! Please sign in.' });
        setNewPin(''); setConfirmNewPin(''); setStep('phone');
      } else { throw new Error(data?.error || 'Failed to reset PIN'); }
    } catch (err: any) {
      sounds.error();
      toast({ title: 'Error', description: err.message || 'Failed to reset PIN', variant: 'destructive' });
    } finally {
      setResetPinLoading(false);
    }
  };

  // Auto-submit PIN when 6 digits entered
  useEffect(() => {
    if (step === 'pin' && pinCode.length === 6 && !pinLoading) {
      handlePinLogin();
    }
  }, [pinCode, step]);

  const logoSrc = tenant.logoUrl || kangLogo;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div id="recaptcha-container" />

      {/* Top decorative area */}
      <div className="relative overflow-hidden bg-primary px-6 pb-16 pt-12">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-[hsl(0,0%,100%)]/[0.08]" />
        <div className="absolute -left-8 bottom-4 h-28 w-28 rounded-full bg-[hsl(0,0%,100%)]/[0.05]" />
        <div className="absolute right-8 bottom-12 h-16 w-16 rounded-full bg-[hsl(0,0%,100%)]/[0.06]" />

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(0,0%,100%)]/20 shadow-lg backdrop-blur-sm">
            <SafeImage src={logoSrc} alt={tenant.name} className="h-10 w-10 rounded-xl object-contain" />
          </div>
          <h1 className="text-xl font-bold text-primary-foreground">
            {step === 'phone' ? 'Welcome Back' : step === 'pin' ? 'Enter Your PIN' : step === 'otp' ? 'Verify Code' : step === 'email-sent' ? 'Check Your Email' : step === 'forgot-password' ? 'Reset Password' : step === 'reset-pin' ? 'Reset PIN' : step === 'setup-pin' ? 'Set Your PIN' : 'Sign In'}
          </h1>
          <p className="mt-1 text-sm text-primary-foreground/70">
            {step === 'phone' ? tenant.tagline : step === 'pin' ? `Logging in as ${countryCode} ${phoneNumber}` : step === 'otp' ? `Code sent to ${countryCode} ${phoneNumber}` : step === 'email-sent' ? 'Almost there!' : step === 'forgot-password' ? 'Enter your email to receive a reset link' : step === 'reset-pin' ? 'Set a new 6-digit PIN' : step === 'setup-pin' ? 'Required for secure access' : `Access your ${tenant.name} account`}
          </p>
        </motion.div>
      </div>

      {/* Main card */}
      <div className="relative z-10 -mt-8 flex flex-1 flex-col px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="rounded-2xl border border-border/50 bg-card p-6 shadow-xl shadow-black/5"
        >
          <AnimatePresence mode="wait">
            {/* Step: Phone Number Entry */}
            {step === 'phone' && (
              <motion.div
                key="phone"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col gap-5"
              >
                <div className="flex items-center gap-3 rounded-xl bg-primary/5 p-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Shield className="h-5 w-5 text-primary" strokeWidth={1.5} />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-foreground">Secure Login</p>
                    <p className="text-[11px] text-muted-foreground">Your PIN keeps your account safe</p>
                  </div>
                </div>

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
                  className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20"
                  size="lg"
                  disabled={loading || phoneNumber.length < 6}
                >
                  {loading ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <>
                      Continue
                      <ArrowRight className="h-4 w-4" strokeWidth={2} />
                    </>
                  )}
                </Button>

                <div className="relative my-1">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                  <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or</span></div>
                </div>

                <Button
                  variant="outline"
                  onClick={() => setStep('email')}
                  className="w-full gap-2 rounded-xl border-border/60 py-5"
                  size="lg"
                >
                  <Mail className="h-4 w-4" strokeWidth={1.5} />
                  Sign in with Email
                </Button>

                {onApplyAccount && (
                  <button
                    type="button"
                    onClick={onApplyAccount}
                    className="mt-1 text-center text-sm text-primary font-medium hover:underline"
                  >
                    Not yet a customer? Apply for an account →
                  </button>
                )}
              </motion.div>
            )}

            {/* Step: PIN Entry */}
            {step === 'pin' && (
              <motion.div
                key="pin"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-5"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Fingerprint className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Enter your 6-digit security PIN</p>
                  {pinError && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-2 text-sm font-medium text-destructive"
                    >
                      {pinError}
                    </motion.p>
                  )}
                </div>

                <div className="py-2">
                  <InputOTP maxLength={6} value={pinCode} onChange={(val) => { setPinCode(val); setPinError(null); }}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-14 w-12 rounded-xl border-border/60 text-lg font-bold shadow-sm"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                {pinLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-4 w-4 rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                    Verifying PIN...
                  </motion.div>
                )}

                <div className="flex w-full flex-col gap-2 pt-2">
                  <Button
                    variant="ghost"
                    onClick={async () => {
                      setPinCode('');
                      setPinError(null);
                      await firebasePhone.sendOTP(fullPhone);
                      setStep('otp');
                    }}
                    className="w-full gap-2 text-sm"
                  >
                    <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                    Forgot PIN? Use OTP instead
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setStep('phone'); setPinCode(''); setPinError(null); setPhoneNumber(''); }}
                    className="gap-1.5 text-xs text-muted-foreground"
                  >
                    <ArrowLeft className="h-3 w-3" />
                    Change phone number
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step: OTP Verification */}
            {step === 'otp' && (
              <motion.div
                key="otp"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="flex flex-col items-center gap-5"
              >
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Smartphone className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>

                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Enter the 6-digit code</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sent to {countryCode} {phoneNumber}
                  </p>
                </div>

                <div className="py-2">
                  <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                    <InputOTPGroup className="gap-2">
                      {[0, 1, 2, 3, 4, 5].map(i => (
                        <InputOTPSlot
                          key={i}
                          index={i}
                          className="h-14 w-12 rounded-xl border-border/60 text-lg font-bold shadow-sm"
                        />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>

                <Button
                  onClick={handleVerifyOTP}
                  className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20"
                  size="lg"
                  disabled={firebasePhone.loading || otpCode.length !== 6}
                >
                  {firebasePhone.loading ? 'Verifying...' : 'Verify & Sign In'}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Button>

                <div className="flex gap-4">
                  <Button variant="ghost" size="sm" onClick={() => { setStep('phone'); setOtpCode(''); firebasePhone.reset(); }} className="text-xs text-muted-foreground gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Change Number
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => firebasePhone.sendOTP(fullPhone)} disabled={firebasePhone.loading} className="text-xs text-primary">
                    Resend Code
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step: Email Login */}
            {step === 'email' && (
              <motion.div
                key="email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
              >
                <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
                  {mode === 'signup' && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium">Full Name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        <Input id="fullName" placeholder="John Doe" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="rounded-xl border-border/60 pl-10" required />
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                      <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="rounded-xl border-border/60 pl-10" required />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                      <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="rounded-xl border-border/60 pl-10 pr-10" required minLength={8} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20" size="lg" disabled={loading}>
                    {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Button>

                  {mode === 'login' && (
                    <Button type="button" variant="link" className="w-full text-sm text-primary" onClick={() => { setForgotEmail(form.email); setStep('forgot-password'); }}>
                      Forgot Password?
                    </Button>
                  )}
                </form>

                <div className="mt-4 text-center">
                  <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-sm text-primary font-medium">
                    {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
                  </button>
                </div>

                <div className="mt-3 text-center">
                  <Button variant="ghost" size="sm" onClick={() => setStep('phone')} className="gap-1.5 text-xs text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" />
                    Back to phone login
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Email Sent Confirmation */}
            {step === 'email-sent' && (
              <motion.div key="email-sent" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5 py-6">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>
                <div className="text-center space-y-2">
                  <p className="text-sm font-semibold text-foreground">Verification email sent to</p>
                  <p className="text-sm font-bold text-primary">{form.email}</p>
                  <p className="text-xs text-muted-foreground max-w-[260px]">
                    Please check your inbox and click the verification link to activate your account. Check your spam folder if you don't see it.
                  </p>
                </div>
                <Button
                  onClick={async () => {
                    try {
                      setLoading(true);
                      const { error } = await supabase.auth.resend({ type: 'signup', email: form.email });
                      if (error) throw error;
                      toast({ title: 'Email Resent', description: 'Verification email resent! Check your inbox.' });
                    } catch (err: any) {
                      toast({ title: 'Error', description: err.message || 'Failed to resend', variant: 'destructive' });
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
                  onClick={() => { setStep('email'); setMode('login'); }}
                  className="w-full gap-2 rounded-xl py-5 text-sm font-semibold"
                  variant="outline"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to Sign In
                </Button>
              </motion.div>
            )}

            {/* Forgot Password */}
            {step === 'forgot-password' && (
              <motion.div key="forgot-password" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <Lock className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>
                {forgotSent ? (
                  <div className="text-center space-y-3 w-full">
                    <p className="text-sm font-semibold text-foreground">Reset link sent!</p>
                    <p className="text-sm font-bold text-primary">{forgotEmail}</p>
                    <p className="text-xs text-muted-foreground max-w-[260px] mx-auto">Check your email and click the link to reset your password.</p>
                    <Button onClick={() => { setStep('email'); setForgotSent(false); }} variant="outline" className="w-full gap-2 rounded-xl py-5 mt-4">
                      <ArrowLeft className="h-4 w-4" /> Back to Sign In
                    </Button>
                  </div>
                ) : (
                  <div className="w-full space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Email Address</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        <Input type="email" placeholder="you@example.com" value={forgotEmail} onChange={e => setForgotEmail(e.target.value)} className="rounded-xl border-border/60 pl-10" />
                      </div>
                    </div>
                    <Button onClick={handleForgotPassword} disabled={forgotLoading || !forgotEmail} className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20" size="lg">
                      {forgotLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <>Send Reset Link <ArrowRight className="h-4 w-4" /></>}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setStep('email')} className="w-full gap-1.5 text-xs text-muted-foreground">
                      <ArrowLeft className="h-3 w-3" /> Back to Sign In
                    </Button>
                  </div>
                )}
              </motion.div>
            )}

            {/* Reset PIN */}
            {step === 'reset-pin' && (
              <motion.div key="reset-pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }} className="flex flex-col items-center gap-5">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                  <KeyRound className="h-10 w-10 text-primary" strokeWidth={1.2} />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">Set a new 6-digit PIN</p>
                  <p className="text-xs text-muted-foreground mt-1">Identity verified via OTP</p>
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
                  <Button onClick={handleResetPin} disabled={resetPinLoading || newPin.length !== 6 || confirmNewPin.length !== 6} className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20" size="lg">
                    {resetPinLoading ? <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }} className="h-5 w-5 rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" /> : <>Reset PIN <ArrowRight className="h-4 w-4" /></>}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { setStep('phone'); setNewPin(''); setConfirmNewPin(''); }} className="w-full gap-1.5 text-xs text-muted-foreground">
                    <ArrowLeft className="h-3 w-3" /> Cancel
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Mandatory PIN Setup */}
            {step === 'setup-pin' && (
              <motion.div key="setup-pin" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.3 }}>
                <MandatoryPinSetupStep onComplete={() => { sounds.success(); onAuthSuccess(); }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer trust badges */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 flex flex-col items-center gap-3 pb-8"
        >
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Shield className="h-3.5 w-3.5" strokeWidth={1.5} />
            <span>256-bit SSL encrypted</span>
            <span className="mx-1">·</span>
            <span>COBAC Licensed</span>
          </div>
          <p className="text-[11px] text-muted-foreground/40">
            © {new Date().getFullYear()} {tenant.name}. All rights reserved.
          </p>
        </motion.div>
      </div>
    </div>
  );
};
