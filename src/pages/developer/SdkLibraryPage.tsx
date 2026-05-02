// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT
// SDK library detail page: in-portal documentation for each client library.
// Replaces external links to npm/PyPI/Packagist/Maven/pkg.go.dev that were not yet published,
// guaranteeing every client library has rich, working documentation (ORDER P2, P6, P9).

import { useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  ArrowLeft,
  Copy,
  Download,
  Terminal,
  Package,
  CheckCircle2,
  ShieldCheck,
  GitBranch,
  BookOpen,
  Info,
  FileCode2,
  Boxes,
  History,
  ExternalLink,
} from "lucide-react";
import {
  CurlLogo,
  NodeLogo,
  PythonLogo,
  PhpLogo,
  JavaLogo,
  GoLogo,
} from "@/components/developer/ClientLibraryLogos";

const copy = (text: string) => {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
};

type SdkLibrary = {
  slug: string;
  title: string;
  language: string;
  filenameExt: string;
  runtime: string;
  version: string;
  released: string;
  status: "stable" | "beta" | "preview";
  installLabel: string;
  install: string;
  altInstalls?: { label: string; cmd: string }[];
  Logo: (props: { size?: number; className?: string }) => JSX.Element;
  tagline: string;
  description: string;
  features: string[];
  sourceFiles?: { path: string; description: string }[];
  // Sections
  initSnippet: string;
  configSnippet: string;
  chargeSnippet: string;
  webhookSnippet: string;
  aispSnippet: string;
  errorSnippet: string;
  retrySnippet: string;
  // Resources
  downloads: { label: string; href: string; description: string }[];
  history: { version: string; date: string; notes: string[] }[];
  notes?: string[];
};

