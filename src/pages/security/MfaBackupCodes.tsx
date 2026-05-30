import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, KeyRound, RefreshCw, ShieldCheck, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

export default function MfaBackupCodes() {
  const [remaining, setRemaining] = useState<number | null>(null);
  const [total, setTotal] = useState<number | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadStatus() {
    setError(null);
    const { data, error } = await supabase.functions.invoke("mfa-backup-codes", {
      body: { action: "status" },
    });
    if (error) { setError(error.message); return; }
    setRemaining(data?.remaining ?? 0);
    setTotal(data?.total ?? 0);
  }

  useEffect(() => { loadStatus(); }, []);

  async function generate() {
    setLoading(true); setError(null); setCodes(null);
    const { data, error } = await supabase.functions.invoke("mfa-backup-codes", {
      body: { action: "generate" },
    });
    setLoading(false);
    if (error) { setError(error.message); return; }
    setCodes(data?.codes ?? []);
    await loadStatus();
    toast.success("Backup codes generated. Save them now — they will not be shown again.");
  }

  async function copyAll() {
    if (!codes) return;
    await navigator.clipboard.writeText(codes.join("\n"));
    toast.success("Copied to clipboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">MFA Backup Codes</h1>
        <p className="text-sm text-muted-foreground">
          One-time recovery codes for when you cannot receive an SMS code.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Status</CardTitle>
          <CardDescription>
            {remaining == null
              ? "Loading…"
              : remaining > 0
              ? `${remaining} unused code${remaining === 1 ? "" : "s"} remaining (of ${total} generated).`
              : "No active backup codes. Generate a set to enable account recovery."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button onClick={generate} disabled={loading}>
            <KeyRound className="mr-2 h-4 w-4" />
            {remaining && remaining > 0 ? "Regenerate codes" : "Generate codes"}
          </Button>
          <Button variant="outline" onClick={loadStatus} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Something went wrong</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {codes && (
        <Card>
          <CardHeader>
            <CardTitle>Your new backup codes</CardTitle>
            <CardDescription>
              Each code can be used once. Store them in a password manager. Generating a new set invalidates all prior codes.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {codes.map((c) => (
                <div key={c} className="rounded-md border bg-muted/30 px-3 py-2">{c}</div>
              ))}
            </div>
            <Button variant="outline" onClick={copyAll}>
              <Copy className="mr-2 h-4 w-4" /> Copy all
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
