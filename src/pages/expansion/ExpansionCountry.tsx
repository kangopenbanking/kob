import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Globe, Landmark, Smartphone, CreditCard, Shield } from "lucide-react";
import { useParams } from "react-router-dom";

const countryData: Record<string, {
  name: string; flag: string; regulator: string; currency: string; currencyCode: string;
  licensingCategory: string; mobileMoneyProviders: string[]; cardSchemes: string[];
  dataProtectionLaw: string; settlementTiming: string; fxConsiderations: string;
  regulatoryRequirements: string[]; keyRisks: string[];
}> = {
  cameroon: {
    name: "Cameroon", flag: "🇨🇲", regulator: "BEAC / COBAC", currency: "Central African CFA Franc", currencyCode: "XAF",
    licensingCategory: "Payment Service Provider (PSP) under CEMAC Regulation",
    mobileMoneyProviders: ["MTN Mobile Money", "Orange Money", "Express Union Mobile"],
    cardSchemes: ["Visa", "Mastercard", "GIM-UEMOA (regional)"],
    dataProtectionLaw: "Law No. 2010/012 on Cybersecurity and Cybercrime",
    settlementTiming: "T+1 (Mobile Money), T+2 (Bank Transfer)",
    fxConsiderations: "XAF pegged to EUR at 655.957 XAF = 1 EUR. Capital controls within CEMAC zone.",
    regulatoryRequirements: ["COBAC PSP license", "BEAC payment system authorization", "GABAC AML compliance", "ANIF registration for STR filing", "Local data hosting (partial)"],
    keyRisks: ["Currency peg stability", "Limited banking penetration (15%)", "Mobile money dominance", "Dual legal system (civil/common law)"],
  },
  nigeria: {
    name: "Nigeria", flag: "🇳🇬", regulator: "CBN (Central Bank of Nigeria)", currency: "Nigerian Naira", currencyCode: "NGN",
    licensingCategory: "Payment Solution Service Provider (PSSP) / Switching & Processing",
    mobileMoneyProviders: ["OPay", "PalmPay", "MTN MoMo", "Paga"],
    cardSchemes: ["Visa", "Mastercard", "Verve"],
    dataProtectionLaw: "Nigeria Data Protection Regulation (NDPR) 2019 / NDPA 2023",
    settlementTiming: "T+1 (Cards), T+0 (Bank Transfer)",
    fxConsiderations: "Managed float. Multiple exchange rate windows. FX liquidity considerations for cross-border.",
    regulatoryRequirements: ["CBN PSSP license", "NIBSS membership", "PCI DSS certification", "NDPR compliance", "BVN integration"],
    keyRisks: ["FX volatility", "Regulatory change frequency", "Multiple exchange rate windows", "Chargeback prevalence"],
  },
  ghana: {
    name: "Ghana", flag: "🇬🇭", regulator: "Bank of Ghana (BoG)", currency: "Ghanaian Cedi", currencyCode: "GHS",
    licensingCategory: "Enhanced Payment Service Provider (E-Money Issuer)",
    mobileMoneyProviders: ["MTN MoMo", "Vodafone Cash", "AirtelTigo Money"],
    cardSchemes: ["Visa", "Mastercard", "Ghana Interbank Payment (GhIPSS)"],
    dataProtectionLaw: "Data Protection Act 2012 (Act 843)",
    settlementTiming: "T+1 (Mobile Money), T+2 (Cards)",
    fxConsiderations: "Freely floating currency. High volatility. BoG FX auction system.",
    regulatoryRequirements: ["BoG payment license", "GhIPSS connectivity", "PCI DSS certification", "Data Protection Commission registration"],
    keyRisks: ["Cedi depreciation risk", "Interoperability requirements", "Mobile money tax implications"],
  },
  kenya: {
    name: "Kenya", flag: "🇰🇪", regulator: "Central Bank of Kenya (CBK)", currency: "Kenyan Shilling", currencyCode: "KES",
    licensingCategory: "Payment Service Provider under National Payment System Act 2011",
    mobileMoneyProviders: ["M-Pesa (Safaricom)", "Airtel Money", "T-Kash"],
    cardSchemes: ["Visa", "Mastercard", "PesaLink"],
    dataProtectionLaw: "Data Protection Act 2019",
    settlementTiming: "T+0 (M-Pesa), T+1 (Bank Transfer)",
    fxConsiderations: "Managed float. CBK intervention. Capital account liberalization ongoing.",
    regulatoryRequirements: ["CBK PSP authorization", "ODPC registration", "PCI DSS certification", "Safaricom Daraja API integration"],
    keyRisks: ["M-Pesa dominance", "Regulatory sandbox limitations", "Cross-border restrictions"],
  },
  "south-africa": {
    name: "South Africa", flag: "🇿🇦", regulator: "South African Reserve Bank (SARB)", currency: "South African Rand", currencyCode: "ZAR",
    licensingCategory: "Third Party Payment Provider (TPPP) / System Operator",
    mobileMoneyProviders: ["FNB eWallet", "Vodacom M-Pesa (limited)", "Standard Bank Instant Money"],
    cardSchemes: ["Visa", "Mastercard", "Diners Club"],
    dataProtectionLaw: "Protection of Personal Information Act (POPIA) 2013",
    settlementTiming: "T+2 (Cards), T+1 (EFT)",
    fxConsiderations: "Freely floating. Exchange Control Regulations. Financial Surveillance Department approval for cross-border.",
    regulatoryRequirements: ["SARB registration", "PASA membership", "POPIA compliance", "FICA compliance (AML)", "PCI DSS certification"],
    keyRisks: ["Load shedding (infrastructure)", "Exchange control complexity", "Twin Peaks regulatory model"],
  },
  europe: {
    name: "Europe", flag: "🇪🇺", regulator: "EBA / National Competent Authorities", currency: "Euro", currencyCode: "EUR",
    licensingCategory: "Payment Institution (PI) under PSD2 / EMI under EMD2",
    mobileMoneyProviders: ["Apple Pay", "Google Pay", "PayPal"],
    cardSchemes: ["Visa", "Mastercard", "Cartes Bancaires (France)", "iDEAL (NL)"],
    dataProtectionLaw: "General Data Protection Regulation (GDPR) 2016/679",
    settlementTiming: "T+1 (SEPA), T+2 (Cards)",
    fxConsiderations: "EUR base. Multi-currency within EU/EEA. Strong Customer Authentication (SCA) mandated.",
    regulatoryRequirements: ["PSD2 Payment Institution license", "GDPR compliance", "SCA implementation", "PCI DSS Level 1", "Open Banking API standards (Berlin Group / OBIE)"],
    keyRisks: ["PSD3 transition planning", "DORA compliance", "27-country regulatory variance", "SCA friction"],
  },
};

