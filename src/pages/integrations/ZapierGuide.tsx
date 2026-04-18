import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { ArrowLeft, Zap, Copy, CheckCircle2, AlertCircle } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { InteractiveDemoWidget } from "@/components/developer/InteractiveDemoWidget";

const ZapierGuide = () => {
  const { toast } = useToast();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({
      title: "Copied to clipboard",
      description: "Code snippet copied successfully",
    });
  };

  const webhookUrl = "YOUR_ZAPIER_WEBHOOK_URL";
  const apiBaseUrl = "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1";

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-5xl">
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/integrations">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Integrations
          </Link>
        </Button>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="p-4 rounded-lg bg-orange-500/10">
            <Zap className="h-8 w-8 text-orange-500" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Zapier Integration Guide</h1>
            <p className="text-muted-foreground">
              Connect Kang Open Banking to 5,000+ apps with no code
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle>What You'll Build</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Triggers</h3>
                  <p className="text-sm text-muted-foreground">
                    New transaction, payment received, account created
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Actions</h3>
                  <p className="text-sm text-muted-foreground">
                    Create payment, transfer funds, get account balance
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Difficulty</h3>
                  <Badge variant="secondary">Beginner Friendly</Badge>
                  <p className="text-sm text-muted-foreground mt-2">15-30 minutes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prerequisites */}
          <Card>
            <CardHeader>
              <CardTitle>Prerequisites</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Zapier account (free tier works fine)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Kang Open Banking API credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>OAuth Client ID and Secret (from developer portal)</span>
                </li>
              </ul>
              <Button asChild className="mt-4">
                <Link to="/register">Get API Credentials</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Step-by-Step Guide */}
          <Tabs defaultValue="webhooks" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="webhooks">Webhooks</TabsTrigger>
              <TabsTrigger value="http">HTTP Requests</TabsTrigger>
              <TabsTrigger value="examples">Use Cases</TabsTrigger>
            </TabsList>

            {/* Webhooks Tab */}
            <TabsContent value="webhooks" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Method 1: Using Webhooks (Recommended)</CardTitle>
                  <CardDescription>
                    Perfect for receiving real-time notifications from Kang Open Banking
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Step 1: Create a Webhook Trigger in Zapier</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Log in to Zapier and click "Create Zap"</li>
                      <li>Search for "Webhooks by Zapier" as your trigger</li>
                      <li>Select "Catch Hook" as the trigger event</li>
                      <li>Copy the Webhook URL provided by Zapier</li>
                    </ol>
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Save this webhook URL - you'll need to configure it in your Kang Open Banking dashboard
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h3 className="font-semibold mb-3">Step 2: Configure Webhook in Kang Dashboard</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Go to your Kang Open Banking <Link to="/admin/webhook-management" className="text-primary hover:underline">Webhook Management</Link></li>
                      <li>Click "Create Webhook"</li>
                      <li>Paste your Zapier webhook URL</li>
                      <li>Select events you want to track (e.g., "transaction.created")</li>
                      <li>Save and test the webhook</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Step 3: Test Your Trigger</h3>
                    <p className="text-muted-foreground mb-3">
                      Create a test transaction to verify the webhook is working:
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "bash",
                          label: "cURL",
                          code: `curl -X POST ${apiBaseUrl}/crediq-score \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"type": "transaction", "count": 1}'`
                        }
                      ]}
                    />
                  </div>

                  <Alert className="bg-primary/5 border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      You should see the test data appear in Zapier within seconds!
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* HTTP Requests Tab */}
            <TabsContent value="http" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Method 2: Direct HTTP API Calls</CardTitle>
                  <CardDescription>
                    Make direct API calls to Kang Open Banking from Zapier
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Step 1: Get OAuth Token</h3>
                    <p className="text-muted-foreground mb-3">
                      First, use Zapier's "Webhooks by Zapier" action to get an access token:
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "json",
                          label: "Zapier HTTP Action Config",
                          code: `{
  "url": "${apiBaseUrl}/oauth-token",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "grant_type": "client_credentials",
    "client_id": "{{YOUR_CLIENT_ID}}",
    "client_secret": "{{YOUR_CLIENT_SECRET}}"
  }
}`
                        }
                      ]}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Step 2: Use Token in API Calls</h3>
                    <p className="text-muted-foreground mb-3">
                      Example: Get account balances
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "json",
                          label: "Get Balances",
                          code: `{
  "url": "${apiBaseUrl}/aisp-balances",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer {{access_token}}",
    "Content-Type": "application/json"
  },
  "params": {
    "account_id": "{{account_id}}"
  }
}`
                        }
                      ]}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Step 3: Parse Response Data</h3>
                    <p className="text-muted-foreground mb-3">
                      Zapier will automatically parse JSON responses. You can then use this data in subsequent steps:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Send to Google Sheets</li>
                      <li>Create Slack notification</li>
                      <li>Update CRM records</li>
                      <li>Trigger email campaigns</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Use Cases Tab */}
            <TabsContent value="examples" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Popular Use Cases</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">💰 Transaction Notifications</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Trigger:</strong> New transaction detected (webhook)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Actions:</strong> Send Slack message → Update Google Sheet → Email receipt
                    </p>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📊 Daily Balance Report</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Trigger:</strong> Schedule (every day at 9 AM)
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Actions:</strong> Get balances → Format data → Send email to team
                    </p>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">🔔 Large Payment Alerts</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Trigger:</strong> New transaction webhook
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Actions:</strong> Filter (amount {'>'} $10,000) → Send SMS via Twilio → Log to database
                    </p>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📈 CRM Sync</h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      <strong>Trigger:</strong> New customer account created
                    </p>
                    <p className="text-sm text-muted-foreground">
                      <strong>Actions:</strong> Create Salesforce lead → Add to MailChimp → Send welcome email
                    </p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Troubleshooting */}
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">❌ "401 Unauthorized" Error</h3>
                <p className="text-sm text-muted-foreground">
                  Your OAuth token has expired or is invalid. Regenerate a new token using the OAuth flow.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">❌ Webhook Not Triggering</h3>
                <p className="text-sm text-muted-foreground">
                  Check that your webhook URL is correctly configured and that you've selected the right events in your dashboard.
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-2">❌ Rate Limiting</h3>
                <p className="text-sm text-muted-foreground">
                  Add a delay between API calls if you're hitting rate limits. Zapier has built-in delay actions.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Interactive Demo */}
          <InteractiveDemoWidget
            title="Try It: Zapier Integration"
            description="Test API calls that you can use with Zapier"
            platform="zapier"
            endpoints={[
              {
                id: 'webhook-test',
                name: 'Webhook Test',
                method: 'POST',
                path: 'webhook',
                description: 'Test sending data to your Zapier webhook',
                requiresAuth: false,
                fields: [
                  { name: 'event_type', type: 'select', label: 'Event Type', required: true, options: ['payment.completed', 'account.created', 'transaction.processed'], defaultValue: 'payment.completed' },
                  { name: 'amount', type: 'number', label: 'Amount', placeholder: '10000', defaultValue: 10000 },
                ]
              },
              {
                id: 'account-balance',
                name: 'Get Account Balance',
                method: 'GET',
                path: 'balance',
                description: 'Fetch sample account balance',
                requiresAuth: true,
              },
              {
                id: 'transactions',
                name: 'Get Transactions',
                method: 'GET',
                path: 'transactions',
                description: 'Retrieve recent transactions',
                requiresAuth: true,
              },
              {
                id: 'payment-status',
                name: 'Check Payment Status',
                method: 'GET',
                path: 'payment/status',
                description: 'Query payment status',
                requiresAuth: true,
              },
            ]}
          />

          {/* Video Tutorials hidden until content is published */}

          {/* Next Steps */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Explore API Endpoints</p>
                  <p className="text-sm text-muted-foreground">
                    View all available endpoints in the <Link to="/developer/api-explorer" className="text-primary hover:underline">API Explorer</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Join Community</p>
                  <p className="text-sm text-muted-foreground">
                    Get help from other developers in our <Link to="/contact" className="text-primary hover:underline">community forum</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Try Other Platforms</p>
                  <p className="text-sm text-muted-foreground">
                    Check out our guides for <Link to="/integrations/make" className="text-primary hover:underline">Make.com</Link>, <Link to="/integrations/bubble" className="text-primary hover:underline">Bubble.io</Link>, and <Link to="/integrations/retool" className="text-primary hover:underline">Retool</Link>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ZapierGuide;
