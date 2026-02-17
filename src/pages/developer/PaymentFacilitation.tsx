import { DeveloperLayout } from "@/components/developer/DeveloperLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { CheckCircle2, Wallet, Shield, Zap } from "lucide-react";

const PaymentFacilitation = () => {
  return (
    <DeveloperLayout>
      <div className="space-y-8">
        {/* Hero Section */}
        <div>
          <Badge className="mb-4">White-Label Payment Processing</Badge>
          <h1 className="text-4xl font-bold mb-4">KOB Payment Facilitation</h1>
          <p className="text-xl text-muted-foreground max-w-3xl">
            Process payments using Kang Open Banking's payment infrastructure. No need for your own payment gateway account - start accepting payments immediately.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <Zap className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Instant Integration</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No payment gateway account needed. Start processing payments in minutes with our facilitated endpoints.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Shield className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>No KYB Delays</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Skip the lengthy KYB verification process. Use our pre-verified business account immediately.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Wallet className="h-8 w-8 mb-2 text-primary" />
              <CardTitle>Automated Settlements</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Receive automatic payouts to your bank or mobile money account on your chosen schedule.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card>
          <CardHeader>
            <CardTitle>How Payment Facilitation Works</CardTitle>
            <CardDescription>Simple 4-step process</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                1
              </div>
              <div>
                <h3 className="font-semibold mb-1">Enable KOB Facilitation</h3>
                <p className="text-sm text-muted-foreground">
                  When registering as a Developer or Fintech, select the option to use KOB's payment facilitation.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                2
              </div>
              <div>
                <h3 className="font-semibold mb-1">Configure Settlement Details</h3>
                <p className="text-sm text-muted-foreground">
                  Set up your bank account or mobile money number for receiving settlements. Choose your settlement frequency (daily, weekly, or monthly).
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                3
              </div>
              <div>
                <h3 className="font-semibold mb-1">Use Facilitated Endpoints</h3>
                <p className="text-sm text-muted-foreground">
                  Call our facilitated payment endpoints to process collections and transfers using KOB's payment gateway.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold">
                4
              </div>
              <div>
                <h3 className="font-semibold mb-1">Receive Automatic Settlements</h3>
                <p className="text-sm text-muted-foreground">
                  KOB automatically calculates your balance (inflows - outflows - fees) and sends settlements to your configured account.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Pricing */}
        <Card>
          <CardHeader>
            <CardTitle>Transparent Pricing</CardTitle>
            <CardDescription>Simple, usage-based fees</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-4 border rounded-lg">
                <div>
                  <p className="font-semibold">Standard Facilitation Fee</p>
                  <p className="text-sm text-muted-foreground">Per successful transaction</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">3.5%</p>
                  <p className="text-sm text-muted-foreground">+ 100 XAF</p>
                </div>
              </div>

              <Alert>
                <AlertDescription>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                      <span>No setup fees or monthly charges</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                      <span>Fees only charged on successful transactions</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                      <span>Free settlements - no additional payout fees</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                      <span>Volume discounts available for high-volume customers</span>
                    </li>
                  </ul>
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>

        {/* API Reference */}
        <Card>
          <CardHeader>
            <CardTitle>API Endpoints</CardTitle>
            <CardDescription>Facilitated payment processing endpoints</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="mobile-money">
              <TabsList>
                <TabsTrigger value="mobile-money">Mobile Money Collection</TabsTrigger>
                <TabsTrigger value="bank-transfer">Bank Transfer</TabsTrigger>
                <TabsTrigger value="settlement">Settlement</TabsTrigger>
              </TabsList>

              <TabsContent value="mobile-money" className="space-y-4">
                <ApiEndpoint
                  method="POST"
                  endpoint="/facilitated-mobile-money-charge"
                  description="Initiate a mobile money collection using KOB's payment gateway"
                />

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "phone_number": "237677123456",
  "amount": 5000,
  "currency": "XAF",
  "email": "customer@example.com",
  "redirect_url": "https://yoursite.com/payment/callback",
  "metadata": {
    "order_id": "ORD-12345",
    "customer_name": "John Doe"
  }
}`
                    }]}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "success": true,
  "transaction_ref": "KOB-MM-1234567890-ABC123",
  "transaction_id": "uuid",
  "payment_link": "https://payment.kangob.com/pay/...",
  "kob_fee_amount": 175,
  "net_amount": 4825
}`
                    }]}
                  />
                </div>
              </TabsContent>

              <TabsContent value="bank-transfer" className="space-y-4">
                <ApiEndpoint
                  method="POST"
                  endpoint="/facilitated-bank-transfer"
                  description="Initiate a bank transfer using KOB's payment gateway"
                />

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "account_bank": "ACCESS",
  "account_number": "1234567890",
  "amount": 10000,
  "currency": "XAF",
  "narration": "Payment for services",
  "beneficiary_name": "Jane Doe",
  "metadata": {
    "invoice_id": "INV-98765"
  }
}`
                    }]}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "success": true,
  "transaction_ref": "KOB-BT-1234567890-XYZ789",
  "transaction_id": "uuid",
  "transfer_id": 12345,
  "kob_fee_amount": 250,
  "net_amount": 9750,
  "status": "processing"
}`
                    }]}
                  />
                </div>
              </TabsContent>

              <TabsContent value="settlement" className="space-y-4">
                <ApiEndpoint
                  method="POST"
                  endpoint="/settlement-calculate"
                  description="Calculate your current settlement balance"
                />

                <div>
                  <h4 className="font-semibold mb-2">Request Body</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "period_start": "2026-01-01T00:00:00Z",
  "period_end": "2026-01-31T23:59:59Z"
}`
                    }]}
                  />
                </div>

                <div>
                  <h4 className="font-semibold mb-2">Response</h4>
                  <CodeBlock
                    examples={[{
                      language: "json",
                      code: `{
  "success": true,
  "institution_id": "uuid",
  "institution_name": "Your Institution",
  "period_start": "2026-01-01T00:00:00Z",
  "period_end": "2026-01-31T23:59:59Z",
  "total_inflows": 500000,
  "total_outflows": 150000,
  "total_kob_fees": 8750,
  "net_settlement_amount": 341250,
  "transaction_count": 58,
  "meets_minimum_threshold": true,
  "can_settle": true
}`
                    }]}
                  />
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Code Example */}
        <Card>
          <CardHeader>
            <CardTitle>Integration Example</CardTitle>
            <CardDescription>TypeScript/JavaScript implementation</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[{
                language: "typescript",
                code: `import { supabase } from '@/integrations/supabase/client';

