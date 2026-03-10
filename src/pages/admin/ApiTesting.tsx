import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, Copy, CheckCircle2 } from "lucide-react";

const API_ENDPOINTS = [
  // AISP
  { name: "AISP Accounts", path: "aisp-accounts", displayPath: "/v1/aisp/accounts", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Balances", path: "aisp-balances", displayPath: "/v1/aisp/accounts/{accountId}/balances", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Transactions", path: "aisp-transactions", displayPath: "/v1/aisp/accounts/{accountId}/transactions", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Create Consent", path: "aisp-create-consent", displayPath: "/v1/aisp/consents", method: "POST", category: "AISP", requiresAuth: true },

  // PISP
  { name: "PISP Create Consent", path: "pisp-create-consent", displayPath: "/v1/pisp/consents", method: "POST", category: "PISP", requiresAuth: true },
  { name: "PISP Domestic Payment", path: "pisp-domestic-payment", displayPath: "/v1/pisp/domestic-payments", method: "POST", category: "PISP", requiresAuth: true },
  { name: "PISP Payment Submission", path: "pisp-payment-submission", displayPath: "/v1/pisp/payment-submissions", method: "POST", category: "PISP", requiresAuth: true },
  { name: "PISP Payment Details", path: "pisp-payment-details", displayPath: "/v1/pisp/domestic-payments/{paymentId}", method: "GET", category: "PISP", requiresAuth: true },
  { name: "Bulk Transfers", path: "bulk-transfers", displayPath: "/v1/pisp/bulk-transfers", method: "POST", category: "PISP", requiresAuth: true },

  // Payments
  { name: "Mobile Money Charge", path: "mobile-money-charge", displayPath: "/v1/mobile-money/charge", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Mobile Money Verify", path: "mobile-money-verify", displayPath: "/v1/mobile-money/verify", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Mobile Money Transfer", path: "mobile-money-transfer", displayPath: "/v1/mobile-money/transfer", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Mobile Money to Bank", path: "mobile-money-to-bank", displayPath: "/v1/mobile-money/to-bank", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Bank Transfer", path: "flutterwave-bank-transfer", displayPath: "/v1/payments/bank-transfer", method: "POST", category: "Payments", requiresAuth: true },

  // Credit
  { name: "Credit Score Fetch", path: "credit-score-fetch", displayPath: "/v1/credit/score", method: "GET", category: "Credit", requiresAuth: true },
  { name: "Credit Score Calculate", path: "credit-score-calculate", displayPath: "/v1/credit/score/calculate", method: "POST", category: "Credit", requiresAuth: true },
  { name: "Credit Report Generate", path: "credit-report-generate", displayPath: "/v1/credit/report", method: "POST", category: "Credit", requiresAuth: true },

  // Loans
  { name: "Loan Apply", path: "loan-apply", displayPath: "/v1/loans/apply", method: "POST", category: "Loans", requiresAuth: true },
  { name: "Loan Calculate", path: "loan-calculate", displayPath: "/v1/loans/calculate", method: "POST", category: "Loans", requiresAuth: false },
  { name: "Loan Repay", path: "loan-repay", displayPath: "/v1/loans/repay", method: "POST", category: "Loans", requiresAuth: true },
  { name: "Loan Approve", path: "loan-approve", displayPath: "/v1/loans/approve", method: "POST", category: "Loans", requiresAuth: true },
  { name: "Loan Disburse", path: "loan-disburse", displayPath: "/v1/loans/disburse", method: "POST", category: "Loans", requiresAuth: true },

  // Savings
  { name: "Savings Create", path: "savings-create", displayPath: "/v1/savings/create", method: "POST", category: "Savings", requiresAuth: true },
  { name: "Savings Deposit", path: "savings-deposit", displayPath: "/v1/savings/deposit", method: "POST", category: "Savings", requiresAuth: true },
  { name: "Savings Withdraw", path: "savings-withdraw", displayPath: "/v1/savings/withdraw", method: "POST", category: "Savings", requiresAuth: true },
  { name: "Savings Accrue Interest", path: "savings-accrue-interest", displayPath: "/v1/savings/accrue-interest", method: "POST", category: "Savings", requiresAuth: true },

  // Compliance
  { name: "KYC Submit", path: "kyc-submit", displayPath: "/v1/compliance/kyc/submit", method: "POST", category: "Compliance", requiresAuth: true },
  { name: "Business KYC Submit", path: "business-kyc-submit", displayPath: "/v1/compliance/kyc/business", method: "POST", category: "Compliance", requiresAuth: true },
  { name: "Sanctions Screen", path: "sanctions-screen", displayPath: "/v1/compliance/sanctions/screen", method: "POST", category: "Compliance", requiresAuth: true },

  // Cards
  { name: "Virtual Card Create", path: "virtual-cards", displayPath: "/v1/cards/create", method: "POST", category: "Cards", requiresAuth: true },
  { name: "Virtual Card List", path: "virtual-cards", displayPath: "/v1/cards/list", method: "GET", category: "Cards", requiresAuth: true },
  { name: "Virtual Card Top Up", path: "virtual-cards", displayPath: "/v1/cards/topup", method: "POST", category: "Cards", requiresAuth: true },

  // Auth / DCR
  { name: "OAuth Token", path: "oauth-token", displayPath: "/v1/oauth/token", method: "POST", category: "Auth", requiresAuth: false },
  { name: "OAuth Authorize", path: "oauth-authorize", displayPath: "/v1/oauth/authorize", method: "POST", category: "Auth", requiresAuth: true },
  { name: "DCR Register", path: "dcr-register", displayPath: "/v1/dcr/register", method: "POST", category: "DCR", requiresAuth: false },

  // Certificates
  { name: "Certificate Upload", path: "certificate-upload", displayPath: "/v1/certificates/upload", method: "POST", category: "Certificates", requiresAuth: true },
  { name: "Certificate List", path: "certificate-list", displayPath: "/v1/certificates/list", method: "GET", category: "Certificates", requiresAuth: true },
  { name: "Certificate Revoke", path: "certificate-revoke", displayPath: "/v1/certificates/revoke", method: "POST", category: "Certificates", requiresAuth: true },

  // Ledger
  { name: "Journal Post", path: "journal-post", displayPath: "/v1/ledger/journal", method: "POST", category: "Ledger", requiresAuth: true },
  { name: "Ledger Accounts", path: "ledger-accounts", displayPath: "/v1/ledger/accounts", method: "GET", category: "Ledger", requiresAuth: true },
  { name: "Ledger Balance", path: "ledger-balance", displayPath: "/v1/ledger/accounts/{accountId}/balance", method: "GET", category: "Ledger", requiresAuth: true },

  // Admin
  { name: "Admin List Loans", path: "admin-list-loans", displayPath: "/v1/admin/loans", method: "GET", category: "Admin", requiresAuth: true },
  { name: "Admin List Savings", path: "admin-list-savings", displayPath: "/v1/admin/savings", method: "GET", category: "Admin", requiresAuth: true },
  { name: "Admin List Consents", path: "admin-list-consents", displayPath: "/v1/admin/consents", method: "GET", category: "Admin", requiresAuth: true },
  { name: "Admin Reports", path: "admin-reports", displayPath: "/v1/admin/reports", method: "GET", category: "Admin", requiresAuth: true },

  // Banking / ISO20022
  { name: "Bank Reconcile", path: "bank-reconcile", displayPath: "/v1/banking/reconcile", method: "POST", category: "Banking", requiresAuth: true },
  { name: "Bank Statement", path: "generate-bank-statement", displayPath: "/v1/banking/statement", method: "POST", category: "Banking", requiresAuth: true },

  // System
  { name: "API Health", path: "api-health", displayPath: "/v1/health", method: "GET", category: "System", requiresAuth: false },
];

const SAMPLE_PAYLOADS: Record<string, any> = {
  "aisp-create-consent": {
    Data: {
      Permissions: ["ReadAccountsBasic", "ReadAccountsDetail", "ReadBalances", "ReadTransactionsBasic"],
      ExpirationDateTime: "2026-12-31T23:59:59Z"
    }
  },
  "pisp-create-consent": {
    Data: {
      Initiation: {
        InstructedAmount: { Amount: "50000.00", Currency: "XAF" },
        CreditorAccount: { Identification: "677123456", Name: "Merchant Ltd" },
        RemittanceInformation: { Unstructured: "Invoice #12345" }
      }
    }
  },
  "mobile-money-charge": {
    amount: 5000,
    currency: "XAF",
    phone_number: "237677123456",
    provider: "mtn",
    email: "customer@example.com",
    tx_ref: "order_12345",
    fullname: "John Doe"
  },
  "credit-score-calculate": {
    user_id: "00000000-0000-0000-0000-000000000000"
  },
  "loan-apply": {
    loan_product_id: "00000000-0000-0000-0000-000000000000",
    amount: 50000,
    term_months: 12,
    purpose: "Business expansion"
  },
  "kyc-submit": {
    verification_type: "identity",
    document_type: "national_id",
    document_number: "123456789",
    first_name: "John",
    last_name: "Doe",
    date_of_birth: "1990-01-01"
  },
  "journal-post": {
    entries: [
      { account_code: "1000", debit: 50000, credit: 0, description: "Cash received" },
      { account_code: "4000", debit: 0, credit: 50000, description: "Revenue earned" }
    ],
    reference: "JE-2026-001",
    description: "Service revenue"
  }
};

export default function ApiTesting() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<typeof API_ENDPOINTS[0] | null>(null);
  const [requestBody, setRequestBody] = useState("{}");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [authToken, setAuthToken] = useState("");
  const { toast } = useToast();

  const categories = Array.from(new Set(API_ENDPOINTS.map(e => e.category)));

  const handleSelectEndpoint = (endpoint: typeof API_ENDPOINTS[0]) => {
    setSelectedEndpoint(endpoint);
    const sample = SAMPLE_PAYLOADS[endpoint.path] || {};
    setRequestBody(JSON.stringify(sample, null, 2));
    setResponse(null);
    if (endpoint.method === "POST") {
      setIdempotencyKey(crypto.randomUUID());
    } else {
      setIdempotencyKey("");
    }
  };

  const handleTest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    try {
      const body = requestBody.trim() ? JSON.parse(requestBody) : undefined;
      
      const headers: Record<string, string> = {};
      if (authToken) headers.Authorization = `Bearer ${authToken}`;
      if (idempotencyKey && selectedEndpoint.method === "POST") {
        headers["Idempotency-Key"] = idempotencyKey;
      }

      const { data, error } = await supabase.functions.invoke(
        selectedEndpoint.path,
        {
          body,
          headers: Object.keys(headers).length > 0 ? headers : undefined
        }
      );

      if (error) {
        setResponse({ error: error.message, details: error });
      } else {
        setResponse(data);
      }

      toast({
        title: "Request completed",
        description: error ? "Request failed" : "Request successful"
      });
    } catch (err: any) {
      setResponse({ error: err.message });
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">API Testing Dashboard</h1>
        <p className="text-muted-foreground">Test {API_ENDPOINTS.length} backend endpoints with sample requests</p>
      </div>

      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="flex flex-wrap gap-1">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat} className="text-xs">{cat}</TabsTrigger>
          ))}
        </TabsList>

        {categories.map(category => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid gap-2">
              {API_ENDPOINTS.filter(e => e.category === category).map(endpoint => (
                <Card
                  key={endpoint.path}
                  className={`p-4 cursor-pointer hover:bg-accent transition-colors ${
                    selectedEndpoint?.path === endpoint.path ? "border-primary" : ""
                  }`}
                  onClick={() => handleSelectEndpoint(endpoint)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge variant={endpoint.method === "GET" ? "secondary" : "default"}>
                        {endpoint.method}
                      </Badge>
                      <span className="font-mono text-sm">{endpoint.displayPath}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground hidden md:inline">{endpoint.name}</span>
                      {endpoint.requiresAuth && (
                        <Badge variant="outline">Auth Required</Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>

      {selectedEndpoint && (
        <div className="grid md:grid-cols-2 gap-6">
          <Card className="p-6 space-y-4">
            <h2 className="text-xl font-semibold">Request</h2>
            
            {selectedEndpoint.requiresAuth && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Authorization Token (Optional)</label>
                <Input
                  placeholder="Bearer token..."
                  value={authToken}
                  onChange={(e) => setAuthToken(e.target.value)}
                  type="password"
                />
              </div>
            )}

            {selectedEndpoint.method === "POST" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Idempotency-Key</label>
                <Input
                  placeholder="UUID for idempotent request..."
                  value={idempotencyKey}
                  onChange={(e) => setIdempotencyKey(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Request Body</label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(requestBody)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <Textarea
                value={requestBody}
                onChange={(e) => setRequestBody(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder={selectedEndpoint.method === "GET" ? "No body required for GET requests" : "Enter JSON payload..."}
              />
            </div>

            <Button onClick={handleTest} disabled={loading} className="w-full">
              <Play className="mr-2 h-4 w-4" />
              {loading ? "Testing..." : "Test Endpoint"}
            </Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Response</h2>
              {response && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(JSON.stringify(response, null, 2))}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="bg-muted rounded-lg p-4 min-h-[350px] overflow-auto">
              {response ? (
                <pre className="text-sm font-mono whitespace-pre-wrap">
                  {JSON.stringify(response, null, 2)}
                </pre>
              ) : (
                <p className="text-muted-foreground text-center py-20">
                  No response yet. Click "Test Endpoint" to see results.
                </p>
              )}
            </div>

            {response && !response.error && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Request successful</span>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
