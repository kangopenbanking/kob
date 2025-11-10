import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Play, Copy, CheckCircle2 } from "lucide-react";

const API_ENDPOINTS = [
  { name: "AISP Accounts", path: "/aisp-accounts", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Balances", path: "/aisp-balances", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Transactions", path: "/aisp-transactions", method: "GET", category: "AISP", requiresAuth: true },
  { name: "AISP Create Consent", path: "/aisp-create-consent", method: "POST", category: "AISP", requiresAuth: true },
  { name: "PISP Create Consent", path: "/pisp-create-consent", method: "POST", category: "PISP", requiresAuth: true },
  { name: "PISP Domestic Payment", path: "/pisp-domestic-payment", method: "POST", category: "PISP", requiresAuth: true },
  { name: "Mobile Money Charge", path: "/mobile-money-charge", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Mobile Money Transfer", path: "/mobile-money-transfer", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Bank Transfer", path: "/flutterwave-bank-transfer", method: "POST", category: "Payments", requiresAuth: true },
  { name: "Credit Score Fetch", path: "/credit-score-fetch", method: "GET", category: "Credit", requiresAuth: true },
  { name: "Credit Score Calculate", path: "/credit-score-calculate", method: "POST", category: "Credit", requiresAuth: true },
  { name: "Credit Report Generate", path: "/credit-report-generate", method: "POST", category: "Credit", requiresAuth: true },
  { name: "Loan Apply", path: "/loan-apply", method: "POST", category: "Loans", requiresAuth: true },
  { name: "Loan Calculate", path: "/loan-calculate", method: "POST", category: "Loans", requiresAuth: false },
  { name: "Loan Repay", path: "/loan-repay", method: "POST", category: "Loans", requiresAuth: true },
  { name: "Savings Create", path: "/savings-create", method: "POST", category: "Savings", requiresAuth: true },
  { name: "Savings Deposit", path: "/savings-deposit", method: "POST", category: "Savings", requiresAuth: true },
  { name: "Savings Withdraw", path: "/savings-withdraw", method: "POST", category: "Savings", requiresAuth: true },
  { name: "KYC Submit", path: "/kyc-submit", method: "POST", category: "Compliance", requiresAuth: true },
  { name: "Business KYC Submit", path: "/business-kyc-submit", method: "POST", category: "Compliance", requiresAuth: true },
  { name: "Sanctions Screen", path: "/sanctions-screen", method: "POST", category: "Compliance", requiresAuth: true },
  { name: "Virtual Card Create", path: "/virtual-card-create", method: "POST", category: "Cards", requiresAuth: true },
  { name: "Virtual Card List", path: "/virtual-card-list", method: "GET", category: "Cards", requiresAuth: true },
  { name: "Virtual Card Top Up", path: "/virtual-card-topup", method: "POST", category: "Cards", requiresAuth: true },
  { name: "Stripe Payment Intent", path: "/stripe-payment-intent", method: "POST", category: "Payments", requiresAuth: true },
  { name: "OAuth Token", path: "/oauth-token", method: "POST", category: "Auth", requiresAuth: false },
  { name: "OAuth Authorize", path: "/oauth-authorize", method: "POST", category: "Auth", requiresAuth: true },
  { name: "Certificate Upload", path: "/certificate-upload", method: "POST", category: "Certificates", requiresAuth: true },
  { name: "Certificate List", path: "/certificate-list", method: "GET", category: "Certificates", requiresAuth: true },
  { name: "API Health", path: "/api-health", method: "GET", category: "System", requiresAuth: false },
];

const SAMPLE_PAYLOADS: Record<string, any> = {
  "/aisp-create-consent": {
    permissions: ["ReadAccountsBasic", "ReadAccountsDetail", "ReadBalances", "ReadTransactionsBasic"],
    expiration_days: 90,
    account_ids: []
  },
  "/mobile-money-charge": {
    phone_number: "+237612345678",
    amount: 1000,
    currency: "XAF",
    description: "Test charge"
  },
  "/credit-score-calculate": {
    user_id: "00000000-0000-0000-0000-000000000000"
  },
  "/loan-apply": {
    loan_product_id: "00000000-0000-0000-0000-000000000000",
    amount: 50000,
    term_months: 12,
    purpose: "Business expansion"
  },
  "/kyc-submit": {
    verification_type: "identity",
    document_type: "national_id",
    document_number: "123456789",
    first_name: "John",
    last_name: "Doe",
    date_of_birth: "1990-01-01"
  }
};

export default function ApiTesting() {
  const [selectedEndpoint, setSelectedEndpoint] = useState<typeof API_ENDPOINTS[0] | null>(null);
  const [requestBody, setRequestBody] = useState("{}");
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
  };

  const handleTest = async () => {
    if (!selectedEndpoint) return;

    setLoading(true);
    try {
      const body = requestBody.trim() ? JSON.parse(requestBody) : undefined;
      
      const { data, error } = await supabase.functions.invoke(
        selectedEndpoint.path.replace("/", ""),
        {
          body,
          headers: authToken ? { Authorization: `Bearer ${authToken}` } : undefined
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
        <p className="text-muted-foreground">Test all 70+ backend endpoints with sample requests</p>
      </div>

      <Tabs defaultValue={categories[0]} className="w-full">
        <TabsList className="grid w-full grid-cols-4 lg:grid-cols-8">
          {categories.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
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
                      <span className="font-mono text-sm">{endpoint.path}</span>
                    </div>
                    {endpoint.requiresAuth && (
                      <Badge variant="outline">Auth Required</Badge>
                    )}
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
