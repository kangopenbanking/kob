import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Code, Database, TestTube, Send, Loader2, FileText, Shield, Key, BookOpen, CheckCircle2, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const API_BASE_URL = 'https://api.kangopenbanking.com/v1';

const Developer = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [institutions, setInstitutions] = useState<any[]>([]);
  const [selectedInstitution, setSelectedInstitution] = useState("");
  
  // API Testing State
  const [endpoint, setEndpoint] = useState("/aisp-accounts");
  const [method, setMethod] = useState("GET");
  const [headers, setHeaders] = useState('{\n  "Authorization": "Bearer YOUR_TOKEN",\n  "x-consent-id": "CONSENT_ID"\n}');
  const [body, setBody] = useState("{}");
  const [response, setResponse] = useState("");
  
  // Sandbox Data State
  const [dataType, setDataType] = useState("account");
  const [sandboxData, setSandboxData] = useState<any[]>([]);
  
  // API Keys state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchInstitutions();
    fetchSandboxData();
  }, []);

  const fetchInstitutions = async () => {
    const { data } = await supabase
      .from("institutions")
      .select("*")
      .eq("status", "approved");
    if (data) setInstitutions(data);
  };

  const fetchSandboxData = async () => {
    const { data } = await supabase
      .from("sandbox_data")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(10);
    if (data) setSandboxData(data);
  };

  const handleTestRequest = async () => {
    if (!selectedInstitution) {
      toast({
        title: "Institution Required",
        description: "Please select an institution first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: registration } = await supabase
        .from("tpp_registrations")
        .select("client_id")
        .eq("institution_id", selectedInstitution)
        .single();

      const parsedHeaders = JSON.parse(headers);
      const startTime = Date.now();

      // Simulate API request
      const testResponse = {
        status: 200,
        headers: { "content-type": "application/json" },
        body: {
          Data: {
            Account: [
              {
                AccountId: "account-001",
                Status: "Enabled",
                Currency: "XAF",
                AccountType: "Personal",
                AccountSubType: "Current"
              }
            ]
          }
        }
      };

      const responseTime = Date.now() - startTime;

      await supabase.from("api_test_requests").insert({
        institution_id: selectedInstitution,
        client_id: registration?.client_id || "unknown",
        endpoint,
        method,
        request_headers: parsedHeaders,
        request_body: method !== "GET" ? JSON.parse(body) : null,
        response_status: testResponse.status,
        response_headers: testResponse.headers,
        response_body: testResponse.body,
        response_time_ms: responseTime
      });

      setResponse(JSON.stringify(testResponse, null, 2));
      
      toast({
        title: "Request Successful",
        description: `Response received in ${responseTime}ms`
      });
    } catch (error: any) {
      toast({
        title: "Request Failed",
        description: error.message,
        variant: "destructive"
      });
      setResponse(JSON.stringify({ error: error.message }, null, 2));
    } finally {
      setLoading(false);
    }
  };

  const generateSandboxData = async () => {
    if (!selectedInstitution) {
      toast({
        title: "Institution Required",
        description: "Please select an institution first",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let testData: any = {};
      
      switch (dataType) {
        case "account":
          testData = {
            account_id: `TEST-${Date.now()}`,
            currency: "XAF",
            account_type: "Personal",
            account_subtype: "Current",
            nickname: "Test Account",
            balance: 150000
          };
          break;
        case "transaction":
          testData = {
            transaction_id: `TXN-${Date.now()}`,
            amount: 25000,
            currency: "XAF",
            type: "Credit",
            status: "Booked",
            description: "Test Transaction"
          };
          break;
        case "payment":
          testData = {
            payment_id: `PAY-${Date.now()}`,
            amount: 10000,
            currency: "XAF",
            status: "Pending",
            creditor: "Test Creditor"
          };
          break;
      }

      const { error } = await supabase.from("sandbox_data").insert({
        institution_id: selectedInstitution,
        user_id: user.id,
        data_type: dataType,
        data: testData
      });

      if (error) throw error;

      await fetchSandboxData();
      
      toast({
        title: "Sandbox Data Generated",
        description: `Created test ${dataType} successfully`
      });
    } catch (error: any) {
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Content copied successfully",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-8 px-4">
        <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Code className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Developer Portal</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">Developer Portal</h1>
          <p className="text-muted-foreground">
            Test APIs, generate sandbox data, and access integration resources
          </p>
        </div>

        <Tabs defaultValue="testing" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="testing">
              <TestTube className="mr-2 h-4 w-4" />
              API Testing
            </TabsTrigger>
            <TabsTrigger value="sandbox">
              <Database className="mr-2 h-4 w-4" />
              Sandbox Data
            </TabsTrigger>
            <TabsTrigger value="endpoints">
              <FileText className="mr-2 h-4 w-4" />
              Endpoints
            </TabsTrigger>
            <TabsTrigger value="postman">
              <BookOpen className="mr-2 h-4 w-4" />
              Postman
            </TabsTrigger>
            <TabsTrigger value="security">
              <Shield className="mr-2 h-4 w-4" />
              Security
            </TabsTrigger>
          </TabsList>

          <TabsContent value="testing" className="space-y-6">
            <div className="mb-6">
              <Label>Select Institution</Label>
              <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose your institution" />
                </SelectTrigger>
                <SelectContent>
                  {institutions.map((inst) => (
                    <SelectItem key={inst.id} value={inst.id}>
                      {inst.institution_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>API Request Builder</CardTitle>
                <CardDescription>Test API endpoints in the sandbox environment</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-1">
                    <Label>Method</Label>
                    <Select value={method} onValueChange={setMethod}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GET">GET</SelectItem>
                        <SelectItem value="POST">POST</SelectItem>
                        <SelectItem value="PUT">PUT</SelectItem>
                        <SelectItem value="DELETE">DELETE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label>Endpoint</Label>
                    <Select value={endpoint} onValueChange={setEndpoint}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="/aisp-accounts">GET /aisp-accounts</SelectItem>
                        <SelectItem value="/aisp-balances">GET /aisp-balances</SelectItem>
                        <SelectItem value="/aisp-transactions">GET /aisp-transactions</SelectItem>
                        <SelectItem value="/pisp-domestic-payment">POST /pisp-domestic-payment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Headers (JSON)</Label>
                  <Textarea
                    value={headers}
                    onChange={(e) => setHeaders(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                </div>

                {method !== "GET" && (
                  <div>
                    <Label>Body (JSON)</Label>
                    <Textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                      className="font-mono text-sm"
                    />
                  </div>
                )}

                <Button onClick={handleTestRequest} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Send Request
                </Button>

                {response && (
                  <div>
                    <Label>Response</Label>
                    <Textarea
                      value={response}
                      readOnly
                      rows={12}
                      className="font-mono text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="sandbox" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Generate Test Data</CardTitle>
                <CardDescription>Create sample data for testing your integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="mb-6">
                  <Label>Select Institution</Label>
                  <Select value={selectedInstitution} onValueChange={setSelectedInstitution}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose your institution" />
                    </SelectTrigger>
                    <SelectContent>
                      {institutions.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.institution_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Data Type</Label>
                  <Select value={dataType} onValueChange={setDataType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="account">Account</SelectItem>
                      <SelectItem value="transaction">Transaction</SelectItem>
                      <SelectItem value="payment">Payment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button onClick={generateSandboxData} disabled={loading}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Database className="mr-2 h-4 w-4" />
                  )}
                  Generate {dataType}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Recent Sandbox Data</CardTitle>
                <CardDescription>Your generated test data</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sandboxData.map((item) => (
                    <div key={item.id} className="flex items-start justify-between p-3 border rounded">
                      <div className="flex-1">
                        <Badge variant="outline" className="mb-2">{item.data_type}</Badge>
                        <pre className="text-xs overflow-x-auto">{JSON.stringify(item.data, null, 2)}</pre>
                      </div>
                      <span className="text-sm text-muted-foreground ml-4">
                        {new Date(item.created_at).toLocaleString()}
                      </span>
                    </div>
                  ))}
                  {sandboxData.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      No sandbox data yet. Generate some test data to get started.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="endpoints" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>AISP Endpoints</CardTitle>
                <CardDescription>Account Information Service Provider APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { method: "GET", path: "/aisp-accounts", desc: "Retrieve account information" },
                    { method: "GET", path: "/aisp-balances/:accountId", desc: "Get account balances" },
                    { method: "GET", path: "/aisp-transactions/:accountId", desc: "Fetch transactions" },
                    { method: "GET", path: "/aisp-beneficiaries/:accountId", desc: "List beneficiaries" },
                    { method: "GET", path: "/aisp-standing-orders/:accountId", desc: "Get standing orders" },
                    { method: "GET", path: "/aisp-direct-debits/:accountId", desc: "List direct debits" }
                  ].map((endpoint, i) => (
                    <div key={i} className="bg-muted/50 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <code className="text-sm font-mono">{endpoint.path}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">{endpoint.desc}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(
                          `${API_BASE_URL}/v1${endpoint.path}`,
                          `endpoint-${i}`
                        )}
                      >
                        {copiedId === `endpoint-${i}` ? (
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>PISP Endpoints</CardTitle>
                <CardDescription>Payment Initiation Service Provider APIs</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { method: "POST", path: "/pisp-domestic-payment", desc: "Initiate a domestic payment" },
                    { method: "GET", path: "/pisp-payment-details/:paymentId", desc: "Get payment details" },
                    { method: "POST", path: "/pisp-payment-submission/:paymentId", desc: "Submit payment for processing" }
                  ].map((endpoint, i) => (
                    <div key={i} className="bg-muted/50 p-3 rounded-lg flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline">{endpoint.method}</Badge>
                          <code className="text-sm font-mono">{endpoint.path}</code>
                        </div>
                        <p className="text-sm text-muted-foreground">{endpoint.desc}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(
                          `${API_BASE_URL}/v1${endpoint.path}`,
                          `pisp-${i}`
                        )}
                      >
                        {copiedId === `pisp-${i}` ? (
                          <CheckCircle2 className="h-4 w-4 text-accent" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="postman" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Postman Collection</CardTitle>
                <CardDescription>Import our pre-configured Postman collection for quick API testing</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-4 p-4 bg-accent/10 border border-accent/20 rounded-lg">
                  <BookOpen className="h-6 w-6 text-accent mt-1" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">Kang <span style={{ color: '#9fe870' }}>Open</span> Banking API Collection</h4>
                    <p className="text-sm text-muted-foreground mb-4">
                      Complete collection with all AISP and PISP endpoints pre-configured with example requests and environment variables.
                    </p>
                    <Button
                      onClick={() => {
                        const collection = {
                          info: {
                            name: "Kang Open Banking API",
                            description: "Unified Banking API for Cameroon - AISP & PISP endpoints",
                            schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
                          },
                          variable: [
                            { key: "base_url", value: `${API_BASE_URL}/v1` },
                            { key: "access_token", value: "YOUR_ACCESS_TOKEN" },
                            { key: "consent_id", value: "YOUR_CONSENT_ID" }
                          ],
                          item: [
                            {
                              name: "AISP - Account Information",
                              item: [
                                {
                                  name: "Get Accounts",
                                  request: {
                                    method: "GET",
                                    header: [
                                      { key: "Authorization", value: "Bearer {{access_token}}" },
                                      { key: "x-consent-id", value: "{{consent_id}}" }
                                    ],
                                    url: { raw: "{{base_url}}/aisp-accounts", host: ["{{base_url}}"], path: ["aisp-accounts"] }
                                  }
                                },
                                {
                                  name: "Get Account Balances",
                                  request: {
                                    method: "GET",
                                    header: [
                                      { key: "Authorization", value: "Bearer {{access_token}}" },
                                      { key: "x-consent-id", value: "{{consent_id}}" }
                                    ],
                                    url: { raw: "{{base_url}}/aisp-balances/ACCOUNT_ID", host: ["{{base_url}}"], path: ["aisp-balances", "ACCOUNT_ID"] }
                                  }
                                },
                                {
                                  name: "Get Transactions",
                                  request: {
                                    method: "GET",
                                    header: [
                                      { key: "Authorization", value: "Bearer {{access_token}}" },
                                      { key: "x-consent-id", value: "{{consent_id}}" }
                                    ],
                                    url: { raw: "{{base_url}}/aisp-transactions/ACCOUNT_ID", host: ["{{base_url}}"], path: ["aisp-transactions", "ACCOUNT_ID"] }
                                  }
                                }
                              ]
                            },
                            {
                              name: "PISP - Payment Initiation",
                              item: [
                                {
                                  name: "Create Domestic Payment",
                                  request: {
                                    method: "POST",
                                    header: [
                                      { key: "Authorization", value: "Bearer {{access_token}}" },
                                      { key: "Content-Type", value: "application/json" }
                                    ],
                                    body: {
                                      mode: "raw",
                                      raw: JSON.stringify({
                                        consent_id: "{{consent_id}}",
                                        instructed_amount: { amount: "10000", currency: "XAF" },
                                        creditor_account: { identification: "237123456789", name: "John Doe" },
                                        remittance_information: "Payment for services",
                                        reference: "REF-001"
                                      }, null, 2)
                                    },
                                    url: { raw: "{{base_url}}/pisp-domestic-payment", host: ["{{base_url}}"], path: ["pisp-domestic-payment"] }
                                  }
                                }
                              ]
                            }
                          ]
                        };
                        
                        const blob = new Blob([JSON.stringify(collection, null, 2)], { type: 'application/json' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'Kang-Open-Banking-API-Collection.postman_collection.json';
                        a.click();
                        URL.revokeObjectURL(url);
                        
                        toast({
                          title: "Collection Downloaded",
                          description: "Import the JSON file into Postman to get started"
                        });
                      }}
                    >
                      <Code className="mr-2 h-4 w-4" />
                      Download Collection
                    </Button>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-semibold">Environment Variables</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex-1">
                        <code className="text-sm font-mono">base_url</code>
                        <p className="text-xs text-muted-foreground mt-1">
                          {API_BASE_URL}/v1
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(`${API_BASE_URL}/v1`, 'base-url')}
                      >
                        {copiedId === 'base-url' ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>cURL Examples</CardTitle>
                <CardDescription>Copy these commands to test APIs from your terminal</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Get Accounts</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `curl -X GET '${API_BASE_URL}/v1/aisp-accounts' \\\n  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\\n  -H 'x-consent-id: YOUR_CONSENT_ID'`,
                        'curl-accounts'
                      )}
                    >
                      {copiedId === 'curl-accounts' ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs font-mono overflow-x-auto">
{`curl -X GET '${API_BASE_URL}/v1/aisp-accounts' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\
  -H 'x-consent-id: YOUR_CONSENT_ID'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Get Account Balances</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `curl -X GET '${API_BASE_URL}/v1/aisp-balances/ACCOUNT_ID' \\\n  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\\n  -H 'x-consent-id: YOUR_CONSENT_ID'`,
                        'curl-balances'
                      )}
                    >
                      {copiedId === 'curl-balances' ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs font-mono overflow-x-auto">
{`curl -X GET '${API_BASE_URL}/v1/aisp-balances/ACCOUNT_ID' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\
  -H 'x-consent-id: YOUR_CONSENT_ID'`}
                    </pre>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-sm font-semibold">Create Payment</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `curl -X POST '${API_BASE_URL}/v1/pisp-domestic-payment' \\\n  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"consent_id":"YOUR_CONSENT_ID","instructed_amount":{"amount":"10000","currency":"XAF"},"creditor_account":{"identification":"237123456789","name":"John Doe"},"remittance_information":"Payment for services","reference":"REF-001"}'`,
                        'curl-payment'
                      )}
                    >
                      {copiedId === 'curl-payment' ? <CheckCircle2 className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="bg-muted p-3 rounded-lg">
                    <pre className="text-xs font-mono overflow-x-auto">
{`curl -X POST '${API_BASE_URL}/v1/pisp-domestic-payment' \\
  -H 'Authorization: Bearer YOUR_ACCESS_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "consent_id": "YOUR_CONSENT_ID",
    "instructed_amount": {
      "amount": "10000",
      "currency": "XAF"
    },
    "creditor_account": {
      "identification": "237123456789",
      "name": "John Doe"
    },
    "remittance_information": "Payment for services",
    "reference": "REF-001"
  }'`}
                    </pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="border-accent">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  FAPI 1.0 Advanced Security Profile
                </CardTitle>
                <CardDescription>
                  Financial-grade API security with OAuth2 + OpenID Connect
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Authentication Endpoints</h4>
                  <div className="space-y-3">
                    {[
                      { name: "JWKS (Public Keys)", path: "/jwks-endpoint" },
                      { name: "OpenID Configuration", path: "/oidc-config" },
                      { name: "PAR (Pushed Authorization)", path: "/par-endpoint" },
                      { name: "DCR (Dynamic Client Registration)", path: "/dcr-register" }
                    ].map((endpoint, i) => (
                      <div key={i} className="bg-muted/50 p-3 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-sm font-medium">{endpoint.name}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(
                              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1${endpoint.path}`,
                              `auth-${i}`
                            )}
                          >
                            {copiedId === `auth-${i}` ? (
                              <CheckCircle2 className="h-4 w-4 text-accent" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <code className="text-xs text-muted-foreground break-all">
                          {import.meta.env.VITE_SUPABASE_URL}/functions/v1{endpoint.path}
                        </code>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="font-semibold mb-3">Security Features</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span><strong>mTLS:</strong> Mutual TLS authentication for all API calls</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span><strong>JAR:</strong> JWT-secured authorization requests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span><strong>PAR:</strong> Pushed authorization requests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                      <span><strong>DCR:</strong> Dynamic client registration</span>
                    </li>
                  </ul>
                </div>

                <div className="pt-4 border-t">
                  <Link to="/tpp-registration">
                    <Button className="w-full">
                      Register as TPP →
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Developer;
