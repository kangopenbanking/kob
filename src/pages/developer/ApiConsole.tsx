import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Play, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const API_ENDPOINTS = {
  AISP: [
    { value: "/v1/aisp/accounts", label: "List Accounts", method: "GET" },
    { value: "/v1/aisp/accounts/{accountId}/balances", label: "Get Balances", method: "GET" },
    { value: "/v1/aisp/accounts/{accountId}/transactions", label: "Get Transactions", method: "GET" },
    { value: "/v1/aisp/consents", label: "Create Consent", method: "POST" },
  ],
  PISP: [
    { value: "/v1/pisp/consents", label: "Create Payment Consent", method: "POST" },
    { value: "/v1/pisp/domestic-payments", label: "Initiate Domestic Payment", method: "POST" },
    { value: "/v1/pisp/payment-submissions", label: "Submit Payment", method: "POST" },
    { value: "/v1/pisp/domestic-payments/{paymentId}", label: "Get Payment Details", method: "GET" },
  ],
  "Mobile Money": [
    { value: "/v1/mobile-money/charge", label: "Charge Customer", method: "POST" },
    { value: "/v1/mobile-money/verify", label: "Verify Transaction", method: "POST" },
    { value: "/v1/mobile-money/transfer", label: "Send Money", method: "POST" },
    { value: "/v1/mobile-money/to-bank", label: "Mobile Money to Bank", method: "POST" },
  ],
  Banking: [
    { value: "/v1/banking/reconcile", label: "Reconcile Transactions", method: "POST" },
    { value: "/v1/banking/statement", label: "Generate Statement", method: "POST" },
    { value: "/v1/banking/iso20022/pain001", label: "Parse ISO 20022 Payment", method: "POST" },
    { value: "/v1/banking/swift/mt103/generate", label: "Generate SWIFT MT103", method: "POST" },
  ],
};

const EXAMPLE_BODIES = {
  "/v1/aisp/consents": JSON.stringify({
    Data: {
      Permissions: ["ReadAccountsBasic", "ReadBalances", "ReadTransactionsBasic"],
      ExpirationDateTime: "2026-12-31T23:59:59Z"
    }
  }, null, 2),
  "/v1/pisp/consents": JSON.stringify({
    Data: {
      Initiation: {
        InstructedAmount: { Amount: "50000.00", Currency: "XAF" },
        CreditorAccount: { Identification: "677123456", Name: "Merchant Ltd" },
        RemittanceInformation: { Unstructured: "Payment for Invoice #12345" }
      }
    }
  }, null, 2),
  "/v1/pisp/domestic-payments": JSON.stringify({
    Data: {
      ConsentId: "pisp_consent_xyz789",
      Initiation: {
        InstructedAmount: { Amount: "50000.00", Currency: "XAF" },
        DebtorAccount: { Identification: "677987654", Name: "John Doe" },
        CreditorAccount: { Identification: "677123456", Name: "Merchant Ltd" },
        RemittanceInformation: { Unstructured: "Payment for Invoice #12345" },
        EndToEndIdentification: "ref_001"
      }
    }
  }, null, 2),
  "/v1/mobile-money/charge": JSON.stringify({
    amount: 5000,
    currency: "XAF",
    phone_number: "237677123456",
    provider: "mtn",
    email: "customer@example.com",
    tx_ref: "order_12345",
    fullname: "John Doe"
  }, null, 2),
};

