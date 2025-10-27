import { Link } from "react-router-dom";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Key, Code, Shield, Zap } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function GettingStarted() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">Getting Started</h1>
        <p className="text-xl text-muted-foreground">
          Follow this guide to integrate Kang Open Banking APIs into your application in minutes
        </p>
      </div>

      {/* Step 1: Registration */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              1
            </div>
            <div>
              <CardTitle>Register as a Third Party Provider (TPP)</CardTitle>
              <CardDescription>Create your developer account and register your application</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Before you can access the KOB APIs, you need to register your organization:</p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Visit the <Link to="/tpp-registration" className="text-primary hover:underline">TPP Registration page</Link></li>
            <li>Complete the registration form with your organization details</li>
            <li>Submit required KYC documents (Business registration, Tax ID, etc.)</li>
            <li>Select your required API roles (AISP, PISP, or both)</li>
          </ol>
          <Alert>
            <AlertDescription>
              <strong>Approval Timeline:</strong> TPP applications are typically reviewed within 2-3 business days. You'll receive an email once approved.
            </AlertDescription>
          </Alert>
          <Link to="/tpp-registration">
            <Button>
              Register Now <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* Step 2: Get Credentials */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              2
            </div>
            <div>
              <CardTitle>Obtain API Credentials</CardTitle>
              <CardDescription>Generate your client ID and secret for API authentication</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Once approved, access your API credentials from the dashboard:</p>
          <ol className="list-decimal list-inside space-y-2 ml-4">
            <li>Log in to your <Link to="/dashboard" className="text-primary hover:underline">Developer Dashboard</Link></li>
            <li>Navigate to "API Credentials" section</li>
            <li>Generate your <code className="bg-muted px-2 py-1 rounded">client_id</code> and <code className="bg-muted px-2 py-1 rounded">client_secret</code></li>
            <li>Choose between Sandbox and Production environments</li>
          </ol>
          
          <div className="bg-muted/50 border border-border rounded-lg p-4 space-y-2">
            <p className="font-semibold flex items-center gap-2">
              <Key className="h-4 w-4" /> Your Credentials
            </p>
            <div className="space-y-1 font-mono text-sm">
              <p><span className="text-muted-foreground">Client ID:</span> your_client_id_here</p>
              <p><span className="text-muted-foreground">Client Secret:</span> ••••••••••••••••</p>
            </div>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Security Note:</strong> Never expose your client secret in client-side code or public repositories. Always store it securely on your backend server.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Step 3: Authentication */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              3
            </div>
            <div>
              <CardTitle>Implement OAuth 2.0 Authentication</CardTitle>
              <CardDescription>Secure your API access with industry-standard OAuth 2.0</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>KOB uses OAuth 2.0 Authorization Code Flow with PKCE for secure authentication:</p>
          
          <h4 className="font-semibold">Step 3.1: Generate Access Token</h4>
          <CodeBlock
            examples={[
              {
                language: "curl",
                label: "cURL",
                code: `curl -X POST https://api.kangopenbanking.com/oauth-token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=accounts payments"`
              },
              {
                language: "javascript",
                label: "Node.js",
                code: `const response = await fetch(
  'https://api.kangopenbanking.com/oauth-token',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      scope: 'accounts payments'
    })
  }
);

const data = await response.json();
const accessToken = data.access_token;`
              },
              {
                language: "python",
                label: "Python",
                code: `import requests

response = requests.post(
    'https://api.kangopenbanking.com/oauth-token',
    data={
        'grant_type': 'client_credentials',
        'client_id': 'YOUR_CLIENT_ID',
        'client_secret': 'YOUR_CLIENT_SECRET',
        'scope': 'accounts payments'
    }
)

data = response.json()
access_token = data['access_token']`
              }
            ]}
          />

          <h4 className="font-semibold">Response</h4>
          <CodeBlock
            examples={[
              {
                language: "json",
                code: `{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "accounts payments"
}`
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* Step 4: First API Call */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
              4
            </div>
            <div>
              <CardTitle>Make Your First API Call</CardTitle>
              <CardDescription>Test the API by retrieving account information</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p>Let's make a simple API call to list accounts:</p>
          
          <CodeBlock
            examples={[
              {
                language: "curl",
                label: "cURL",
                code: `curl -X GET https://api.kangopenbanking.com/aisp-accounts \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "x-consent-id: YOUR_CONSENT_ID"`
              },
              {
                language: "javascript",
                label: "Node.js",
                code: `const response = await fetch(
  'https://api.kangopenbanking.com/aisp-accounts',
  {
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'x-consent-id': consentId
    }
  }
);

const accounts = await response.json();
console.log(accounts);`
              },
              {
                language: "python",
                label: "Python",
                code: `import requests

headers = {
    'Authorization': f'Bearer {access_token}',
    'x-consent-id': consent_id
}

response = requests.get(
    'https://api.kangopenbanking.com/aisp-accounts',
    headers=headers
)

accounts = response.json()
print(accounts)`
              }
            ]}
          />

          <h4 className="font-semibold">Example Response</h4>
          <CodeBlock
            examples={[
              {
                language: "json",
                code: `{
  "Data": {
    "Account": [
      {
        "AccountId": "acc_123456",
        "Currency": "XAF",
        "AccountType": "Savings",
        "AccountSubType": "Savings",
        "Nickname": "Personal Savings",
        "Account": {
          "Identification": "677123456",
          "Name": "John Doe"
        }
      }
    ]
  }
}`
              }
            ]}
          />
        </CardContent>
      </Card>

      {/* Next Steps */}
      <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-semibold">Now that you've completed the basics, explore these resources:</p>
          <div className="grid gap-3">
            <Link to="/developer/api/aisp" className="flex items-center gap-3 p-3 rounded-lg hover:bg-background transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">AISP API Reference</p>
                <p className="text-sm text-muted-foreground">Explore all account information endpoints</p>
              </div>
            </Link>
            <Link to="/developer/api/pisp" className="flex items-center gap-3 p-3 rounded-lg hover:bg-background transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">PISP API Reference</p>
                <p className="text-sm text-muted-foreground">Learn about payment initiation</p>
              </div>
            </Link>
            <Link to="/developer/console" className="flex items-center gap-3 p-3 rounded-lg hover:bg-background transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Try API Console</p>
                <p className="text-sm text-muted-foreground">Test APIs interactively in your browser</p>
              </div>
            </Link>
            <Link to="/developer/guides/web" className="flex items-center gap-3 p-3 rounded-lg hover:bg-background transition-colors">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium">Integration Guides</p>
                <p className="text-sm text-muted-foreground">Step-by-step guides for web and mobile apps</p>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>

      <DocNavigation
        nextPage={{
          title: "AISP API Reference",
          path: "/developer/api/aisp"
        }}
      />
    </div>
  );
}
