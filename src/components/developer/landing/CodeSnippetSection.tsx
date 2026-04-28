import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";

const snippets = {
  curl: {
    label: "cURL",
    code: `# 1. Get an access token
curl -X POST "https://api.kangopenbanking.com/v1/oauth-token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET"

# 2. Create a charge
curl -X POST "https://api.kangopenbanking.com/v1/gateway-charges" \\
  -H "Authorization: Bearer ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "amount": 5000,
    "currency": "XAF",
    "payment_method": "mobile_money",
    "provider": "mtn_momo",
    "customer_phone": "+237670000000"
  }'`,
  },
  javascript: {
    label: "Node.js",
    code: `import KOB from '@kangopenbanking/sdk';

const kob = new KOB({
  clientId: 'YOUR_CLIENT_ID',
  clientSecret: 'YOUR_CLIENT_SECRET',
  environment: 'sandbox'
});

// Create a mobile money charge
const charge = await kob.charges.create({
  amount: 5000,
  currency: 'XAF',
  payment_method: 'mobile_money',
  provider: 'mtn_momo',
  customer_phone: '+237670000000',
  callback_url: 'https://yourapp.com/webhook'
});

console.log(charge.data.status); // "pending"`,
  },
  python: {
    label: "Python",
    code: `from kangopenbanking import KOBClient

kob = KOBClient(
    client_id="YOUR_CLIENT_ID",
    client_secret="YOUR_CLIENT_SECRET",
    environment="sandbox"
)

# Create a mobile money charge
charge = kob.charges.create(
    amount=5000,
    currency="XAF",
    payment_method="mobile_money",
    provider="mtn_momo",
    customer_phone="+237670000000",
    callback_url="https://yourapp.com/webhook"
)

print(charge.status)  # "pending"`,
  },
};

type Lang = keyof typeof snippets;

export function CodeSnippetSection() {
  const [activeLang, setActiveLang] = useState<Lang>("curl");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(snippets[activeLang].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Start in Minutes</h2>
        <p className="text-muted-foreground max-w-2xl">
          Authenticate and create your first charge in just two API calls.
        </p>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2 bg-muted/50">
          <div className="flex gap-1">
            {(Object.keys(snippets) as Lang[]).map((lang) => (
              <Button
                key={lang}
                variant={activeLang === lang ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveLang(lang)}
                className="text-xs h-7"
              >
                {snippets[lang].label}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7 text-xs">
            {copied ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
            {copied ? "Copied" : "Copy"}
          </Button>
        </div>
        <pre className="p-4 md:p-6 overflow-x-auto text-sm leading-relaxed">
          <code>{snippets[activeLang].code}</code>
        </pre>
      </div>
    </div>
  );
}
