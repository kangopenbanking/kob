import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const errorDomains = [
  {
    domain: "Gateway",
    errors: [
      { type: "charge_declined", status: 402, title: "Charge Declined", description: "Card or mobile money charge was declined by the issuer." },
      { type: "insufficient_funds", status: 402, title: "Insufficient Funds", description: "The payer's account does not have sufficient balance." },
      { type: "invalid_card", status: 422, title: "Invalid Card", description: "Card number, expiry, or CVV is invalid." },
      { type: "duplicate_charge", status: 409, title: "Duplicate Charge", description: "A charge with this idempotency key already exists." },
      { type: "payout_failed", status: 502, title: "Payout Failed", description: "The payout provider returned a failure." },
      { type: "merchant_not_found", status: 404, title: "Merchant Not Found", description: "The specified merchant_id does not exist." },
      { type: "wallet_frozen", status: 403, title: "Wallet Frozen", description: "The wallet is frozen and cannot process transactions." },
      { type: "escrow_invalid_state", status: 409, title: "Invalid Escrow State", description: "The escrow is not in a valid state for this operation." },
    ],
  },
  {
    domain: "Authentication",
    errors: [
      { type: "invalid_token", status: 401, title: "Invalid Token", description: "The access token is missing, expired, or malformed." },
      { type: "insufficient_scope", status: 403, title: "Insufficient Scope", description: "The token does not have the required scope for this operation." },
      { type: "consent_expired", status: 403, title: "Consent Expired", description: "The AISP/PISP consent has expired and must be re-authorized." },
    ],
  },
  {
    domain: "Compliance",
    errors: [
      { type: "screening_blocked", status: 403, title: "Screening Blocked", description: "The transaction was blocked by compliance screening." },
      { type: "sanctions_match", status: 403, title: "Sanctions Match", description: "The beneficiary matched a sanctions list entry." },
      { type: "velocity_exceeded", status: 429, title: "Velocity Limit Exceeded", description: "Transaction velocity limits exceeded." },
    ],
  },
  {
    domain: "General",
    errors: [
      { type: "validation_error", status: 422, title: "Validation Error", description: "One or more request parameters failed validation." },
      { type: "rate_limited", status: 429, title: "Rate Limited", description: "Too many requests. Check the Retry-After header." },
      { type: "idempotency_conflict", status: 409, title: "Idempotency Conflict", description: "The idempotency key was used with different request parameters." },
      { type: "internal_error", status: 500, title: "Internal Error", description: "An unexpected error occurred. Contact support if persistent." },
      { type: "service_unavailable", status: 503, title: "Service Unavailable", description: "The service is temporarily unavailable. Retry with exponential backoff." },
    ],
  },
];

const ErrorCodesReference = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Error Codes Reference | Kang Open Banking" description="Complete RFC 7807 error code catalogue organized by domain: gateway, authentication, compliance, and general errors." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Error Codes Reference</h1>
      <p className="text-muted-foreground mt-2">
        All API errors follow the <a href="https://datatracker.ietf.org/doc/html/rfc7807" target="_blank" rel="noopener noreferrer" className="text-primary underline">RFC 7807</a> standard 
        (<code className="bg-muted px-1 rounded">application/problem+json</code>). Each error includes a machine-readable <code className="bg-muted px-1 rounded">type</code> URI, human-readable <code className="bg-muted px-1 rounded">title</code>, and HTTP <code className="bg-muted px-1 rounded">status</code>.
      </p>
    </div>

    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Error Response Format</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{JSON.stringify({
  type: "https://api.kangopenbanking.com/errors/charge_declined",
  title: "Charge Declined",
  status: 402,
  detail: "The card issuer declined the transaction. Please try a different payment method.",
  instance: "/v1/gateway/charges/chg_abc123",
}, null, 2)}
      </pre>
    </div>

    {errorDomains.map(domain => (
      <div key={domain.domain}>
        <h2 className="text-xl font-bold mb-3">{domain.domain} Errors</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Type</th>
                <th className="text-left py-2 font-semibold">Status</th>
                <th className="text-left py-2 font-semibold">Title</th>
                <th className="text-left py-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {domain.errors.map(e => (
                <tr key={e.type} className="border-b">
                  <td className="py-2 font-mono text-xs">{e.type}</td>
                  <td className="py-2">{e.status}</td>
                  <td className="py-2">{e.title}</td>
                  <td className="py-2">{e.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}

    <DocNavigation
      previousPage={{ title: "Risk & Audit Logs", path: "/developer/api/risk-audit" }}
      nextPage={{ title: "Rate Limits", path: "/developer/api/rate-limits" }}
    />
  </div>
);

export default ErrorCodesReference;
