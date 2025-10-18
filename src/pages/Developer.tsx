import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { 
  Building2, 
  Key, 
  Code, 
  BookOpen, 
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  CheckCircle2,
  Shield
} from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Developer = () => {
  const { toast } = useToast();
  const [showSandboxKey, setShowSandboxKey] = useState(false);
  const [showProductionKey, setShowProductionKey] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const sandboxKey = "sk_test_51KangOpenBanking_sandbox_1234567890abcdef";
  const productionKey = "sk_live_51KangOpenBanking_prod_abcdef1234567890";

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast({
      title: "Copied to clipboard",
      description: "API key copied successfully",
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const regenerateKey = (type: string) => {
    toast({
      title: "Key Regenerated",
      description: `Your ${type} API key has been regenerated successfully.`,
    });
  };

  const codeExamples = [
    {
      language: "JavaScript",
      code: `const response = await fetch('https://sandbox.kangopenbanking.com/v1/accounts', {
  method: 'GET',
  headers: {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
console.log(data);`
    },
    {
      language: "Python",
      code: `import requests

headers = {
    'Authorization': 'Bearer YOUR_API_KEY',
    'Content-Type': 'application/json'
}

response = requests.get(
    'https://sandbox.kangopenbanking.com/v1/accounts',
    headers=headers
)

data = response.json()
print(data)`
    },
    {
      language: "PHP",
      code: `<?php
$curl = curl_init();

curl_setopt_array($curl, [
    CURLOPT_URL => "https://sandbox.kangopenbanking.com/v1/accounts",
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_HTTPHEADER => [
        "Authorization: Bearer YOUR_API_KEY",
        "Content-Type: application/json"
    ]
]);

$response = curl_exec($curl);
curl_close($curl);

$data = json_decode($response);
print_r($data);`
    }
  ];

  const [selectedLanguage, setSelectedLanguage] = useState(0);

  return (
    <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-4">
            <Code className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Developer Portal</span>
          </div>
          <h1 className="text-4xl font-bold mb-2">API Keys & Integration</h1>
          <p className="text-muted-foreground">
            Manage your API credentials and access code examples
          </p>
        </div>

        {/* API Keys Section */}
        <div className="grid lg:grid-cols-2 gap-6 mb-8">
          {/* Sandbox Keys */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-yellow-500"></div>
                    Sandbox API Key
                  </CardTitle>
                  <CardDescription>For testing and development</CardDescription>
                </div>
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type={showSandboxKey ? "text" : "password"}
                    value={sandboxKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowSandboxKey(!showSandboxKey)}
                  >
                    {showSandboxKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(sandboxKey, "sandbox")}
                  >
                    {copiedId === "sandbox" ? (
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => regenerateKey("sandbox")}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
              </div>
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-400">
                  <strong>Sandbox Mode:</strong> No real transactions. Use test data only.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Production Keys */}
          <Card className="border-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full bg-accent"></div>
                    Production API Key
                  </CardTitle>
                  <CardDescription>For live transactions</CardDescription>
                </div>
                <Shield className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type={showProductionKey ? "text" : "password"}
                    value={productionKey}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setShowProductionKey(!showProductionKey)}
                  >
                    {showProductionKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => copyToClipboard(productionKey, "production")}
                  >
                    {copiedId === "production" ? (
                      <CheckCircle2 className="h-4 w-4 text-accent" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => regenerateKey("production")}
                >
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Regenerate
                </Button>
              </div>
              <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                <p className="text-sm text-destructive">
                  <strong>Warning:</strong> Keep this key secret. Never expose it in client-side code.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Code Examples */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Code className="h-5 w-5" />
              Quick Start Code Examples
            </CardTitle>
            <CardDescription>Copy and paste these examples to get started</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mb-4">
              {codeExamples.map((example, index) => (
                <Button
                  key={index}
                  variant={selectedLanguage === index ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedLanguage(index)}
                >
                  {example.language}
                </Button>
              ))}
            </div>
            <div className="bg-muted/50 p-4 rounded-lg overflow-x-auto relative">
              <Button
                variant="ghost"
                size="sm"
                className="absolute top-2 right-2"
                onClick={() => copyToClipboard(codeExamples[selectedLanguage].code, `code-${selectedLanguage}`)}
              >
                {copiedId === `code-${selectedLanguage}` ? (
                  <CheckCircle2 className="h-4 w-4 text-accent" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <pre className="font-mono text-sm whitespace-pre-wrap">
                {codeExamples[selectedLanguage].code}
              </pre>
            </div>
          </CardContent>
        </Card>

        {/* FAPI 1.0 Advanced & OAuth2 Endpoints */}
        <Card className="border-accent">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              FAPI 1.0 Advanced Security Profile
            </CardTitle>
            <CardDescription>
              Kang Open Banking implements Financial-grade API (FAPI) 1.0 Advanced security profile with OAuth2 + OpenID Connect
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-semibold mb-3">Authentication Endpoints</h4>
              <div className="space-y-3">
                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">JWKS (Public Keys)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jwks-endpoint`,
                        'jwks'
                      )}
                    >
                      {copiedId === 'jwks' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/jwks-endpoint
                  </code>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">OpenID Configuration</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oidc-config`,
                        'oidc'
                      )}
                    >
                      {copiedId === 'oidc' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/oidc-config
                  </code>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">PAR (Pushed Authorization Requests)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/par-endpoint`,
                        'par'
                      )}
                    >
                      {copiedId === 'par' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/par-endpoint
                  </code>
                </div>

                <div className="bg-muted/50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-sm font-medium">DCR (Dynamic Client Registration)</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(
                        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/dcr-register`,
                        'dcr'
                      )}
                    >
                      {copiedId === 'dcr' ? (
                        <CheckCircle2 className="h-4 w-4 text-accent" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <code className="text-xs text-muted-foreground break-all">
                    {import.meta.env.VITE_SUPABASE_URL}/functions/v1/dcr-register
                  </code>
                </div>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-3">Security Features</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span><strong>mTLS:</strong> Mutual TLS authentication for all API calls</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span><strong>JAR:</strong> JWT-secured authorization requests with signature validation</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span><strong>PAR:</strong> Pushed authorization requests for enhanced security</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span><strong>DCR:</strong> Dynamic client registration with Software Statement Assertions</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                  <span><strong>Strict JWT Validation:</strong> nbf/exp temporal claims enforcement</span>
                </li>
              </ul>
            </div>

            <div className="pt-4 border-t">
              <Link to="/tpp-registration">
                <Button className="w-full">
                  Register as TPP →
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Resources */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BookOpen className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">API Documentation</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Complete reference for all endpoints and features
              </p>
              <Link to="/documentation">
                <Button variant="outline" size="sm" className="w-full">
                  View Docs
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                <Code className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Code Examples</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Sample implementations in multiple languages
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Browse Examples
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:border-primary/50 transition-all cursor-pointer">
            <CardContent className="pt-6">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Shield className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-lg mb-2">Security Guide</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Best practices for securing your integration
              </p>
              <Button variant="outline" size="sm" className="w-full">
                Learn More
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
  );
};

export default Developer;
