import { AlertCircle, CheckCircle2, HelpCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export interface OTPDiagnostic {
  title: string;
  checks: Array<{ label: string; ok: boolean | null; detail?: string }>;
}

/**
 * Renders user-safe diagnostic info when Firebase phone OTP fails.
 * Categories handled by `buildOTPDiagnostics` in `src/lib/firebaseErrors.ts`.
 */
export function OTPDiagnosticsPanel({ diagnostics }: { diagnostics: OTPDiagnostic | null }) {
  if (!diagnostics) return null;
  return (
    <Alert variant="destructive" className="mt-4">
      <AlertCircle className="h-4 w-4" aria-hidden="true" />
      <AlertTitle>{diagnostics.title}</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 space-y-2 text-sm">
          {diagnostics.checks.map((c, i) => {
            const Icon = c.ok === true ? CheckCircle2 : c.ok === false ? AlertCircle : HelpCircle;
            return (
              <li key={i} className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 shrink-0" aria-hidden="true" />
                <div>
                  <div className="font-medium">{c.label}</div>
                  {c.detail && <div className="text-xs opacity-80 mt-0.5">{c.detail}</div>}
                </div>
              </li>
            );
          })}
        </ul>
      </AlertDescription>
    </Alert>
  );
}
