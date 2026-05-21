import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const aispExample = `// 1. Create AISP consent
const consent = await fetch('https://api.kangopenbanking.com/v1/aisp/consents', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    permissions: ['ReadAccountsDetail', 'ReadBalances', 'ReadTransactionsDetail'],
    expiration_date: '2026-09-27T00:00:00Z',
  }),
});
const { data: consentData } = await consent.json();
// consentData.status === 'AwaitingAuthorisation'
// consentData.authorization_url → redirect user here

// 2. After user authorises, exchange code for token (see OAuth 2.0 guide)

// 3. Read account data
const accounts = await fetch('https://api.kangopenbanking.com/v1/aisp/accounts', {
  headers: { 'Authorization': 'Bearer ' + aispAccessToken },
});
const { data: accountList } = await accounts.json();

// 4. Read balances
const balances = await fetch(
  \`https://api.kangopenbanking.com/v1/aisp/accounts/\${accountList[0].id}/balances\`,
  { headers: { 'Authorization': 'Bearer ' + aispAccessToken } }
);`;

const pispExample = `// 1. Create PISP consent
const pispConsent = await fetch('https://api.kangopenbanking.com/v1/pisp/domestic-payment-consents', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({
    instruction: {
      amount: '25000',
      currency: 'XAF',
      creditor_account: {
        scheme: 'BBAN',
        identification: '10001-00002-12345678901-23',
        name: 'Supplier SARL',
      },
      debtor_account: {
        scheme: 'BBAN',
        identification: '10001-00002-98765432101-45',
      },
      reference: 'INV-2026-0042',
    },
  }),
});

// 2. After user authorises consent, initiate payment
const payment = await fetch('https://api.kangopenbanking.com/v1/pisp/domestic-payments', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer ' + pispAccessToken,
    'Idempotency-Key': crypto.randomUUID(),
  },
  body: JSON.stringify({ consent_id: pispConsent.data.consent_id }),
});
// payment.data.status: 'AcceptedSettlementInProcess' → poll or listen on webhook`;

export default function OpenBankingOverview() {
  return (
    <>
      <Helmet>
        <title>Open Banking APIs — AISP & PISP | Kang Open Banking</title>
        <meta name="description" content="Open Banking APIs for Cameroon and CEMAC. AISP (Account Information) and PISP (Payment Initiation) with FAPI 1.0 Advanced security, consent lifecycle, and pay-by-bank flows." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/open-banking" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://kangopenbanking.com/developer/open-banking" />
        <meta property="og:title" content="Open Banking APIs — AISP & PISP | Kang Open Banking" />
        <meta property="og:description" content="AISP, PISP, consent, and pay-by-bank for Cameroon and CEMAC over a unified OAuth 2.0 + FAPI 1.0 Advanced API." />
        <meta property="og:image" content="https://kangopenbanking.com/images/og-social.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://kangopenbanking.com/images/og-social.png" />
        <meta name="twitter:title" content="Open Banking APIs — AISP & PISP" />
        <meta name="twitter:description" content="AISP, PISP, consent, and pay-by-bank for Cameroon and CEMAC." />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Open Banking</h1>
          <p className="text-lg text-muted-foreground">
            Kang provides two Open Banking services, conforming to OBIE R/W API v3.1 and FAPI 1.0 Advanced:
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="services">Services</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-foreground mb-2">AISP — Account Information</h3>
              <p className="text-sm text-muted-foreground mb-3">Read account details, balances, and transaction history from a user's bank account with their explicit consent.</p>
              <Link to="/developer/open-banking/aisp" className="text-sm text-primary hover:underline">AISP Guide</Link>
            </div>
            <div className="border border-border rounded-lg p-5">
              <h3 className="font-semibold text-foreground mb-2">PISP — Payment Initiation</h3>
              <p className="text-sm text-muted-foreground mb-3">Initiate domestic and cross-border payments from a user's bank account. Supports single, bulk, and scheduled payments.</p>
              <Link to="/developer/open-banking/pisp" className="text-sm text-primary hover:underline">PISP Guide</Link>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="aisp-flow">AISP Flow</h2>
          <CodeBlock examples={[{ code: aispExample, language: "javascript" }]} title="AISP: Consent → Authorize → Read Data (Node.js)" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="pisp-flow">PISP Flow</h2>
          <CodeBlock examples={[{ code: pispExample, language: "javascript" }]} title="PISP: Consent → Authorize → Initiate Payment (Node.js)" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="consent-lifecycle">Consent Lifecycle</h2>
          <div className="bg-muted/30 border border-border rounded-lg p-4 font-mono text-sm text-muted-foreground overflow-x-auto whitespace-pre">
{`AwaitingAuthorisation ──> Authorised ──> Consumed
                     ╲─> Rejected
                     ╲─> Expired
Authorised ──> Revoked`}
          </div>
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AwaitingAuthorisation", "Consent created, waiting for user to approve"],
                  ["Authorised", "User approved — access token can be used"],
                  ["Consumed", "One-time consent used (PISP single payment)"],
                  ["Rejected", "User explicitly declined"],
                  ["Expired", "Consent passed its expiration_date without authorization"],
                  ["Revoked", "User or TPP revoked an active consent"],
                ].map(([status, desc]) => (
                  <tr key={status} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{status}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="security">FAPI 1.0 Security</h2>
          <p className="text-muted-foreground mb-3">
            All Open Banking operations require PKCE + nonce + PAR. See the <Link to="/developer/authentication/fapi" className="text-primary hover:underline">FAPI 1.0 Advanced guide</Link> for complete security requirements.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="explore">Explore</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {[
              { title: "AISP Guide", desc: "Read accounts, balances, and transactions", path: "/developer/open-banking/aisp" },
              { title: "PISP Guide", desc: "Initiate domestic and cross-border payments", path: "/developer/open-banking/pisp" },
              { title: "Consents", desc: "Create, manage, and revoke consents", path: "/developer/open-banking/consents" },
              { title: "Pay by Bank", desc: "Consumer-facing bank payment flow", path: "/developer/open-banking/pay-by-bank" },
            ].map((card) => (
              <Link key={card.path} to={card.path} className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors">
                <h3 className="font-semibold text-foreground mb-1">{card.title}</h3>
                <p className="text-sm text-muted-foreground">{card.desc}</p>
              </Link>
            ))}
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
