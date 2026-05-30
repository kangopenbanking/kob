import { GuidePageShell, GuideSectionBlock, GuideStep, GuideCallout } from "@/components/developer/GuidePageShell";

export default function AISP() {
  return (
    <GuidePageShell
      eyebrow="Open Banking"
      title="Account Information Service Provider (AISP)"
      description="Read account, balance and transaction data with explicit customer consent — the foundation for budgeting, lending and analytics products."
      seoTitle="AISP Guide — Account Information API for Cameroon | Kang Open Banking"
      seoDescription="Build AISP integrations with Kang Open Banking. Read accounts, balances and transactions under explicit, time-bounded consent — COBAC and PSD2-aligned."
      seoKeywords="AISP, account information service, open banking Cameroon, PSD2, account aggregation API, consent flow"
      canonicalPath="/guides/aisp"
      readTime="7 min read"
      level="Intermediate"
      primaryCta={{ label: "Open AISP API reference", to: "/developer/api/aisp" }}
      toc={[
        { id: "what", label: "What is AISP?" },
        { id: "capabilities", label: "Core capabilities" },
        { id: "flow", label: "Consent flow" },
        { id: "endpoints", label: "Key endpoints" },
      ]}
    >
      <GuideSectionBlock id="what" title="What is AISP?">
        <p>
          An Account Information Service Provider reads — but never moves — funds. Think budgeting tools,
          lending decisions, accounting integrations and personal financial dashboards.
        </p>
        <GuideCallout variant="info" title="Consent is mandatory.">
          You must obtain explicit, time-bounded consent from the account holder before any AISP call.
        </GuideCallout>
      </GuideSectionBlock>

      <GuideSectionBlock id="capabilities" title="Core capabilities">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Accounts</h3>
            <p className="text-sm text-muted-foreground">List of accounts, holder details, type, currency.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">GET /v1/aisp/accounts</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Balances</h3>
            <p className="text-sm text-muted-foreground">Current, available and overdraft balances.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">GET /v1/aisp/accounts/&#123;id&#125;/balances</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Transactions</h3>
            <p className="text-sm text-muted-foreground">Up to 24 months of historical transactions, paginated.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">GET /v1/aisp/accounts/&#123;id&#125;/transactions</p>
          </div>
          <div className="rounded-xl border bg-card p-5">
            <h3 className="font-semibold mb-1">Standing orders</h3>
            <p className="text-sm text-muted-foreground">Recurring scheduled payments configured by the customer.</p>
            <p className="font-mono text-xs mt-2 text-foreground/70">GET /v1/aisp/accounts/&#123;id&#125;/standing-orders</p>
          </div>
        </div>
      </GuideSectionBlock>

      <GuideSectionBlock id="flow" title="Consent flow">
        <GuideStep number={1} title="Create a consent">
          POST <code>/v1/consents</code> with the permissions you need and a maximum duration (90 days max).
        </GuideStep>
        <GuideStep number={2} title="Redirect the customer">
          Send the customer to the returned <code>authorization_url</code> to approve at their bank.
        </GuideStep>
        <GuideStep number={3} title="Receive the consent ID">
          On return, capture the consent ID and pass it as <code>x-consent-id</code> on every AISP call.
        </GuideStep>
      </GuideSectionBlock>

      <GuideSectionBlock id="endpoints" title="Key endpoints">
        <ul className="list-disc pl-5 space-y-1 text-muted-foreground">
          <li><code>POST /v1/consents</code> — request access</li>
          <li><code>GET /v1/aisp/accounts</code> — list accounts</li>
          <li><code>GET /v1/aisp/accounts/&#123;id&#125;/balances</code> — balances</li>
          <li><code>GET /v1/aisp/accounts/&#123;id&#125;/transactions</code> — transactions</li>
          <li><code>DELETE /v1/consents/&#123;id&#125;</code> — revoke access</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
