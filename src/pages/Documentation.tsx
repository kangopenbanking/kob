import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Building2, Code, Book, ArrowLeft, Copy, CheckCircle2, DollarSign, TrendingUp, Wallet, AlertTriangle, Download, ExternalLink, Terminal, Shield, CreditCard, Smartphone, FileText, Lock, BarChart3, Users } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG } from "@/config/api";
import { SEO } from "@/components/SEO";

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

  // Resolve working endpoints with automatic fallback
  const [openApiUrl, setOpenApiUrl] = useState<string>(API_CONFIG.OPENAPI_SPEC);
  const [postmanUrl, setPostmanUrl] = useState<string>(API_CONFIG.POSTMAN_COLLECTION);
  const [usingFallback, setUsingFallback] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const fallbackOpenApi = API_CONFIG.OPENAPI_SPEC.replace(API_CONFIG.BASE_URL, API_CONFIG.BASE_URL_FALLBACK);
    const fallbackPostman = API_CONFIG.POSTMAN_COLLECTION.replace(API_CONFIG.BASE_URL, API_CONFIG.BASE_URL_FALLBACK);

    const check = async () => {
      setIsChecking(true);
      try {
        const [specHead, postmanHead] = await Promise.allSettled([
          fetch(API_CONFIG.OPENAPI_SPEC, { method: 'HEAD' }),
          fetch(API_CONFIG.POSTMAN_COLLECTION, { method: 'HEAD' }),
        ]);

        let usedFallback = false;

        if (specHead.status === 'fulfilled' && specHead.value.ok) {
          if (!cancelled) setOpenApiUrl(API_CONFIG.OPENAPI_SPEC);
        } else {
          if (!cancelled) { setOpenApiUrl(fallbackOpenApi); usedFallback = true; }
        }

        if (postmanHead.status === 'fulfilled' && postmanHead.value.ok) {
          if (!cancelled) setPostmanUrl(API_CONFIG.POSTMAN_COLLECTION);
        } else {
          if (!cancelled) { setPostmanUrl(fallbackPostman); usedFallback = true; }
        }

        if (!cancelled) setUsingFallback(usedFallback);
      } catch (_e) {
        if (!cancelled) {
          setOpenApiUrl(fallbackOpenApi);
          setPostmanUrl(fallbackPostman);
          setUsingFallback(true);
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    check();
    return () => { cancelled = true; };
  }, []);

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
        <SEO
          title="API Documentation"
          description="Complete API reference for Kang Open Banking. RESTful endpoints, authentication guides, code examples in multiple languages, and integration tutorials for Cameroon's banking ecosystem."
          keywords="API documentation, REST API, banking API reference, open banking integration, financial services API, XAF payment integration, AISP, PISP"
          canonical="https://kangopenbanking.com/documentation"
          structuredData={{
            "@context": "https://schema.org",
            "@type": "TechArticle",
            "headline": "Kang Open Banking API Documentation",
            "description": "Complete technical documentation for integrating banking services in Cameroon",
            "author": {
              "@type": "Organization",
              "name": "Kang Open Banking"
            },
            "datePublished": "2025-01-05",
            "dateModified": "2025-11-05"
          }}
        />
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

          {/* Tag-Based Domain Navigation */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">API Domains</CardTitle>
                <CardDescription>Browse documentation by API domain</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {[
                    { label: "OAuth & Auth", icon: Lock, path: "/developer/quick-start", color: "bg-primary/10 text-primary border-primary/20" },
                    { label: "AISP", icon: FileText, path: "/developer/aisp-reference", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
                    { label: "PISP", icon: CreditCard, path: "/developer/pisp-reference", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
                    { label: "Loans", icon: DollarSign, path: "/credit-api-documentation", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
                    { label: "Savings", icon: TrendingUp, path: "/developer/banking-reference", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
                    { label: "Mobile Money", icon: Smartphone, path: "/developer/mobile-money-reference", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
                    { label: "Certificates", icon: Shield, path: "/guides/certificates", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
                    { label: "Webhooks", icon: Terminal, path: "/developer/webhooks-guide", color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" },
                    { label: "Admin", icon: Users, path: "/developer/console", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20" },
                    { label: "Ledger", icon: BarChart3, path: "/developer/banking-reference", color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20" },
                  ].map((domain) => (
                    <Link key={domain.label} to={domain.path}>
                      <Badge
                        variant="outline"
                        className={`${domain.color} px-4 py-2 text-sm font-medium cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-2`}
                      >
                        <domain.icon className="h-4 w-4" />
                        {domain.label}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </section>

          {/* API Integrations Section */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">API Integrations</CardTitle>
                <CardDescription>
                  Import our API specification into your favorite tools for seamless integration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Code className="h-5 w-5 text-primary" />
                      OpenAPI Specification
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Download our complete API specification in OpenAPI 3.0 format
                    </p>
                    <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild disabled={isChecking}>
                        <a href={openApiUrl} download>
                          <Download className="mr-2 h-4 w-4" />
                          JSON
                        </a>
                      </Button>
                    </div>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <ExternalLink className="h-5 w-5 text-primary" />
                      Postman Collection
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Import all endpoints into Postman with one click
                    </p>
                    <Button variant="outline" size="sm" asChild disabled={isChecking}>
                      <a
                        href={postmanUrl}
                        download
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download Collection
                      </a>
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Book className="h-5 w-5 text-primary" />
                      Interactive Explorer
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Test endpoints directly in your browser with Swagger UI
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <Link to="/developer/api-explorer">
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Open Explorer
                      </Link>
                    </Button>
                  </div>
                  
                  <div className="border rounded-lg p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Terminal className="h-5 w-5 text-primary" />
                      SDK Generation
                    </h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Generate client SDKs in multiple languages
                    </p>
                    <Button variant="outline" size="sm" asChild disabled={isChecking}>
                      <a
                        href={`https://editor.swagger.io/?url=${openApiUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Generate SDK
                      </a>
                    </Button>
                  </div>
                </div>
                
                <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                  <p className="text-sm font-semibold mb-2">
                    🚀 Quick Start for External Platforms
                  </p>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Import our OpenAPI spec: <code className="text-xs bg-muted px-2 py-1 rounded">{openApiUrl}</code></li>
                    <li>Obtain your API credentials from the <Link to="/developer" className="text-primary hover:underline">Developer Portal</Link></li>
                    <li>Authenticate using OAuth 2.0 or Bearer token</li>
                    <li>Start making API calls!</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </section>

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

          {/* mTLS Certificate Management Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              mTLS Certificate Management (FAPI 1.0 Advanced)
            </h2>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">Client Certificate Authentication</CardTitle>
                <CardDescription>
                  Manage X.509 certificates for mutual TLS authentication and certificate-bound access tokens (RFC 8705)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                  <p className="text-sm font-semibold mb-2">FAPI 1.0 Advanced Compliance</p>
                  <p className="text-sm text-muted-foreground">
                    Certificate-bound access tokens are mandatory for production. All API access must use mTLS with registered certificates.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Upload Certificate
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Register a new X.509 client certificate for your TPP registration
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/certificate-upload
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "certificate_pem": "-----BEGIN CERTIFICATE-----\\n...\\n-----END CERTIFICATE-----",
  "tpp_registration_id": "uuid-of-tpp-registration"
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    List Certificates
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Retrieve all registered certificates with status and usage information
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`GET /functions/v1/certificate-list?tpp_registration_id=uuid
Authorization: Bearer YOUR_ACCESS_TOKEN`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Revoke Certificate
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Revoke a certificate and immediately invalidate all associated access tokens
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/certificate-revoke
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "certificate_id": "uuid-of-certificate",
  "reason": "key_compromise"
}`}</pre>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button asChild variant="outline">
                    <Link to="/developer/certificates">Manage Certificates</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/guides/certificates">Certificate Guide</Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link to="/developer/api/certificates">Full API Reference</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Loans API Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-primary" />
              Loans API
            </h2>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">Loan Management Endpoints</CardTitle>
                <CardDescription>
                  Enable loan applications, calculations, repayments, and automated credit scoring
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Apply for Loan (with Auto Credit Check)
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Submit a loan application with automatic credit score verification and decision
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-2">
                    <pre className="font-mono text-sm">{`POST /functions/v1/loan-apply
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "product_id": "uuid",
  "amount": 500000,
  "term_months": 12,
  "purpose": "Business expansion"
}

Response:
{
  "application_id": "uuid",
  "status": "pre_approved",
  "amount": 500000,
  "credit_score": 720,
  "interest_rate": 12.5,
  "monthly_payment": 44450,
  "decision_reason": "Strong credit profile and payment history",
  "requires_manual_review": false
}`}</pre>
                  </div>
                  <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                    <p className="text-sm font-semibold mb-1">Auto Decision System</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• <strong>Pre-Approved</strong>: Score ≥700, DTI ≤40%</li>
                      <li>• <strong>Conditional</strong>: Score 600-699</li>
                      <li>• <strong>Under Review</strong>: Score 500-599 or high DTI</li>
                      <li>• <strong>Declined</strong>: Score &lt;500, active defaults, or sanctions hit</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Calculate Loan Terms
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Preview loan terms including monthly payment, total interest, and repayment schedule
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/loan-calculate
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "amount": 500000,
  "term_months": 12,
  "interest_rate": 12.5
}

Response:
{
  "monthly_payment": 44450,
  "total_payment": 533400,
  "total_interest": 33400,
  "schedule": [...]
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Submit Loan Repayment
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Process a loan repayment and update account standing
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/loan-repay
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "loan_account_id": "uuid",
  "amount": 44450,
  "payment_method": "mobile_money"
}

Response:
{
  "transaction_id": "uuid",
  "status": "success",
  "remaining_balance": 444500,
  "next_due_date": "2025-02-15"
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Savings API Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <Wallet className="h-8 w-8 text-primary" />
              Savings API
            </h2>
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">Savings Account Management</CardTitle>
                <CardDescription>
                  Create and manage savings accounts with automatic interest calculation and credit score bonuses
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Create Savings Account
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Open a new savings account with optional initial deposit and goal setting
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-2">
                    <pre className="font-mono text-sm">{`POST /functions/v1/savings-create
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "product_id": "uuid",
  "initial_deposit": 50000,
  "savings_goal": 1000000,
  "target_date": "2026-12-31"
}

Response:
{
  "account_id": "uuid",
  "account_number": "SAV-001234",
  "balance": 50000,
  "interest_rate": 5.5,
  "credit_score_bonus": 0.5,
  "effective_rate": 6.0,
  "status": "active"
}`}</pre>
                  </div>
                  <div className="bg-accent/10 border-l-4 border-accent p-4 rounded">
                    <p className="text-sm font-semibold mb-1">Credit Score Interest Bonuses</p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Score ≥750: <strong>+0.5%</strong> bonus rate</li>
                      <li>• Score 700-749: <strong>+0.3%</strong> bonus rate</li>
                      <li>• Score 650-699: <strong>+0.1%</strong> bonus rate</li>
                      <li>• Score &lt;650: No bonus</li>
                    </ul>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Make Deposit
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Add funds to a savings account
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/savings-deposit
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "account_id": "uuid",
  "amount": 25000,
  "payment_method": "bank_transfer"
}

Response:
{
  "transaction_id": "uuid",
  "new_balance": 75000,
  "interest_earned_ytd": 1250
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Make Withdrawal
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Withdraw funds from a savings account (subject to product rules)
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/savings-withdraw
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "account_id": "uuid",
  "amount": 10000,
  "reason": "Emergency expense"
}

Response:
{
  "transaction_id": "uuid",
  "new_balance": 65000,
  "penalty_applied": 0
}`}</pre>
                  </div>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Credit Scoring API Section */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-primary" />
              Credit Scoring API
            </h2>
            
            {/* User-Facing APIs */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-2xl">User Credit APIs</CardTitle>
                <CardDescription>
                  Fetch and monitor user credit scores (300-850 range)
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Fetch Credit Score
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Retrieve current credit score with breakdown of contributing factors (soft inquiry)
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-2">
                    <pre className="font-mono text-sm">{`POST /functions/v1/credit-score-fetch
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "user_id": "uuid",
  "force_refresh": false,
  "include_report": true
}

Response:
{
  "score": 720,
  "score_range": "Good",
  "calculated_at": "2025-01-15T10:30:00Z",
  "expires_at": "2025-02-15T10:30:00Z",
  "factors": {
    "payment_history": 35,
    "amounts_owed": 28,
    "credit_history_length": 14,
    "credit_mix": 9,
    "new_credit": 8,
    "savings_behavior": 15,
    "transaction_pattern": 11
  },
  "recommendations": [
    "Continue making on-time payments",
    "Consider reducing credit utilization below 30%"
  ]
}`}</pre>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                    <div className="border rounded-lg p-3 bg-destructive/10 border-destructive/30">
                      <p className="text-xs text-muted-foreground">300-579</p>
                      <p className="font-medium text-sm">Poor</p>
                    </div>
                    <div className="border rounded-lg p-3 bg-orange-100/50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-800">
                      <p className="text-xs text-muted-foreground">580-669</p>
                      <p className="font-medium text-sm">Fair</p>
                    </div>
                    <div className="border rounded-lg p-3 bg-yellow-100/50 dark:bg-yellow-950/30 border-yellow-300 dark:border-yellow-800">
                      <p className="text-xs text-muted-foreground">670-739</p>
                      <p className="font-medium text-sm">Good</p>
                    </div>
                    <div className="border rounded-lg p-3 bg-green-100/50 dark:bg-green-950/30 border-green-300 dark:border-green-800">
                      <p className="text-xs text-muted-foreground">740-799</p>
                      <p className="font-medium text-sm">Very Good</p>
                    </div>
                    <div className="border rounded-lg p-3 bg-accent/20 border-accent">
                      <p className="text-xs text-muted-foreground">800-850</p>
                      <p className="font-medium text-sm">Excellent</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Scores are cached for 30 days. Use force_refresh: true to recalculate immediately.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-accent" />
                    Generate Credit Report
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Create a comprehensive credit report with detailed analysis (hard inquiry)
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/credit-report-generate
Authorization: Bearer YOUR_ACCESS_TOKEN

{
  "user_id": "uuid",
  "report_type": "full",
  "purpose": "loan_application",
  "requester_info": {
    "institution_name": "Example Bank",
    "loan_amount": 500000
  }
}

Response:
{
  "report_id": "uuid",
  "credit_score": 720,
  "report_data": {
    "payment_history": { "on_time_payments": 24, "late_payments": 2 },
    "credit_utilization": 32.5,
    "total_accounts": 3,
    "inquiries_last_12_months": 4,
    "public_records": []
  },
  "risk_assessment": "Low",
  "generated_at": "2025-01-15T10:30:00Z"
}`}</pre>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg mt-3">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                          Hard Inquiry Impact
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          Generating a credit report logs a hard inquiry, which may temporarily affect credit scores. 
                          Users are notified via alert.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* B2B APIs for Institutions */}
            <Card className="border-primary/50 bg-primary/5 mb-6">
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="bg-primary text-primary-foreground">
                    B2B API
                  </Badge>
                  <Badge variant="outline">Requires Institution Account</Badge>
                </div>
                <CardTitle className="text-2xl">Institution Credit Query APIs</CardTitle>
                <CardDescription>
                  For banks, fintechs, and financial institutions to query customer credit data with consent
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <span className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">1</span>
                    Authenticate Institution
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Obtain an access token using your institution API credentials
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto">
                    <pre className="font-mono text-sm">{`POST /functions/v1/credit-api-auth

{
  "api_key": "your_institution_api_key",
  "api_secret": "your_institution_secret"
}

Response:
{
  "access_token": "eyJhbGci...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "client_info": {
    "client_name": "Example Bank",
    "pricing_tier": "premium",
    "allowed_operations": ["score_query", "report_query"]
  }
}`}</pre>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                    <span className="bg-primary/20 text-primary rounded-full w-6 h-6 flex items-center justify-center text-sm">2</span>
                    Query Customer Credit Score
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Retrieve a customer's credit score with proper consent (hard inquiry)
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-3">
                    <pre className="font-mono text-sm">{`POST /functions/v1/credit-api-query-score
Authorization: Bearer {access_token_from_auth}

{
  "user_identifier": "237670000000",
  "consent_reference": "consent_uuid",
  "purpose": "loan_application"
}

Response:
{
  "user_id": "uuid",
  "credit_score": 720,
  "score_range": "Good",
  "calculated_at": "2025-01-15T10:30:00Z",
  "risk_category": "low",
  "inquiry_id": "uuid",
  "cost_xaf": 35
}`}</pre>
                  </div>
                  <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-500 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-1">
                          Consent Required
                        </p>
                        <p className="text-sm text-amber-800 dark:text-amber-200">
                          All B2B credit queries require explicit user consent. Queries without valid consent 
                          will be rejected (403 Forbidden) and logged for audit purposes.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20 mb-6">
                  <CardContent className="py-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-lg mb-1 flex items-center gap-2">
                          <TrendingUp className="h-5 w-5 text-primary" />
                          Complete Credit API Documentation
                        </h4>
                        <p className="text-sm text-muted-foreground">
                          Comprehensive guide for financial institutions with code examples, pricing calculator, and integration patterns
                        </p>
                      </div>
                      <Button size="lg" asChild>
                        <Link to="/credit-api-docs">
                          <Book className="mr-2 h-5 w-5" />
                          View Full Docs
                        </Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>

                <div>
                  <h3 className="font-semibold text-lg mb-3">B2B Pricing Tiers</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="border rounded-lg p-4">
                      <p className="font-medium mb-1">Standard</p>
                      <p className="text-3xl font-bold mb-1">50 XAF</p>
                      <p className="text-xs text-muted-foreground mb-3">per query</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• 5,000 queries/day</li>
                        <li>• Basic support</li>
                        <li>• Score only</li>
                      </ul>
                    </div>
                    <div className="border-2 border-primary rounded-lg p-4 bg-primary/5">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium">Premium</p>
                        <Badge variant="outline" className="text-xs">Popular</Badge>
                      </div>
                      <p className="text-3xl font-bold mb-1">35 XAF</p>
                      <p className="text-xs text-muted-foreground mb-3">per query</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• 50,000 queries/day</li>
                        <li>• Priority support</li>
                        <li>• Score + factors</li>
                      </ul>
                    </div>
                    <div className="border rounded-lg p-4">
                      <p className="font-medium mb-1">Enterprise</p>
                      <p className="text-3xl font-bold mb-1">25 XAF</p>
                      <p className="text-xs text-muted-foreground mb-3">per query</p>
                      <ul className="text-sm space-y-1 text-muted-foreground">
                        <li>• Unlimited queries</li>
                        <li>• Dedicated support</li>
                        <li>• Full reports</li>
                      </ul>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-4">
                    Contact sales for custom pricing and volume discounts
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* NjangiBox Integration */}
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">External Credit Bureau Integration</CardTitle>
                <CardDescription>
                  Hybrid scoring combining internal KOB data with NjangiBox credit bureau
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Credit scores automatically combine multiple data sources for comprehensive assessment:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">Internal Score</p>
                      <Badge variant="outline">60% Weight</Badge>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• KOB loan history</li>
                      <li>• Savings accounts</li>
                      <li>• Transaction patterns</li>
                      <li>• KYC verification level</li>
                    </ul>
                  </div>
                  <div className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">External Score</p>
                      <Badge variant="outline">40% Weight</Badge>
                    </div>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• NjangiBox bureau data</li>
                      <li>• Cross-institution history</li>
                      <li>• Public records</li>
                      <li>• Credit inquiries</li>
                    </ul>
                  </div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg">
                  <p className="text-sm font-semibold mb-2">Fallback Mechanism</p>
                  <p className="text-sm text-muted-foreground">
                    If external data is unavailable or API fails, the system automatically falls back 
                    to 100% internal scoring to ensure continuous service.
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Communication API Section */}
          <section className="mb-12">
            <Card>
              <CardHeader>
                <CardTitle className="text-2xl">Communication API</CardTitle>
                <CardDescription>Send emails and SMS notifications using templates</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Send Individual Communication</h3>
                  <p className="text-muted-foreground mb-4">
                    Send a single email or SMS to a recipient using a predefined template
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-4">
                    <pre className="font-mono text-sm">{`POST /functions/v1/send-communication
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json

{
  "template_key": "user_welcome",
  "recipient_email": "user@example.com",
  "variables": {
    "user_name": "John Doe",
    "platform_name": "Kang Open Banking"
  }
}`}</pre>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => copyToClipboard(`curl -X POST "https://api.kangopenbanking.com/v1/send-communication" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_key": "user_welcome",
    "recipient_email": "user@example.com",
    "variables": {
      "user_name": "John Doe",
      "platform_name": "Kang Open Banking"
    }
  }'`, 'send-comm')}
                  >
                    {copiedId === 'send-comm' ? (
                      <><CheckCircle2 className="h-4 w-4" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy Example</>
                    )}
                  </Button>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Send Bulk Communication</h3>
                  <p className="text-muted-foreground mb-4">
                    Send emails to multiple institutions (Admin only)
                  </p>
                  <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mb-4">
                    <pre className="font-mono text-sm">{`POST /functions/v1/send-bulk-communication
Authorization: Bearer YOUR_ADMIN_TOKEN
Content-Type: application/json

{
  "template_key": "institution_approved",
  "recipient_filter": {
    "type": "all_institutions"
  },
  "variables": {
    "platform_name": "Kang Open Banking",
    "docs_link": "https://docs.kangopenbanking.com"
  }
}`}</pre>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => copyToClipboard(`curl -X POST "https://api.kangopenbanking.com/v1/send-bulk-communication" \\
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "template_key": "institution_approved",
    "recipient_filter": {
      "type": "all_institutions"
    },
    "variables": {
      "platform_name": "Kang Open Banking",
      "docs_link": "https://docs.kangopenbanking.com"
    }
  }'`, 'send-bulk')}
                  >
                    {copiedId === 'send-bulk' ? (
                      <><CheckCircle2 className="h-4 w-4" /> Copied</>
                    ) : (
                      <><Copy className="h-4 w-4" /> Copy Example</>
                    )}
                  </Button>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Available Templates</h3>
                  <div className="space-y-2">
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">user_welcome</p>
                      <p className="text-sm text-muted-foreground">Welcome email for new users</p>
                      <p className="text-xs text-muted-foreground mt-1">Variables: user_name, platform_name</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">institution_approved</p>
                      <p className="text-sm text-muted-foreground">Approval notification for institutions</p>
                      <p className="text-xs text-muted-foreground mt-1">Variables: contact_name, institution_name, portal_link, docs_link, platform_name</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">consent_created</p>
                      <p className="text-sm text-muted-foreground">Consent request notification</p>
                      <p className="text-xs text-muted-foreground mt-1">Variables: user_name, institution_name, permissions_list, expiry_date, authorization_link</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">payment_initiated</p>
                      <p className="text-sm text-muted-foreground">Payment initiation notification</p>
                      <p className="text-xs text-muted-foreground mt-1">Variables: user_name, amount, currency, recipient_name, reference, payment_id</p>
                    </div>
                    <div className="border rounded-lg p-3">
                      <p className="font-medium">mfa_code (SMS)</p>
                      <p className="text-sm text-muted-foreground">Two-factor authentication code</p>
                      <p className="text-xs text-muted-foreground mt-1">Variables: platform_name, code, expiry_minutes</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground mt-4">
                    View all available templates in the Communications Management page
                  </p>
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
