import { SEO } from "@/components/SEO";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const errorDomains = [
  {
    domain: "Authentication (AUTH_)",
    errors: [
      { code: "AUTH_001", type: "invalid_credentials", status: 401, title: "Invalid Client Credentials", description: "The client_id or client_secret is incorrect.", recovery: "Verify your credentials in the dashboard. Regenerate if necessary." },
      { code: "AUTH_002", type: "token_expired", status: 401, title: "Expired Access Token", description: "The access token has expired (15-minute lifetime).", recovery: "Use your refresh token to obtain a new access token. See Token Lifecycle guide.", retryable: true },
      { code: "AUTH_003", type: "insufficient_scope", status: 403, title: "Insufficient Scope", description: "The token does not have the required scope for this operation.", recovery: "Request a new token with the correct scopes (e.g., accounts, payments)." },
      { code: "AUTH_004", type: "invalid_refresh_token", status: 401, title: "Invalid Refresh Token", description: "The refresh token is invalid or has been revoked.", recovery: "Re-authenticate the user from scratch. Do not retry with the same token." },
      { code: "AUTH_005", type: "token_rate_limit", status: 429, title: "Token Rate Limit Exceeded", description: "Too many token requests in a short period.", recovery: "Wait for the duration specified in the Retry-After header. Implement token caching.", retryable: true },
    ],
  },
  {
    domain: "Certificates (CERT_)",
    errors: [
      { code: "CERT_001", type: "invalid_certificate", status: 400, title: "Invalid Certificate Format", description: "The uploaded certificate is not a valid X.509 PEM.", recovery: "Ensure the certificate is in PEM format with correct BEGIN/END markers." },
      { code: "CERT_002", type: "certificate_expired", status: 401, title: "Certificate Expired", description: "The client certificate has passed its valid_until date.", recovery: "Generate and register a new certificate before the old one expires." },
      { code: "CERT_003", type: "certificate_revoked", status: 401, title: "Certificate Revoked", description: "The certificate has been explicitly revoked.", recovery: "Register a new certificate via the dashboard or API." },
      { code: "CERT_004", type: "thumbprint_mismatch", status: 401, title: "Thumbprint Mismatch", description: "The certificate thumbprint does not match the registered cnf claim.", recovery: "Ensure you are using the same certificate that was registered for this client." },
    ],
  },
  {
    domain: "Account Information — AISP (AISP_)",
    errors: [
      { code: "AISP_001", type: "consent_not_found", status: 401, title: "Consent Not Found or Expired", description: "The AISP consent does not exist or has expired.", recovery: "Create a new consent and redirect the user for authorization." },
      { code: "AISP_002", type: "insufficient_permissions", status: 403, title: "Insufficient Consent Permissions", description: "The consent does not include the requested permission (e.g., ReadTransactions).", recovery: "Create a new consent with the required permissions array." },
      { code: "AISP_003", type: "account_not_found", status: 404, title: "Account Not Found", description: "The specified account_id does not exist or is not linked to this consent.", recovery: "List available accounts first, then use a valid account_id." },
      { code: "AISP_004", type: "consent_revoked", status: 403, title: "Consent Revoked", description: "The end-user or bank has revoked this consent.", recovery: "Request a new consent from the user." },
      { code: "AISP_005", type: "account_closed", status: 403, title: "Account Closed", description: "The bank account has been closed.", recovery: "Remove this account from your sync schedule. Notify the user." },
    ],
  },
  {
    domain: "Payment Initiation — PISP (PISP_)",
    errors: [
      { code: "PISP_001", type: "missing_idempotency_key", status: 400, title: "Missing Idempotency-Key", description: "POST requests to payment endpoints require an Idempotency-Key header.", recovery: "Add a unique Idempotency-Key header to your request." },
      { code: "PISP_002", type: "consent_invalid", status: 403, title: "Invalid or Expired Consent", description: "The PISP consent is not in an authorised state or has expired.", recovery: "Create a new payment consent and re-authorize." },
      { code: "PISP_003", type: "account_blocked", status: 403, title: "Account Blocked", description: "The debtor account is blocked for outgoing payments.", recovery: "Contact the bank. Use a different debtor account if available." },
      { code: "PISP_004", type: "insufficient_funds", status: 402, title: "Insufficient Funds", description: "The debtor account does not have sufficient balance.", recovery: "Inform the user to fund their account. Retry is possible once funded.", retryable: true },
      { code: "PISP_005", type: "amount_exceeds_limits", status: 422, title: "Amount Exceeds Limits", description: "The payment amount exceeds the configured or regulatory limit.", recovery: "Reduce the amount or split into multiple payments." },
      { code: "PISP_006", type: "sca_required", status: 403, title: "SCA Required", description: "Strong Customer Authentication is required for this payment.", recovery: "Redirect the user to the bank's SCA flow." },
      { code: "PISP_007", type: "idempotency_conflict", status: 409, title: "Idempotency Key Conflict", description: "The same idempotency key was used with a different request payload.", recovery: "Use a new, unique idempotency key for different payment parameters." },
    ],
  },
  {
    domain: "Payment Gateway (PAY_)",
    errors: [
      { code: "PAY_001", type: "charge_minimum", status: 400, title: "Amount Below Minimum", description: "The charge amount is below the minimum (100 XAF).", recovery: "Set amount to at least 100 XAF." },
      { code: "PAY_002", type: "charge_declined", status: 402, title: "Charge Declined", description: "The payment provider declined the transaction.", recovery: "Ask the customer to try a different payment method. Retryable with a new idempotency key.", retryable: true },
      { code: "PAY_003", type: "invalid_card", status: 422, title: "Invalid Card Details", description: "Card number, expiry, or CVV is invalid.", recovery: "Prompt the customer to re-enter their card details." },
      { code: "PAY_004", type: "duplicate_charge", status: 409, title: "Duplicate Charge", description: "A charge with this idempotency key already exists with the same payload.", recovery: "This is safe -- the original charge is returned. No action needed." },
      { code: "PAY_005", type: "refund_exceeds_amount", status: 422, title: "Refund Exceeds Remaining", description: "The refund amount exceeds the remaining refundable balance.", recovery: "Check already_refunded in the error details. Adjust the refund amount." },
      { code: "PAY_006", type: "payout_failed", status: 502, title: "Payout Failed", description: "The payout provider returned a failure.", recovery: "Check error details for reason. Retry with exponential backoff.", retryable: true },
      { code: "PAY_007", type: "merchant_not_found", status: 404, title: "Merchant Not Found", description: "The specified merchant_id does not exist.", recovery: "Verify the merchant_id in your dashboard." },
      { code: "PAY_008", type: "wallet_frozen", status: 403, title: "Wallet Frozen", description: "The wallet is frozen due to compliance or operational reasons.", recovery: "Contact support to resolve the freeze." },
      { code: "PAY_009", type: "escrow_invalid_state", status: 409, title: "Invalid Escrow State", description: "The escrow is not in a valid state for this operation.", recovery: "Check escrow status before attempting release or cancel." },
      { code: "PAY_010", type: "insufficient_balance", status: 402, title: "Insufficient Settlement Balance", description: "Your settlement balance is too low for this payout.", recovery: "Wait for pending settlements to clear, or fund your balance.", retryable: true },
    ],
  },
  {
    domain: "Ledger (LED_)",
    errors: [
      { code: "LED_001", type: "unbalanced_entry", status: 422, title: "Unbalanced Journal Entry", description: "Total debits do not equal total credits in the journal entry.", recovery: "Verify your debit and credit amounts sum to equal values." },
      { code: "LED_002", type: "invalid_account_code", status: 404, title: "Invalid Account Code", description: "The specified ledger account code does not exist.", recovery: "List available account codes and use a valid one." },
      { code: "LED_003", type: "period_closed", status: 409, title: "Period Already Closed", description: "The accounting period has been closed and no longer accepts entries.", recovery: "Post the entry to the current open period instead." },
    ],
  },
  {
    domain: "Mobile Money (MM_)",
    errors: [
      { code: "MM_001", type: "wallet_insufficient", status: 402, title: "Insufficient Wallet Balance", description: "The customer's mobile money wallet balance is too low.", recovery: "Inform the customer to top up their wallet. Retry after funding.", retryable: true },
      { code: "MM_002", type: "invalid_phone", status: 422, title: "Invalid Phone Number", description: "The phone number format is invalid for the target operator.", recovery: "Use E.164 format (e.g., +237677000001). Verify the operator prefix." },
      { code: "MM_003", type: "auth_timeout", status: 408, title: "Authorization Timeout", description: "The customer did not approve the USSD/STK prompt within the timeout window.", recovery: "Retry the charge with the same idempotency key. The customer must approve the prompt.", retryable: true },
      { code: "MM_004", type: "provider_unavailable", status: 503, title: "Provider Unavailable", description: "The mobile money provider is temporarily unreachable.", recovery: "Retry with exponential backoff. Check the KOB status page.", retryable: true },
      { code: "MM_005", type: "daily_limit_exceeded", status: 422, title: "Daily Limit Exceeded", description: "The customer has exceeded their daily mobile money transaction limit.", recovery: "Inform the customer. Retry the next business day." },
    ],
  },
  {
    domain: "Flutterwave Integration (FLW_)",
    errors: [
      { code: "FLW_001", type: "flw_api_error", status: 502, title: "Flutterwave API Error", description: "Flutterwave returned an unexpected error.", recovery: "Check error details. Retry with backoff for transient errors.", retryable: true },
      { code: "FLW_002", type: "invalid_bank_code", status: 422, title: "Invalid Bank Code", description: "The specified bank code is not supported by Flutterwave.", recovery: "Use the /v1/gateway/banks endpoint to list valid bank codes." },
      { code: "FLW_003", type: "transfer_failed", status: 502, title: "Transfer Failed", description: "The bank transfer failed at the provider level.", recovery: "Check error details for the bank's rejection reason. Retry if transient.", retryable: true },
    ],
  },
  {
    domain: "Loans (LOAN_)",
    errors: [
      { code: "LOAN_001", type: "product_not_found", status: 404, title: "Loan Product Not Found", description: "The specified loan product ID does not exist.", recovery: "List available loan products and use a valid product_id." },
      { code: "LOAN_002", type: "ineligible", status: 403, title: "Ineligible for Loan", description: "The applicant does not meet the eligibility criteria.", recovery: "Check the eligibility_criteria field in the loan product for requirements." },
      { code: "LOAN_003", type: "amount_exceeds_max", status: 422, title: "Amount Exceeds Maximum", description: "The requested loan amount exceeds the product maximum.", recovery: "Reduce the loan amount to within the product's min/max range." },
      { code: "LOAN_004", type: "already_disbursed", status: 409, title: "Loan Already Disbursed", description: "This loan has already been disbursed and cannot be re-disbursed.", recovery: "No action needed -- the loan is already active." },
      { code: "LOAN_005", type: "repayment_exceeds_outstanding", status: 422, title: "Repayment Exceeds Outstanding", description: "The repayment amount exceeds the outstanding balance.", recovery: "Use the outstanding balance as the maximum repayment amount." },
    ],
  },
  {
    domain: "Savings (SAV_)",
    errors: [
      { code: "SAV_001", type: "insufficient_savings", status: 402, title: "Insufficient Savings Balance", description: "The savings account balance is too low for this withdrawal.", recovery: "Reduce the withdrawal amount or wait for additional deposits." },
      { code: "SAV_002", type: "account_locked", status: 403, title: "Account Locked (Maturity)", description: "The fixed-term savings account has not reached maturity.", recovery: "Wait until the maturity_date before attempting withdrawal." },
      { code: "SAV_003", type: "minimum_balance_violation", status: 422, title: "Minimum Balance Violation", description: "The withdrawal would bring the balance below the required minimum.", recovery: "Reduce the withdrawal amount to maintain the minimum balance." },
    ],
  },
  {
    domain: "Compliance & KYC (KYC_)",
    errors: [
      { code: "KYC_001", type: "document_invalid", status: 422, title: "Document Validation Failed", description: "The uploaded KYC document failed validation (unreadable, expired, or wrong type).", recovery: "Re-upload a clear, valid, and unexpired identity document." },
      { code: "KYC_002", type: "sanctions_match", status: 403, title: "Sanctions Match Found", description: "The individual or entity matched a sanctions list entry.", recovery: "This is a blocking finding. Contact compliance for manual review." },
      { code: "KYC_003", type: "duplicate_submission", status: 409, title: "Duplicate KYC Submission", description: "A KYC submission already exists for this identity.", recovery: "Retrieve the existing KYC status instead of re-submitting." },
    ],
  },
  {
    domain: "Admin (ADM_)",
    errors: [
      { code: "ADM_001", type: "unauthorized_admin", status: 403, title: "Unauthorized Admin Action", description: "The authenticated user does not have the required admin role.", recovery: "Ensure the user has the correct admin role assigned." },
      { code: "ADM_002", type: "report_failed", status: 500, title: "Report Generation Failed", description: "The requested report could not be generated.", recovery: "Retry the request. If persistent, contact support with the error_id.", retryable: true },
    ],
  },
  {
    domain: "Webhooks (WH_)",
    errors: [
      { code: "WH_001", type: "invalid_signature", status: 401, title: "Invalid Webhook Signature", description: "The X-KOB-Signature header does not match the computed HMAC.", recovery: "Verify you are using the correct webhook secret and computing HMAC-SHA256 over the raw body." },
      { code: "WH_002", type: "delivery_failed", status: 502, title: "Webhook Delivery Failed", description: "The webhook endpoint did not return 200 within 5 seconds.", recovery: "Ensure your endpoint responds 200 quickly. Defer processing to a background queue." },
      { code: "WH_003", type: "unsupported_event", status: 422, title: "Event Type Not Supported", description: "The requested event type is not available for webhook subscription.", recovery: "Check the list of supported event types in the Webhooks guide." },
      { code: "WH_004", type: "duplicate_webhook", status: 409, title: "Duplicate Webhook (Replay)", description: "An event with this X-Webhook-ID was already received within the 24h deduplication window.", recovery: "This is the expected outcome of an at-least-once retry. Treat the duplicate as success and ack with HTTP 200 — do not reprocess." },
      { code: "WH_005", type: "stale_timestamp", status: 401, title: "Stale Webhook Timestamp", description: "X-Webhook-Timestamp is outside the accepted ±5 minute window — possible replay attack.", recovery: "Reject the request. Verify your server clock is in sync (NTP). If legitimate, the producer must regenerate the signature with a fresh timestamp." },
    ],
  },
  {
    domain: "General",
    errors: [
      { code: "GEN_001", type: "validation_error", status: 422, title: "Validation Error", description: "One or more request parameters failed validation.", recovery: "Check the details object for specific field errors and fix them." },
      { code: "GEN_002", type: "rate_limited", status: 429, title: "Rate Limited", description: "Too many requests. Check the Retry-After header.", recovery: "Implement exponential backoff. Cache responses where possible.", retryable: true },
      { code: "GEN_003", type: "internal_error", status: 500, title: "Internal Error", description: "An unexpected server error occurred.", recovery: "Retry with exponential backoff. Include the error_id when contacting support.", retryable: true },
      { code: "GEN_004", type: "service_unavailable", status: 503, title: "Service Unavailable", description: "The service is temporarily unavailable for maintenance.", recovery: "Retry after the duration in the Retry-After header. Check the status page.", retryable: true },
    ],
  },
];

