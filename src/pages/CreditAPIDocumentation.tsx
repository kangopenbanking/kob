import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { TrendingUp, Shield, AlertTriangle, CheckCircle2, Clock, DollarSign, Key, Book, ArrowRight, Copy, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { toast } from "sonner";
import { CreditApiEndpoint } from "@/components/credit-api/CreditApiEndpoint";
import { PricingCalculator } from "@/components/credit-api/PricingCalculator";
import { ScoreResponsePreview } from "@/components/credit-api/ScoreResponsePreview";
import { ConsentFlowDiagram } from "@/components/credit-api/ConsentFlowDiagram";

export default function CreditAPIDocumentation() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      {/* Hero Section */}
      <section className="py-20 px-4 border-b">
        <div className="max-w-6xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            <Shield className="h-3 w-3 mr-1" />
            For Financial Institutions Only
          </Badge>
          <h1 className="text-5xl font-bold mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Credit Scoring API Documentation
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-8">
            Securely access verified customer credit scores (300-850) for instant lending decisions. 
            Powered by hybrid scoring: 70% KOB internal data + 30% NjangiBox credit bureau.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button size="lg" asChild>
              <Link to="/admin/credit-management">
                <Key className="mr-2 h-5 w-5" />
                Get API Credentials
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="https://github.com/kob-platform/credit-api-examples" target="_blank" rel="noopener">
                <Book className="mr-2 h-5 w-5" />
                Code Examples
              </a>
            </Button>
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-12 space-y-16">
        {/* Quick Start Guide */}
        <section>
          <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
            <ArrowRight className="h-8 w-8 text-accent" />
            Quick Start Guide
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { step: "1", title: "Register", desc: "Admin creates API client credentials", icon: Key },
              { step: "2", title: "Authenticate", desc: "Get Bearer token (1-hour expiry)", icon: Shield },
              { step: "3", title: "Query Score", desc: "Request with user consent", icon: TrendingUp },
              { step: "4", title: "Monitor Usage", desc: "Track queries & billing", icon: DollarSign }
            ].map((item) => (
              <Card key={item.step} className="border-2 hover:border-primary transition-colors">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <span className="text-3xl font-bold text-muted-foreground">{item.step}</span>
                  </div>
                  <h3 className="font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Authentication Section */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Authentication</h2>
          <CreditApiEndpoint
            method="POST"
            endpoint="/v1/credit/auth"
            description="Authenticate using your API credentials to receive a Bearer token"
            requestBody={{
              api_key: "kob_live_abc123def456",
              api_secret: "your_secret_here"
            }}
            response={{
              access_token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
              token_type: "Bearer",
              expires_in: 3600,
              client_info: {
                client_id: "uuid-here",
                client_name: "ABC Bank",
                pricing_tier: "standard",
                allowed_operations: ["score_query", "report_query"]
              }
            }}
            codeExamples={[
              {
                language: "curl",
                code: `curl -X POST https://api.kangopenbanking.com/v1/credit/auth \\
  -H "Content-Type: application/json" \\
  -d '{
    "api_key": "kob_live_abc123def456",
    "api_secret": "your_secret_here"
  }'`
              },
              {
                language: "javascript",
                code: `const response = await fetch('/v1/credit/auth', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    api_key: process.env.CREDIT_API_KEY,
    api_secret: process.env.CREDIT_API_SECRET
  })
});

const { access_token } = await response.json();`
              },
              {
                language: "python",
                code: `import requests

response = requests.post(
    'https://api.kangopenbanking.com/v1/credit/auth',
    json={
        'api_key': os.getenv('CREDIT_API_KEY'),
        'api_secret': os.getenv('CREDIT_API_SECRET')
    }
)

data = response.json()
access_token = data['access_token']`
              }
            ]}
          />
        </section>

        {/* Credit Score Query Section */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Query Credit Score</h2>
          <CreditApiEndpoint
            method="POST"
            endpoint="/v1/credit/query"
            description="Query a customer's credit score with their explicit consent"
            parameters={[
              { name: "Authorization", type: "header", required: true, description: "Bearer {access_token}" }
            ]}
            requestBody={{
              user_identifier: "customer@email.com",
              consent_reference: "consent_xyz789",
              purpose: "loan_application"
            }}
            response={{
              user_id: "uuid-here",
              credit_score: 725,
              score_range: "Good (670-739)",
              scoring_model: "blended",
              confidence_level: 0.91,
              risk_category: "medium",
              calculated_at: "2026-01-15T10:30:00Z",
              inquiry_id: "inq_uuid",
              next_update_date: "2026-02-14",
              external_bureau_used: true
            }}
            codeExamples={[
              {
                language: "curl",
                code: `curl -X POST https://api.kangopenbanking.com/v1/credit/query \\
  -H "Authorization: Bearer eyJhbGc..." \\
  -H "Content-Type: application/json" \\
  -d '{
    "user_identifier": "customer@email.com",
    "consent_reference": "consent_xyz789",
    "purpose": "loan_application"
  }'`
              },
              {
                language: "javascript",
                code: `const response = await fetch('/v1/credit/query', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${access_token}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    user_identifier: 'customer@email.com',
    consent_reference: 'consent_xyz789',
    purpose: 'loan_application'
  })
});

const scoreData = await response.json();
console.log('Credit Score:', scoreData.credit_score);`
              }
            ]}
          />

          <div className="mt-8">
            <ScoreResponsePreview />
          </div>
        </section>

        {/* Pricing & Billing */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Pricing & Billing</h2>
          <Card>
            <CardHeader>
              <CardTitle>Tier Comparison</CardTitle>
              <CardDescription>Choose the plan that fits your query volume</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Tier</th>
                      <th className="text-left py-3 px-4">Queries/Day</th>
                      <th className="text-left py-3 px-4">Cost per Query</th>
                      <th className="text-left py-3 px-4">Monthly (1,000 queries)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { tier: "Free", queries: "100", cost: "0 XAF", monthly: "0 XAF", badge: "Trial" },
                      { tier: "Standard", queries: "5,000", cost: "50 XAF", monthly: "50,000 XAF", badge: null },
                      { tier: "Premium", queries: "50,000", cost: "35 XAF", monthly: "35,000 XAF", badge: "Popular" },
                      { tier: "Enterprise", queries: "Unlimited", cost: "25 XAF", monthly: "25,000 XAF", badge: "Best Value" }
                    ].map((row) => (
                      <tr key={row.tier} className="border-b">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{row.tier}</span>
                            {row.badge && <Badge variant="secondary" className="text-xs">{row.badge}</Badge>}
                          </div>
                        </td>
                        <td className="py-3 px-4">{row.queries}</td>
                        <td className="py-3 px-4">{row.cost}</td>
                        <td className="py-3 px-4 font-semibold">{row.monthly}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <div className="mt-8">
            <PricingCalculator />
          </div>
        </section>

        {/* User Consent & Compliance */}
        <section>
          <h2 className="text-3xl font-bold mb-6">User Consent & Compliance</h2>
          <Alert className="mb-6">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> ALL credit score queries require explicit user consent. 
              Querying without valid consent will result in a 403 Forbidden error and may lead to API access suspension.
            </AlertDescription>
          </Alert>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Why Consent is Required</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>GDPR-compliant data protection</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>User transparency and control</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Prevents unauthorized access</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5" />
                  <span>Audit trail compliance</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">What Happens on Query</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span>Hard inquiry logged in database</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span>User notified via email/SMS</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span>Inquiry visible in user's credit report</span>
                </div>
                <div className="flex items-start gap-2">
                  <Clock className="h-4 w-4 text-blue-600 mt-0.5" />
                  <span>Billing event recorded for your account</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <ConsentFlowDiagram />
        </section>

        {/* Dashboard Integration */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Dashboard Integration Example</h2>
          <Card>
            <CardHeader>
              <CardTitle>Loan Application Flow</CardTitle>
              <CardDescription>Sample React implementation for querying credit scores</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="react">
                <TabsList>
                  <TabsTrigger value="react">React</TabsTrigger>
                  <TabsTrigger value="node">Node.js</TabsTrigger>
                </TabsList>
                <TabsContent value="react" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{`// LoanApplicationForm.tsx
import { useState } from 'react';

const checkCreditScore = async (email: string, consentId: string) => {
  // Step 1: Authenticate
  const authRes = await fetch('/v1/credit/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.REACT_APP_CREDIT_API_KEY,
      api_secret: process.env.REACT_APP_CREDIT_API_SECRET
    })
  });
  const { access_token } = await authRes.json();

  // Step 2: Query score
  const scoreRes = await fetch('/v1/credit/query', {
    method: 'POST',
    headers: {
      'Authorization': \`Bearer \${access_token}\`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      user_identifier: email,
      consent_reference: consentId,
      purpose: 'loan_application'
    })
  });

  return await scoreRes.json();
};

export function LoanApplicationForm() {
  const [creditData, setCreditData] = useState(null);
  
  const handleSubmit = async (email: string, consent: string) => {
    const score = await checkCreditScore(email, consent);
    setCreditData(score);
    
    // Use score in underwriting logic
    if (score.credit_score >= 700) {
      console.log('Approved for prime rate');
    }
  };
  
  return (/* Your form UI */);
}`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard("react-example", "react")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="node" className="space-y-4">
                  <div className="relative">
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                      <code>{`// Backend Service (Node.js)
const axios = require('axios');

async function getCreditScore(email, consentRef) {
  try {
    // Authenticate
    const authResponse = await axios.post(
      'https://api.kangopenbanking.com/v1/credit/auth',
      {
        api_key: process.env.CREDIT_API_KEY,
        api_secret: process.env.CREDIT_API_SECRET
      }
    );
    
    const token = authResponse.data.access_token;
    
    // Query score
    const scoreResponse = await axios.post(
      'https://api.kangopenbanking.com/v1/credit/query',
      {
        user_identifier: email,
        consent_reference: consentRef,
        purpose: 'loan_application'
      },
      {
        headers: { Authorization: \`Bearer \${token}\` }
      }
    );
    
    return scoreResponse.data;
  } catch (error) {
    if (error.response?.status === 403) {
      throw new Error('User consent not found or expired');
    }
    throw error;
  }
}

module.exports = { getCreditScore };`}</code>
                    </pre>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard("node-example", "node")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>

        {/* Error Handling */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Error Handling Guide</h2>
          <div className="space-y-4">
            {[
              { code: "400", title: "Bad Request", desc: "Missing required fields (user_identifier, consent_reference)", action: "Verify request body has all required fields" },
              { code: "401", title: "Unauthorized", desc: "Invalid or expired Bearer token", action: "Re-authenticate to get a new token" },
              { code: "403", title: "Forbidden", desc: "User consent not found or expired", action: "Request fresh consent from user" },
              { code: "404", title: "Not Found", desc: "User not found in system", action: "Verify user_identifier is correct" },
              { code: "429", title: "Too Many Requests", desc: "Rate limit exceeded for your tier", action: "Implement exponential backoff or upgrade tier" },
              { code: "500", title: "Server Error", desc: "Internal error processing request", action: "Retry with exponential backoff, contact support if persists" }
            ].map((error) => (
              <Card key={error.code}>
                <CardContent className="py-4">
                  <div className="flex items-start gap-4">
                    <Badge variant="destructive" className="text-lg font-mono">{error.code}</Badge>
                    <div className="flex-1">
                      <h4 className="font-semibold mb-1">{error.title}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{error.desc}</p>
                      <p className="text-sm">
                        <strong>Action:</strong> {error.action}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Security Best Practices */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Security Best Practices</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-red-600" />
                  Don't
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>❌ Expose API secrets in frontend code</div>
                <div>❌ Store tokens in localStorage</div>
                <div>❌ Query scores without user consent</div>
                <div>❌ Share API credentials across environments</div>
                <div>❌ Hardcode credentials in code repositories</div>
              </CardContent>
            </Card>

            <Card className="border-green-200 dark:border-green-900">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                  Do
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div>✅ Keep API secrets in backend environment variables</div>
                <div>✅ Store tokens securely (httpOnly cookies, backend sessions)</div>
                <div>✅ Validate consent_reference before every query</div>
                <div>✅ Use HTTPS-only connections</div>
                <div>✅ Implement request logging and monitoring</div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* FAQ */}
        <section>
          <h2 className="text-3xl font-bold mb-6">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {[
              {
                q: "How accurate are the credit scores?",
                a: "Our hybrid model combines 70% KOB internal transaction data with 30% NjangiBox external credit bureau data. For KYC-verified users with external credit history, accuracy is 91%+. Baseline scores (internal-only) have 75-85% confidence."
              },
              {
                q: "How often are scores updated?",
                a: "Internal scores update in real-time based on transactions. NjangiBox external data is cached for 30 days to optimize costs and performance. A fresh external fetch happens automatically after 30 days."
              },
              {
                q: "What if a customer has no credit history?",
                a: "We generate a baseline score (typically 580-620) based on account activity patterns, KYC verification, and account age. These scores have lower confidence (60-75%) and are labeled as 'baseline' in the response."
              },
              {
                q: "Can we query scores without user consent?",
                a: "No. All queries require explicit user consent for GDPR compliance. Attempting to query without valid consent_reference results in 403 Forbidden and may lead to API suspension."
              },
              {
                q: "How do we handle disputes?",
                a: "Users can dispute credit inquiries through their CrediQ dashboard. Disputes are flagged in your admin panel. You'll be notified if a dispute affects a query you made."
              },
              {
                q: "What's the difference between internal and blended scores?",
                a: "Internal scores use only KOB transaction data (loans, savings, payments). Blended scores add 30% weight from NjangiBox external credit bureau (other banks, credit cards). Blended scores are more accurate and have higher confidence levels."
              }
            ].map((faq, idx) => (
              <Card key={idx}>
                <CardHeader>
                  <CardTitle className="text-lg">{faq.q}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{faq.a}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Support & Resources */}
        <section>
          <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
            <CardHeader>
              <CardTitle className="text-2xl">Support & Resources</CardTitle>
              <CardDescription>Get help and stay updated</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold mb-3">Developer Resources</h4>
                  <div className="space-y-2 text-sm">
                    <a href="/status" className="flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      API Status Page
                    </a>
                    <a href="/admin/credit-management" className="flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      Rate Limit Monitor
                    </a>
                    <a href="https://github.com/kob-platform/credit-api-examples" className="flex items-center gap-2 text-primary hover:underline">
                      <ExternalLink className="h-4 w-4" />
                      Sample Code Repositories
                    </a>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-3">Get Help</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Email:</span>
                      <a href="mailto:api-support@kangopenbanking.com" className="text-primary hover:underline">
                        api-support@kangopenbanking.com
                      </a>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Response Time:</span>
                      <span>{"< 24 hours"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">Support Hours:</span>
                      <span>24/7 for Enterprise tier</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
