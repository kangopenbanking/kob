// Admin "Send test webhook" dialog
// Pick an endpoint + event type, optionally a custom JSON payload,
// fire a signed synthetic event, show the delivery result inline.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Send, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

const EVENT_TYPES = [
  "payment.succeeded",
  "payment.failed",
  "payment.refunded",
  "qr.paid",
  "qr.expired",
  "remittance.cemac.quoted",
  "remittance.cemac.paid",
  "remittance.cemac.cancelled",
  "agent.cashin.completed",
  "agent.cashout.completed",
  "agent.float.low",
  "ussd.session.started",
  "ussd.session.ended",
  "transfer.completed",
  "transfer.failed",
  "ledger.posted",
];

interface Endpoint {
  id: string;
  url: string;
  merchant_id: string | null;
  status: string | null;
}

interface DeliveryResult {
  delivery_id: string | null;
  event_id: string;
  status: "delivered" | "failed";
  http_status: number;
  latency_ms: number;
  endpoint_url: string;
}

export function TestWebhookDialog({ onDelivered }: { onDelivered?: () => void }) {
  const [open, setOpen] = useState(false);
  const [endpoints, setEndpoints] = useState<Endpoint[]>([]);
  const [endpointId, setEndpointId] = useState<string>("");
  const [eventType, setEventType] = useState<string>("payment.succeeded");
  const [payloadText, setPayloadText] = useState<string>("{}");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<DeliveryResult | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from("gateway_webhook_endpoints")
        .select("id, url, merchant_id, status")
        .order("created_at", { ascending: false })
        .limit(100);
      setEndpoints((data as Endpoint[] | null) ?? []);
      if (data?.[0]) setEndpointId(data[0].id);
    })();
  }, [open]);

  async function send() {
    if (!endpointId) {
      toast.error("Pick an endpoint first");
      return;
    }
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(payloadText || "{}");
    } catch {
      toast.error("Custom payload must be valid JSON");
      return;
    }
    setSending(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-send-test-webhook", {
        body: { endpoint_id: endpointId, event_type: eventType, payload },
      });
      if (error) throw error;
      setResult(data as DeliveryResult);
      if ((data as DeliveryResult).status === "delivered") {
        toast.success("Test webhook delivered");
      } else {
        toast.error(`Endpoint replied ${(data as DeliveryResult).http_status || "0"}`);
      }
      onDelivered?.();
    } catch (err) {
      toast.error(await extractEdgeFunctionError(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Send className="mr-2 h-4 w-4" />
          Send test webhook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Send a test webhook</DialogTitle>
          <DialogDescription>
            Fire a signed synthetic event to a registered endpoint. The result appears in the
            Deliveries tab marked as a test delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Endpoint</Label>
            <Select value={endpointId} onValueChange={setEndpointId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose endpoint" />
              </SelectTrigger>
              <SelectContent>
                {endpoints.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.url}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Event type</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Custom payload (optional JSON)</Label>
            <Textarea
              rows={5}
              value={payloadText}
              onChange={(e) => setPayloadText(e.target.value)}
              placeholder='{"amount": 1000, "currency": "XAF"}'
              className="font-mono text-xs"
            />
          </div>

          {result && (
            <Card className="border-border">
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="flex items-center gap-2">
                  {result.status === "delivered" ? (
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  <Badge variant={result.status === "delivered" ? "default" : "destructive"}>
                    {result.status}
                  </Badge>
                  <span className="text-muted-foreground">HTTP {result.http_status}</span>
                  <span className="text-muted-foreground">{result.latency_ms} ms</span>
                </div>
                <div className="text-xs text-muted-foreground">
                  <div>Event: <code>{result.event_id}</code></div>
                  {result.delivery_id && (
                    <div>Delivery id: <code>{result.delivery_id}</code> — visible in the Deliveries tab.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Close
          </Button>
          <Button onClick={send} disabled={sending || !endpointId}>
            {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
