// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P6, P9)
import { GuidePageShell, GuideSectionBlock, GuideCallout } from "@/components/developer/GuidePageShell";
import { CodeBlock } from "@/components/developer/CodeBlock";

export default function ScaGuide() {
  return (
    <GuidePageShell
      eyebrow="Security"
      title="Strong Customer Authentication (SCA)"
      description="Step-up authentication for payment initiation, consent grants, and high-risk account changes — challenge issuance, verification, and the full payment-with-SCA flow."
      readTime="7 min read"
      level="Intermediate"
      primaryCta={{ label: "API: Initiate SCA", to: "/developer/api-explorer#tag/Security" }}
      secondaryCta={{ label: "PISP reference", to: "/developer/open-banking/pisp" }}
      toc={[
        { id: "when", label: "When SCA is required" },
        { id: "challenge-types", label: "Challenge types" },
        { id: "initiate", label: "Initiate a challenge" },
        { id: "verify", label: "Verify a challenge" },
        { id: "flow", label: "Full payment flow" },
        { id: "errors", label: "Error codes" },
      ]}
    >
      <GuideCallout variant="info" title="FAPI 1.0 Advanced §5.2.5">
        SCA is mandatory for payment initiation (PISP), consent authorization,
        and any account-update action that mutates a security-sensitive field.
        It is delivered as an HTTP-level challenge — never bypassable from the
        client.
      </GuideCallout>

      <GuideSectionBlock id="when" title="When SCA is required">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><code>action_type=payment</code> — every <code>POST /v1/pisp/payment-submission</code> and high-value gateway charge.</li>
          <li><code>action_type=consent</code> — when a user authorizes an AISP or PISP consent.</li>
          <li><code>action_type=account_update</code> — when a user changes their PIN, beneficiaries, or 2FA factors.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="challenge-types" title="Supported challenge types">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Type</th>
                <th className="text-left p-2">Delivery</th>
                <th className="text-left p-2">TTL</th>
                <th className="text-left p-2">Notes</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="p-2"><code>otp</code></td><td className="p-2">SMS or email one-time code</td><td className="p-2">5 min</td><td className="p-2">Default fallback channel</td></tr>
              <tr className="border-b"><td className="p-2"><code>biometric</code></td><td className="p-2">Mobile app push approval (FaceID / fingerprint)</td><td className="p-2">2 min</td><td className="p-2">Possession + inherence factor</td></tr>
              <tr><td className="p-2"><code>pin</code></td><td className="p-2">Knowledge factor entered in-app</td><td className="p-2">5 min</td><td className="p-2">Combined with bearer token</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="initiate" title="1. Initiate a challenge">
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X POST https://api.kangopenbanking.com/v1/security/sca/initiate \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "action_type": "payment" }'`,
            },
            {
              language: "javascript",
              label: "Node.js",
              code: `const res = await fetch('https://api.kangopenbanking.com/v1/security/sca/initiate', {
  method: 'POST',
  headers: {
    Authorization: \`Bearer \${accessToken}\`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ action_type: 'payment' }),
});
const { challenge_id, challenge_type, expires_at } = await res.json();`,
            },
            {
              language: "python",
              label: "Python",
              code: `import requests
r = requests.post(
  "https://api.kangopenbanking.com/v1/security/sca/initiate",
  headers={"Authorization": f"Bearer {access_token}"},
  json={"action_type": "payment"},
)
challenge = r.json()`,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground mt-2">
          Response includes <code>challenge_id</code>, <code>challenge_type</code>,
          and <code>expires_at</code>. Persist the <code>challenge_id</code> alongside
          your pending payment so you can submit the verification result.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="verify" title="2. Verify the challenge">
        <CodeBlock
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X POST https://api.kangopenbanking.com/v1/security/sca/verify \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{ "challenge_id": "ch_…", "code": "123456" }'`,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground mt-2">
          A successful verification returns <code>{`{ "verified": true, "sca_token": "…" }`}</code>.
          Pass <code>sca_token</code> as the <code>X-SCA-Token</code> header on the
          payment-submission call within 60 seconds.
        </p>
      </GuideSectionBlock>

      <GuideSectionBlock id="flow" title="Full payment-with-SCA flow">
        <CodeBlock
          examples={[
            {
              language: "text",
              label: "Sequence",
              code: `Client                     Kang API                        User device
  | --- POST /pisp/payment ---->  |                              |
  |                               | --- POST /sca/initiate ----> |
  |                               | <-- challenge_id, type ----- |
  |                               | -- push / SMS challenge ---> |
  |                               | <-- code or approval ------- |
  |                               | --- POST /sca/verify ------> |
  |                               | <-- sca_token -------------- |
  | <-- 201 PaymentSubmission --- |                              |
  | -- webhook payment.completed -|                              |`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="errors" title="Error codes">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Code</th>
                <th className="text-left p-2">HTTP</th>
                <th className="text-left p-2">Meaning</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b"><td className="p-2"><code>SCA_REQUIRED</code></td><td className="p-2">401</td><td className="p-2">Action requires step-up; call <code>/sca/initiate</code>.</td></tr>
              <tr className="border-b"><td className="p-2"><code>SCA_CHALLENGE_EXPIRED</code></td><td className="p-2">410</td><td className="p-2">Re-initiate a new challenge.</td></tr>
              <tr className="border-b"><td className="p-2"><code>SCA_INVALID_CODE</code></td><td className="p-2">401</td><td className="p-2">Wrong code; up to 3 retries before lockout.</td></tr>
              <tr><td className="p-2"><code>SCA_LOCKED</code></td><td className="p-2">423</td><td className="p-2">Too many failures — user must re-authenticate from scratch.</td></tr>
            </tbody>
          </table>
        </div>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
