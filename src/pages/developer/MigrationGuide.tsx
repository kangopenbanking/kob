import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { ScrollReveal } from "@/components/ScrollReveal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, Copy } from "lucide-react";
import { Link } from "react-router-dom";

const migrations = {
  stripe: {
    label: "Migrate from Stripe",
    steps: [
      "Create a KOB account and get your sandbox API keys",
      "Install the KOB SDK (npm, pip, or composer)",
      "Replace Stripe client initialization with KOB client",
      "Map Stripe PaymentIntent to KOB charges.create",
      "Update webhook verification to use KOB HMAC-SHA256",
      "Map Stripe Transfer to KOB payouts.create",
      "Test in sandbox, then switch to production keys",
    ],
    differences: [
      { title: "Currency Default", desc: "Stripe defaults to USD cents. KOB defaults to XAF (no cents — integer amounts)." },
      { title: "Mobile Money", desc: "Stripe has no mobile money. KOB supports MTN MoMo, Orange Money as first-class methods." },
      { title: "Open Banking", desc: "Stripe has no AISP/PISP. KOB provides full Open Banking consent flows." },
    ],
    examples: [
      {
        title: "Create a Charge",
        before: {
          nodejs: `const stripe = require('stripe')('sk_test_...');

const paymentIntent = await stripe.paymentIntents.create({
  amount: 500000, // $5,000.00 in cents
  currency: 'usd',
  payment_method: 'pm_card_visa',
  confirm: true,
});`,
          python: `import stripe
stripe.api_key = "sk_test_..."

intent = stripe.PaymentIntent.create(
    amount=500000,  # cents
    currency="usd",
    payment_method="pm_card_visa",
    confirm=True,
)`,
          php: `$stripe = new \\Stripe\\StripeClient('sk_test_...');

$intent = $stripe->paymentIntents->create([
    'amount' => 500000,
    'currency' => 'usd',
    'payment_method' => 'pm_card_visa',
    'confirm' => true,
]);`,
        },
        after: {
          nodejs: `import KOB from '@kangopenbanking/sdk';

const kob = new KOB({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  amount: 5000,       // XAF integer
  currency: 'XAF',
  payment_method: 'mobile_money',
  provider: 'mtn_momo',
  customer_phone: '+237670000000',
});`,
          python: `from kangopenbanking import KOBClient

kob = KOBClient(
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
    environment="sandbox",
)

charge = kob.charges.create(
    amount=5000,
    currency="XAF",
    payment_method="mobile_money",
    provider="mtn_momo",
    customer_phone="+237670000000",
)`,
          php: `use KangOpenBanking\\KOBClient;

$kob = new KOBClient([
    'client_id' => 'YOUR_CLIENT_ID',
    'client_secret' => 'YOUR_CLIENT_SECRET',
    'environment' => 'sandbox',
]);

$charge = $kob->charges()->create([
    'amount' => 5000,
    'currency' => 'XAF',
    'payment_method' => 'mobile_money',
    'provider' => 'mtn_momo',
    'customer_phone' => '+237670000000',
]);`,
        },
      },
      {
        title: "Process a Payout",
        before: {
          nodejs: `const transfer = await stripe.transfers.create({
  amount: 100000,
  currency: 'usd',
  destination: 'acct_...',
});`,
          python: `transfer = stripe.Transfer.create(
    amount=100000,
    currency="usd",
    destination="acct_...",
)`,
          php: `$transfer = $stripe->transfers->create([
    'amount' => 100000,
    'currency' => 'usd',
    'destination' => 'acct_...',
]);`,
        },
        after: {
          nodejs: `const payout = await kob.payouts.create({
  amount: 10000,
  currency: 'XAF',
  method: 'mobile_money',
  provider: 'mtn_momo',
  recipient_phone: '+237670000000',
});`,
          python: `payout = kob.payouts.create(
    amount=10000,
    currency="XAF",
    method="mobile_money",
    provider="mtn_momo",
    recipient_phone="+237670000000",
)`,
          php: `$payout = $kob->payouts()->create([
    'amount' => 10000,
    'currency' => 'XAF',
    'method' => 'mobile_money',
    'provider' => 'mtn_momo',
    'recipient_phone' => '+237670000000',
]);`,
        },
      },
      {
        title: "Verify a Webhook",
        before: {
          nodejs: `const event = stripe.webhooks.constructEvent(
  body, sig, 'whsec_...'
);`,
          python: `event = stripe.Webhook.construct_event(
    payload, sig_header, "whsec_..."
)`,
          php: `$event = \\Stripe\\Webhook::constructEvent(
    $payload, $sigHeader, 'whsec_...'
);`,
        },
        after: {
          nodejs: `const isValid = kob.webhooks.verify(
  body, signature, 'YOUR_WEBHOOK_SECRET'
);`,
          python: `is_valid = kob.webhooks.verify(
    payload, signature, "YOUR_WEBHOOK_SECRET"
)`,
          php: `// Laravel: use middleware automatically
// Route::post('/webhook', ...)->middleware('verify-kob-webhook');

// Or manually:
$valid = $kob->webhooks()->verify(
    $payload, $signature, 'YOUR_WEBHOOK_SECRET'
);`,
        },
      },
    ],
  },
  flutterwave: {
    label: "Migrate from Flutterwave",
    steps: [
      "Create a KOB account at kangopenbanking.com",
      "Install the KOB SDK for your language",
      "Replace Flutterwave secret key init with KOB client credentials",
      "Map Flutterwave charge endpoints to KOB charges.create",
      "Update webhook hash verification to KOB HMAC-SHA256",
      "Map Flutterwave transfers to KOB payouts.create",
      "Test in sandbox, then switch to production",
    ],
    differences: [
      { title: "Auth Model", desc: "Flutterwave uses a single secret key. KOB uses OAuth2 client_credentials with auto-refreshing tokens." },
      { title: "Open Banking", desc: "Flutterwave has no AISP/PISP/CBPII. KOB provides full consent-based account access and payment initiation." },
      { title: "Bank Connectors", desc: "Flutterwave requires banks to have APIs. KOB connects banks without APIs via file, DB, or message queue connectors." },
    ],
    examples: [
      {
        title: "Create a Charge",
        before: {
          nodejs: `const Flutterwave = require('flutterwave-node-v3');
const flw = new Flutterwave('FLWPUBK-...', 'FLWSECK-...');

const response = await flw.MobileMoney.franco_phone({
  amount: 5000,
  currency: 'XAF',
  phone_number: '237670000000',
  tx_ref: 'txn_' + Date.now(),
});`,
          python: `from rave_python import Rave
rave = Rave("FLWPUBK-...", "FLWSECK-...")

payload = {
    "amount": 5000,
    "currency": "XAF",
    "phonenumber": "237670000000",
    "tx_ref": f"txn_{int(time.time())}",
}
res = rave.Francophone.charge(payload)`,
          php: `$flw = new \\Flutterwave\\Rave('FLWSECK-...');

$response = $flw->mobileMoney->charge([
    'amount' => 5000,
    'currency' => 'XAF',
    'phone_number' => '237670000000',
    'tx_ref' => 'txn_' . time(),
]);`,
        },
        after: {
          nodejs: `import KOB from '@kangopenbanking/sdk';

const kob = new KOB({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  amount: 5000,
  currency: 'XAF',
  payment_method: 'mobile_money',
  provider: 'mtn_momo',
  customer_phone: '+237670000000',
});`,
          python: `from kangopenbanking import KOBClient

kob = KOBClient(
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
    environment="sandbox",
)

charge = kob.charges.create(
    amount=5000,
    currency="XAF",
    payment_method="mobile_money",
    provider="mtn_momo",
    customer_phone="+237670000000",
)`,
          php: `use KangOpenBanking\\KOBClient;

$kob = new KOBClient([
    'client_id' => 'YOUR_CLIENT_ID',
    'client_secret' => 'YOUR_CLIENT_SECRET',
    'environment' => 'sandbox',
]);

$charge = $kob->charges()->create([
    'amount' => 5000,
    'currency' => 'XAF',
    'payment_method' => 'mobile_money',
    'provider' => 'mtn_momo',
    'customer_phone' => '+237670000000',
]);`,
        },
      },
    ],
  },
};

