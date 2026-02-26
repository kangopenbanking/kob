import { Card, CardContent } from "@/components/ui/card";
import { ShoppingCart, Repeat, Users, BarChart3, Globe, Landmark, Wallet } from "lucide-react";

const useCases = [
  { icon: ShoppingCart, title: "E-Commerce Checkout", description: "Embed a hosted payment page or build a custom checkout with our Charges API." },
  { icon: Repeat, title: "Recurring Billing", description: "Create subscription plans and automatically charge customers on a schedule." },
  { icon: Users, title: "Marketplace Splits", description: "Split payments between multiple vendors with sub-accounts and automated settlements." },
  { icon: Wallet, title: "Account Funding", description: "Let users add funds to their accounts via Mobile Money, Card, or Bank Transfer and withdraw to external banks." },
  { icon: BarChart3, title: "Financial Aggregation", description: "Aggregate account data from multiple banks with AISP consent flows." },
  { icon: Globe, title: "Cross-Border Payments", description: "Send and receive XAF, EUR, USD with real-time FX quotes and ISO 20022 messaging." },
  { icon: Landmark, title: "Lending & Credit", description: "Access credit scoring models and transaction history for underwriting decisions." },
];

export function UseCasesSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Popular Use Cases</h2>
        <p className="text-muted-foreground max-w-2xl">
          From simple checkout to complex financial workflows — KOB powers it all.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {useCases.map((item) => (
          <Card key={item.title} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start gap-4">
                <div className="p-2 rounded-lg bg-primary/10">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
