import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Send, Shield, CheckCircle2, AlertTriangle } from "lucide-react";

export default function PISP() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/documentation" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Send className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Payment Initiation Services</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Payment Initiation Service Provider (PISP)</h1>
          <p className="text-xl text-muted-foreground">
            Initiate secure payments directly from customer bank accounts with strong customer authentication
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">What is PISP?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                A Payment Initiation Service Provider (PISP) is an authorized third party that initiates payments from customer bank accounts on their behalf. PISPs enable customers to make payments directly from their bank account without using traditional payment cards.
              </p>
              <p className="text-muted-foreground">
                Common PISP use cases include e-commerce checkout, bill payments, peer-to-peer transfers, and subscription management.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Payment Types Supported</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Domestic Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Single immediate or scheduled payments within Cameroon using XAF currency. Supports both IBAN and local account numbers.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  POST /pisp/domestic-payment
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  International Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Cross-border payments via SWIFT network with comprehensive beneficiary details and regulatory information.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  POST /pisp/international-payment
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Bulk Payments
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Process multiple payments in a single request for payroll, supplier payments, and disbursements.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  POST /pisp/bulk-payment
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Standing Orders
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Set up recurring payments with flexible schedules for subscriptions, rent, and regular transfers.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  POST /pisp/standing-order
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Payment Initiation Flow</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">1</span>
                  <div>
                    <p className="font-semibold">Create Payment Consent</p>
                    <p className="text-sm text-muted-foreground">Submit payment details and create a consent request</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">2</span>
                  <div>
                    <p className="font-semibold">Customer Authentication (SCA)</p>
                    <p className="text-sm text-muted-foreground">Customer authenticates via their bank using strong customer authentication</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">3</span>
                  <div>
                    <p className="font-semibold">Submit Payment</p>
                    <p className="text-sm text-muted-foreground">Use authorized consent to submit payment for processing</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">4</span>
                  <div>
                    <p className="font-semibold">Payment Execution</p>
                    <p className="text-sm text-muted-foreground">Bank processes payment and provides status updates</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">5</span>
                  <div>
                    <p className="font-semibold">Confirmation & Reconciliation</p>
                    <p className="text-sm text-muted-foreground">Receive payment confirmation and reconcile with webhooks</p>
                  </div>
                </li>
              </ol>

              <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mt-6">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Example: Domestic Payment Request</p>
                <pre className="font-mono text-sm">{`POST /v1/pisp/domestic-payments
Authorization: Bearer {access_token}
Content-Type: application/json
Idempotency-Key: unique-request-id-abc123

{
  "consentId": "consent_abc123",
  "instructedAmount": {
    "amount": "50000",
    "currency": "XAF"
  },
  "creditorAccount": {
    "schemeName": "IBAN",
    "identification": "CM21ABCD12340123456789012",
    "name": "Recipient Name"
  },
  "remittanceInformation": {
    "reference": "INV-2026-001",
    "unstructured": "Invoice Payment"
  }
}`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Strong Customer Authentication (SCA)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                All PISP payments require Strong Customer Authentication (SCA) to ensure security. SCA requires at least two of the following authentication factors:
              </p>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Knowledge</p>
                  <p className="text-sm text-muted-foreground">Something only the user knows (PIN, password)</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Possession</p>
                  <p className="text-sm text-muted-foreground">Something only the user has (mobile device, token)</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Inherence</p>
                  <p className="text-sm text-muted-foreground">Something the user is (fingerprint, face recognition)</p>
                </div>
              </div>
              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded mt-4">
                <p className="text-sm font-semibold mb-1">SCA Exemptions</p>
                <p className="text-sm text-muted-foreground">
                  Low-value payments under 5,000 XAF and recurring payments with existing mandates may be exempt from SCA under certain conditions.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Payment Status & Lifecycle</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                  </div>
                  <div>
                    <p className="font-medium">Initiated</p>
                    <p className="text-sm text-muted-foreground">Payment request created, awaiting authorization</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-yellow-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-yellow-500" />
                  </div>
                  <div>
                    <p className="font-medium">Pending</p>
                    <p className="text-sm text-muted-foreground">Authorized and submitted to bank for processing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-green-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                  <div>
                    <p className="font-medium">Completed</p>
                    <p className="text-sm text-muted-foreground">Payment successfully executed and funds transferred</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 border rounded-lg">
                  <div className="h-6 w-6 rounded-full bg-red-500/20 flex items-center justify-center flex-shrink-0">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                  </div>
                  <div>
                    <p className="font-medium">Failed / Rejected</p>
                    <p className="text-sm text-muted-foreground">Payment failed due to insufficient funds, validation error, or rejection</p>
                  </div>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg mt-6">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Check Payment Status</p>
                <code className="font-mono text-sm">GET /pisp/payment-details/:paymentId</code>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
                Error Handling
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="border rounded-lg p-3">
                  <p className="font-medium">INSUFFICIENT_FUNDS</p>
                  <p className="text-sm text-muted-foreground">Account balance insufficient for payment</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">INVALID_ACCOUNT</p>
                  <p className="text-sm text-muted-foreground">Beneficiary account not found or invalid</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">CONSENT_EXPIRED</p>
                  <p className="text-sm text-muted-foreground">Payment consent has expired, new authorization required</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">SCA_REQUIRED</p>
                  <p className="text-sm text-muted-foreground">Strong customer authentication needed</p>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-medium">LIMIT_EXCEEDED</p>
                  <p className="text-sm text-muted-foreground">Transaction exceeds account or regulatory limits</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex gap-4">
            <Link to="/guides/aisp" className="flex-1">
              <Button variant="outline" className="w-full">Previous: AISP Guide</Button>
            </Link>
            <Link to="/guides/security" className="flex-1">
              <Button className="w-full">Next: Security Guide</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
