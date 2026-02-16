import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Database, Shield, Clock, CheckCircle2 } from "lucide-react";

export default function AISP() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/documentation" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Database className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Account Information Services</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">Account Information Service Provider (AISP)</h1>
          <p className="text-xl text-muted-foreground">
            Securely access customer account data with explicit consent to build innovative financial services
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">What is AISP?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                An Account Information Service Provider (AISP) is an authorized third party service provider that accesses customer account information from banks and financial institutions through secure APIs. AISPs must obtain explicit customer consent before accessing any account data.
              </p>
              <p className="text-muted-foreground">
                Common AISP use cases include budgeting apps, financial dashboards, credit scoring services, and account aggregation platforms.
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Core Capabilities</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Account Details
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Retrieve comprehensive account information including account holder details, account type, currency, and status.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/accounts
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Balance Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access real-time balance information including available balance, current balance, and overdraft limits.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/balances/:accountId
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Transaction History
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Fetch detailed transaction history with filtering by date range, transaction type, and amount ranges.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/transactions/:accountId
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
                  View active and scheduled standing orders including frequency, amount, and beneficiary information.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/standing-orders/:accountId
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Direct Debits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Access direct debit mandates and payment history for comprehensive financial management.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/direct-debits/:accountId
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Beneficiaries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Retrieve list of saved beneficiaries and payees for quick payment initiation and analysis.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  GET /aisp/beneficiaries/:accountId
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-6 w-6 text-primary" />
                Consent Management
              </CardTitle>
              <CardDescription>AISP operations require explicit customer consent</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="font-semibold text-lg mb-3">Creating Consent</h3>
                <p className="text-muted-foreground mb-4">
                  Before accessing any account information, you must create a consent request that specifies the data you need and how long you need access.
                </p>
                <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                <pre className="font-mono text-sm">{`POST /v1/aisp/consents
Authorization: Bearer {access_token}
Content-Type: application/json
x-consent-id: consent_abc123

{
  "permissions": [
    "ReadAccountsDetail",
    "ReadBalances",
    "ReadTransactionsDetail"
  ],
  "expirationDateTime": "2026-12-31T23:59:59Z",
  "transactionFromDateTime": "2025-01-01T00:00:00Z",
  "transactionToDateTime": "2026-12-31T23:59:59Z"
}`}</pre>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-lg mb-3">Consent Permissions</h3>
                <div className="space-y-2">
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadAccountsBasic</p>
                    <p className="text-sm text-muted-foreground">Read basic account information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadAccountsDetail</p>
                    <p className="text-sm text-muted-foreground">Read detailed account information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadBalances</p>
                    <p className="text-sm text-muted-foreground">Read account balances</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadTransactionsBasic</p>
                    <p className="text-sm text-muted-foreground">Read basic transaction information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadTransactionsDetail</p>
                    <p className="text-sm text-muted-foreground">Read detailed transaction information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadStandingOrdersDetail</p>
                    <p className="text-sm text-muted-foreground">Read standing order information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadDirectDebits</p>
                    <p className="text-sm text-muted-foreground">Read direct debit information</p>
                  </div>
                  <div className="border rounded-lg p-3">
                    <p className="font-medium">ReadBeneficiariesDetail</p>
                    <p className="text-sm text-muted-foreground">Read beneficiary information</p>
                  </div>
                </div>
              </div>

              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                <p className="text-sm font-semibold mb-1 flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Consent Expiration
                </p>
                <p className="text-sm text-muted-foreground">
                  Consents automatically expire after the specified duration. Maximum consent duration is 90 days. After expiration, customers must re-authorize access.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Integration Flow</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">1</span>
                  <div>
                    <p className="font-semibold">Register as AISP</p>
                    <p className="text-sm text-muted-foreground">Complete TPP registration and obtain your AISP credentials</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">2</span>
                  <div>
                    <p className="font-semibold">Create Consent Request</p>
                    <p className="text-sm text-muted-foreground">Specify which permissions you need and for how long</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">3</span>
                  <div>
                    <p className="font-semibold">Redirect for Authorization</p>
                    <p className="text-sm text-muted-foreground">Customer authenticates and authorizes consent through their bank</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">4</span>
                  <div>
                    <p className="font-semibold">Access Account Data</p>
                    <p className="text-sm text-muted-foreground">Use the authorized consent to make AISP API calls</p>
                  </div>
                </li>
                <li className="flex gap-4">
                  <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-semibold">5</span>
                  <div>
                    <p className="font-semibold">Handle Consent Lifecycle</p>
                    <p className="text-sm text-muted-foreground">Monitor expiration and handle revocation appropriately</p>
                  </div>
                </li>
              </ol>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex gap-4">
            <Link to="/documentation" className="flex-1">
              <Button variant="outline" className="w-full">Back to Documentation</Button>
            </Link>
            <Link to="/guides/pisp" className="flex-1">
              <Button className="w-full">Next: PISP Guide</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
