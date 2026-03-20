import { motion } from "framer-motion";
import { ScrollReveal } from "@/components/ScrollReveal";
import { CreditCard, Building2, Landmark, ArrowDown } from "lucide-react";

const layers = [
  {
    icon: CreditCard,
    label: "Layer 1",
    title: "Payment Gateway",
    features: ["Collections (MoMo, Cards, USSD)", "Payouts & Instant Transfers", "Subscriptions & Recurring", "Split Payments & Escrow"],
    accent: "hsl(var(--primary))",
  },
  {
    icon: Building2,
    label: "Layer 2",
    title: "Open Banking",
    features: ["AISP — Account Information", "PISP — Payment Initiation", "CBPII — Funds Confirmation", "Consent Management & OAuth2"],
    accent: "hsl(var(--chart-2))",
  },
  {
    icon: Landmark,
    label: "Layer 3",
    title: "Banking Infrastructure",
    features: ["Double-Entry Ledger", "Loan Origination & Savings", "KYC/AML & Credit Scoring", "Multi-Tenant Banking App"],
    accent: "hsl(var(--chart-4))",
  },
];

export function ArchitectureSection() {
  return (
    <section className="space-y-8">
      <ScrollReveal>
        <div className="space-y-2 text-center max-w-2xl mx-auto">
          <p className="text-sm font-medium tracking-wider uppercase text-muted-foreground">Architecture</p>
          <h2 className="text-3xl font-bold tracking-tight">One API. Three Layers.</h2>
          <p className="text-muted-foreground">
            KOB is the only platform that combines a payment gateway, open banking, and core banking infrastructure in a single unified API.
          </p>
        </div>
      </ScrollReveal>

      <div className="max-w-xl mx-auto space-y-0">
        {layers.map((layer, i) => (
          <div key={layer.title}>
            <ScrollReveal delay={0.12 * i}>
              <motion.div
                className="rounded-2xl border bg-card p-6 relative"
                whileHover={{ scale: 1.015, boxShadow: "0 8px 30px -12px hsla(var(--primary) / 0.15)" }}
                transition={{ duration: 0.25, ease: "easeOut" }}
              >
                <div className="flex items-start gap-4">
                  <div
                    className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${layer.accent}`, opacity: 0.12 }}
                  >
                    <layer.icon className="h-5 w-5" style={{ color: layer.accent }} />
                  </div>
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium tracking-wider uppercase text-muted-foreground">{layer.label}</span>
                    </div>
                    <h3 className="text-lg font-semibold">{layer.title}</h3>
                    <ul className="grid grid-cols-2 gap-x-4 gap-y-1">
                      {layer.features.map((f) => (
                        <li key={f} className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: layer.accent }} />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            </ScrollReveal>

            {i < layers.length - 1 && (
              <ScrollReveal delay={0.12 * i + 0.06}>
                <div className="flex justify-center py-2">
                  <ArrowDown className="h-4 w-4 text-muted-foreground/40" />
                </div>
              </ScrollReveal>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
