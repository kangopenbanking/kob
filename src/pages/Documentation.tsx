import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Building2, Code, Book, ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Documentation = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Code snippet copied successfully",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const apiEndpoints = [
    {
      method: "GET",
      endpoint: "/api/v1/accounts",
      description: "Retrieve account information",
      example: `curl -X GET "https://api.kangopenbanking.com/v1/accounts" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`
    },
    {
      method: "POST",
      endpoint: "/api/v1/payments/initiate",
      description: "Initiate a payment transaction",
      example: `curl -X POST "https://api.kangopenbanking.com/v1/payments/initiate" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 10000,
    "currency": "XAF",
    "recipient": "account_id",
    "description": "Payment description"
  }'`
    },
    {
      method: "GET",
      endpoint: "/api/v1/transactions",
      description: "List transactions for an account",
      example: `curl -X GET "https://api.kangopenbanking.com/v1/transactions?account_id=ACC123" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json"`
    },
    {
      method: "POST",
      endpoint: "/api/v1/transfers",
      description: "Transfer funds between accounts",
      example: `curl -X POST "https://api.kangopenbanking.com/v1/transfers" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "from_account": "ACC123",
    "to_account": "ACC456",
    "amount": 5000,
    "currency": "XAF"
  }'`
    }
  ];

  return (
    <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
              <Book className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-primary">API Documentation v1.0</span>
            </div>
            <h1 className="text-5xl font-bold mb-4">API Documentation</h1>
            <p className="text-xl text-muted-foreground">
              Complete reference for integrating Kang Open Banking API into your financial institution
            </p>
          </div>

          {/* Getting Started */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Getting Started</CardTitle>
                <CardDescription>Quick setup guide for your first API integration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    1. Register Your Institution
                  </h3>
                  <p className="text-muted-foreground mb-2">
                    Create an account for your bank, credit union, or fintech company
                  </p>
                  <Link to="/register">
                    <Button variant="outline" size="sm">Register Now</Button>
                  </Link>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    2. Get Your API Keys
                  </h3>
                  <p className="text-muted-foreground mb-2">
                    Access your dashboard to generate sandbox and production API keys
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm mt-3">
                    Authorization: Bearer YOUR_API_KEY
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    3. Make Your First Request
                  </h3>
                  <p className="text-muted-foreground">
                    Test the API in sandbox mode before going live
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Base URL */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle>Base URLs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="font-semibold mb-2">Production</div>
                  <div className="bg-muted/50 p-3 rounded-lg font-mono text-sm flex items-center justify-between">
                    <code>https://api.kangopenbanking.com/v1</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard("https://api.kangopenbanking.com/v1", "prod")}
                    >
                      {copiedId === "prod" ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
                <div>
                  <div className="font-semibold mb-2">Sandbox</div>
                  <div className="bg-muted/50 p-3 rounded-lg font-mono text-sm flex items-center justify-between">
                    <code>https://sandbox.kangopenbanking.com/v1</code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard("https://sandbox.kangopenbanking.com/v1", "sandbox")}
                    >
                      {copiedId === "sandbox" ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* API Endpoints */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">API Endpoints</h2>
            <div className="space-y-6">
              {apiEndpoints.map((endpoint, index) => (
                <Card key={index}>
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-md text-sm font-semibold ${
                        endpoint.method === "GET" 
                          ? "bg-accent/20 text-accent" 
                          : "bg-primary/20 text-primary"
                      }`}>
                        {endpoint.method}
                      </span>
                      <code className="font-mono text-lg">{endpoint.endpoint}</code>
                    </div>
                    <CardDescription>{endpoint.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-xs text-muted-foreground font-semibold uppercase">Example Request</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(endpoint.example, `endpoint-${index}`)}
                        >
                          {copiedId === `endpoint-${index}` ? (
                            <CheckCircle2 className="h-4 w-4 text-accent" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                      <pre className="font-mono text-sm whitespace-pre-wrap">
                        {endpoint.example}
                      </pre>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Authentication */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Authentication</CardTitle>
                <CardDescription>Secure your API requests with bearer token authentication</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">
                  All API requests must include your API key in the Authorization header using Bearer authentication:
                </p>
                <div className="bg-muted/50 p-4 rounded-lg font-mono text-sm">
                  Authorization: Bearer YOUR_API_KEY
                </div>
                <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                  <p className="text-sm font-semibold mb-1">Security Best Practice</p>
                  <p className="text-sm text-muted-foreground">
                    Never expose your production API keys in client-side code. Always make API calls from your secure backend.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Response Format */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Response Format</CardTitle>
                <CardDescription>All responses are returned in JSON format</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                  <pre className="font-mono text-sm">{`{
  "status": "success",
  "data": {
    // Response data
  },
  "timestamp": "2025-01-01T12:00:00Z"
}

// Error Response
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  },
  "timestamp": "2025-01-01T12:00:00Z"
}`}</pre>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Support */}
          <section>
            <Card className="bg-gradient-to-br from-primary/5 to-accent/5 border-2">
              <CardContent className="p-8 text-center space-y-4">
                <Code className="h-12 w-12 text-primary mx-auto" />
                <h3 className="text-2xl font-bold">Need Help?</h3>
                <p className="text-muted-foreground">
                  Our technical team is here to support your integration
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
                  <Button variant="outline">Contact Support</Button>
                  <Link to="/developer">
                    <Button className="bg-gradient-to-r from-primary to-primary-light">
                      Visit Developer Portal
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
  );
};

export default Documentation;
