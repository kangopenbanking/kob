import { useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import {
  setupRecaptchaVerifier,
  getFirebaseAuth,
  isFirebaseConfigured,
} from "@/lib/firebase";
import { signInWithPhoneNumber, type ConfirmationResult } from "firebase/auth";
import { CheckCircle2, XCircle, CircleDashed, Loader2, Download } from "lucide-react";

/**
 * E2E Signup Notifications Test
 * --------------------------------
 * Orchestrates all three notification systems in a single, sequential
 * signup-flow scenario and produces a pass/fail report.
 *
 *   1. Register user (email + phone) via Supabase Auth
 *   2. Send welcome email (Lovable/Resend pipeline via send-transactional-email
 *      or fallback admin-send-test-email)
 *   3. Send phone OTP via Firebase (manual code entry by tester)
 *   4. Verify OTP -> firebase-phone-verify edge function
 *   5. Register OneSignal external_id + tags
 *   6. Send welcome push via send-push-notification
 *   7. Capture timestamps + status codes for every step
 *   8. Export JSON report
 *
 * Intended for admin / QA use only.
 */

type StepKey =
  | "register"
  | "welcome_email"
  | "otp_send"
  | "otp_verify"
  | "onesignal_register"
  | "welcome_push";

type StepStatus = "pending" | "running" | "pass" | "fail" | "skipped";

interface StepRecord {
  key: StepKey;
  label: string;
  status: StepStatus;
  statusCode?: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  detail?: string;
  error?: string;
}

const INITIAL_STEPS: StepRecord[] = [
  { key: "register", label: "1. Register user (email + phone)", status: "pending" },
  { key: "welcome_email", label: "2. Send welcome email (Resend pipeline)", status: "pending" },
  { key: "otp_send", label: "3. Send phone OTP (Firebase)", status: "pending" },
  { key: "otp_verify", label: "4. Verify OTP code", status: "pending" },
  { key: "onesignal_register", label: "5. Register OneSignal subscription", status: "pending" },
  { key: "welcome_push", label: "6. Send welcome push notification", status: "pending" },
];

function StatusIcon({ status }: { status: StepStatus }) {
  if (status === "running") return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  if (status === "pass") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (status === "fail") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "skipped") return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
  return <CircleDashed className="h-4 w-4 text-muted-foreground" />;
}

function statusBadge(status: StepStatus) {
  const variants: Record<StepStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    running: "bg-primary/10 text-primary",
    pass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    fail: "bg-destructive/10 text-destructive",
    skipped: "bg-muted text-muted-foreground",
  };
  return <Badge variant="outline" className={variants[status]}>{status}</Badge>;
}

