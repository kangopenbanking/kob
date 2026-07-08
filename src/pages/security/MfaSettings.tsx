/**
 * MFA Settings — TOTP enrolment, verification, and management.
 *
 * Uses Supabase Auth's built-in MFA APIs (mfa.enroll / challenge / verify /
 * unenroll / listFactors). Supports multiple named TOTP factors and links
 * out to backup codes for account recovery.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, ShieldCheck, ShieldPlus, Trash2, Copy, KeyRound, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Factor {
  id: string;
  friendly_name?: string | null;
  factor_type: string;
  status: "verified" | "unverified" | string;
  created_at?: string;
}

interface EnrollState {
  factorId: string;
  challengeId: string | null;
  qrSvg: string;
  secret: string;
  uri: string;
  friendlyName: string;
}

export default function MfaSettings() {
  const [factors, setFactors] = useState<Factor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollBusy, setEnrollBusy] = useState(false);
  const [enroll, setEnroll] = useState<EnrollState | null>(null);
  const [friendlyName, setFriendlyName] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [removeTarget, setRemoveTarget] = useState<Factor | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadFactors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const totp = ((data?.totp ?? []) as Factor[]) || [];
      const all = ((data?.all ?? []) as Factor[]) || [];
      // Prefer 'all' when available so unverified factors also show up
      setFactors(all.length ? all : totp);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load MFA factors");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFactors();
  }, [loadFactors]);

  const startEnroll = async () => {
    setEnrollBusy(true);
    setVerifyError(null);
    setCode("");
    try {
      const name = friendlyName.trim() || `Authenticator ${new Date().toLocaleDateString()}`;
      // Clean up any stale unverified factor with the same name first
      const stale = factors.find((f) => f.status !== "verified" && f.friendly_name === name);
      if (stale) {
        await supabase.auth.mfa.unenroll({ factorId: stale.id });
      }
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: name,
      });
      if (error) throw error;
      const ch = await supabase.auth.mfa.challenge({ factorId: data.id });
      if (ch.error) throw ch.error;
      setEnroll({
        factorId: data.id,
        challengeId: ch.data.id,
        qrSvg: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
        friendlyName: name,
      });
      setEnrollOpen(true);
    } catch (e: any) {
      toast.error(e?.message ?? "Could not start enrolment");
    } finally {
      setEnrollBusy(false);
    }
  };

  const completeEnroll = async () => {
    if (!enroll || code.length < 6) return;
    setEnrollBusy(true);
    setVerifyError(null);
    try {
      const { error } = await supabase.auth.mfa.verify({
        factorId: enroll.factorId,
        challengeId: enroll.challengeId!,
        code,
      });
      if (error) throw error;
      toast.success("Authenticator enrolled successfully");
      setEnrollOpen(false);
      setEnroll(null);
      setFriendlyName("");
      setCode("");
      await loadFactors();
    } catch (e: any) {
      setVerifyError(e?.message ?? "Invalid code. Please try again.");
      setCode("");
    } finally {
      setEnrollBusy(false);
    }
  };

  const cancelEnroll = async () => {
    if (enroll?.factorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: enroll.factorId }); } catch { /* noop */ }
    }
    setEnrollOpen(false);
    setEnroll(null);
    setCode("");
    setVerifyError(null);
    await loadFactors();
  };

  const doRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: removeTarget.id });
      if (error) throw error;
      toast.success(`Removed ${removeTarget.friendly_name || "factor"}`);
      setRemoveTarget(null);
      await loadFactors();
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to remove factor");
    } finally {
      setRemoving(false);
    }
  };

  const verifiedCount = factors.filter((f) => f.status === "verified").length;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Multi-factor authentication</h1>
        <p className="text-sm text-muted-foreground">
          Protect your account with a second factor. Required for sensitive administrative actions such as KYC approval,
          key rotation, and settlement configuration.
        </p>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not load MFA settings</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Authenticator apps (TOTP)
          </CardTitle>
          <CardDescription>
            Use an app like 1Password, Google Authenticator, Authy, or Microsoft Authenticator to generate 6-digit codes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading factors…
            </div>
          ) : factors.length === 0 ? (
            <Alert>
              <AlertTitle>No authenticator enrolled</AlertTitle>
              <AlertDescription>
                Enrol an authenticator below to satisfy step-up MFA challenges required by admin workflows.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="divide-y rounded-md border">
              {factors.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{f.friendly_name || "Authenticator"}</span>
                      <Badge variant={f.status === "verified" ? "default" : "secondary"}>{f.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {f.factor_type.toUpperCase()} · added {f.created_at ? new Date(f.created_at).toLocaleDateString() : "recently"}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRemoveTarget(f)}
                    aria-label={`Remove ${f.friendly_name ?? "factor"}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <Label htmlFor="friendlyName">Device label (optional)</Label>
              <Input
                id="friendlyName"
                placeholder="e.g. Work laptop"
                value={friendlyName}
                onChange={(e) => setFriendlyName(e.target.value)}
                maxLength={64}
              />
            </div>
            <Button onClick={startEnroll} disabled={enrollBusy}>
              {enrollBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldPlus className="mr-2 h-4 w-4" />}
              Add authenticator
            </Button>
            <Button variant="outline" onClick={loadFactors} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            Backup codes
          </CardTitle>
          <CardDescription>
            One-time recovery codes for use when you cannot access your authenticator.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" disabled={verifiedCount === 0}>
            <Link to="/security/backup-codes">Manage backup codes</Link>
          </Button>
          {verifiedCount === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Enrol at least one authenticator before generating backup codes.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Enrolment dialog */}
      <Dialog
        open={enrollOpen}
        onOpenChange={(o) => {
          if (!o && !enrollBusy) cancelEnroll();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Scan the QR code</DialogTitle>
            <DialogDescription>
              Open your authenticator app and scan the code, then enter the 6-digit code shown by the app.
            </DialogDescription>
          </DialogHeader>
          {enroll && (
            <div className="space-y-4">
              <div className="flex justify-center rounded-md border bg-white p-4">
                <div
                  aria-label="TOTP QR code"
                  // Supabase returns an inline SVG string for the QR code.
                  dangerouslySetInnerHTML={{ __html: enroll.qrSvg }}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  Or enter this secret manually
                </Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 truncate rounded bg-muted px-2 py-1 font-mono text-xs">{enroll.secret}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      await navigator.clipboard.writeText(enroll.secret);
                      toast.success("Secret copied");
                    }}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Verification code</Label>
                <div className="flex justify-center" data-testid="mfa-enroll-otp">
                  <InputOTP maxLength={6} value={code} onChange={setCode}>
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {verifyError && <p className="text-center text-sm text-destructive">{verifyError}</p>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelEnroll} disabled={enrollBusy}>
              Cancel
            </Button>
            <Button onClick={completeEnroll} disabled={enrollBusy || code.length < 6}>
              {enrollBusy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify &amp; enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove confirmation */}
      <AlertDialog open={!!removeTarget} onOpenChange={(o) => !o && !removing && setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this authenticator?</AlertDialogTitle>
            <AlertDialogDescription>
              You will no longer be able to satisfy MFA challenges with{" "}
              <span className="font-medium">{removeTarget?.friendly_name || "this factor"}</span>. If it is your only
              factor, admin step-up actions will require enrolling a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removing}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={doRemove} disabled={removing}>
              {removing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
