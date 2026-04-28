import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const TestingGuide = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Testing Guide | Kang Open Banking" description="Comprehensive testing guide with test cards, sandbox MoMo numbers, test scenarios, and sandbox environment setup." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Testing Guide</h1>
      <p className="text-muted-foreground mt-2">
        Use the sandbox environment to test your integration before going live. 
        All sandbox transactions use test credentials and never process real payments.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Sandbox Base URL</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{`https://api.kangopenbanking.com/v1/
# Use sandbox API keys (prefix: sk_test_)`}
      </pre>
    </div>

    <h2 className="text-xl font-bold">Test Cards</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Card Number</th>
            <th className="text-left py-2 font-semibold">Brand</th>
            <th className="text-left py-2 font-semibold">Result</th>
            <th className="text-left py-2 font-semibold">CVV</th>
            <th className="text-left py-2 font-semibold">Expiry</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b"><td className="py-2 font-mono">4242 4242 4242 4242</td><td>Visa</td><td className="text-green-600">Success</td><td>123</td><td>12/30</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">5500 0000 0000 0004</td><td>Mastercard</td><td className="text-green-600">Success</td><td>123</td><td>12/30</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">4000 0000 0000 0002</td><td>Visa</td><td className="text-red-600">Declined</td><td>123</td><td>12/30</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">4000 0000 0000 3220</td><td>Visa</td><td className="text-yellow-600">3DS Required</td><td>123</td><td>12/30</td></tr>
          <tr><td className="py-2 font-mono">4000 0000 0000 9995</td><td>Visa</td><td className="text-red-600">Insufficient Funds</td><td>123</td><td>12/30</td></tr>
        </tbody>
      </table>
    </div>

    <h2 className="text-xl font-bold">Test Mobile Money Numbers</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Phone Number</th>
            <th className="text-left py-2 font-semibold">Provider</th>
            <th className="text-left py-2 font-semibold">Result</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b"><td className="py-2 font-mono">+237670000000</td><td>MTN MoMo (CM)</td><td className="text-green-600">Success</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">+237690000000</td><td>Orange Money (CM)</td><td className="text-green-600">Success</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">+237670000001</td><td>MTN MoMo (CM)</td><td className="text-red-600">Insufficient Balance</td></tr>
          <tr className="border-b"><td className="py-2 font-mono">+237670000002</td><td>MTN MoMo (CM)</td><td className="text-yellow-600">Timeout</td></tr>
          <tr><td className="py-2 font-mono">+233240000000</td><td>MTN MoMo (GH)</td><td className="text-green-600">Success</td></tr>
        </tbody>
      </table>
    </div>

    <h2 className="text-xl font-bold">Test Scenarios Matrix</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Scenario</th>
            <th className="text-left py-2 font-semibold">How to Trigger</th>
            <th className="text-left py-2 font-semibold">Expected Webhook</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          <tr className="border-b"><td className="py-2">Successful charge</td><td>Use success test card/number</td><td><code className="bg-muted px-1 rounded text-xs">charge.completed</code></td></tr>
          <tr className="border-b"><td className="py-2">Declined charge</td><td>Use decline test card</td><td><code className="bg-muted px-1 rounded text-xs">charge.failed</code></td></tr>
          <tr className="border-b"><td className="py-2">3DS authentication</td><td>Use 3DS test card</td><td><code className="bg-muted px-1 rounded text-xs">charge.requires_action</code></td></tr>
          <tr className="border-b"><td className="py-2">Refund</td><td>Refund a completed charge</td><td><code className="bg-muted px-1 rounded text-xs">charge.refunded</code></td></tr>
          <tr className="border-b"><td className="py-2">Payout success</td><td>Use sandbox payout simulation</td><td><code className="bg-muted px-1 rounded text-xs">payout.completed</code></td></tr>
          <tr><td className="py-2">Payout reversal</td><td>Use <code className="bg-muted px-1 rounded text-xs">reversed_after_success</code> scenario</td><td><code className="bg-muted px-1 rounded text-xs">payout.reversed</code></td></tr>
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Going Live Checklist</h3>
      <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
        <li>Test all payment channels (card, MoMo, bank transfer) in sandbox</li>
        <li>Verify webhook signature validation works correctly</li>
        <li>Test error handling for declined and timed-out transactions</li>
        <li>Implement idempotency keys for all payment operations</li>
        <li>Switch to production API keys (prefix: <code className="bg-muted px-1 rounded">sk_live_</code>)</li>
        <li>Update base URL if using environment-specific URLs</li>
        <li>Complete KYB verification for your merchant account</li>
      </ul>
    </div>

    <AutoDocNavigation />
  </div>
);

export default TestingGuide;