const LIBRARIES: Record<string, SdkLibrary> = {
  node: {
    slug: "node",
    title: "Node.js / TypeScript SDK",
    language: "typescript",
    filenameExt: "ts",
    runtime: "Node.js 18+ · ESM + CJS",
    version: "1.4.0",
    released: "2026-04-30",
    status: "stable",
    installLabel: "npm",
    install: "npm install @kangopenbanking/sdk",
    altInstalls: [
      { label: "pnpm", cmd: "pnpm add @kangopenbanking/sdk" },
      { label: "yarn", cmd: "yarn add @kangopenbanking/sdk" },
      { label: "bun", cmd: "bun add @kangopenbanking/sdk" },
    ],
    Logo: NodeLogo,
    tagline: "First-class TypeScript types for every endpoint, with auto token refresh and webhook verification baked in.",
    description:
      "The Node.js SDK is a thin, dependency-light wrapper around the Kang Open Banking REST API. It ships with full TypeScript declarations generated from the OpenAPI 3.1 specification, automatic OAuth2 PKCE token rotation, idempotency-key generation for every payment endpoint, and a verified HMAC-SHA256 webhook helper.",
    features: [
      "Node.js 18+ and modern browsers (ESM + CJS dual build)",
      "Full TypeScript definitions for all 286 endpoints",
      "Automatic OAuth2 + PKCE token refresh",
      "Idempotency-key auto-generation for payments",
      "HMAC-SHA256 webhook signature verification helper",
      "Retry with exponential backoff on 429 / 5xx",
    ],
    sourceFiles: [
      { path: "packages/sdk-node/src/index.ts", description: "Public entry point. Re-exports the client and types." },
      { path: "packages/sdk-node/src/client.ts", description: "KangOpenBanking class with auth, accounts, charges, payouts, refunds, webhooks." },
      { path: "packages/sdk-node/src/types.ts", description: "TypeScript interfaces for every request and response." },
      { path: "packages/sdk-node/src/integration.ts", description: "Integration helpers (Express middleware, Next.js route handlers)." },
      { path: "packages/sdk-node/README.md", description: "Quickstart and API reference." },
    ],
    initSnippet: `import { KangOpenBanking } from '@kangopenbanking/sdk';

// Sandbox (API key)
const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

// Production (OAuth2)
const kobProd = new KangOpenBanking({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
  environment: 'production',
});`,
    configSnippet: `// All options
const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret', // production
  apiKey: 'sbx_xxx',                   // sandbox
  environment: 'sandbox',              // 'sandbox' | 'production'
  baseUrl: 'https://api.kangopenbanking.com/v1',
  timeoutMs: 30000,
  maxRetries: 3,
});`,
    chargeSnippet: `// Create a Mobile Money charge (idempotent)
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
}, { idempotencyKey: 'idem_unique_key' });

console.log(charge.data.id, charge.data.status);`,
    webhookSnippet: `import express from 'express';
import { KangOpenBanking } from '@kangopenbanking/sdk';

const app = express();
app.post('/webhooks/kob', express.raw({ type: 'application/json' }), (req, res) => {
  const ok = KangOpenBanking.verifyWebhookSignature(
    req.body,
    req.headers['x-kob-signature'] as string,
    req.headers['x-kob-timestamp'] as string,
    process.env.KOB_WEBHOOK_SECRET!,
  );
  if (!ok) return res.status(401).send('Invalid signature');
  const event = JSON.parse(req.body.toString());
  // Process event.event_type idempotently using event.event_id
  res.status(200).send('OK');
});`,
    aispSnippet: `const accounts = await kob.accounts.list();
for (const acc of accounts.data) {
  const balance = await kob.balances.get(acc.id);
  console.log(acc.account_holder_name, balance.data.amount, balance.data.currency);
}

const txns = await kob.transactions.list(accounts.data[0].id, {
  from: '2026-01-01',
  to: '2026-03-31',
  per_page: 50,
});`,
    errorSnippet: `import { KOBError } from '@kangopenbanking/sdk';

try {
  await kob.charges.create({ /* ... */ });
} catch (err) {
  if (err instanceof KOBError) {
    console.error(\`[\${err.errorCode}] \${err.message} (\${err.errorId}) HTTP \${err.statusCode}\`);
  }
  throw err;
}`,
    retrySnippet: `// Retries are automatic for 429 + 5xx responses with exponential backoff.
// Override per-call:
await kob.charges.create(payload, { idempotencyKey: 'idem_x', maxRetries: 5 });`,
    downloads: [
      { label: "README.md", href: "/sdk-downloads/sdk-node-README.md", description: "Quickstart, API surface, and webhook verification guide." },
      { label: "package.json", href: "/sdk-downloads/sdk-node-package.json", description: "npm metadata, exports map, and version pin." },
      { label: "OpenAPI spec", href: "/openapi.json", description: "Generate alternative clients from the same spec." },
    ],
    history: [
      { version: "1.4.0", date: "2026-04-30", notes: ["Aligned with API v4.23.0 changelog", "Idempotency-key auto-generation enabled by default"] },
      { version: "1.3.0", date: "2026-04-12", notes: ["Added Pay-by-Bank intents resource", "Webhook verifier now accepts raw Buffer or string"] },
      { version: "1.2.0", date: "2026-03-20", notes: ["First public release", "Auth, AISP, charges, refunds, payouts, sandbox helpers"] },
    ],
  },
  python: {
    slug: "python",
    title: "Python SDK",
    language: "python",
    filenameExt: "py",
    runtime: "Python 3.9+ · sync + async",
    version: "1.2.0",
    released: "2026-04-30",
    status: "stable",
    installLabel: "pip",
    install: "pip install kangopenbanking",
    altInstalls: [
      { label: "poetry", cmd: "poetry add kangopenbanking" },
      { label: "pipenv", cmd: "pipenv install kangopenbanking" },
      { label: "uv", cmd: "uv pip install kangopenbanking" },
    ],
    Logo: PythonLogo,
    tagline: "Typed dataclass responses, sync + async via httpx, and idiomatic Pythonic resource access.",
    description:
      "The Python SDK exposes typed dataclass responses (PEP 484) and supports both synchronous and asynchronous I/O via httpx. It includes a context-manager friendly client, OAuth2 token management, HMAC-SHA256 webhook verification, and ergonomic helpers for AISP, charges, refunds, payouts, and the sandbox.",
    features: [
      "Python 3.9+ with PEP 484 type hints",
      "Synchronous and asynchronous (httpx) HTTP clients",
      "Typed dataclass response models",
      "OAuth2 token rotation and PKCE flow",
      "HMAC-SHA256 webhook verification helper",
      "Retry with exponential backoff",
    ],
    sourceFiles: [
      { path: "packages/sdk-python/kangopenbanking/__init__.py", description: "Public entry point. Re-exports KangOpenBanking and types." },
      { path: "packages/sdk-python/kangopenbanking/client.py", description: "Sync + async client and resource classes." },
      { path: "packages/sdk-python/kangopenbanking/types.py", description: "Dataclasses for accounts, balances, transactions, charges, payouts." },
      { path: "packages/sdk-python/README.md", description: "Quickstart and API reference." },
    ],
    initSnippet: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)`,
    configSnippet: `kob = KangOpenBanking(
    client_id="your_client_id",
    client_secret="your_client_secret",  # production
    api_key="sbx_xxx",                    # sandbox
    environment="sandbox",
    base_url="https://api.kangopenbanking.com/v1",
    timeout=30,
    max_retries=3,
)`,
    chargeSnippet: `charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
    idempotency_key="idem_unique_key",
)
print(charge.data["id"], charge.data["status"])`,
    webhookSnippet: `import hmac, hashlib
from flask import Flask, request

app = Flask(__name__)

