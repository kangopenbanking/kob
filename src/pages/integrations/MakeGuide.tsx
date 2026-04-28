import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { ArrowLeft, Workflow, CheckCircle2, AlertCircle, GitBranch } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { InteractiveDemoWidget } from "@/components/developer/InteractiveDemoWidget";

const MakeGuide = () => {
  const apiBaseUrl = "https://api.kangopenbanking.com/v1";

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
          <div className="p-4 rounded-lg bg-purple-500/10">
            <Workflow className="h-8 w-8 text-purple-500" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Make.com Integration Guide</h1>
            <p className="text-muted-foreground">
              Build complex automation workflows with visual builder
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle>What Makes Make.com Different?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <GitBranch className="h-6 w-6 mb-2 text-purple-500" />
                  <h3 className="font-semibold mb-2">Visual Workflows</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag-and-drop interface with conditional logic and branching
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Data Transformation</h3>
                  <p className="text-sm text-muted-foreground">
                    Built-in tools for filtering, aggregating, and transforming data
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Difficulty</h3>
                  <Badge variant="secondary">Intermediate</Badge>
                  <p className="text-sm text-muted-foreground mt-2">20-45 minutes</p>
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
                  <span>Make.com account (free tier available)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Kang Open Banking API credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Basic understanding of HTTP requests (helpful but not required)</span>
                </li>
              </ul>
              <Button asChild className="mt-4">
                <Link to="/register">Get API Credentials</Link>
              </Button>
            </CardContent>
          </Card>

          {/* Step-by-Step Guide */}
          <Tabs defaultValue="setup" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="setup">Initial Setup</TabsTrigger>
              <TabsTrigger value="workflows">Build Workflows</TabsTrigger>
              <TabsTrigger value="examples">Advanced Examples</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Create HTTP Module Connection</CardTitle>
                  <CardDescription>
                    Make.com uses HTTP modules to connect to REST APIs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">A. Add HTTP Module</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Create a new scenario in Make.com</li>
                      <li>Click the "+" to add a module</li>
                      <li>Search for "HTTP" and select "HTTP - Make a request"</li>
                      <li>This will be your connection to Kang Open Banking API</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">B. Configure OAuth Authentication</h3>
                    <p className="text-muted-foreground mb-3">
                      Create a separate HTTP module to get your access token first:
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "json",
                          label: "OAuth Token Request",
                          code: `{
  "url": "${apiBaseUrl}/oauth-token",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": {
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }
}`
                        }
                      ]}
                    />
                  </div>

                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Save the access token from the response using Make's "Set Variable" module for reuse in your workflow
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h3 className="font-semibold mb-3">C. Make Your First API Call</h3>
                    <p className="text-muted-foreground mb-3">
                      Example: Get account balances
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "json",
                          label: "Get Balances Request",
                          code: `{
  "url": "${apiBaseUrl}/aisp-balances",
  "method": "GET",
  "headers": {
    "Authorization": "Bearer {{access_token}}",
    "Content-Type": "application/json"
  },
  "query": {
    "account_id": "YOUR_ACCOUNT_ID"
  }
}`
                        }
                      ]}
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflows Tab */}
            <TabsContent value="workflows" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Building Smart Workflows</CardTitle>
                  <CardDescription>
                    Use Make's visual builder to create complex automation
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Conditional Logic</h3>
                    <p className="text-muted-foreground mb-3">
                      Add routers and filters to create intelligent workflows:
                    </p>
                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p><strong>If</strong> transaction amount {'>'} $10,000</p>
                      <p className="pl-4"><strong>Then</strong> Send email alert to CFO</p>
                      <p className="pl-4"><strong>And</strong> Create Slack notification</p>
                      <p><strong>Else</strong></p>
                      <p className="pl-4"><strong>Then</strong> Log to Google Sheets only</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Data Transformation</h3>
                    <p className="text-muted-foreground mb-3">
                      Use Make's built-in tools to transform API responses:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li><strong>Text Parser:</strong> Extract specific fields from JSON</li>
                      <li><strong>Math Functions:</strong> Calculate totals, averages, percentages</li>
                      <li><strong>Date Formatter:</strong> Convert timestamps to readable formats</li>
                      <li><strong>Aggregator:</strong> Combine multiple API responses</li>
                    </ul>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Error Handling</h3>
                    <p className="text-muted-foreground mb-3">
                      Add error handlers to make your workflows resilient:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Right-click on any module → Add error handler</li>
                      <li>Choose action: Retry, Rollback, or Custom notification</li>
                      <li>Set retry attempts and delay between retries</li>
                      <li>Log errors to a monitoring tool</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Scheduling</h3>
                    <p className="text-muted-foreground mb-3">
                      Trigger workflows automatically:
                    </p>
                    <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                      <li>Every 15 minutes (for real-time monitoring)</li>
                      <li>Daily at specific time (for reports)</li>
                      <li>On webhook trigger (for instant notifications)</li>
                      <li>Custom cron expressions for complex schedules</li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Examples Tab */}
            <TabsContent value="examples" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Advanced Use Case Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">💸 Multi-Step Payment Processing</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Trigger:</strong> Webhook from payment gateway</p>
                      <p><strong>Step 1:</strong> Verify payment amount matches invoice</p>
                      <p><strong>Step 2:</strong> Create domestic payment via Kang API</p>
                      <p><strong>Step 3:</strong> If successful → Update CRM → Send receipt</p>
                      <p><strong>Step 4:</strong> If failed → Retry 3 times → Alert finance team</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📊 Automated Reconciliation</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Trigger:</strong> Daily at 11 PM</p>
                      <p><strong>Step 1:</strong> Get all transactions from Kang API</p>
                      <p><strong>Step 2:</strong> Get all Stripe payments</p>
                      <p><strong>Step 3:</strong> Match transactions by reference ID</p>
                      <p><strong>Step 4:</strong> Identify discrepancies → Create Jira ticket</p>
                      <p><strong>Step 5:</strong> Generate reconciliation report → Email to accounting</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">🔄 Customer Refund Workflow</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Trigger:</strong> New row in "Refunds" Google Sheet</p>
                      <p><strong>Step 1:</strong> Validate customer exists in Kang API</p>
                      <p><strong>Step 2:</strong> Check refund amount {'<'} original transaction</p>
                      <p><strong>Step 3:</strong> Create payment via Kang API</p>
                      <p><strong>Step 4:</strong> Update Google Sheet with status</p>
                      <p><strong>Step 5:</strong> Send confirmation email to customer</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">🎯 Smart Loan Application Processing</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Trigger:</strong> New loan application webhook</p>
                      <p><strong>Step 1:</strong> Get applicant's transaction history (6 months)</p>
                      <p><strong>Step 2:</strong> Calculate average monthly income</p>
                      <p><strong>Step 3:</strong> Check credit score via Kang API</p>
                      <p><strong>Step 4:</strong> If qualified → Auto-approve → Send offer</p>
                      <p><strong>Step 5:</strong> If not qualified → Send rejection with feedback</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pro Tips for Make.com</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Use Data Stores:</strong> Save API tokens in Make's data store to avoid re-authenticating on every run
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Batch Operations:</strong> Use the Iterator module to process multiple transactions in a single workflow
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Version Control:</strong> Clone scenarios before making changes - Make keeps version history
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Video Tutorials hidden until content is published */}

          {/* Interactive Demo */}
          <InteractiveDemoWidget
            title="Try It: Make.com HTTP Module"
            description="Test API endpoints for Make.com integration"
            platform="make"
            endpoints={[
              {
                id: 'http-test',
                name: 'Connection Test',
                method: 'GET',
                path: 'test',
                description: 'Verify your HTTP module connection',
                requiresAuth: true,
              },
              {
                id: 'create-payment',
                name: 'Create Payment',
                method: 'POST',
                path: 'payment',
                description: 'Initiate a payment transaction',
                requiresAuth: true,
                fields: [
                  { name: 'amount', type: 'number', label: 'Amount', required: true, defaultValue: 5000 },
                  { name: 'currency', type: 'select', label: 'Currency', options: ['XAF', 'USD', 'EUR'], defaultValue: 'XAF' },
                  { name: 'recipient', type: 'text', label: 'Recipient', placeholder: 'John Doe' },
                ]
              },
              {
                id: 'calculate-loan',
                name: 'Loan Calculator',
                method: 'POST',
                path: 'loan/calculate',
                description: 'Calculate loan repayment schedule',
                requiresAuth: false,
                fields: [
                  { name: 'amount', type: 'number', label: 'Loan Amount', required: true, defaultValue: 500000 },
                  { name: 'term_months', type: 'number', label: 'Term (months)', required: true, defaultValue: 12 },
                ]
              },
              {
                id: 'check-credit',
                name: 'Credit Score Check',
                method: 'GET',
                path: 'credit-score',
                description: 'Get sample credit score data',
                requiresAuth: true,
              },
            ]}
          />

          {/* Video Tutorials */}
          <Card className="bg-gradient-to-r from-primary/10 to-primary/5">
            <CardHeader>
              <CardTitle>Next Steps</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Explore All Endpoints</p>
                  <p className="text-sm text-muted-foreground">
                    Browse the full <Link to="/api-catalog" className="text-primary hover:underline">API Catalog</Link> to see all available endpoints
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Test in Playground</p>
                  <p className="text-sm text-muted-foreground">
                    Try API calls without code in our <Link to="/developer/playground" className="text-primary hover:underline">API Playground</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Compare Other Platforms</p>
                  <p className="text-sm text-muted-foreground">
                    See how <Link to="/integrations/zapier" className="text-primary hover:underline">Zapier</Link> and <Link to="/integrations/bubble" className="text-primary hover:underline">Bubble</Link> compare
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

export default MakeGuide;
