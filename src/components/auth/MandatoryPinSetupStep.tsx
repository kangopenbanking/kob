import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { extractEdgeFunctionError } from '@/lib/edge-function-error';

interface MandatoryPinSetupStepProps {
  onComplete: () => void;
  onSkip?: () => void;
  title?: string;
  subtitle?: string;
}

export const MandatoryPinSetupStep: React.FC<MandatoryPinSetupStepProps> = ({
  onComplete,
  title = 'Set Your Security PIN',
  subtitle = 'Create a 6-digit PIN for secure login',
}) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [step, setStep] = useState<'enter' | 'confirm' | 'success'>('enter');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePinEntered = () => {
    if (pin.length !== 6) return;
    setError(null);
    setStep('confirm');
  };

  const handleConfirmPin = async () => {
    if (confirmPin.length !== 6) return;
    if (pin !== confirmPin) {
      setError('PINs do not match. Please try again.');
      setConfirmPin('');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('pin-code-set', {
        body: { pin_code: pin },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setStep('success');
      toast.success('PIN set successfully!');
      // Release any held inbound transfers now that the account is fully activated
      supabase.functions.invoke('release-pending-inbound', { body: {} })
        .then((res: any) => {
          const count = res?.data?.released_count || 0;
          if (count > 0) {
            toast.success(`${count} pending transfer${count > 1 ? 's' : ''} released to your wallet!`);
          }
        })
        .catch(() => {});
      setTimeout(() => onComplete(), 1500);
    } catch (err: any) {
      setError(extractEdgeFunctionError(err, 'Failed to set PIN. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  // Auto-submit when 6 digits entered
  React.useEffect(() => {
    if (step === 'enter' && pin.length === 6) {
      handlePinEntered();
    }
  }, [pin, step]);

  React.useEffect(() => {
    if (step === 'confirm' && confirmPin.length === 6 && !loading) {
      handleConfirmPin();
    }
  }, [confirmPin, step]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center gap-5 py-4"
    >
      {step === 'success' ? (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <CheckCircle2 className="h-10 w-10 text-green-600 dark:text-green-400" strokeWidth={1.5} />
          </div>
          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">PIN Set Successfully!</p>
            <p className="text-sm text-muted-foreground mt-1">Redirecting you now...</p>
          </div>
        </motion.div>
      ) : (
        <>
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-10 w-10 text-primary" strokeWidth={1.2} />
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 'enter' ? subtitle : 'Re-enter your PIN to confirm'}
            </p>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-2 text-sm font-medium text-destructive"
              >
                {error}
              </motion.p>
            )}
          </div>

          <div className="py-2">
            {step === 'enter' ? (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-center block">Enter PIN</Label>
                <InputOTP maxLength={6} value={pin} onChange={(val) => { setPin(val); setError(null); }}>
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
            ) : (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-center block">Confirm PIN</Label>
                <InputOTP maxLength={6} value={confirmPin} onChange={(val) => { setConfirmPin(val); setError(null); }}>
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
            )}
          </div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Setting your PIN...
            </div>
          )}

          {step === 'confirm' && !loading && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setStep('enter'); setPin(''); setConfirmPin(''); setError(null); }}
              className="text-xs text-muted-foreground"
            >
              Start over
            </Button>
          )}

          <div className="w-full rounded-lg bg-muted/50 p-3 text-center">
            <p className="text-xs text-muted-foreground">
              Your PIN will be used for secure login and transaction authorization. Keep it confidential.
            </p>
          </div>
        </>
      )}
    </motion.div>
  );
};
