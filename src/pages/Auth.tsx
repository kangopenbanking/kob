import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Smartphone, Shield, Bus } from 'lucide-react';
import { z } from 'zod';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { useAuthPageConfig } from '@/hooks/useAuthPageConfig';

type AuthStep = 'captcha' | 'phone' | 'pin' | 'otp' | 'firebase-otp' | 'complete';
type OTPType = 'login' | 'signup';
type DeliveryMethod = 'sms' | 'whatsapp' | 'both';
type AuthMethod = 'standard' | 'firebase';

import { COUNTRY_CODES } from '@/lib/country-codes';

// Validation schemas
const phoneSchema = z.string().regex(/^\d{6,15}$/, 'Invalid phone number format');
const pinSchema = z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits');
const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

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

  // Captcha state
  const [captchaQuestion, setCaptchaQuestion] = useState('');
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [captchaSessionId, setCaptchaSessionId] = useState('');

  // Form state
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>('sms');
  const [otpExpiresAt, setOtpExpiresAt] = useState('');

  // Firebase Phone Auth
  const firebasePhone = useFirebasePhoneAuth();
  const [firebaseOtpCode, setFirebaseOtpCode] = useState('');

  const isCameroon = countryCode === '+237';

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        navigate('/dashboard');
      }
    };
    checkUser();
  }, [navigate]);

  // Generate captcha on mount
  useEffect(() => {
    if (authStep === 'captcha') {
      generateCaptcha();
    }
  }, [authStep]);

  // Auto-refresh captcha every 4 minutes to prevent expiration
  useEffect(() => {
    if (authStep !== 'captcha') return;
    const interval = setInterval(() => {
      generateCaptcha();
      toast({ title: 'Refreshed', description: 'Security challenge refreshed' });
    }, 4 * 60 * 1000);
    return () => clearInterval(interval);
  }, [authStep]);

  const generateCaptcha = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('captcha-generate');
      if (error) throw error;
      setCaptchaQuestion(data.question);
      setCaptchaSessionId(data.session_id);
      setCaptchaAnswer('');
    } catch (error) {
      console.error('Failed to generate captcha:', error);
      toast({
        title: 'Error',
        description: 'Failed to load security check. Please refresh the page.',
        variant: 'destructive',
      });
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

      if (error || !data.verified) {
        throw new Error(data?.error || 'Captcha verification failed');
      }

      toast({ title: 'Success', description: 'Security check passed' });
      
      // If Firebase method selected, go directly to Firebase OTP flow
      if (authMethod === 'firebase') {
        setAuthStep('firebase-otp');
      } else {
        setAuthStep('phone');
      }
    } catch (error: any) {
      const msg = error.message || 'Please try again';
      const isExpired = msg.toLowerCase().includes('expired');
      toast({ 
        title: isExpired ? 'Expired' : 'Incorrect', 
        description: isExpired ? 'Captcha expired. A new one has been loaded.' : msg, 
        variant: 'destructive' 
      });
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  // Firebase OTP handlers
  const handleFirebaseSendOTP = async () => {
    try {
      phoneSchema.parse(phoneNumber);
    } catch {
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
      // Redirect via DashboardRouter which handles all role-based routing
      setTimeout(() => navigate('/dashboard'), 1000);
    }
  };

  const checkIfUserHasPIN = async () => {
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: fullPhone }
      });
      if (error || !data) { setUserHasPIN(false); return { exists: false, hasPIN: false }; }
      const userExists = data.user_exists === true;
      const hasPIN = data.has_pin === true;
      setUserHasPIN(hasPIN);
      return { exists: userExists, hasPIN };
    } catch (error) {
      setUserHasPIN(false);
      return { exists: false, hasPIN: false };
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
      if (error) throw error;
      if (!data.success) {
        if (data.locked) throw new Error(data.error || 'Account locked');
        setPinLoginAttempts(data.remaining_attempts || 0);
        throw new Error(data.error || 'Invalid PIN code');
      }

      if (data.magic_link) {
        const url = new URL(data.magic_link);
        const token = url.searchParams.get('token');
        const type = url.searchParams.get('type');
        if (token && type) {
          const { error: verifyError } = await supabase.auth.verifyOtp({ token_hash: token, type: type as any });
          if (verifyError) throw verifyError;
        }
      }

      toast({ title: 'Success', description: 'Logged in successfully!' });
      await supabase.auth.refreshSession();
      setAuthStep('complete');
      // Redirect via DashboardRouter which handles all role-based routing
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

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { setTimeout(() => navigate(isLogin ? '/dashboard' : '/register'), 1000); return; }
        const { data: institution } = await supabase.from('institutions').select('id, status').eq('user_id', user.id).single();
        if (!institution) {
          setTimeout(() => navigate(isLogin ? '/dashboard' : '/register'), 1000);
        } else if (institution.status === 'approved') {
          setTimeout(() => navigate('/fi-portal'), 1000);
        } else {
          setTimeout(() => navigate('/pending-approval'), 1000);
        }
      } catch {
        setTimeout(() => navigate(isLogin ? '/dashboard' : '/register'), 1000);
      }
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
    setPhoneNumber('');
    setFullName('');
    setEmail('');
    setPinCode('');
    setOtpCode('');
    setCaptchaAnswer('');
    setShowForgotPassword(false);
    setFirebaseOtpCode('');
    firebasePhone.reset();
    generateCaptcha();
  };

  const goBack = () => {
    if (authStep === 'otp') { setAuthStep('phone'); setOtpCode(''); }
    else if (authStep === 'pin') { setAuthStep('phone'); setPinCode(''); setUsesPINLogin(false); }
    else if (authStep === 'phone') { setAuthStep('captcha'); generateCaptcha(); }
    else if (authStep === 'firebase-otp') {
      firebasePhone.reset();
      setFirebaseOtpCode('');
      setAuthStep('captcha');
      generateCaptcha();
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2">
      {/* Left Panel - Auth Form */}
      <div className="flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
        {/* Invisible reCAPTCHA container for Firebase */}
        <div id="recaptcha-container" className="absolute" />
        <Card className="w-full max-w-md bg-white border shadow-lg">
          <CardHeader className="space-y-1">
            <div className="flex items-center gap-4 mb-4">
              <img src={authConfig.logo_url} alt="Kang Open Banking Logo" className="h-12 w-12" />
              <div>
                <CardTitle className="text-2xl font-bold">
                  {showForgotPassword ? 'Reset Password' : isLogin ? authConfig.login_title : authConfig.signup_title}
                </CardTitle>
                <CardDescription>
                  {showForgotPassword 
                    ? 'Verify your phone and PIN to reset password'
                    : isLogin 
                      ? authConfig.login_subtitle 
                      : authConfig.signup_subtitle
                  }
                </CardDescription>
              </div>
            </div>
          </CardHeader>

        <CardContent className="space-y-4">
          {/* Captcha Step */}
          {authStep === 'captcha' && (
            <div className="space-y-4">
              {/* Auth Method Selection */}
              {!showForgotPassword && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Choose authentication method</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setAuthMethod('firebase')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                        authMethod === 'firebase'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Smartphone className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">One Time Code</span>
                          {isCameroon && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Recommended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Receive a verification code via SMS
                          {isCameroon && ' — Best for Cameroon'}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMethod('standard')}
                      className={`flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all ${
                        authMethod === 'standard'
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Shield className="h-5 w-5 text-muted-foreground" />
                      <div className="flex-1">
                        <span className="text-sm font-medium">PIN / WhatsApp OTP</span>
                        <p className="text-xs text-muted-foreground">
                          Login with PIN or receive code via SMS/WhatsApp
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Merchant Staff Login Link */}
              {!showForgotPassword && (
                <button
                  type="button"
                  onClick={() => navigate('/staff-login')}
                  className="flex items-center gap-3 w-full rounded-lg border-2 border-dashed border-border p-3 text-left transition-all hover:border-primary/50 hover:bg-primary/5"
                >
                  <Bus className="h-5 w-5 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">Merchant Staff Login</span>
                    <p className="text-xs text-muted-foreground">
                      Travel & transport staff — login with email or PIN
                    </p>
                  </div>
                  <ArrowLeft className="h-4 w-4 text-muted-foreground rotate-180" />
                </button>
              )}

              <div className="space-y-2">
                <Label>Security Check</Label>
                <p className="text-lg font-semibold text-center py-4 bg-muted rounded-md">
                  {captchaQuestion} = ?
                </p>
                <Input
                  type="number"
                  placeholder="Your answer"
                  value={captchaAnswer}
                  onChange={(e) => setCaptchaAnswer(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleVerifyCaptcha()}
                />
              </div>
              <Button onClick={handleVerifyCaptcha} className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </div>
          )}

          {/* Firebase OTP Step */}
          {authStep === 'firebase-otp' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="flex items-center gap-2 rounded-lg bg-primary/5 px-3 py-2 text-sm text-primary">
                <Smartphone className="h-4 w-4" />
                <span>One Time Code — {isCameroon ? 'Recommended for Cameroon' : 'Fast & Secure'}</span>
              </div>

              {firebasePhone.step === 'phone' && (
                <>
                  {!isLogin && !showForgotPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="John Doe"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>Phone Number *</Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map((cc) => (
                            <SelectItem key={cc.code} value={cc.code}>
                              {cc.flag} {cc.code}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="tel"
                        placeholder="6 XX XX XX XX"
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                      />
                    </div>
                  </div>

                  <Button onClick={handleFirebaseSendOTP} className="w-full" disabled={firebasePhone.loading}>
                    {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Send Verification Code
                  </Button>
                </>
              )}

              {(firebasePhone.step === 'otp' || firebasePhone.step === 'verifying') && (
                <>
                  <div className="space-y-2">
                    <Label>Enter 6-Digit Code</Label>
                    <p className="text-sm text-muted-foreground">
                      Code sent to {countryCode}{phoneNumber}
                    </p>
                    <InputOTP maxLength={6} value={firebaseOtpCode} onChange={setFirebaseOtpCode}>
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button onClick={handleFirebaseVerifyOTP} className="w-full" disabled={firebasePhone.loading || firebaseOtpCode.length !== 6}>
                    {firebasePhone.loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Code
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { firebasePhone.reset(); setFirebaseOtpCode(''); }}>
                      Change Number
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleFirebaseSendOTP} disabled={firebasePhone.loading}>
                      Resend Code
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Phone Number Step (Standard) */}
          {authStep === 'phone' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {!isLogin && !showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full Name *</Label>
                  <Input id="fullName" placeholder="John Doe" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COUNTRY_CODES.map((cc) => (
                        <SelectItem key={cc.code} value={cc.code}>
                          {cc.flag} {cc.code}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input id="phone" type="tel" placeholder="6 XX XX XX XX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>

              {!isLogin && !showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="pin">Set 6-Digit PIN *</Label>
                  <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                  <p className="text-xs text-muted-foreground">Use this PIN for future logins</p>
                </div>
              )}

              {showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="reset-pin">Enter Your 6-Digit PIN</Label>
                  <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                      <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              )}

              {(!isLogin || showForgotPassword) && (
                <div className="space-y-2">
                  <Label>How should we send your code?</Label>
                  <RadioGroup value={deliveryMethod} onValueChange={(v) => setDeliveryMethod(v as DeliveryMethod)}>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="sms" id="sms" />
                      <Label htmlFor="sms" className="font-normal flex items-center gap-2">
                        SMS <span className="text-xs text-muted-foreground">(Recommended)</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="whatsapp" id="whatsapp" />
                      <Label htmlFor="whatsapp" className="font-normal">WhatsApp</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="both" id="both" />
                      <Label htmlFor="both" className="font-normal">Both</Label>
                    </div>
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 WhatsApp delivery requires you to message our business number first. SMS is instant and reliable.
                  </p>
                </div>
              )}

              <Button onClick={showForgotPassword ? handleForgotPassword : handlePhoneSubmit} className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isLogin && !showForgotPassword ? 'Continue' : 'Send Verification Code'}
              </Button>

              {isLogin && !showForgotPassword && (
                <Button variant="link" className="w-full" onClick={() => setShowForgotPassword(true)}>
                  Forgot Password?
                </Button>
              )}
            </div>
          )}

          {/* PIN Login Step */}
          {authStep === 'pin' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="space-y-2">
                <Label>Enter Your 6-Digit PIN</Label>
                <p className="text-sm text-muted-foreground">
                  Enter the PIN you set during registration for {countryCode}{phoneNumber}
                </p>
                <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {pinLoginAttempts < 3 && (
                  <p className="text-xs text-destructive">{pinLoginAttempts} attempts remaining before account lock</p>
                )}
              </div>

              <Button onClick={handlePINLogin} className="w-full" disabled={loading || pinCode.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Login with PIN
              </Button>

              <div className="flex flex-col gap-2">
                <Button variant="ghost" className="w-full" onClick={switchToOTPLogin} disabled={loading}>
                  Login with OTP instead
                </Button>
                <Button variant="link" className="w-full text-sm" onClick={() => { setShowForgotPassword(true); setAuthStep('phone'); }} disabled={loading}>
                  Forgot PIN?
                </Button>
              </div>
            </div>
          )}

          {/* OTP Verification Step (Standard) */}
          {authStep === 'otp' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              <div className="space-y-2">
                <Label>Enter 6-Digit Code</Label>
                <p className="text-sm text-muted-foreground">
                  Code sent to {countryCode}{phoneNumber}
                  {deliveryMethod === 'both' && ' via SMS and WhatsApp'}
                </p>
                <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
                  <InputOTPGroup>
                    <InputOTPSlot index={0} /><InputOTPSlot index={1} /><InputOTPSlot index={2} />
                    <InputOTPSlot index={3} /><InputOTPSlot index={4} /><InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpExpiresAt && (
                  <p className="text-xs text-muted-foreground">Code expires in 10 minutes</p>
                )}
              </div>

              <Button onClick={handleVerifyOTP} className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>

              <Button variant="ghost" className="w-full" onClick={() => { setOtpCode(''); handleSendOTP(); }} disabled={loading}>
                Resend Code
              </Button>
            </div>
          )}

          {/* Success Step */}
          {authStep === 'complete' && (
            <div className="text-center py-8">
              <div className="mb-4 text-4xl text-green-500">✓</div>
              <h3 className="text-lg font-semibold mb-2">
                {isLogin ? 'Welcome back!' : 'Account created!'}
              </h3>
              <p className="text-sm text-muted-foreground">
                Redirecting to dashboard...
              </p>
            </div>
          )}

          {/* Toggle Login/Signup */}
          {authStep !== 'complete' && !showForgotPassword && (
            <div className="text-center pt-4 border-t">
              <Button variant="link" onClick={toggleMode} className="text-sm">
                {isLogin ? "Don't have an account? Sign up" : "Already have an account? Log in"}
              </Button>
            </div>
          )}

          {showForgotPassword && (
            <div className="text-center pt-4 border-t">
              <Button 
                variant="link" 
                onClick={() => {
                  setShowForgotPassword(false);
                  setAuthStep('captcha');
                  generateCaptcha();
                }} 
                className="text-sm"
              >
                Back to Login
              </Button>
            </div>
          )}
        </CardContent>
        </Card>
      </div>
      
      {/* Right Panel - Admin-Managed Hero (Desktop Only) */}
      <div
        className="hidden lg:flex relative overflow-hidden items-center justify-center"
        style={{
          backgroundImage: authConfig.hero_image_url
            ? `url(${authConfig.hero_image_url})`
            : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundColor: authConfig.hero_image_url ? undefined : 'hsl(var(--primary))',
        }}
      >
        {authConfig.hero_image_url && (
          <div className="absolute inset-0 bg-black/40" />
        )}
        <div className="relative text-center space-y-4 px-8 z-10">
          <h2 className="text-5xl font-bold text-white drop-shadow-lg">
            {authConfig.hero_title}
          </h2>
          <p className="text-xl text-white/90 drop-shadow">
            {authConfig.hero_subtitle}
          </p>
        </div>
      </div>
    </div>
  );
}
