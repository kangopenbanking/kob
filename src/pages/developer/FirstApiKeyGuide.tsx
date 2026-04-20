import { GuidePageShell, GuideStep, GuideCallout, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function FirstApiKeyGuide() {
  return (
    <GuidePageShell
      eyebrow="Getting Started"
      title="Your First API Key in 2 Minutes"
      description="The shortest path from zero to a working sandbox API key — no credit card, no waiting."
      readTime="2 min read"
      level="Beginner"
      primaryCta={{ label: "Open Developer Portal", to: "/developer/registration" }}
      secondaryCta={{ label: "See API Reference", to: "/developer/api/reference" }}
      toc={[
        { id: "before", label: "Before you start" },
        { id: "steps", label: "Three quick steps" },
        { id: "verify", label: "Verify it works" },
        { id: "next", label: "Next steps" },
      ]}
    >
      <GuideSectionBlock id="before" title="Before you start">
        <p>
          You only need an email address. The sandbox is permanently free and never expires — make as many
          test calls as you like.
        </p>
        <GuideCallout variant="info" title="Sandbox keys vs Live keys">
          Sandbox keys begin with <code>sk_test_</code> and only touch test data. Live keys begin with
          <code> sk_live_</code> and are issued after KYC. We recommend starting in sandbox.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="steps" title="Three quick steps">
        <GuideStep number={1} title="Create a free developer account">
          Open the developer portal and sign up with your work email. You will land on the dashboard
          immediately — no email confirmation gate for sandbox use.
        </GuideStep>
        <GuideStep number={2} title="Create your first application">
          From the dashboard click <strong>New Application</strong>, give it a name (e.g. <em>“Acme Test”</em>)
          and pick the scopes you need. <code>accounts</code> + <code>payments</code> covers most use cases.
        </GuideStep>
        <GuideStep number={3} title="Copy your sandbox key">
          Your <code>client_id</code> and <code>client_secret</code> are shown once. Store them in a password
          manager or environment variables — never in git.
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="verify" title="Verify it works">
        <p>Run this from your terminal. A successful response returns an <code>access_token</code>.</p>
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X POST "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token" \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=YOUR_CLIENT_ID" \\
  -d "client_secret=YOUR_CLIENT_SECRET" \\
  -d "scope=accounts payments"`,
            },
          ]}
        />
        <GuideCallout variant="success" title="That's it.">
          You now have a working access token. It is valid for 60 minutes — request a new one when it expires.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="next" title="Next steps">
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
          <li>Send your first charge — see the <a className="text-primary underline" href="/developer/guides/first-charge">First Charge guide</a>.</li>
          <li>Subscribe to webhooks so you don't have to poll for updates.</li>
          <li>When you are ready for production, follow the <a className="text-primary underline" href="/developer/guides/going-live">Going Live checklist</a>.</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
