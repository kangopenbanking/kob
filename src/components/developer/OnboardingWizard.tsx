import { useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Key, Code, Webhook, ShieldCheck, CheckCircle, ArrowRight, ArrowLeft,
  Copy, Terminal, Globe, Zap, Play
} from "lucide-react";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { toast } from "sonner";

const TOTAL_STEPS = 5;

interface StepProps {
  onNext: () => void;
  onPrev: () => void;
}

function StepCredentials({ onNext }: StepProps) {
  const creds = [
    ["Secret Key", "sk_test_sandbox_KangOB2026Demo"],
    ["Publishable Key", "pk_test_sandbox_KangOB2026Demo"],
    ["Merchant ID", "merch_test_001"],
    ["Base URL", "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1"],
  ];

  const copyAll = () => {
    const text = creds.map(([k, v]) => `${k}: ${v}`).join("\n");
    navigator.clipboard.writeText(text);
    toast.success("All credentials copied");
  };

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Use these shared sandbox credentials to start immediately. No signup, no approval, no cost.
      </p>
      <div className="space-y-2">
        {creds.map(([label, value]) => (
          <div key={label} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-foreground block">{label}</span>
              <code className="text-xs font-mono text-muted-foreground break-all">{value}</code>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 shrink-0"
              onClick={() => {
                navigator.clipboard.writeText(value);
                toast.success(`${label} copied`);
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="outline" size="sm" onClick={copyAll}>
        <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy All
      </Button>
      <div className="pt-2 flex justify-end">
        <Button onClick={onNext}>
          Install SDK <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepInstallSDK({ onNext, onPrev }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Install the official SDK for your language, or skip and use cURL / any HTTP client.
      </p>
      <CodeBlock
        examples={[
          { language: "bash", label: "Node.js", code: "npm install @kangopenbanking/sdk" },
          { language: "bash", label: "Python", code: "pip install kangopenbanking" },
          { language: "bash", label: "PHP", code: "composer require kangopenbanking/sdk-php" },
          { language: "bash", label: "Go", code: "go get github.com/kangopenbanking/kob-go" },
          { language: "bash", label: "Java", code: '<dependency>\n  <groupId>com.kangopenbanking</groupId>\n  <artifactId>sdk</artifactId>\n  <version>1.0.0</version>\n</dependency>' },
        ]}
      />
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext}>
          First API Call <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepFirstCall({ onNext, onPrev }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Create a 5,000 XAF mobile money charge. The test phone <code className="bg-muted px-1 rounded text-xs">+237650000000</code> always succeeds in sandbox.
      </p>
      <CodeBlock
        examples={[
          {
            language: "bash", label: "cURL",
            code: `curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router \\
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
  }'`
          },
          {
            language: "javascript", label: "Node.js",
            code: `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

const charge = await kob.charges.create({
  merchant_id: 'merch_test_001',
  amount: 5000,
  currency: 'XAF',
  channel: 'mobile_money',
  customer_phone: '+237650000000',
  tx_ref: 'my_first_charge',
});

console.log(charge.data.id);     // "ch_abc123..."
console.log(charge.data.status); // "successful"`
          },
          {
            language: "python", label: "Python",
            code: `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    api_key="sk_test_sandbox_KangOB2026Demo",
    environment="sandbox",
)

charge = kob.charges.create(
    merchant_id="merch_test_001",
    amount=5000,
    currency="XAF",
    channel="mobile_money",
    customer_phone="+237650000000",
    tx_ref="my_first_charge",
)

print(charge.data.id)     # "ch_abc123..."
print(charge.data.status) # "successful"`
          },
          {
            language: "php", label: "PHP",
            code: `$kob = new KangOpenBanking\\KangOpenBanking([
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

echo $charge->data->id;`
          },
          {
            language: "go", label: "Go",
            code: `client := kob.NewClient("sk_test_sandbox_KangOB2026Demo", kob.Sandbox)

charge, err := client.Charges.Create(&kob.ChargeParams{
    MerchantID:    "merch_test_001",
    Amount:        5000,
    Currency:      "XAF",
    Channel:       "mobile_money",
    CustomerPhone: "+237650000000",
    TxRef:         "my_first_charge",
})
fmt.Println(charge.Data.ID)`
          },
          {
            language: "java", label: "Java",
            code: `KangOpenBanking kob = KangOpenBanking.builder()
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

System.out.println(charge.getData().getId());`
          },
        ]}
      />
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext}>
          Webhooks <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepWebhooks({ onNext, onPrev }: StepProps) {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Receive real-time notifications when charges succeed, fail, or are refunded. Verify every webhook using HMAC-SHA256.
      </p>
      <CodeBlock
        examples={[
          {
            language: "javascript", label: "Node.js",
            code: `import crypto from 'crypto';

function verifyWebhook(payload, signature, secret) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// Express handler
app.post('/webhooks/kob', (req, res) => {
  const sig = req.headers['x-kob-signature'];
  if (!verifyWebhook(req.rawBody, sig, process.env.WEBHOOK_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  switch (event.type) {
    case 'charge.successful':
      // Fulfill the order
      break;
    case 'charge.failed':
      // Notify customer
      break;
  }
  res.status(200).json({ received: true });
});`
          },
          {
            language: "python", label: "Python",
            code: `import hmac, hashlib

def verify_webhook(payload: bytes, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode(), payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

# Flask handler
@app.route('/webhooks/kob', methods=['POST'])
def handle_webhook():
    sig = request.headers.get('x-kob-signature')
    if not verify_webhook(request.data, sig, WEBHOOK_SECRET):
        return 'Invalid signature', 401

    event = request.json
    if event['type'] == 'charge.successful':
        pass  # Fulfill order
    return {'received': True}, 200`
          },
        ]}
      />
      <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Retry policy</p>
        <p>Failed deliveries are retried 7 times over 24 hours with exponential backoff (1s, 30s, 5m, 30m, 2h, 8h, 24h).</p>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
        <Button onClick={onNext}>
          Go Live <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepGoLive({ onPrev }: StepProps) {
  const checklist = [
    { label: "Replace sandbox keys with production keys", link: "/developer/auth/api-keys" },
    { label: "Point to direct Supabase Edge Functions backend", link: null },
    { label: "Verify webhook signatures in production", link: "/developer/webhooks" },
    { label: "Complete KYB verification", link: "/developer/onboarding" },
    { label: "Enable idempotency keys on all POST requests", link: "/developer/reference/idempotency" },
    { label: "Implement error handling and retries", link: "/developer/reference/error-codes" },
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        When your sandbox integration is working, follow this checklist to switch to production.
      </p>
      <div className="space-y-2">
        {checklist.map((item) => (
          <div key={item.label} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/20">
            <CheckCircle className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              {item.link ? (
                <Link to={item.link} className="text-sm text-foreground hover:text-primary transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-sm text-foreground">{item.label}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="grid sm:grid-cols-2 gap-3 pt-2">
        <Link to="/developer/go-live">
          <Button variant="outline" className="w-full">
            <Globe className="h-4 w-4 mr-1.5" /> Full Go-Live Checklist
          </Button>
        </Link>
        <Link to="/developer/api-explorer">
          <Button className="w-full">
            <Play className="h-4 w-4 mr-1.5" /> Try the API Explorer
          </Button>
        </Link>
      </div>
      <div className="flex justify-start pt-2">
        <Button variant="outline" onClick={onPrev}>
          <ArrowLeft className="h-4 w-4 mr-1.5" /> Back
        </Button>
      </div>
    </div>
  );
}

const steps = [
  { title: "Get Credentials", icon: Key, description: "Instant sandbox access" },
  { title: "Install SDK", icon: Code, description: "Choose your language" },
  { title: "First API Call", icon: Terminal, description: "Create a charge" },
  { title: "Webhooks", icon: Webhook, description: "Real-time events" },
  { title: "Go Live", icon: Zap, description: "Production checklist" },
];

export function OnboardingWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const onNext = useCallback(() => setCurrentStep(s => Math.min(s + 1, TOTAL_STEPS - 1)), []);
  const onPrev = useCallback(() => setCurrentStep(s => Math.max(s - 1, 0)), []);

  const StepComponent = [StepCredentials, StepInstallSDK, StepFirstCall, StepWebhooks, StepGoLive][currentStep];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-xl">Integration Guide</CardTitle>
            <CardDescription>From zero to first payment in 5 steps</CardDescription>
          </div>
          <Badge variant="outline">Step {currentStep + 1} of {TOTAL_STEPS}</Badge>
        </div>
        <Progress value={((currentStep + 1) / TOTAL_STEPS) * 100} className="mt-3 h-1.5" />
        {/* Step indicators */}
        <div className="flex gap-1 mt-3 overflow-x-auto">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = i < currentStep;
            return (
              <button
                key={step.title}
                onClick={() => setCurrentStep(i)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap
                  ${isActive ? "bg-primary text-primary-foreground" : isDone ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                {isDone ? <CheckCircle className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{step.title}</span>
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="min-h-[300px]">
          <h3 className="text-lg font-semibold mb-1 text-foreground">{steps[currentStep].title}</h3>
          <p className="text-xs text-muted-foreground mb-4">{steps[currentStep].description}</p>
          <StepComponent onNext={onNext} onPrev={onPrev} />
        </div>
      </CardContent>
    </Card>
  );
}
