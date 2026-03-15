import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { markPinAsJustSet } from '@/hooks/useMandatoryPin';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, Lock } from 'lucide-react';

export default function MandatoryPinSetup() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [loading, setLoading] = useState(false);

  const handlePinEntry = (value: string) => {
    if (step === 'create') {
      setPin(value);
      if (value.length === 6) {
        setTimeout(() => setStep('confirm'), 300);
      }
    } else {
      setConfirmPin(value);
    }
  };

  const handleSubmit = async () => {
    if (pin !== confirmPin) {
      toast({ title: 'PINs do not match', description: 'Please try again.', variant: 'destructive' });
      setStep('create');
      setPin('');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const phone = user.phone || user.user_metadata?.phone_number;
      if (!phone) throw new Error('No phone number on file');

      const fullPhone = phone.startsWith('+') ? phone : `+${phone}`;

      const { data, error } = await supabase.functions.invoke('pin-code-set', {
        body: { phone_number: fullPhone, pin_code: pin },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || 'Failed to set PIN');
      }

      toast({ title: 'PIN Created', description: 'Your 6-digit security PIN has been set successfully.' });
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message || 'Failed to set PIN', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Security PIN Required</CardTitle>
          <CardDescription>
            Your administrator requires all users to set up a 6-digit security PIN for two-factor authentication.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground">
              <Lock className="h-4 w-4" />
              {step === 'create' ? 'Create your PIN' : 'Confirm your PIN'}
            </div>
            <p className="text-xs text-muted-foreground">
              {step === 'create'
                ? 'Enter a 6-digit PIN you will remember'
                : 'Re-enter your PIN to confirm'}
            </p>
          </div>

          <div className="flex justify-center">
            <InputOTP
              maxLength={6}
              value={step === 'create' ? pin : confirmPin}
              onChange={handlePinEntry}
            >
              <InputOTPGroup>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <InputOTPSlot key={i} index={i} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>

          {step === 'confirm' && confirmPin.length === 6 && (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Setting PIN...
                </>
              ) : (
                'Set PIN & Continue'
              )}
            </Button>
          )}

          {step === 'confirm' && (
            <Button
              variant="ghost"
              onClick={() => {
                setStep('create');
                setPin('');
                setConfirmPin('');
              }}
              className="w-full text-sm"
            >
              Start Over
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
