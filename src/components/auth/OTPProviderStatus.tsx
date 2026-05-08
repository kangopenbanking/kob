import { ShieldCheck, ShieldAlert, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { FirebaseErrorCategory } from '@/lib/firebaseErrors';

const REASON_BY_CATEGORY: Record<FirebaseErrorCategory, string> = {
  'invalid-phone': 'Invalid phone number',
  'too-many-requests': 'Too many recent attempts',
  'unauthorized-domain': 'This website address is not authorized for Firebase phone sign-in',
  'recaptcha-disabled': 'reCAPTCHA verification could not load',
  'billing-required': 'Firebase Blaze billing is not active',
  'network': 'Firebase verification service is temporarily unreachable',
  'provider-disabled': 'Firebase phone provider is disabled',
  'invalid-code': 'Incorrect verification code',
  'expired-code': 'Verification code expired',
  'unknown': 'Unexpected verification error',
};

interface Props {
  provider: 'firebase' | 'vonage';
  autoResendCount?: number;
  errorCategory?: FirebaseErrorCategory | null;
  hint?: string | null;
}

/**
 * Compact, user-safe banner explaining the active OTP provider and — if the
 * flow fell back to SMS — exactly why Firebase wasn't used. Renders nothing
 * for the happy path.
 */
export function OTPProviderStatus({ provider, autoResendCount = 0, errorCategory, hint }: Props) {
  if (provider === 'firebase' && !errorCategory && autoResendCount === 0) return null;

  if (provider === 'vonage') {
    const reason = errorCategory ? REASON_BY_CATEGORY[errorCategory] : 'Firebase verification was unavailable';
    return (
      <Alert className="border-amber-500/30 bg-amber-500/5">
        <MessageSquare className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Code sent via SMS fallback</AlertTitle>
        <AlertDescription className="text-xs">
          {reason}. We delivered your code over SMS instead of Firebase. {hint || 'You can continue normally.'}
        </AlertDescription>
      </Alert>
    );
  }

  if (autoResendCount > 0) {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>Security check refreshed</AlertTitle>
        <AlertDescription className="text-xs">
          The reCAPTCHA token expired before submit. We automatically requested a new code (attempt {autoResendCount + 1}).
        </AlertDescription>
      </Alert>
    );
  }

  if (errorCategory) {
    return (
      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>{REASON_BY_CATEGORY[errorCategory]}</AlertTitle>
        {hint && <AlertDescription className="text-xs">{hint}</AlertDescription>}
      </Alert>
    );
  }
  return null;
}
