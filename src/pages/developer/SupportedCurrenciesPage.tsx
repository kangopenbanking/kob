import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const currencies = [
  { code: "XAF", name: "Central African CFA Franc", symbol: "FCFA", decimals: 0, countries: "Cameroon, Gabon, Congo, Chad, CAR, Eq. Guinea", channels: ["card", "mobile_money", "bank_transfer"] },
  { code: "XOF", name: "West African CFA Franc", symbol: "CFA", decimals: 0, countries: "Senegal, Côte d'Ivoire, Mali, Burkina Faso, Niger, Togo, Benin, Guinea-Bissau", channels: ["mobile_money", "bank_transfer"] },
  { code: "USD", name: "US Dollar", symbol: "$", decimals: 2, countries: "United States, Global", channels: ["card", "bank_transfer", "push_to_card"] },
  { code: "EUR", name: "Euro", symbol: "€", decimals: 2, countries: "Eurozone", channels: ["card", "bank_transfer", "push_to_card"] },
  { code: "GBP", name: "British Pound", symbol: "£", decimals: 2, countries: "United Kingdom", channels: ["card", "bank_transfer"] },
  { code: "NGN", name: "Nigerian Naira", symbol: "₦", decimals: 2, countries: "Nigeria", channels: ["card", "mobile_money", "bank_transfer"] },
  { code: "GHS", name: "Ghanaian Cedi", symbol: "GH₵", decimals: 2, countries: "Ghana", channels: ["mobile_money", "bank_transfer"] },
  { code: "KES", name: "Kenyan Shilling", symbol: "KSh", decimals: 2, countries: "Kenya", channels: ["mobile_money"] },
];

const SupportedCurrenciesPage = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Supported Currencies | Kang Open Banking" description="Complete list of supported currencies with decimal precision, country coverage, and payment channel availability." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Supported Currencies</h1>
      <p className="text-muted-foreground mt-2">
        The Kang API supports the following currencies for charges, payouts, and wallet operations. 
        All amounts should be sent in the currency's smallest unit where applicable.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Code</th>
            <th className="text-left py-2 font-semibold">Currency</th>
            <th className="text-left py-2 font-semibold">Symbol</th>
            <th className="text-left py-2 font-semibold">Decimals</th>
            <th className="text-left py-2 font-semibold">Countries</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {currencies.map(c => (
            <tr key={c.code} className="border-b">
              <td className="py-2 font-mono font-bold">{c.code}</td>
              <td className="py-2">{c.name}</td>
              <td className="py-2">{c.symbol}</td>
              <td className="py-2">{c.decimals}</td>
              <td className="py-2 text-xs">{c.countries}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <h2 className="text-xl font-bold">Channel Availability Matrix</h2>
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Currency</th>
            <th className="text-center py-2 font-semibold">Card</th>
            <th className="text-center py-2 font-semibold">Mobile Money</th>
            <th className="text-center py-2 font-semibold">Bank Transfer</th>
            <th className="text-center py-2 font-semibold">Push-to-Card</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {currencies.map(c => (
            <tr key={c.code} className="border-b">
              <td className="py-2 font-mono">{c.code}</td>
              <td className="py-2 text-center">{c.channels.includes("card") ? "✅" : "—"}</td>
              <td className="py-2 text-center">{c.channels.includes("mobile_money") ? "✅" : "—"}</td>
              <td className="py-2 text-center">{c.channels.includes("bank_transfer") ? "✅" : "—"}</td>
              <td className="py-2 text-center">{c.channels.includes("push_to_card") ? "✅" : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Zero-Decimal Currencies</h3>
      <p className="text-sm text-muted-foreground">
        XAF and XOF are zero-decimal currencies. Pass amounts as whole numbers (e.g. <code className="bg-muted px-1 rounded">50000</code> for 50,000 FCFA). 
        For currencies with 2 decimal places, pass amounts in minor units (e.g. <code className="bg-muted px-1 rounded">5000</code> for $50.00 USD).
      </p>
    </div>

    <DocNavigation
      previousPage={{ title: "Idempotency", path: "/developer/api/idempotency" }}
      nextPage={{ title: "Supported Countries", path: "/developer/api/countries" }}
    />
  </div>
);

export default SupportedCurrenciesPage;
