import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Code, CheckCircle2, ExternalLink, Copy, Terminal, Package, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};

const NODE_AUTH = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  environment: 'sandbox', // or 'production'
});

// Token refresh is handled automatically.
// For PKCE flows:
const authUrl = kob.auth.getAuthorizationUrl({
  redirectUri: 'https://yourapp.com/callback',
  scope: 'accounts payments',
  codeChallenge: generatedChallenge,
  codeChallengeMethod: 'S256',
});`;

const NODE_CHARGE = `// Create a Mobile Money charge
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
}, {
  idempotencyKey: 'idem_unique_key', // auto-generated if omitted
});

console.log(charge.data.id);     // "ch_abc123"
console.log(charge.data.status); // "pending"`;

const NODE_WEBHOOK = `import { KangOpenBanking } from '@kangopenbanking/sdk';

// Express middleware
app.post('/webhooks/kob', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-kob-signature'];
  const timestamp = req.headers['x-kob-timestamp'];

  const isValid = KangOpenBanking.verifyWebhookSignature(
    req.body,           // raw body buffer
    signature,          // "hmac_sha256=..."
    timestamp,
    process.env.KOB_WEBHOOK_SECRET
  );

  if (!isValid) return res.status(401).send('Invalid signature');
  const event = JSON.parse(req.body);
  console.log(event.event_type, event.event_id);
  res.status(200).send('OK');
});`;

const NODE_AISP = `// Fetch accounts (requires AISP consent)
const accounts = await kob.accounts.list();

for (const acc of accounts.data) {
  console.log(acc.account_holder_name, acc.currency);

  // Fetch balance
  const balance = await kob.accounts.getBalance(acc.id);
  console.log('Balance:', balance.data.amount, balance.data.currency);
}

// Fetch transactions
const txns = await kob.accounts.listTransactions(accounts.data[0].id, {
  from: '2026-01-01',
  to: '2026-03-31',
});`;

const PYTHON_AUTH = `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    client_secret="your_client_secret",
    environment="sandbox",  # or "production"
)

# Token refresh is handled automatically.
# For PKCE flows:
auth_url = kob.auth.get_authorization_url(
    redirect_uri="https://yourapp.com/callback",
    scope="accounts payments",
    code_challenge=generated_challenge,
    code_challenge_method="S256",
)`;

const PYTHON_CHARGE = `# Create a Mobile Money charge
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
    idempotency_key="idem_unique_key",  # auto-generated if omitted
)

print(charge.data["id"])      # "ch_abc123"
print(charge.data["status"])  # "pending"`;

const PYTHON_WEBHOOK = `import hmac, hashlib
from flask import Flask, request

app = Flask(__name__)

@app.route('/webhooks/kob', methods=['POST'])
def kob_webhook():
    sig = request.headers.get('X-KOB-Signature', '').replace('hmac_sha256=', '')
    ts = request.headers.get('X-KOB-Timestamp', '')
    body = request.get_data(as_text=True)

    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{ts}.{body}".encode(),
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(sig, expected):
        return 'Invalid signature', 401

    event = request.get_json()
    print(f"Event: {event['event_type']} {event['event_id']}")
    return 'OK', 200`;

const PYTHON_AISP = `# Fetch accounts (requires AISP consent)
accounts = kob.accounts.list()

for acc in accounts.data:
    print(f"{acc['account_holder_name']} - {acc['currency']}")

    balance = kob.accounts.get_balance(acc["id"])
    print(f"Balance: {balance.data['amount']} {balance.data['currency']}")

# Fetch transactions
txns = kob.accounts.list_transactions(
    accounts.data[0]["id"],
    from_date="2026-01-01",
    to_date="2026-03-31",
)`;

const PHP_AUTH = `use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'client_secret' => 'your_client_secret',
    'environment' => 'sandbox', // or 'production'
]);

// Token refresh is handled automatically.
// For PKCE flows:
$authUrl = $kob->auth->getAuthorizationUrl([
    'redirect_uri' => 'https://yourapp.com/callback',
    'scope' => 'accounts payments',
    'code_challenge' => $generatedChallenge,
    'code_challenge_method' => 'S256',
]);`;

const PHP_CHARGE = `// Create a Mobile Money charge
$charge = $kob->charges->create([
    'merchant_id' => 'mch_uuid',
    'amount' => 5000,
    'currency' => 'XAF',
    'channel' => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref' => 'order_001',
], [
    'idempotency_key' => 'idem_unique_key',
]);

echo $charge->data['id'];     // "ch_abc123"
echo $charge->data['status']; // "pending"`;

