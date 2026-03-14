import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Smartphone, Shield, Bus, User, Building2, Landmark, Code, CheckCircle, Lock, Globe, ArrowRight } from 'lucide-react';
import { z } from 'zod';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { useAuthPageConfig } from '@/hooks/useAuthPageConfig';
import { motion, AnimatePresence } from 'framer-motion';

type AuthStep = 'captcha' | 'phone' | 'pin' | 'otp' | 'firebase-otp' | 'complete';
type OTPType = 'login' | 'signup';
type DeliveryMethod = 'sms' | 'whatsapp' | 'both';
type AuthMethod = 'standard' | 'firebase';

import { COUNTRY_CODES } from '@/lib/country-codes';

const phoneSchema = z.string().regex(/^\d{6,15}$/, 'Invalid phone number format');
const pinSchema = z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits');
const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

const ACCOUNT_TYPE_OPTIONS = [
  { type: 'personal', label: 'Personal', icon: User, desc: 'Banking & payments', path: '/auth' },
  { type: 'merchant', label: 'Business', icon: Building2, desc: 'Accept payments', path: '/merchant-register' },
  { type: 'institution', label: 'Institution', icon: Landmark, desc: 'Open Banking APIs', path: '/register' },
  { type: 'developer', label: 'Developer', icon: Code, desc: 'Build & integrate', path: '/tpp-registration' },
];

