import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download,
  Code,
  CheckCircle2,
  ExternalLink,
  Copy,
  Terminal,
  Package,
  Info,
  BookOpen,
  ShieldCheck,
  Zap,
  GitBranch,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  CurlLogo,
  NodeLogo,
  PythonLogo,
  PhpLogo,
  JavaLogo,
  GoLogo,
} from "@/components/developer/ClientLibraryLogos";

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
  language: string;
  desc: string;
  install: string;
  installLabel: string;
  badge: string;
  repo: string;
  registry: string;
  registryLabel: string;
  runtime: string;
  features: string[];
  Logo: (props: { size?: number; className?: string }) => JSX.Element;
  auth: string;
  charge: string;
  webhook: string;
  aisp: string;
  community?: boolean;
};

const sdks: SDKDef[] = [
  {
    key: "node",
    title: "Node.js / TypeScript",
    language: "typescript",
    desc: "Full-featured SDK with TypeScript types, auto token refresh, and webhook verification. ESM + CJS dual build.",
    install: "npm install @kangopenbanking/sdk",
    installLabel: "npm",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-node",
    registry: "https://www.npmjs.com/package/@kangopenbanking/sdk",
    registryLabel: "npm",
    runtime: "Node.js 18+",
    features: [
      "Node.js 18+ and browser (ESM + CJS)",
      "Full TypeScript definitions for all 286 endpoints",
      "Automatic OAuth2 PKCE + token refresh",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation for payments",
    ],
    Logo: NodeLogo,
    auth: NODE_AUTH,
    charge: NODE_CHARGE,
    webhook: NODE_WEBHOOK,
    aisp: NODE_AISP,
  },
  {
    key: "python",
    title: "Python",
    language: "python",
    desc: "Typed responses with PEP 484 hints, sync + async support via httpx, and context manager pattern.",
    install: "pip install kangopenbanking",
    installLabel: "pip",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-python",
    registry: "https://pypi.org/project/kangopenbanking/",
    registryLabel: "PyPI",
    runtime: "Python 3.9+",
    features: [
      "Python 3.9+ compatible",
      "PEP 484 type hints on all models",
      "Sync and async (httpx) HTTP clients",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    Logo: PythonLogo,
    auth: PYTHON_AUTH,
    charge: PYTHON_CHARGE,
    webhook: PYTHON_WEBHOOK,
    aisp: PYTHON_AISP,
  },
  {
    key: "php",
    title: "PHP / Laravel",
    language: "php",
    desc: "PSR-4 autoloaded with Laravel service provider, Guzzle HTTP client, and webhook middleware.",
    install: "composer require kangopenbanking/sdk",
    installLabel: "composer",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-php",
    registry: "https://packagist.org/packages/kangopenbanking/sdk",
    registryLabel: "Packagist",
    runtime: "PHP 8.1+",
    features: [
      "PHP 8.1+ with PSR-4 autoloading",
      "Laravel service provider + facade",
      "PSR-18 compatible (Guzzle 7)",
      "Webhook HMAC-SHA256 middleware",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    Logo: PhpLogo,
    auth: PHP_AUTH,
    charge: PHP_CHARGE,
    webhook: PHP_WEBHOOK,
    aisp: PHP_AISP,
  },
  {
    key: "java",
    title: "Java",
    language: "java",
    desc: "Strongly typed models with CompletableFuture async support. Maven and Gradle compatible.",
    install: "com.kangopenbanking:sdk:1.1.0",
    installLabel: "Maven",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-java",
    registry: "https://central.sonatype.com/artifact/com.kangopenbanking/sdk",
    registryLabel: "Maven Central",
    runtime: "Java 11+",
    features: [
      "Java 11+ compatible",
      "CompletableFuture async support",
      "Maven and Gradle builds",
      "Typed request/response models",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
    ],
    Logo: JavaLogo,
    auth: JAVA_AUTH,
    charge: JAVA_CHARGE,
    webhook: JAVA_WEBHOOK,
    aisp: JAVA_AISP,
  },
  {
    key: "go",
    title: "Go",
    language: "go",
    desc: "Idiomatic Go with context support, structured errors, and functional options pattern.",
    install: "go get github.com/kangopenbanking/sdk-go",
    installLabel: "go get",
    badge: "v1.1.0",
    repo: "https://github.com/kangopenbanking/sdk-go",
    registry: "https://pkg.go.dev/github.com/kangopenbanking/sdk-go",
    registryLabel: "pkg.go.dev",
    runtime: "Go 1.21+",
    features: [
      "Go 1.21+ with generics",
      "Context-aware API calls",
      "Structured error types",
      "Webhook HMAC-SHA256 verification",
      "Retry with exponential backoff",
      "Idempotency key auto-generation",
    ],
    Logo: GoLogo,
    auth: GO_AUTH,
    charge: GO_CHARGE,
    webhook: GO_WEBHOOK,
    aisp: GO_AISP,
  },
];

const EXAMPLE_TABS = [
  { key: "auth", label: "Authentication", desc: "Initialize the client and prepare an OAuth2 PKCE flow." },
  { key: "charge", label: "Create a charge", desc: "Charge a customer over Mobile Money with idempotency." },
  { key: "webhook", label: "Verify a webhook", desc: "Validate the HMAC-SHA256 signature on inbound events." },
  { key: "aisp", label: "Read accounts", desc: "List accounts, fetch balances, and pull transactions." },
] as const;

type ExampleKey = (typeof EXAMPLE_TABS)[number]["key"];

const HIGHLIGHTS = [
  {
    icon: ShieldCheck,
    title: "Production-grade security",
    body: "OAuth2 PKCE, automatic token rotation, and HMAC-SHA256 webhook verification baked in.",
  },
  {
    icon: Zap,
    title: "Idempotent by default",
    body: "Every payment endpoint accepts an idempotency key and is safe to retry under load.",
  },
  {
    icon: GitBranch,
    title: "Versioned and stable",
    body: "Semantic versioning, deprecation windows, and changelogs for every release.",
  },
  {
    icon: BookOpen,
    title: "Generated from OpenAPI 3.1",
    body: "Identical surface across languages — every model is typed and traceable to a spec field.",
  },
] as const;

const COVERAGE = [
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
] as const;

function CodePanel({
  code,
  language,
  filename,
}: {
  code: string;
  language: string;
  filename: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <Terminal className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono text-muted-foreground truncate">{filename}</span>
          <Badge variant="outline" className="text-[10px] uppercase tracking-wide">
            {language}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copyToClipboard(code)}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
        </Button>
      </div>
      <pre className="bg-card p-4 overflow-x-auto text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function SDKsPage() {
  const [activeSdk, setActiveSdk] = useState<string>("node");
  const [activeExample, setActiveExample] = useState<ExampleKey>("auth");

  const sdk = useMemo(() => sdks.find((s) => s.key === activeSdk) ?? sdks[0], [activeSdk]);
  const exampleCode = sdk[activeExample];
  const exampleMeta = EXAMPLE_TABS.find((t) => t.key === activeExample)!;

  return (
    <div className="space-y-12">
      {/* Hero */}
      <section className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono text-[11px]">
            v4.23.0
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            OpenAPI 3.1
          </Badge>
          <Badge variant="outline" className="text-[11px]">
            286 endpoints
          </Badge>
        </div>
        <div className="space-y-3 max-w-3xl">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
            Official SDKs and client libraries
          </h1>
          <p className="text-lg text-muted-foreground">
            Drop-in client libraries for the Kang Open Banking API. Identical surface across languages,
            generated from the same OpenAPI specification, with built-in authentication, retries, and
            webhook verification.
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated 10 April 2026 · Contact{" "}
            <a className="underline" href="mailto:developers@kangopenbanking.com">
              developers@kangopenbanking.com
            </a>
          </p>
        </div>

        {/* Install matrix — Stripe-style quick install grid */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Install in seconds</span>
            </div>
            <a
              href="/openapi.json"
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
            >
              OpenAPI spec <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 divide-y sm:divide-y-0 sm:divide-x">
            {sdks.map((s) => {
              const Logo = s.Logo;
              const isActive = s.key === activeSdk;
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setActiveSdk(s.key)}
                  className={`text-left px-5 py-4 hover:bg-muted/40 transition-colors ${
                    isActive ? "bg-muted/60" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <Logo size={20} />
                    <span className="text-sm font-semibold">{s.title}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-[11px] text-muted-foreground truncate">
                      {s.install}
                    </code>
                    <Copy
                      className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground shrink-0"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(s.install);
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Highlights row */}
      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {HIGHLIGHTS.map((h) => (
          <div key={h.title} className="rounded-lg border bg-card p-4">
            <div className="h-9 w-9 rounded-md border flex items-center justify-center mb-3">
              <h.icon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold mb-1">{h.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">{h.body}</p>
          </div>
        ))}
      </section>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          All SDKs are open source on GitHub and generated from the{" "}
          <a href="/openapi.json" className="underline font-medium">
            OpenAPI 3.1 specification
          </a>
          . Coverage includes Gateway, AISP, PISP, Mobile Money, Escrow, Compliance, and ISO 20022.
        </AlertDescription>
      </Alert>

      {/* Library cards */}
      <section className="space-y-4">
        <div className="flex items-end justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Client libraries</h2>
            <p className="text-sm text-muted-foreground">
              Pick the SDK that matches your stack. Every library exposes the same modules and naming.
            </p>
          </div>
          <a
            href="/openapi.json"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
          >
            Browse the OpenAPI spec <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sdks.map((s) => {
            const Logo = s.Logo;
            return (
              <Card key={s.key} className="flex flex-col transition-shadow hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="h-11 w-11 rounded-lg border bg-card flex items-center justify-center">
                        <Logo size={24} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{s.title}</CardTitle>
                        <p className="text-xs text-muted-foreground mt-0.5">{s.runtime}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {s.badge}
                    </Badge>
                  </div>
                  <CardDescription className="pt-2 leading-relaxed">{s.desc}</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 gap-4">
                  <div className="space-y-1.5">
                    {s.features.slice(0, 4).map((f) => (
                      <div key={f} className="flex items-start gap-2 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>

                  <div className="rounded-md border bg-muted/40 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] uppercase shrink-0">
                        {s.installLabel}
                      </Badge>
                      <code className="font-mono text-xs truncate">{s.install}</code>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(s.install)}
                      className="text-muted-foreground hover:text-foreground shrink-0"
                      aria-label="Copy install command"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-auto">
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to={`/developer/guides/sdks/${s.key}`}>
                        <BookOpen className="mr-2 h-4 w-4" /> Open library docs
                      </Link>
                    </Button>
                    <Button variant="outline" className="flex-1" asChild>
                      <Link to={`/developer/guides/sdks/${s.key}#examples`}>
                        <Code className="mr-2 h-4 w-4" /> View examples
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <Separator />

      {/* Persistent code explorer */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integration examples</h2>
          <p className="text-sm text-muted-foreground">
            Pick a library and a task. Every example runs against the public sandbox using your test
            credentials.
          </p>
        </div>

        <div className="grid lg:grid-cols-[260px,1fr] gap-4">
          {/* Sidebar — language picker */}
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Language
            </div>
            <div className="flex lg:flex-col overflow-x-auto">
              <button
                type="button"
                onClick={() => copyToClipboard(`curl https://api.kangopenbanking.com/v1/charges \\
  -H "Authorization: Bearer $KOB_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)"`)}
                className="hidden lg:flex items-center gap-2 px-4 py-2.5 text-sm border-b text-muted-foreground hover:bg-muted/40"
                title="Copy a starter cURL request"
              >
                <CurlLogo size={18} />
                <span>cURL (raw)</span>
              </button>
              {sdks.map((s) => {
                const Logo = s.Logo;
                const active = s.key === activeSdk;
                return (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => setActiveSdk(s.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b last:border-b-0 lg:border-b ${
                      active
                        ? "bg-muted text-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Logo size={18} />
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main panel */}
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1 border-b">
              {EXAMPLE_TABS.map((t) => {
                const active = t.key === activeExample;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveExample(t.key)}
                    className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
                      active
                        ? "border-primary text-foreground font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <p className="text-sm text-muted-foreground">{exampleMeta.desc}</p>
            <CodePanel
              code={exampleCode}
              language={sdk.language}
              filename={`example.${
                sdk.key === "node"
                  ? "ts"
                  : sdk.key === "python"
                    ? "py"
                    : sdk.key === "php"
                      ? "php"
                      : sdk.key === "java"
                        ? "java"
                        : "go"
              }`}
            />
            <div className="text-xs text-muted-foreground">
              Full reference:{" "}
              <a href="/developer/api-explorer" className="text-primary underline">
                API Reference
              </a>{" "}
              ·{" "}
              <a href={sdk.repo} target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Repository
              </a>{" "}
              ·{" "}
              <a
                href={sdk.registry}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                {sdk.registryLabel}
              </a>
            </div>
          </div>
        </div>
      </section>

      <Separator />

      {/* Coverage */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">What every SDK covers</h2>
          <p className="text-sm text-muted-foreground">
            Identical module surface across all languages — switching libraries does not change your code
            shape.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {COVERAGE.map((item) => (
            <div key={item.domain} className="rounded-lg border bg-card p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span className="font-medium text-sm">{item.domain}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{item.endpoints}</p>
            </div>
          ))}
        </div>
      </section>

      <Separator />

      {/* Generate from OpenAPI */}
      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Generate a client in any language</h2>
          <p className="text-sm text-muted-foreground">
            The full OpenAPI 3.1 specification is publicly available at{" "}
            <a href="/openapi.json" className="text-primary underline font-medium">
              /openapi.json
            </a>
            . Use <code className="bg-muted px-1.5 py-0.5 rounded text-xs">openapi-generator-cli</code> to
            generate a type-safe client in 50+ languages including Rust, Kotlin, Swift, Dart, C#, and Ruby.
          </p>
        </div>
        <CodePanel code={OPENAPI_GEN} language="bash" filename="generate-client.sh" />
        <div className="rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
          The specification includes all 286 endpoints, 49+ schemas with{" "}
          <code className="bg-muted px-1 rounded">required[]</code> arrays, and standardized response
          envelopes. Generated clients carry typed models for every request and response.
        </div>
      </section>

      {/* Resources */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold tracking-tight">Additional resources</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[
            { label: "OpenAPI 3.1 Spec (JSON)", href: "/openapi.json", icon: Code },
            { label: "OpenAPI 3.1 Spec (YAML)", href: "/openapi.yaml", icon: Code },
            { label: "Sandbox Spec", href: "/openapi-sandbox.json", icon: Code },
            {
              label: "Postman Collection",
              href: "https://www.postman.com/kangfinance/kang-open-banking-api",
              icon: Download,
            },
            { label: "API Reference", href: "/developer/api-explorer", icon: Terminal },
            { label: "Webhook Guide", href: "/developer/gateway/webhooks", icon: Package },
          ].map((r) => (
            <a
              key={r.label}
              href={r.href}
              target={r.href.startsWith("http") ? "_blank" : undefined}
              rel={r.href.startsWith("http") ? "noopener noreferrer" : undefined}
              className="flex items-center gap-3 p-3 border rounded-lg bg-card hover:bg-muted/40 transition-colors"
            >
              <r.icon className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{r.label}</span>
              <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
            </a>
          ))}
        </div>
      </section>

      {/* Generated typed clients — produced by openapi-generator-cli on every commit
          via .github/workflows/sdk-generate.yml from public/openapi.json. These are
          low-level, fully-typed bindings for institutions that prefer raw spec
          coverage over the curated DX of the hand-tuned packages above. */}
      <section className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Generated typed clients</h2>
            <p className="text-muted-foreground text-sm mt-1">
              Auto-generated from the published OpenAPI specification on every API release.
              100% endpoint coverage, fully typed, refreshed via CI.
            </p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary">
            <GitBranch className="h-3 w-3 mr-1" />
            Tracks <code className="ml-1">info.version</code>
          </Badge>
        </div>

        <Alert className="border-border/60">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Prefer the curated SDKs above for production integrations — they include retries,
            idempotency helpers, and FAPI-1.0 hardening. Use the generated clients when you
            need raw, exhaustive coverage of every endpoint and schema in the spec.
          </AlertDescription>
        </Alert>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { lang: "TypeScript", generator: "typescript-fetch", path: "typescript", install: "npm install ./sdks/generated/typescript", Icon: NodeLogo },
            { lang: "Python", generator: "python (urllib3)", path: "python", install: "pip install ./sdks/generated/python", Icon: PythonLogo },
            { lang: "Go", generator: "go", path: "go", install: "go get ./sdks/generated/go", Icon: GoLogo },
            { lang: "Java", generator: "java (okhttp-gson)", path: "java", install: "mvn install -f sdks/generated/java/pom.xml", Icon: JavaLogo },
          ].map((c) => (
            <Card key={c.lang} className="border-border/60">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <c.Icon className="h-6 w-6" />
                  <CardTitle className="text-base">{c.lang}</CardTitle>
                </div>
                <CardDescription className="text-xs">{c.generator}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="bg-muted/60 rounded-md p-2 text-xs font-mono break-all">
                  {c.install}
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full"
                  onClick={() => copyToClipboard(c.install)}
                >
                  <Copy className="h-3 w-3 mr-2" />
                  Copy install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              Regenerate locally
            </CardTitle>
            <CardDescription className="text-xs">
              Java 11+ required. Output is written to <code>sdks/generated/&lt;lang&gt;/</code>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted/60 rounded-md p-3 text-xs font-mono">
              npm run sdk:generate
            </div>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Latest CI build artifact:{" "}
          <a
            href="https://github.com/kangopenbanking/platform/actions/workflows/sdk-generate.yml"
            target="_blank"
            rel="noreferrer"
            className="text-primary underline"
          >
            kangopenbanking-typed-sdks
          </a>{" "}
          (90-day retention).
        </p>
      </section>

      <AutoDocNavigation />
    </div>
  );
}
