import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Webhook, Bell, CheckCircle2, Code } from "lucide-react";

export default function Webhooks() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/documentation" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Webhook className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Webhooks & Events</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Webhooks & Event Notifications</h1>
          <p className="text-xl text-muted-foreground">
            Real-time event notifications to keep your application in sync with transaction status and account changes
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">What are Webhooks?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Webhooks are HTTP callbacks that KOB sends to your server when specific events occur. Instead of polling our API for changes, webhooks push real-time notifications to your application, enabling immediate response to transaction status changes, payment completions, and other critical events.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Available Webhook Events</h2>
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent" />
                  Payment Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">payment.initiated</p>
                    <p className="text-sm text-muted-foreground">Payment request created and pending authorization</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">payment.authorized</p>
                    <p className="text-sm text-muted-foreground">Customer has authorized the payment</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">payment.completed</p>
                    <p className="text-sm text-muted-foreground">Payment successfully processed and settled</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">payment.failed</p>
                    <p className="text-sm text-muted-foreground">Payment failed due to insufficient funds or other error</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">payment.cancelled</p>
                    <p className="text-sm text-muted-foreground">Payment cancelled by user or system</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent" />
                  Consent Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">consent.created</p>
                    <p className="text-sm text-muted-foreground">New consent request created</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">consent.authorized</p>
                    <p className="text-sm text-muted-foreground">Customer has granted consent</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">consent.revoked</p>
                    <p className="text-sm text-muted-foreground">Consent revoked by customer</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">consent.expired</p>
                    <p className="text-sm text-muted-foreground">Consent has reached expiration date</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5 text-accent" />
                  Account Events
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">account.updated</p>
                    <p className="text-sm text-muted-foreground">Account information has been updated</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">transaction.created</p>
                    <p className="text-sm text-muted-foreground">New transaction posted to account</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium font-mono text-sm">balance.updated</p>
                    <p className="text-sm text-muted-foreground">Account balance has changed</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Webhook Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Setting Up Webhooks</h3>
                <ol className="space-y-3">
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold">1</span>
                    <div>
                      <p className="font-medium">Configure Webhook URL</p>
                      <p className="text-sm text-muted-foreground">Set your webhook endpoint in the Developer Portal</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold">2</span>
                    <div>
                      <p className="font-medium">Select Event Types</p>
                      <p className="text-sm text-muted-foreground">Choose which events you want to receive</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold">3</span>
                    <div>
                      <p className="font-medium">Save Webhook Secret</p>
                      <p className="text-sm text-muted-foreground">Store the webhook signing secret for verification</p>
                    </div>
                  </li>
                  <li className="flex gap-3">
                    <span className="flex-shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-primary/20 text-primary text-sm font-semibold">4</span>
                    <div>
                      <p className="font-medium">Test Your Endpoint</p>
                      <p className="text-sm text-muted-foreground">Use sandbox to verify webhook handling</p>
                    </div>
                  </li>
                </ol>
              </div>

              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                <p className="text-sm font-semibold mb-1">Webhook Requirements</p>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Must use HTTPS (HTTP not allowed in production)</li>
                  <li>• Must respond with 2xx status code within 5 seconds</li>
                  <li>• Must verify webhook signatures</li>
                  <li>• Should implement idempotency to handle retries</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Code className="h-6 w-6 text-primary" />
                Webhook Payload Structure
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                <pre className="font-mono text-sm">{`{
  "id": "evt_1234567890",
  "type": "payment.completed",
  "created": "2025-01-15T10:30:00Z",
  "data": {
    "object": {
      "id": "pay_abc123",
      "amount": 50000,
      "currency": "XAF",
      "status": "completed",
      "reference": "INV-2025-001",
      "creditor": {
        "name": "Merchant Name",
        "account": "CM21ABCD12340123456789012"
      },
      "debtor": {
        "name": "Customer Name",
        "account": "CM21WXYZ98760987654321098"
      },
      "completed_at": "2025-01-15T10:29:45Z"
    }
  },
  "livemode": true
}`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Verifying Webhook Signatures</CardTitle>
              <CardDescription>Ensure webhooks are genuinely from KOB</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Every webhook includes an X-KOB-Signature header. You must verify this signature to ensure the webhook came from KOB and wasn't spoofed.
              </p>

              <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Node.js Example</p>
                <pre className="font-mono text-sm">{`const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hmac)
  );
}

// In your webhook handler
app.post('/webhooks/kob', (req, res) => {
  const signature = req.headers['x-kob-signature'];
  const payload = JSON.stringify(req.body);
  
  if (!verifyWebhook(payload, signature, WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }
  
  // Process the webhook
  const event = req.body;
  console.log('Received event:', event.type);
  
  res.status(200).send('OK');
});`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Retry Policy & Error Handling</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                If your endpoint doesn't respond with a 2xx status code, KOB will automatically retry the webhook delivery using an exponential backoff strategy.
              </p>

              <div className="border rounded-lg p-4">
                <p className="font-semibold mb-2">Retry Schedule</p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Attempt 1: Immediate</li>
                  <li>• Attempt 2: After 5 minutes</li>
                  <li>• Attempt 3: After 30 minutes</li>
                  <li>• Attempt 4: After 2 hours</li>
                  <li>• Attempt 5: After 6 hours</li>
                  <li>• Attempt 6: After 24 hours</li>
                </ul>
                <p className="text-sm text-muted-foreground mt-2">
                  After 6 failed attempts, the webhook is marked as failed and must be manually retried from the Developer Portal.
                </p>
              </div>

              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                <p className="text-sm font-semibold mb-1">Best Practice: Implement Idempotency</p>
                <p className="text-sm text-muted-foreground">
                  Use the webhook event ID to ensure you process each webhook only once, even if it's delivered multiple times.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Testing Webhooks</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Use the Developer Portal to test webhook delivery without making actual transactions.
              </p>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Sandbox Testing
                  </p>
                  <p className="text-sm text-muted-foreground">
                    All sandbox transactions trigger real webhooks to your configured endpoint
                  </p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Manual Trigger
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Send test webhooks for any event type from the Developer Portal
                  </p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold mb-2">Local Testing with ngrok</p>
                <pre className="font-mono text-xs">{`# Install ngrok
npm install -g ngrok

# Start your local server
node server.js

# Expose it via ngrok
ngrok http 3000

# Use the ngrok HTTPS URL in Developer Portal
https://abc123.ngrok.io/webhooks/kob`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex gap-4">
            <Link to="/guides/security" className="flex-1">
              <Button variant="outline" className="w-full">Previous: Security Guide</Button>
            </Link>
            <Link to="/documentation" className="flex-1">
              <Button className="w-full">Back to Documentation</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
