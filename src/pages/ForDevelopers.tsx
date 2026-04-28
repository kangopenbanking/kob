import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import {
  Code,
  Zap,
  Shield,
  BookOpen,
  Terminal,
  ExternalLink,
  Download,
  Rocket,
  CheckCircle,
  ArrowRight,
  Copy,
  Globe,
  Lock,
  Clock
} from "lucide-react";
import { ApiStatusBadge } from "@/components/ApiStatusBadge";
import { API_CONFIG } from "@/config/api";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

export default function ForDevelopers() {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied!",
      description: "Code copied to clipboard",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const quickStartCode = `curl -X POST "https://api.kangopenbanking.com/v1/oauth-token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d 'grant_type=client_credentials&client_id=YOUR_CLIENT_ID&client_secret=YOUR_CLIENT_SECRET'`;

  const exampleRequest = `curl -X GET "https://api.kangopenbanking.com/v1/aisp/accounts" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "x-consent-id: consent_abc123" \\
  -H "Content-Type: application/json"`;

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-accent py-24">
        <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:32px_32px]"></div>
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center">
            <Badge variant="outline" className="mb-6 border-white/30 bg-white/10 text-white">
              <Globe className="h-4 w-4 mr-2" />
              Banking API for Africa
            </Badge>
            <h1 className="text-5xl md:text-6xl font-bold mb-6 text-white">
              Start Building in 5 Minutes
            </h1>
            <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
              Production-ready Open Banking API for Cameroon. Access bank accounts, initiate payments, 
              and integrate mobile money with a single unified API.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/developer/quick-start">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                  <Rocket className="mr-2 h-5 w-5" />
                  Quick Start Guide
                </Button>
              </Link>
              <Link to="/developer/api-explorer">
                <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                  <Terminal className="mr-2 h-5 w-5" />
                  Try API Explorer
                </Button>
              </Link>
            </div>
            
            {/* API Status */}
            <div className="flex justify-center">
              <ApiStatusBadge />
            </div>
          </div>
        </div>
      </section>

      {/* Quick Start Code Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">Your First API Call</h2>
              <p className="text-lg text-muted-foreground">
                Get started with just three steps
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <Card>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-primary">1</span>
                  </div>
                  <CardTitle>Register App</CardTitle>
                  <CardDescription>
                    Create a free developer account and register your app
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-primary">2</span>
                  </div>
                  <CardTitle>Get Credentials</CardTitle>
                  <CardDescription>
                    Receive your client_id and client_secret instantly
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader>
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                    <span className="text-2xl font-bold text-primary">3</span>
                  </div>
                  <CardTitle>Make Requests</CardTitle>
                  <CardDescription>
                    Start calling our API with your access token
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>

            {/* Code Examples */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Get Access Token</CardTitle>
                  <CardDescription>Authenticate using OAuth 2.0 client credentials</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(quickStartCode, "token")}
                    >
                      {copiedId === "token" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-sm overflow-x-auto">
                      <code>{quickStartCode}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Call the API</CardTitle>
                  <CardDescription>Use your access token to retrieve account information</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 p-4 rounded-lg relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(exampleRequest, "request")}
                    >
                      {copiedId === "request" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-sm overflow-x-auto">
                      <code>{exampleRequest}</code>
                    </pre>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Resources Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-8 text-center">Developer Resources</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <BookOpen className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>API Documentation</CardTitle>
                  <CardDescription>
                    Complete reference for all endpoints, parameters, and responses
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/documentation">
                    <Button variant="outline" className="w-full">
                      View Docs
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Terminal className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>API Explorer</CardTitle>
                  <CardDescription>
                    Interactive Swagger UI to test endpoints in your browser
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/developer/api-explorer">
                    <Button variant="outline" className="w-full">
                      Open Explorer
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Download className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>OpenAPI Spec</CardTitle>
                  <CardDescription>
                    Download the OpenAPI 3.0 specification for code generation
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" asChild>
                    <a href={API_CONFIG.OPENAPI_SPEC} download>
                      Download JSON
                      <Download className="ml-2 h-4 w-4" />
                    </a>
                  </Button>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Code className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>Code Examples</CardTitle>
                  <CardDescription>
                    Ready-to-use examples in JavaScript, Python, PHP, and more
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/developer/examples">
                    <Button variant="outline" className="w-full">
                      Browse Examples
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <ExternalLink className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>API Catalog</CardTitle>
                  <CardDescription>
                    Browse all 83 available endpoints with descriptions
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/api-catalog">
                    <Button variant="outline" className="w-full">
                      View Catalog
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <Zap className="h-8 w-8 text-primary mb-3" />
                  <CardTitle>API Playground</CardTitle>
                  <CardDescription>
                    Test API calls without writing code - no auth required
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Link to="/developer/playground">
                    <Button variant="outline" className="w-full">
                      Try Playground
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold mb-12 text-center">Why Developers Choose KOB</h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Clock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Fast Response Times</h3>
                <p className="text-muted-foreground">
                  &lt;200ms average API response time with 99.9% uptime SLA
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Lock className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Bank-Grade Security</h3>
                <p className="text-muted-foreground">
                  COBAC compliant, PCI-DSS certified with OAuth 2.0 authentication
                </p>
              </div>

              <div className="text-center">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Comprehensive Docs</h3>
                <p className="text-muted-foreground">
                  OpenAPI spec, Postman collection, code examples, and live support
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-primary to-accent">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold mb-6 text-white">Ready to Start Building?</h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join developers building the future of finance in Africa
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/register">
              <Button size="lg" className="bg-white text-primary hover:bg-white/90">
                <Rocket className="mr-2 h-5 w-5" />
                Create Free Account
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Contact Sales
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