type Provider = keyof typeof migrations;
type Lang = "nodejs" | "python" | "php";

function CodePanel({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  return (
    <div className="relative rounded-lg bg-[#0d1117] border border-white/10 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/10 bg-white/5">
        <span className="text-xs text-gray-400 font-mono">{lang}</span>
        <button onClick={copy} className="text-gray-400 hover:text-white transition-colors p-1">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto text-sm leading-relaxed"><code className="text-gray-100 font-mono">{code}</code></pre>
    </div>
  );
}

export default function MigrationGuide() {
  const [provider, setProvider] = useState<Provider>("stripe");
  const [lang, setLang] = useState<Lang>("nodejs");
  const m = migrations[provider];

  return (
    <>
      <Helmet>
        <title>Migrate from Stripe & Flutterwave to KOB | Kang Open Banking</title>
        <meta name="description" content="Step-by-step migration guides with side-by-side code examples to switch from Stripe or Flutterwave to Kang Open Banking API." />
      </Helmet>

      <div className="space-y-10 pb-12">
        <ScrollReveal>
          <div className="space-y-3">
            <Link to="/developer" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5" /> Developer Portal
            </Link>
            <h1 className="text-4xl font-bold tracking-tight leading-[1.1]">Migration Guides</h1>
            <p className="text-lg text-muted-foreground max-w-2xl">
              Switch to KOB from Stripe or Flutterwave with side-by-side code examples in Node.js, Python, and PHP.
            </p>
          </div>
        </ScrollReveal>

        {/* Provider Tabs */}
        <ScrollReveal delay={0.08}>
          <Tabs value={provider} onValueChange={(v) => setProvider(v as Provider)}>
            <TabsList className="h-10">
              <TabsTrigger value="stripe">From Stripe</TabsTrigger>
              <TabsTrigger value="flutterwave">From Flutterwave</TabsTrigger>
            </TabsList>

            {(["stripe", "flutterwave"] as Provider[]).map((prov) => (
              <TabsContent key={prov} value={prov} className="space-y-10 mt-6">
                {/* Migration Checklist */}
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Migration Checklist</h2>
                  <ol className="space-y-2">
                    {migrations[prov].steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-sm text-muted-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Key Differences */}
                <div className="space-y-3">
                  <h2 className="text-xl font-semibold">Key Differences</h2>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {migrations[prov].differences.map((d) => (
                      <Card key={d.title}>
                        <CardContent className="p-4 space-y-1.5">
                          <h3 className="font-medium text-sm">{d.title}</h3>
                          <p className="text-xs text-muted-foreground leading-relaxed">{d.desc}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                {/* Code Examples */}
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold">Code Examples</h2>
                    <div className="flex gap-1">
                      {(["nodejs", "python", "php"] as Lang[]).map((l) => (
                        <Button
                          key={l}
                          size="sm"
                          variant={lang === l ? "default" : "ghost"}
                          className="text-xs h-7"
                          onClick={() => setLang(l)}
                        >
                          {l === "nodejs" ? "Node.js" : l === "python" ? "Python" : "PHP"}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {migrations[prov].examples.map((ex) => (
                    <div key={ex.title} className="space-y-3">
                      <h3 className="font-medium">{ex.title}</h3>
                      <div className="grid md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            Before ({prov === "stripe" ? "Stripe" : "Flutterwave"})
                          </p>
                          <CodePanel code={ex.before[lang]} lang={lang === "nodejs" ? "javascript" : lang} />
                        </div>
                        <div className="space-y-1.5">
                          <p className="text-xs font-medium text-primary uppercase tracking-wider flex items-center gap-1">
                            After (KOB) <ArrowRight className="h-3 w-3" />
                          </p>
                          <CodePanel code={ex.after[lang]} lang={lang === "nodejs" ? "javascript" : lang} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </ScrollReveal>

        <ScrollReveal delay={0.15}>
          <div className="flex flex-wrap gap-3">
            <Button asChild><Link to="/developer/compare">Feature Comparison →</Link></Button>
            <Button variant="outline" asChild><Link to="/developer/getting-started">Get Started Free</Link></Button>
          </div>
        </ScrollReveal>
      </div>
    </>
  );
}
