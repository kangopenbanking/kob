import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export default function Playground() {
  const { toast } = useToast();
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
  ];

  const selectedEndpointData = endpoints.find(e => e.value === selectedEndpoint);

  const executeRequest = async () => {
    setLoading(true);
    try {
      const endpoint = endpoints.find(e => e.value === selectedEndpoint);
      if (!endpoint) return;

      let result;
      if (endpoint.method === "GET") {
        result = await supabase.functions.invoke(selectedEndpoint);
      } else {
        const body = JSON.parse(requestBody);
        result = await supabase.functions.invoke(selectedEndpoint, { body });
      }

      setResponse(result);
      toast({
        title: "Request successful",
        description: "Check the response below",
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
      return `curl -X GET "https://api.kangopenbanking.com/v1/${selectedEndpoint}" \\
  -H "Content-Type: application/json"`;
    } else {
      return `curl -X POST "https://api.kangopenbanking.com/v1/${selectedEndpoint}" \\
  -H "Content-Type: application/json" \\
  -d '${requestBody}'`;
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-6xl">
      <div className="mb-8">
        <Badge className="mb-4">No Auth Required</Badge>
        <h1 className="text-4xl font-bold mb-4">API Playground</h1>
        <p className="text-xl text-muted-foreground">
          Test public API endpoints without authentication
        </p>
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

              <Button onClick={executeRequest} disabled={loading} className="w-full">
                <Play className="mr-2 h-4 w-4" />
                {loading ? "Executing..." : "Execute Request"}
              </Button>
            </CardContent>
          </Card>

          {/* cURL Command */}
          <Card>
            <CardHeader>
              <CardTitle>cURL Command</CardTitle>
              <CardDescription>Copy this command to use in terminal</CardDescription>
            </CardHeader>
            <CardContent>
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