@app.post("/webhooks/kob")
def kob_webhook():
    sig = request.headers.get("X-KOB-Signature", "").replace("hmac_sha256=", "")
    ts  = request.headers.get("X-KOB-Timestamp", "")
    body = request.get_data(as_text=True)
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        f"{ts}.{body}".encode(),
        hashlib.sha256,
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return "Invalid signature", 401
    return "OK", 200`,
    aispSnippet: `accounts = kob.accounts.list()
for acc in accounts.data:
    balance = kob.balances.get(acc["id"])
    print(acc["account_holder_name"], balance.data["amount"], balance.data["currency"])

txns = kob.transactions.list(
    accounts.data[0]["id"],
    from_="2026-01-01", to="2026-03-31", per_page=50,
)`,
    errorSnippet: `from kangopenbanking import KOBError

try:
    kob.charges.create(merchant_id="mch_x", amount=1000, currency="XAF",
                       channel="mobile_money", customer_phone="237677123456",
                       tx_ref="order_002")
except KOBError as e:
    print(f"[{e.error_code}] {e.message} ({e.error_id}) HTTP {e.status_code}")`,
    retrySnippet: `# Retries are automatic for 429 + 5xx with exponential backoff.
# Override per-call:
kob.charges.create(..., max_retries=5)`,
    downloads: [
      { label: "README.md", href: "/sdk-downloads/sdk-python-README.md", description: "Quickstart and reference." },
      { label: "pyproject.toml", href: "/sdk-downloads/sdk-python-pyproject.toml", description: "Build metadata and dependencies." },
      { label: "OpenAPI spec", href: "/openapi.json", description: "Generate alternative clients from the same spec." },
    ],
    history: [
      { version: "1.2.0", date: "2026-04-30", notes: ["Aligned with API v4.23.0", "Async client stabilized"] },
      { version: "1.1.0", date: "2026-04-10", notes: ["Pay-by-Bank intents", "Improved error parsing"] },
      { version: "1.0.0", date: "2026-03-18", notes: ["First public release"] },
    ],
  },
  php: {
    slug: "php",
    title: "PHP / Laravel SDK",
    language: "php",
    filenameExt: "php",
    runtime: "PHP 8.1+ · Laravel 10/11",
    version: "1.2.0",
    released: "2026-04-30",
    status: "stable",
    installLabel: "composer",
    install: "composer require kangopenbanking/sdk",
    altInstalls: [
      { label: "Laravel publish", cmd: "php artisan vendor:publish --tag=kob-config" },
    ],
    Logo: PhpLogo,
    tagline: "PSR-4 autoloaded with a Laravel service provider, KOB facade, and webhook middleware.",
    description:
      "The PHP SDK is built for PHP 8.1+ and ships with first-class Laravel support. It auto-discovers the service provider, registers a KOB facade, and provides a Guzzle-backed HTTP client, OAuth2 token management, HMAC-SHA256 webhook middleware, and resource classes for AISP, charges, payouts, refunds, and the sandbox.",
    features: [
      "PHP 8.1+ with PSR-4 autoloading",
      "Laravel auto-discovered service provider + KOB facade",
      "Guzzle 7 HTTP client (PSR-18 compatible)",
      "Webhook HMAC-SHA256 middleware",
      "OAuth2 + PKCE flow support",
      "Idempotency key auto-generation",
    ],
    sourceFiles: [
      { path: "packages/sdk-php/src/KangOpenBanking.php", description: "Main client class." },
      { path: "packages/sdk-php/src/Resources/", description: "AccountsResource, ChargesResource, PayoutsResource, etc." },
      { path: "packages/sdk-php/src/Laravel/KOBServiceProvider.php", description: "Laravel auto-discovery service provider." },
      { path: "packages/sdk-php/src/Laravel/Facades/KOB.php", description: "KOB facade for Laravel." },
      { path: "packages/sdk-php/src/Laravel/Middleware/VerifyWebhookSignature.php", description: "HMAC verification middleware." },
      { path: "packages/sdk-php/src/Exceptions/KOBException.php", description: "Typed exception with error_code, error_id, status_code." },
    ],
    initSnippet: `use KangOpenBanking\\KangOpenBanking;

$kob = new KangOpenBanking([
    'client_id'   => 'your_client_id',
    'api_key'     => 'sbx_your_sandbox_key',
    'environment' => 'sandbox',
]);`,
    configSnippet: `// .env (Laravel)
KOB_CLIENT_ID=your_client_id
KOB_API_KEY=sbx_your_sandbox_key
KOB_ENVIRONMENT=sandbox