const PHP_WEBHOOK = `<?php
// Webhook verification middleware
$payload   = file_get_contents('php://input');
$signature = str_replace('hmac_sha256=', '', $_SERVER['HTTP_X_KOB_SIGNATURE'] ?? '');
$timestamp = $_SERVER['HTTP_X_KOB_TIMESTAMP'] ?? '';
$expected  = hash_hmac('sha256', "$timestamp.$payload", $webhookSecret);

if (!hash_equals($expected, $signature)) {
    http_response_code(401);
    exit('Invalid signature');
}

$event = json_decode($payload, true);
// Process $event['event_type'] idempotently using $event['event_id']
http_response_code(200);`;

const PHP_AISP = `// Fetch accounts
$accounts = $kob->accounts->list();

foreach ($accounts->data as $acc) {
    echo "{$acc['account_holder_name']} - {$acc['currency']}\\n";

    $balance = $kob->accounts->getBalance($acc['id']);
    echo "Balance: {$balance->data['amount']} {$balance->data['currency']}\\n";
}

// Fetch transactions
$txns = $kob->accounts->listTransactions($accounts->data[0]['id'], [
    'from' => '2026-01-01',
    'to' => '2026-03-31',
]);`;

const JAVA_AUTH = `import com.kangopenbanking.sdk.KangOpenBanking;
import com.kangopenbanking.sdk.KOBConfig;

KOBConfig config = KOBConfig.builder()
    .clientId("your_client_id")
    .clientSecret("your_client_secret")
    .environment("sandbox") // or "production"
    .build();

KangOpenBanking kob = new KangOpenBanking(config);

// Token refresh is handled automatically.
// For PKCE flows:
String authUrl = kob.auth().getAuthorizationUrl(
    "https://yourapp.com/callback",
    "accounts payments",
    generatedChallenge,
    "S256"
);`;

const JAVA_CHARGE = `import com.kangopenbanking.sdk.models.*;
import java.util.concurrent.CompletableFuture;

// Synchronous
ChargeResponse charge = kob.charges().create(ChargeRequest.builder()
    .merchantId("mch_uuid")
    .amount(5000)
    .currency("XAF")
    .channel("mobile_money")
    .customerPhone("237677123456")
    .txRef("order_001")
    .build()
);

System.out.println(charge.getData().getId());     // "ch_abc123"
System.out.println(charge.getData().getStatus()); // "pending"

// Asynchronous
CompletableFuture<ChargeResponse> asyncCharge = kob.charges().createAsync(request);
asyncCharge.thenAccept(c -> System.out.println(c.getData().getId()));`;

const JAVA_WEBHOOK = `import com.kangopenbanking.sdk.webhooks.WebhookVerifier;

// Spring Boot controller
@PostMapping("/webhooks/kob")
public ResponseEntity<String> handleWebhook(
    @RequestBody String body,
    @RequestHeader("X-KOB-Signature") String signature,
    @RequestHeader("X-KOB-Timestamp") String timestamp
) {
    boolean valid = WebhookVerifier.verify(
        body, signature, timestamp, webhookSecret
    );
    if (!valid) return ResponseEntity.status(401).body("Invalid");

    WebhookEvent event = WebhookVerifier.parse(body);
    log.info("Event: {} {}", event.getEventType(), event.getEventId());
    return ResponseEntity.ok("OK");
}`;

const JAVA_AISP = `// Fetch accounts
ListResponse<Account> accounts = kob.accounts().list();

for (Account acc : accounts.getData()) {
    System.out.printf("%s - %s%n", acc.getAccountHolderName(), acc.getCurrency());

    BalanceResponse balance = kob.accounts().getBalance(acc.getId());
    System.out.printf("Balance: %s %s%n",
        balance.getData().getAmount(), balance.getData().getCurrency());
}

// Fetch transactions
ListResponse<Transaction> txns = kob.accounts().listTransactions(
    accounts.getData().get(0).getId(),
    TransactionFilter.builder()
        .from("2026-01-01")
        .to("2026-03-31")
        .build()
);`;

const GO_AUTH = `import (
    kob "github.com/kangopenbanking/sdk-go"
)

client, err := kob.NewClient(
    kob.WithClientID("your_client_id"),
    kob.WithClientSecret("your_client_secret"),
    kob.WithEnvironment(kob.Sandbox), // or kob.Production
)
if err != nil {
    log.Fatal(err)
}

// Token refresh is handled automatically.
// For PKCE flows:
authURL, err := client.Auth.GetAuthorizationURL(ctx, &kob.AuthURLParams{
    RedirectURI:         "https://yourapp.com/callback",
    Scope:               "accounts payments",
    CodeChallenge:       generatedChallenge,
    CodeChallengeMethod: "S256",
})`;

