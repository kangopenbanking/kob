import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { 
  Building2, Code, Book, Copy, CheckCircle2, DollarSign, TrendingUp, 
  Wallet, AlertTriangle, Download, ExternalLink, Terminal, Shield, 
  CreditCard, Smartphone, FileText, Lock, BarChart3, Users, 
  ArrowRight, Zap, Globe, Database, Key, Layers, Send, ChevronRight,
  BookOpen, Webhook, RefreshCw
} from "lucide-react";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG } from "@/config/api";
import { SEO } from "@/components/SEO";

const Documentation = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({ title: "Copied to clipboard", description: "Code snippet copied successfully" });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const [openApiUrl, setOpenApiUrl] = useState<string>(API_CONFIG.OPENAPI_SPEC);
  const [postmanUrl, setPostmanUrl] = useState<string>(API_CONFIG.POSTMAN_COLLECTION);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      setIsChecking(true);
      try {
        // Try static files first (no cold-start), fall back to edge function
        const [specHead, postmanHead] = await Promise.allSettled([
          fetch('/openapi.json', { method: 'HEAD' }),
          fetch(API_CONFIG.POSTMAN_COLLECTION, { method: 'HEAD' }),
        ]);

        // Direct backend — no fallback needed, BASE_URL is already the direct Supabase URL

        if (!cancelled) {
          setOpenApiUrl(specHead.status === 'fulfilled' && specHead.value.ok ? '/openapi.json' : API_CONFIG.OPENAPI_SPEC);
          setPostmanUrl(postmanHead.status === 'fulfilled' && postmanHead.value.ok ? API_CONFIG.POSTMAN_COLLECTION : API_CONFIG.POSTMAN_COLLECTION);
        }
      } catch {
        if (!cancelled) {
          setOpenApiUrl('/openapi.json');
          setPostmanUrl(API_CONFIG.POSTMAN_COLLECTION);
        }
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };
    check();
    return () => { cancelled = true; };
  }, []);

  const CopyButton = ({ text, id }: { text: string; id: string }) => (
    <Button variant="ghost" size="sm" onClick={() => copyToClipboard(text, id)} className="h-7 px-2">
      {copiedId === id ? <CheckCircle2 className="h-3.5 w-3.5 text-accent" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );

  const CodeBlock = ({ code, id, label }: { code: string; id: string; label?: string }) => (
    <div className="rounded-xl border border-white/10 bg-[#0d1117] text-gray-100 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/10 bg-gray-900">
        <span className="text-xs font-mono text-gray-400 uppercase tracking-wider">{label || 'Example'}</span>
        <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code, id)} className="h-7 px-2 text-gray-400 hover:text-white hover:bg-white/10">
          {copiedId === id ? <CheckCircle2 className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
      </div>
      <pre className="p-4 font-mono text-sm overflow-x-auto whitespace-pre-wrap leading-relaxed text-gray-100">{code}</pre>
    </div>
  );

  const MethodBadge = ({ method }: { method: string }) => {
    const colors: Record<string, string> = {
      GET: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
      POST: "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/30",
      PUT: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
      DELETE: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30",
      PATCH: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
    };
    return <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${colors[method] || colors.GET}`}>{method}</span>;
  };

  const apiDomains = [
    { label: "OAuth & Auth", icon: Lock, path: "/developer/getting-started/authentication", color: "bg-primary/10 text-primary border-primary/20" },
    { label: "AISP (Accounts)", icon: FileText, path: "/developer/api/aisp", color: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20" },
    { label: "PISP (Payments)", icon: CreditCard, path: "/developer/api/pisp", color: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20" },
    { label: "Charges (Collect)", icon: Zap, path: "/developer/gateway/charges", color: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20" },
    { label: "Payouts", icon: Send, path: "/developer/gateway/payouts", color: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20" },
    { label: "Payment Links", icon: ExternalLink, path: "/developer/gateway/payment-links", color: "bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20" },
    { label: "Subscriptions", icon: RefreshCw, path: "/developer/gateway/subscriptions", color: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/20" },
    { label: "Split Payments", icon: Layers, path: "/developer/gateway/split-payments", color: "bg-lime-500/10 text-lime-700 dark:text-lime-400 border-lime-500/20" },
    { label: "Mobile Money", icon: Smartphone, path: "/developer/api/mobile-money", color: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20" },
    { label: "Refunds", icon: DollarSign, path: "/developer/gateway/refunds", color: "bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20" },
    { label: "Beneficiaries", icon: Users, path: "/developer/api/beneficiaries", color: "bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20" },
    { label: "Loans", icon: DollarSign, path: "/credit-api-docs", color: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20" },
    { label: "Savings", icon: TrendingUp, path: "/developer/api/banking", color: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" },
    { label: "Settlements", icon: BarChart3, path: "/developer/gateway/settlements", color: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20" },
    { label: "Disputes", icon: AlertTriangle, path: "/developer/gateway/disputes", color: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20" },
    { label: "Tokenization", icon: Key, path: "/developer/gateway/tokenization", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    { label: "Exports", icon: Download, path: "/developer/api/exports", color: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20" },
    { label: "Risk & Audit", icon: Shield, path: "/developer/api/risk-audit", color: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20" },
    { label: "Certificates", icon: Shield, path: "/guides/certificates", color: "bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20" },
    { label: "Webhooks", icon: Terminal, path: "/developer/api/webhooks", color: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20" },
    { label: "Payment Facilitation", icon: TrendingUp, path: "/developer/payment-facilitation", color: "bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20" },
  ];

  const coreEndpoints = [
    { method: "GET", endpoint: "/v1/aisp/accounts", description: "List accounts linked to a consent (AISP)" },
    { method: "POST", endpoint: "/v1/pisp/domestic-payments", description: "Initiate a domestic payment (PISP)" },
    { method: "POST", endpoint: "/v1/gateway/charges", description: "Create a charge to collect payment" },
    { method: "POST", endpoint: "/v1/gateway/payouts", description: "Initiate a payout to a bank account or mobile wallet" },
    { method: "POST", endpoint: "/v1/gateway/payment-links", description: "Generate a hosted payment link" },
    { method: "POST", endpoint: "/v1/gateway/subscriptions", description: "Create a recurring subscription plan" },
    { method: "POST", endpoint: "/v1/mobile-money/charge", description: "Initiate a mobile money charge" },
    { method: "POST", endpoint: "/v1/payments/refund", description: "Initiate a full or partial refund" },
    { method: "GET", endpoint: "/v1/settlements/reports", description: "Retrieve settlement reports" },
    { method: "GET", endpoint: "/v1/audit/logs", description: "Query the immutable audit trail" },
    { method: "POST", endpoint: "/v1/credit/score", description: "Calculate or retrieve credit score" },
    { method: "POST", endpoint: "/v1/credit/query", description: "B2B institution credit query (with consent)" },
    { method: "GET", endpoint: "/v1/health", description: "API health check (no auth required)" },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="API Documentation"
        description="Complete API reference for Kang Open Banking. RESTful endpoints, authentication guides, code examples, and integration tutorials for Cameroon's banking ecosystem."
        keywords="API documentation, REST API, banking API reference, open banking integration, financial services API, XAF payment gateway, AISP, PISP, payment gateway"
        canonical="https://kangopenbanking.com/documentation"
        structuredData={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          "headline": "Kang Open Banking API Documentation",
          "description": "Complete technical documentation for integrating banking services in Cameroon",
          "author": { "@type": "Organization", "name": "Kang Open Banking" },
          "datePublished": "2025-01-05",
          "dateModified": "2026-02-22"
        }}
      />

      {/* Hero Section */}
      <header className="relative border-b bg-gradient-to-b from-primary/5 via-background to-background">
        <div className="container mx-auto px-4 py-16 max-w-6xl">
          <div className="flex items-center gap-2 mb-6">
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25 font-semibold">
              <BookOpen className="h-3 w-3 mr-1.5" />
              API Reference v1.0
            </Badge>
            <Badge variant="outline" className="bg-accent/10 text-accent border-accent/25 font-semibold">
              OpenAPI 3.1
            </Badge>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            API Documentation
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mb-8">
            Build powerful financial integrations with Kang Open Banking's unified API. 
            35+ endpoints across payments, accounts, credit scoring, and more.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link to="/developer/getting-started">
                <Zap className="mr-2 h-4 w-4" />
                Quickstart Guide
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild>
              <Link to="/developer/api-explorer">
                <Terminal className="mr-2 h-4 w-4" />
                API Explorer
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild disabled={isChecking}>
              <a href={openApiUrl} download>
                <Download className="mr-2 h-4 w-4" />
                OpenAPI Spec
              </a>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-6xl space-y-12">

        {/* Developer Portal CTA */}
        <section>
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-background to-primary/5">
            <CardContent className="flex flex-col md:flex-row items-center gap-6 p-8">
              <div className="flex-shrink-0 h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <Layers className="h-7 w-7 text-primary" />
              </div>
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-xl font-bold mb-1">Developer Portal</h2>
                <p className="text-muted-foreground">
                  Explore integration types, use cases, SDKs, code samples, security practices, and more — all in one place. Sign up to unlock sandbox access and advanced features.
                </p>
              </div>
              <Button asChild size="lg" className="shrink-0">
                <Link to="/developer">
                  Visit Portal
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Base URLs */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Base URLs</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-accent text-accent-foreground">Production</Badge>
              </div>
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3 font-mono text-sm">
                <code>https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1</code>
                <CopyButton text="https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1" id="prod" />
              </div>
            </div>
            <div className="rounded-xl border p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline">Sandbox</Badge>
              </div>
              <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3 font-mono text-sm">
                <code>https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/v1</code>
                <CopyButton text="https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/v1" id="sandbox" />
              </div>
            </div>
          </div>
        </section>

        {/* API Domains */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">API Domains</h2>
            <Link to="/developer" className="text-sm text-primary hover:underline flex items-center gap-1">
              Full Developer Portal <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Card className="rounded-xl">
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-2.5">
                {apiDomains.map((domain) => (
                  <Link key={domain.label} to={domain.path}>
                    <Badge
                      variant="outline"
                      className={`${domain.color} px-3.5 py-2 text-sm font-medium cursor-pointer hover:opacity-80 transition-all hover:scale-[1.02] flex items-center gap-2`}
                    >
                      <domain.icon className="h-3.5 w-3.5" />
                      {domain.label}
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Quick Start Steps */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Register", desc: "Create a developer account for your institution", icon: Building2, cta: "Register", path: "/register" },
              { step: "2", title: "Get API Keys", desc: "Generate sandbox and production credentials", icon: Key, cta: "Developer Portal", path: "/developer" },
              { step: "3", title: "Integrate", desc: "Make your first API call using our SDKs or REST", icon: Code, cta: "Quickstart", path: "/developer/getting-started" },
            ].map(item => (
              <Card key={item.step} className="rounded-xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">{item.step}</span>
                    </div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={item.path}>
                      {item.cta} <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Authentication */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Authentication</h2>
          <Card className="rounded-xl">
            <CardHeader>
              <CardTitle className="text-lg">OAuth 2.0 with Dynamic Client Registration</CardTitle>
              <CardDescription>Secure authentication using industry-standard OAuth 2.0 flows</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <CodeBlock
                label="Token Request"
                id="auth-token"
                code={`POST /v1/oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET&scope=accounts+payments`}
              />
              <div className="grid md:grid-cols-3 gap-3">
                {[
                  { grant: "client_credentials", desc: "Server-to-server, no user context" },
                  { grant: "authorization_code", desc: "User-delegated access (AISP/PISP)" },
                  { grant: "refresh_token", desc: "Rotate expired access tokens" },
                ].map(g => (
                  <div key={g.grant} className="border rounded-lg p-3">
                    <code className="text-xs font-bold text-primary">{g.grant}</code>
                    <p className="text-xs text-muted-foreground mt-1">{g.desc}</p>
                  </div>
                ))}
              </div>
              <div className="bg-primary/5 border-l-4 border-primary p-4 rounded-r-lg">
                <p className="text-sm font-semibold mb-1">Dynamic Client Registration (DCR)</p>
                <p className="text-sm text-muted-foreground">
                  Register your TPP programmatically via <code className="bg-muted px-1.5 py-0.5 rounded text-xs">POST /v1/dcr/register</code>.{" "}
                  <Link to="/developer/getting-started/authentication" className="text-primary hover:underline">Full auth guide →</Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Core Endpoints */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold">Core Endpoints</h2>
            <Link to="/developer/api-explorer" className="text-sm text-primary hover:underline flex items-center gap-1">
              Try in Explorer <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Card className="rounded-xl overflow-hidden">
            <div className="divide-y">
              {coreEndpoints.map((ep, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors">
                  <MethodBadge method={ep.method} />
                  <code className="font-mono text-sm font-medium flex-shrink-0">{ep.endpoint}</code>
                  <span className="text-sm text-muted-foreground hidden md:inline">{ep.description}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {/* Sample Request */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Example Request</h2>
          <CodeBlock
            label="cURL — Initiate a Charge"
            id="example-charge"
            code={`curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 50000,
    "currency": "XAF",
    "customer_email": "user@example.com",
    "payment_method": "mobile_money",
    "metadata": { "order_id": "ord_123" }
  }'`}
          />
        </section>

        {/* Response Format */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Response Format</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <CodeBlock
              label="Success Response"
              id="resp-success"
              code={`{
  "data": [ ... ],
  "pagination": {
    "total": 142,
    "limit": 25,
    "offset": 0,
    "has_more": true
  }
}`}
            />
            <CodeBlock
              label="Error Response (RFC 7807)"
              id="resp-error"
              code={`{
  "error": "insufficient_funds",
  "error_code": "PISP_004",
  "message": "Insufficient funds for this payment.",
  "details": {
    "available_balance": 25000,
    "requested_amount": 50000,
    "currency": "XAF"
  },
  "error_id": "err_a1b2c3d4",
  "timestamp": "2026-02-22T10:30:00Z"
}`}
            />
          </div>
        </section>

        {/* API Integrations / Downloads */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Tools & Downloads</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { title: "OpenAPI Spec", desc: "Complete API specification in OpenAPI 3.1 format", icon: Code, action: "Download JSON", href: openApiUrl, download: true },
              { title: "Postman Collection", desc: "Import all endpoints into Postman with one click", icon: Download, action: "Download", href: postmanUrl, download: true },
              { title: "API Explorer", desc: "Test endpoints in your browser with Swagger UI", icon: BookOpen, action: "Open Explorer", href: "/developer/api-explorer", internal: true },
              { title: "SDK Generator", desc: "Generate client SDKs in multiple languages", icon: Terminal, action: "Generate", href: `https://editor.swagger.io/?url=${openApiUrl}`, external: true },
            ].map(tool => (
              <Card key={tool.title} className="rounded-xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6 space-y-3">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <tool.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold">{tool.title}</h3>
                  <p className="text-xs text-muted-foreground">{tool.desc}</p>
                  {tool.internal ? (
                    <Button variant="outline" size="sm" asChild>
                      <Link to={tool.href!}>{tool.action} <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" asChild disabled={isChecking}>
                      <a href={tool.href} {...(tool.download ? { download: true } : { target: "_blank", rel: "noopener noreferrer" })}>
                        {tool.action} <ArrowRight className="ml-1.5 h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Payment Gateway Highlight */}
        <section>
          <Card className="rounded-xl border-primary/30 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="py-8">
              <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <Zap className="h-6 w-6 text-primary" />
                    <h3 className="text-xl font-bold">Payment Gateway</h3>
                    <Badge variant="outline" className="bg-primary/10 text-primary border-primary/25">35+ Endpoints</Badge>
                  </div>
                  <p className="text-muted-foreground">
                    Full-featured payment gateway with charges, payouts, subscriptions, payment links, split payments, 
                    disputes, refunds, settlements, and tokenization — all in XAF.
                  </p>
                </div>
                <div className="flex gap-3">
                  <Button asChild>
                    <Link to="/developer/gateway/quickstart">
                      Gateway Docs <ArrowRight className="ml-1.5 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/developer/gateway/charges">
                      Charges API
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* mTLS / Certificates */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            mTLS & FAPI 1.0 Advanced
          </h2>
          <Card className="rounded-xl">
            <CardContent className="pt-6 space-y-4">
              <div className="bg-accent/10 border-l-4 border-accent p-4 rounded-r-lg">
                <p className="text-sm font-semibold">Certificate-bound access tokens (RFC 8705) required for production.</p>
              </div>
              <div className="grid md:grid-cols-3 gap-4">
                {[
                  { ep: "POST /v1/certificates/upload", desc: "Register a new X.509 client certificate" },
                  { ep: "GET /v1/certificates/list", desc: "Retrieve all registered certificates" },
                  { ep: "POST /v1/certificates/revoke", desc: "Revoke a certificate and invalidate tokens" },
                ].map(c => (
                  <div key={c.ep} className="border rounded-lg p-4 space-y-1">
                    <code className="text-xs font-mono font-semibold text-primary">{c.ep}</code>
                    <p className="text-xs text-muted-foreground">{c.desc}</p>
                  </div>
                ))}
              </div>
              <div className="flex gap-3">
                <Button variant="outline" size="sm" asChild>
                  <Link to="/developer/certificates">Manage Certificates</Link>
                </Button>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/guides/certificates">Certificate Guide</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Credit Scoring API */}
        <section>
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary" />
            Credit Scoring API
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg">Consumer Credit Score</CardTitle>
                <CardDescription>7-factor scoring model (300–850 range)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { range: "300-579", label: "Poor", color: "bg-red-500/15 border-red-500/30" },
                    { range: "580-669", label: "Fair", color: "bg-orange-500/15 border-orange-500/30" },
                    { range: "670-739", label: "Good", color: "bg-yellow-500/15 border-yellow-500/30" },
                    { range: "740-799", label: "Very Good", color: "bg-green-500/15 border-green-500/30" },
                    { range: "800-850", label: "Excellent", color: "bg-accent/15 border-accent/30" },
                  ].map(s => (
                    <div key={s.range} className={`border rounded-lg p-2 text-center ${s.color}`}>
                      <p className="text-[10px] text-muted-foreground">{s.range}</p>
                      <p className="text-xs font-semibold">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/developer/payment-facilitation">Full Credit API Docs <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-xl border-primary/30 bg-primary/5">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-primary text-primary-foreground">B2B API</Badge>
                </div>
                <CardTitle className="text-lg">Institution Credit Query</CardTitle>
                <CardDescription>For banks and fintechs to query customer credit with consent</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { tier: "Standard", price: "50 XAF", queries: "5K/day" },
                    { tier: "Premium", price: "35 XAF", queries: "50K/day" },
                    { tier: "Enterprise", price: "25 XAF", queries: "Unlimited" },
                  ].map(t => (
                    <div key={t.tier} className="border rounded-lg p-2.5 text-center bg-background">
                      <p className="text-xs font-semibold">{t.tier}</p>
                      <p className="text-lg font-bold">{t.price}</p>
                      <p className="text-[10px] text-muted-foreground">{t.queries}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" asChild>
                  <Link to="/credit-api-docs">Full B2B Docs <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Loans & Savings */}
        <section>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-primary" /> Loans API
                </CardTitle>
                <CardDescription>Application, calculation, repayment, and auto credit check</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {["POST /v1/loans/apply — Auto credit decision", "POST /v1/loans/calculate — Preview terms & schedule", "POST /v1/loans/repay — Process repayment"].map(ep => (
                  <div key={ep} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <code className="font-mono text-xs">{ep}</code>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link to="/credit-api-docs">Loans Documentation <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>

            <Card className="rounded-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Wallet className="h-5 w-5 text-primary" /> Savings API
                </CardTitle>
                <CardDescription>Savings accounts with interest calculation & credit score bonuses</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {["POST /v1/savings/create — Open savings account", "POST /v1/savings/deposit — Make a deposit", "GET /v1/savings/interest — View accrued interest"].map(ep => (
                  <div key={ep} className="flex items-center gap-2 text-sm">
                    <ChevronRight className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                    <code className="font-mono text-xs">{ep}</code>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="mt-2" asChild>
                  <Link to="/developer/api/banking">Banking API Docs <ArrowRight className="ml-1.5 h-3 w-3" /></Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Communication API */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Communication API</h2>
          <Card className="rounded-xl">
            <CardContent className="pt-6 space-y-4">
              <CodeBlock
                label="Send Communication"
                id="comm-send"
                code={`POST /v1/communications/send
Authorization: Bearer YOUR_ACCESS_TOKEN
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440050

{
  "template_key": "user_welcome",
  "recipient_email": "user@example.com",
  "variables": {
    "user_name": "John Doe",
    "platform_name": "Kang Open Banking"
  }
}`}
              />
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                {["user_welcome", "institution_approved", "consent_created", "payment_initiated", "mfa_code"].map(t => (
                  <div key={t} className="border rounded-lg p-2.5 text-center">
                    <code className="text-xs font-medium">{t}</code>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Integration Ecosystem */}
        <section>
          <h2 className="text-2xl font-bold mb-4">Integration Ecosystem</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { title: "SDKs & Libraries", desc: "TypeScript, Python, PHP, Java, Go", icon: Code, path: "/developer/guides/sdks" },
              { title: "No-Code", desc: "Zapier, Make.com, Bubble.io, Retool", icon: Layers, path: "/integrations" },
              { title: "E-Commerce", desc: "WooCommerce plugin for XAF payments", icon: Globe, path: "/woo-for-kang" },
            ].map(item => (
              <Card key={item.title} className="rounded-xl hover:shadow-md transition-shadow">
                <CardContent className="pt-6 space-y-3">
                  <item.icon className="h-8 w-8 text-primary" />
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                  <Link to={item.path} className="text-sm text-primary hover:underline flex items-center gap-1">
                    Learn more <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section>
          <Card className="rounded-xl border-2 bg-gradient-to-br from-primary/5 to-accent/5">
            <CardContent className="py-10 text-center space-y-4">
              <Code className="h-12 w-12 text-primary mx-auto" />
              <h3 className="text-2xl font-bold">Ready to Build?</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Start integrating Kang Open Banking API into your application today
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <Button variant="outline" asChild>
                  <Link to="/contact">Contact Support</Link>
                </Button>
                <Button asChild>
                  <Link to="/developer">
                    Developer Portal <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
};

export default Documentation;
