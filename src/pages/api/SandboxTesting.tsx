import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

export default function SandboxTesting() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">API Reference</Badge>
        <h1 className="text-4xl font-bold mb-4">Sandbox & Testing</h1>
        <p className="text-xl text-muted-foreground">Test cards, mobile money numbers, and simulation parameters for the sandbox environment.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card><CardHeader><CardTitle>Test Cards</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Card Number</th><th className="text-left p-3 font-semibold">Brand</th><th className="text-left p-3 font-semibold">Result</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3 font-mono">4242 4242 4242 4242</td><td className="p-3">Visa</td><td className="p-3">✅ Success</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">4000 0000 0000 0002</td><td className="p-3">Visa</td><td className="p-3">❌ Declined</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">4000 0000 0000 3220</td><td className="p-3">Visa</td><td className="p-3">🔐 3DS Required</td></tr>
                  <tr><td className="p-3 font-mono">5555 5555 5555 4444</td><td className="p-3">Mastercard</td><td className="p-3">✅ Success</td></tr>
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Use any future expiry date and any 3-digit CVC.</p>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Test Mobile Money Numbers</CardTitle></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Number</th><th className="text-left p-3 font-semibold">Provider</th><th className="text-left p-3 font-semibold">Result</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3 font-mono">237670000001</td><td className="p-3">MTN MoMo</td><td className="p-3">✅ Success</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">237670000002</td><td className="p-3">MTN MoMo</td><td className="p-3">❌ Failed</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">237690000001</td><td className="p-3">Orange Money</td><td className="p-3">✅ Success</td></tr>
                  <tr><td className="p-3 font-mono">237690000002</td><td className="p-3">Orange Money</td><td className="p-3">⏳ Timeout</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Simulation Parameters</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p className="mb-3">Use specific amounts to trigger different scenarios in sandbox:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Amount (XAF)</th><th className="text-left p-3 font-semibold">Simulation</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3 font-mono">99999</td><td className="p-3">Triggers fraud detection alert</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">50001</td><td className="p-3">Triggers 3DS authentication</td></tr>
                  <tr className="border-b"><td className="p-3 font-mono">10</td><td className="p-3">Below minimum amount error</td></tr>
                  <tr><td className="p-3 font-mono">666666</td><td className="p-3">Processor timeout simulation</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