const GO_CHARGE = `ctx := context.Background()

charge, err := client.Charges.Create(ctx, &kob.ChargeRequest{
    MerchantID:    "mch_uuid",
    Amount:        5000,
    Currency:      "XAF",
    Channel:       "mobile_money",
    CustomerPhone: "237677123456",
    TxRef:         "order_001",
}, kob.WithIdempotencyKey("idem_unique_key"))

if err != nil {
    var apiErr *kob.APIError
    if errors.As(err, &apiErr) {
        log.Printf("API error: %s (code: %s)", apiErr.Detail, apiErr.ErrorCode)
    }
    log.Fatal(err)
}

fmt.Println(charge.Data.ID)     // "ch_abc123"
fmt.Println(charge.Data.Status) // "pending"`;

const GO_WEBHOOK = `import (
    kob "github.com/kangopenbanking/sdk-go/webhook"
)

func webhookHandler(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    sig := r.Header.Get("X-KOB-Signature")
    ts := r.Header.Get("X-KOB-Timestamp")

    event, err := kob.VerifyAndParse(body, sig, ts, webhookSecret)
    if err != nil {
        http.Error(w, "Invalid signature", http.StatusUnauthorized)
        return
    }

    log.Printf("Event: %s %s", event.EventType, event.EventID)
    w.WriteHeader(http.StatusOK)
}`;

const GO_AISP = `// Fetch accounts
accounts, err := client.Accounts.List(ctx, nil)
if err != nil {
    log.Fatal(err)
}

for _, acc := range accounts.Data {
    fmt.Printf("%s - %s\\n", acc.AccountHolderName, acc.Currency)

    balance, _ := client.Accounts.GetBalance(ctx, acc.ID)
    fmt.Printf("Balance: %s %s\\n", balance.Data.Amount, balance.Data.Currency)
}

// Fetch transactions
txns, err := client.Accounts.ListTransactions(ctx, accounts.Data[0].ID, &kob.TransactionFilter{
    From: "2026-01-01",
    To:   "2026-03-31",
})`;

const OPENAPI_GEN = `# Install openapi-generator-cli
npm install -g @openapitools/openapi-generator-cli

# Generate a client for any language
openapi-generator-cli generate \\
  -i https://kangopenbanking.com/openapi.json \\
  -g <language> \\
  -o ./kob-client

# Supported languages include:
# ruby, csharp, swift, kotlin, dart, rust, elixir, scala, r, and 50+ more

# Example: Generate a Rust client
openapi-generator-cli generate \\
  -i https://kangopenbanking.com/openapi.json \\
  -g rust \\
  -o ./kob-rust-client \\
  --additional-properties=packageName=kang_openbanking`;

type SDKDef = {
  key: string;
  title: string;
  desc: string;
  install: string;
  badge: string;
  repo: string;
  registry: string;
  features: string[];
  auth: string;
  charge: string;
  webhook: string;
  aisp: string;
};

