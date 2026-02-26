import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, CreditCard, RefreshCcw, AlertTriangle, Clock, Webhook } from "lucide-react";

export default function SimulationTools() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Sandbox</Badge>
        <h1 className="text-4xl font-bold mb-4">Simulation Tools</h1>
        <p className="text-xl text-muted-foreground">Advanced testing simulations for fraud, disputes, refunds, webhooks, and settlements.</p>
      </div>
      <Separator className="my-8" />
      <div className="grid md:grid-cols-2 gap-6">
        {[
          { icon: AlertTriangle, title: "Fraud Simulation", desc: "Trigger fraud detection at various risk levels by using specific test amounts or device fingerprints. Test auto-block, manual review, and STR filing flows.", params: "amount=99999 (high risk), device_fp=fraud_test_001" },
          { icon: CreditCard, title: "Dispute Simulation", desc: "Create test disputes against sandbox charges. Simulate dispute lifecycle: created → evidence requested → won/lost. Test wallet debit/re-credit.", params: "Use charge_id from sandbox, reason=fraudulent|product_not_received" },
          { icon: RefreshCcw, title: "Refund Simulation", desc: "Test full and partial refunds. Verify over-refund guards, split refund distribution, and merchant wallet debit.", params: "amount=full|partial, split=true|false" },
          { icon: Webhook, title: "Webhook Replay", desc: "Replay any webhook event type to your endpoint. Test signature verification, idempotency handling, and error recovery.", params: "event_type=charge.successful, replay_count=1-5" },
          { icon: Clock, title: "Latency Injection", desc: "Add artificial latency to sandbox responses to test timeout handling and retry logic in your integration.", params: "X-Sandbox-Delay: 5000 (milliseconds)" },
          { icon: FlaskConical, title: "Settlement Simulation", desc: "Trigger settlement cycle for sandbox merchants. Verify settlement calculation, payout initiation, and reconciliation.", params: "POST /v1/sandbox/trigger-settlement" },
        ].map((tool) => (
          <Card key={tool.title}>
            <CardHeader><div className="flex items-center gap-3"><tool.icon className="h-5 w-5 text-primary" /><CardTitle className="text-lg">{tool.title}</CardTitle></div></CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <p>{tool.desc}</p>
              <div className="bg-muted rounded-lg p-3"><code className="text-xs">{tool.params}</code></div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
