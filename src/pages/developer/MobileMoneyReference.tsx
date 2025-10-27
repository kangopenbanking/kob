import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function MobileMoneyReference() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Mobile Money API Reference</h1>
        <p className="text-xl text-muted-foreground">
          Integrate MTN Mobile Money, Orange Money, and Express Union across Cameroon
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Mobile money transactions are processed in XAF (Central African Franc). Supported providers: MTN, Orange, Express Union.
        </AlertDescription>
      </Alert>

      {/* Supported Providers */}
      <Card>
        <CardHeader>
          <CardTitle>Supported Providers</CardTitle>
          <CardDescription>Mobile money operators available in Cameroon</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Badge variant="outline" className="text-base px-4 py-2">
              <span className="text-yellow-600 dark:text-yellow-400 font-bold mr-2">MTN</span> Mobile Money
            </Badge>
            <Badge variant="outline" className="text-base px-4 py-2">
              <span className="text-orange-600 dark:text-orange-400 font-bold mr-2">Orange</span> Money
            </Badge>
            <Badge variant="outline" className="text-base px-4 py-2">
              <span className="text-blue-600 dark:text-blue-400 font-bold mr-2">Express</span> Union
            </Badge>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Phone numbers must be in format: <code className="bg-muted px-2 py-1 rounded">237XXXXXXXXX</code> (e.g., 237677123456)
          </p>
        </CardContent>
      </Card>

      {/* Charge Customer */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Collect Payments</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/mobile-money-charge"
          description="Initiate a mobile money collection from a customer's wallet"
          requestBody={`{
  "amount": 5000,
  "currency": "XAF",
  "phone_number": "237677123456",
  "provider": "mtn",
  "email": "customer@example.com",
  "tx_ref": "order_12345",
  "fullname": "John Doe"
}`}
          response={`{
  "status": "success",
  "message": "Charge initiated successfully",
  "data": {
    "id": 4534334,
    "tx_ref": "order_12345",
    "flw_ref": "FLW-MOCK-1234567890",
    "amount": 5000,
    "currency": "XAF",
    "payment_type": "mobilemoneycm",
    "status": "pending",
    "created_at": "2025-10-27T10:00:00Z"
  }
}`}
        />

        <div className="my-4 p-4 bg-muted rounded-lg">
          <p className="font-semibold mb-2">Customer Experience:</p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>Customer receives USSD push notification on their phone</li>
            <li>Customer enters their mobile money PIN to authorize payment</li>
            <li>Payment is processed and both parties receive confirmation SMS</li>
            <li>Webhook notification sent to your server with final status</li>
          </ol>
        </div>
      </div>

      {/* Verify Transaction */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Verify Transactions</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/mobile-money-verify"
          description="Verify the status of a mobile money transaction"
          requestBody={`{
  "transaction_id": "4534334"
}`}
          response={`{
  "status": "success",
  "message": "Transaction verified successfully",
  "data": {
    "id": 4534334,
    "tx_ref": "order_12345",
    "flw_ref": "FLW-MOCK-1234567890",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "payment_type": "mobilemoneycm",
    "created_at": "2025-10-27T10:00:00Z",
    "customer": {
      "phone_number": "237677123456",
      "email": "customer@example.com",
      "name": "John Doe"
    }
  }
}`}
        />
      </div>

      {/* Send Money (Disbursements) */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Send Money (Disbursements)</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/mobile-money-transfer"
          description="Send money to a mobile money wallet (payouts/disbursements)"
          requestBody={`{
  "amount": 10000,
  "currency": "XAF",
  "recipient_phone": "237677123456",
  "provider": "mtn",
  "reference": "payout_67890",
  "narration": "Commission Payment"
}`}
          response={`{
  "status": "success",
  "message": "Transfer initiated successfully",
  "data": {
    "transfer_id": "txn_98765",
    "amount": 10000,
    "currency": "XAF",
    "recipient_phone": "237677123456",
    "provider": "mtn",
    "status": "processing",
    "reference": "payout_67890",
    "created_at": "2025-10-27T10:00:00Z"
  }
}`}
        />
      </div>

      {/* Mobile Money to Bank */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Mobile Money to Bank Transfer</h2>
        
        <ApiEndpoint
          method="POST"
          endpoint="/mobile-money-to-bank"
          description="Transfer funds from mobile money wallet to a bank account"
          requestBody={`{
  "amount": 50000,
  "currency": "XAF",
  "source_phone": "237677123456",
  "provider": "mtn",
  "bank_code": "COBACMCX",
  "account_number": "1234567890",
  "account_name": "Jane Smith",
  "reference": "MM_TO_BANK_001",
  "narration": "Savings Transfer"
}`}
          response={`{
  "status": "success",
  "message": "Transfer initiated successfully",
  "data": {
    "transfer_id": "txn_mm2bank_001",
    "amount": 50000,
    "currency": "XAF",
    "status": "processing",
    "source_phone": "237677123456",
    "destination_account": "1234567890",
    "bank_code": "COBACMCX",
    "reference": "MM_TO_BANK_001",
    "estimated_completion": "2025-10-27T14:00:00Z"
  }
}`}
        />
      </div>

      {/* Transaction Status Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction Status Codes</CardTitle>
          <CardDescription>Understanding mobile money transaction states</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <Badge className="bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20">pending</Badge>
              <p className="text-sm text-muted-foreground flex-1">Transaction initiated, waiting for customer authorization</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">successful</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment completed successfully</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20">failed</Badge>
              <p className="text-sm text-muted-foreground flex-1">Transaction failed (insufficient funds, cancelled, timeout)</p>
            </div>
            <div className="flex items-start gap-3">
              <Badge className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20">processing</Badge>
              <p className="text-sm text-muted-foreground flex-1">Payment being processed by mobile money operator</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>Webhook Notifications</CardTitle>
          <CardDescription>Receive real-time payment updates</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3">
            Configure your webhook URL to receive automatic notifications when transaction status changes:
          </p>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
            <code>{`{
  "event": "mobilemoney.charge.completed",
  "data": {
    "id": 4534334,
    "tx_ref": "order_12345",
    "flw_ref": "FLW-MOCK-1234567890",
    "amount": 5000,
    "currency": "XAF",
    "status": "successful",
    "payment_type": "mobilemoneycm",
    "customer": {
      "phone_number": "237677123456",
      "email": "customer@example.com",
      "name": "John Doe"
    },
    "created_at": "2025-10-27T10:00:00Z"
  }
}`}</code>
          </pre>
        </CardContent>
      </Card>

      {/* Error Codes */}
      <Card>
        <CardHeader>
          <CardTitle>Common Error Codes</CardTitle>
          <CardDescription>Handle these errors in your integration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div>
              <p className="font-mono text-sm font-semibold">INSUFFICIENT_BALANCE</p>
              <p className="text-sm text-muted-foreground">Customer's mobile money wallet has insufficient funds</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">INVALID_PHONE_NUMBER</p>
              <p className="text-sm text-muted-foreground">Phone number format is invalid or not registered with provider</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">TRANSACTION_TIMEOUT</p>
              <p className="text-sm text-muted-foreground">Customer did not authorize payment within timeout period (usually 2 minutes)</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">PROVIDER_ERROR</p>
              <p className="text-sm text-muted-foreground">Mobile money operator service temporarily unavailable</p>
            </div>
            <div>
              <p className="font-mono text-sm font-semibold">DAILY_LIMIT_EXCEEDED</p>
              <p className="text-sm text-muted-foreground">Transaction amount exceeds customer's daily transaction limit</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Best Practices */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle>Best Practices</CardTitle>
          <CardDescription>Optimize your mobile money integration</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-semibold mb-1">1. Always Verify Transactions</p>
            <p className="text-sm text-muted-foreground">Use the verify endpoint to confirm payment status before fulfilling orders.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">2. Implement Webhooks</p>
            <p className="text-sm text-muted-foreground">Use webhooks instead of polling to get instant payment status updates.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">3. Handle Timeouts Gracefully</p>
            <p className="text-sm text-muted-foreground">Inform customers if they don't authorize payment within 2 minutes and allow retry.</p>
          </div>
          <div>
            <p className="font-semibold mb-1">4. Validate Phone Numbers</p>
            <p className="text-sm text-muted-foreground">Ensure phone numbers match the provider (MTN starts with 67, Orange with 69).</p>
          </div>
          <div>
            <p className="font-semibold mb-1">5. Test in Sandbox First</p>
            <p className="text-sm text-muted-foreground">Use test phone numbers in sandbox to verify your integration before going live.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