const fadeSlide = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.25, 0.1, 0.25, 1] as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.2 } },
};

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { config: authConfig } = useAuthPageConfig();

  const [authStep, setAuthStep] = useState<AuthStep>('captcha');
  const [authMethod, setAuthMethod] = useState<AuthMethod>('firebase');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [userHasPIN, setUserHasPIN] = useState(false);
  const [usesPINLogin, setUsesPINLogin] = useState(false);
  const [pinLoginAttempts, setPinLoginAttempts] = useState(3);

  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');

  const [selectedCountry, setSelectedCountry] = useState('Cameroon');
  const countryCode = COUNTRY_CODES.find(c => c.country === selectedCountry)?.code || '+237';
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');

  const firebasePhone = useFirebasePhoneAuth();
  const [firebaseOtpCode, setFirebaseOtpCode] = useState('');

  const isCameroon = countryCode === '+237';

  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) navigate('/dashboard');
    };
    checkUser();
  }, [navigate]);

  useEffect(() => {
    if (authStep === 'captcha') generateCaptcha();
  }, [authStep]);

  useEffect(() => {
    if (authStep !== 'captcha') return;
    const interval = setInterval(() => {
      generateCaptcha();
      toast({ title: 'Refreshed', description: 'Security challenge refreshed' });
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authStep]);

  const generateCaptcha = async (retryCount = 0) => {
    try {
      const { data, error } = await supabase.functions.invoke('captcha-generate');
      if (error) throw error;
      if (!data?.question || !data?.session_id) throw new Error('Invalid captcha response');
      setCaptchaQuestion(data.question);
      setCaptchaSessionId(data.session_id);
      setCaptchaAnswer('');
    } catch (error) {
      console.error('Failed to generate captcha:', error);
      if (retryCount < 2) {
        setTimeout(() => generateCaptcha(retryCount + 1), 1500 * (retryCount + 1));
      } else {
        toast({ title: 'Error', description: 'Failed to load security check. Please refresh the page.', variant: 'destructive' });
      }
    }
  };

  const handleVerifyCaptcha = async () => {
    if (!captchaAnswer) {
      toast({ title: 'Required', description: 'Please solve the math problem', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('captcha-verify', {
        body: { session_id: captchaSessionId, answer: parseInt(captchaAnswer) },
      });
      if (error || !data?.verified) throw new Error(data?.error || 'Captcha verification failed');
      toast({ title: 'Success', description: 'Security check passed' });
      if (authMethod === 'firebase') {
        setAuthStep('firebase-otp');
      } else {
        setAuthStep('phone');
      }
    } catch (error: any) {
      const msg = error.message || 'Please try again';
      const isExpired = msg.toLowerCase().includes('expired');
      toast({ title: isExpired ? 'Expired' : 'Incorrect', description: isExpired ? 'Captcha expired. A new one has been loaded.' : msg, variant: 'destructive' });
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleFirebaseSendOTP = async () => {
    try { phoneSchema.parse(phoneNumber); } catch {
      toast({ title: 'Invalid phone number', description: 'Please enter a valid phone number', variant: 'destructive' });
      return;
    }
    const fullPhone = `${countryCode}${phoneNumber}`;
    await firebasePhone.sendOTP(fullPhone);
  };

  const handleFirebaseVerifyOTP = async () => {
    if (firebaseOtpCode.length !== 6) {
      toast({ title: 'Invalid code', description: 'Please enter the 6-digit code', variant: 'destructive' });
      return;
    }
    const success = await firebasePhone.verifyOTP(firebaseOtpCode);
    if (success) {
      setAuthStep('complete');
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  const checkIfUserHasPIN = async () => {
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: fullPhone }
      });
      if (error) {
        toast({ title: 'Connection Error', description: 'Could not verify account. Please try again.', variant: 'destructive' });
        setUserHasPIN(false);
        return { exists: null, hasPIN: false };
      }
      if (!data) { setUserHasPIN(false); return { exists: false, hasPIN: false }; }
      const userExists = data.check_complete === true;
      const hasPIN = data.has_pin === true;
      setUserHasPIN(hasPIN);
      return { exists: userExists, hasPIN };
    } catch (error) {
      toast({ title: 'Connection Error', description: 'Could not verify account. Please try again.', variant: 'destructive' });
      setUserHasPIN(false);
      return { exists: null, hasPIN: false };
    }
  };

  const handlePhoneSubmit = async () => {
    try { phoneSchema.parse(phoneNumber); } catch {
      toast({ title: 'Invalid phone number', description: 'Please enter a valid phone number (6-15 digits)', variant: 'destructive' });
      return;
    }
    if (!isLogin && !fullName.trim()) {
      toast({ title: 'Required field', description: 'Please enter your full name', variant: 'destructive' });
      return;
    }
    if (!isLogin) {
      try { pinSchema.parse(pinCode); } catch {
        toast({ title: 'Invalid PIN', description: 'PIN must be exactly 6 digits', variant: 'destructive' });
        return;
      }
    }
    setLoading(true);
    try {
      if (isLogin) {
        const { exists, hasPIN } = await checkIfUserHasPIN();
        if (exists === null) { setLoading(false); return; }
        if (!exists) {
          toast({ title: 'Account Not Found', description: 'No account found. Please sign up first.', variant: 'destructive' });
          setLoading(false);
          return;
        }
        if (hasPIN) {
          setUsesPINLogin(true);
          setAuthStep('pin');
          setLoading(false);
          return;
        }
      }
      setUsesPINLogin(false);
      await handleSendOTP();
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    const fullPhone = `${countryCode}${phoneNumber}`;
    const { data, error } = await supabase.functions.invoke('phone-auth-send-otp', {
      body: {
        phone_number: fullPhone,
        otp_type: isLogin ? 'login' : 'signup',
        delivery_method: deliveryMethod,
        captcha_session_id: captchaSessionId,
      },
    });
    if (error) throw error;
    toast({ title: 'OTP Sent', description: `Verification code sent via ${deliveryMethod === 'both' ? 'SMS and WhatsApp' : deliveryMethod.toUpperCase()}` });
    setOtpExpiresAt(data.expires_at);
    setAuthStep('otp');
  };

  const handlePINLogin = async () => {
    try { pinSchema.parse(pinCode); } catch {
      toast({ title: 'Invalid PIN', description: 'PIN must be exactly 6 digits', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: { phone_number: fullPhone, pin_code: pinCode, captcha_session_id: captchaSessionId },
      });
      if (error) {
        const errorBody = typeof error === 'object' && error.message ? error.message : String(error);
        try {
          const parsed = JSON.parse(errorBody);
          if (parsed.locked) throw new Error(parsed.error || 'Account locked');
          if (parsed.remaining_attempts !== undefined) setPinLoginAttempts(parsed.remaining_attempts);
          throw new Error(parsed.error || 'Invalid PIN code');
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) throw new Error(errorBody);
          throw parseErr;
        }
      }
      if (!data?.success) {
        if (data?.locked) throw new Error(data.error || 'Account locked');
        setPinLoginAttempts(data?.remaining_attempts || 0);
        throw new Error(data?.error || 'Invalid PIN code');
      }
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        });
      }
      toast({ title: 'Success', description: 'Logged in successfully!' });
      setAuthStep('complete');
      setTimeout(() => navigate('/dashboard'), 1000);
    } catch (error: any) {
      let errorMessage = error.message || 'Invalid PIN code';
      if (errorMessage.includes('Account locked')) errorMessage = 'Too many failed attempts. Account locked for 30 minutes.';
      else if (pinLoginAttempts > 0) errorMessage = `Invalid PIN. ${pinLoginAttempts} attempts remaining.`;
      toast({ title: 'Login Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const switchToOTPLogin = () => {
    setUsesPINLogin(false);
    setAuthStep('phone');
    setPinCode('');
    toast({ title: 'Switched to OTP', description: 'Choose your delivery method to receive a code' });
  };

  const handleVerifyOTP = async () => {
    try { otpSchema.parse(otpCode); } catch {
      toast({ title: 'Invalid OTP', description: 'OTP must be exactly 6 digits', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-verify-otp', {
        body: {
          phone_number: fullPhone,
          otp_code: otpCode,
          otp_type: isLogin ? 'login' : 'signup',
          full_name: isLogin ? undefined : fullName,
          pin_code: isLogin ? undefined : pinCode,
          country_code: countryCode,
        },
      });
      if (error) throw new Error(error.message || 'Verification failed');
      if (!data.success) throw new Error(data.error || 'Verification failed');
      toast({ title: 'Success', description: `${isLogin ? 'Logged in' : 'Account created'} successfully!` });
      await supabase.auth.refreshSession();
      setAuthStep('complete');
      setTimeout(() => navigate(isLogin ? '/dashboard' : '/register'), 1000);
    } catch (error: any) {
      let errorMessage = error.message || 'Invalid or expired OTP code';
      if (errorMessage.includes('No account found')) errorMessage = 'No account found. Please sign up first.';
      toast({ title: 'Verification Failed', description: errorMessage, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try { phoneSchema.parse(phoneNumber); pinSchema.parse(pinCode); } catch {
      toast({ title: 'Invalid input', description: 'Please enter valid phone number and 6-digit PIN', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const { data: pinData, error: pinError } = await supabase.functions.invoke('pin-code-verify', {
        body: { phone_number: fullPhone, pin_code: pinCode },
      });
      if (pinError || !pinData.verified) throw new Error(pinData?.error || 'Invalid PIN code');
      const { error: otpError } = await supabase.functions.invoke('phone-auth-send-otp', {
        body: { phone_number: fullPhone, otp_type: 'password_reset', delivery_method: deliveryMethod, captcha_session_id: captchaSessionId },
      });
      if (otpError) throw otpError;
      toast({ title: 'OTP Sent', description: 'Enter the code to reset your password' });
      setAuthStep('otp');
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to verify PIN', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setAuthStep('captcha');
    setPhoneNumber(''); setFullName(''); setEmail(''); setPinCode(''); setOtpCode('');
    setCaptchaAnswer(''); setShowForgotPassword(false); setFirebaseOtpCode('');
    firebasePhone.reset();
    generateCaptcha();
  };

  const goBack = () => {
    if (authStep === 'otp') { setAuthStep('phone'); setOtpCode(''); }
    else if (authStep === 'pin') { setAuthStep('phone'); setPinCode(''); setUsesPINLogin(false); }
    else if (authStep === 'phone') { setAuthStep('captcha'); generateCaptcha(); }
    else if (authStep === 'firebase-otp') {
      firebasePhone.reset(); setFirebaseOtpCode('');
      setAuthStep('captcha'); generateCaptcha();
    }
  };

  const stepLabel = authStep === 'captcha' ? 'Security' : authStep === 'phone' || authStep === 'firebase-otp' ? 'Verify' : authStep === 'pin' ? 'PIN' : authStep === 'otp' ? 'Code' : 'Done';
  const stepIndex = ['captcha', 'phone', 'firebase-otp', 'pin', 'otp', 'complete'].indexOf(authStep);

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Panel — Auth Form */}
      <div className="flex flex-col items-center justify-center px-4 py-8 bg-background relative">
        {/* Invisible reCAPTCHA container for Firebase */}
        <div id="recaptcha-container" className="absolute" />

        <div className="w-full max-w-[440px] space-y-6">
          {/* Header */}
          <div className="flex items-center gap-3">
            <img src={authConfig.logo_url} alt="KOB" className="h-10 w-10 rounded-xl" />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">
                {showForgotPassword ? 'Reset Password' : isLogin ? authConfig.login_title : authConfig.signup_title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {showForgotPassword
                  ? 'Verify your phone and PIN to reset password'
                  : isLogin
                    ? authConfig.login_subtitle
                    : authConfig.signup_subtitle}
              </p>
            </div>
          </div>

          {/* Progress Indicator */}
          {authStep !== 'complete' && (
            <div className="flex items-center gap-1">
              {['Security', 'Verify', 'Complete'].map((label, i) => {
                const active = i === 0 ? authStep === 'captcha'
                  : i === 1 ? ['phone', 'firebase-otp', 'pin', 'otp'].includes(authStep)
                  : false;
                const done = i === 0 ? authStep !== 'captcha'
                  : i === 1 ? (authStep as string) === 'complete'
                  : false;
                return (
                  <div key={label} className="flex items-center gap-1 flex-1">
                    <div className={`h-1.5 rounded-full flex-1 transition-colors ${done ? 'bg-primary' : active ? 'bg-primary/60' : 'bg-muted'}`} />
                  </div>
                );
              })}
            </div>
          )}

          {/* Main Card */}
          <Card className="border-border/50 shadow-sm">
            <CardContent className="pt-6 space-y-5">
              <AnimatePresence mode="wait">
                {/* === CAPTCHA STEP === */}
                {authStep === 'captcha' && (
                  <motion.div key="captcha" {...fadeSlide} className="space-y-5">
                    {/* Auth Method Selection */}
                    {!showForgotPassword && (
                      <div className="space-y-3">
                        <Label className="text-sm font-medium text-foreground">Authentication method</Label>
                        <div className="grid grid-cols-1 gap-2">
                          <button
                            type="button"
                            onClick={() => setAuthMethod('firebase')}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                              authMethod === 'firebase'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${authMethod === 'firebase' ? 'bg-primary/10' : 'bg-muted'}`}>
                              <Smartphone className={`h-4 w-4 ${authMethod === 'firebase' ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">One Time Code</span>
                                {isCameroon && (
                                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-0">
                                    Recommended
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                SMS verification code{isCameroon && ' — optimized for Cameroon'}
                              </p>
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setAuthMethod('standard')}
                            className={`flex items-center gap-3 rounded-xl border-2 p-3.5 text-left transition-all ${
                              authMethod === 'standard'
                                ? 'border-primary bg-primary/5 shadow-sm'
                                : 'border-border hover:border-primary/40'
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${authMethod === 'standard' ? 'bg-primary/10' : 'bg-muted'}`}>
                              <Shield className={`h-4 w-4 ${authMethod === 'standard' ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-semibold text-foreground">PIN / WhatsApp OTP</span>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Login with PIN or receive code via SMS/WhatsApp
                              </p>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Merchant Staff Link */}
                    {!showForgotPassword && (
                      <button
                        type="button"
                        onClick={() => navigate('/staff-login')}
                        className="flex items-center gap-3 w-full rounded-xl border border-dashed border-border p-3 text-left transition-all hover:border-primary/40 hover:bg-muted/50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                          <Bus className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">Merchant Staff Login</span>
                          <p className="text-xs text-muted-foreground">Travel & transport staff</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}

                    {/* Captcha */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium text-foreground">Security Check</Label>
                      <div className="text-center py-5 bg-muted/60 rounded-xl border border-border/50">
                        <p className="text-2xl font-bold tracking-wide text-foreground">{captchaQuestion} = ?</p>
                      </div>
                      <Input
                        type="number"
                        placeholder="Your answer"
                        value={captchaAnswer}
                        onChange={(e) => setCaptchaAnswer(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleVerifyCaptcha()}
                        className="h-11"
                      />
                    </div>
                    <Button onClick={handleVerifyCaptcha} className="w-full h-11" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Continue
                    </Button>
                  </motion.div>
                )}

                {/* === FIREBASE OTP STEP === */}
                {authStep === 'firebase-otp' && (
                  <motion.div key="firebase-otp" {...fadeSlide} className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    <div className="flex items-center gap-2 rounded-xl bg-primary/5 border border-primary/10 px-3 py-2.5 text-sm text-primary font-medium">
                      <Smartphone className="h-4 w-4" />
                      <span>One Time Code — {isCameroon ? 'Recommended for Cameroon' : 'Fast & Secure'}</span>
                    </div>

                    {firebasePhone.step === 'phone' && (
                      <>
                        {!isLogin && !showForgotPassword && (
                          <div className="space-y-2">
                            <Label htmlFor="fullName">Full Name *</Label>
                            <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
                          </div>
                        )}
                        <div className="space-y-2">
                          <Label>Phone Number *</Label>
                          <div className="flex gap-2">
                            <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                              <SelectTrigger className="w-[130px] h-11"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COUNTRY_CODES.map((cc) => (
                                  <SelectItem key={cc.country} value={cc.country}>
                                    <span className="inline-flex items-center gap-1.5">
                                      <span>{cc.flag}</span> <span>{cc.code}</span>
                                    </span>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Input type="tel" placeholder="6 XX XX XX XX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="h-11" />
                          </div>
                        </div>
                        <Button onClick={handleFirebaseSendOTP} className="w-full h-11" disabled={firebasePhone.loading}>
                          {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Send Verification Code
                        </Button>
                      </>
                    )}

                    {(firebasePhone.step === 'otp' || firebasePhone.step === 'verifying') && (
                      <>
                        <div className="space-y-2">
                          <Label>Enter 6-Digit Code</Label>
                          <p className="text-sm text-muted-foreground">Code sent to {countryCode}{phoneNumber}</p>
                          <div className="flex justify-center py-2">
                            <InputOTP maxLength={6} value={firebaseOtpCode} onChange={setFirebaseOtpCode}>
                              <InputOTPGroup>
                                <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                                <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                              </InputOTPGroup>
                            </InputOTP>
                          </div>
                        </div>
                        <Button onClick={handleFirebaseVerifyOTP} className="w-full h-11" disabled={firebasePhone.loading || firebaseOtpCode.length !== 6}>
                          {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          Verify Code
                        </Button>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => { firebasePhone.reset(); setFirebaseOtpCode(''); }}>Change Number</Button>
                          <Button variant="ghost" size="sm" onClick={handleFirebaseSendOTP} disabled={firebasePhone.loading}>Resend Code</Button>
                        </div>
                      </>
                    )}
                  </motion.div>
                )}

                {/* === PHONE STEP (Standard) === */}
                {authStep === 'phone' && (
                  <motion.div key="phone" {...fadeSlide} className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    {!isLogin && !showForgotPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full Name *</Label>
                        <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} className="h-11" />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number *</Label>
                      <div className="flex gap-2">
                        <Select value={selectedCountry} onValueChange={setSelectedCountry}>
                          <SelectTrigger className="w-[130px] h-11"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {COUNTRY_CODES.map((cc) => (
                              <SelectItem key={cc.country} value={cc.country}>
                                <span className="inline-flex items-center gap-1.5"><span>{cc.flag}</span> <span>{cc.code}</span></span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input id="phone" type="tel" placeholder="6 XX XX XX XX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} className="h-11" />
                      </div>
                    </div>

                    {!isLogin && !showForgotPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="pin">Set 6-Digit PIN *</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                        <p className="text-xs text-muted-foreground text-center">Use this PIN for future logins</p>
                      </div>
                    )}

                    {showForgotPassword && (
                      <div className="space-y-2">
                        <Label htmlFor="reset-pin">Enter Your 6-Digit PIN</Label>
                        <div className="flex justify-center">
                          <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                            <InputOTPGroup>
                              <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                              <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                            </InputOTPGroup>
                          </InputOTP>
                        </div>
                      </div>
                    )}

                    {(!isLogin || showForgotPassword) && (
                      <div className="space-y-2">
                        <Label>How should we send your code?</Label>
                        <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="sms" id="sms" /><Label htmlFor="sms" className="font-normal flex items-center gap-2">SMS <span className="text-xs text-muted-foreground">(Recommended)</span></Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="whatsapp" id="whatsapp" /><Label htmlFor="whatsapp" className="font-normal">WhatsApp</Label></div>
                          <div className="flex items-center space-x-2"><RadioGroupItem value="both" id="both" /><Label htmlFor="both" className="font-normal">Both</Label></div>
                        </RadioGroup>
                        <p className="text-xs text-muted-foreground mt-1">💡 WhatsApp delivery requires you to message our business number first.</p>
                      </div>
                    )}

                    <Button onClick={showForgotPassword ? handleForgotPassword : handlePhoneSubmit} className="w-full h-11" disabled={loading}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {isLogin && !showForgotPassword ? 'Continue' : 'Send Verification Code'}
                    </Button>

                    {isLogin && !showForgotPassword && (
                      <Button variant="link" className="w-full text-sm" onClick={() => setShowForgotPassword(true)}>Forgot Password?</Button>
                    )}
                  </motion.div>
                )}

                {/* === PIN STEP === */}
                {authStep === 'pin' && (
                  <motion.div key="pin" {...fadeSlide} className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    <div className="text-center space-y-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Lock className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Enter Your PIN</h3>
                      <p className="text-sm text-muted-foreground">6-digit PIN for {countryCode}{phoneNumber}</p>
                    </div>

                    <div className="flex justify-center py-2">
                      <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                          <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {pinLoginAttempts < 3 && (
                      <p className="text-xs text-destructive text-center">{pinLoginAttempts} attempts remaining before account lock</p>
                    )}

                    <Button onClick={handlePINLogin} className="w-full h-11" disabled={loading || pinCode.length !== 6}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Login with PIN
                    </Button>

                    <div className="flex flex-col gap-1">
                      <Button variant="ghost" className="w-full text-sm" onClick={switchToOTPLogin} disabled={loading}>Login with OTP instead</Button>
                      <Button variant="link" className="w-full text-xs" onClick={() => { setShowForgotPassword(true); setAuthStep('phone'); }} disabled={loading}>Forgot PIN?</Button>
                    </div>
                  </motion.div>
                )}

                {/* === OTP STEP (Standard) === */}
                {authStep === 'otp' && (
                  <motion.div key="otp" {...fadeSlide} className="space-y-4">
                    <Button variant="ghost" size="sm" onClick={goBack} className="gap-1 -ml-2 text-muted-foreground hover:text-foreground">
                      <ArrowLeft className="h-4 w-4" /> Back
                    </Button>

                    <div className="text-center space-y-1">
                      <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                        <Smartphone className="h-5 w-5 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold text-foreground">Verify Your Code</h3>
                      <p className="text-sm text-muted-foreground">
                        Code sent to {countryCode}{phoneNumber}
                        {deliveryMethod === 'both' && ' via SMS and WhatsApp'}
                      </p>
                    </div>

                    <div className="flex justify-center py-2">
                      <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                        <InputOTPGroup>
                          <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                          <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {otpExpiresAt && <p className="text-xs text-muted-foreground text-center">Code expires in 10 minutes</p>}

                    <Button onClick={handleVerifyOTP} className="w-full h-11" disabled={loading || otpCode.length !== 6}>
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Verify Code
                    </Button>

                    <Button variant="ghost" className="w-full text-sm" onClick={() => { setOtpCode(''); handleSendOTP(); }} disabled={loading}>Resend Code</Button>
                  </motion.div>
                )}

                {/* === SUCCESS === */}
                {authStep === 'complete' && (
                  <motion.div key="complete" {...fadeSlide} className="text-center py-10">
                    <div className="w-16 h-16 rounded-full bg-secondary/10 flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="h-8 w-8 text-secondary" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-1">
                      {isLogin ? 'Welcome back!' : 'Account created!'}
                    </h3>
                    <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Toggle Login/Signup */}
              {authStep !== 'complete' && !showForgotPassword && (
                <div className="text-center pt-4 border-t border-border/50">
                  <Button variant="link" onClick={toggleMode} className="text-sm text-muted-foreground hover:text-foreground">
                    {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
                  </Button>
                </div>
              )}

              {showForgotPassword && (
                <div className="text-center pt-4 border-t border-border/50">
                  <Button
                    variant="link"
                    onClick={() => {
                      setShowForgotPassword(false);
                      setAuthStep('captcha');
                      generateCaptcha();
                    }}
                    className="text-sm text-muted-foreground hover:text-foreground"
                  >
                    Back to Login
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Account Type Quick Links — show on signup only */}
          {!isLogin && authStep === 'captcha' && (
            <motion.div {...fadeSlide} className="space-y-3">
              <p className="text-xs font-medium text-muted-foreground text-center uppercase tracking-wider">Or register as</p>
              <div className="grid grid-cols-3 gap-2">
                {ACCOUNT_TYPE_OPTIONS.filter(a => a.type !== 'personal').map((acc) => {
                  const Icon = acc.icon;
                  return (
                    <button
                      key={acc.type}
                      onClick={() => navigate(acc.path)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-xs font-medium text-foreground">{acc.label}</span>
                      <span className="text-[10px] text-muted-foreground">{acc.desc}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Trust Badges */}
          <div className="flex items-center justify-center gap-4 pt-2">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> <span>256-bit SSL</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Shield className="h-3 w-3" /> <span>COBAC Compliant</span>
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Globe className="h-3 w-3" /> <span>CEMAC</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel — Hero */}
      <div
        className="hidden lg:flex relative overflow-hidden items-center justify-center"
        style={{
          backgroundImage: authConfig.hero_image_url ? `url(${authConfig.hero_image_url})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: authConfig.hero_image_url ? undefined : 'hsl(var(--primary))',
        }}
      >
        {authConfig.hero_image_url && <div className="absolute inset-0 bg-black/40" />}
        <div className="relative text-center space-y-6 px-12 z-10 max-w-lg">
          <h2 className="text-5xl font-bold text-white drop-shadow-lg leading-tight">
            {authConfig.hero_title}
          </h2>
          <p className="text-xl text-white/90 drop-shadow leading-relaxed">
            {authConfig.hero_subtitle}
          </p>

          {/* Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2 pt-4">
            {['Open Banking', 'Mobile Money', 'Payments', 'Credit Score'].map((f) => (
              <span key={f} className="px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm text-sm text-white/90 border border-white/20">
                {f}
              </span>
            ))}
          </div>

          {/* Account Type Cards */}
          <div className="grid grid-cols-2 gap-3 pt-6">
            {ACCOUNT_TYPE_OPTIONS.map((acc) => {
              const Icon = acc.icon;
              return (
                <button
                  key={acc.type}
                  onClick={() => acc.type === 'personal' ? undefined : navigate(acc.path)}
                  className={`flex items-center gap-3 p-3 rounded-xl text-left transition-all ${
                    acc.type === 'personal'
                      ? 'bg-white/20 border-2 border-white/40 backdrop-blur-sm cursor-default'
                      : 'bg-white/10 border border-white/20 backdrop-blur-sm hover:bg-white/20 cursor-pointer'
                  }`}
                >
                  <Icon className="h-5 w-5 text-white/80 shrink-0" />
                  <div>
                    <span className="text-sm font-semibold text-white">{acc.label}</span>
                    <p className="text-xs text-white/70">{acc.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
