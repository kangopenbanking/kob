import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CreditCard, Smartphone, Building2, Webhook, ArrowRight } from "lucide-react";

const integrations = [
  {
    icon: CreditCard,
    title: "Card Payments",
    description: "Accept Visa, Mastercard & local cards with 3D-Secure and tokenization support.",
    link: "/developer/gateway/charges",
  },
  {
    icon: Smartphone,
    title: "Mobile Money",
    description: "MTN MoMo, Orange Money & Express Union — USSD push and QR code flows.",
    link: "/developer/api/mobile-money",
  },
  {
    icon: Building2,
    title: "Bank Transfers",
    description: "Direct bank-to-bank payments and payouts across CEMAC institutions.",
    link: "/developer/gateway/payouts",
  },
  {
    icon: Webhook,
    title: "Webhooks & Events",
    description: "Real-time event notifications for payment status, consent, and settlement updates.",
    link: "/developer/api/webhooks",
  },
];

export function IntegrationOverview() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold">What You Can Build</h2>
        <p className="text-muted-foreground max-w-2xl">
          A unified API for every payment method in Cameroon and the CEMAC region.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {integrations.map((item) => (
          <Card key={item.title} className="group hover:shadow-lg hover:border-primary/30 transition-all">
            <CardHeader className="pb-3">
              <item.icon className="h-8 w-8 text-primary mb-3 group-hover:scale-110 transition-transform" />
              <CardTitle className="text-lg">{item.title}</CardTitle>
              <CardDescription>{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link to={item.link}>
                <Button variant="ghost" size="sm" className="px-0 text-primary">
                  View Docs <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
