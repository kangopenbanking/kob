import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Code, CheckCircle2, ExternalLink, Copy, Terminal, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { toast } from "sonner";

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};

const NODE_QUICKSTART = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

// List accounts
const accounts = await kob.accounts.list();

// Create a Mobile Money charge
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});

// Verify webhook
const isValid = await kob.verifyWebhookSignature(
  rawBody, signatureHeader, 'your_secret'
);`;

const PYTHON_QUICKSTART = `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)

# List accounts
accounts = kob.accounts.list()
for acc in accounts:
    print(f"{acc.account_holder_name} — {acc.currency}")

# Create a Mobile Money charge
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)

# Webhook verification
is_valid = KangOpenBanking.verify_webhook_signature(
    payload=raw_body,
    signature=sig_header,
    secret="your_secret",
)`;

const PHP_QUICKSTART = `use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'api_key' => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);

// List accounts
$accounts = $kob->accounts->list();

// Create a Mobile Money charge
$charge = $kob->charges->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref' => 'order_001',
]);

// Verify webhook
$valid = KangOpenBanking::verifyWebhookSignature(
    $rawBody, $signatureHeader, 'your_secret'
);`;

const CURL_QUICKSTART = `# 1. Get access token
curl -X POST https://api.kangopenbanking.com/functions/v1/oauth-token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials&client_id=YOUR_ID&client_secret=YOUR_SECRET&scope=accounts+payments"

# 2. List accounts
curl https://api.kangopenbanking.com/functions/v1/aisp-accounts \\
  -H "Authorization: Bearer YOUR_TOKEN"

# 3. Create charge
curl -X POST https://api.kangopenbanking.com/functions/v1/gateway-charges \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"action":"create_charge","merchant_id":"mch_uuid","amount":5000,"currency":"XAF","channel":"mobile_money","customer_phone":"237677123456","tx_ref":"order_001"}'`;

const sdkCards = [
  {
    key: "node",
    title: "Node.js / TypeScript",
    desc: "Full-featured SDK with TypeScript types, auto token refresh, and webhook verification",
    install: "npm install @kangopenbanking/sdk",
    badge: "v1.0.0",
    status: "available" as const,
    features: [
      "Promise-based async/await API",
      "Full TypeScript definitions",
      "Automatic OAuth2 token refresh",
      "Webhook HMAC-SHA256 verification",
      "AISP + Gateway + Sandbox resources",
      "PKCE authorization code flow",
    ],
  },
  {
    key: "python",
    title: "Python",
    desc: "Typed dataclass responses, sync client via httpx, context manager support",
    install: "pip install kangopenbanking",
    badge: "v1.0.0",
    status: "available" as const,
    features: [
      "Sync HTTP client (httpx)",
      "Typed dataclass responses",
      "Automatic token management",
      "Webhook HMAC-SHA256 verification",
      "Context manager support",
      "Python 3.8+ compatible",
    ],
  },
  {
    key: "php",
    title: "PHP / Laravel",
    desc: "PSR-4 autoloaded with Laravel service provider, facade, Guzzle client, and webhook middleware",
    install: "composer require kangopenbanking/sdk",
    badge: "v1.0.0",
    status: "available" as const,
    features: [
      "PSR-4 autoloaded, PHP 8.1+",
      "Laravel service provider + KOB facade",
      "Guzzle 7 HTTP client",
      "Webhook HMAC-SHA256 middleware",
      "AISP + Gateway + Sandbox resources",
      "OAuth2 + PKCE authorization flow",
    ],
  },
  {
    key: "curl",
    title: "cURL / REST",
    desc: "Use the API directly with any HTTP client — no SDK required",
    install: "curl https://api.kangopenbanking.com/functions/v1/api-health",
    badge: "Universal",
    status: "available" as const,
    features: [
      "Works with any language",
      "Full OpenAPI 3.1 spec available",
      "Postman collection downloadable",
      "No dependencies required",
    ],
  },
];

