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
import { Loader2, Phone, Lock, Mail } from 'lucide-react';

const COUNTRY_CODES = [
  { code: '+237', country: 'Cameroon', flag: '🇨🇲' },
  { code: '+1', country: 'USA/Canada', flag: '🇺🇸' },
  { code: '+33', country: 'France', flag: '🇫🇷' },
  { code: '+234', country: 'Nigeria', flag: '🇳🇬' },
];

export default function ProfileSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState<'sms' | 'whatsapp' | 'both'>('both');
  const [otpCode, setOtpCode] = useState('');
  const [showOTPInput, setShowOTPInput] = useState(false);
  const [pinCode, setPinCode] = useState('');

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
    try {
      const fullPhone = `${countryCode}${phoneNumber}`;
      
      const { error } = await supabase.functions.invoke('phone-auth-send-otp', {
        body: {
          phone_number: fullPhone,
          otp_type: 'verification',
          delivery_method: deliveryMethod,
        },
      });

      if (error) throw error;

      toast({
        title: 'OTP Sent',
        description: `Verification code sent via ${deliveryMethod}`,
      });

      setShowOTPInput(true);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send OTP',
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
      <div>
        <h1 className="text-3xl font-bold">Profile Settings</h1>
        <p className="text-muted-foreground">Manage your account security settings</p>
      </div>

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

              <div className="space-y-2">
                <Label>Delivery Method</Label>
                <RadioGroup value={deliveryMethod} onValueChange={(v: any) => setDeliveryMethod(v)}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="sms" id="sms-pref" />
                    <Label htmlFor="sms-pref" className="font-normal">SMS</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="whatsapp" id="whatsapp-pref" />
                    <Label htmlFor="whatsapp-pref" className="font-normal">WhatsApp</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="both" id="both-pref" />
                    <Label htmlFor="both-pref" className="font-normal">Both</Label>
                  </div>
                </RadioGroup>
              </div>

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
