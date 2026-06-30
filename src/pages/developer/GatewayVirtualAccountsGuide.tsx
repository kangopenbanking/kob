import { GuidePageShell, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";

export default function GatewayVirtualAccountsGuide() {
  return (
    <GuidePageShell
      eyebrow="Payment Gateway · Nium-powered"
      title="Virtual Accounts"
      description="Issue dedicated Nium-issued receiving accounts in 17 currencies. Inbound funds auto-convert to XAF and settle into the merchant wallet — fully reconciled, BEAC PoP-compliant, KYC-name enforced."
      readTime="5 min read"
      level="Intermediate"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "create", label: "Create" },
        { id: "list", label: "List" },
        { id: "get", label: "Get one" },
        { id: "kinds", label: "Virtual vs Global" },
        { id: "compliance", label: "Compliance" },
      ]}
    >
      <GuideSectionBlock id="overview" title="How it works">
        <p>
          Virtual Accounts are provisioned through the Nium middleware. Every account is issued in
          the merchant's KYC-verified legal name. Inbound payments are converted to XAF via the
          shared Nium FX engine and credited to the merchant wallet — no Flutterwave-era NGN rails
          are involved.
        </p>
        <ul className="list-disc pl-6">
          <li>Supported source currencies: USD, EUR, GBP, AUD, CAD, SGD, AED, JPY, INR, ZAR, HKD, CHF, NZD, SEK, NOK, DKK, CNY.</li>
          <li>Locked destination currency: <code>XAF</code> (BEAC requirement).</li>
          <li>Provider: <code>nium</code> · Modes: <code>stub</code> / <code>sandbox</code> / <code>live</code>.</li>
        </ul>
      </GuideSectionBlock>

      <GuideSectionBlock id="create" title="Create a virtual account">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/virtual-accounts"
          description="Provision a Nium virtual receiving account. Idempotent per (merchant, currency, account_kind)."
          requestBody={JSON.stringify({
            merchant_id: "mch_uuid",
            email: "treasury@example.com",
            beneficiary_name: "Acme Trading SARL",
            account_kind: "virtual",
            currency: "USD",
            pop_code: "P0801",
          }, null, 2)}
          response={JSON.stringify({
            id: "va_uuid",
            merchant_id: "mch_uuid",
            account_kind: "virtual",
            provider: "nium",
            mode: "sandbox",
            account_number: "8310029471",
            iban: null,
            bic: null,
            routing_code: "026073150",
            bank_name: "Community Federal Savings Bank (via Nium)",
            beneficiary_name: "Acme Trading SARL",
            currency: "USD",
            destination_currency: "XAF",
            status: "active",
            created_at: "2026-06-30T10:00:00Z",
          }, null, 2)}
          parameters={[
            { name: "merchant_id", type: "uuid", required: true, description: "Your merchant ID" },
            { name: "email", type: "string", required: true, description: "Contact email for the account" },
            { name: "beneficiary_name", type: "string", required: false, description: "Must match the KYC-verified legal name on file" },
            { name: "account_kind", type: "enum", required: false, description: "virtual (default) or global" },
            { name: "currency", type: "enum", required: false, description: "One of the 17 Nium-supported currencies. Default USD." },
            { name: "pop_code", type: "string", required: false, description: "BEAC Purpose-of-Payment code (whitelist enforced)" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="list" title="List virtual accounts">
        <ApiEndpoint
          method="GET"
          endpoint="/v1/gateway/virtual-accounts?merchant_id={id}&account_kind=virtual"
          description="List all Nium virtual / global accounts provisioned for the merchant."
          response={JSON.stringify({
            data: [
              { id: "va_uuid", account_kind: "virtual", currency: "USD", account_number: "8310029471", bank_name: "Community Federal Savings Bank (via Nium)", status: "active" },
              { id: "ga_uuid", account_kind: "global", currency: "EUR", iban: "DE89370400440532013000", bic: "COBADEFFXXX", status: "active" },
            ],
          }, null, 2)}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="get" title="Get one">
        <ApiEndpoint
          method="GET"
          endpoint="/v1/gateway/virtual-accounts/{accountId}"
          description="Fetch the Nium-issued virtual account details."
          response={JSON.stringify({
            id: "va_uuid",
            account_kind: "virtual",
            provider: "nium",
            account_number: "8310029471",
            routing_code: "026073150",
            bank_name: "Community Federal Savings Bank (via Nium)",
            beneficiary_name: "Acme Trading SARL",
            currency: "USD",
            destination_currency: "XAF",
            status: "active",
          }, null, 2)}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="kinds" title="Virtual vs Global">
        <table className="w-full text-sm border border-border rounded-md">
          <thead>
            <tr className="bg-muted">
              <th className="text-left p-3">Kind</th>
              <th className="text-left p-3">Returns</th>
              <th className="text-left p-3">Use case</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-border">
              <td className="p-3"><code>virtual</code></td>
              <td className="p-3">Local account number + routing code</td>
              <td className="p-3">Domestic-rail collections (e.g. ACH USD, Faster Payments GBP)</td>
            </tr>
            <tr className="border-t border-border">
              <td className="p-3"><code>global</code></td>
              <td className="p-3">IBAN + BIC/SWIFT</td>
              <td className="p-3">Cross-border SWIFT / SEPA collections</td>
            </tr>
          </tbody>
        </table>
      </GuideSectionBlock>

      <GuideSectionBlock id="compliance" title="Compliance locks">
        <ul className="list-disc pl-6">
          <li><strong>KYC-name enforcement:</strong> <code>beneficiary_name</code> must match the KYC-verified legal name. Mismatches are rejected at provisioning.</li>
          <li><strong>BEAC PoP whitelist:</strong> only approved Purpose-of-Payment codes are accepted for inbound credits.</li>
          <li><strong>Shared FX math:</strong> all conversions use <code>_shared/nium-client.ts</code>; rates are auditable and reconciled per webhook event.</li>
          <li><strong>Webhook events:</strong> <code>nium.account.*</code>, <code>nium.payout.*</code>, <code>nium.conversion.*</code>, <code>nium.rfi.*</code> (idempotent on <code>event_id</code>).</li>
        </ul>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
