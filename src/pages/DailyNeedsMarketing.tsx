import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UtensilsCrossed, Pill, Wallet, Truck } from "lucide-react";

export default function DailyNeedsMarketing() {
  return (
    <main className="min-h-screen bg-background">
      <section className="max-w-5xl mx-auto px-6 py-20 text-center space-y-6">
        <h1 className="text-4xl md:text-5xl font-semibold tracking-tight">Daily Needs</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Food and pharmacy delivery, paid seamlessly from your Kang wallet. Designed for everyday life.
        </p>
        <div className="flex gap-3 justify-center">
          <Button asChild size="lg"><Link to="/app/daily-needs">Open the app</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/merchant-register">List your store</Link></Button>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-20 grid md:grid-cols-2 gap-4">
        <Card className="p-6 space-y-2">
          <UtensilsCrossed className="size-7" />
          <h2 className="text-xl font-semibold">Food</h2>
          <p className="text-sm text-muted-foreground">Order from local restaurants and ghost kitchens. Live tracking from kitchen to door.</p>
        </Card>
        <Card className="p-6 space-y-2">
          <Pill className="size-7" />
          <h2 className="text-xl font-semibold">Pharmacy</h2>
          <p className="text-sm text-muted-foreground">Over-the-counter and prescription medicines. Pharmacist-reviewed before dispatch.</p>
        </Card>
        <Card className="p-6 space-y-2">
          <Wallet className="size-7" />
          <h2 className="text-xl font-semibold">Wallet checkout</h2>
          <p className="text-sm text-muted-foreground">One-tap pay from your Kang wallet. Funds held in escrow until you confirm delivery.</p>
        </Card>
        <Card className="p-6 space-y-2">
          <Truck className="size-7" />
          <h2 className="text-xl font-semibold">Trusted delivery</h2>
          <p className="text-sm text-muted-foreground">Powered by Kang's existing transport network. 4-digit code confirms hand-off.</p>
        </Card>
      </section>
    </main>
  );
}
