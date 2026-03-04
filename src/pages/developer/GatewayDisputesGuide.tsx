import { SEO } from "@/components/SEO";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DocNavigation } from "@/components/developer/DocNavigation";
import { Info } from "lucide-react";

const GatewayDisputesGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Gateway Disputes API | Kang Open Banking" description="Manage card chargebacks, submit evidence, and track dispute lifecycle with automated webhook sync from Stripe." />
    <div>
      <Badge variant="outline" className="mb-2">Payment Gateway</Badge>
      <h1 className="text-3xl font-bold">Disputes API</h1>
      <p className="text-muted-foreground mt-2">Handle card chargebacks and payment disputes. Disputes are automatically created when Stripe sends dispute webhook events, and you can submit evidence to contest them through the API.</p>
    </div>

    {/* How It Works */}
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">How It Works</h2>
      <p className="text-sm text-muted-foreground">
        When a cardholder disputes a charge with their bank, Stripe notifies KOB via webhook. The gateway automatically creates a dispute record linked to the original charge. You then have a window (typically 7–21 days) to submit evidence before the issuing bank makes a final decision.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <h3 className="font-semibold mb-3">Dispute Lifecycle</h3>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {["Cardholder Disputes", "Stripe Webhook", "Dispute Created (open)", "Evidence Submitted (under_review)", "Bank Decision (won / lost)"].map((step, i) => (
            <span key={step}>
              {i > 0 && <span className="mr-2">→</span>}
              <span className="bg-primary/10 text-primary px-3 py-1 rounded-full font-medium inline-block">{step}</span>
            </span>
          ))}
        </div>
      </div>
    </div>

    {/* Dispute Statuses */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Dispute Statuses</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Status</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Action Required</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { status: "open", desc: "Dispute received — awaiting evidence", action: "Submit evidence before deadline" },
            { status: "under_review", desc: "Evidence submitted — bank reviewing", action: "Wait for decision" },
            { status: "won", desc: "Dispute resolved in your favor", action: "None — funds returned" },
            { status: "lost", desc: "Dispute lost — funds permanently debited", action: "None" },
            { status: "closed", desc: "Dispute closed (expired or withdrawn)", action: "None" },
          ].map(s => (
            <TableRow key={s.status}>
              <TableCell><Badge variant={s.status === "won" ? "default" : s.status === "lost" ? "destructive" : "outline"}>{s.status}</Badge></TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.desc}</TableCell>
              <TableCell className="text-sm text-muted-foreground">{s.action}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    {/* Dispute Reasons */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Common Dispute Reasons</h3>
      <div className="grid sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
        {[
          { reason: "fraudulent", desc: "Cardholder claims they didn't authorize the transaction" },
          { reason: "duplicate", desc: "Cardholder was charged more than once" },
          { reason: "product_not_received", desc: "Goods or services were not delivered" },
          { reason: "product_unacceptable", desc: "Product was defective or not as described" },
          { reason: "subscription_canceled", desc: "Charged after canceling a subscription" },
          { reason: "unrecognized", desc: "Cardholder doesn't recognize the charge" },
        ].map(r => (
          <div key={r.reason} className="flex gap-2">
            <code className="bg-muted px-1.5 py-0.5 rounded text-xs whitespace-nowrap">{r.reason}</code>
            <span>{r.desc}</span>
          </div>
        ))}
      </div>
    </div>

    {/* API Reference */}
    <h2 className="text-xl font-semibold">API Reference</h2>

    <ApiEndpoint method="GET" endpoint="/v1/gateway/disputes?merchant_id={id}&status={status}&limit=50&offset=0" description="List disputes with optional status filter."
      response={JSON.stringify({ data: [{ id: "dsp_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "open", reason: "fraudulent", evidence_due_by: "2026-03-01T00:00:00Z", provider: "stripe", created_at: "2026-02-20T14:00:00Z" }], total: 1 }, null, 2)}
    />

    <ApiEndpoint method="GET" endpoint="/v1/gateway/disputes/{disputeId}" description="Retrieve a single dispute with full details."
      response={JSON.stringify({ id: "dsp_uuid", charge_id: "chg_uuid", amount: 5000, currency: "XAF", status: "open", reason: "fraudulent", evidence_due_by: "2026-03-01T00:00:00Z", provider: "stripe", evidence_submitted: false, created_at: "2026-02-20T14:00:00Z" }, null, 2)}
    />

    <ApiEndpoint method="POST" endpoint="/v1/gateway/disputes/{disputeId}/evidence" description="Submit evidence to contest a dispute. Must be submitted before the evidence_due_by deadline."
      requestBody={JSON.stringify({ evidence_text: "Customer received goods on 2026-02-18. Tracking: DHL-12345.", evidence_type: "receipt", file_url: "https://storage.example.com/receipt.pdf" }, null, 2)}
      response={JSON.stringify({ id: "dsp_uuid", status: "under_review", evidence_submitted_at: "2026-02-21T10:00:00Z" }, null, 2)}
      parameters={[
        { name: "disputeId", type: "uuid", required: true, description: "The dispute to submit evidence for" },
        { name: "evidence_text", type: "string", required: true, description: "Text description of the evidence" },
        { name: "evidence_type", type: "string", required: false, description: "Type: receipt, tracking, refund_policy, customer_communication, etc." },
        { name: "file_url", type: "string", required: false, description: "URL to supporting file (PDF, image)" },
      ]}
    />

    {/* Webhook Events */}
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Webhook Events</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[
            { event: "dispute.opened", desc: "New dispute created from Stripe webhook" },
            { event: "dispute.evidence_submitted", desc: "Evidence was submitted for the dispute" },
            { event: "dispute.won", desc: "Dispute resolved in merchant's favor — funds returned" },
            { event: "dispute.lost", desc: "Dispute lost — charge amount permanently debited" },
            { event: "dispute.closed", desc: "Dispute closed without a decision (expired or withdrawn)" },
          ].map(e => (
            <TableRow key={e.event}>
              <TableCell><code className="bg-muted px-1.5 py-0.5 rounded text-xs">{e.event}</code></TableCell>
              <TableCell className="text-sm text-muted-foreground">{e.desc}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>

    <Alert className="border-primary/30 bg-primary/5">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-sm">
        <strong>Evidence Tips</strong> — Include delivery tracking numbers, customer communication screenshots, signed receipts, and refund policy links. Disputes with comprehensive evidence have significantly higher win rates.
      </AlertDescription>
    </Alert>

    <DocNavigation
      previousPage={{ title: "Settlements", path: "/developer/gateway/settlements" }}
      nextPage={{ title: "Payment Links", path: "/developer/gateway/payment-links" }}
    />
  </div>
);

export default GatewayDisputesGuide;
