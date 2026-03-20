import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const sdk = url.searchParams.get("sdk") || "node";
  const format = url.searchParams.get("format") || "info";

  // SDK metadata
  const sdks: Record<string, any> = {
    node: {
      name: "@kangopenbanking/sdk",
      version: "1.0.0",
      language: "TypeScript / Node.js",
      install: "npm install @kangopenbanking/sdk",
      repository: "https://github.com/kangopenbanking/KangOpenBanking-KOB",
      docs: "https://kangopenbanking.com/developer/guides/sdks",
      features: [
        "Promise-based API with async/await",
        "Full TypeScript type definitions",
        "Automatic OAuth2 token refresh",
        "Webhook HMAC-SHA256 verification",
        "Sandbox and production environments",
        "AISP (accounts, balances, transactions, beneficiaries)",
        "Gateway (charges, refunds, payouts, fee estimates)",
        "PKCE authorization code flow support",
      ],
      quickstart: `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  apiKey: 'sbx_your_sandbox_key',
  environment: 'sandbox',
});

// List accounts
const accounts = await kob.accounts.list();

// Create a charge
const charge = await kob.charges.create({
  merchant_id: 'mch_uuid',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '237677123456',
  tx_ref: 'order_001',
});`,
    },
    python: {
      name: "kangopenbanking",
      version: "1.0.0",
      language: "Python",
      install: "pip install kangopenbanking",
      repository: "https://github.com/kangopenbanking/KangOpenBanking-KOB",
      docs: "https://kangopenbanking.com/developer/guides/sdks",
      features: [
        "Sync and async HTTP client (httpx)",
        "Typed dataclass responses",
        "Automatic OAuth2 token management",
        "Webhook HMAC-SHA256 verification",
        "Context manager support",
        "AISP and Gateway resource classes",
        "Python 3.8+ compatible",
      ],
      quickstart: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    api_key="sbx_your_sandbox_key",
    environment="sandbox",
)

# List accounts
accounts = kob.accounts.list()

# Create a charge
charge = kob.charges.create(
    merchant_id="mch_uuid",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="237677123456",
    tx_ref="order_001",
)`,
    },
    php: {
      name: "kangopenbanking/sdk",
      version: "1.0.0",
      language: "PHP",
      install: "composer require kangopenbanking/sdk",
      repository: "https://github.com/kangopenbanking/KangOpenBanking-KOB",
      docs: "https://kangopenbanking.com/developer/guides/sdks",
      status: "coming_soon",
      features: [
        "PSR-7 / PSR-18 compatible",
        "Laravel service provider included",
        "Guzzle HTTP client",
        "Webhook verification middleware",
      ],
    },
  };

  if (format === "list") {
    return new Response(JSON.stringify({
      sdks: Object.entries(sdks).map(([key, s]) => ({
        key,
        name: s.name,
        version: s.version,
        language: s.language,
        install: s.install,
        status: s.status || "available",
      })),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  const sdkInfo = sdks[sdk];
  if (!sdkInfo) {
    return new Response(JSON.stringify({
      error: "sdk_not_found",
      message: `SDK '${sdk}' not found. Available: ${Object.keys(sdks).join(", ")}`,
    }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify(sdkInfo), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
