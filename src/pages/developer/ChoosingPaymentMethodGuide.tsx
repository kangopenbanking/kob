import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { Link } from "react-router-dom";

const methods = [
  {
    name: "Mobile Money",
    when: "Most customers in Cameroon, Côte d'Ivoire, Senegal pay this way.",
    pros: ["Instant", "No card needed", "Reaches the unbanked"],
    cons: ["Provider downtime can occur", "Requires customer phone confirmation"],
    link: "/developer/gateway/mobile-money",
  },
  {
    name: "Card payments",
    when: "International customers, recurring billing, e-commerce.",
    pros: ["Familiar UX", "Supports 3-D Secure", "Tokenisable"],
    cons: ["Higher fees", "Chargeback risk"],
    link: "/developer/gateway/charges",
  },
  {
    name: "Pay by Bank (Open Banking)",
    when: "Large invoices where card fees are prohibitive.",
    pros: ["Lowest fees", "Strong customer authentication", "No chargebacks"],
    cons: ["Slightly longer flow", "Requires consent handover"],
    link: "/developer/guides/pay-by-bank",
  },
  {
    name: "Virtual accounts",
    when: "B2B reconciliation — give each customer a unique account number.",
    pros: ["Reconciles automatically", "Works with existing bank apps"],
    cons: ["Settlement is T+0 to T+1", "Requires merchant KYB"],
    link: "/developer/gateway/virtual-accounts",
  },
];

export default function ChoosingPaymentMethodGuide() {
  return (
    <GuidePageShell
      eyebrow="Concepts"
      title="Choosing the Right Payment Method"
      description="A short, opinionated guide to picking the channel that fits your customer — without the jargon."
      readTime="4 min read"
      level="Beginner"
      toc={[
        { id: "summary", label: "Summary" },
        { id: "options", label: "Your options" },
        { id: "rule", label: "Our rule of thumb" },
      ]}
    >
      <GuideSectionBlock id="summary" title="Summary">
        <p>
          You don't have to pick just one — most merchants enable two or three methods and let the
          customer choose at checkout. Start with what your customers already use; add others over time.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="options" title="Your options">
        <div className="grid md:grid-cols-2 gap-4">
          {methods.map((m) => (
            <div key={m.name} className="rounded-xl border bg-card p-5 hover:shadow-md transition-all animate-fade-in">
              <h3 className="text-lg font-semibold mb-1">{m.name}</h3>
              <p className="text-sm text-muted-foreground mb-3">{m.when}</p>
              <p className="text-xs font-semibold uppercase text-foreground/70 mb-1">Strengths</p>
              <ul className="text-sm text-muted-foreground mb-3 list-disc pl-5">{m.pros.map((p) => <li key={p}>{p}</li>)}</ul>
              <p className="text-xs font-semibold uppercase text-foreground/70 mb-1">Trade-offs</p>
              <ul className="text-sm text-muted-foreground mb-4 list-disc pl-5">{m.cons.map((c) => <li key={c}>{c}</li>)}</ul>
              <Link to={m.link} className="text-sm text-primary underline">Read the guide →</Link>
            </div>
          ))}
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="rule" title="Our rule of thumb">
        <GuideCallout variant="success" title="If in doubt, enable Mobile Money + Card.">
          That covers ~95% of consumer transactions in our Central / West African corridor.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