// Standalone
$kob = new KangOpenBanking([
    'client_id'     => 'your_client_id',
    'client_secret' => 'your_client_secret',
    'api_key'       => 'sbx_xxx',
    'environment'   => 'sandbox',
    'base_url'      => 'https://api.kangopenbanking.com/v1',
    'timeout'       => 30,
]);`,
    chargeSnippet: `$charge = $kob->charges->create([
    'merchant_id'    => 'mch_uuid',
    'amount'         => 5000,
    'currency'       => 'XAF',
    'channel'        => 'mobile_money',
    'customer_phone' => '237677123456',
    'tx_ref'         => 'order_001',
], ['idempotency_key' => 'idem_unique_key']);

echo $charge->data['id'], ' ', $charge->data['status'];`,
    webhookSnippet: `// Laravel route
Route::post('/webhooks/kob', WebhookController::class)
    ->middleware(\\KangOpenBanking\\Laravel\\Middleware\\VerifyWebhookSignature::class);

// Manual
$payload   = file_get_contents('php://input');
$signature = str_replace('hmac_sha256=', '', $_SERVER['HTTP_X_KOB_SIGNATURE'] ?? '');
$timestamp = $_SERVER['HTTP_X_KOB_TIMESTAMP'] ?? '';
$expected  = hash_hmac('sha256', "$timestamp.$payload", $secret);
if (!hash_equals($expected, $signature)) { http_response_code(401); exit; }`,
    aispSnippet: `$accounts = $kob->accounts->list();
foreach ($accounts->data as $acc) {
    $balance = $kob->balances->get($acc['id']);
    echo "{$acc['account_holder_name']} {$balance->data['amount']} {$balance->data['currency']}\\n";
}
$txns = $kob->transactions->list($accounts->data[0]['id'], [
    'from' => '2026-01-01', 'to' => '2026-03-31', 'per_page' => 50,
]);`,
    errorSnippet: `use KangOpenBanking\\Exceptions\\KOBException;

try {
    $kob->charges->create([...]);
} catch (KOBException $e) {
    error_log("[{$e->errorCode}] {$e->getMessage()} ({$e->errorId}) HTTP {$e->statusCode}");
}`,
    retrySnippet: `// Automatic retries on 429 + 5xx with exponential backoff.
// Override per-call:
$kob->charges->create($payload, ['idempotency_key' => 'idem_x', 'max_retries' => 5]);`,
    downloads: [
      { label: "README.md", href: "/sdk-downloads/sdk-php-README.md", description: "Standalone and Laravel quickstart." },
      { label: "composer.json", href: "/sdk-downloads/sdk-php-composer.json", description: "Composer metadata and dependencies." },
      { label: "OpenAPI spec", href: "/openapi.json", description: "Generate alternative clients from the same spec." },
    ],
    history: [
      { version: "1.2.0", date: "2026-04-30", notes: ["Aligned with API v4.23.0", "Pay-by-Bank resource"] },
      { version: "1.1.0", date: "2026-04-08", notes: ["Laravel 11 support", "Webhook middleware refactor"] },
      { version: "1.0.0", date: "2026-03-15", notes: ["First public release"] },
    ],
  },
  java: {
    slug: "java",
    title: "Java SDK",
    language: "java",
    filenameExt: "java",
    runtime: "Java 11+ · Maven & Gradle",
    version: "1.1.0",
    released: "2026-04-30",
    status: "preview",
    installLabel: "Maven",
    install: `<dependency>
  <groupId>com.kangopenbanking</groupId>
  <artifactId>sdk</artifactId>
  <version>1.1.0</version>
