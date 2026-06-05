// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P9)
import { GuidePageShell, GuideSectionBlock } from "@/components/developer/GuidePageShell";
import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Globe } from "lucide-react";

export default function GatewayGlobalAccountsGuide() {
  return (
    <GuidePageShell
      eyebrow="Payment Gateway"
      title="Global Receiving Accounts (Nium)"
      description="Issue real USD, EUR or GBP bank accounts. Incoming credits are converted to XAF (Nium FX + configurable spread) and routed to the user's Kang Wallet or Mobile Money via Flutterwave."
      readTime="6 min read"
      level="Intermediate"
      toc={[
        { id: "overview", label: "Overview" },
        { id: "access", label: "Accessing Global Accounts" },
        { id: "create", label: "Create account" },
        { id: "list", label: "List accounts" },
        { id: "preference", label: "Cash-out preference" },
        { id: "webhook", label: "Incoming webhook" },
        { id: "math", label: "Settlement math" },
      ]}
    >
      <GuideSectionBlock id="overview" title="Overview">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">What you get</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              A global account is a real bank account in the user's name, issued by
              Nium's banking partners (e.g. JPMorgan Chase for USD, ClearBank for GBP,
              ING for EUR). Senders use normal SWIFT / ACH / SEPA rails — no Kang-specific
              integration is required on their side.
            </p>
            <p>
              When funds land, KOB applies the Nium FX rate plus a configurable spread,
              deducts a withdrawal fee (only for Mobile Money routing) and credits the
              recipient. Operations are idempotent on Nium's <code>transactionId</code>.
            </p>
            <p>
              Full guide:{" "}
              <a className="text-primary underline" href="/docs/developer-portal/payments/global-accounts.md">
                docs/developer-portal/payments/global-accounts.md
              </a>
              . OpenAPI:{" "}
              <a className="text-primary underline" href="/openapi.json">
                /openapi.json
              </a>{" "}
              (paths <code>/v1/gateway/global-accounts*</code>).
            </p>
          </CardContent>
        </Card>
      </GuideSectionBlock>

      <GuideSectionBlock id="access" title="Accessing Global Accounts">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where to find it</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div>
              <strong className="text-foreground">Developer Portal:</strong> sidebar &rarr;
              {" "}<em>Payment Gateway &rarr; Global Accounts (Nium)</em>, or open{" "}
              <a className="text-primary underline" href="/developer/gateway/global-accounts">
                /developer/gateway/global-accounts
              </a>{" "}(public — no login required, per Order P1).
            </div>
            <div>
              <strong className="text-foreground">Consumer mobile app:</strong>{" "}
              <em>More &rarr; Quick Actions &rarr; Global Accounts</em>, or
              <em> More &rarr; Utilities &rarr; Global Accounts</em>, or
              <em> Linked Accounts &rarr; Global Receiving Accounts</em>.
            </div>
            <div>
              <strong className="text-foreground">All Global Accounts deep links (web + mobile / Capacitor):</strong>
              <table className="mt-2 w-full text-xs border border-border rounded" data-testid="global-accounts-deeplinks">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-2">Surface</th>
                    <th className="text-left p-2">URL</th>
                    <th className="text-left p-2">Resolves to</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border"><td className="p-2">Web shortcut</td><td className="p-2"><code>/global-accounts</code></td><td className="p-2"><code>/app/global-accounts</code></td></tr>
                  <tr className="border-t border-border"><td className="p-2">Consumer canonical</td><td className="p-2"><code>/app/global-accounts</code></td><td className="p-2">GlobalReceivingAccount</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Developer shortcut</td><td className="p-2"><code>/developer/global-accounts</code></td><td className="p-2"><code>/developer/gateway/global-accounts</code></td></tr>
                  <tr className="border-t border-border"><td className="p-2">Developer canonical</td><td className="p-2"><code>/developer/gateway/global-accounts</code></td><td className="p-2">This guide</td></tr>
                  <tr className="border-t border-border"><td className="p-2">iOS / Android (Capacitor)</td><td className="p-2"><code>app.lovable.342820e7280a44d388ce2854c6d907ed://global-accounts</code></td><td className="p-2"><code>/app/global-accounts</code> via WebView</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Universal link</td><td className="p-2"><code>https://kob.lovable.app/global-accounts</code></td><td className="p-2"><code>/app/global-accounts</code></td></tr>
                </tbody>
              </table>
              <p className="mt-2 text-xs">A CI link validator (<code>scripts/check-global-accounts-nav-links.mjs</code>) compares this table, sidebar entries, and mobile menu items against the <code>App.tsx</code> route table and <code>public/sitemap.xml</code> on every PR.</p>
            </div>
            <div>
              <strong className="text-foreground">Required permissions / scopes</strong>
              <table className="mt-2 w-full text-xs border border-border rounded">
                <thead className="bg-muted">
                  <tr><th className="text-left p-2">Action</th><th className="text-left p-2">Audience</th><th className="text-left p-2">OAuth scope</th><th className="text-left p-2">Auth</th></tr>
                </thead>
                <tbody>
                  <tr className="border-t border-border"><td className="p-2">View docs</td><td className="p-2">Anyone</td><td className="p-2">—</td><td className="p-2">None</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Create / list account</td><td className="p-2">Consumer</td><td className="p-2"><code>global_accounts:write</code></td><td className="p-2">Bearer access token</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Update payout preference</td><td className="p-2">Consumer (account owner)</td><td className="p-2"><code>global_accounts:write</code></td><td className="p-2">Bearer + PIN (financial gate)</td></tr>
                  <tr className="border-t border-border"><td className="p-2">Webhook ingestion</td><td className="p-2">Nium → KOB</td><td className="p-2">—</td><td className="p-2">HMAC-SHA256 (<code>x-nium-signature</code>)</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </GuideSectionBlock>

      <GuideSectionBlock id="create" title="Create a global account">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/global-accounts"
          description="Provision a USD / EUR / GBP receiving account for the authenticated user. Idempotent per (user, currency) — calling twice returns the same account."
          requestBody={JSON.stringify(
            { currency: "USD", beneficiary_name: "Jane Influencer" },
            null,
            2,
          )}
          response={JSON.stringify(
            {
              account: {
                id: "f1d6f4a0-1d4e-4a3a-9e0a-1a2b3c4d5e6f",
                currency: "USD",
                iban: null,
                account_number: "912345678",
                routing_code: "021000021",
                bic: "CHASUS33",
                bank_name: "JPMorgan Chase (via Nium)",
                bank_address: "383 Madison Ave, New York, NY 10179",
                beneficiary_name: "Jane Influencer",
                status: "active",
                payout_preference_override: null,
                payout_channel_override: null,
                mode: "stub",
              },
              reused: false,
            },
            null,
            2,
          )}
          parameters={[
            { name: "currency", type: "enum(USD|EUR|GBP)", required: true, description: "Receiving currency" },
            { name: "beneficiary_name", type: "string", required: false, description: "Defaults to the user's KYC name" },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="list" title="List accounts and recent credits">
        <ApiEndpoint
          method="GET"
          endpoint="/v1/gateway/global-accounts"
          description="Returns the caller's global accounts, the last 25 incoming payments, and the user-level routing default."
          response={JSON.stringify(
            {
              accounts: [
                {
                  id: "f1d6f4a0-1d4e-4a3a-9e0a-1a2b3c4d5e6f",
                  currency: "USD",
                  account_number: "912345678",
                  routing_code: "021000021",
                  bank_name: "JPMorgan Chase (via Nium)",
                  beneficiary_name: "Jane Influencer",
                  status: "active",
                  mode: "stub",
                },
              ],
              incoming_payments: [
                {
                  id: "p_2026_03_001",
                  source_amount: 250,
                  source_currency: "USD",
                  fx_rate_nium: 612.45,
                  fx_spread_bps: 75,
                  xaf_gross: 153112,
                  xaf_spread_revenue: 1148,
                  xaf_withdrawal_fee: 0,
                  xaf_net_credited: 151964,
                  routing: "KANG_WALLET",
                  status: "credited",
                  created_at: "2026-03-12T14:02:11Z",
                },
              ],
              user_defaults: { payout_preference: "KANG_WALLET", payout_channel: null },
            },
            null,
            2,
          )}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="preference" title="Update cash-out preference">
        <ApiEndpoint
          method="PATCH"
          endpoint="/v1/gateway/global-accounts/payout-preference"
          description="Set the user-level default (applies to every account) or a per-account override. Routing resolves account-override → user default → KANG_WALLET."
          requestBody={JSON.stringify(
            {
              scope: "user",
              payout_preference: "MOBILE_MONEY",
              payout_channel: "237677123456",
            },
            null,
            2,
          )}
          response={JSON.stringify({ ok: true, scope: "user" }, null, 2)}
          parameters={[
            { name: "scope", type: "enum(user|account)", required: true, description: "Where the preference applies" },
            { name: "payout_preference", type: "enum(KANG_WALLET|MOBILE_MONEY)", required: false, description: "Required when scope=user" },
            { name: "payout_channel", type: "string", required: false, description: "E.164 phone, required for MOBILE_MONEY" },
            { name: "account_id", type: "uuid", required: false, description: "Required when scope=account" },
            { name: "payout_preference_override", type: "enum|null", required: false, description: "null clears the override" },
            { name: "payout_channel_override", type: "string|null", required: false, description: "Per-account phone override" },
          ]}
        />
        <CodeBlock
          title="Per-account override"
          examples={[
            {
              language: "bash",
              label: "cURL",
              code: `curl -X PATCH https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/nium-update-payout-preference \\
  -H "Authorization: Bearer $ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '{"scope":"account","account_id":"f1d6...","payout_preference_override":"KANG_WALLET"}'`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="webhook" title="Incoming-payment webhook">
        <ApiEndpoint
          method="POST"
          endpoint="/v1/gateway/global-accounts/webhook"
          description="Nium → KOB. HMAC-SHA256 signed via header x-nium-signature (raw body). Idempotent on transactionId. You only consume this endpoint to ship your own observability — KOB persists, credits and routes automatically."
          requestBody={JSON.stringify(
            {
              eventType: "payment_incoming",
              transactionId: "NIUM_TX_001",
              accountId: "nium_acc_abc123",
              amount: 250.0,
              currency: "USD",
              senderName: "YouTube Adsense",
              reference: "Creator payout March 2026",
            },
            null,
            2,
          )}
          response={JSON.stringify({ ok: true, status: "credited", payment_id: "p_2026_03_001" }, null, 2)}
        />
        <CodeBlock
          title="Verify the signature"
          examples={[
            {
              language: "javascript",
              label: "Node.js",
              code: `import { GlobalAccountsResource } from '@kangopenbanking/sdk';

const ok = await GlobalAccountsResource.verifyWebhookSignature(
  rawBody,                            // exact bytes received
  req.headers['x-nium-signature'],
  process.env.NIUM_WEBHOOK_SECRET!,
);
if (!ok) return res.status(401).end();`,
            },
            {
              language: "python",
              label: "Python",
              code: `from kangopenbanking.global_accounts import GlobalAccountsResource

if not GlobalAccountsResource.verify_webhook_signature(
    raw_body, request.headers["x-nium-signature"], os.environ["NIUM_WEBHOOK_SECRET"]
):
    return Response(status=401)`,
            },
            {
              language: "php",
              label: "PHP",
              code: `use KangOpenBanking\\Resources\\GlobalAccountsResource;

if (!GlobalAccountsResource::verifyWebhookSignature(
    $rawBody, $request->header('x-nium-signature'), env('NIUM_WEBHOOK_SECRET')
)) {
    return response('', 401);
}`,
            },
          ]}
        />
      </GuideSectionBlock>

      <GuideSectionBlock id="math" title="Settlement math">
        <CodeBlock
          title="XAF settlement"
          examples={[
            {
              language: "text",
              label: "Formula",
              code: `xaf_gross          = source_amount * fx_rate_nium
xaf_spread_revenue = xaf_gross * (fx_spread_bps / 10000)        # platform revenue
xaf_after_spread   = xaf_gross - xaf_spread_revenue
xaf_withdrawal_fee = max(min_fee, fixed + xaf_after_spread*pct) # MOBILE_MONEY only
xaf_net_credited   = xaf_after_spread - xaf_withdrawal_fee`,
            },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          Defaults are editable in <strong>Admin → Fee Management</strong>:{" "}
          <code>nium_fx_spread</code> = 75 bps, <code>nium_withdrawal</code> = 1% + 100 XAF
          (min 200 XAF).
        </p>
      </GuideSectionBlock>
    </GuidePageShell>
  );
}
