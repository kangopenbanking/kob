import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Send, ShieldCheck, ShieldAlert, Copy, FileWarning } from "lucide-react";
import { toast } from "sonner";
import { validateWebhookEvent, WEBHOOK_EVENT_SCHEMAS } from "@/lib/webhook-event-schemas";

const PUBLIC_BASE = "https://api.kangopenbanking.com/v1";

async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return Array.from(new Uint8Array(sigBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const DEFAULT_PAYLOAD = JSON.stringify(
  {
    id: "evt_sandbox_001",
    type: "charge.succeeded",
    created: Math.floor(Date.now() / 1000),
    data: { object: { id: "chg_test_123", amount: "5000", currency: "XAF", status: "succeeded" } },
  },
  null,
  2,
);

export default function SandboxWebhookTester() {
  const [secret, setSecret] = useState("whsec_sandbox_change_me");
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [eventType, setEventType] = useState("charge.succeeded");
  const [endpoint, setEndpoint] = useState(`${PUBLIC_BASE}/sandbox/webhook-echo`);
  const [signature, setSignature] = useState<string | null>(null);
  const [deliveryId, setDeliveryId] = useState<string | null>(null);

  // Verifier
  const [verifyBody, setVerifyBody] = useState("");
  const [verifySig, setVerifySig] = useState("");
  const [verifySecret, setVerifySecret] = useState("");
  const [verifyResult, setVerifyResult] = useState<null | { ok: boolean; expected: string }>(null);

  async function send() {
    try {
      const sig = await hmacSha256Hex(secret, payload);
      const id = crypto.randomUUID();
      setSignature(sig);
      setDeliveryId(id);
      // Best-effort POST to the supplied endpoint
      try {
        await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Webhook-Signature": sig,
            "X-Webhook-Event": eventType,
            "X-Webhook-ID": id,
          },
          body: payload,
        });
        toast.success("Test event dispatched");
      } catch {
        toast.message("Signed locally", {
          description: "Endpoint unreachable from browser; copy headers below to replay manually.",
        });
      }
    } catch (e: any) {
      toast.error("Failed to sign payload", { description: e.message });
    }
  }

  async function verify() {
    try {
      const expected = await hmacSha256Hex(verifySecret, verifyBody);
      setVerifyResult({ ok: expected === verifySig.trim().toLowerCase(), expected });
    } catch (e: any) {
      toast.error("Verification failed", { description: e.message });
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  return (
    <div className="container max-w-4xl py-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sandbox Webhook Tester</h1>
        <p className="text-muted-foreground mt-2">
          Generate signed test events and verify signatures end-to-end. Headers and HMAC-SHA256
          algorithm match the runtime <code>gateway-webhook-deliver-v2</code> worker exactly.
        </p>
      </div>

      <Tabs defaultValue="send">
        <TabsList>
          <TabsTrigger value="send">Sender</TabsTrigger>
          <TabsTrigger value="verify">Verifier</TabsTrigger>
        </TabsList>

        <TabsContent value="send" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compose test event</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-2">
                <Label>Endpoint URL</Label>
                <Input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Event type</Label>
                  <Input value={eventType} onChange={(e) => setEventType(e.target.value)} />
                </div>
                <div>
                  <Label>Endpoint secret</Label>
                  <Input value={secret} onChange={(e) => setSecret(e.target.value)} type="password" />
                </div>
              </div>
              <div>
                <Label>Payload (raw JSON)</Label>
                <Textarea rows={8} value={payload} onChange={(e) => setPayload(e.target.value)} className="font-mono text-xs" />
              </div>
              <Button onClick={send} variant="outline">
                <Send className="h-4 w-4 mr-2" /> Sign &amp; dispatch
              </Button>
            </CardContent>
          </Card>

          {signature && (
            <Card>
              <CardHeader>
                <CardTitle>Headers sent</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 font-mono text-xs">
                <Row label="X-Webhook-Signature" value={signature} onCopy={copy} />
                <Row label="X-Webhook-Event" value={eventType} onCopy={copy} />
                <Row label="X-Webhook-ID" value={deliveryId!} onCopy={copy} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="verify" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Verify a received signature</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Raw request body</Label>
                <Textarea rows={6} value={verifyBody} onChange={(e) => setVerifyBody(e.target.value)} className="font-mono text-xs" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>X-Webhook-Signature header</Label>
                  <Input value={verifySig} onChange={(e) => setVerifySig(e.target.value)} className="font-mono text-xs" />
                </div>
                <div>
                  <Label>Endpoint secret</Label>
                  <Input value={verifySecret} onChange={(e) => setVerifySecret(e.target.value)} type="password" />
                </div>
              </div>
              <Button onClick={verify} variant="outline">
                <ShieldCheck className="h-4 w-4 mr-2" /> Verify
              </Button>
              {verifyResult && (
                <div className="space-y-2">
                  <Badge variant="outline" className={verifyResult.ok ? "border-primary" : ""}>
                    {verifyResult.ok ? (
                      <><ShieldCheck className="h-3 w-3 mr-1" /> Valid signature</>
                    ) : (
                      <><ShieldAlert className="h-3 w-3 mr-1" /> Mismatch</>
                    )}
                  </Badge>
                  <div className="text-xs font-mono break-all text-muted-foreground">
                    Expected: {verifyResult.expected}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Row({ label, value, onCopy }: { label: string; value: string; onCopy: (v: string, l: string) => void }) {
  return (
    <div className="flex items-start justify-between gap-2 border rounded p-2">
      <div className="flex-1">
        <div className="text-muted-foreground">{label}</div>
        <div className="break-all">{value}</div>
      </div>
      <Button size="sm" variant="outline" onClick={() => onCopy(value, label)}>
        <Copy className="h-3 w-3" />
      </Button>
    </div>
  );
}