const retryExample = `async function apiCallWithRetry(fn, maxRetries = 5) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fn();
      if (response.status === 429 || response.status >= 500) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(r => setTimeout(r, delay));
    }
  }
}`;

const commonMistakes = [
  { mistake: "Using the same Idempotency-Key with different payloads", fix: "Generate a unique key per unique request. Use a hash of the payload or a UUID." },
  { mistake: "Not handling 401 by refreshing the token", fix: "Implement automatic token refresh on 401. Do not retry the same expired token." },
  { mistake: "Ignoring the Retry-After header on 429", fix: "Parse the Retry-After header and wait the specified duration before retrying." },
  { mistake: "Processing webhooks before verifying the signature", fix: "Always verify HMAC-SHA256 signature first. Reject unverified payloads." },
  { mistake: "Hardcoding API keys in client-side JavaScript", fix: "Store keys in server-side environment variables. Use publishable keys only on the client." },
  { mistake: "Not implementing exponential backoff on 5xx errors", fix: "Use exponential backoff with jitter: delay = min(base * 2^attempt + random_ms, max_delay)." },
];

const ErrorCodesReference = () => (
  <div className="max-w-4xl mx-auto space-y-8 p-6">
    <SEO title="Error Codes Reference | Kang Open Banking" description="Complete RFC 7807 error code catalogue with 60+ errors organized by domain, recovery actions, and retry guidance." />
    <div>
      <Badge variant="outline" className="mb-2">Reference</Badge>
      <h1 className="text-3xl font-bold">Error Codes Reference</h1>
      <p className="text-muted-foreground mt-2">
        All API errors follow the <a href="https://datatracker.ietf.org/doc/html/rfc7807" target="_blank" rel="noopener noreferrer" className="text-primary underline">RFC 7807</a> standard
        (<code className="bg-muted px-1 rounded">application/problem+json</code>). This page documents all {errorDomains.reduce((sum, d) => sum + d.errors.length, 0)} error codes across {errorDomains.length} domains.
      </p>
    </div>

    {/* Error Response Format */}
    <div className="bg-muted/50 rounded-lg p-4 border">
      <h3 className="font-semibold mb-2">Error Response Format</h3>
      <pre className="bg-background rounded p-3 text-xs overflow-x-auto border">
{JSON.stringify({
  error: "insufficient_funds",
  error_code: "PISP_004",
  message: "The debtor account has insufficient balance for the requested payment amount.",
  details: { available_balance: "25000.00", requested_amount: "50000.00" },
  error_id: "err_a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  timestamp: "2026-02-16T10:05:00Z",
}, null, 2)}
      </pre>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Field</th>
              <th className="text-left py-2 font-semibold">Type</th>
              <th className="text-left py-2 font-semibold">Description</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            <tr className="border-b"><td className="py-2 font-mono text-xs">error</td><td className="py-2">string</td><td className="py-2">Machine-readable error type</td></tr>
            <tr className="border-b"><td className="py-2 font-mono text-xs">error_code</td><td className="py-2">string</td><td className="py-2">Domain-prefixed code (e.g., AUTH_001, PAY_003)</td></tr>
            <tr className="border-b"><td className="py-2 font-mono text-xs">message</td><td className="py-2">string</td><td className="py-2">Human-readable description</td></tr>
            <tr className="border-b"><td className="py-2 font-mono text-xs">error_id</td><td className="py-2">string</td><td className="py-2">Unique trace ID -- include in support requests</td></tr>
            <tr className="border-b"><td className="py-2 font-mono text-xs">timestamp</td><td className="py-2">string</td><td className="py-2">ISO 8601 timestamp</td></tr>
            <tr className="border-b"><td className="py-2 font-mono text-xs">details</td><td className="py-2">object</td><td className="py-2">Optional validation or context details</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    {/* HTTP Status Codes */}
    <div>
      <h2 className="text-xl font-bold mb-3">HTTP Status Codes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Code</th>
              <th className="text-left py-2 font-semibold">Meaning</th>
              <th className="text-left py-2 font-semibold">When</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {[
              [400, "Bad Request", "Missing or invalid fields"],
              [401, "Unauthorized", "Invalid or missing authentication"],
              [402, "Payment Required", "Insufficient funds or payment declined"],
              [403, "Forbidden", "Valid auth, insufficient permissions"],
              [404, "Not Found", "Resource does not exist"],
              [408, "Request Timeout", "Customer did not respond in time (e.g., USSD prompt)"],
              [409, "Conflict", "Idempotency key reused with different payload"],
              [422, "Unprocessable Entity", "Valid syntax but semantic errors"],
              [429, "Too Many Requests", "Rate limit exceeded -- check Retry-After header"],
              [500, "Internal Error", "Server error -- use error_id for support"],
              [502, "Bad Gateway", "Upstream provider returned an error"],
              [503, "Service Unavailable", "Maintenance or temporary outage"],
            ].map(([code, meaning, when]) => (
              <tr key={String(code)} className="border-b">
                <td className="py-2 font-mono font-semibold">{code}</td>
                <td className="py-2">{meaning}</td>
                <td className="py-2">{when}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Error Domains */}
    {errorDomains.map(domain => (
      <div key={domain.domain}>
        <h2 className="text-xl font-bold mb-3">{domain.domain}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2 font-semibold">Code</th>
                <th className="text-left py-2 font-semibold">Status</th>
                <th className="text-left py-2 font-semibold">Title</th>
                <th className="text-left py-2 font-semibold">Recovery Action</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              {domain.errors.map(e => (
                <tr key={e.code} className="border-b">
                  <td className="py-2 font-mono text-xs whitespace-nowrap">
                    {e.code}
                    {e.retryable && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary">retryable</span>}
                  </td>
                  <td className="py-2">{e.status}</td>
                  <td className="py-2 font-medium text-foreground">{e.title}</td>
                  <td className="py-2">{e.recovery}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ))}

    {/* Retry Logic */}
    <div>
      <h2 className="text-xl font-bold mb-3">Retry Logic with Exponential Backoff</h2>
      <p className="text-muted-foreground mb-4">
        For errors marked as <span className="text-[10px] px-1 py-0.5 rounded bg-primary/10 text-primary font-medium">retryable</span>, implement exponential backoff with jitter. Always respect the <code className="bg-muted px-1 rounded">Retry-After</code> header when present.
      </p>
      <div className="bg-muted/50 rounded-lg p-4 border">
        <pre className="bg-background rounded p-3 text-xs overflow-x-auto border font-mono">{retryExample}</pre>
      </div>
    </div>

    {/* Common Mistakes */}
    <div>
      <h2 className="text-xl font-bold mb-3">Common Mistakes</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Mistake</th>
              <th className="text-left py-2 font-semibold">Fix</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {commonMistakes.map(m => (
              <tr key={m.mistake} className="border-b">
                <td className="py-2">{m.mistake}</td>
                <td className="py-2">{m.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Endpoint → Errors cross-link */}
    <div>
      <h2 className="text-xl font-bold mb-3">Errors by Endpoint</h2>
      <p className="text-muted-foreground mb-4 text-sm">
        Quick reference: which error codes can each endpoint return. Click an endpoint to open its API reference.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 font-semibold">Endpoint</th>
              <th className="text-left py-2 font-semibold">Possible error codes</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {endpointErrorMap.map(({ method, path: ep, ref, codes }) => (
              <tr key={`${method} ${ep}`} className="border-b">
                <td className="py-2 font-mono text-xs whitespace-nowrap">
                  <a href={ref} className="text-primary hover:underline">
                    <span className="text-foreground font-semibold mr-1">{method}</span>{ep}
                  </a>
                </td>
                <td className="py-2">
                  <div className="flex flex-wrap gap-1">
                    {codes.map((c) => (
                      <code key={c} className="px-1.5 py-0.5 rounded bg-muted text-xs">{c}</code>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>

    <AutoDocNavigation />
  </div>
);

export default ErrorCodesReference;
