import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const createConsent = `curl -X POST https://api.kangopenbanking.com/v1/aisp/consents \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadTransactionsDetail",
      "ReadBeneficiariesDetail"
    ],
    "expiration_date": "2026-12-31T23:59:59Z",
    "transaction_from_date": "2025-01-01T00:00:00Z",
    "transaction_to_date": "2026-12-31T23:59:59Z"
  }'`;

const consentResponse = `{
  "data": {
    "consent_id": "cns_abc123def456",
    "status": "AwaitingAuthorisation",
    "permissions": [
      "ReadAccountsDetail",
      "ReadBalances",
      "ReadTransactionsDetail",
      "ReadBeneficiariesDetail"
    ],
    "expiration_date": "2026-12-31T23:59:59Z",
    "authorization_url": "https://auth.kangopenbanking.com/authorize?consent_id=cns_abc123def456",
    "created_at": "2026-04-01T10:00:00Z"
  },
  "meta": {
    "request_id": "req_550e8400e29b",
    "timestamp": "2026-04-01T10:00:00Z"
  }
}`;

const revokeConsent = `curl -X DELETE https://api.kangopenbanking.com/v1/aisp/consents/cns_abc123def456 \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo"`;

const nodeExample = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

// Create consent
const consent = await kob.consents.create({
  permissions: ['ReadAccountsDetail', 'ReadBalances'],
  expiration_date: '2026-12-31T23:59:59Z',
});

// Redirect user to authorize
// consent.data.authorization_url

// After authorization, read accounts
const accounts = await kob.accounts.list({
  consent_id: consent.data.consent_id,
});

// Revoke when done
await kob.consents.revoke(consent.data.consent_id);`;

export default function OpenBankingConsents() {
  return (
    <>
      <Helmet>
        <title>Consents | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Open Banking consent management. Create, authorize, query, and revoke AISP and PISP consents with the Kang API." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/open-banking/consents" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Consents</h1>
          <p className="text-lg text-muted-foreground">
            Open Banking consents give your application permission to access a user's bank data (AISP) or initiate payments on their behalf (PISP). Consents follow the OBIE consent model with strong customer authentication.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="lifecycle">Consent Lifecycle</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Status</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                  <th className="text-left p-3 font-medium text-foreground">Transitions To</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["AwaitingAuthorisation", "Consent created, waiting for user to authorize", "Authorised, Rejected, Expired"],
                  ["Authorised", "User has authorized access", "Revoked, Expired"],
                  ["Rejected", "User rejected the consent request", "(Terminal)"],
                  ["Revoked", "Consent revoked by user or TPP", "(Terminal)"],
                  ["Expired", "Consent reached its expiration date", "(Terminal)"],
                ].map(([status, desc, transitions]) => (
                  <tr key={status} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{status}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                    <td className="p-3 text-sm text-muted-foreground">{transitions}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="permissions">Available Permissions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Permission</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["ReadAccountsBasic", "AISP", "Account name and type"],
                  ["ReadAccountsDetail", "AISP", "Full account details including identifiers"],
                  ["ReadBalances", "AISP", "Account balances"],
                  ["ReadTransactionsBasic", "AISP", "Transaction amounts and dates"],
                  ["ReadTransactionsDetail", "AISP", "Full transaction details"],
                  ["ReadBeneficiariesDetail", "AISP", "Saved beneficiary details"],
                  ["ReadStandingOrdersDetail", "AISP", "Standing order details"],
                  ["ReadDirectDebits", "AISP", "Direct debit mandates"],
                  ["CreateDomesticPayment", "PISP", "Initiate domestic payments"],
                  ["CreateInternationalPayment", "PISP", "Initiate international payments"],
                ].map(([perm, type, desc]) => (
                  <tr key={perm} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{perm}</td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="create">Create a Consent</h2>
          <CodeBlock examples={[{ code: createConsent, language: "bash", label: "cURL" }]} />
          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3">Response</h3>
          <CodeBlock examples={[{ code: consentResponse, language: "json" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="sdk">SDK Example</h2>
          <CodeBlock examples={[{ code: nodeExample, language: "javascript", label: "Node.js" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="revoke">Revoke a Consent</h2>
          <CodeBlock examples={[{ code: revokeConsent, language: "bash", label: "cURL" }]} />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
