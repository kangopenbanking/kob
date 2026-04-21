import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { Shield, ArrowRight, Code2, Webhook, TestTube, CheckCircle } from "lucide-react";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

export default function PayByBankGuide() {
  const tr = useHarvestedT('general');
  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{tr('Pay by Bank')}</h1>
            <p className="text-sm text-muted-foreground">{tr('Redirect-based SCA for direct bank payments')}</p>
          </div>
        </div>
        <Badge variant="secondary" className="mt-2">{tr('v10.1.0')}</Badge>
      </motion.div>

      {/* Overview */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ArrowRight className="h-4 w-4" /> {tr('How It Works')}</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{tr('Pay by Bank enables merchants to accept direct bank payments with Strong Customer Authentication (SCA). The flow uses a redirect-based model similar to 3D Secure.')}</p>
          <div className="bg-muted rounded-lg p-4 font-mono text-xs space-y-1">
            <p>{tr('1. Merchant → POST /pay-by-bank (create_intent) → Gets authorization_url')}</p>
            <p>{tr('2. Merchant redirects customer to authorization_url')}</p>
            <p>{tr('3. Customer authenticates on KOB (web or app)')}</p>
            <p>{tr('4. Customer approves payment (amount, merchant, bank account shown)')}</p>
            <p>{tr('5. KOB processes payment (wallet or bank connector)')}</p>
            <p>{tr('6. Customer redirected back to merchant with status + webhooks fired')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
            {[
              { title: "Web Authorization", desc: "Hosted page at /pay/authorize — works on desktop and mobile browsers" },
              { title: "App Deep Link", desc: "kob://authorize?intent_id=... opens directly in the Kang consumer app" },
              { title: "Webhook Confirmation", desc: "Merchant receives pay_by_bank.completed webhook for server-to-server verification" },
            ].map(item => (
              <Card key={item.title} className="border-border/50">
                <CardContent className="p-4">
                  <p className="font-medium text-sm">{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Code Examples */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Code2 className="h-4 w-4" /> {tr('Integration Examples')}</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="nodejs">
            <TabsList><TabsTrigger value="nodejs">{tr('Node.js')}</TabsTrigger><TabsTrigger value="python">{tr('Python')}</TabsTrigger><TabsTrigger value="php">PHP</TabsTrigger><TabsTrigger value="curl">{tr('cURL')}</TabsTrigger></TabsList>
            <TabsContent value="nodejs">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{`import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  clientId: 'your_client_id',
  clientSecret: 'your_client_secret',
});
await kob.getToken();

// 1. Create payment intent
const intent = await kob.payByBank.createIntent({
  merchant_id: 'your_merchant_id',
  amount: 50000,
  currency: 'XAF',
  redirect_uri: 'https://yoursite.com/payment/callback',
  state: 'order_abc123',
  description: 'Order #ABC123',
});

// 2. Redirect customer
res.redirect(intent.authorization_url);

// 3. On callback, verify server-to-server
const status = await kob.payByBank.getIntent(intent.intent_id);
if (status.status === 'completed') {
  // Payment successful — fulfill order
}`}</pre>
            </TabsContent>
            <TabsContent value="python">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{`from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    client_id="your_client_id",
    client_secret="your_client_secret",
)
kob.get_token()

# Create intent
intent = kob.pay_by_bank.create_intent(
    merchant_id="your_merchant_id",
    amount=50000,
    currency="XAF",
    redirect_uri="https://yoursite.com/payment/callback",
    state="order_abc123",
)

# Redirect: intent["authorization_url"]

# Verify on callback
status = kob.pay_by_bank.get_intent(intent["intent_id"])
assert status["status"] == "completed"`}</pre>
            </TabsContent>
            <TabsContent value="php">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{`$kob = new KangOpenBanking([
    'client_id' => 'your_client_id',
    'client_secret' => 'your_client_secret',
]);
$kob->getToken();

$intent = $kob->payByBank->createIntent([
    'merchant_id' => 'your_merchant_id',
    'amount' => 50000,
    'currency' => 'XAF',
    'redirect_uri' => 'https://yoursite.com/payment/callback',
    'state' => 'order_abc123',
]);

// Redirect: header('Location: ' . $intent['authorization_url']);

// On callback:
$status = $kob->payByBank->getIntent($intent['intent_id']);`}</pre>
            </TabsContent>
            <TabsContent value="curl">
              <pre className="bg-muted p-4 rounded-lg text-xs overflow-x-auto">{`# Create intent
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pay-by-bank \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create_intent",
    "merchant_id": "YOUR_MERCHANT_ID",
    "amount": 50000,
    "currency": "XAF",
    "redirect_uri": "https://yoursite.com/callback",
    "state": "order_123"
  }'

# Get intent status
curl -X POST https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/pay-by-bank \\
  -H "Authorization: Bearer YOUR_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"action": "get_intent", "intent_id": "INTENT_ID"}'`}</pre>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Webhook Events */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Webhook className="h-4 w-4" /> {tr('Webhook Events')}</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              { event: "pay_by_bank.authorized", desc: "Customer approved the payment. PISP consent is now Authorised." },
              { event: "pay_by_bank.submitted", desc: "Payment has been submitted to the bank connector for execution." },
              { event: "pay_by_bank.completed", desc: "Payment executed successfully. Safe to fulfill the order." },
              { event: "pay_by_bank.failed", desc: "Payment failed. Check failure_reason in the event payload." },
            ].map(w => (
              <div key={w.event} className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 shrink-0" />
                <div>
                  <code className="text-xs font-mono font-bold">{w.event}</code>
                  <p className="text-xs text-muted-foreground mt-0.5">{w.desc}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <p className="text-xs font-medium mb-2">{tr('Webhook Payload Example:')}</p>
            <pre className="text-xs overflow-x-auto">{`{
  "event": "pay_by_bank.completed",
  "data": {
    "intent_id": "uuid",
    "payment_id": "pay_uuid",
    "amount": 50000,
    "currency": "XAF",
    "merchant_id": "uuid",
    "status": "completed"
  },
  "timestamp": "2026-03-21T12:00:00Z"
}`}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Status Lifecycle */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><TestTube className="h-4 w-4" /> {tr('Intent Status Lifecycle')}</CardTitle></CardHeader>
        <CardContent>
          <div className="bg-muted rounded-lg p-4 font-mono text-xs">
            <p>{tr('awaiting_auth → authorized → submitted → processing → completed')}</p>
            <p className="text-muted-foreground mt-2">                                                    {tr('↘ failed')}</p>
            <p className="text-muted-foreground">{tr('awaiting_auth → rejected')}</p>
            <p className="text-muted-foreground">{tr('awaiting_auth → expired (after 15 min)')}</p>
          
      <AutoDocNavigation />
</div>
          <p className="text-xs text-muted-foreground mt-3">
            <strong>{tr('Important:')}</strong> {tr('Always verify the final status server-to-server via')} <code>get_intent</code> or webhooks. 
            Never trust the redirect URL status parameter alone.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