export default function SDKsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">SDKs & Libraries</h1>
        <p className="text-xl text-muted-foreground">
          Official SDKs to integrate KOB APIs in minutes — with full type safety and auto-auth.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All SDKs are open source on{" "}
          <a href="https://github.com/kangopenbanking/KangOpenBanking-KOB" className="underline font-medium" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>. Contributions welcome!
        </AlertDescription>
      </Alert>

      {/* SDK Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {sdkCards.map((sdk) => (
          <Card key={sdk.key} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  {sdk.key === "curl" ? <Terminal className="h-5 w-5 text-primary" /> : <Package className="h-5 w-5 text-primary" />}
                </div>
                <div>
                  <CardTitle className="text-lg">{sdk.title}</CardTitle>
                  <Badge variant={sdk.status === "available" ? "default" : "secondary"} className="text-[10px] mt-0.5">
                    {sdk.badge}
                  </Badge>
                </div>
              </div>
              <CardDescription>{sdk.desc}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                {sdk.features.map((f) => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>

              <div
                className="bg-muted p-3 rounded-lg font-mono text-sm flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => copyToClipboard(sdk.install)}
                title="Click to copy"
              >
                <code className="truncate">{sdk.install}</code>
                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>

              <div className="flex gap-2">
                {sdk.status === "available" ? (
                  <Button
                    className="flex-1"
                    onClick={() => copyToClipboard(sdk.install)}
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Install
                  </Button>
                ) : (
                  <Button className="flex-1" disabled>
                    <Package className="mr-2 h-4 w-4" />
                    Coming Soon
                  </Button>
                )}
                <Button variant="outline" asChild>
                  <a href="https://github.com/kangopenbanking/KangOpenBanking-KOB" target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    GitHub
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Start Code Examples */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Quick Start Examples</h2>
        <p className="text-muted-foreground">
          Copy-paste these examples to start integrating in under 5 minutes.
        </p>

        <Tabs defaultValue="node" className="w-full">
          <TabsList>
            <TabsTrigger value="node">Node.js / TypeScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="php">PHP / Laravel</TabsTrigger>
            <TabsTrigger value="curl">cURL</TabsTrigger>
          </TabsList>

          <TabsContent value="node">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Node.js / TypeScript</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(NODE_QUICKSTART)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                  <code>{NODE_QUICKSTART}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="python">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">Python</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(PYTHON_QUICKSTART)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                  <code>{PYTHON_QUICKSTART}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="php">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">PHP / Laravel</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(PHP_QUICKSTART)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                  <code>{PHP_QUICKSTART}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="curl">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">cURL / REST</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => copyToClipboard(CURL_QUICKSTART)}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm leading-relaxed">
                  <code>{CURL_QUICKSTART}</code>
                </pre>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* API Coverage */}
      <Card>
        <CardHeader>
          <CardTitle>API Coverage</CardTitle>
          <CardDescription>All SDKs cover these API domains</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { domain: "Authentication", endpoints: "OAuth2 token, PKCE, refresh", status: "✅" },
              { domain: "AISP", endpoints: "Accounts, balances, transactions, beneficiaries", status: "✅" },
              { domain: "Gateway — Charges", endpoints: "Create, verify, list, cancel", status: "✅" },
              { domain: "Gateway — Refunds", endpoints: "Create, get, list", status: "✅" },
              { domain: "Gateway — Payouts", endpoints: "Create, get, list, batch", status: "✅" },
              { domain: "Sandbox", endpoints: "Test accounts, data generation, webhooks", status: "✅" },
              { domain: "Webhooks", endpoints: "HMAC-SHA256 signature verification", status: "✅" },
              { domain: "Fee Estimates", endpoints: "Pre-charge fee calculation", status: "✅" },
              { domain: "Error Handling", endpoints: "Typed errors with error_id + error_code", status: "✅" },
            ].map((item) => (
              <div key={item.domain} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm">{item.status}</span>
                  <span className="font-medium text-sm">{item.domain}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.endpoints}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "OpenAPI 3.1 Spec", href: "https://api.kangopenbanking.com/functions/v1/public-api-spec", icon: Code },
              { label: "Postman Collection", href: "https://api.kangopenbanking.com/functions/v1/postman-collection", icon: Download },
              { label: "API Playground", href: "/developer/playground", icon: Terminal },
              { label: "Webhook Guide", href: "/developer/guides/webhooks", icon: Package },
            ].map((r) => (
              <a
                key={r.label}
                href={r.href}
                target={r.href.startsWith("http") ? "_blank" : undefined}
                rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
                className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <r.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{r.label}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </a>
            ))}
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
