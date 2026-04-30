import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, Webhook, CheckCircle2, AlertTriangle, PlayCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function WebhooksGuide() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Webhooks & Event Notifications</h1>
        <p className="text-xl text-muted-foreground">
          Receive real-time notifications for payment status changes, consent updates, and account events
        </p>
      </div>

      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlayCircle className="h-5 w-5 text-primary" />
            Try the Webhook Simulator
          </CardTitle>
          <CardDescription>
            Generate a real webhook payload (fresh, stale timestamp, duplicate ID, or invalid signature)
            and inspect the headers, body, and the exact RFC 7807 error envelope your endpoint should return.
            Includes a copy/paste signature-verification snippet you can run against the simulated request.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/developer/webhook-simulator">
              <PlayCircle className="h-4 w-4 mr-2" /> Open Simulator
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/developer/api-reference/webhook-retry">Retry & DLQ Policy</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/developer/api-reference/errors">Error Catalog</Link>
          </Button>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Webhooks allow your application to receive automatic notifications when events occur, eliminating the need for constant polling.
        </AlertDescription>
      </Alert>

      {/* Webhook Events */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Available Webhook Events</h2>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Payment Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.initiated</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment has been created and is pending authorization</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.authorized</Badge>
              <p className="text-sm text-muted-foreground flex-1">Customer has authorized the payment with SCA</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.processing</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment is being processed by the bank</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.completed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment has been successfully settled</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.failed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment failed due to insufficient funds or other errors</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">payment.rejected</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment was rejected by the bank</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Consent Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline">consent.created</Badge>
              <p className="text-sm text-muted-foreground flex-1">New consent request has been created</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">consent.authorized</Badge>
              <p className="text-sm text-muted-foreground flex-1">Customer has authorized the consent</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">consent.revoked</Badge>
              <p className="text-sm text-muted-foreground flex-1">Customer has revoked their consent</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">consent.expired</Badge>
              <p className="text-sm text-muted-foreground flex-1">Consent has reached its expiration date</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Mobile Money Events
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge variant="outline">mobilemoney.charge.initiated</Badge>
              <p className="text-sm text-muted-foreground flex-1">Mobile money charge has been initiated</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">mobilemoney.charge.completed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Customer has completed mobile money payment</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">mobilemoney.charge.failed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Mobile money charge failed or was cancelled</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge variant="outline">mobilemoney.transfer.completed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Disbursement to mobile money wallet successful</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Configuration */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Webhook Configuration</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Setting Up Webhooks</CardTitle>
            <CardDescription>Configure your webhook endpoint in the developer dashboard</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Log in to your Developer Dashboard</li>
              <li>Navigate to Settings → Webhooks</li>
              <li>Click "Add Webhook Endpoint"</li>
              <li>Enter your webhook URL (must be HTTPS)</li>
              <li>Select the events you want to receive</li>
              <li>Save your webhook configuration</li>
              <li>Copy the webhook secret for signature verification</li>
            </ol>

            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Requirements:</strong> Your webhook endpoint must use HTTPS, respond within 5 seconds, and return a 2xx status code.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>

      {/* Payload Structure */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Webhook Payload Structure</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Example Webhook Payload</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                {
                  language: "json",
                  code: `{
  "id": "evt_abc123def456",
  "event": "payment.completed",
  "created_at": "2026-10-27T10:30:00Z",
  "data": {
    "payment_id": "pay_xyz789",
    "consent_id": "consent_123",
    "status": "AcceptedSettlementCompleted",
    "amount": {
      "amount": "50000.00",
      "currency": "XAF"
    },
    "creditor_account": {
      "identification": "677123456",
      "name": "Merchant Ltd"
    },
    "debtor_account": {
      "identification": "677987654",
      "name": "John Doe"
    },
    "reference": "INV-2026-001",
    "created_at": "2026-10-27T10:00:00Z",
    "completed_at": "2026-10-27T10:30:00Z"
  },
  "api_version": "v1"
}`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Signature Verification */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Signature Verification</h2>
        
        <Alert className="mb-4">
          <Info className="h-4 w-4" />
          <AlertDescription>
            Always verify webhook signatures to ensure requests are genuinely from Kang Open Banking and haven't been tampered with.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Verifying Webhook Signatures</CardTitle>
            <CardDescription>Implement signature verification in your webhook handler</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Each webhook request includes a <code className="bg-muted px-2 py-1 rounded">X-KOB-Signature</code> header containing an HMAC SHA-256 signature of the payload.
            </p>

            <CodeBlock
              title="Node.js Example"
              examples={[
                {
                  language: "javascript",
                  label: "Node.js",
                  code: `const crypto = require('crypto');
const express = require('express');

const app = express();

// Webhook secret from dashboard
const WEBHOOK_SECRET = process.env.KOB_WEBHOOK_SECRET;

app.post('/webhooks/kob', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-kob-signature'];
  const payload = req.body.toString();
  
  // Generate expected signature
  const expectedSignature = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');
  
  // Compare signatures (use timing-safe comparison)
  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    console.log('Invalid signature');
    return res.status(401).send('Invalid signature');
  }
  
  // Signature is valid, process the webhook
  const event = JSON.parse(payload);
  
  // Handle the event
  switch (event.event) {
    case 'payment.completed':
      handlePaymentCompleted(event.data);
      break;
    case 'payment.failed':
      handlePaymentFailed(event.data);
      break;
    // ... handle other events
  }
  
  // Acknowledge receipt
  res.status(200).json({ received: true });
});

function handlePaymentCompleted(payment) {
  console.log('Payment completed:', payment.payment_id);
  // Update your database, notify user, etc.
}

function handlePaymentFailed(payment) {
  console.log('Payment failed:', payment.payment_id);
  // Handle failure, refund, notify user, etc.
}`
                },
                {
                  language: "python",
                  label: "Python",
                  code: `import hmac
import hashlib
from flask import Flask, request, jsonify

app = Flask(__name__)

WEBHOOK_SECRET = 'your_webhook_secret'

@app.route('/webhooks/kob', methods=['POST'])
def webhook_handler():
    # Get signature from header
    signature = request.headers.get('X-KOB-Signature')
    
    # Get raw body
    payload = request.get_data()
    
    # Generate expected signature
    expected_signature = hmac.new(
        WEBHOOK_SECRET.encode(),
        payload,
        hashlib.sha256
    ).hexdigest()
    
    # Verify signature
    if not hmac.compare_digest(signature, expected_signature):
        return jsonify({'error': 'Invalid signature'}), 401
    
    # Parse event
    event = request.json
    
    # Handle event
    if event['event'] == 'payment.completed':
        handle_payment_completed(event['data'])
    elif event['event'] == 'payment.failed':
        handle_payment_failed(event['data'])
    
    return jsonify({'received': True}), 200

def handle_payment_completed(payment):
    print(f"Payment completed: {payment['payment_id']}")
    # Update database, notify user, etc.

def handle_payment_failed(payment):
    print(f"Payment failed: {payment['payment_id']}")
    # Handle failure, refund, notify user, etc.`
                },
                {
                  language: "go",
                  label: "Go",
                  code: `package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"log"
	"net/http"
)

var webhookSecret = []byte("your_webhook_secret")

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	signature := r.Header.Get("X-KOB-Signature")
	payload, _ := io.ReadAll(r.Body)

	mac := hmac.New(sha256.New, webhookSecret)
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))

	if !hmac.Equal([]byte(signature), []byte(expected)) {
		http.Error(w, "Invalid signature", http.StatusUnauthorized)
		return
	}

	var event map[string]interface{}
	json.Unmarshal(payload, &event)
	log.Printf("Event: %s", event["event"])

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]bool{"received": true})
}

func main() {
	http.HandleFunc("/webhooks/kob", webhookHandler)
	log.Fatal(http.ListenAndServe(":3000", nil))
}`
                },
                {
                  language: "java",
                  label: "Java",
                  code: `import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import javax.servlet.http.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

public class WebhookServlet extends HttpServlet {
    private static final String WEBHOOK_SECRET = System.getenv("KOB_WEBHOOK_SECRET");

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp)
            throws IOException {
        String signature = req.getHeader("X-KOB-Signature");
        String payload = new String(req.getInputStream().readAllBytes(),
                StandardCharsets.UTF_8);

        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(
                    WEBHOOK_SECRET.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] hash = mac.doFinal(payload.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder();
            for (byte b : hash) hex.append(String.format("%02x", b));

            if (!signature.equals(hex.toString())) {
                resp.setStatus(401);
                resp.getWriter().write("{\"error\":\"Invalid signature\"}");
                return;
            }
        } catch (Exception e) {
            resp.setStatus(500);
            return;
        }

        // Process event
        System.out.println("Webhook received: " + payload);
        resp.setStatus(200);
        resp.getWriter().write("{\"received\":true}");
    }
}`
                }
              ]}
            />
          </CardContent>
        </Card>
      </div>

      {/* Retry Policy */}
      <Card>
        <CardHeader>
          <CardTitle>Retry Policy</CardTitle>
          <CardDescription>Understanding how webhook delivery retries work</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>If your endpoint doesn't respond with a 2xx status code, we will retry the webhook delivery:</p>
          <ul className="list-disc list-inside space-y-2 ml-4">
            <li>1st retry: After 1 minute</li>
            <li>2nd retry: After 5 minutes</li>
            <li>3rd retry: After 30 minutes</li>
            <li>4th retry: After 2 hours</li>
            <li>5th retry: After 6 hours</li>
          </ul>
          <p className="text-sm text-muted-foreground">
            After 5 failed attempts, the webhook will be marked as failed and you'll receive an email notification.
          </p>
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Implement Idempotency:</strong> Your webhook handler should be idempotent to handle duplicate deliveries gracefully.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Testing */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Testing Webhooks</h2>
        
        <Card>
          <CardHeader>
            <CardTitle>Local Testing with ngrok</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p>Use ngrok to expose your local development server for webhook testing:</p>
            <CodeBlock
              examples={[
                {
                  language: "bash",
                  code: `# Install ngrok
npm install -g ngrok

# Start your local server
node server.js

# In another terminal, start ngrok
ngrok http 3000

# Copy the HTTPS URL (e.g., https://abc123.ngrok.io)
# Add this URL to your webhook configuration in the dashboard`
                }
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Manual Webhook Testing</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">Trigger test webhooks from the Developer Dashboard:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Navigate to Settings → Webhooks</li>
              <li>Click on your webhook endpoint</li>
              <li>Click "Send Test Event"</li>
              <li>Select the event type to test</li>
              <li>Review the delivery in the webhook logs</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Webhook Best Practices</CardTitle>
          <CardDescription>Ensure reliable webhook handling</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Verify Signatures Always</p>
              <p className="text-sm text-muted-foreground">Never skip signature verification to prevent malicious requests</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Respond Quickly</p>
              <p className="text-sm text-muted-foreground">Acknowledge webhooks within 5 seconds. Process heavy tasks asynchronously.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Handle Duplicates</p>
              <p className="text-sm text-muted-foreground">Implement idempotency using event IDs to handle duplicate deliveries</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Log Everything</p>
              <p className="text-sm text-muted-foreground">Log all webhook events for debugging and audit purposes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
            <div>
              <p className="font-semibold">Monitor Your Endpoint</p>
              <p className="text-sm text-muted-foreground">Set up alerts for webhook failures to catch issues quickly</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
