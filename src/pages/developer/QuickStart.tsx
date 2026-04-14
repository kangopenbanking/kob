import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, Copy, Terminal, Zap, ArrowRight } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

export default function QuickStart() {
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

  const codeExamples = {
    curl: {
      auth: `curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=accounts payments"`,
      accounts: `curl -X GET "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "x-consent-id: YOUR_CONSENT_ID"`
    },
    javascript: {
      auth: `const response = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: 'YOUR_CLIENT_ID',
      client_secret: 'YOUR_CLIENT_SECRET',
      scope: 'accounts payments'
    })
  }
);
const { access_token } = await response.json();`,
      accounts: `const response = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts',
  {
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
      'x-consent-id': consentId
    }
  }
);
const accounts = await response.json();`
    },
    python: {
      auth: `import requests

response = requests.post(
    'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token',
    data={
        'grant_type': 'client_credentials',
        'client_id': 'YOUR_CLIENT_ID',
        'client_secret': 'YOUR_CLIENT_SECRET',
        'scope': 'accounts payments'
    }
)
access_token = response.json()['access_token']`,
      accounts: `headers = {
    'Authorization': f'Bearer {access_token}',
    'x-consent-id': consent_id
}

response = requests.get(
    'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts',
    headers=headers
)
accounts = response.json()`
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge className="mb-4">Quick Start Guide</Badge>
        <h1 className="text-4xl font-bold mb-4">Get Started in 5 Minutes</h1>
        <p className="text-xl text-muted-foreground">
          Follow these simple steps to make your first API call
        </p>
      </div>

      {/* Steps */}
      <div className="space-y-8">
        {/* Step 1: Register */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-primary">1</span>
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">Register Your Application</CardTitle>
                <CardDescription className="text-base">
                  Create a free developer account and register your app to get API credentials
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-[72px]">
            <div className="space-y-4">
              <p className="text-muted-foreground">
                You'll receive your <code className="bg-muted px-2 py-1 rounded text-sm">client_id</code> and{" "}
                <code className="bg-muted px-2 py-1 rounded text-sm">client_secret</code> immediately after registration.
              </p>
              <Link to="/register">
                <Button>
                  Register Now
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Step 2: Get Access Token */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-primary">2</span>
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">Obtain Access Token</CardTitle>
                <CardDescription className="text-base">
                  Authenticate using OAuth 2.0 client credentials flow (form-encoded)
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-[72px]">
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              {(["curl", "javascript", "python"] as const).map((lang) => (
                <TabsContent key={lang} value={lang}>
                  <div className="bg-muted/50 p-4 rounded-lg relative mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(codeExamples[lang].auth, `${lang}-auth`)}
                    >
                      {copiedId === `${lang}-auth` ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-sm overflow-x-auto pr-8">
                      <code>{codeExamples[lang].auth}</code>
                    </pre>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>

        {/* Step 3: Make API Call */}
        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xl font-bold text-primary">3</span>
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">Make Your First API Call</CardTitle>
                <CardDescription className="text-base">
                  Retrieve account information using your access token and consent ID
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pl-[72px]">
            <Tabs defaultValue="curl">
              <TabsList>
                <TabsTrigger value="curl">cURL</TabsTrigger>
                <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                <TabsTrigger value="python">Python</TabsTrigger>
              </TabsList>
              {(["curl", "javascript", "python"] as const).map((lang) => (
                <TabsContent key={lang} value={lang}>
                  <div className="bg-muted/50 p-4 rounded-lg relative mt-4">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => copyToClipboard(codeExamples[lang].accounts, `${lang}-acc`)}
                    >
                      {copiedId === `${lang}-acc` ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="text-sm overflow-x-auto pr-8">
                      <code>{codeExamples[lang].accounts}</code>
                    </pre>
                  </div>
                </TabsContent>
              ))}
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Next Steps */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            Next Steps
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Link to="/developer/api-explorer" className="block group">
              <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors">
                <Terminal className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    Try the API Explorer
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Test endpoints interactively with Swagger UI
                  </p>
                </div>
              </div>
            </Link>
            
            <Link to="/documentation" className="block group">
              <div className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors">
                <CheckCircle className="h-5 w-5 text-primary" />
                <div>
                  <h3 className="font-semibold group-hover:text-primary transition-colors">
                    Read Full Documentation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Explore all available endpoints and features
                  </p>
                </div>
              </div>
            </Link>
          
      <AutoDocNavigation />
</div>
        </CardContent>
      </Card>
    </div>
  );
}