const sdks: SDKDef[] = [
  {
    key: "node",
    title: "Node.js / TypeScript",
    desc: "Full-featured SDK with TypeScript types, auto token refresh, and webhook verification. ESM + CJS dual build.",
    install: "npm install @kangopenbanking/sdk",
    badge: "v1.1.0",
    repo: "https://github.com/kangfinance/openbanking-node",
    registry: "https://www.npmjs.com/package/@kangopenbanking/sdk",
    features: [
      "Node.js 18+ and browser (ESM + CJS)",
      "Full TypeScript definitions for all 286 endpoints",
      "Automatic OAuth2 PKCE + token refresh",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation for payments",
    ],
    auth: NODE_AUTH,
    charge: NODE_CHARGE,
    webhook: NODE_WEBHOOK,
    aisp: NODE_AISP,
  },
  {
    key: "python",
    title: "Python",
    desc: "Typed responses with PEP 484 hints, sync + async support via httpx, and context manager pattern.",
    install: "pip install kangopenbanking",
    badge: "v1.1.0",
    repo: "https://github.com/kangfinance/openbanking-python",
    registry: "https://pypi.org/project/kangopenbanking/",
    features: [
      "Python 3.9+ compatible",
      "PEP 484 type hints on all models",
      "Sync and async (httpx) HTTP clients",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    auth: PYTHON_AUTH,
    charge: PYTHON_CHARGE,
    webhook: PYTHON_WEBHOOK,
    aisp: PYTHON_AISP,
  },
  {
    key: "php",
    title: "PHP / Laravel",
    desc: "PSR-4 autoloaded with Laravel service provider, Guzzle HTTP client, and webhook middleware.",
    install: "composer require kangopenbanking/sdk",
    badge: "v1.1.0",
    repo: "https://github.com/kangfinance/openbanking-php",
    registry: "https://packagist.org/packages/kangopenbanking/sdk",
    features: [
      "PHP 8.1+ with PSR-4 autoloading",
      "Laravel service provider + facade",
      "PSR-18 compatible (Guzzle 7)",
      "Webhook HMAC-SHA256 middleware",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    auth: PHP_AUTH,
    charge: PHP_CHARGE,
    webhook: PHP_WEBHOOK,
    aisp: PHP_AISP,
  },
  {
    key: "java",
    title: "Java",
    desc: "Strongly typed models with CompletableFuture async support. Maven and Gradle compatible.",
    install: "<!-- Maven -->\n<dependency>\n  <groupId>com.kangopenbanking</groupId>\n  <artifactId>sdk</artifactId>\n  <version>1.1.0</version>\n</dependency>",
    badge: "v1.1.0",
    repo: "https://github.com/kangfinance/openbanking-java",
    registry: "https://central.sonatype.com/artifact/com.kangopenbanking/sdk",
    features: [
      "Java 11+ compatible",
      "CompletableFuture async support",
      "Maven and Gradle builds",
      "Typed request/response models",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
    ],
    auth: JAVA_AUTH,
    charge: JAVA_CHARGE,
    webhook: JAVA_WEBHOOK,
    aisp: JAVA_AISP,
  },
  {
    key: "go",
    title: "Go",
    desc: "Idiomatic Go with context support, structured errors, and functional options pattern.",
    install: "go get github.com/kangopenbanking/sdk-go",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-go",
    registry: "https://pkg.go.dev/github.com/kangopenbanking/sdk-go",
    features: [
      "Go 1.21+ with generics",
      "Context-aware API calls",
      "Structured error types",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    auth: GO_AUTH,
    charge: GO_CHARGE,
    webhook: GO_WEBHOOK,
    aisp: GO_AISP,
  },
];

const CodeCard = ({ title, code, lang }: { title: string; code: string; lang: string }) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm">{title}</CardTitle>
      <Button variant="ghost" size="sm" onClick={() => copyToClipboard(code)}>
        <Copy className="h-3.5 w-3.5 mr-1" /> Copy
      </Button>
    </CardHeader>
    <CardContent>
      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs leading-relaxed"><code>{code}</code></pre>
    </CardContent>
  </Card>
);

export default function SDKsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight mb-4">SDKs and Client Libraries</h1>
        <p className="text-xl text-muted-foreground">
          Official SDKs covering all 286 endpoints across 42 modules -- with full type safety, automatic authentication, webhook verification, and retry logic.
        </p>
        <p className="text-sm text-muted-foreground mt-2">Last updated: 10 April 2026 | Contact: developers@kangopenbanking.com</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All SDKs are open source on GitHub. They are generated from the{" "}
          <a href="/openapi.json" className="underline font-medium">OpenAPI 3.1 specification</a> and cover
          every endpoint including Gateway, AISP, PISP, Mobile Money, Escrow, Compliance, and ISO 20022.
        </AlertDescription>
      </Alert>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>What the SDKs Cover</CardTitle>
          <CardDescription>Every SDK provides the same complete API surface</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { domain: "Authentication", endpoints: "OAuth2 PKCE, mTLS, token refresh, DCR" },
              { domain: "AISP", endpoints: "Accounts, balances, transactions, beneficiaries, consents" },
              { domain: "PISP", endpoints: "Domestic + international payments, standing orders" },
              { domain: "Gateway Charges", endpoints: "Create, verify, list, cancel, refund" },
              { domain: "Gateway Payouts", endpoints: "Single + batch payouts, instant payouts" },
              { domain: "Mobile Money", endpoints: "MTN MoMo, Orange Money, charge + disburse" },
              { domain: "Webhooks", endpoints: "HMAC-SHA256 verification, event parsing" },
              { domain: "Wallets + Escrow", endpoints: "Custodial wallets, escrow lifecycle" },
              { domain: "Compliance", endpoints: "KYC, AML screening, sanctions checks" },
              { domain: "ISO 20022", endpoints: "pacs.002-009, camt.052-056 parse + generate" },
              { domain: "Sandbox", endpoints: "Test data, webhook simulation, payout sim" },
              { domain: "Bank Directory", endpoints: "Bank lookup, branch search, BIC validation" },
            ].map((item) => (
              <div key={item.domain} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  <span className="font-medium text-sm">{item.domain}</span>
                </div>
                <p className="text-xs text-muted-foreground">{item.endpoints}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* SDK Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sdks.map((sdk) => (
          <Card key={sdk.key} className="relative overflow-hidden">
            <CardHeader>
              <div className="flex items-center gap-3 mb-1">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">{sdk.title}</CardTitle>
                  <Badge variant="default" className="text-[10px] mt-0.5">{sdk.badge}</Badge>
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
                className="bg-muted p-3 rounded-lg font-mono text-xs flex items-center justify-between gap-2 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => copyToClipboard(sdk.install.includes('<') ? sdk.install : sdk.install)}
                title="Click to copy"
              >
                <code className="truncate whitespace-pre-wrap">{sdk.key === 'java' ? 'mvn: com.kangopenbanking:sdk:1.1.0' : sdk.install}</code>
                <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  variant="outline"
                  onClick={() => copyToClipboard(sdk.install)}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Install
                </Button>
                <Button variant="outline" size="icon" asChild>
                  <a href={sdk.repo} target="_blank" rel="noopener noreferrer" title="GitHub">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Separator />

      {/* Language Tabs with Full Examples */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Integration Examples</h2>
        <p className="text-muted-foreground">
          Each tab shows authentication setup, a payment charge, webhook verification, and account information retrieval.
        </p>

        <Tabs defaultValue="node" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="node">Node.js / TypeScript</TabsTrigger>
            <TabsTrigger value="python">Python</TabsTrigger>
            <TabsTrigger value="php">PHP / Laravel</TabsTrigger>
            <TabsTrigger value="java">Java</TabsTrigger>
            <TabsTrigger value="go">Go</TabsTrigger>
          </TabsList>

          {sdks.map((sdk) => (
            <TabsContent key={sdk.key} value={sdk.key} className="space-y-4">
              <CodeCard title="Authentication Setup" code={sdk.auth} lang={sdk.key} />
              <CodeCard title="Charge a Customer" code={sdk.charge} lang={sdk.key} />
              <CodeCard title="Verify a Webhook" code={sdk.webhook} lang={sdk.key} />
              <CodeCard title="Get Account Balance (AISP)" code={sdk.aisp} lang={sdk.key} />

              <div className="text-sm text-muted-foreground">
                Full API reference: <a href="/developer/api-explorer" className="text-primary underline">API Explorer</a>{" | "}
                Repository: <a href={sdk.repo} target="_blank" rel="noopener noreferrer" className="text-primary underline">GitHub</a>{" | "}
                Registry: <a href={sdk.registry} target="_blank" rel="noopener noreferrer" className="text-primary underline">Package</a>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>

      <Separator />

      {/* Generate from OpenAPI */}
      <div className="space-y-4">
        <h2 className="text-3xl font-bold">Generate a Client in Any Language</h2>
        <p className="text-muted-foreground">
          The full OpenAPI 3.1 specification is publicly available at{" "}
          <a href="/openapi.json" className="text-primary underline font-medium">/openapi.json</a>.
          Use <code className="bg-muted px-1.5 py-0.5 rounded text-sm">openapi-generator-cli</code> to generate
          a type-safe client in 50+ languages including Rust, Kotlin, Swift, Dart, C#, Ruby, and more.
        </p>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Generate with openapi-generator-cli</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => copyToClipboard(OPENAPI_GEN)}>
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
          </CardHeader>
          <CardContent>
            <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs leading-relaxed"><code>{OPENAPI_GEN}</code></pre>
          </CardContent>
        </Card>

        <div className="bg-muted/50 rounded-lg p-4 border text-sm text-muted-foreground">
          The specification includes all 286 endpoints, 49+ schemas with <code className="bg-muted px-1 rounded">required[]</code> arrays,
          and standardized response envelopes. Generated clients will have typed models for every request and response.
        </div>
      </div>

      {/* Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {[
              { label: "OpenAPI 3.1 Spec (JSON)", href: "/openapi.json", icon: Code },
              { label: "OpenAPI 3.1 Spec (YAML)", href: "/openapi.yaml", icon: Code },
              { label: "Sandbox Spec", href: "/openapi-sandbox.json", icon: Code },
              { label: "Postman Collection", href: "https://www.postman.com/kangfinance/kang-open-banking-api", icon: Download },
              { label: "API Explorer", href: "/developer/api-explorer", icon: Terminal },
              { label: "Webhook Guide", href: "/developer/gateway/webhooks", icon: Package },
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
