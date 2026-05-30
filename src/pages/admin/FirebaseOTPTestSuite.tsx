/**
 * FirebaseOTPTestSuite — Admin E2E harness for Firebase Phone Auth.
 *
 * Scenarios covered:
 *  1. Happy path     → valid OTP → session created → redirect target shown
 *  2. Wrong code     → confirm.confirm() rejects with auth/invalid-verification-code
 *  3. Expired code   → confirm.confirm() rejects with auth/code-expired
 *  4. Rate limit     → repeated sendOTP() to surface auth/too-many-requests
 *
 * Test phone numbers must be pre-registered in Firebase Console:
 *   Authentication → Sign-in method → Phone → Phone numbers for testing
 *
 * Every attempt is persisted to `firebase_otp_test_log` for audit history.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useFirebasePhoneAuth } from "@/hooks/useFirebasePhoneAuth";
import { useOTPTimers, formatMMSS } from "@/hooks/useOTPTimers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ShieldCheck, PhoneCall, KeyRound, Timer, AlertCircle,
  CheckCircle2, RefreshCw, BookOpen, ListChecks, Loader2, Send,
} from "lucide-react";

/** Human-friendly mapping for the common failure categories. */
const FRIENDLY_ERROR: Record<string, { title: string; hint: string }> = {
  "invalid-phone":        { title: "Invalid phone number",   hint: "Use full international format, e.g. +16505551234." },
  "too-many-requests":    { title: "Too many attempts",      hint: "Wait a few minutes before requesting another code." },
  "unauthorized-domain":  { title: "Domain not authorized",  hint: "Add this host to Firebase Authorized domains." },
  "recaptcha-disabled":   { title: "Security check failed",  hint: "reCAPTCHA could not load. Reload the page and retry." },
  "billing-required":     { title: "Provider unavailable",   hint: "Firebase phone billing is not enabled for this project." },
  "network":              { title: "Network error",          hint: "Check your connection and try again." },
  "provider-disabled":    { title: "Phone sign-in disabled", hint: "Enable Phone provider in Firebase Console." },
  "invalid-code":         { title: "Wrong verification code", hint: "Double-check the digits and try again." },
  "expired-code":         { title: "Code expired",           hint: "Request a new code — codes are valid for 5 minutes." },
  "unknown":              { title: "Verification failed",    hint: "Please try again or request a new code." },
};

type Scenario = "happy_path" | "wrong_code" | "expired_code" | "rate_limit";

const SCENARIOS: Array<{ id: Scenario; label: string; icon: React.ElementType; description: string }> = [
  { id: "happy_path",   label: "Happy path",          icon: CheckCircle2, description: "Send a real OTP, enter the valid code, expect a Supabase session." },
  { id: "wrong_code",   label: "Wrong code",          icon: AlertCircle,  description: "Send an OTP then submit an obviously invalid code (000000)." },
  { id: "expired_code", label: "Expired code",        icon: Timer,        description: "Send an OTP, wait until it expires (Firebase: ~3-5 min), then submit." },
  { id: "rate_limit",   label: "Rate limit",          icon: RefreshCw,    description: "Trigger repeated sends from the same number to surface auth/too-many-requests." },
];

interface LogRow {
  id: string;
  scenario: string;
  phone_number: string;
  step: string;
  status: string;
  provider: string | null;
  error_code: string | null;
  error_message: string | null;
  elapsed_ms: number | null;
  created_at: string;
}

const REDIRECT_TARGET = "/app/home";

