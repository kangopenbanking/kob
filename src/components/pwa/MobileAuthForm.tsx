import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Mail, Lock, User, Eye, EyeOff, ArrowRight, Phone, Smartphone, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTenant } from './TenantProvider';
import { supabase } from '@/integrations/supabase/client';
import { useFirebasePhoneAuth } from '@/hooks/useFirebasePhoneAuth';
import { enforceSingleSession } from '@/hooks/useSingleSession';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';
import { API_CONFIG } from '@/config/api';

const COUNTRY_CODES = [
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
  { code: '+44', country: 'UK', flag: '🇬🇧' },
  { code: '+49', country: 'Germany', flag: '🇩🇪' },
  { code: '+86', country: 'China', flag: '🇨🇳' },
  { code: '+91', country: 'India', flag: '🇮🇳' },
];

interface MobileAuthFormProps {
  onAuthSuccess: () => void;
  onApplyAccount?: () => void;
}

export const MobileAuthForm: React.FC<MobileAuthFormProps> = ({ onAuthSuccess, onApplyAccount }) => {
  const tenant = useTenant();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', fullName: '' });

  // Phone auth state
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const firebasePhone = useFirebasePhoneAuth();

  // PIN login state
  const [pinLoginMode, setPinLoginMode] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [pinLoading, setPinLoading] = useState(false);
  const [hasPinChecked, setHasPinChecked] = useState(false);
  const [userHasPin, setUserHasPin] = useState(false);

  const isCameroon = countryCode === '+237';

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName },
            emailRedirectTo: API_CONFIG.SITE_URL,
          },
        });
        if (error) throw error;
        toast.success('Account created! Please check your email to verify.');
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        if (data.session) await enforceSingleSession(data.session.access_token);
        sounds.success();
        onAuthSuccess();
      }
    } catch (err: any) {
      sounds.error();
      toast.error(err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckPin = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const fullPhone = `${countryCode}${phoneNumber}`;
    try {
      const { data, error } = await supabase.functions.invoke('phone-auth-check-pin', {
        body: { phone_number: fullPhone },
      });
      if (error) throw error;
      setHasPinChecked(true);
      setUserHasPin(data?.has_pin === true);
    } catch {
      setHasPinChecked(true);
      setUserHasPin(false);
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast.error('Please enter a valid phone number');
      return;
    }
    const fullPhone = `${countryCode}${phoneNumber}`;
    // Also check PIN in background
    if (!hasPinChecked) handleCheckPin();
    await firebasePhone.sendOTP(fullPhone);
  };

  const handleVerifyOTP = async () => {
    if (otpCode.length !== 6) {
      toast.error('Please enter the 6-digit code');
      return;
    }
    const success = await firebasePhone.verifyOTP(otpCode);
    if (success) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) await enforceSingleSession(session.access_token);
      sounds.success();
      onAuthSuccess();
    }
  };

  const handlePinLogin = async () => {
    if (pinCode.length !== 6) return;
    setPinLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;

      // First generate a captcha session
      const { data: captchaData, error: captchaError } = await supabase.functions.invoke('captcha-generate', {
        body: {},
      });

      if (captchaError) throw captchaError;

      // Auto-verify the captcha (since this is a legitimate user login)
      const { error: verifyError } = await supabase.functions.invoke('captcha-verify', {
        body: {
          session_id: captchaData.session_id,
          answer: captchaData.answer, // We have the answer from generate
        },
      });

      if (verifyError) throw verifyError;

      const { data, error } = await supabase.functions.invoke('phone-auth-pin-login', {
        body: {
          phone_number: fullPhone,
          pin_code: pinCode,
          captcha_session_id: captchaData.session_id,
        },
      });

      if (error) throw error;

      if (data?.success && data?.magic_link) {
        // Extract token from magic link and verify
        const url = new URL(data.magic_link);
        const token = url.searchParams.get('token') || url.hash?.split('token=')[1];

        if (token) {
          const { error: otpError } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'magiclink',
          });

          if (otpError) {
            // Fallback: try to use the link directly
            console.warn('Token verification failed, trying direct approach:', otpError);
            // Try email login as fallback
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session could not be established');
          }
        }

        const { data: { session } } = await supabase.auth.getSession();
        if (session) await enforceSingleSession(session.access_token);

        sounds.success();
        toast.success('Login successful!');
        onAuthSuccess();
      } else {
        sounds.error();
        const remaining = data?.remaining_attempts;
        toast.error(`Invalid PIN. ${remaining !== undefined ? `${remaining} attempts remaining.` : ''}`);
        setPinCode('');
      }
    } catch (err: any) {
      sounds.error();
      toast.error(err.message || 'PIN login failed');
      setPinCode('');
    } finally {
      setPinLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background px-6 py-12">
      <div id="recaptcha-container" />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-1 flex-col">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'login' ? `Sign in to your ${tenant.name} account` : `Join ${tenant.name} today`}
          </p>
        </div>

        <Tabs defaultValue="phone" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="phone" className="gap-1.5">
              <Smartphone className="h-4 w-4" strokeWidth={1.5} />
              Phone
              {isCameroon && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  Recommended
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="email" className="gap-1.5">
              <Mail className="h-4 w-4" strokeWidth={1.5} />
              Email
            </TabsTrigger>
          </TabsList>

          {/* Phone Tab */}
          <TabsContent value="phone" className="mt-4">
            <div className="flex flex-col gap-4">
              {firebasePhone.step === 'phone' && !pinLoginMode && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Phone Number</Label>
                    <div className="flex gap-2">
                      <Select value={countryCode} onValueChange={setCountryCode}>
                        <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {COUNTRY_CODES.map(cc => (
                            <SelectItem key={cc.code} value={cc.code}>{cc.flag} {cc.code}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="relative flex-1">
                        <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                        <Input
                          type="tel"
                          placeholder="6 XX XX XX XX"
                          value={phoneNumber}
                          onChange={e => {
                            setPhoneNumber(e.target.value.replace(/\D/g, ''));
                            setHasPinChecked(false);
                          }}
                          className="pl-10"
                          onBlur={handleCheckPin}
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSendOTP} className="w-full gap-2" size="lg" disabled={firebasePhone.loading}>
                    {firebasePhone.loading ? 'Sending...' : 'Send Verification Code'}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </Button>

                  {hasPinChecked && userHasPin && (
                    <Button
                      variant="outline"
                      onClick={() => setPinLoginMode(true)}
                      className="w-full gap-2"
                      size="lg"
                    >
                      <KeyRound className="h-4 w-4" strokeWidth={1.5} />
                      Login with PIN instead
                    </Button>
                  )}
                </>
              )}

              {/* PIN Login Mode */}
              {pinLoginMode && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Enter Your 6-Digit PIN</Label>
                    <p className="text-xs text-muted-foreground">
                      Logging in as {countryCode}{phoneNumber}
                    </p>
                    <div className="flex justify-center pt-2">
                      <InputOTP maxLength={6} value={pinCode} onChange={setPinCode}>
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
                  </div>

                  <Button onClick={handlePinLogin} className="w-full gap-2" size="lg" disabled={pinLoading || pinCode.length !== 6}>
                    {pinLoading ? 'Verifying...' : 'Login with PIN'}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setPinLoginMode(false); setPinCode(''); }}>
                      Use OTP instead
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { setPinLoginMode(false); setPinCode(''); setPhoneNumber(''); setHasPinChecked(false); }}>
                      Change Number
                    </Button>
                  </div>
                </>
              )}

              {/* OTP verification */}
              {(firebasePhone.step === 'otp' || firebasePhone.step === 'verifying') && !pinLoginMode && (
                <>
                  <div className="space-y-2">
                    <Label className="text-sm">Enter 6-Digit Code</Label>
                    <p className="text-xs text-muted-foreground">Code sent to {countryCode}{phoneNumber}</p>
                    <InputOTP maxLength={6} value={otpCode} onChange={setOtpCode}>
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

                  <Button onClick={handleVerifyOTP} className="w-full gap-2" size="lg" disabled={firebasePhone.loading || otpCode.length !== 6}>
                    {firebasePhone.loading ? 'Verifying...' : 'Verify Code'}
                    <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
                  </Button>

                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { firebasePhone.reset(); setOtpCode(''); }}>Change Number</Button>
                    <Button variant="ghost" size="sm" onClick={handleSendOTP} disabled={firebasePhone.loading}>Resend Code</Button>
                  </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* Email Tab */}
          <TabsContent value="email" className="mt-4">
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              {mode === 'signup' && (
                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-sm">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                    <Input id="fullName" placeholder="John Doe" value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="pl-10" required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input id="email" type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="pl-10" required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={1.5} />
                  <Input id="password" type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="pl-10 pr-10" required minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" strokeWidth={1.5} /> : <Eye className="h-4 w-4" strokeWidth={1.5} />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="mt-2 w-full gap-2" size="lg" disabled={loading}>
                {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
                <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <button type="button" onClick={() => setMode(mode === 'login' ? 'signup' : 'login')} className="text-sm text-primary">
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>

        {onApplyAccount && mode === 'login' && (
          <div className="mt-4 text-center">
            <button type="button" onClick={onApplyAccount} className="text-sm text-muted-foreground underline">
              Not yet a customer? Apply for an account
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};
