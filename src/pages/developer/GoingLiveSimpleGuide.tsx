import { GuidePageShell, GuideStep, GuideCallout, GuideSectionBlock } from "@/components/developer/GuidePageShell";

export default function GoingLiveSimpleGuide() {
  return (
    <GuidePageShell
      eyebrow="Production"
      title="Going Live, Explained Simply"
      description="A plain-English checklist that takes you from sandbox to your first real customer payment."
      readTime="6 min read"
      level="Intermediate"
      primaryCta={{ label: "Submit KYB", to: "/business/onboarding" }}
      secondaryCta={{ label: "Detailed checklist", to: "/developer/guides/go-live-checklist" }}
      toc={[
        { id: "phase1", label: "1. Prepare your account" },
        { id: "phase2", label: "2. Harden your integration" },
        { id: "phase3", label: "3. Switch the keys" },
        { id: "phase4", label: "4. Go live with confidence" },
      ]}
    >
      <GuideSectionBlock id="phase1" title="Phase 1 — Prepare your account">
        <GuideStep number={1} title="Complete business verification (KYB)">
          Upload your registration certificate, tax ID and a director's ID. Most submissions are reviewed
          within one business day.
        </GuideStep>
        <GuideStep number={2} title="Add a settlement bank account">
          This is where Kang will deposit your collected funds. We verify the account by name match.
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="phase2" title="Phase 2 — Harden your integration">
        <GuideStep number={3} title="Verify webhook signatures">
          Every webhook is signed with HMAC-SHA256. Reject any payload whose signature does not validate.
        </GuideStep>
        <GuideStep number={4} title="Add idempotency keys">
          Every <code>POST</code> to charges, payouts and refunds must carry a unique <code>Idempotency-Key</code> header.
        </GuideStep>
        <GuideStep number={5} title="Plan for retries">
          Implement exponential backoff with jitter. Never retry faster than the <code>Retry-After</code> header asks.
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="phase3" title="Phase 3 — Switch the keys">
        <p>Replace your sandbox <code>sk_test_</code> keys with the live <code>sk_live_</code> keys we issue once KYB passes.</p>
        <GuideCallout variant="warning" title="Live keys are powerful.">
          Treat them like a database password — store in a secret manager and rotate every 90 days.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="phase4" title="Phase 4 — Go live with confidence">
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
          <li>Run a £1 / 100 XAF live transaction end-to-end before opening to customers.</li>
          <li>Subscribe to status alerts at <a className="text-primary underline" href="/status">status.kang.com</a>.</li>
          <li>Bookmark the <a className="text-primary underline" href="/developer/support">support page</a> — engineers respond 24/7 for live-traffic issues.</li>
        </ul>
        <GuideCallout variant="success" title="You're production-ready.">
          Welcome to the network — we're excited to see what you build.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
