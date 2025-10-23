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
import { Loader2, ArrowLeft } from 'lucide-react';
import { z } from 'zod';

type AuthStep = 'captcha' | 'phone' | 'otp' | 'complete';
type OTPType = 'login' | 'signup';
type DeliveryMethod = 'sms' | 'whatsapp' | 'both';

// Country codes for international support
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

// Validation schemas
const phoneSchema = z.string().regex(/^\d{6,15}$/, 'Invalid phone number format');
const pinSchema = z.string().regex(/^\d{6}$/, 'PIN must be exactly 6 digits');
const otpSchema = z.string().regex(/^\d{6}$/, 'OTP must be exactly 6 digits');

export default function Auth() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [authStep, setAuthStep] = useState<AuthStep>('captcha');
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
      toast({
        title: 'Required',
        description: 'Please solve the math problem',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('captcha-verify', {
        body: {
          session_id: captchaSessionId,
          answer: parseInt(captchaAnswer),
        },
      });

      if (error || !data.verified) {
        throw new Error(data?.error || 'Captcha verification failed');
      }

      toast({
        title: 'Success',
        description: 'Security check passed',
      });
      setAuthStep('phone');
    } catch (error: any) {
      toast({
        title: 'Incorrect',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
      generateCaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    // Validate phone number
    try {
      phoneSchema.parse(phoneNumber);
    } catch {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number (6-15 digits)',
        variant: 'destructive',
      });
      return;
    }

    // Validate full name for signup
    if (!isLogin && !fullName.trim()) {
      toast({
        title: 'Required field',
        description: 'Please enter your full name',
        variant: 'destructive',
      });
      return;
    }

    // Validate PIN for signup
    if (!isLogin) {
      try {
        pinSchema.parse(pinCode);
      } catch {
        toast({
          title: 'Invalid PIN',
          description: 'PIN must be exactly 6 digits',
          variant: 'destructive',
        });
        return;
      }
    }

    setLoading(true);
    try {
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

      toast({
        title: 'OTP Sent',
        description: `Verification code sent via ${deliveryMethod === 'both' ? 'SMS and WhatsApp' : deliveryMethod.toUpperCase()}`,
      });

      setOtpExpiresAt(data.expires_at);
      setAuthStep('otp');
    } catch (error: any) {
      console.error('Send OTP error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to send OTP. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    try {
      otpSchema.parse(otpCode);
    } catch {
      toast({
        title: 'Invalid OTP',
        description: 'OTP must be exactly 6 digits',
        variant: 'destructive',
      });
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

      if (error) {
        // Extract error message from the response
        const errorMsg = error.message || 'Verification failed';
        throw new Error(errorMsg);
      }

      if (!data.success) {
        throw new Error(data.error || 'Verification failed');
      }

      toast({
        title: 'Success',
        description: `${isLogin ? 'Logged in' : 'Account created'} successfully!`,
      });

      // Refresh session
      await supabase.auth.refreshSession();
      
      setAuthStep('complete');
      
      // Check for institution registration status
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: institution } = await supabase
          .from('institutions')
          .select('id, status')
          .eq('user_id', user.id)
          .single();
        
        if (!institution) {
          // No institution registered - redirect to registration
          setTimeout(() => navigate('/register'), 1000);
        } else if (institution.status === 'pending') {
          // Pending approval
          setTimeout(() => navigate('/pending-approval'), 1000);
        } else if (institution.status === 'approved') {
          // Approved - go to portal
          setTimeout(() => navigate('/fi-portal'), 1000);
        } else {
          // Rejected or other status
          setTimeout(() => navigate('/pending-approval'), 1000);
        }
      }
    } catch (error: any) {
      console.error('Verify OTP error:', error);
      
      // Provide helpful error messages
      let errorMessage = error.message || 'Invalid or expired OTP code';
      
      if (errorMessage.includes('No account found')) {
        errorMessage = 'No account found. Please sign up first using the link below.';
      } else if (errorMessage.includes('Invalid or expired')) {
        errorMessage = 'Invalid or expired code. Please request a new code.';
      }
      
      toast({
        title: 'Verification Failed',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    try {
      phoneSchema.parse(phoneNumber);
      pinSchema.parse(pinCode);
    } catch {
      toast({
        title: 'Invalid input',
        description: 'Please enter valid phone number and 6-digit PIN',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      
      // Verify PIN
      const { data: pinData, error: pinError } = await supabase.functions.invoke('pin-code-verify', {
        body: {
          phone_number: fullPhone,
          pin_code: pinCode,
        },
      });

      if (pinError || !pinData.verified) {
        throw new Error(pinData?.error || 'Invalid PIN code');
      }

      // Send OTP for password reset
      const { error: otpError } = await supabase.functions.invoke('phone-auth-send-otp', {
        body: {
          phone_number: fullPhone,
          otp_type: 'password_reset',
          delivery_method: deliveryMethod,
          captcha_session_id: captchaSessionId,
        },
      });

      if (otpError) throw otpError;

      toast({
        title: 'OTP Sent',
        description: 'Enter the code to reset your password',
      });

      setAuthStep('otp');
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to verify PIN',
        variant: 'destructive',
      });
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
    generateCaptcha();
  };

  const goBack = () => {
    if (authStep === 'otp') {
      setAuthStep('phone');
      setOtpCode('');
    } else if (authStep === 'phone') {
      setAuthStep('captcha');
      generateCaptcha();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center gap-4 mb-4">
            <img src="/kob-logo.png" alt="KOB Logo" className="h-12 w-12" />
            <div>
              <CardTitle className="text-2xl font-bold">
                {showForgotPassword ? 'Reset Password' : isLogin ? 'Welcome Back' : 'Create Account'}
              </CardTitle>
              <CardDescription>
                {showForgotPassword 
                  ? 'Verify your phone and PIN to reset password'
                  : isLogin 
                    ? 'Sign in to your account using your phone number' 
                    : 'Sign up with phone only - add email later from Profile Settings'
                }
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Captcha Step */}
          {authStep === 'captcha' && (
            <div className="space-y-4">
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

          {/* Phone Number Step */}
          {authStep === 'phone' && (
            <div className="space-y-4">
              <Button variant="ghost" size="sm" onClick={goBack} className="mb-2">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

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
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="6 XX XX XX XX"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, ''))}
                  />
                </div>
              </div>

              {!isLogin && !showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="pin">Set 6-Digit PIN *</Label>
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
                  <p className="text-xs text-muted-foreground">
                    Use this PIN to recover your password
                  </p>
                </div>
              )}

              {showForgotPassword && (
                <div className="space-y-2">
                  <Label htmlFor="reset-pin">Enter Your 6-Digit PIN</Label>
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
              )}

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

              <Button 
                onClick={showForgotPassword ? handleForgotPassword : handleSendOTP} 
                className="w-full" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>

              {isLogin && !showForgotPassword && (
                <Button 
                  variant="link" 
                  className="w-full" 
                  onClick={() => setShowForgotPassword(true)}
                >
                  Forgot Password?
                </Button>
              )}
            </div>
          )}

          {/* OTP Verification Step */}
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
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                  </InputOTPGroup>
                </InputOTP>
                {otpExpiresAt && (
                  <p className="text-xs text-muted-foreground">
                    Code expires in 10 minutes
                  </p>
                )}
              </div>

              <Button onClick={handleVerifyOTP} className="w-full" disabled={loading || otpCode.length !== 6}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify Code
              </Button>

              <Button 
                variant="ghost" 
                className="w-full" 
                onClick={() => {
                  setOtpCode('');
                  handleSendOTP();
                }}
                disabled={loading}
              >
                Resend Code
              </Button>
            </div>
          )}

          {/* Success Step */}
          {authStep === 'complete' && (
            <div className="text-center py-8">
              <div className="mb-4 text-4xl">✓</div>
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
  );
}