export default function ApiConsole() {
  const [apiCategory, setApiCategory] = useState("AISP");
  const [endpoint, setEndpoint] = useState("");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState("Authorization: Bearer YOUR_ACCESS_TOKEN\nx-consent-id: YOUR_CONSENT_ID\nIdempotency-Key: 550e8400-e29b-41d4-a716-446655440000");
  const [body, setBody] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleEndpointChange = (value: string) => {
    setEndpoint(value);
    const selectedEndpoint = API_ENDPOINTS[apiCategory as keyof typeof API_ENDPOINTS].find(e => e.value === value);
    if (selectedEndpoint) {
      setMethod(selectedEndpoint.method);
      if (selectedEndpoint.method === "POST" && EXAMPLE_BODIES[value as keyof typeof EXAMPLE_BODIES]) {
        setBody(EXAMPLE_BODIES[value as keyof typeof EXAMPLE_BODIES]);
      } else {
        setBody("");
      }
    }
  };

  const handleExecute = async () => {
    setLoading(true);
    setResponse("");

    try {
      // Parse headers
      const headersObj: Record<string, string> = {};
      headers.split('\n').forEach(line => {
        const [key, ...valueParts] = line.split(':');
        if (key && valueParts.length) {
          headersObj[key.trim()] = valueParts.join(':').trim();
        }
      });

      // Simulate API call (in production, this would be a real API call)
      await new Promise(resolve => setTimeout(resolve, 1000));

      const mockResponse = {
        status: 200,
        statusText: "OK",
        data: {
          message: "This is a simulated response. In production, this would call the actual API.",
          endpoint: endpoint,
          method: method,
          timestamp: new Date().toISOString()
        }
      };

      setResponse(JSON.stringify(mockResponse, null, 2));
      toast.success("Request executed successfully");
    } catch (error) {
      setResponse(JSON.stringify({ error: "Request failed", details: error }, null, 2));
      toast.error("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Copied to clipboard");
  };

  const generateCurl = () => {
    const headersArray = headers.split('\n').filter(h => h.trim());
    const headerFlags = headersArray.map(h => `-H "${h.trim()}"`).join(' \\\n  ');
    
    let curl = `curl -X ${method} https://api.kangopenbanking.com/v1${endpoint}`;
    if (headerFlags) {
      curl += ` \\\n  ${headerFlags}`;
    }
    if (body && method !== "GET") {
      curl += ` \\\n  -d '${body}'`;
    }
    
    return curl;
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">API Console</h1>
        <p className="text-xl text-muted-foreground">
          Test API endpoints interactively and generate code examples
        </p>
      </div>

      <Alert>
        <AlertDescription>
          <strong>Sandbox Mode:</strong> You're testing against the sandbox environment. Use test credentials and data only.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Request Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Request Configuration</CardTitle>
            <CardDescription>Configure your API request</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>API Category</Label>
              <Select value={apiCategory} onValueChange={setApiCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AISP">AISP (Account Information)</SelectItem>
                  <SelectItem value="PISP">PISP (Payment Initiation)</SelectItem>
                  <SelectItem value="Mobile Money">Mobile Money</SelectItem>
                  <SelectItem value="Banking">Banking Operations</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Endpoint</Label>
              <Select value={endpoint} onValueChange={handleEndpointChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select an endpoint" />
                </SelectTrigger>
                <SelectContent>
                  {API_ENDPOINTS[apiCategory as keyof typeof API_ENDPOINTS].map(ep => (
                    <SelectItem key={ep.value} value={ep.value}>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{ep.method}</Badge>
                        {ep.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {endpoint && (
              <>
                <div className="space-y-2">
                  <Label>Full URL</Label>
                  <Input 
                    value={`https://api.kangopenbanking.com/v1${endpoint}`}
                    readOnly
                    className="font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Headers</Label>
                  <Textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    placeholder="Authorization: Bearer token"
                    className="font-mono text-sm"
                    rows={3}
                  />
                </div>

                {method !== "GET" && (
                  <div className="space-y-2">
                    <Label>Request Body</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Request body (JSON)"
                      className="font-mono text-sm"
                      rows={10}
                    />
                  </div>
                )}

                <Button onClick={handleExecute} disabled={loading} className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? "Executing..." : "Execute Request"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Response */}
        <Card>
          <CardHeader>
            <CardTitle>Response</CardTitle>
            <CardDescription>API response will appear here</CardDescription>
          </CardHeader>
          <CardContent>
            {response ? (
              <div className="space-y-2">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(response)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                  <code>{response}</code>
                </pre>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Execute a request to see the response
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Code Generation */}
      {endpoint && (
        <Card>
          <CardHeader>
            <CardTitle>Code Examples</CardTitle>
            <CardDescription>Copy and use in your application</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              
              <TabsContent value="curl" className="mt-4">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(generateCurl())}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{generateCurl()}</code>
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="javascript" className="mt-4">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`const response = await fetch('https://api.kangopenbanking.com/v1${endpoint}', {
  method: '${method}',
  headers: {
${headers.split('\n').map(h => {
  const [key, ...value] = h.split(':');
  return `    '${key.trim()}': '${value.join(':').trim()}'`;
}).join(',\n')}
  }${method !== "GET" && body ? `,\n  body: JSON.stringify(${body})` : ''}
});

const data = await response.json();
console.log(data);`)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{`const response = await fetch('https://api.kangopenbanking.com/v1${endpoint}', {
  method: '${method}',
  headers: {
${headers.split('\n').map(h => {
  const [key, ...value] = h.split(':');
  return `    '${key.trim()}': '${value.join(':').trim()}'`;
}).join(',\n')}
  }${method !== "GET" && body ? `,\n  body: JSON.stringify(${body})` : ''}
});

const data = await response.json();
console.log(data);`}</code>
                  </pre>
                </div>
              </TabsContent>

              <TabsContent value="python" className="mt-4">
                <div className="relative">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="absolute top-2 right-2"
                    onClick={() => copyToClipboard(`import requests

headers = {
${headers.split('\n').map(h => {
  const [key, ...value] = h.split(':');
  return `    '${key.trim()}': '${value.join(':').trim()}'`;
}).join(',\n')}
}

${method !== "GET" && body ? `data = ${body}\n\n` : ''}response = requests.${method.toLowerCase()}(
    'https://api.kangopenbanking.com/v1${endpoint}',
    headers=headers${method !== "GET" && body ? ',\n    json=data' : ''}
)

print(response.json())`)}
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                    <code>{`import requests

headers = {
${headers.split('\n').map(h => {
  const [key, ...value] = h.split(':');
  return `    '${key.trim()}': '${value.join(':').trim()}'`;
}).join(',\n')}
}

${method !== "GET" && body ? `data = ${body}\n\n` : ''}response = requests.${method.toLowerCase()}(
    'https://api.kangopenbanking.com/v1${endpoint}',
    headers=headers${method !== "GET" && body ? ',\n    json=data' : ''}
)

print(response.json())`}</code>
                  </pre>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      <AutoDocNavigation />
    </div>
  );
}
