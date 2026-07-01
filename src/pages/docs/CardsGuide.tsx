import { GuidePageShell, GuideSectionBlock, GuideStep, GuideCallout } from "@/components/developer/GuidePageShell";
import { CreditCard, Smartphone, Package, Globe2, ShieldCheck, Zap, Building2, Lock, Layers, Gauge } from "lucide-react";

export default function CardsGuide() {
  return (
    <GuidePageShell
      eyebrow="Card Issuing"
      title="Modernise your financial infrastructure with on-demand global card issuing"
      description="Issue and manage physical, virtual and digital cards across 30+ markets through a single Kang Open Banking API — with granular spend controls, real-time authorisation streams and PCI-DSS SAQ-A scope."
      seoTitle="Card Issuing API — Virtual, Digital & Physical Cards | Kang Open Banking"
      seoDescription="Launch virtual, digital and physical card programs globally through one Kang Open Banking API. Push-provision to Apple Pay and Google Pay, ship worldwide, stay PCI-DSS compliant."
      seoKeywords="card issuing API, virtual cards, physical cards, Apple Pay push provisioning, Google Pay, PCI-DSS SAQ-A, card program, BIN sponsorship"
      canonicalPath="/docs/cards"
      readTime="8 min read"
      level="Intermediate"
      primaryCta={{ label: "Open Cards API reference", to: "/api-docs#tag/cards" }}
      toc={[
        { id: "overview", label: "Overview" },
        { id: "form-factors", label: "Form factors" },
        { id: "markets", label: "Global markets" },
        { id: "controls", label: "Granular controls" },
        { id: "flow", label: "Issue a card" },
        { id: "endpoints", label: "API reference" },
        { id: "compliance", label: "Security & compliance" },
      ]}
    >
      {/* Overview */}
      <GuideSectionBlock id="overview" title="Effortless global payment scaling">
        <p>
          Kang Open Banking exposes a single unified card-issuing API. Launch a card program in days — not months —
          without negotiating a BIN sponsor, integrating multiple issuers, or holding PAN data in scope.
        </p>
        <div className="grid md:grid-cols-3 gap-4 mt-4">
          <div className="rounded-xl border bg-card p-5">
            <Building2 className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Simplify market entry</h3>
            <p className="text-sm text-muted-foreground">A single point of entry for card programs across multiple countries and currencies.</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Zap className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Fund and monitor easily</h3>
            <p className="text-sm text-muted-foreground">Top up multi-currency wallets from your bank account, cards, or direct debit — control spend in real time.</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Globe2 className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Pay anywhere</h3>
            <p className="text-sm text-muted-foreground">Visa and Mastercard rails maximise acceptance for both travel and everyday spend.</p>
          </div>
        </div>
      </GuideSectionBlock>

      {/* Form factors */}
      <GuideSectionBlock id="form-factors" title="Three form factors, one API">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <CreditCard className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Virtual</h3>
            <p className="text-sm text-muted-foreground mb-2">Instant issuance for online payments, subscriptions and per-vendor controls.</p>
            <p className="font-mono text-xs text-foreground/70">form_factor: "virtual"</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Smartphone className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Digital</h3>
            <p className="text-sm text-muted-foreground mb-2">Push-provisioned directly to Apple Pay and Google Pay wallets from your app.</p>
            <p className="font-mono text-xs text-foreground/70">form_factor: "digital"</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Package className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Physical</h3>
            <p className="text-sm text-muted-foreground mb-2">Personalised cards shipped worldwide with tracked delivery and activation.</p>
            <p className="font-mono text-xs text-foreground/70">form_factor: "physical"</p>
          </div>
        </div>
      </GuideSectionBlock>

      {/* Markets */}
      <GuideSectionBlock id="markets" title="Global markets and networks">
        <p>Issue on Visa and Mastercard rails across a growing footprint — no BIN sponsor negotiation required.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[
            "United States", "United Kingdom", "EEA Countries", "Singapore",
            "Australia", "Hong Kong", "Canada", "Cameroon (XAF)",
            "France", "Germany", "Ireland", "Netherlands",
          ].map((m) => (
            <div key={m} className="rounded-lg border bg-card px-3 py-2 text-sm font-medium">{m}</div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">30+ markets supported. Contact us for an up-to-date coverage matrix per network.</p>
      </GuideSectionBlock>

      {/* Controls */}
      <GuideSectionBlock id="controls" title="Granular payment control">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <Layers className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Manage at scale</h3>
            <p className="text-sm text-muted-foreground">Set per-card spend limits, allowed merchant categories and geo rules at point of issue.</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">De-risk spend</h3>
            <p className="text-sm text-muted-foreground">Real-time fraud monitoring, velocity checks and pattern analysis on every authorisation.</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <Gauge className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Grow with confidence</h3>
            <p className="text-sm text-muted-foreground">Comprehensive reporting, 24/7 support and 99.98% platform uptime.</p>
          </div>
        </div>
      </GuideSectionBlock>

      {/* Flow */}
      <GuideSectionBlock id="flow" title="Issue a card in four steps">
        <GuideStep number={1} title="Create a cardholder profile">
          Complete KYC on the end user through <code>/v1/kyc</code>. A verified profile is required before card issuance.
        </GuideStep>
        <GuideStep number={2} title="Fund the wallet">
          Top up the cardholder's multi-currency wallet with <code>POST /v1/wallets/{"{id}"}/topups</code>.
        </GuideStep>
        <GuideStep number={3} title="Issue the card">
          Call <code>POST /v1/cards</code> with the desired <code>form_factor</code>, currency and (for physical) shipping address.
        </GuideStep>
        <GuideStep number={4} title="Reveal or provision">
          For virtual cards, call <code>POST /v1/cards/reveal</code> after a step-up MFA challenge. For digital, push to Apple Pay or Google Pay.
        </GuideStep>

        <div className="rounded-xl border bg-muted/30 p-5 mt-4">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">Example — issue a virtual card</p>
          <pre className="text-xs overflow-x-auto text-foreground/80"><code>{`curl -X POST https://api.kangopenbanking.com/v1/cards \\
  -H "Authorization: Bearer $TOKEN" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "action": "issue",
    "form_factor": "virtual",
    "currency": "USD",
    "card_name": "A. Ngassa"
  }'`}</code></pre>
        </div>
      </GuideSectionBlock>

      {/* Endpoints */}
      <GuideSectionBlock id="endpoints" title="API reference">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border rounded-xl overflow-hidden">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3 font-semibold">Method</th>
                <th className="p-3 font-semibold">Endpoint</th>
                <th className="p-3 font-semibold">Purpose</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              <tr><td className="p-3 font-mono text-xs">POST</td><td className="p-3 font-mono text-xs">/v1/cards</td><td className="p-3">Issue, list, freeze, unfreeze or terminate a card.</td></tr>
              <tr><td className="p-3 font-mono text-xs">POST</td><td className="p-3 font-mono text-xs">/v1/cards/reveal</td><td className="p-3">Return a short-lived provider reveal token for PAN and CVV.</td></tr>
              <tr><td className="p-3 font-mono text-xs">POST</td><td className="p-3 font-mono text-xs">/v1/cards/webhook</td><td className="p-3">Signed inbound webhook for authorisation and lifecycle events.</td></tr>
              <tr><td className="p-3 font-mono text-xs">GET</td><td className="p-3 font-mono text-xs">/v1/cards/{"{id}"}/transactions</td><td className="p-3">Authorisation and settled transaction history.</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      {/* Compliance */}
      <GuideSectionBlock id="compliance" title="Security and compliance">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <Lock className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">PCI-DSS SAQ-A scope</h3>
            <p className="text-sm text-muted-foreground">Card PAN and CVV never touch Kang or your servers. Reveal is proxied through the provider iframe with a short-lived token.</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <ShieldCheck className="h-5 w-5 text-primary mb-2" strokeWidth={1.5} />
            <h3 className="font-semibold mb-1">Signed webhooks</h3>
            <p className="text-sm text-muted-foreground">Every webhook is HMAC-signed and idempotent on <code>event_id</code>. Verify signatures before acting.</p>
          </div>
        </div>
        <GuideCallout variant="info" title="Step-up MFA on reveal.">
          Revealing card details requires a verified <code>sca_challenges</code> row completed within the last 5 minutes.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