// Initiate a facilitated mobile money collection
async function collectPayment(phoneNumber: string, amount: number) {
  try {
    const { data, error } = await supabase.functions.invoke(
      'facilitated-mobile-money-charge',
      {
        body: {
          phone_number: phoneNumber,
          amount: amount,
          currency: 'XAF',
          email: 'customer@example.com',
          redirect_url: 'https://yoursite.com/payment/callback',
          metadata: {
            order_id: 'ORD-12345'
          }
        }
      }
    );

    if (error) throw error;

    console.log('Payment initiated:', data);
    console.log('KOB Fee:', data.kob_fee_amount, 'XAF');
    console.log('Net Amount:', data.net_amount, 'XAF');
    
    // Redirect customer to payment page
    if (data.payment_link) {
      window.location.href = data.payment_link;
    }
  } catch (error) {
    console.error('Payment failed:', error);
  }
}

// Check settlement balance
async function checkSettlementBalance() {
  try {
    const { data, error } = await supabase.functions.invoke(
      'settlement-calculate',
      {
        body: {
          period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString()
        }
      }
    );

    if (error) throw error;

    console.log('Settlement Balance:', data.net_settlement_amount, 'XAF');
    console.log('Total KOB Fees:', data.total_kob_fees, 'XAF');
    console.log('Can Settle:', data.can_settle);
  } catch (error) {
    console.error('Failed to check balance:', error);
  }
}`
              }]}
            />
          </CardContent>
        </Card>
      </div>
    </DeveloperLayout>
  );
};

export default PaymentFacilitation;