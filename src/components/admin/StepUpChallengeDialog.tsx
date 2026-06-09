/**
 * Step-up MFA challenge dialog.
 *
 * Opens when an admin action returns STEP_UP_REQUIRED. Walks the reviewer
 * through a TOTP challenge using their enrolled MFA factor, then calls
 * `onResolved()` so the caller can retry the original mutation. If the
 * reviewer has no MFA factors, surfaces a link to /security/mfa instead.
 */
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ShieldAlert, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { StepUpDialogProps } from "@/lib/step-up-client";

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: string;
}

export function StepUpChallengeDialog({ open, detection, onResolved, onCancelled }: StepUpDialogProps) {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setCode("");
      setChallengeId(null);
      setFactorId(null);
      setVerifyError(null);
      setLoadError(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setBusy(true);
      try {
        const { data, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        if (cancelled) return;
        const verified: Factor[] = ((data?.totp ?? []) as Factor[]).filter((f) => f.status === "verified");
        setFactors(verified);
        if (verified[0]) {
          setFactorId(verified[0].id);
          const ch = await supabase.auth.mfa.challenge({ factorId: verified[0].id });
          if (ch.error) throw ch.error;
          if (!cancelled) setChallengeId(ch.data.id);
        }
      } catch (e: any) {
        if (!cancelled) setLoadError(e?.message ?? "Failed to start MFA challenge.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const verify = async () => {
    if (!factorId || !challengeId || code.length < 6) return;
    setBusy(true);
    setVerifyError(null);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code });
      if (error) throw error;
      onResolved();
    } catch (e: any) {
      setVerifyError(e?.message ?? "Invalid code. Please try again.");
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const helpMessage = useMemo(
    () => detection?.message ?? "This action requires a fresh MFA challenge (within the last 10 minutes).",
    [detection],
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onCancelled()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-primary" />
            Step-up authentication required
          </DialogTitle>
          <DialogDescription>{helpMessage}</DialogDescription>
        </DialogHeader>

        {loadError && (
          <Alert variant="destructive">
            <AlertTitle>Could not start MFA challenge</AlertTitle>
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        )}

        {!loadError && factors.length === 0 && !busy && (
          <Alert>
            <AlertTitle>No MFA factor enrolled</AlertTitle>
            <AlertDescription>
              Enrol a TOTP authenticator in <a className="underline" href="/security/mfa">/security/mfa</a> and retry this action.
            </AlertDescription>
          </Alert>
        )}

        {factors.length > 0 && challengeId && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app for{" "}
              <span className="font-medium text-foreground">{factors.find((f) => f.id === factorId)?.friendly_name ?? "your TOTP factor"}</span>.
            </p>
            <div className="flex justify-center" data-testid="step-up-otp">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <InputOTPSlot key={i} index={i} />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            {verifyError && <p className="text-sm text-destructive">{verifyError}</p>}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onCancelled} disabled={busy} data-testid="step-up-cancel">
            Cancel
          </Button>
          <Button
            onClick={verify}
            disabled={busy || !challengeId || code.length < 6}
            data-testid="step-up-verify"
          >
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Verify &amp; continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