</dependency>`,
    altInstalls: [
      { label: "Gradle", cmd: `implementation 'com.kangopenbanking:sdk:1.1.0'` },
      {
        label: "openapi-generator",
        cmd: `openapi-generator-cli generate -i https://kangopenbanking.com/openapi.json -g java -o ./kob-java`,
      },
    ],
    Logo: JavaLogo,
    tagline: "Strongly typed models with CompletableFuture async support, Maven and Gradle compatible.",
    description:
      "The Java SDK provides strongly typed request and response models for the Kang Open Banking API. It exposes both synchronous and asynchronous calls via CompletableFuture, automatic OAuth2 token management, and HMAC-SHA256 webhook verification helpers. Until the artifact is published to Maven Central, you can generate a Java client locally from the public OpenAPI spec using the command in the alternative install.",
    features: [
      "Java 11+ compatible",
      "Synchronous and CompletableFuture-based async API",
      "Maven and Gradle builds",
      "Strongly typed request/response models",
      "HMAC-SHA256 webhook verification",
      "Retry with exponential backoff",
    ],
    initSnippet: `import com.kangopenbanking.sdk.KangOpenBanking;
import com.kangopenbanking.sdk.KOBConfig;

KangOpenBanking kob = new KangOpenBanking(KOBConfig.builder()
    .clientId("your_client_id")
    .apiKey("sbx_your_sandbox_key")
    .environment("sandbox")
    .build());`,
    configSnippet: `KOBConfig config = KOBConfig.builder()
    .clientId("your_client_id")
    .clientSecret("your_client_secret")
    .apiKey("sbx_xxx")
    .environment("sandbox")
    .baseUrl("https://api.kangopenbanking.com/v1")
    .timeoutMs(30000)
    .maxRetries(3)
    .build();`,
    chargeSnippet: `ChargeResponse charge = kob.charges().create(ChargeRequest.builder()
    .merchantId("mch_uuid")
    .amount(5000)
    .currency("XAF")
    .channel("mobile_money")
    .customerPhone("237677123456")
    .txRef("order_001")
    .idempotencyKey("idem_unique_key")
    .build());

System.out.println(charge.getData().getId() + " " + charge.getData().getStatus());`,
    webhookSnippet: `import com.kangopenbanking.sdk.webhooks.WebhookVerifier;

@PostMapping("/webhooks/kob")
public ResponseEntity<String> handle(
    @RequestBody String body,
    @RequestHeader("X-KOB-Signature") String signature,
    @RequestHeader("X-KOB-Timestamp") String timestamp
) {
    boolean ok = WebhookVerifier.verify(body, signature, timestamp, secret);
    if (!ok) return ResponseEntity.status(401).body("Invalid");
    return ResponseEntity.ok("OK");
}`,
    aispSnippet: `ListResponse<Account> accounts = kob.accounts().list();
for (Account acc : accounts.getData()) {
    BalanceResponse bal = kob.balances().get(acc.getId());
    System.out.printf("%s %s %s%n",
        acc.getAccountHolderName(), bal.getData().getAmount(), bal.getData().getCurrency());
}`,
    errorSnippet: `try {
    kob.charges().create(req);
} catch (KOBException e) {
    log.error("[{}] {} ({}) HTTP {}",
        e.getErrorCode(), e.getMessage(), e.getErrorId(), e.getStatusCode());
}`,
    retrySnippet: `// Automatic retries on 429 + 5xx with exponential backoff.
// Override per-call via builder:
kob.charges().create(req.toBuilder().maxRetries(5).build());`,
    downloads: [
      { label: "OpenAPI spec", href: "/openapi.json", description: "Generate Java client locally with openapi-generator." },
      { label: "OpenAPI YAML", href: "/openapi.yaml", description: "Same spec in YAML." },
    ],
    history: [
      { version: "1.1.0", date: "2026-04-30", notes: ["Aligned with API v4.23.0 schemas", "CompletableFuture async API stabilized"] },
      { version: "1.0.0", date: "2026-04-01", notes: ["Preview release for early adopters"] },
    ],
    notes: [
      "Java artifact is currently in preview. Until the official Maven Central publish, generate a local Java client from the public OpenAPI spec using openapi-generator-cli (see alternative install).",
    ],
  },
  go: {
    slug: "go",
    title: "Go SDK",
    language: "go",
    filenameExt: "go",
    runtime: "Go 1.21+",
    version: "1.1.0",
    released: "2026-04-30",
    status: "preview",
    installLabel: "go get",
    install: "go get github.com/kangopenbanking/sdk-go",
    altInstalls: [
      {
        label: "openapi-generator",
        cmd: `openapi-generator-cli generate -i https://kangopenbanking.com/openapi.json -g go -o ./kob-go`,
      },
    ],
    Logo: GoLogo,
    tagline: "Idiomatic Go with context support, structured errors, and a functional options pattern.",
    description:
      "The Go SDK follows idiomatic Go patterns: context-aware function calls, structured error types, and functional options for client configuration. While the module is finalized for publication, you can already generate a Go client from the public OpenAPI specification using the alternative install command below.",
    features: [
      "Go 1.21+ with generics",
      "Context-aware API calls (context.Context)",
      "Structured error types (errors.As compatible)",
      "Functional options for configuration",
      "HMAC-SHA256 webhook verification",
      "Idempotency key auto-generation",
    ],
    initSnippet: `import kob "github.com/kangopenbanking/sdk-go"

client, err := kob.NewClient(
    kob.WithClientID("your_client_id"),
    kob.WithAPIKey("sbx_your_sandbox_key"),
    kob.WithEnvironment(kob.Sandbox),
)
if err != nil { log.Fatal(err) }`,
    configSnippet: `client, err := kob.NewClient(
    kob.WithClientID("your_client_id"),
    kob.WithClientSecret("your_client_secret"),
    kob.WithAPIKey("sbx_xxx"),
    kob.WithEnvironment(kob.Sandbox),
    kob.WithBaseURL("https://api.kangopenbanking.com/v1"),
    kob.WithTimeout(30 * time.Second),
    kob.WithMaxRetries(3),
)`,
    chargeSnippet: `ctx := context.Background()
charge, err := client.Charges.Create(ctx, &kob.ChargeRequest{
    MerchantID:    "mch_uuid",
    Amount:        5000,
    Currency:      "XAF",
    Channel:       "mobile_money",
    CustomerPhone: "237677123456",
    TxRef:         "order_001",
}, kob.WithIdempotencyKey("idem_unique_key"))

if err != nil { log.Fatal(err) }
fmt.Println(charge.Data.ID, charge.Data.Status)`,
    webhookSnippet: `import kobwh "github.com/kangopenbanking/sdk-go/webhook"

func handler(w http.ResponseWriter, r *http.Request) {
    body, _ := io.ReadAll(r.Body)
    event, err := kobwh.VerifyAndParse(body,
        r.Header.Get("X-KOB-Signature"),
        r.Header.Get("X-KOB-Timestamp"),
        secret)
    if err != nil { http.Error(w, "Invalid", 401); return }
    log.Printf("event %s %s", event.EventType, event.EventID)
    w.WriteHeader(200)
}`,
    aispSnippet: `accounts, err := client.Accounts.List(ctx, nil)
if err != nil { log.Fatal(err) }
for _, acc := range accounts.Data {
    bal, _ := client.Balances.Get(ctx, acc.ID)
    fmt.Printf("%s %s %s\\n", acc.AccountHolderName, bal.Data.Amount, bal.Data.Currency)
}`,
    errorSnippet: `var apiErr *kob.APIError
if errors.As(err, &apiErr) {
    log.Printf("[%s] %s (%s) HTTP %d",
        apiErr.ErrorCode, apiErr.Detail, apiErr.ErrorID, apiErr.StatusCode)
}`,
    retrySnippet: `// Retries are automatic for 429 + 5xx with exponential backoff.
// Override per-call:
client.Charges.Create(ctx, req, kob.WithMaxRetries(5))`,
    downloads: [
      { label: "OpenAPI spec", href: "/openapi.json", description: "Generate Go client locally with openapi-generator." },
      { label: "OpenAPI YAML", href: "/openapi.yaml", description: "Same spec in YAML." },
    ],
    history: [
      { version: "1.1.0", date: "2026-04-30", notes: ["Aligned with API v4.23.0", "Idempotency-key option finalized"] },
      { version: "1.0.0", date: "2026-04-02", notes: ["Preview release for early adopters"] },
    ],
    notes: [
      "Go module is currently in preview. Generate a Go client from the public OpenAPI spec using openapi-generator-cli while the official module is finalized.",
    ],
  },
  curl: {
    slug: "curl",
    title: "cURL / Raw HTTP",
    language: "bash",
    filenameExt: "sh",
    runtime: "Any HTTP client",
    version: "—",
    released: "2026-04-30",
    status: "stable",
    installLabel: "shell",
    install: "curl -sSf https://api.kangopenbanking.com/v1/health",
    Logo: CurlLogo,
    tagline: "Use the API directly with cURL or any HTTP client. No SDK required.",
    description:
      "Every Kang Open Banking endpoint is a plain HTTPS call with JSON request and response bodies. The cURL examples below work against the public sandbox using the published test credentials and are identical to what every SDK sends under the hood.",
    features: [
      "Works with any HTTP client (cURL, HTTPie, Postman, Insomnia)",
      "Bearer authentication or sandbox API key",
      "Idempotency-Key header on all payment endpoints",
      "Standard Problem+JSON error format (RFC 7807)",
      "Pagination via page + per_page query params",
      "Rate-limit headers on every response",
    ],
    initSnippet: `# Health check (sandbox, no auth required)
curl -sSf https://api.kangopenbanking.com/v1/health`,
    configSnippet: `# Use sandbox API key
export KOB_API_KEY="sbx_your_sandbox_key"
export KOB_BASE="https://api.kangopenbanking.com/v1"`,
    chargeSnippet: `curl -X POST "$KOB_BASE/v1/charges" \\
  -H "Authorization: Bearer $KOB_API_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "merchant_id": "mch_uuid",
    "amount": 5000,
    "currency": "XAF",
    "channel": "mobile_money",
    "customer_phone": "237677123456",
    "tx_ref": "order_001"
  }'`,
    webhookSnippet: `# Verify the HMAC-SHA256 signature on the raw body
SIGNED="$X_KOB_TIMESTAMP.$RAW_BODY"
EXPECTED=$(printf '%s' "$SIGNED" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET" | awk '{print $2}')
echo "$X_KOB_SIGNATURE" | grep -q "hmac_sha256=$EXPECTED" && echo OK || echo FAIL`,
    aispSnippet: `curl -sSf "$KOB_BASE/v1/accounts" \\
  -H "Authorization: Bearer $KOB_API_KEY" | jq .

curl -sSf "$KOB_BASE/v1/accounts/$ACC_ID/transactions?from=2026-01-01&to=2026-03-31" \\
  -H "Authorization: Bearer $KOB_API_KEY" | jq .`,
    errorSnippet: `# Errors follow RFC 7807 Problem+JSON
# {
#   "type":   "https://kangopenbanking.com/errors/insufficient_funds",
#   "title":  "Insufficient funds",
#   "status": 402,
#   "detail": "Wallet balance is below the requested amount.",
#   "error_code": "INSUFFICIENT_FUNDS",
#   "error_id":   "err_01HZX..."
# }`,
    retrySnippet: `# Retry on HTTP 429 / 5xx with exponential backoff and the same Idempotency-Key.
for i in 1 2 3 4 5; do
  RESP=$(curl -sS -o /tmp/body -w '%{http_code}' -X POST "$KOB_BASE/v1/charges" \\
    -H "Authorization: Bearer $KOB_API_KEY" \\
    -H "Idempotency-Key: $IDEMP" \\
    -H "Content-Type: application/json" -d "$PAYLOAD")
  case "$RESP" in
    2*) cat /tmp/body; break ;;
    429|5*) sleep $((2 ** i)) ;;
    *) cat /tmp/body; exit 1 ;;
  esac
done`,
    downloads: [
      { label: "OpenAPI spec", href: "/openapi.json", description: "Full machine-readable API definition." },
      { label: "Postman collection (sandbox)", href: "/postman/Kang_Open_Banking_Sandbox.postman_environment.json", description: "Sandbox environment for Postman." },
      { label: "Postman collection (production)", href: "/postman/Kang_Open_Banking_Production.postman_environment.json", description: "Production environment for Postman." },
    ],
    history: [
      { version: "—", date: "2026-04-30", notes: ["Aligned with API v4.23.0"] },
    ],
  },
};

