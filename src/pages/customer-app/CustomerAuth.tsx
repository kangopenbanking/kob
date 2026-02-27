import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { ArrowLeft, Phone, Shield, Loader2, AlertCircle, Building2, UserPlus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { toast } from 'sonner';

type AuthMode = 'welcome' | 'phone' | 'otp' | 'pin' | 'verifying';

const CustomerAuth: React.FC = () => {
  const { institutionId } = useParams<{ institutionId: string }>();
  const navigate = useNavigate();

  const [mode, setMode] = useState<AuthMode>('welcome');
  const [isNewUser, setIsNewUser] = useState(false);
  const [phone, setPhone] = useState('+237');
  const [pin, setPin] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null }>({ name: '', logoUrl: null });

  const { step: otpStep, loading: otpLoading, error: otpError, sendOTP, verifyOTP, reset: resetOTP } = useFirebasePhoneAuth();

  useEffect(() => {
    if (!institutionId) return;
    supabase
      .from('institutions')
      .select('institution_name, logo_url')
      .eq('id', institutionId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setBranding({ name: (data as any).institution_name || '', logoUrl: (data as any).logo_url || null });
        }
      });
  }, [institutionId]);

  useEffect(() => {
    if (otpStep === 'otp' && mode === 'phone') setMode('otp');
    if (otpStep === 'verifying') setMode('verifying');
  }, [otpStep, mode]);

  const handleSendOTP = async () => {
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    await sendOTP(phone);
  };

  const handleVerifyOTP = async (code: string) => {
    if (code.length !== 6) return;
    const success = await verifyOTP(code);
    if (success) {
      if (isNewUser) {
        // New registration — go to the onboarding questionnaire
        navigate(`/app/${institutionId}/register`, { replace: true });
      } else {
        const { data: profile } = await supabase
          .from('profiles')
          .select('linked_account_type')
          .eq('phone_number', phone)
          .maybeSingle();
        if (profile && (profile as any).linked_account_type) {
          navigate(`/app/${institutionId}/home`, { replace: true });
        } else {
          navigate(`/app/${institutionId}/register`, { replace: true });
        }
      }
    }
  };

  const handlePinLogin = async () => {
    if (pin.length !== 6) return;
    setPinLoading(true);
    setPinError(null);
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: { phone_number: phone, pin_code: pin },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Login failed');
      if (data.magic_link) {
        const url = new URL(data.magic_link);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        if (token && type) {
          const { error: verifyErr } = await supabase.auth.verifyOtp({ token_hash: token, type: type as any });
          if (verifyErr) throw verifyErr;
        }
      }
      await supabase.auth.refreshSession();
      toast.success('Welcome back!');
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('linked_account_type')
          .eq('id', user.id)
          .maybeSingle();
        if (profile && (profile as any).linked_account_type) {
          navigate(`/app/${institutionId}/home`, { replace: true });
        } else {
          navigate(`/app/${institutionId}/register`, { replace: true });
        }
      }
    } catch (err: any) {
      const msg = err.message || 'Login failed';
      setPinError(msg);
      toast.error(msg);
      setPin('');
    } finally {
      setPinLoading(false);
    }
  };

  const handleBack = () => {
    if (mode === 'otp') { resetOTP(); setMode('phone'); }
    else if (mode === 'pin') { setMode('phone'); setPin(''); setPinError(null); }
    else if (mode === 'phone') { setMode('welcome'); }
    else { navigate(`/app/${institutionId}`); }
  };

  const handlePhoneContinue = useCallback(async () => {
    if (phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }
    if (isNewUser) {
      await sendOTP(phone);
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('phone_number', phone)
        .maybeSingle();
      if (profile) {
        setMode('pin');
      } else {
        await sendOTP(phone);
      }
    }
  }, [phone, sendOTP, isNewUser]);

  const slideVariants = {
    enter: { x: 40, opacity: 0 },
    center: { x: 0, opacity: 1 },
    exit: { x: -40, opacity: 0 },
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      {mode !== 'welcome' && (
        <div className="flex items-center gap-3 p-5">
          <button onClick={handleBack} className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
            <ArrowLeft className="h-5 w-5 text-foreground" strokeWidth={1.5} />
          </button>
        </div>
      )}

      {/* Branding */}
      <div className="flex flex-col items-center gap-3 px-5 pb-8 pt-6">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt={branding.name} className="h-16 w-16 rounded-2xl object-contain" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
            <Building2 className="h-8 w-8 text-foreground" strokeWidth={1.5} />
          </div>
        )}
        <h1 className="text-xl font-bold text-foreground">{branding.name || 'Kang'}</h1>
      </div>

      {/* Content */}
      <div className="flex-1 px-5">
        <AnimatePresence mode="wait">
          {mode === 'welcome' && (
            <motion.div key="welcome" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.25 }} className="flex flex-col gap-4">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground">Your money, simplified.</p>
              </div>
              <Button
                onClick={() => { setIsNewUser(false); setMode('phone'); }}
                className="h-14 rounded-2xl text-base font-semibold"
                size="lg"
              >
                Sign In
              </Button>
              <Button
                onClick={() => { setIsNewUser(true); setMode('phone'); }}
                variant="outline"
                className="h-14 rounded-2xl text-base font-semibold gap-2 border-foreground"
                size="lg"
              >
                <UserPlus className="h-5 w-5" strokeWidth={1.5} />
                Create Account
              </Button>
            </motion.div>
          )}

          {mode === 'phone' && (
            <motion.div key="phone" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col gap-5">
              <div className="text-center mb-2">
                <p className="text-sm font-semibold text-foreground">{isNewUser ? 'Register with your phone' : 'Welcome back'}</p>
                <p className="text-xs text-muted-foreground mt-1">{isNewUser ? 'We\'ll send a code to verify your number' : 'Enter your phone number to sign in'}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">Phone Number</p>
                <div className="relative">
                  <Phone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+237 6XX XXX XXX"
                    className="h-14 rounded-2xl pl-12 text-base"
                  />
                </div>
              </div>
              <Button onClick={handlePhoneContinue} disabled={otpLoading || phone.length < 10} className="h-14 rounded-2xl text-base font-semibold" size="lg">
                {otpLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Continue
              </Button>
              <div id="recaptcha-container" />
            </motion.div>
          )}

          {mode === 'otp' && (
            <motion.div key="otp" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(210,80%,93%)]">
                <Shield className="h-8 w-8 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Verification Code</p>
                <p className="mt-1 text-xs text-muted-foreground">Sent to {phone}</p>
              </div>
              <InputOTP maxLength={6} onChange={(val) => { if (val.length === 6) handleVerifyOTP(val); }}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 rounded-xl border-border text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {otpError && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">{otpError}</span>
                </div>
              )}
              {otpLoading && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
            </motion.div>
          )}

          {mode === 'pin' && (
            <motion.div key="pin" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col items-center gap-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(150,40%,90%)]">
                <Shield className="h-8 w-8 text-foreground" strokeWidth={1.5} />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">Enter Your PIN</p>
                <p className="mt-1 text-xs text-muted-foreground">6-digit PIN for {phone}</p>
              </div>
              <InputOTP maxLength={6} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <InputOTPSlot key={i} index={i} className="h-12 w-12 rounded-xl border-border text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              {pinError && (
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-xs">{pinError}</span>
                </div>
              )}
              <Button onClick={handlePinLogin} disabled={pinLoading || pin.length !== 6} className="h-14 w-full rounded-2xl text-base font-semibold" size="lg">
                {pinLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Sign In
              </Button>
              <button onClick={() => { setMode('phone'); sendOTP(phone); }} className="text-xs font-semibold text-primary">
                Use OTP instead
              </button>
            </motion.div>
          )}

          {mode === 'verifying' && (
            <motion.div key="verifying" variants={slideVariants} initial="enter" animate="center" exit="exit" transition={{ duration: 0.2 }} className="flex flex-col items-center gap-4 pt-12">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-sm font-semibold text-foreground">Verifying...</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CustomerAuth;
