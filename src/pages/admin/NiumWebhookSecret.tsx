import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Copy, Eye, EyeOff, RefreshCw, ShieldAlert, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function NiumWebhookSecret() {
  const [secret, setSecret] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [revealedAt, setRevealedAt] = useState<string | null>(null);

  const call = async (action: "reveal" | "rotate") => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("nium-webhook-secret-manage", {
        body: { action },
      });
      if (error) throw error;
      if (!data?.secret) throw new Error(data?.error ?? "No secret returned");
      setSecret(data.secret);
      setVisible(true);
      setNotice(data.rotation_notice ?? null);
      setRevealedAt(data.revealed_at ?? new Date().toISOString());
      toast.success(action === "rotate" ? "New secret generated" : "Secret revealed");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to load secret");
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    if (!secret) return;
    await navigator.clipboard.writeText(secret);
    toast.success("Copied to clipboard");
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Nium Webhook Secret</h1>
        <p className="text-sm text-muted-foreground">
          Reveal or rotate the shared secret used to verify Nium webhook deliveries.
        </p>
      </div>

      <Alert>
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>Admin only, audited</AlertTitle>
        <AlertDescription>
          Every reveal and rotation is logged with your user id, IP, and timestamp in the audit trail.
          Never share this value over chat or email. Paste it directly into the Nium dashboard.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to use in Nium</CardTitle>
          <CardDescription>Add a single header parameter in Nium's webhook settings.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <ol className="list-decimal ml-5 space-y-1">
            <li>Click <strong>Reveal secret</strong> below and copy the value.</li>
            <li>In the Nium dashboard, open your webhook &rarr; Header Parameters.</li>
            <li>Add: <code className="px-1 py-0.5 bg-muted rounded">Key</code> = <code className="px-1 py-0.5 bg-muted rounded">x-nium-signature-key</code>, <code className="px-1 py-0.5 bg-muted rounded">Value</code> = the revealed secret.</li>
            <li>Save. Nium will now sign requests to our webhook receiver.</li>
          </ol>
          <div className="rounded-md border p-3 bg-muted/40">
            <div className="text-xs text-muted-foreground mb-1">Webhook receiver URLs</div>
            <div className="font-mono text-xs">Sandbox: https://sandbox-api.kangopenbanking.com/v1/nium-webhook</div>
            <div className="font-mono text-xs">Production: https://api.kangopenbanking.com/v1/nium-webhook</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Current secret</CardTitle>
          <CardDescription>The value is only shown once per reveal. Copy it now.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              readOnly
              value={secret ? (visible ? secret : "•".repeat(Math.min(secret.length, 48))) : "Click Reveal secret to display"}
              className="font-mono text-xs"
            />
            <Button variant="outline" size="icon" disabled={!secret} onClick={() => setVisible(v => !v)} aria-label="toggle visibility">
              {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" disabled={!secret} onClick={copy} aria-label="copy">
              <Copy className="h-4 w-4" />
            </Button>
          </div>

          {notice && (
            <Alert>
              <CheckCircle2 className="h-4 w-4" />
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
          {revealedAt && (
            <div className="text-xs text-muted-foreground">Last action: {new Date(revealedAt).toLocaleString()}</div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={() => call("reveal")} disabled={loading}>
              <Eye className="h-4 w-4 mr-2" /> Reveal secret
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={loading}>
                  <RefreshCw className="h-4 w-4 mr-2" /> Rotate secret
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Rotate the Nium webhook secret?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This generates a new random secret and shows it once. You must:
                    <ol className="list-decimal ml-5 mt-2 space-y-1">
                      <li>Save the new value in platform secrets (NIUM_WEBHOOK_SECRET).</li>
                      <li>Update the Nium dashboard header parameter with the same value.</li>
                    </ol>
                    Until both steps are complete, webhook signature verification will fail.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => call("rotate")}>Generate new secret</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