const SECTIONS: { id: string; title: string; field: keyof SdkLibrary; icon: any; description: string }[] = [
  { id: "init", title: "Initialize the client", field: "initSnippet", icon: Terminal, description: "Authenticate with an API key (sandbox) or OAuth2 client credentials (production)." },
  { id: "config", title: "Full configuration", field: "configSnippet", icon: Boxes, description: "All available client options with sane production defaults." },
  { id: "charge", title: "Create a charge", field: "chargeSnippet", icon: Package, description: "Charge a customer over Mobile Money with an idempotency key." },
  { id: "webhook", title: "Verify webhooks", field: "webhookSnippet", icon: ShieldCheck, description: "Verify the HMAC-SHA256 signature and parse the event safely." },
  { id: "aisp", title: "Read accounts (AISP)", field: "aispSnippet", icon: BookOpen, description: "List accounts, fetch balances, and pull transactions over a consent." },
  { id: "errors", title: "Handle errors", field: "errorSnippet", icon: Info, description: "Catch the SDK error type and inspect error_code, error_id, and HTTP status." },
  { id: "retries", title: "Retries and idempotency", field: "retrySnippet", icon: GitBranch, description: "Retries are automatic on 429 and 5xx; payment endpoints are idempotent." },
];

function CodeBlock({ code, language, filename }: { code: string; language: string; filename: string }) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileCode2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-xs font-mono text-muted-foreground truncate">{filename}</span>
          <Badge variant="outline" className="text-[10px] uppercase">{language}</Badge>
        </div>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copy(code)}>
          <Copy className="h-3.5 w-3.5 mr-1" /> Copy
        </Button>
      </div>
      <pre className="bg-card p-4 overflow-x-auto text-xs leading-relaxed">
        <code>{code}</code>
      </pre>
    </div>
  );
}

