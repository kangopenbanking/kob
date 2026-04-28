import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Brain, Copy, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { SEO } from "@/components/SEO";

const AIIntegrationGuide = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string>("");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "Code copied successfully",
    });
    setTimeout(() => setCopiedId(""), 2000);
  };

  const prompts = {
    chatgpt: `I want to integrate Kang Open Banking API into my application. Here's what I need:

1. Access account information for Cameroon bank accounts
2. Initiate payments in XAF currency
3. Integrate mobile money (MTN, Orange Money)

API Details:
- Base URL: https://api.kangopenbanking.com/v1
- OpenAPI Spec: https://kangopenbanking.com/openapi.json
- Authentication: OAuth 2.0
- Documentation: https://kangopenbanking.com/developer

Please help me:
- Set up OAuth authentication
- Fetch account balances
- Initiate a payment
- Handle mobile money transactions`,

    claude: `I'm building a fintech app for Cameroon and need to integrate Kang Open Banking API.

Requirements:
- AISP: Account information service
- PISP: Payment initiation
- Mobile Money: MTN, Orange Money
- Credit Scoring integration

API Reference:
OpenAPI: https://kangopenbanking.com/openapi.json
Docs: https://kangopenbanking.com/developer
Auth: OAuth 2.0 with PKCE

Show me:
1. Complete authentication flow
2. Account data fetching
3. Payment initiation
4. Error handling`,

    cursor: `// Kang Open Banking API Integration
// OpenAPI Spec: https://kangopenbanking.com/openapi.json
// Base URL: https://api.kangopenbanking.com/v1

// Generate code for:
// 1. OAuth 2.0 authentication with PKCE
// 2. Fetch account balances
// 3. Get transaction history
// 4. Initiate XAF payment
// 5. Mobile money charge (MTN/Orange)

// Include TypeScript types and error handling`,

    copilot: `/* Kang Open Banking API - Cameroon
 * API Spec: https://kangopenbanking.com/openapi.json
 * Auth: OAuth 2.0
 * Currencies: XAF (Central African Franc)
 */

// Implement the following functions:
// - authenticateUser(): OAuth 2.0 flow
// - getAccounts(): Fetch user accounts
// - getBalance(accountId): Get account balance
// - initiatePayment(amount, recipient): Start payment
// - chargeMobileMoney(phone, amount, provider): MTN/Orange charge
`
  };

  return (
    <>
      <SEO
        title="AI Agent Integration Guide - Kang Open Banking"
        description="Complete guide for integrating Kang Open Banking API with AI coding assistants like ChatGPT, Claude, Cursor, and GitHub Copilot. Includes prompts and examples."
        keywords="AI integration, ChatGPT API, Claude API, Cursor AI, GitHub Copilot, AI coding assistant, API integration prompts"
        canonical="https://kangopenbanking.com/developer/ai-integration-guide"
      />

      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Brain className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold">AI Agent Integration Guide</h1>
          </div>
          <p className="text-lg text-muted-foreground">
            Use KOB API with AI coding assistants like ChatGPT, Claude, Cursor, and GitHub Copilot
          </p>
        </div>

        <Alert className="mb-6">
          <Brain className="h-4 w-4" />
          <AlertDescription>
            KOB API is fully optimized for AI agent discovery. Our OpenAPI specification is available at{" "}
            <code className="text-sm bg-muted px-1 py-0.5 rounded">https://kangopenbanking.com/openapi.json</code>{" "}
            and includes detailed descriptions for all endpoints.
          </AlertDescription>
        </Alert>

        <div className="grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Quick Start with AI Assistants</CardTitle>
              <CardDescription>
                Copy these prompts to quickly integrate KOB API using your favorite AI coding assistant
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="chatgpt" className="w-full">
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="chatgpt">ChatGPT</TabsTrigger>
                  <TabsTrigger value="claude">Claude</TabsTrigger>
                  <TabsTrigger value="cursor">Cursor</TabsTrigger>
                  <TabsTrigger value="copilot">Copilot</TabsTrigger>
                </TabsList>

                {Object.entries(prompts).map(([key, prompt]) => (
                  <TabsContent key={key} value={key} className="space-y-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{prompt}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(prompt, key)}
                      >
                        {copiedId === key ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>API Discovery Endpoints</CardTitle>
              <CardDescription>
                Standard endpoints that AI agents use to discover and understand APIs
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold flex items-center gap-2">
                  OpenAPI Specification
                </h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <code className="text-sm">https://kangopenbanking.com/openapi.json</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://kangopenbanking.com/openapi.json', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">AI Plugin Manifest (ChatGPT)</h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <code className="text-sm">https://kangopenbanking.com/.well-known/ai-plugin.json</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://kangopenbanking.com/.well-known/ai-plugin.json', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">APIs.json Discovery</h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <code className="text-sm">https://kangopenbanking.com/apis.json</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://kangopenbanking.com/apis.json', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Postman Collection</h3>
                <div className="bg-muted p-3 rounded-lg flex items-center justify-between">
                  <code className="text-sm">https://api.kangopenbanking.com/v1/postman-collection</code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open('https://api.kangopenbanking.com/v1/postman-collection', '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Best Practices for AI-Assisted Integration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">1. Always Reference the OpenAPI Spec</h3>
                <p className="text-sm text-muted-foreground">
                  Include the OpenAPI URL in your prompts so the AI has access to the latest API documentation
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">2. Specify Authentication Requirements</h3>
                <p className="text-sm text-muted-foreground">
                  Mention OAuth 2.0 with PKCE and include consent requirements for banking operations
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">3. Include Error Handling</h3>
                <p className="text-sm text-muted-foreground">
                  Ask the AI to implement proper error handling for rate limits, authentication failures, and API errors
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">4. Request TypeScript Types</h3>
                <p className="text-sm text-muted-foreground">
                  For better type safety, ask the AI to generate TypeScript interfaces from the OpenAPI schema
                </p>
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">5. Test in Sandbox First</h3>
                <p className="text-sm text-muted-foreground">
                  Always use sandbox credentials for testing AI-generated code before production deployment
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Example AI-Generated Code</CardTitle>
              <CardDescription>
                Sample output from AI assistants integrating KOB API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                <code>{`// TypeScript example generated by AI assistant
import axios from 'axios';

interface KOBConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}

class KangOpenBanking {
  private baseUrl = 'https://api.kangopenbanking.com/v1';
  private accessToken: string | null = null;

  constructor(private config: KOBConfig) {}

  async authenticate(code: string): Promise<void> {
    const response = await axios.post(
      \`\${this.baseUrl}/functions/v1/oauth-token\`,
      new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );
    this.accessToken = response.data.access_token;
  }

  async getAccounts(consentId: string) {
    if (!this.accessToken) throw new Error('Not authenticated');
    
    const response = await axios.get(
      \`\${this.baseUrl}/v1/aisp/accounts\`,
      {
        headers: {
          Authorization: \`Bearer \${this.accessToken}\`,
          'x-consent-id': consentId,
        },
      }
    );
    return response.data.accounts;
  }

  async getBalance(accountId: string, consentId: string) {
    if (!this.accessToken) throw new Error('Not authenticated');
    
    const response = await axios.get(
      \`\${this.baseUrl}/v1/aisp/accounts/\${accountId}/balances\`,
      {
        headers: {
          Authorization: \`Bearer \${this.accessToken}\`,
          'x-consent-id': consentId,
        },
      }
    );
    return response.data.balances;
  }
}

// Usage
const kob = new KangOpenBanking({
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret',
  redirectUri: 'https://yourapp.com/callback',
});

// After OAuth callback
await kob.authenticate(authCode);
const accounts = await kob.getAccounts('consent_abc123');
const balance = await kob.getBalance(accounts[0].accountId, 'consent_abc123');`}</code>
              </pre>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Need Help?</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If you encounter issues using AI assistants with KOB API, we're here to help:
              </p>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/contact">
                    Contact Support
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/developer">
                    Full Documentation
                  </a>
                </Button>
                <Button variant="outline" className="w-full justify-start" asChild>
                  <a href="/developer/api-explorer">
                    API Explorer
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
};

export default AIIntegrationGuide;