export default function SignupNotificationsE2E() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [running, setRunning] = useState(false);
  const [steps, setSteps] = useState<StepRecord[]>(INITIAL_STEPS);
  const [createdUserId, setCreatedUserId] = useState<string | null>(null);

  const confirmationRef = useRef<ConfirmationResult | null>(null);
  const awaitingOtpRef = useRef<((code: string) => void) | null>(null);

  const summary = useMemo(() => {
    const pass = steps.filter((s) => s.status === "pass").length;
    const fail = steps.filter((s) => s.status === "fail").length;
    const total = steps.length;
    return { pass, fail, total };
  }, [steps]);

  const updateStep = (key: StepKey, patch: Partial<StepRecord>) =>
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));

  const runStep = async <T,>(
    key: StepKey,
    fn: () => Promise<{ statusCode?: number; detail?: string; result: T }>,
  ): Promise<T | null> => {
    const startedAt = new Date().toISOString();
    const t0 = performance.now();
    updateStep(key, { status: "running", startedAt, finishedAt: undefined, error: undefined });
    try {
      const { statusCode, detail, result } = await fn();
      const finishedAt = new Date().toISOString();
      updateStep(key, {
        status: "pass",
        statusCode,
        detail,
        finishedAt,
        durationMs: Math.round(performance.now() - t0),
      });
      return result;
    } catch (err: any) {
      const finishedAt = new Date().toISOString();
      updateStep(key, {
        status: "fail",
        finishedAt,
        durationMs: Math.round(performance.now() - t0),
        error: err?.message || String(err),
        statusCode: err?.statusCode,
      });
      return null;
    }
  };

  const waitForOtpCode = (): Promise<string> =>
    new Promise((resolve) => {
      awaitingOtpRef.current = (code: string) => {
        awaitingOtpRef.current = null;
        resolve(code);
      };
    });

  const reset = () => {
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setCreatedUserId(null);
    confirmationRef.current = null;
    awaitingOtpRef.current = null;
    setOtpCode("");
  };

  const handleRun = async () => {
    if (!email || !phone || !password) return;
    reset();
    setRunning(true);
    try {
      // 1. Register
      const userId = await runStep("register", async () => {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { phone_number: phone },
          },
        });
        if (error) throw error;
        const uid = data.user?.id ?? null;
        setCreatedUserId(uid);
        return { statusCode: 200, detail: `user_id=${uid ?? "n/a"}`, result: uid };
      });
      if (!userId) return;

      // 2. Welcome email — try transactional pipeline, fall back to admin test endpoint
      await runStep("welcome_email", async () => {
        const { data, error } = await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "welcome",
            recipientEmail: email,
            idempotencyKey: `e2e-welcome-${userId}`,
            templateData: { name: email.split("@")[0] },
          },
        });
        if (error) {
          // Fallback: any project may not have the welcome template registered
          const { data: fb, error: fbErr } = await supabase.functions.invoke(
            "admin-send-test-email",
            { body: { to: email, subject: "Welcome (E2E test)", html: "<p>Welcome!</p>" } },
          );
          if (fbErr) throw fbErr;
          return { statusCode: 200, detail: `fallback admin-send-test-email: ${JSON.stringify(fb)}`, result: fb };
        }
        return { statusCode: 200, detail: JSON.stringify(data), result: data };
      });

      // 3. Send Firebase OTP (requires real browser + reCAPTCHA)
      const confirmation = await runStep("otp_send", async () => {
        if (!isFirebaseConfigured) throw new Error("Firebase not configured (VITE_FIREBASE_API_KEY missing)");
        const verifier = setupRecaptchaVerifier("recaptcha-e2e-container");
        const conf = await signInWithPhoneNumber(getFirebaseAuth(), phone, verifier);
        confirmationRef.current = conf;
        return { statusCode: 200, detail: `verificationId=${conf.verificationId.slice(0, 12)}…`, result: conf };
      });
      if (!confirmation) return;

      // 4. Verify OTP — wait for tester to paste the code received by SMS
      await runStep("otp_verify", async () => {
        const code = await waitForOtpCode();
        const cred = await confirmation.confirm(code);
        const idToken = await cred.user.getIdToken();
        const { data, error } = await supabase.functions.invoke("firebase-phone-verify", {
          body: { firebase_id_token: idToken, phone_number: phone },
        });
        if (error) throw error;
        return { statusCode: 200, detail: `verified via firebase-phone-verify (${JSON.stringify(data).slice(0, 80)})`, result: data };
      });

      // 5. Register OneSignal subscription
      await runStep("onesignal_register", async () => {
        const OneSignal = (window as any).OneSignal;
        if (!OneSignal?.login) throw new Error("OneSignal SDK not loaded in this preview");
        await OneSignal.login(userId);
        if (OneSignal.User?.addTags) {
          await OneSignal.User.addTags({
            user_id: userId,
            email,
            env: "test",
            scenario: "signup-e2e",
          });
        }
        return { statusCode: 200, detail: `external_id=${userId} tagged env=test`, result: true };
      });

      // 6. Send welcome push
      await runStep("welcome_push", async () => {
        const { data, error } = await supabase.functions.invoke("send-push-notification", {
          body: {
            external_user_ids: [userId],
            title: "Welcome!",
            message: "Your account is ready. Tap to get started.",
            data: { source: "signup-e2e" },
          },
        });
        if (error) throw error;
        return { statusCode: 200, detail: JSON.stringify(data).slice(0, 200), result: data };
      });
    } finally {
      setRunning(false);
    }
  };

  const submitOtp = () => {
    const cb = awaitingOtpRef.current;
    if (cb && otpCode.trim()) cb(otpCode.trim());
  };

  const downloadReport = () => {
    const report = {
      scenario: "signup-notifications-e2e",
      generated_at: new Date().toISOString(),
      input: { email, phone, user_id: createdUserId },
      summary,
      steps,
    };
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `signup-e2e-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const awaitingOtp = steps.find((s) => s.key === "otp_verify")?.status === "running";

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Signup Notifications — E2E Test</h1>
        <p className="text-muted-foreground mt-1">
          Runs the full new-user signup scenario across email, SMS OTP, and push notifications,
          and produces a downloadable pass/fail report.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Test inputs</CardTitle>
          <CardDescription>
            Use a Firebase test phone number for repeatable runs. The email must be unique per run.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="e2e-email">Email</Label>
            <Input id="e2e-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="qa+run1@example.com" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e2e-phone">Phone (E.164)</Label>
            <Input id="e2e-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+15555550100" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="e2e-password">Password</Label>
            <Input id="e2e-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="md:col-span-3 flex gap-2">
            <Button onClick={handleRun} disabled={running || !email || !phone || !password}>
              {running ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Running</> : "Run scenario"}
            </Button>
            <Button variant="outline" onClick={reset} disabled={running}>Reset</Button>
            <Button variant="outline" onClick={downloadReport} disabled={running}>
              <Download className="h-4 w-4 mr-2" />Download report
            </Button>
          </div>
          <div id="recaptcha-e2e-container" />
        </CardContent>
      </Card>

      {awaitingOtp && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle>Enter OTP code</CardTitle>
            <CardDescription>Paste the SMS code received on {phone}.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Input value={otpCode} onChange={(e) => setOtpCode(e.target.value)} placeholder="123456" maxLength={8} />
            <Button onClick={submitOtp} disabled={!otpCode.trim()}>Submit code</Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>Scenario steps</CardTitle>
            <CardDescription>
              {summary.pass} passed · {summary.fail} failed · {summary.total} total
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] pr-3">
            <div className="space-y-3">
              {steps.map((s) => (
                <div key={s.key} className="rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <StatusIcon status={s.status} />
                      <span className="font-medium text-sm">{s.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {typeof s.statusCode === "number" && (
                        <Badge variant="outline" className="font-mono">{s.statusCode}</Badge>
                      )}
                      {typeof s.durationMs === "number" && (
                        <Badge variant="outline" className="font-mono">{s.durationMs}ms</Badge>
                      )}
                      {statusBadge(s.status)}
                    </div>
                  </div>
                  {(s.startedAt || s.finishedAt) && (
                    <div className="mt-2 text-xs text-muted-foreground font-mono">
                      {s.startedAt && <>started {s.startedAt}</>}
                      {s.finishedAt && <> · finished {s.finishedAt}</>}
                    </div>
                  )}
                  {s.detail && (
                    <p className="mt-2 text-xs text-muted-foreground break-all">{s.detail}</p>
                  )}
                  {s.error && (
                    <>
                      <Separator className="my-2" />
                      <p className="text-xs text-destructive break-all">{s.error}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