export default function SdkLibraryPage() {
  const { slug = "" } = useParams<{ slug: string }>();
  const lib = useMemo(() => LIBRARIES[slug.toLowerCase()], [slug]);
  const [activeSection, setActiveSection] = useState<string>("init");

  if (!lib) return <Navigate to="/developer/guides/sdks" replace />;

  const section = SECTIONS.find((s) => s.id === activeSection)!;
  const code = lib[section.field] as string;
  const Logo = lib.Logo;

  return (
    <div className="space-y-10">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link to="/developer/guides/sdks" className="inline-flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> All client libraries
        </Link>
      </div>

      {/* Hero */}
      <section className="space-y-5">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-xl border bg-card flex items-center justify-center shrink-0">
            <Logo size={28} />
          </div>
          <div className="space-y-2 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="font-mono text-[11px]">v{lib.version === "—" ? "live" : lib.version}</Badge>
              <Badge variant="outline" className="text-[11px] capitalize">{lib.status}</Badge>
              <Badge variant="outline" className="text-[11px]">{lib.runtime}</Badge>
              <Badge variant="outline" className="text-[11px]">Released {lib.released}</Badge>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">{lib.title}</h1>
            <p className="text-muted-foreground max-w-3xl">{lib.tagline}</p>
          </div>
        </div>

        {/* Install bar */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Install</span>
              <Badge variant="outline" className="text-[10px] uppercase">{lib.installLabel}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => copy(lib.install)}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Copy
            </Button>
          </div>
          <pre className="p-4 text-xs font-mono overflow-x-auto"><code>{lib.install}</code></pre>
          {lib.altInstalls && lib.altInstalls.length > 0 && (
            <div className="border-t divide-y">
              {lib.altInstalls.map((alt) => (
                <div key={alt.label} className="flex items-center justify-between gap-3 px-4 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Badge variant="outline" className="text-[10px] uppercase shrink-0">{alt.label}</Badge>
                    <code className="font-mono text-xs truncate text-muted-foreground">{alt.cmd}</code>
                  </div>
                  <button onClick={() => copy(alt.cmd)} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={`Copy ${alt.label} command`}>
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {lib.notes && lib.notes.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {lib.notes.map((n, i) => <div key={i}>{n}</div>)}
            </AlertDescription>
          </Alert>
        )}
      </section>

      {/* Overview + features */}
      <section className="grid lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg">About this library</CardTitle>
            <CardDescription>What it covers, who it is for, and how it relates to the rest of the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{lib.description}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Features</CardTitle>
            <CardDescription>What ships out of the box.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {lib.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <Separator />

      {/* Examples — sidebar + code panel */}
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Examples</h2>
          <p className="text-sm text-muted-foreground">
            Every example runs against the public sandbox using the published test credentials.
          </p>
        </div>
        <div className="grid lg:grid-cols-[260px,1fr] gap-4">
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="px-4 py-2.5 border-b bg-muted/40 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Topics
            </div>
            <div className="flex lg:flex-col overflow-x-auto">
              {SECTIONS.map((s) => {
                const Icon = s.icon;
                const active = s.id === activeSection;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setActiveSection(s.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors border-b last:border-b-0 lg:border-b ${
                      active ? "bg-muted text-foreground font-medium" : "text-muted-foreground hover:bg-muted/40"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="whitespace-nowrap">{s.title}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{section.description}</p>
            <CodeBlock
              code={code}
              language={lib.language}
              filename={`example.${lib.filenameExt}`}
            />
          </div>
        </div>
      </section>

      {/* Source files */}
      {lib.sourceFiles && lib.sourceFiles.length > 0 && (
        <section className="space-y-3">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Source files</h2>
            <p className="text-sm text-muted-foreground">The library lives in this repository. Each file is documented and reviewable.</p>
          </div>
          <div className="rounded-lg border bg-card overflow-hidden">
            <div className="divide-y">
              {lib.sourceFiles.map((f) => (
                <div key={f.path} className="flex items-start gap-3 px-4 py-3">
                  <FileCode2 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <code className="font-mono text-xs">{f.path}</code>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Downloads */}
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Downloads</h2>
          <p className="text-sm text-muted-foreground">Grab the spec, the readme, and packaging metadata directly.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lib.downloads.map((d) => (
            <a
              key={d.href}
              href={d.href}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border bg-card p-4 hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2 mb-1">
                <Download className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-semibold">{d.label}</span>
                <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{d.description}</p>
            </a>
          ))}
        </div>
      </section>

      {/* Change history */}
      <section className="space-y-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Change history</h2>
          <p className="text-sm text-muted-foreground">Every release of this library, aligned with the API changelog.</p>
        </div>
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="divide-y">
            {lib.history.map((h) => (
              <div key={h.version + h.date} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">v{h.version}</span>
                  <Badge variant="outline" className="text-[10px]">{h.date}</Badge>
                </div>
                <ul className="text-xs text-muted-foreground space-y-0.5 ml-6 list-disc">
                  {h.notes.map((n) => <li key={n}>{n}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          See the full API changelog at{" "}
          <Link to="/developer/changelog" className="underline">/developer/changelog</Link>.
        </div>
      </section>

      {/* Cross-link to other libs */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold tracking-tight">Other client libraries</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Object.values(LIBRARIES)
            .filter((l) => l.slug !== lib.slug)
            .map((l) => {
              const L = l.Logo;
              return (
                <Link
                  key={l.slug}
                  to={`/developer/guides/sdks/${l.slug}`}
                  className="rounded-lg border bg-card px-3 py-3 hover:bg-muted/40 transition-colors flex items-center gap-2"
                >
                  <L size={18} />
                  <span className="text-sm font-medium truncate">{l.title.replace(" SDK", "").replace(" / Raw HTTP", "")}</span>
                </Link>
              );
            })}
        </div>
      </section>
    </div>
  );
}
