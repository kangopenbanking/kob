import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Shield, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { sounds } from '@/lib/sounds';
import { toast } from 'sonner';

interface PinConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
  title?: string;
  description?: string;
}

export const PinConfirmDialog: React.FC<PinConfirmDialogProps> = ({
  open,
  onOpenChange,
  onConfirmed,
  title = 'Enter Transaction PIN',
  description = 'Enter your 6-digit PIN to authorize this transaction',
}) => {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);

  const handleVerify = async () => {
    if (pin.length !== 6) return;
    setLoading(true);
    try {
      // Get current user's phone number
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: profile } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('id', user.id)
        .single();

      if (!profile?.phone_number) {
        toast.error('No phone number linked to your account');
        return;
      }

      const { data, error } = await supabase.functions.invoke('pin-code-verify', {
        body: { phone_number: profile.phone_number, pin_code: pin },
      });

      if (error) throw error;

      if (data?.verified) {
        sounds.success();
        setPin('');
        setRemainingAttempts(null);
        onOpenChange(false);
        onConfirmed();
      } else {
        sounds.error();
        setRemainingAttempts(data?.remaining_attempts ?? null);
        setLocked(data?.locked ?? false);
        setPin('');
        if (data?.locked) {
          toast.error('Account locked due to too many failed attempts. Try again in 30 minutes.');
        } else {
          toast.error(`Invalid PIN. ${data?.remaining_attempts ?? 0} attempts remaining.`);
        }
      }
    } catch (err: any) {
      sounds.error();
      toast.error(err.message || 'PIN verification failed');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setPin('');
      setRemainingAttempts(null);
      setLocked(false);
    }
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="rounded-2xl max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-2">
            <Shield className="h-7 w-7 text-primary" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <p className="text-center text-sm text-muted-foreground">{description}</p>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 pt-2">
          {locked ? (
            <div className="flex flex-col items-center gap-2 py-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm font-semibold text-destructive text-center">
                Account locked. Try again in 30 minutes.
              </p>
            </div>
          ) : (
            <>
              <InputOTP maxLength={6} value={pin} onChange={setPin}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>

              {remainingAttempts !== null && remainingAttempts < 3 && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {remainingAttempts} attempt{remainingAttempts !== 1 ? 's' : ''} remaining
                </p>
              )}

              <Button
                onClick={handleVerify}
                disabled={loading || pin.length !== 6}
                className="w-full gap-2 rounded-xl"
                size="lg"
              >
                {loading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  'Confirm'
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
