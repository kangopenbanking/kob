import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { ProviderSimulatorPanel } from "@/components/developer/ProviderSimulatorPanel";

const triggerExample = `# Trigger a test webhook event
curl -X POST https://api.kangopenbanking.com/v1/sandbox/webhooks/trigger \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -d '{
    "event_type": "charge.successful",
    "target_url": "https://your-app.com/webhooks/kang",
    "payload_overrides": {
      "amount": 5000,
      "currency": "XAF"
    }
  }'`;

const verifyExample = `import crypto from 'crypto';

function verifyWebhookSignature(rawBody, signatureHeader, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signatureHeader),
    Buffer.from(expected)
  );
}

// In your webhook handler:
app.post('/webhooks/kang', (req, res) => {
  const signature = req.headers['x-kang-signature'];
  const isValid = verifyWebhookSignature(
    req.rawBody,
    signature,
    'whsec_test_sandbox_KangOB2026Demo'
  );
  
  if (!isValid) return res.status(401).send('Invalid signature');
  
  const event = req.body;
  switch (event.event_type) {
    case 'charge.successful':
      // Handle successful payment
      break;
    case 'payout.completed':
      // Handle completed payout
      break;
  }
  
  res.status(200).send('OK');
});`;

const pythonVerify = `import hmac, hashlib

def verify_webhook(raw_body: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# In your Flask handler:
@app.route("/webhooks/kang", methods=["POST"])
def handle_webhook():
    signature = request.headers.get("X-Kang-Signature")
    if not verify_webhook(
        request.data,
        signature,
        "whsec_test_sandbox_KangOB2026Demo"
    ):
        return "Invalid signature", 401
    
    event = request.json
    if event["event_type"] == "charge.successful":
        # Handle successful payment
        pass
    
    return "OK", 200`;

const WEBHOOK_EVENTS = [
  ["charge.created", "A charge has been initiated"],
  ["charge.successful", "A charge completed successfully"],
  ["charge.failed", "A charge attempt failed"],
  ["charge.pending", "A charge is awaiting confirmation"],
  ["charge.expired", "A charge expired before completion"],
  ["charge.refunded", "A charge was fully refunded"],
  ["charge.partially_refunded", "A charge was partially refunded"],
  ["charge.disputed", "A dispute was opened on a charge"],
  ["payout.created", "A payout has been initiated"],
  ["payout.processing", "A payout is being processed"],
  ["payout.completed", "A payout completed successfully"],
  ["payout.failed", "A payout attempt failed"],
  ["payout.reversed", "A payout was reversed"],
  ["refund.created", "A refund has been initiated"],
  ["refund.completed", "A refund completed successfully"],
  ["refund.failed", "A refund attempt failed"],
  ["subscription.created", "A subscription was created"],
  ["subscription.activated", "A subscription became active"],
  ["subscription.renewed", "A subscription was renewed"],
  ["subscription.cancelled", "A subscription was cancelled"],
  ["subscription.expired", "A subscription expired"],
  ["subscription.payment_failed", "A subscription payment failed"],
  ["dispute.created", "A dispute was opened"],
  ["dispute.won", "A dispute was resolved in your favor"],
  ["dispute.lost", "A dispute was resolved against you"],
  ["dispute.evidence_required", "Evidence is needed for a dispute"],
  ["settlement.created", "A settlement batch was created"],
  ["settlement.completed", "A settlement was paid out"],
  ["transfer.created", "A bank transfer was initiated"],
  ["transfer.completed", "A bank transfer completed"],
  ["transfer.failed", "A bank transfer failed"],
  ["payment_link.created", "A payment link was created"],
  ["payment_link.paid", "A payment link was paid"],
  ["payment_link.expired", "A payment link expired"],
  ["consent.created", "An open banking consent was created"],
  ["consent.authorised", "A consent was authorised by the user"],
  ["consent.revoked", "A consent was revoked"],
  ["consent.expired", "A consent expired"],
  ["account.updated", "Account details were updated"],
  ["wallet.credited", "Funds were added to a wallet"],
  ["wallet.debited", "Funds were removed from a wallet"],
  ["escrow.funded", "An escrow was funded"],
  ["escrow.released", "Escrow funds were released"],
  ["escrow.disputed", "An escrow was disputed"],
  ["kyc.approved", "KYC verification was approved"],
  ["kyc.rejected", "KYC verification was rejected"],
  ["kyc.pending_review", "KYC requires manual review"],
  ["invoice.created", "An invoice was generated"],
  ["invoice.paid", "An invoice was paid"],
  ["invoice.overdue", "An invoice is overdue"],
  ["api_key.rotated", "An API key was rotated"],
  ["webhook.failed", "A webhook delivery failed permanently"],
];

export default function SandboxSimulateWebhooks() {
  return (
    <>
      <Helmet>
        <title>Simulate Webhooks | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Trigger and test all 52 webhook event types in the Kang Open Banking sandbox. Verify signatures, test handlers, and debug webhook integrations." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox/simulate-webhooks" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Simulate Webhooks</h1>
          <p className="text-lg text-muted-foreground">
            Trigger any of the 52 webhook event types on demand. Test your handlers, verify signatures, and debug integrations without creating real transactions.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="trigger">Trigger a Test Event</h2>
          <CodeBlock examples={[{ code: triggerExample, language: "bash", label: "cURL" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="verify">Verify Webhook Signatures</h2>
          <p className="text-muted-foreground mb-4">
            Every webhook includes an <code className="bg-muted px-1 rounded text-sm">X-Kang-Signature</code> header containing an HMAC-SHA256 signature. Always verify this signature before processing events.
          </p>
          <CodeBlock examples={[
            { code: verifyExample, language: "javascript", label: "Node.js" },
            { code: pythonVerify, language: "python", label: "Python" },
          ]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="events">All 52 Event Types</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Event Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {WEBHOOK_EVENTS.map(([event, desc]) => (
                  <tr key={event} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{event}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="retry">Retry Policy</h2>
          <p className="text-muted-foreground mb-4">
            In production, failed webhook deliveries are retried with exponential backoff:
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Attempt</th>
                  <th className="text-left p-3 font-medium text-foreground">Delay</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["1st retry", "30 seconds"],
                  ["2nd retry", "5 minutes"],
                  ["3rd retry", "30 minutes"],
                  ["4th retry", "2 hours"],
                  ["5th retry", "24 hours"],
                ].map(([attempt, delay]) => (
                  <tr key={attempt} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{attempt}</td>
                    <td className="p-3 text-muted-foreground">{delay}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            After 5 failed attempts, the endpoint is disabled and a <code className="bg-muted px-1 rounded text-sm">webhook.failed</code> notification is sent.
          </p>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
