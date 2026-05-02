import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ArrowRight, Key, Zap, Download, ExternalLink } from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { InstantKeyGenerator } from "@/components/developer/InstantKeyGenerator";
import { OnboardingWizard } from "@/components/developer/OnboardingWizard";
import { TryItNowPlayground } from "@/components/developer/TryItNowPlayground";

const curlFirstCall = `# 1. Create a charge using sandbox credentials (no signup required)
curl -X POST https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "merch_test_001",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "+237650000000",
    "tx_ref": "my_first_charge"
  }'`;

const nodeFirstCall = `import { KangOpenBanking } from '@kangopenbanking/sdk';

// Initialize with sandbox credentials
const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

// Create a mobile money charge
const charge = await kob.charges.create({
  merchant_id: 'merch_test_001',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237650000000',
  tx_ref: 'my_first_charge',
});

console.log(charge.data.id);     // "ch_abc123..."
console.log(charge.data.status); // "successful"`;

const pythonFirstCall = `from kangopenbanking import KangOpenBanking

# Initialize with sandbox credentials
kob = KangOpenBanking(
    api_key="sk_test_sandbox_KangOB2026Demo",
    environment="sandbox",
)

# Create a mobile money charge
charge = kob.charges.create(
    merchant_id="merch_test_001",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237650000000",
    tx_ref="my_first_charge",
)

print(charge.data.id)     # "ch_abc123..."
print(charge.data.status) # "successful"`;

const phpFirstCall = `use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'api_key' => 'sk_test_sandbox_KangOB2026Demo',
    'environment' => 'sandbox',
]);

$charge = $kob->charges->create([
    'merchant_id' => 'merch_test_001',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '+237650000000',
    'tx_ref' => 'my_first_charge',
]);

echo $charge->data->id;     // "ch_abc123..."
echo $charge->data->status; // "successful"`;

const goFirstCall = `package main

import (
    "fmt"
    kob "github.com/kangopenbanking/kob-go"
)

func main() {
    client := kob.NewClient("sk_test_sandbox_KangOB2026Demo", kob.Sandbox)

    charge, err := client.Charges.Create(&kob.ChargeParams{
        MerchantID:    "merch_test_001",
        Amount:        5000,
        Currency:      "XAF",
        Channel:       "mobile_money",
        CustomerPhone: "+237650000000",
        TxRef:         "my_first_charge",
    })
    if err != nil {
        panic(err)
    }

    fmt.Println(charge.Data.ID)     // "ch_abc123..."
    fmt.Println(charge.Data.Status) // "successful"
}`;

const javaFirstCall = `import com.kangopenbanking.KangOpenBanking;
import com.kangopenbanking.model.Charge;

KangOpenBanking kob = KangOpenBanking.builder()
    .apiKey("sk_test_sandbox_KangOB2026Demo")
    .environment("sandbox")
    .build();

Charge charge = kob.charges().create(ChargeParams.builder()
    .merchantId("merch_test_001")
    .amount(5000)
    .currency("XAF")
    .channel("mobile_money")
    .customerPhone("+237650000000")
    .txRef("my_first_charge")
    .build());

System.out.println(charge.getData().getId());     // "ch_abc123..."
System.out.println(charge.getData().getStatus()); // "successful"`;

const responseExample = `{
  "data": {
    "id": "ch_abc123def456",
    "merchant_id": "merch_test_001",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "status": "successful",
    "customer_phone": "+237650000000",
    "tx_ref": "my_first_charge",
    "provider": "mtn_momo",
    "created_at": "2026-04-01T10:00:00Z"
  },
  "meta": {
    "request_id": "req_550e8400e29b",
    "timestamp": "2026-04-01T10:00:00Z",
    "api_version": "4.6.0"
  }
}`;

