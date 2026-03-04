import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { DocNavigation } from "@/components/developer/DocNavigation";

const countries = [
  { code: "CM", name: "Cameroon", region: "CEMAC", card: true, momo: true, bank: true, providers: "Flutterwave, MTN MoMo, Orange Money" },
  { code: "GA", name: "Gabon", region: "CEMAC", card: true, momo: true, bank: true, providers: "Flutterwave, Airtel Money" },
  { code: "CG", name: "Congo (Brazzaville)", region: "CEMAC", card: false, momo: true, bank: true, providers: "Flutterwave, MTN MoMo" },
  { code: "TD", name: "Chad", region: "CEMAC", card: false, momo: true, bank: true, providers: "Flutterwave, Airtel Money" },
  { code: "CF", name: "Central African Republic", region: "CEMAC", card: false, momo: false, bank: true, providers: "Bank Transfer" },
  { code: "GQ", name: "Equatorial Guinea", region: "CEMAC", card: false, momo: false, bank: true, providers: "Bank Transfer" },
  { code: "NG", name: "Nigeria", region: "West Africa", card: true, momo: false, bank: true, providers: "Flutterwave, Stripe" },
  { code: "GH", name: "Ghana", region: "West Africa", card: true, momo: true, bank: true, providers: "Flutterwave" },
  { code: "KE", name: "Kenya", region: "East Africa", card: true, momo: true, bank: true, providers: "Flutterwave, M-Pesa" },
  { code: "US", name: "United States", region: "International", card: true, momo: false, bank: true, providers: "Stripe" },
  { code: "GB", name: "United Kingdom", region: "International", card: true, momo: false, bank: true, providers: "Stripe" },
  { code: "FR", name: "France", region: "International", card: true, momo: false, bank: true, providers: "Stripe" },
];

const SupportedCountriesPage = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Supported Countries | Kang Open Banking" description="Country availability matrix by payment channel and provider coverage across CEMAC, West Africa, East Africa, and international markets." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Supported Countries</h1>
      <p className="text-muted-foreground mt-2">
        Kang Open Banking provides payment processing across CEMAC, West Africa, East Africa, and international markets. 
        Coverage varies by payment channel and provider.
      </p>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="text-left py-2 font-semibold">Country</th>
            <th className="text-left py-2 font-semibold">Region</th>
            <th className="text-center py-2 font-semibold">Card</th>
            <th className="text-center py-2 font-semibold">Mobile Money</th>
            <th className="text-center py-2 font-semibold">Bank Transfer</th>
            <th className="text-left py-2 font-semibold">Providers</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {countries.map(c => (
            <tr key={c.code} className="border-b">
              <td className="py-2"><span className="font-mono text-xs mr-1">{c.code}</span> {c.name}</td>
              <td className="py-2 text-xs">{c.region}</td>
              <td className="py-2 text-center">{c.card ? "✅" : "—"}</td>
              <td className="py-2 text-center">{c.momo ? "✅" : "—"}</td>
              <td className="py-2 text-center">{c.bank ? "✅" : "—"}</td>
              <td className="py-2 text-xs">{c.providers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">CEMAC Priority Market</h3>
      <p className="text-sm text-muted-foreground">
        Cameroon is the primary market with full channel support (card, mobile money, bank transfer, USSD). 
        Other CEMAC countries are available via bank transfer with mobile money coverage expanding through MTN and Airtel partnerships.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Provider Routing</h3>
      <p className="text-sm text-muted-foreground">
        The platform automatically routes transactions to the optimal provider based on currency, country, and channel. 
        Flutterwave handles African payments while Stripe processes international card and bank transfers. 
        This routing is transparent to your integration.
      </p>
    </div>

    <DocNavigation
      previousPage={{ title: "Supported Currencies", path: "/developer/api/currencies" }}
      nextPage={{ title: "Testing Guide", path: "/developer/api/testing" }}
    />
  </div>
);

export default SupportedCountriesPage;
