import { GuidePageShell, GuideSectionBlock, GuideCallout, GuideStep } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

const events = [
  { name: "payment.initiated", desc: "Payment created and pending authorisation." },
  { name: "payment.authorized", desc: "Customer has authorised the payment." },
  { name: "payment.completed", desc: "Funds have been collected successfully." },
  { name: "payment.failed", desc: "Payment failed — see the failure_reason field." },
  { name: "charge.succeeded", desc: "Gateway charge captured." },
  { name: "charge.refunded", desc: "Charge refunded in part or full." },
  { name: "consent.created", desc: "A new account-information consent was granted." },
  { name: "consent.revoked", desc: "A consent has been revoked by the customer." },
  { name: "account.balance_updated", desc: "Account balance changed materially." },
];

export default function Webhooks() {
  return (
    <GuidePageShell
      eyebrow="Events"
      title="Webhooks & Event Notifications"
      description="Real-time HTTP callbacks that keep your system in sync without polling."
      seoTitle="Webhooks Guide — Event Notifications & Signature Verification | Kang Open Banking"
      seoDescription="Receive payment, consent and account events via signed HTTPS webhooks. Verify signatures, handle retries and replay safely with the Kang Open Banking event bus."
      seoKeywords="webhooks, event notifications, signature verification, idempotency, payment events, open banking webhooks"
      canonicalPath="/guides/webhooks"
      readTime="6 min read"
      level="Intermediate"
      primaryCta={{ label: "Manage webhooks", to: "/developer/webhooks" }}
      secondaryCta={{ label: "Test webhooks", to: "/developer/sandbox/webhooks" }}
      toc={[
        { id: "what", label: "What are webhooks?" },
        { id: "events", label: "Available events" },
        { id: "setup", label: "Set one up" },
        { id: "verify", label: "Verify signatures" },
      ]}
    >
      <GuideSectionBlock id="what" title="What are webhooks?">
        <p>
          Webhooks are HTTP <code>POST</code> requests we send to your URL when something happens in
          Kang. They replace polling: instead of you asking us “did this charge complete?”, we tell you
          the moment it does.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="events" title="Available events">
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr><th className="text-left p-3">Event</th><th className="text-left p-3">When it fires</th></tr>
            </thead>
            <tbody className="text-muted-foreground">
              {events.map((e) => (
                <tr key={e.name} className="border-t"><td className="p-3 font-mono">{e.name}</td><td className="p-3">{e.desc}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="setup" title="Set one up">
        <GuideStep number={1} title="Create an HTTPS endpoint">
          We will only deliver to <code>https://</code> URLs. Self-signed certificates are not allowed in production.
        </GuideStep>
        <GuideStep number={2} title="Register the endpoint">
          Add it from the dashboard or via <code>POST /v1/webhooks</code>. Pick the events you care about — we won't deliver others.
        </GuideStep>
        <GuideStep number={3} title="Respond with 2xx within 10 seconds">
          Anything else triggers our retry policy: 5 attempts with exponential backoff (1s, 5s, 30s, 5m, 30m).
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="verify" title="Verify signatures">
        <p>Every webhook carries a <code>Kang-Signature</code> header. Verify it on every request:</p>
        <CodeBlock
          examples={[
            {
              language: "javascript",
              label: "Node.js",
              code: `import crypto from 'node:crypto';

function verify(rawBody, header, secret) {
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(header));
}`,
            },
          ]}
        />
        <GuideCallout variant="warning" title="Reject unsigned payloads.">
          Treat any webhook with a missing or bad signature as hostile and respond with 401.
        </GuideCallout>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
