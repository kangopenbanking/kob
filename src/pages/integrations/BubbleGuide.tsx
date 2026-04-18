import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "react-router-dom";
import { ArrowLeft, Circle, CheckCircle2, AlertCircle, Smartphone } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { InteractiveDemoWidget } from "@/components/developer/InteractiveDemoWidget";

const BubbleGuide = () => {
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
          <div className="p-4 rounded-lg bg-blue-500/10">
            <Circle className="h-8 w-8 text-blue-500" />
          </div>
          <div>
            <h1 className="text-4xl font-bold mb-2">Bubble.io Integration Guide</h1>
            <p className="text-muted-foreground">
              Build full-stack fintech apps without writing code
            </p>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Quick Overview */}
          <Card>
            <CardHeader>
              <CardTitle>Why Bubble.io for Fintech?</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 rounded-lg bg-muted">
                  <Smartphone className="h-6 w-6 mb-2 text-blue-500" />
                  <h3 className="font-semibold mb-2">Full-Stack Apps</h3>
                  <p className="text-sm text-muted-foreground">
                    Build complete web and mobile apps with database, UI, and logic
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Visual Development</h3>
                  <p className="text-sm text-muted-foreground">
                    Drag-and-drop interface builder with responsive design
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-muted">
                  <h3 className="font-semibold mb-2">Difficulty</h3>
                  <Badge variant="secondary">Intermediate</Badge>
                  <p className="text-sm text-muted-foreground mt-2">30-60 minutes</p>
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
                  <span>Bubble.io account (free plan works)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Kang Open Banking API credentials</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                  <span>Basic understanding of Bubble workflows (recommended)</span>
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
              <TabsTrigger value="setup">API Connector Setup</TabsTrigger>
              <TabsTrigger value="workflows">Build Workflows</TabsTrigger>
              <TabsTrigger value="examples">App Examples</TabsTrigger>
            </TabsList>

            {/* Setup Tab */}
            <TabsContent value="setup" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Step 1: Install API Connector Plugin</CardTitle>
                  <CardDescription>
                    The API Connector allows Bubble to communicate with external APIs
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">A. Add Plugin</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>In your Bubble editor, go to Plugins tab</li>
                      <li>Click "Add plugins"</li>
                      <li>Search for "API Connector" (by Bubble)</li>
                      <li>Install the plugin</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">B. Add New API</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Open the API Connector plugin</li>
                      <li>Click "Add another API"</li>
                      <li>Name it "Kang Open Banking"</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Step 2: Configure OAuth Authentication</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      First create a "Get Token" API call that you'll use before other calls
                    </AlertDescription>
                  </Alert>

                  <div>
                    <h3 className="font-semibold mb-3">OAuth Token API Call Configuration</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Name:</span>
                        <span className="text-muted-foreground">Get OAuth Token</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Use as:</span>
                        <span className="text-muted-foreground">Action</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">URL:</span>
                        <span className="text-muted-foreground font-mono text-xs break-all">{apiBaseUrl}/oauth-token</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Method:</span>
                        <span className="text-muted-foreground">POST</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Body Parameters (JSON)</h3>
                    <CodeBlock
                      examples={[
                        {
                          language: "json",
                          label: "Request Body",
                          code: `{
  "grant_type": "client_credentials",
  "client_id": "<client_id>",
  "client_secret": "<client_secret>"
}`
                        }
                      ]}
                    />
                    <p className="text-sm text-muted-foreground mt-3">
                      In Bubble, mark client_id and client_secret as "private" parameters
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">C. Initialize the Call</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Click "Initialize call"</li>
                      <li>Enter your actual client_id and client_secret</li>
                      <li>Bubble will show you the response structure</li>
                      <li>Save the API call</li>
                    </ol>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Step 3: Create Your First API Call</CardTitle>
                  <CardDescription>
                    Example: Get account balances
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">API Call Configuration</h3>
                    <div className="space-y-3 text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Name:</span>
                        <span className="text-muted-foreground">Get Account Balances</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Use as:</span>
                        <span className="text-muted-foreground">Data (for displaying) or Action (for workflows)</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">URL:</span>
                        <span className="text-muted-foreground font-mono text-xs break-all">{apiBaseUrl}/aisp-balances</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-semibold">Method:</span>
                        <span className="text-muted-foreground">GET</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Headers</h3>
                    <div className="bg-muted p-3 rounded text-sm space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-mono">Authorization</span>
                        <span className="font-mono">Bearer {'<access_token>'}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-mono">Content-Type</span>
                        <span className="font-mono">application/json</span>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mt-2">
                      access_token should be a dynamic parameter that you get from the OAuth call
                    </p>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Query Parameters</h3>
                    <div className="bg-muted p-3 rounded text-sm">
                      <div className="grid grid-cols-2 gap-2">
                        <span className="font-mono">account_id</span>
                        <span className="text-muted-foreground">{'<account_id>'} (make this a parameter)</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Workflows Tab */}
            <TabsContent value="workflows" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Building Bubble Workflows</CardTitle>
                  <CardDescription>
                    Connect your UI elements to Kang API calls
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="font-semibold mb-3">Pattern: Two-Step Authentication</h3>
                    <p className="text-muted-foreground mb-3">
                      Because tokens expire, you should always get a fresh token before API calls:
                    </p>
                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p><strong>Step 1:</strong> Backend Workflows → Get OAuth Token</p>
                      <p className="pl-4">→ Save result's "access_token" to a custom state</p>
                      <p><strong>Step 2:</strong> API Call (Get Balances, Create Payment, etc.)</p>
                      <p className="pl-4">→ Use the saved access_token in Authorization header</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Display Data in Repeating Groups</h3>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Add a Repeating Group to your page</li>
                      <li>Set Type of content to "Get Account Balances"</li>
                      <li>Set Data source to "Get data from an external API"</li>
                      <li>Select your "Get Account Balances" API call</li>
                      <li>The repeating group will display all accounts</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Create Interactive Buttons</h3>
                    <p className="text-muted-foreground mb-3">
                      Example: "Send Money" button workflow
                    </p>
                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p><strong>When Button "Send Money" is clicked:</strong></p>
                      <p className="pl-4">Step 1: Get OAuth Token</p>
                      <p className="pl-4">Step 2: API Call - Create Domestic Payment</p>
                      <p className="pl-8">→ Parameters from input fields (amount, recipient, etc.)</p>
                      <p className="pl-4">Step 3: Show custom popup "Payment Successful"</p>
                      <p className="pl-4">Step 4: Refresh the account balance display</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Storing Data in Bubble Database</h3>
                    <p className="text-muted-foreground mb-3">
                      Cache API responses to reduce API calls and improve performance:
                    </p>
                    <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
                      <li>Create a "Transaction" data type in Bubble</li>
                      <li>After getting transactions from API, save them to database</li>
                      <li>Display from database for instant loading</li>
                      <li>Refresh from API periodically or on user action</li>
                    </ol>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3">Error Handling</h3>
                    <p className="text-muted-foreground mb-3">
                      Make your app resilient to API errors:
                    </p>
                    <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
                      <p><strong>When API Call returns error:</strong></p>
                      <p className="pl-4">→ Show alert with error message</p>
                      <p className="pl-4">→ Log error to Bubble's server logs</p>
                      <p className="pl-4">→ Optionally retry the call</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Examples Tab */}
            <TabsContent value="examples" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Complete App Examples</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">💰 Personal Banking Dashboard</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Features:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Account balances displayed in cards</li>
                        <li>Transaction history in repeating group</li>
                        <li>Search and filter transactions</li>
                        <li>Transfer money between accounts</li>
                        <li>Download statements as PDF</li>
                      </ul>
                      <p className="mt-2"><strong>API Calls Used:</strong> aisp-balances, aisp-transactions, pisp-domestic-payment</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">📱 Mobile Money Agent App</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Features:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Cash in / Cash out interface</li>
                        <li>Customer phone number lookup</li>
                        <li>Real-time commission calculator</li>
                        <li>Daily transaction summary</li>
                        <li>QR code for quick transactions</li>
                      </ul>
                      <p className="mt-2"><strong>API Calls Used:</strong> mobile-money-charge, mobile-money-transfer, api-transactions</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">🏦 Loan Management Portal</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Features:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Loan application form with KYC</li>
                        <li>Credit score check integration</li>
                        <li>Repayment schedule calculator</li>
                        <li>Automated payment collection</li>
                        <li>Admin dashboard for loan officers</li>
                      </ul>
                      <p className="mt-2"><strong>API Calls Used:</strong> loan-apply, loan-calculate, credit-score-fetch, loan-repay</p>
                    </div>
                  </div>

                  <div className="border-l-4 border-primary pl-4">
                    <h3 className="font-semibold mb-2">🛒 E-commerce Checkout with Banking</h3>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p><strong>Features:</strong></p>
                      <ul className="list-disc list-inside pl-4">
                        <li>Multiple payment options (card, bank, mobile money)</li>
                        <li>Real-time payment verification</li>
                        <li>Automated refund processing</li>
                        <li>Order tracking linked to payments</li>
                        <li>Customer payment history</li>
                      </ul>
                      <p className="mt-2"><strong>API Calls Used:</strong> stripe-payment-intent, mobile-money-charge, pisp-domestic-payment</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pro Tips for Bubble + Kang API</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Use Custom States:</strong> Store access tokens in custom states to avoid repeated OAuth calls
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Backend Workflows:</strong> Use scheduled workflows for daily reports and recurring tasks
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Responsive Design:</strong> Test your banking app on mobile - Bubble's responsive editor makes it easy
                    </AlertDescription>
                  </Alert>
                  <Alert>
                    <CheckCircle2 className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Privacy Rules:</strong> Set up Bubble privacy rules to ensure users only see their own financial data
                    </AlertDescription>
                  </Alert>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Interactive Demo */}
          <InteractiveDemoWidget
            title="Try It: Bubble.io API Connector"
            description="Test API endpoints for your Bubble.io application"
            platform="bubble"
            endpoints={[
              {
                id: 'connector-test',
                name: 'API Connector Test',
                method: 'GET',
                path: 'test',
                description: 'Verify your API connector configuration',
                requiresAuth: false,
              },
              {
                id: 'user-account',
                name: 'Get User Account',
                method: 'GET',
                path: 'account',
                description: 'Fetch user account details',
                requiresAuth: true,
              },
              {
                id: 'get-transactions',
                name: 'Get Transactions',
                method: 'GET',
                path: 'transactions',
                description: 'Retrieve transaction history',
                requiresAuth: true,
              },
              {
                id: 'mobile-money-transfer',
                name: 'Mobile Money Transfer',
                method: 'POST',
                path: 'mm-transfer',
                description: 'Initiate mobile money transfer',
                requiresAuth: true,
                fields: [
                  { name: 'phone_number', type: 'text', label: 'Phone Number', required: true, placeholder: '+237670000000' },
                  { name: 'amount', type: 'number', label: 'Amount', required: true, defaultValue: 5000 },
                  { name: 'provider', type: 'select', label: 'Provider', options: ['MTN', 'Orange'], defaultValue: 'MTN' },
                ]
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
                  <p className="font-semibold">Browse API Endpoints</p>
                  <p className="text-sm text-muted-foreground">
                    See all 83 available endpoints in the <Link to="/api-catalog" className="text-primary hover:underline">API Catalog</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Test API Calls</p>
                  <p className="text-sm text-muted-foreground">
                    Try endpoints before adding to Bubble in our <Link to="/developer/playground" className="text-primary hover:underline">API Playground</Link>
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-semibold">Join Community</p>
                  <p className="text-sm text-muted-foreground">
                    Share your Bubble apps and get help in our <Link to="/contact" className="text-primary hover:underline">developer community</Link>
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

export default BubbleGuide;
