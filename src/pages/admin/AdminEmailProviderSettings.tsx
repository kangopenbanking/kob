import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Loader2, Save, Send, ShieldCheck } from "lucide-react";

type Settings = {
  id: number;
  primary_provider: "resend" | "lovable_email";
  fallback_provider: "resend" | "lovable_email" | "none";
  environment: "sandbox" | "production";
  sandbox_from_email: string;
  sandbox_from_name: string;
  production_from_email: string;
  production_from_name: string;
  reply_to_email: string | null;
  resend_api_key_label: string;
  resend_enabled: boolean;
  fallback_enabled: boolean;
  weekly_digest_enabled: boolean;
  monthly_statement_enabled: boolean;
  notes: string | null;
  updated_at: string;
};

export default function AdminEmailProviderSettings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("email_provider_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle();
    if (error) {
      toast({ title: "Failed to load settings", description: error.message, variant: "destructive" });
    } else {
      setSettings(data as Settings);
    }
    setLoading(false);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    const { id: _id, updated_at: _u, ...payload } = settings;
    const { error } = await supabase
      .from("email_provider_settings")
      .update(payload)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Settings saved", description: "Email provider configuration updated." });
    load();
  }

  async function sendTest() {
    if (!testEmail) return;
    setSendingTest(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("admin-test-email", {
      body: {
        recipient_email: testEmail,
        subject: "Provider settings test — Kang Open Banking",
        body_html: `<h2>Provider configuration test</h2>
          <p>This live test was dispatched from the Email Provider Settings page to confirm that the configured primary provider is delivering successfully.</p>
          <p><strong>Environment:</strong> ${settings?.environment ?? "—"}<br/>
          <strong>Primary provider:</strong> ${settings?.primary_provider ?? "—"}<br/>
          <strong>Fallback provider:</strong> ${settings?.fallback_provider ?? "—"}</p>
          <p>If you received this message, end-to-end delivery is operational.</p>`,
        template_key: "provider-settings",
      },
    });
    setSendingTest(false);
    const payload = (data ?? {}) as any;
    if (error || !payload.success) {
      const msg = payload?.error || error?.message || "Test delivery failed.";
      setTestResult({ success: false, error: msg });
      toast({ title: "Test failed", description: msg, variant: "destructive" });
    } else {
      setTestResult(payload);
      toast({
        title: "Test delivered",
        description: `Sent via ${payload.provider} (${payload.environment}). Message ID ${String(payload.message_id || "").slice(0, 8)}…`,
      });
    }
  }

  function field<K extends keyof Settings>(key: K, value: Settings[K]) {
    setSettings((s) => (s ? { ...s, [key]: value } : s));
  }

  if (loading) return (
    <div className="flex items-center justify-center p-12">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );

  if (!settings) return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">No settings row found.</p>
    </div>
  );

  return (
    <div className="space-y-6 p-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Email Provider Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the primary email provider, fallback behaviour, sender identity and environment.
          Changes apply immediately to the queue dispatcher without redeploying.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Provider routing</CardTitle>
          <CardDescription>Resend is sent first by default; the backup email provider is used as fallback.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Primary provider</Label>
            <Select value={settings.primary_provider} onValueChange={(v) => field("primary_provider", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="lovable_email">Backup Email Provider</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Fallback provider</Label>
            <Select value={settings.fallback_provider} onValueChange={(v) => field("fallback_provider", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="lovable_email">Backup Email Provider</SelectItem>
                <SelectItem value="resend">Resend</SelectItem>
                <SelectItem value="none">None (no fallback)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Environment</Label>
            <Select value={settings.environment} onValueChange={(v) => field("environment", v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Sandbox</SelectItem>
                <SelectItem value="production">Production</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Resend API key secret name</Label>
            <Input
              value={settings.resend_api_key_label}
              onChange={(e) => field("resend_api_key_label", e.target.value)}
              placeholder="RESEND_API_KEY"
            />
            <p className="text-xs text-muted-foreground">
              The dispatcher reads this secret from the backend environment. Manage actual key values in Project Secrets.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Resend enabled</Label>
              <p className="text-xs text-muted-foreground">Turn off to route everything to fallback only.</p>
            </div>
            <Switch checked={settings.resend_enabled} onCheckedChange={(v) => field("resend_enabled", v)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Fallback enabled</Label>
              <p className="text-xs text-muted-foreground">Off = primary failure marks the send as failed.</p>
            </div>
            <Switch checked={settings.fallback_enabled} onCheckedChange={(v) => field("fallback_enabled", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sender identity</CardTitle>
          <CardDescription>From address per environment, plus optional reply-to.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Sandbox from name</Label>
            <Input value={settings.sandbox_from_name} onChange={(e) => field("sandbox_from_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Sandbox from email</Label>
            <Input value={settings.sandbox_from_email} onChange={(e) => field("sandbox_from_email", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Production from name</Label>
            <Input value={settings.production_from_name} onChange={(e) => field("production_from_name", e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Production from email</Label>
            <Input value={settings.production_from_email} onChange={(e) => field("production_from_email", e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reply-to email (optional)</Label>
            <Input
              value={settings.reply_to_email ?? ""}
              onChange={(e) => field("reply_to_email", e.target.value || null)}
              placeholder="support@example.com"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Automated campaigns</CardTitle>
          <CardDescription>Master toggles for recurring user emails.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Weekly account-activity digest</Label>
              <p className="text-xs text-muted-foreground">Runs every Monday at 08:00 UTC for opted-in users.</p>
            </div>
            <Switch checked={settings.weekly_digest_enabled} onCheckedChange={(v) => field("weekly_digest_enabled", v)} />
          </div>
          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <Label className="text-sm">Monthly statement email</Label>
              <p className="text-xs text-muted-foreground">Runs on the 1st of every month at 08:00 UTC with download links.</p>
            </div>
            <Switch checked={settings.monthly_statement_enabled} onCheckedChange={(v) => field("monthly_statement_enabled", v)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notes</CardTitle>
          <CardDescription>Internal-only notes for the operations team.</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            rows={3}
            value={settings.notes ?? ""}
            onChange={(e) => field("notes", e.target.value || null)}
            placeholder="e.g. switched to production after DNS verification on 2026-06-01"
          />
        </CardContent>
      </Card>

      <Separator />

      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
          Save settings
        </Button>
        <div className="flex items-center gap-2 ml-auto">
          <Input
            type="email"
            placeholder="test@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="w-64"
          />
          <Button variant="outline" onClick={sendTest} disabled={!testEmail || sendingTest}>
            {sendingTest ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Send test email
          </Button>
        </div>
      </div>

      {testResult && (
        <div
          data-testid="provider-send-test-result"
          data-success={testResult.success ? "true" : "false"}
          data-provider={testResult.provider || ""}
          className="rounded-md border p-3 text-xs bg-muted/30 space-y-1"
        >
          <div className="flex items-center justify-between">
            <span className="font-medium text-sm">Live delivery result</span>
            <span className={testResult.success ? "text-green-600 font-medium" : "text-destructive font-medium"}>
              {testResult.success ? "sent" : "failed"}
            </span>
          </div>
          <div>Provider: <span className="font-medium">{testResult.provider || "—"}</span></div>
          <div>Environment: <span className="font-medium">{testResult.environment || "—"}</span></div>
          <div>Message ID: <span className="font-mono">{testResult.message_id || "—"}</span></div>
          {testResult.error && <div className="text-destructive break-words">Reason: {testResult.error}</div>}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Last updated: {settings.updated_at ? new Date(settings.updated_at).toLocaleString() : "—"}
      </p>
    </div>
  );
}
