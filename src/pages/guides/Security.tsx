import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowLeft, Shield, Lock, Key, AlertTriangle, CheckCircle2 } from "lucide-react";

export default function Security() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="max-w-5xl mx-auto">
        <Link to="/documentation" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6">
          <ArrowLeft className="h-4 w-4" />
          Back to Documentation
        </Link>

        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Shield className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Security & Authentication</span>
          </div>
          <h1 className="text-5xl font-bold mb-4">API Security & Authentication</h1>
          <p className="text-xl text-muted-foreground">
            Enterprise-grade security protocols protecting your integration and customer data
          </p>
        </div>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Key className="h-6 w-6 text-primary" />
                OAuth 2.0 & OpenID Connect
              </CardTitle>
              <CardDescription>Industry-standard authorization framework</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                Kang Open Banking implements OAuth 2.0 with OpenID Connect (OIDC) for secure API authentication and authorization. This ensures that only authorized applications can access customer data with explicit consent.
              </p>
              
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold mb-2">Authorization Code Flow</p>
                <ol className="space-y-2 text-sm text-muted-foreground">
                  <li>1. Redirect user to authorization endpoint with your client_id</li>
                  <li>2. User authenticates and grants permissions</li>
                  <li>3. Authorization server returns code to your redirect_uri</li>
                  <li>4. Exchange code for access_token and refresh_token</li>
                  <li>5. Use access_token for API requests</li>
                </ol>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto mt-4">
                <p className="text-xs text-muted-foreground font-semibold uppercase mb-2">Token Request</p>
                <pre className="font-mono text-sm">{`POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=AUTHORIZATION_CODE
&redirect_uri=YOUR_REDIRECT_URI
&client_id=YOUR_CLIENT_ID
&client_secret=YOUR_CLIENT_SECRET`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <h2 className="text-3xl font-bold mb-6">Authentication Methods</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Bearer Token Authentication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  All API requests must include a valid access token in the Authorization header.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  Authorization: Bearer ACCESS_TOKEN
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  Mutual TLS (mTLS)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Enhanced security through client certificate authentication for production environments.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg text-xs">
                  Required for PISP and sensitive operations
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  API Key Authentication
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  API key authentication is available for <strong>sandbox testing only</strong>. Production environments must use OAuth 2.0 Bearer tokens.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg font-mono text-xs">
                  X-API-Key: YOUR_SANDBOX_KEY (sandbox only)
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  JWT Tokens
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  JSON Web Tokens with RS256 signing for stateless, secure authentication.
                </p>
                <div className="bg-muted/50 p-3 rounded-lg text-xs">
                  Access tokens expire after 1 hour
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" />
                Data Encryption & Transport Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-l-4 border-accent bg-accent/5 p-4 rounded">
                <p className="font-semibold mb-2">TLS 1.3 Encryption</p>
                <p className="text-sm text-muted-foreground">
                  All API communications are encrypted using TLS 1.3 with perfect forward secrecy. TLS 1.2 is supported as fallback.
                </p>
              </div>

              <div className="border-l-4 border-accent bg-accent/5 p-4 rounded">
                <p className="font-semibold mb-2">Data at Rest Encryption</p>
                <p className="text-sm text-muted-foreground">
                  All sensitive data is encrypted at rest using AES-256 encryption. Encryption keys are managed using hardware security modules (HSM).
                </p>
              </div>

              <div className="border-l-4 border-accent bg-accent/5 p-4 rounded">
                <p className="font-semibold mb-2">Field-Level Encryption</p>
                <p className="text-sm text-muted-foreground">
                  Sensitive fields like account numbers and personal data are encrypted at the field level for additional security.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Security Best Practices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Rotate API Keys Regularly</p>
                    <p className="text-sm text-muted-foreground">Change API keys and client secrets every 90 days</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Use Environment Variables</p>
                    <p className="text-sm text-muted-foreground">Never hardcode credentials in source code or version control</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Implement Token Refresh</p>
                    <p className="text-sm text-muted-foreground">Use refresh tokens to obtain new access tokens before expiration</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Validate Webhook Signatures</p>
                    <p className="text-sm text-muted-foreground">Always verify webhook signatures to prevent spoofing</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Use HTTPS Everywhere</p>
                    <p className="text-sm text-muted-foreground">Ensure all redirect URIs and webhooks use HTTPS</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Implement Rate Limiting</p>
                    <p className="text-sm text-muted-foreground">Add client-side rate limiting to prevent throttling</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Log Security Events</p>
                    <p className="text-sm text-muted-foreground">Monitor and log authentication failures and suspicious activities</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center gap-2">
                <AlertTriangle className="h-6 w-6 text-yellow-500" />
                Rate Limiting & Throttling
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                API requests are rate-limited to ensure fair usage and system stability. Rate limits are applied per client_id.
              </p>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Sandbox</p>
                  <p className="text-2xl font-bold text-primary">100</p>
                  <p className="text-sm text-muted-foreground">requests per minute</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Production</p>
                  <p className="text-2xl font-bold text-primary">1000</p>
                  <p className="text-sm text-muted-foreground">requests per minute</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">Burst Limit</p>
                  <p className="text-2xl font-bold text-primary">2000</p>
                  <p className="text-sm text-muted-foreground">requests per minute</p>
                </div>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="font-semibold mb-2">Rate Limit Headers</p>
                <pre className="font-mono text-xs">{`X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1704067200`}</pre>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="mb-12">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">Compliance & Certifications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">PCI-DSS Level 1</p>
                  <p className="text-sm text-muted-foreground">Certified for handling payment card data</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">ISO 27001</p>
                  <p className="text-sm text-muted-foreground">Information security management certified</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">COBAC Compliant</p>
                  <p className="text-sm text-muted-foreground">Central African Banking Commission regulations</p>
                </div>
                <div className="border rounded-lg p-4">
                  <p className="font-semibold mb-2">BEAC Approved</p>
                  <p className="text-sm text-muted-foreground">Bank of Central African States authorized</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <div className="flex gap-4">
            <Link to="/guides/pisp" className="flex-1">
              <Button variant="outline" className="w-full">Previous: PISP Guide</Button>
            </Link>
            <Link to="/guides/webhooks" className="flex-1">
              <Button className="w-full">Next: Webhooks Guide</Button>
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