export default function FirebaseOTPTestSuite() {
  const [scenario, setScenario] = useState<Scenario>("happy_path");
  const [phone, setPhone] = useState("+16505551234");
  const [code, setCode] = useState("");
  const [rateBurstCount, setRateBurstCount] = useState(0);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  

  const auth = useFirebasePhoneAuth({ otpType: "login" });
  const timers = useOTPTimers({ expirySeconds: 300, resendCooldownSeconds: 60 });

  const isHappyPath = scenario === "happy_path";
  const friendly = auth.errorCategory ? FRIENDLY_ERROR[auth.errorCategory] : null;

  const insertLog = async (row: {
    step: string;
    status: "ok" | "fail" | "pending";
    error_code?: string | null;
    error_message?: string | null;
    elapsed_ms?: number | null;
    metadata?: Record<string, unknown>;
  }) => {
    try {
      const { data: u } = await supabase.auth.getUser();
      await supabase.from("firebase_otp_test_log" as any).insert({
        tester_id: u.user?.id ?? null,
        scenario,
        phone_number: phone,
        provider: auth.provider,
        ...row,
        metadata: row.metadata ?? {},
      });
      void refreshLogs();
    } catch (err) {
      console.warn("[otp-test] failed to write log", err);
    }
  };

  const refreshLogs = async () => {
    setLoadingLogs(true);
    try {
      const { data, error } = await (supabase as any)
        .from("firebase_otp_test_log")
        .select("id,scenario,phone_number,step,status,provider,error_code,error_message,elapsed_ms,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      setLogs((data || []) as LogRow[]);
    } catch (err: any) {
      console.warn(err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => { void refreshLogs(); }, []);

  const handleSend = async (isResend = false) => {
    if (!phone.trim().startsWith("+")) {
      toast.error("Phone must be E.164 (e.g. +16505551234).");
      return;
    }
    if (isResend && !timers.canResend) {
      toast.error(`Please wait ${timers.remainingResend}s before requesting a new code.`);
      return;
    }
    const t0 = Date.now();
    void insertLog({ step: isResend ? "resend_attempt" : "send_attempt", status: "pending" });
    await auth.sendOTP(phone.trim());
    const elapsed = Date.now() - t0;
    if (auth.error) {
      void insertLog({
        step: isResend ? "resend_otp" : "send_otp",
        status: "fail",
        error_code: auth.errorCategory,
        error_message: auth.error,
        elapsed_ms: elapsed,
      });
    } else {
      timers.start();
      void insertLog({
        step: isResend ? "resend_otp" : "send_otp",
        status: "ok",
        elapsed_ms: elapsed,
        metadata: { expiry_seconds: 300, cooldown_seconds: 60 },
      });
    }
  };

  const handleVerify = async () => {
    const submit = scenario === "wrong_code" ? "000000" : code;
    if (!submit || submit.length < 6) {
      toast.error("Enter the 6-digit verification code.");
      return;
    }
    const t0 = Date.now();
    const ok = await auth.verifyOTP(submit);
    const elapsed = Date.now() - t0;
    if (ok) {
      void insertLog({
        step: "verify_otp",
        status: "ok",
        elapsed_ms: elapsed,
        metadata: { redirect_target: REDIRECT_TARGET },
      });
      toast.success(`Session created. Redirect target: ${REDIRECT_TARGET}`);
    } else {
      void insertLog({
        step: "verify_otp",
        status: "fail",
        error_code: auth.errorCategory,
        error_message: auth.error,
        elapsed_ms: elapsed,
      });
    }
  };

  const handleRateLimitBurst = async () => {
    setRateBurstCount(0);
    for (let i = 0; i < 6; i++) {
      setRateBurstCount(i + 1);
      await auth.sendOTP(phone.trim());
      if (auth.errorCategory === "too-many-requests" || /too-many-requests/i.test(auth.error || "")) {
        void insertLog({
          step: "rate_limit_hit",
          status: "ok",
          error_code: auth.errorCategory,
          error_message: auth.error,
          metadata: { attempts: i + 1 },
        });
        toast.success(`Rate limit surfaced after ${i + 1} attempts.`);
        return;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    void insertLog({
      step: "rate_limit_burst",
      status: "fail",
      error_message: "No rate-limit response after 6 attempts",
      metadata: { attempts: 6 },
    });
    toast.message("Burst complete — no rate-limit response seen.");
  };

  const statusBadge = (status: string) => {
    if (status === "ok") return <Badge variant="outline" className="border-emerald-500/40 text-emerald-700">ok</Badge>;
    if (status === "fail") return <Badge variant="outline" className="border-destructive/40 text-destructive">fail</Badge>;
    return <Badge variant="outline">{status}</Badge>;
  };

  const activeScenario = useMemo(() => SCENARIOS.find((s) => s.id === scenario)!, [scenario]);

  return (
    <div className="container max-w-6xl space-y-6 py-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Firebase OTP Test Suite</h1>
          <p className="text-sm text-muted-foreground">
            End-to-end verification of phone authentication, including happy path and edge cases.
          </p>
        </div>
        <Badge variant="outline" className="gap-2"><ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.5} />Admin only</Badge>
      </div>

      <Tabs defaultValue="runner" className="space-y-4">
        <TabsList>
          <TabsTrigger value="runner"><ListChecks className="mr-2 h-4 w-4" strokeWidth={1.5} />Runner</TabsTrigger>
          <TabsTrigger value="setup"><BookOpen className="mr-2 h-4 w-4" strokeWidth={1.5} />Setup guide</TabsTrigger>
          <TabsTrigger value="history"><Timer className="mr-2 h-4 w-4" strokeWidth={1.5} />History</TabsTrigger>
        </TabsList>

        <TabsContent value="runner" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">1. Pick a scenario</CardTitle>
              <CardDescription>Each scenario logs its outcome for later audit.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2">
              {SCENARIOS.map((s) => {
                const Icon = s.icon;
                const active = scenario === s.id;
                return (
                  <button
                    key={s.id}
                    onClick={() => setScenario(s.id)}
                    className={`rounded-lg border p-4 text-left transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/40"}`}
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" strokeWidth={1.5} />
                      <span className="font-medium">{s.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>
                  </button>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">2. Run "{activeScenario.label}"</CardTitle>
              <CardDescription>
                Use a phone number that is registered as a test number in Firebase Console
                (Authentication → Sign-in method → Phone → Phone numbers for testing).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number (E.164)</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+16505551234" />
                </div>
                <div className="flex items-end">
                  {scenario === "rate_limit" ? (
                    <Button onClick={handleRateLimitBurst} disabled={auth.loading} className="gap-2">
                      {auth.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" strokeWidth={1.5} />}
                      Burst send ({rateBurstCount}/6)
                    </Button>
                  ) : (
                    <Button onClick={() => handleSend(false)} disabled={auth.loading} className="gap-2">
                      {auth.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneCall className="h-4 w-4" strokeWidth={1.5} />}
                      Send OTP
                    </Button>
                  )}
                </div>
              </div>

              {auth.step !== "phone" && scenario !== "rate_limit" && (
                <>
                  <Separator />
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-2">
                      <Label htmlFor="code">Verification code</Label>
                      <Input
                        id="code"
                        inputMode="numeric"
                        maxLength={6}
                        value={scenario === "wrong_code" ? "000000" : code}
                        disabled={scenario === "wrong_code"}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                        placeholder="123456"
                      />
                      {scenario === "wrong_code" && (
                        <p className="text-xs text-muted-foreground">Wrong-code scenario submits 000000 automatically.</p>
                      )}
                      {scenario === "expired_code" && (
                        <p className="text-xs text-muted-foreground">Wait ~5 minutes after Send OTP, then submit the original code.</p>
                      )}

                      {/* Live countdown + resend cooldown */}
                      {timers.expiresAt != null && (
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                          <span className={`inline-flex items-center gap-1 ${timers.isExpired ? "text-destructive" : "text-muted-foreground"}`}>
                            <Timer className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {timers.isExpired ? "Code expired" : `Expires in ${formatMMSS(timers.remainingExpiry)}`}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleSend(true)}
                            disabled={!timers.canResend || auth.loading}
                            className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
                          >
                            <Send className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {timers.canResend ? "Resend code" : `Resend available in ${timers.remainingResend}s`}
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="flex items-end">
                      <Button onClick={handleVerify} disabled={auth.loading || timers.isExpired} className="gap-2">
                        {auth.loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" strokeWidth={1.5} />}
                        Verify
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {auth.error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" strokeWidth={1.5} />
                  <AlertTitle className="text-sm">{friendly?.title || auth.errorCategory || "Error"}</AlertTitle>
                  <AlertDescription className="text-xs">
                    {friendly?.hint || auth.error}
                    {auth.errorHint && !friendly ? ` — ${auth.errorHint}` : ""}
                  </AlertDescription>
                </Alert>
              )}

              {isHappyPath && auth.step === "phone" && (
                <p className="text-xs text-muted-foreground">
                  On success, the suite will create a Supabase session and report the
                  configured redirect target: <code className="rounded bg-muted px-1">{REDIRECT_TARGET}</code>
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => { auth.reset(); setCode(""); timers.reset(); }}>Reset</Button>
              </div>
            </CardContent>
          </Card>

          {/* reCAPTCHA v2 invisible container required by Firebase */}
          <div id="recaptcha-container" />
        </TabsContent>

        <TabsContent value="setup">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Configure test phone numbers in Firebase</CardTitle>
              <CardDescription>One-time setup so SMS is never actually sent in dev/preview.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Open Firebase Console → <span className="font-medium">Authentication</span> → <span className="font-medium">Sign-in method</span>.</li>
                <li>Open <span className="font-medium">Phone</span> and expand <span className="font-medium">Phone numbers for testing</span>.</li>
                <li>Add at least one pair (number must be E.164):</li>
              </ol>
              <div className="rounded-md border bg-muted/30 p-3 font-mono text-xs">
                <div>+1 650 555 1234   →   123456</div>
                <div>+44 7700 900 123  →   654321</div>
                <div>+237 6 77 00 00 00 →  111222</div>
              </div>
              <p className="text-muted-foreground">
                Firebase short-circuits reCAPTCHA and SMS for these numbers and accepts only
                the paired code. Production phone numbers continue to use the live SMS path.
              </p>
              <Separator />
              <p>
                The runtime origin must also appear in <span className="font-medium">Authentication → Settings → Authorized domains</span>.
                The Identity Toolkit preflight workflow validates this automatically on PRs.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Recent test runs</CardTitle>
                <CardDescription>Last 50 attempts across all admins.</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={refreshLogs} disabled={loadingLogs} className="gap-2">
                <RefreshCw className={`h-3.5 w-3.5 ${loadingLogs ? "animate-spin" : ""}`} strokeWidth={1.5} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Scenario</TableHead>
                      <TableHead>Step</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Provider</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Latency</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.length === 0 ? (
                      <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground">No runs yet.</TableCell></TableRow>
                    ) : logs.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="whitespace-nowrap text-xs">{new Date(l.created_at).toLocaleString()}</TableCell>
                        <TableCell className="text-xs">{l.scenario}</TableCell>
                        <TableCell className="text-xs">{l.step}</TableCell>
                        <TableCell>{statusBadge(l.status)}</TableCell>
                        <TableCell className="text-xs">{l.provider || "—"}</TableCell>
                        <TableCell className="font-mono text-xs">{l.phone_number}</TableCell>
                        <TableCell className="text-xs">{l.elapsed_ms != null ? `${l.elapsed_ms}ms` : "—"}</TableCell>
                        <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground" title={l.error_message || ""}>
                          {l.error_code ? <span className="font-mono">{l.error_code}</span> : null}
                          {l.error_code && l.error_message ? " · " : null}
                          {l.error_message || (l.status === "ok" ? "success" : "")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
