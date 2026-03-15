import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Copy, CheckCircle, Key, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { API_CONFIG } from "@/config/api";

export default function ApiPlayground() {
  const { toast } = useToast();
  const [apiKey, setApiKey] = useState("");
  const [selectedEndpoint, setSelectedEndpoint] = useState("api-health");
  const [requestBody, setRequestBody] = useState("{}");
  const [response, setResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const endpoints = [
    { value: "api-health", label: "API Health", method: "GET", requiresBody: false },
    { value: "loan-calculate", label: "Loan Calculator", method: "POST", requiresBody: true, 
      exampleBody: `{
  "principal": 1000000,
  "annual_rate": 12,
  "term_months": 12
}` },
    { value: "credit-score-tips", label: "Credit Score Tips", method: "GET", requiresBody: false },
    { value: "aisp-accounts", label: "List Accounts (AISP)", method: "GET", requiresBody: false },
    { value: "exchange-rate-get", label: "Exchange Rates", method: "GET", requiresBody: false },
  ];

  const selectedEndpointData = endpoints.find(e => e.value === selectedEndpoint);

  const executeRequest = async () => {
    if (!apiKey.startsWith('sbx_')) {
      toast({
        title: "Invalid API Key",
        description: "Please enter a valid sandbox API key (starts with sbx_)",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const endpoint = endpoints.find(e => e.value === selectedEndpoint);
      if (!endpoint) return;

      const url = `${API_CONFIG.BASE_URL}/${selectedEndpoint}`;
      
      const options: RequestInit = {
        method: endpoint.method,
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': apiKey,
        },
      };

      if (endpoint.method === "POST" && endpoint.requiresBody) {
        options.body = requestBody;
      }

      const result = await fetch(url, options);
      const data = await result.json();

      setResponse({
        status: result.status,
        statusText: result.statusText,
        data: data,
        headers: Object.fromEntries(result.headers.entries()),
      });

      toast({
        title: result.ok ? "Request successful" : "Request failed",
        description: result.ok ? "Check the response below" : `Status: ${result.status}`,
        variant: result.ok ? "default" : "destructive",
      });
    } catch (error: any) {
      setResponse({ error: error.message });
      toast({
        title: "Request failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const generateCurlCommand = () => {
    const endpoint = endpoints.find(e => e.value === selectedEndpoint);
    if (!endpoint) return "";

    if (endpoint.method === "GET") {
      return `curl -X GET "${API_CONFIG.BASE_URL}/${selectedEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${apiKey || 'your_sandbox_api_key'}"`;
    } else {
      return `curl -X POST "${API_CONFIG.BASE_URL}/${selectedEndpoint}" \\
  -H "Content-Type: application/json" \\
  -H "X-Api-Key: ${apiKey || 'your_sandbox_api_key'}" \\
  -d '${requestBody}'`;
    }
  };

  const generateJavaScriptCode = () => {
    const endpoint = endpoints.find(e => e.value === selectedEndpoint);
    if (!endpoint) return "";

    if (endpoint.method === "GET") {
      return `const response = await fetch('${API_CONFIG.BASE_URL}/${selectedEndpoint}', {
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': '${apiKey || 'your_sandbox_api_key'}'
  }
});

const data = await response.json();
console.log(data);`;
    } else {
      return `const response = await fetch('${API_CONFIG.BASE_URL}/${selectedEndpoint}', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Api-Key': '${apiKey || 'your_sandbox_api_key'}'
  },
  body: JSON.stringify(${requestBody})
});

const data = await response.json();
console.log(data);`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <Badge className="mb-4">
            <Key className="mr-1 h-3 w-3" />
            Sandbox API Key Required
          </Badge>
          <h1 className="text-4xl font-bold mb-4">Interactive API Playground</h1>
          <p className="text-xl text-muted-foreground">
            Test API endpoints with your sandbox API key
          </p>
        </div>

        <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold text-yellow-700 dark:text-yellow-400">Sandbox Only</p>
            <p className="text-muted-foreground mt-1">
              This playground uses sandbox API keys (<code className="bg-muted px-1 rounded text-xs">X-API-Key: sbx_...</code>). 
              Production APIs require <strong>OAuth2 Bearer tokens</strong> obtained via the{" "}
              <a href="/developer/gateway/authentication" className="text-primary underline">OAuth token endpoint</a>.
            </p>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left: Request Builder */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Build Request</CardTitle>
                <CardDescription>Configure and execute API requests</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Sandbox API Key</label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sbx_..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your API key from the Sandbox page
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Select Endpoint</label>
                  <Select value={selectedEndpoint} onValueChange={(value) => {
                    setSelectedEndpoint(value);
                    const endpoint = endpoints.find(e => e.value === value);
                    if (endpoint?.exampleBody) {
                      setRequestBody(endpoint.exampleBody);
                    } else {
                      setRequestBody("{}");
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {endpoints.map(endpoint => (
                        <SelectItem key={endpoint.value} value={endpoint.value}>
                          <div className="flex items-center gap-2">
                            <Badge variant={endpoint.method === "GET" ? "secondary" : "default"} className="text-xs">
                              {endpoint.method}
                            </Badge>
                            {endpoint.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedEndpointData?.requiresBody && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Request Body (JSON)</label>
                    <Textarea
                      value={requestBody}
                      onChange={(e) => setRequestBody(e.target.value)}
                      className="font-mono text-sm"
                      rows={10}
                    />
                  </div>
                )}

                <Button onClick={executeRequest} disabled={loading || !apiKey} className="w-full">
                  <Play className="mr-2 h-4 w-4" />
                  {loading ? "Executing..." : "Execute Request"}
                </Button>
              </CardContent>
            </Card>

            {/* Code Examples */}
            <Card>
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
                <CardDescription>Copy and use in your application</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl">
                  <TabsList className="mb-4">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                  </TabsList>
                  <TabsContent value="curl">
                    <div className="bg-muted/50 p-4 rounded-lg relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(generateCurlCommand(), "curl")}
                      >
                        {copiedId === "curl" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-sm overflow-x-auto pr-8">
                        <code>{generateCurlCommand()}</code>
                      </pre>
                    </div>
                  </TabsContent>
                  <TabsContent value="javascript">
                    <div className="bg-muted/50 p-4 rounded-lg relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(generateJavaScriptCode(), "js")}
                      >
                        {copiedId === "js" ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-sm overflow-x-auto pr-8">
                        <code>{generateJavaScriptCode()}</code>
                      </pre>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>

          {/* Right: Response */}
          <div>
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Response</CardTitle>
                <CardDescription>API response will appear here</CardDescription>
              </CardHeader>
              <CardContent>
                {response ? (
                  <Tabs defaultValue="formatted">
                    <TabsList className="mb-4">
                      <TabsTrigger value="formatted">Formatted</TabsTrigger>
                      <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                    </TabsList>
                    <TabsContent value="formatted">
                      <div className="bg-muted/50 p-4 rounded-lg overflow-auto max-h-[600px]">
                        {response.status && (
                          <div className="mb-4">
                            <Badge variant={response.status < 400 ? "default" : "destructive"}>
                              {response.status} {response.statusText}
                            </Badge>
                          </div>
                        )}
                        <pre className="text-sm">
                          {JSON.stringify(response, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                    <TabsContent value="raw">
                      <div className="bg-muted/50 p-4 rounded-lg overflow-auto max-h-[600px] relative">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => copyToClipboard(JSON.stringify(response, null, 2), "response")}
                        >
                          {copiedId === "response" ? (
                            <CheckCircle className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <pre className="text-sm pr-8">
                          {JSON.stringify(response, null, 2)}
                        </pre>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <div className="bg-muted/30 p-12 rounded-lg text-center text-muted-foreground">
                    <p>Execute a request to see the response</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
    </div>
  );
}