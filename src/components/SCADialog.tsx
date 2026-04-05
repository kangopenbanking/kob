/**
 * SCADialog — Strong Customer Authentication challenge modal
 * Displays OTP/PIN input for payment authorization
 * 
 * No gradients, outline style, professional UI per workspace rules
 */

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Button } from '@/components/ui/button';
import { Shield, Loader2, AlertCircle } from 'lucide-react';

interface SCADialogProps {
  isOpen: boolean;
  method?: 'otp' | 'pin' | 'biometric';
  expiresAt?: string;
  loading?: boolean;
  verifying?: boolean;
  error?: string | null;
  onVerify: (response: string) => void;
  onCancel: () => void;
}

export const SCADialog: React.FC<SCADialogProps> = ({
  isOpen,
  method = 'otp',
  expiresAt,
  loading,
  verifying,
  error,
  onVerify,
  onCancel,
}) => {
  const [code, setCode] = useState('');

  const handleComplete = (value: string) => {
    setCode(value);
    if (value.length === 6) {
      onVerify(value);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      onCancel();
      setCode('');
    }
  };

  const title = method === 'pin' ? 'Enter Your PIN' : 'Enter Verification Code';
  const description = method === 'pin'
    ? 'Enter your 6-digit PIN to authorize this transaction'
    : 'Enter the 6-digit code sent to your registered device';

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full border-2 border-primary/20 bg-primary/5">
            <Shield className="h-6 w-6 text-primary" strokeWidth={1.5} />
          </div>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription className="text-sm">{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <InputOTP
            maxLength={6}
            value={code}
            onChange={handleComplete}
            disabled={verifying}
          >
            <InputOTPGroup>
              {[0, 1, 2, 3, 4, 5].map(i => (
                <InputOTPSlot key={i} index={i} />
              ))}
            </InputOTPGroup>
          </InputOTP>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-destructive" strokeWidth={1.5} />
              <p className="text-xs text-destructive">{error}</p>
            </div>
          )}

          {expiresAt && (
            <p className="text-xs text-muted-foreground">
              Code expires at {new Date(expiresAt).toLocaleTimeString()}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel} disabled={verifying}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={() => code.length === 6 && onVerify(code)}
            disabled={code.length !== 6 || verifying}
          >
            {verifying ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Authorize'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
