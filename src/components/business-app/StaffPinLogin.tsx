import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Phone, Fingerprint, ArrowLeft, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { enforceSingleSession } from '@/hooks/useSingleSession';
import { useSupportedCountries } from '@/hooks/useSupportedCountries';
import { toast } from 'sonner';
import { sounds } from '@/lib/sounds';

interface StaffPinLoginProps {
  onAuthSuccess: () => void;
  onBack: () => void;
}

type StaffStep = 'phone' | 'pin';

export const StaffPinLogin: React.FC<StaffPinLoginProps> = ({ onAuthSuccess, onBack }) => {
  const { data: supportedCountries = [] } = useSupportedCountries('banking');
  const [step, setStep] = useState<StaffStep>('phone');
  const [countryCode, setCountryCode] = useState('+237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);

  const fullPhone = `${countryCode}${phoneNumber}`;

  const handleContinue = () => {
    if (!phoneNumber || phoneNumber.length < 6) {
      toast.error('Please enter a valid phone number');
      return;
    }
    setStep('pin');
    setPinCode('');
    setPinError(null);
  };

  const handlePinSubmit = async () => {
    if (pinCode.length !== 6) return;
    setLoading(true);
    setPinError(null);
    try {
      const { data, error } = await supabase.functions.invoke('staff-pin-login', {
        body: { phone_number: fullPhone, pin_code: pinCode },
      });

      if (error) throw error;
      if (!data?.success || !data?.session) {
        throw new Error(data?.error || 'Invalid phone number or PIN');
      }

      // Set the session from the edge function response
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      });

      if (sessionError) throw sessionError;

      await enforceSingleSession(data.session.access_token);
      sounds.success();
      toast.success(`Welcome, ${data.staff?.name || 'Staff'}!`);
      onAuthSuccess();
    } catch (err: any) {
      sounds.error();
      setPinError(err.message || 'Staff login failed');
      setPinCode('');
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  useEffect(() => {
    if (step === 'pin' && pinCode.length === 6 && !loading) {
      handlePinSubmit();
    }
  }, [pinCode, step]);

  return (
    <div className="flex flex-col gap-5">
      {step === 'phone' && (
        <motion.div
          key="staff-phone"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="flex flex-col gap-5"
        >
          <div className="flex items-center gap-3 rounded-xl bg-accent/50 p-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent">
              <Shield className="h-5 w-5 text-accent-foreground" strokeWidth={1.5} />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Staff Login</p>
              <p className="text-[11px] text-muted-foreground">Use your staff phone number &amp; PIN</p>
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
                    <SelectItem key={`${cc.dial_code}-${cc.code}`} value={cc.dial_code}>
                      {cc.flag} {cc.dial_code}
                    </SelectItem>
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
            onClick={handleContinue}
            className="w-full gap-2 rounded-xl py-6 text-base font-semibold shadow-md shadow-primary/20"
            size="lg"
            disabled={phoneNumber.length < 6}
          >
            Continue
          </Button>

          <Button variant="ghost" onClick={onBack} className="w-full gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Owner Login
          </Button>
        </motion.div>
      )}

      {step === 'pin' && (
        <motion.div
          key="staff-pin"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="flex flex-col items-center gap-5"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Fingerprint className="h-10 w-10 text-primary" strokeWidth={1.2} />
          </div>

          <div className="text-center">
            <p className="text-sm font-medium text-foreground">Enter your 6-digit staff PIN</p>
            {pinError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-xs text-destructive">
                {pinError}
              </motion.p>
            )}
          </div>

          <InputOTP maxLength={6} value={pinCode} onChange={setPinCode} disabled={loading}>
            <InputOTPGroup className="gap-2">
              {[0, 1, 2, 3, 4, 5].map(i => (
                <InputOTPSlot
                  key={i}
                  index={i}
                  className="h-12 w-11 rounded-xl border-border/60 text-lg font-bold shadow-sm"
                />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {loading && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1 }}
              className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary"
            />
          )}

          <Button
            variant="ghost"
            onClick={() => { setStep('phone'); setPinCode(''); setPinError(null); }}
            className="gap-2 text-sm text-muted-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Change number
          </Button>
        </motion.div>
      )}
    </div>
  );
};
