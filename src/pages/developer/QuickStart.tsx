import { GuidePageShell, GuideStep, GuideCallout, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function QuickStart() {
  return (
    <GuidePageShell
      eyebrow="Quickstart"
      title="Get Started in 5 Minutes"
      description="Three simple steps from sign-up to your first authenticated API call against the live sandbox."
      readTime="5 min read"
      level="Beginner"
      primaryCta={{ label: "Get an API key", to: "/developer/guides/first-api-key" }}
      secondaryCta={{ label: "Open API Explorer", to: "/developer/api-explorer" }}
      toc={[
        { id: "register", label: "1. Register" },
        { id: "token", label: "2. Get a token" },
        { id: "call", label: "3. Make a call" },
        { id: "next", label: "Next steps" },
      ]}
    >
      <GuideSectionBlock id="register" title="Step 1 — Register your application">
        <GuideStep number={1} title="Create a free developer account">
          Sign up with your work email. We issue your sandbox <code>client_id</code> and <code>client_secret</code> instantly — no credit card needed.
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="token" title="Step 2 — Obtain an access token">
        <GuideStep number={2} title="Exchange credentials using OAuth 2.0 client credentials">
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
              {
                language: "javascript",
                label: "Node.js",
                code: `const res = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token',
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.KOB_CLIENT_ID!,
      client_secret: process.env.KOB_CLIENT_SECRET!,
      scope: 'accounts payments',
    }),
  }
);
const { access_token } = await res.json();`,
              },
              {
                language: "python",
                label: "Python",
                code: `import os, requests
res = requests.post(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/oauth-token',
  data={
    'grant_type': 'client_credentials',
    'client_id': os.environ['KOB_CLIENT_ID'],
    'client_secret': os.environ['KOB_CLIENT_SECRET'],
    'scope': 'accounts payments',
  },
)
access_token = res.json()['access_token']`,
              },
            ]}
          />
          <GuideCallout variant="info" title="Tokens last 60 minutes">
            Cache them and refresh on expiry. Don't request a new token for every API call.
          </GuideCallout>
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="call" title="Step 3 — Make your first API call">
        <GuideStep number={3} title="Fetch sample accounts">
          <CodeBlock
            examples={[
              {
                language: "bash",
                label: "cURL",
                code: `curl -X GET "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "x-consent-id: YOUR_CONSENT_ID"`,
              },
              {
                language: "javascript",
                label: "Node.js",
                code: `const accounts = await fetch(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts',
  { headers: { Authorization: \`Bearer \${access_token}\`, 'x-consent-id': consentId } }
).then(r => r.json());`,
              },
              {
                language: "python",
                label: "Python",
                code: `accounts = requests.get(
  'https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/aisp/accounts',
  headers={'Authorization': f'Bearer {access_token}', 'x-consent-id': consent_id},
).json()`,
              },
            ]}
          />
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="next" title="Next steps">
        <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
          <li><a className="text-primary underline" href="/developer/guides/first-charge">Send your first charge</a> — accept money in under 5 minutes.</li>
          <li><a className="text-primary underline" href="/developer/api/webhooks">Subscribe to webhooks</a> instead of polling.</li>
          <li><a className="text-primary underline" href="/developer/guides/going-live-simple">Go live</a> when you're ready for production traffic.</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
