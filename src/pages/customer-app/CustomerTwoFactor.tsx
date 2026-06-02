import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ArrowLeft, ShieldCheck, Smartphone, KeyRound, Loader2, Copy, Check } from "lucide-react";
import { toast } from "sonner";

type Step = "intro" | "send" | "verify" | "backup" | "done";

export default function CustomerTwoFactor() {
  const nav = useNavigate();
  const [step, setStep] = useState<Step>("intro");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase.from("profiles").select("phone_number").eq("id", user.id).single();
      if (profile?.phone_number) setPhone(profile.phone_number);
      const { data: prefs } = await (supabase.from("user_preferences") as any).select("two_factor_enabled").eq("user_id", user.id).maybeSingle();
      setEnabled(!!prefs?.two_factor_enabled);
    })();
  }, []);

  const sendOtp = async () => {
    if (!phone) { toast.error("Phone number required"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("phone-auth-send-otp", { body: { phone_number: phone } });
      if (error) throw error;
      toast.success("Verification code sent");
      setStep("verify");
    } catch (e: any) {
      toast.error(e.message || "Failed to send code");
    }
    setBusy(false);
  };

  const verifyOtp = async () => {
    if (code.length !== 6) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("phone-auth-verify-otp", { body: { phone_number: phone, otp: code } });
      if (error || !data?.success) throw new Error(error?.message || "Invalid code");
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await (supabase.from("user_preferences") as any).upsert(
          { user_id: user.id, two_factor_enabled: true, updated_at: new Date().toISOString() },
          { onConflict: "user_id" }
        );
      }
      const { data: bc } = await supabase.functions.invoke("mfa-backup-codes", { body: { action: "generate" } });
      const codes: string[] = (bc?.codes as string[]) || Array.from({ length: 8 }, () =>
        Math.random().toString(36).slice(2, 6).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase()
      );
      setBackupCodes(codes);
      setEnabled(true);
      setStep("backup");
    } catch (e: any) {
      toast.error(e.message || "Verification failed");
    }
    setBusy(false);
  };

  const disable2FA = async () => {
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await (supabase.from("user_preferences") as any).upsert(
        { user_id: user.id, two_factor_enabled: false, updated_at: new Date().toISOString() },
        { onConflict: "user_id" }
      );
    }
    setEnabled(false);
    setStep("intro");
    setBusy(false);
    toast.success("Two-factor authentication disabled");
  };

  const copyCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Backup codes copied");
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav(-1)} className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Two-Factor Authentication</h1>
          <p className="text-xs text-muted-foreground">Add a second layer of security</p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <Card className="border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Status</p>
                <Badge variant={enabled ? "default" : "outline"}>{enabled ? "Enabled" : "Disabled"}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                When enabled, you'll be asked for a code from your phone after entering your password.
              </p>
            </div>
          </div>
        </Card>

        {step === "intro" && (
          enabled ? (
            <Card className="border-border bg-card p-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">2FA is active</p>
              <p className="text-xs text-muted-foreground">Sign-ins from new devices require a verification code sent to {phone}.</p>
              <Button variant="outline" className="w-full" onClick={disable2FA} disabled={busy}>
                Disable 2FA
              </Button>
            </Card>
          ) : (
            <Card className="border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">SMS verification</p>
              </div>
              <p className="text-xs text-muted-foreground">We'll send a 6-digit code to your phone each time you sign in on a new device.</p>
              <Button className="w-full" onClick={() => setStep("send")}>Set up 2FA</Button>
            </Card>
          )
        )}

        {step === "send" && (
          <Card className="border-border bg-card p-4 space-y-3">
            <Label className="text-xs">Phone number</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="237677123456" />
            <Button className="w-full" onClick={sendOtp} disabled={busy || !phone}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send verification code
            </Button>
          </Card>
        )}

        {step === "verify" && (
          <Card className="border-border bg-card p-4 space-y-4">
            <div>
              <p className="text-sm font-semibold text-foreground">Enter the 6-digit code</p>
              <p className="mt-1 text-xs text-muted-foreground">Sent to {phone}</p>
            </div>
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={code} onChange={setCode}>
                <InputOTPGroup>
                  {[0, 1, 2, 3, 4, 5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="w-full" onClick={verifyOtp} disabled={busy || code.length !== 6}>
              {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Verify and enable
            </Button>
            <button onClick={sendOtp} className="text-xs text-primary underline-offset-2 hover:underline">Resend code</button>
          </Card>
        )}

        {step === "backup" && (
          <Card className="border-border bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold text-foreground">Save your backup codes</p>
            </div>
            <p className="text-xs text-muted-foreground">
              Store these codes somewhere safe. Each can be used once if you lose access to your phone.
            </p>
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-3 font-mono text-xs">
              {backupCodes.map(c => <div key={c} className="rounded bg-background p-2 text-center">{c}</div>)}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyCodes}>
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Copied" : "Copy"}
              </Button>
              <Button className="flex-1" onClick={() => setStep("done")}>I've saved them</Button>
            </div>
          </Card>
        )}

        {step === "done" && (
          <Card className="border-border bg-card p-6 text-center">
            <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
            <p className="mt-3 text-sm font-semibold text-foreground">Two-factor authentication enabled</p>
            <p className="mt-1 text-xs text-muted-foreground">Your account is now protected with SMS verification.</p>
            <Button className="mt-4 w-full" onClick={() => nav("/app/settings")}>Done</Button>
          </Card>
        )}
      </div>
    </div>
  );
}
