import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Phone, Lock, Mail, MapPin, AlertTriangle } from 'lucide-react';
import { KangIdBadge } from '@/components/identity/KangIdBadge';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { formatErrorForToast, parseEdgeFunctionError } from '@/lib/error-handler';
import { Alert, AlertDescription } from '@/components/ui/alert';

import { useSupportedCountries } from '@/hooks/useSupportedCountries';

export default function ProfileSettings() {
  const { toast } = useToast();
  const { data: supportedCountries = [] } = useSupportedCountries('desktop');
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'sms' | 'whatsapp' | 'auto'>('auto');
  const [otpCode, setOtpCode] = useState('');
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [pinCode, setPinCode] = useState('');
  const [errorAlert, setErrorAlert] = useState<{ title: string; message: string; action?: string } | null>(null);
  // Fetch PostiQ verification
  const { data: postiqData } = useQuery({
    queryKey: ['postiq-verification'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data } = await supabase
        .from('postiq_address_verifications')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('verified_at', { ascending: false })
        .limit(1)
        .single();
      return data;
    }
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (data) {
        setProfile(data);
        if (data.phone_number) {
          const match = data.phone_number.match(/^(\+\d+)(\d+)$/);
          if (match) {
            setCountryCode(match[1]);
            setPhoneNumber(match[2]);
          }
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleSendOTP = async () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast({
        title: 'Invalid phone number',
        description: 'Please enter a valid phone number',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    setErrorAlert(null);
    
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      
      const { data, error } = await supabase.functions.invoke('phone-auth-send-otp', {
        body: {
          phone_number: fullPhone,
          otp_type: 'verification',
          delivery_method: deliveryMethod,
        },
      });

      if (error) {
        const parsedError = parseEdgeFunctionError(error);
        const { title, description } = formatErrorForToast(error);
        
        // Show persistent alert for quota/service issues
        if (parsedError.code === 'QUOTA_EXCEEDED' || parsedError.code === 'SERVICE_UNAVAILABLE') {
          setErrorAlert({
            title: title,
            message: parsedError.userMessage,
            action: parsedError.action
          });
        }
        
        toast({
          title,
          description,
          variant: 'destructive',
        });
        return;
      }

      toast({
        title: 'OTP Sent',
        description: `Verification code sent via ${deliveryMethod === 'auto' ? 'SMS/WhatsApp' : deliveryMethod}`,
      });

      setShowOTPInput(true);
    } catch (error: any) {
      const { title, description } = formatErrorForToast(error);
      toast({
        title,
        description,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhone = async () => {
    if (otpCode.length !== 6) {
      toast({
        title: 'Invalid OTP',
        description: 'Please enter the 6-digit code',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      
      const { error } = await supabase.functions.invoke('phone-auth-verify-otp', {
        body: {
          phone_number: fullPhone,
          otp_code: otpCode,
          otp_type: 'verification',
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Phone number verified successfully',
      });

      setShowOTPInput(false);
      setOtpCode('');
      loadProfile();
    } catch (error: any) {
      toast({
        title: 'Verification Failed',
        description: error.message || 'Invalid OTP code',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSetPIN = async () => {
    if (pinCode.length !== 6 || !/^\d{6}$/.test(pinCode)) {
      toast({
        title: 'Invalid PIN',
        description: 'PIN must be exactly 6 digits',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { error } = await supabase.functions.invoke('pin-code-set', {
        body: { pin_code: pinCode },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'PIN code set successfully',
      });

      setPinCode('');
      loadProfile();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set PIN',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-4xl mx-auto py-8 space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Profile Settings</h1>
          <p className="text-muted-foreground">Manage your account, identity and security</p>
        </div>
      </div>

      {/* KANG ID — permanent identifier used across send, receive and transfers */}
      <KangIdBadge kangId={profile?.kang_id} variant="card" />

      {/* Phone Number Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Phone Number
          </CardTitle>
          <CardDescription>
            {profile?.phone_verified 
              ? 'Your phone number is verified' 
              : 'Add and verify your phone number for enhanced security'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.phone_verified ? (
            <div className="space-y-2">
              <Label>Current Phone Number</Label>
              <Input value={profile.phone_number} disabled />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Phone Number</Label>
                <div className="flex gap-2">
                  <Select value={countryCode} onValueChange={setCountryCode}>
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {supportedCountries.map((sc) => (
                        <SelectItem key={`${sc.dial_code}-${sc.country}`} value={sc.dial_code}>
                          {sc.flag} {sc.dial_code}
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

              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <RadioGroup value={deliveryMethod} onValueChange={(v: 'sms' | 'whatsapp' | 'auto') => setDeliveryMethod(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="sms-pref" />
                    <Label htmlFor="sms-pref" className="font-normal">SMS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="whatsapp" id="whatsapp-pref" />
                    <Label htmlFor="whatsapp-pref" className="font-normal">WhatsApp</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="auto" id="auto-pref" />
                    <Label htmlFor="auto-pref" className="font-normal">Auto (SMS with WhatsApp fallback)</Label>
                  </div>
                </RadioGroup>
              </div>

              {errorAlert && (
                <Alert variant="destructive" className="border-destructive/50 bg-destructive/10">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="ml-2">
                    <span className="font-medium">{errorAlert.title}:</span> {errorAlert.message}
                    {errorAlert.action && (
                      <span className="block mt-1 text-sm opacity-80">
                        Suggestion: {errorAlert.action}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {!showOTPInput ? (
                <Button onClick={handleSendOTP} disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send Verification Code
                </Button>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Enter Verification Code</Label>
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
                  <Button onClick={handleVerifyPhone} disabled={loading || otpCode.length !== 6}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Verify Phone
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* PostiQ Address Verification Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Verified Address (PostiQ)
          </CardTitle>
          <CardDescription>
            Your verified physical address for credit score enhancement
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {postiqData ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 p-4 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                <MapPin className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono font-semibold text-lg">{postiqData.postiq_code}</span>
                    <Badge variant="outline" className="bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700">
                      Verified
                    </Badge>
                  </div>
                  {postiqData.full_address && (
                    <p className="text-sm text-muted-foreground">{postiqData.full_address}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Verified on {new Date(postiqData.verified_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                ✓ This verified address provides a <strong className="text-green-600 dark:text-green-400">+50 point boost</strong> to your credit score
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                No verified address yet. Verify your address on the Credit Score page to boost your score by +50 points.
              </p>
              <Button variant="outline" asChild>
                <a href="/credit-score">
                  <MapPin className="mr-2 h-4 w-4" />
                  Verify Address
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* PIN Code Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security PIN
          </CardTitle>
          <CardDescription>
            {profile?.pin_code_hash 
              ? 'Update your 6-digit PIN for password recovery' 
              : 'Set a 6-digit PIN for password recovery'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{profile?.pin_code_hash ? 'New PIN Code' : 'Set PIN Code'}</Label>
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
          <Button onClick={handleSetPIN} disabled={loading || pinCode.length !== 6}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {profile?.pin_code_hash ? 'Update PIN' : 'Set PIN'}
          </Button>
        </CardContent>
      </Card>

      {/* Email Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Address
          </CardTitle>
          <CardDescription>
            {profile?.email && !profile.email.includes('@temp.kob.cm')
              ? 'Your email address for notifications' 
              : 'Add an email address for notifications (optional)'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {profile?.email && !profile.email.includes('@temp.kob.cm') ? (
            <div className="space-y-2">
              <Label>Current Email</Label>
              <Input value={profile.email} disabled />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input
                  type="email"
                  placeholder="your@email.com"
                  value={profile?.email?.includes('@temp.kob.cm') ? '' : profile?.email || ''}
                  onChange={async (e) => {
                    const newEmail = e.target.value;
                    if (newEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
                      try {
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                          await supabase
                            .from('profiles')
                            .update({ email: newEmail })
                            .eq('id', user.id);
                          
                          toast({
                            title: 'Success',
                            description: 'Email address saved',
                          });
                          
                          loadProfile();
                        }
                      } catch (error: any) {
                        toast({
                          title: 'Error',
                          description: error.message || 'Failed to save email',
                          variant: 'destructive',
                        });
                      }
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Enter a valid email and it will be saved automatically
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
