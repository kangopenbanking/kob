import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { ArrowLeft, Database, CheckCircle2, AlertCircle, LayoutDashboard } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { InteractiveDemoWidget } from "@/components/developer/InteractiveDemoWidget";

const RetoolGuide = () => {
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
          <div className="p-4 rounded-lg bg-green-500/10">
            <Database className="h-8 w-8 text-green-500" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Retool Integration Guide</h1>
            <p className="text-muted-foreground">
              Create internal tools and admin panels in minutes
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Why Retool for Banking Operations?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <LayoutDashboard className="h-6 w-6 mb-2 text-green-500" />
                  <h3 className="font-semibold mb-2">Admin Dashboards</h3>
                  <p className="text-sm text-muted-foreground">
                    Pre-built components for tables, charts, and forms
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Fast Development</h3>
                  <p className="text-sm text-muted-foreground">
                    Build in hours what would take weeks with traditional code
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Difficulty</h3>
                  <Badge variant="secondary">Beginner</Badge>
                  <p className="text-sm text-muted-foreground mt-2">10-20 minutes</p>
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
                  <span>Retool account (free trial available)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Kang Open Banking API credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>No coding experience required!</span>
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
              <TabsTrigger value="setup">Resource Setup</TabsTrigger>
              <TabsTrigger value="queries">Build Queries</TabsTrigger>
              <TabsTrigger value="examples">Dashboard Examples</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Add Kang API as a Resource</CardTitle>
                  <CardDescription>
                    Resources in Retool are reusable API connections
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">A. Create REST API Resource</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>In Retool, go to Resources (left sidebar)</li>
                      <li>Click "Create new" → "REST API"</li>
                      <li>Name it "Kang Open Banking"</li>
                      <li>Set Base URL to: <code className="bg-muted px-2 py-1 rounded text-xs">{apiBaseUrl}</code></li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">B. Configure Authentication</h3>
                    <p className="text-muted-foreground mb-3">
                      Retool supports OAuth 2.0 natively. Configure it like this:
                    </p>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Authentication Type:</span>
                        <span className="text-muted-foreground">OAuth 2.0</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Grant Type:</span>
                        <span className="text-muted-foreground">Client Credentials</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Access Token URL:</span>
                        <span className="text-muted-foreground font-mono text-xs break-all">{apiBaseUrl}/oauth-token</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Client ID:</span>
                        <span className="text-muted-foreground">Your client ID</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Client Secret:</span>
                        <span className="text-muted-foreground">Your client secret</span>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-primary/5 border-primary/20">
                    <CheckCircle2 className="h-4 w-4 text-primary" />
                    <AlertDescription>
                      Retool will automatically refresh your access token when it expires!
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h3 className="font-semibold mb-3">C. Test the Connection</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Click "Test connection"</li>
                      <li>Retool will attempt to get an OAuth token</li>
                      <li>If successful, click "Save"</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Alternative: Manual Bearer Token</CardTitle>
                  <CardDescription>
                    If you prefer manual token management
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-muted-foreground mb-3">
                      First, get your access token using this cURL command:
                    </p>
                    <CodeBlock
                      examples={[
                        {
                          language: "bash",
                          label: "cURL",
                          code: `curl -X POST ${apiBaseUrl}/oauth-token \\
  -H "Content-Type: application/json" \\
  -d '{
    "grant_type": "client_credentials",
    "client_id": "YOUR_CLIENT_ID",
    "client_secret": "YOUR_CLIENT_SECRET"
  }'`
                        }
                      ]}
                    />
                  </div>
                  <div>
                    <p className="text-muted-foreground mb-3">
                      Then in Retool:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Authentication Type: "Bearer Token"</li>
                      <li>Paste your access token</li>
                      <li>Save the resource</li>
                    </ol>
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Note: You'll need to manually refresh the token when it expires (typically after 1 hour)
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Queries Tab */}
            <TabsContent value="queries" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Creating Queries in Retool</CardTitle>
                  <CardDescription>
                    Queries fetch data from your Kang API resource
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Query 1: Get Account Balances</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Resource:</span>
                        <span className="text-muted-foreground">Kang Open Banking</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Method:</span>
                        <span className="text-muted-foreground">GET</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">URL Path:</span>
                        <span className="text-muted-foreground font-mono">/aisp-balances</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Query Params:</span>
                        <span className="text-muted-foreground font-mono">account_id: {'{{'} textInput1.value {'}}'}</span>
                      </div>
                    </div>
                    <p className="text-muted-foreground mt-3 text-sm">
                      You can parameterize queries using Retool's template syntax {'{{'} component.property {'}}'} 
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Query 2: Get Transactions</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Method:</span>
                        <span className="text-muted-foreground">GET</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">URL Path:</span>
                        <span className="text-muted-foreground font-mono">/api-transactions</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Query Params:</span>
                        <div className="text-muted-foreground font-mono text-xs">
                          <div>account_id: {'{{'} select1.value {'}}'}</div>
                          <div>limit: 50</div>
                          <div>offset: {'{{'} table1.pageOffset {'}}'}</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Query 3: Create Payment (POST)</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Method:</span>
                        <span className="text-muted-foreground">POST</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">URL Path:</span>
                        <span className="text-muted-foreground font-mono">/pisp-domestic-payment</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Body (JSON):</span>
                        <div className="text-muted-foreground">See code below</div>
                      </div>
                    </div>
                    <CodeBlock
                      examples={[
                        {
                          language: "javascript",
                          label: "Request Body",
                          code: `{
  "amount": {{ numberInput1.value }},
  "currency": {{ select2.value }},
  "creditor_name": {{ textInput2.value }},
  "creditor_account": {{ textInput3.value }},
  "reference": {{ textInput4.value }}
}`
                        }
                      ]}
                    />
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Auto-Refresh Queries</h3>
                    <p className="text-muted-foreground mb-3">
                      Set queries to auto-refresh for real-time dashboards:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Click on query → Settings tab</li>
                      <li>Enable "Run query on page load"</li>
                      <li>Enable "Refresh query periodically"</li>
                      <li>Set interval (e.g., every 30 seconds)</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Examples Tab */}
            <TabsContent value="examples" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Complete Dashboard Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📊 Transaction Monitoring Dashboard</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Components:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Table: Display all transactions with pagination</li>
                        <li>Chart: Transaction volume over time</li>
                        <li>Stats: Total transactions, total amount, average</li>
                        <li>Select: Filter by account, date range, status</li>
                      </ul>
                      <p className="mt-2"><strong>Queries:</strong> api-transactions, aisp-balances</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">👥 User Management Panel</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Components:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Table: List all users with search</li>
                        <li>Form: Create new user (admin-create-user endpoint)</li>
                        <li>Modal: Edit user details</li>
                        <li>Button: Assign staff to branches</li>
                      </ul>
                      <p className="mt-2"><strong>Queries:</strong> admin-create-user, admin-assign-staff</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">💳 Payment Processing Tool</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Components:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Form: Enter payment details (amount, recipient, etc.)</li>
                        <li>Button: Submit payment with confirmation modal</li>
                        <li>Table: Recent payments with status</li>
                        <li>Alert: Success/error messages</li>
                      </ul>
                      <p className="mt-2"><strong>Queries:</strong> pisp-domestic-payment, pisp-payment-details</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📈 Analytics Dashboard</h3>
                    <div className="text-sm text-muted-foreground space-y-2">
                      <p><strong>Components:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Line Chart: Transaction trends</li>
                        <li>Pie Chart: Transaction types breakdown</li>
                        <li>Bar Chart: Top merchants by volume</li>
                        <li>KPI Cards: Key metrics at a glance</li>
                      </ul>
                      <p className="mt-2"><strong>Queries:</strong> api-transactions, admin-metrics</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pro Tips for Retool + Kang API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Use Transformers:</strong> Process API responses with JavaScript before displaying (e.g., format dates, calculate totals)
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Keyboard Shortcuts:</strong> Use Cmd/Ctrl + K to quickly add components and queries
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Permissions:</strong> Use Retool's permission groups to control who can view/edit dashboards
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Mobile Apps:</strong> Retool has a mobile app builder - create field agent tools easily
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Video Tutorials hidden until content is published */}

          {/* Interactive Demo */}
          <InteractiveDemoWidget
            title="Try It: Retool Resource Query"
            description="Test API endpoints for your Retool admin panels"
            platform="retool"
            endpoints={[
              {
                id: 'resource-test',
                name: 'Resource Connection Test',
                method: 'GET',
                path: 'test',
                description: 'Verify your Retool resource connection',
                requiresAuth: false,
              },
              {
                id: 'dashboard-data',
                name: 'Get Dashboard Metrics',
                method: 'GET',
                path: 'dashboard',
                description: 'Fetch dashboard data and metrics',
                requiresAuth: true,
              },
              {
                id: 'get-transactions',
                name: 'Query Transactions',
                method: 'GET',
                path: 'transactions',
                description: 'Retrieve transactions with filtering',
                requiresAuth: true,
              },
              {
                id: 'create-payment',
                name: 'Process Payment',
                method: 'POST',
                path: 'payment',
                description: 'Create a new payment transaction',
                requiresAuth: true,
                fields: [
                  { name: 'amount', type: 'number', label: 'Amount', required: true, defaultValue: 25000 },
                  { name: 'currency', type: 'select', label: 'Currency', options: ['XAF', 'USD', 'EUR'], defaultValue: 'XAF' },
                  { name: 'description', type: 'text', label: 'Description', placeholder: 'Payment for services' },
                ]
              },
            ]}
          />

          {/* Next Steps */}
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
                    View the complete <Link to="/api-catalog" className="text-primary hover:underline">API Catalog</Link> with 83 endpoints
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Test Before Building</p>
                  <p className="text-sm text-muted-foreground">
                    Try endpoints in our <Link to="/developer/playground" className="text-primary hover:underline">API Playground</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Get Help</p>
                  <p className="text-sm text-muted-foreground">
                    Join our <Link to="/contact" className="text-primary hover:underline">developer community</Link> for support
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

export default RetoolGuide;