export default function ExpansionCountry() {
  const { country } = useParams<{ country: string }>();
  const data = countryData[country || ""] || countryData.cameroon;

  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Expansion</Badge>
        <h1 className="text-4xl font-bold mb-4">{data.flag} {data.name} Market</h1>
        <p className="text-xl text-muted-foreground">
          Regulatory requirements, payment infrastructure, and market considerations for {data.name}.
        </p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <div className="grid md:grid-cols-3 gap-4">
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Regulator</p><p className="font-semibold">{data.regulator}</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">Currency</p><p className="font-semibold">{data.currency} ({data.currencyCode})</p></CardContent></Card>
          <Card><CardContent className="pt-6"><p className="text-xs text-muted-foreground">License Category</p><p className="font-semibold text-sm">{data.licensingCategory}</p></CardContent></Card>
        </div>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Landmark className="h-6 w-6 text-primary" /><CardTitle>Regulatory Requirements</CardTitle></div></CardHeader>
          <CardContent><ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">{data.regulatoryRequirements.map((r) => <li key={r}>{r}</li>)}</ul></CardContent>
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader><div className="flex items-center gap-3"><Smartphone className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Mobile Money</CardTitle></div></CardHeader>
            <CardContent><ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">{data.mobileMoneyProviders.map((p) => <li key={p}>{p}</li>)}</ul></CardContent>
          </Card>
          <Card>
            <CardHeader><div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-primary" /><CardTitle className="text-lg">Card Schemes</CardTitle></div></CardHeader>
            <CardContent><ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">{data.cardSchemes.map((c) => <li key={c}>{c}</li>)}</ul></CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Globe className="h-6 w-6 text-primary" /><CardTitle>Market Details</CardTitle></div></CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">Settlement Timing</h4><p>{data.settlementTiming}</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">FX Considerations</h4><p>{data.fxConsiderations}</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">Data Protection</h4><p>{data.dataProtectionLaw}</p></div>
              <div className="border rounded-lg p-4"><h4 className="font-semibold text-foreground mb-2">Key Risks</h4><ul className="list-disc list-inside space-y-1">{data.keyRisks.map((r) => <li key={r}>{r}</li>)}</ul></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
