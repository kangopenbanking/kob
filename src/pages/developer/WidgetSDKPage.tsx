import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { CreditCard, Link2, Shield, Code } from "lucide-react";

const widgets = [
  {
    id: "payment",
    title: "Payment Widget",
    description: "Drop-in checkout experience for accepting payments via Mobile Money, cards, and bank transfers.",
    icon: CreditCard,
    embedUrl: "/widgets/payment?amount=5000&currency=XAF&merchant=YourStore",
    jsCode: `<script src="https://cdn.kangopenbanking.com/widgets/v1/kob-widgets.js"></script>
<script>
  KOB.createPaymentWidget({
    container: '#payment-widget',
    merchantId: 'your_merchant_id',
    amount: 5000,
    currency: 'XAF',
    onComplete: (result) => console.log('Payment:', result),
  });
</script>
<div id="payment-widget"></div>`,
    iframeCode: `<iframe
  src="https://kangopenbanking.com/widgets/payment?amount=5000&currency=XAF"
  width="400"
  height="500"
  frameborder="0"
  allow="payment"
></iframe>`,
  },
  {
    id: "bank-connect",
    title: "Bank Connect Widget",
    description: "Account linking flow that guides users through AISP consent authorization.",
    icon: Link2,
    embedUrl: "/widgets/bank-connect",
    jsCode: `<script src="https://cdn.kangopenbanking.com/widgets/v1/kob-widgets.js"></script>
<script>
  KOB.createBankConnectWidget({
    container: '#bank-connect-widget',
    clientId: 'your_client_id',
    scope: 'accounts balances transactions',
    onConnected: (result) => console.log('Connected:', result),
  });
</script>
<div id="bank-connect-widget"></div>`,
    iframeCode: `<iframe
  src="https://kangopenbanking.com/widgets/bank-connect"
  width="400"
  height="600"
  frameborder="0"
></iframe>`,
  },
  {
    id: "verification",
    title: "Verification Widget",
    description: "KYC/KYB document upload and verification flow with real-time status tracking.",
    icon: Shield,
    embedUrl: "/widgets/verify",
    jsCode: `<script src="https://cdn.kangopenbanking.com/widgets/v1/kob-widgets.js"></script>
<script>
  KOB.createVerificationWidget({
    container: '#verify-widget',
    merchantId: 'your_merchant_id',
    verificationType: 'kyc',
    onComplete: (result) => console.log('Verified:', result),
  });
</script>
<div id="verify-widget"></div>`,
    iframeCode: `<iframe
  src="https://kangopenbanking.com/widgets/verify"
  width="400"
  height="600"
  frameborder="0"
></iframe>`,
  },
];

export default function WidgetSDKPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Embeddable Widgets</h1>
        <p className="mt-2 text-muted-foreground">
          Pre-built UI components you can embed in your application via iframe or JavaScript SDK.
          Each widget handles the full user flow with secure token exchange.
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-5 w-5 text-primary" />
            Integration Methods
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-lg border border-border/30 p-4">
              <h4 className="font-semibold text-sm">JavaScript SDK</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Full control with event callbacks, theming, and programmatic control.
                Recommended for single-page applications.
              </p>
              <Badge variant="outline" className="mt-2 text-xs">Recommended</Badge>
            </div>
            <div className="rounded-lg border border-border/30 p-4">
              <h4 className="font-semibold text-sm">iframe Embed</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Simple drop-in with postMessage communication.
                Works with any framework or static HTML.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {widgets.map((w) => (
        <Card key={w.id} className="border border-border/50">
          <CardHeader>
            <div className="flex items-center gap-3">
              <w.icon className="h-6 w-6 text-primary" />
              <div>
                <CardTitle>{w.title}</CardTitle>
                <CardDescription>{w.description}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="text-sm font-semibold mb-2">JavaScript SDK</h4>
              <pre className="rounded-lg bg-muted/30 p-4 text-xs overflow-x-auto border border-border/20">
                <code>{w.jsCode}</code>
              </pre>
            </div>
            <Separator />
            <div>
              <h4 className="text-sm font-semibold mb-2">iframe Embed</h4>
              <pre className="rounded-lg bg-muted/30 p-4 text-xs overflow-x-auto border border-border/20">
                <code>{w.iframeCode}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle>postMessage Events</CardTitle>
          <CardDescription>Events emitted by widgets for parent window communication</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Event Type</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Widget</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Payload</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { event: "kob-payment-complete", widget: "Payment", payload: "{ status, amount, currency }" },
                  { event: "kob-bank-connected", widget: "Bank Connect", payload: "{ bank_id, status }" },
                  { event: "kob-verification-complete", widget: "Verification", payload: "{ status }" },
                  { event: "kob-widget-config", widget: "All (inbound)", payload: "{ amount, email, theme }" },
                ].map((e) => (
                  <tr key={e.event} className="border-b border-border/20">
                    <td className="px-3 py-2 font-mono text-xs">{e.event}</td>
                    <td className="px-3 py-2">{e.widget}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{e.payload}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
