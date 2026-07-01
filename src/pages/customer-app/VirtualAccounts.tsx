import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Building2,
  ArrowDownLeft,
  Wallet,
  CheckCircle2,
  Landmark,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { HowItWorksFlow } from "@/components/customer-app/HowItWorksFlow";
import type { FlowStep } from "@/components/customer-app/HowItWorksFlow";

const virtualAccountSteps: FlowStep[] = [
  {
    icon: Landmark,
    title: "Generate a local account",
    description:
      "Get a real bank account number in USD, EUR, GBP or another supported currency. No paperwork, no branch visit.",
    color: "hsl(215, 80%, 93%)",
    iconColor: "hsl(215, 60%, 45%)",
  },
  {
    icon: Building2,
    title: "Share your details",
    description:
      "Give the account number, sort/routing code and beneficiary name to the person or company sending you money.",
    color: "hsl(215, 80%, 93%)",
    iconColor: "hsl(215, 60%, 45%)",
  },
  {
    icon: ArrowDownLeft,
    title: "Receive local transfers",
    description:
      "Senders pay via a normal domestic transfer in their country (ACH, SEPA, Faster Payments). No SWIFT fees.",
    color: "hsl(215, 80%, 93%)",
    iconColor: "hsl(215, 60%, 45%)",
  },
  {
    icon: Wallet,
    title: "Settle in XAF",
    description:
      "Funds are converted at a transparent rate and delivered to your Kang Wallet or Mobile Money.",
    color: "hsl(215, 80%, 93%)",
    iconColor: "hsl(215, 60%, 45%)",
  },
  {
    icon: CheckCircle2,
    title: "Track every payment",
    description:
      "Every inflow shows up in Activity with the sender, amount, FX rate and net credited in XAF.",
    color: "hsl(215, 80%, 93%)",
    iconColor: "hsl(215, 60%, 45%)",
  },
];

export default function VirtualAccounts() {
  return (
    <div className="min-h-screen bg-background antialiased">
      <header className="border-b border-border/60 bg-gradient-to-b from-card to-background">
        <div className="container max-w-3xl px-4 sm:px-6 py-8 sm:py-14">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-foreground/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            <Landmark className="h-3 w-3" strokeWidth={1.75} aria-hidden="true" />
            Virtual Accounts
          </div>
          <h1 className="mt-4 text-3xl sm:text-5xl font-semibold tracking-[-0.022em] text-foreground">
            Local accounts,
            <br />
            <span className="text-muted-foreground">worldwide reach.</span>
          </h1>
          <p className="mt-3 sm:mt-4 max-w-lg text-sm sm:text-[15px] leading-relaxed text-muted-foreground">
            Get a real bank account number in your sender's country so they can pay you
            with a normal local transfer.
          </p>
        </div>
      </header>

      <main className="container max-w-3xl px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10">
        <HowItWorksFlow
          title="How Virtual Accounts work"
          storageKey="virtual-accounts"
          steps={virtualAccountSteps}
        />

        <Card className="border-border/60">
          <CardContent className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="flex-1">
              <div className="text-sm font-semibold">Ready to receive?</div>
              <p className="mt-1 text-sm text-muted-foreground">
                Virtual and global accounts are managed together in one place.
              </p>
            </div>
            <Button asChild size="lg" className="rounded-full">
              <Link to="/app/global-accounts">
                Open account manager
                <ArrowRight className="ml-1.5 h-4 w-4" strokeWidth={2} />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div>
          <a
            href="/developer/gateway/virtual-accounts"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/80 hover:text-foreground underline underline-offset-4"
          >
            See integration details
            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
          </a>
        </div>
      </main>
    </div>
  );
}