export default function GettingStarted() {
  return (
    <>
      <Helmet>
        <title>Getting Started | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Make your first API call to the Kang Open Banking API in under 5 minutes. Free sandbox, no signup required. cURL, Node.js, Python, PHP, Go, and Java examples." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/getting-started" />
      </Helmet>

      <div className="space-y-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-4">Getting Started</h1>
          <p className="text-xl text-muted-foreground">
            Make your first API call in under 5 minutes. No signup required -- use the sandbox credentials below to start immediately.
          </p>
        </div>

        {/* Instant key generator */}
        <InstantKeyGenerator />

        {/* Interactive onboarding wizard */}
        <OnboardingWizard />

        {/* Step 1: Sandbox Credentials */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                1
              </div>
              <div>
                <CardTitle>Get Sandbox Credentials</CardTitle>
                <CardDescription>Free, instant access — no account needed</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">Use these credentials right now to test the full API:</p>
            <div className="bg-muted/30 border border-border rounded-lg p-4 space-y-3">
              {[
                ["Secret Key", "sk_test_sandbox_KangOB2026Demo"],
                ["Publishable Key", "pk_test_sandbox_KangOB2026Demo"],
                ["Merchant ID", "merch_test_001"],
                ["Base URL", "https://api.kangopenbanking.com/v1"],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                  <span className="text-sm font-medium text-foreground min-w-[160px]">{label}:</span>
                  <code className="bg-muted px-2 py-1 rounded text-sm font-mono text-foreground break-all">{value}</code>
                </div>
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              These shared sandbox credentials give you full API access. When you're ready for production, <Link to="/auth" className="text-primary hover:underline">create an account</Link> to get your own keys.
            </p>
          </CardContent>
        </Card>

        {/* Step 2: Install SDK (optional) */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                2
              </div>
              <div>
                <CardTitle>Install an SDK (Optional)</CardTitle>
                <CardDescription>Or use cURL / any HTTP client directly</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <CodeBlock
              examples={[
                { language: "bash", label: "Node.js", code: "npm install @kangopenbanking/sdk" },
                { language: "bash", label: "Python", code: "pip install kangopenbanking" },
                { language: "bash", label: "PHP", code: "composer require kangopenbanking/sdk-php" },
                { language: "bash", label: "Go", code: "go get github.com/kangopenbanking/kob-go" },
                { language: "bash", label: "Java", code: "// Maven\n<dependency>\n  <groupId>com.kangopenbanking</groupId>\n  <artifactId>sdk</artifactId>\n  <version>1.0.0</version>\n</dependency>" },
              ]}
            />
          </CardContent>
        </Card>

        {/* Postman collection — versioned, in sync with current OpenAPI release */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                <Download className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Import the Postman Collection</CardTitle>
                <CardDescription>
                  Versioned collection auto-generated from the live OpenAPI spec — 391 requests across 45 folders.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Each release publishes an immutable, versioned Postman v2.1 collection alongside Sandbox and Production environments.
              Import the collection, pick an environment, and set your <code className="bg-muted px-1 rounded text-xs">access_token</code>.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              <Button variant="outline" asChild>
                <a href="/postman/Kang_Open_Banking_API_latest.postman_collection.json" download>
                  <Download className="h-4 w-4 mr-2" />
                  Latest collection (v4.27.2)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/postman/Kang_Open_Banking_API_v4.27.2.postman_collection.json" download>
                  <Download className="h-4 w-4 mr-2" />
                  v4.27.2 (immutable)
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/postman/Kang_Open_Banking_Sandbox.postman_environment.json" download>
                  <Download className="h-4 w-4 mr-2" />
                  Sandbox environment
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href="/postman/Kang_Open_Banking_Production.postman_environment.json" download>
                  <Download className="h-4 w-4 mr-2" />
                  Production environment
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Manifest with current version + URLs:{" "}
              <a href="/postman/manifest.json" className="text-primary hover:underline inline-flex items-center gap-1">
                /postman/manifest.json <ExternalLink className="h-3 w-3" />
              </a>
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                3
              </div>
              <div>
                <CardTitle>Make Your First API Call</CardTitle>
                <CardDescription>Create a mobile money charge in the sandbox</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              This example creates a 5,000 XAF mobile money charge using the test phone number <code className="bg-muted px-1 rounded text-sm">+237650000000</code> (always succeeds in sandbox):
            </p>

            <CodeBlock
              examples={[
                { language: "bash", label: "cURL", code: curlFirstCall },
                { language: "javascript", label: "Node.js", code: nodeFirstCall },
                { language: "python", label: "Python", code: pythonFirstCall },
                { language: "php", label: "PHP", code: phpFirstCall },
                { language: "go", label: "Go", code: goFirstCall },
                { language: "java", label: "Java", code: javaFirstCall },
              ]}
            />
          </CardContent>
        </Card>

        {/* Step 4: Response */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                4
              </div>
              <div>
                <CardTitle>Understand the Response</CardTitle>
                <CardDescription>Every response uses the StandardResponse envelope</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <CodeBlock examples={[{ language: "json", code: responseExample }]} />
            <div className="overflow-x-auto">
              <table className="w-full text-sm border border-border rounded-lg">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left p-3 font-medium text-foreground">Field</th>
                    <th className="text-left p-3 font-medium text-foreground">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["data.id", "Unique charge identifier (use this to verify or refund)"],
                    ["data.status", "One of: pending, successful, failed, expired"],
                    ["data.amount", "Charge amount in the smallest currency unit"],
                    ["data.tx_ref", "Your unique reference for reconciliation"],
                    ["meta.request_id", "Unique request ID for support inquiries"],
                  ].map(([field, desc]) => (
                    <tr key={field} className="border-t border-border">
                      <td className="p-3 font-mono text-sm text-foreground">{field}</td>
                      <td className="p-3 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Next Steps */}
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-primary" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="font-semibold text-foreground">Continue your integration journey:</p>
            <div className="grid gap-3">
              {[
                { title: "Authentication", desc: "Set up OAuth 2.0, API keys, and mTLS for production", path: "/developer/authentication" },
                { title: "Sandbox Environment", desc: "Test cards, mobile money numbers, and webhook simulation", path: "/developer/sandbox/overview" },
                { title: "Gateway Quickstart", desc: "Accept your first real payment in 10 minutes", path: "/developer/gateway/quickstart" },
                { title: "API Explorer", desc: "Test all 339 endpoints interactively in your browser", path: "/developer/api-explorer" },
              ].map((item) => (
                <Link key={item.path} to={item.path} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/50 transition-colors">
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground ml-auto shrink-0" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Try It Now playground */}
        <TryItNowPlayground />

        <AutoDocNavigation />
      </div>
    </>
  );
}
