import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const registerCurl = `# Register your own MTN MoMo credentials
curl -X POST https://api.kangopenbanking.com/v1/tenant-connectors-manage \\
  -H "Authorization: Bearer <YOUR_USER_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create",
    "owner_type": "developer",
    "owner_id": "<YOUR_USER_ID>",
    "connector_id": "mtn_momo",
    "environment": "sandbox",
    "country": "CM",
    "priority": 10,
    "credentials": {
      "subscription_key": "your-ocp-apim-subscription-key",
      "api_user": "00000000-0000-0000-0000-000000000000",
      "api_key": "your-mtn-api-key",
      "target_environment": "sandbox"
    }
  }'`;

const chargeCurl = `# Charge using your own connector (with Flutterwave fallback)
curl -X POST https://api.kangopenbanking.com/v1/payment-router-charge \\
  -H "Authorization: Bearer <YOUR_USER_JWT>" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -d '{
    "owner_type": "developer",
    "owner_id": "<YOUR_USER_ID>",
    "amount": 5000,
    "currency": "XAF",
    "phone_number": "+237650000000",
    "reference": "order_12345",
    "country": "CM",
    "description": "Order #12345"
  }'`;

const chargeNode = `import { createClient } from '@supabase/supabase-js';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
await supabase.auth.signInWithPassword({ email, password });

const { data, error } = await supabase.functions.invoke('payment-router-charge', {
  body: {
    owner_type: 'developer',
    owner_id: userId,
    amount: 5000,
    currency: 'XAF',
    phone_number: '+237650000000',
    reference: 'order_12345',
    country: 'CM',
  },
});

console.log(data.connector_used);   // 'mtn_momo' or 'flutterwave_platform'
console.log(data.provider_reference);
console.log(data.attempts);          // full audit of every rail tried`;

const chargePython = `import os, requests, uuid

resp = requests.post(
  "https://api.kangopenbanking.com/v1/payment-router-charge",
  headers={
    "Authorization": f"Bearer {USER_JWT}",
    "Idempotency-Key": str(uuid.uuid4()),
  },
  json={
    "owner_type": "developer",
    "owner_id": USER_ID,
    "amount": 5000,
    "currency": "XAF",
    "phone_number": "+237650000000",
    "reference": "order_12345",
    "country": "CM",
  },
)
print(resp.json())`;

export default function ByoMobileMoneyGuide() {
  return (
    <>
      <Helmet>
        <title>Bring Your Own Mobile Money Connector | Kang Open Banking</title>
        <meta
          name="description"
          content="Connect your own MTN MoMo or Orange Money API credentials to KOB. Flutterwave remains the default and fallback rail."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/connectors/byo-mobile-money" />
      </Helmet>

      <div className="container max-w-5xl mx-auto py-8 px-4">
        <div className="mb-8">
          <p className="text-sm text-muted-foreground mb-2">Connectors</p>
          <h1 className="text-3xl font-bold tracking-tight">Bring Your Own Mobile Money Connector</h1>
          <p className="text-muted-foreground mt-2 max-w-3xl">
            Flutterwave remains KOB's default mobile-money middleware for everyone. If your institution, business,
            or developer account has its own MTN MoMo or Orange Money credentials, you can register them and route
            charges through your own rail — with automatic Flutterwave fallback if your rail fails.
          </p>
        </div>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold">When to use BYO connectors</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>You hold a direct merchant agreement with MTN or Orange and want settlements to land in your own provider account.</li>
            <li>You need lower per-transaction fees than the platform-managed Flutterwave rail.</li>
            <li>You operate in a corridor where the platform default does not yet cover your country.</li>
          </ul>
          <p className="text-sm">
            If none of the above apply, do nothing — every account already routes mobile-money charges through the KOB-managed Flutterwave middleware by default.
          </p>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold">Routing model</h2>
          <div className="rounded-lg border border-border/60 p-4 bg-muted/30">
            <pre className="text-xs font-mono whitespace-pre overflow-x-auto">{`Caller (institution / business / developer)
  ↓
mobile-money-charge   (UNCHANGED — default Flutterwave path)
  ↓   opt-in: payment-router-charge
payment-router-charge (NEW)
  ↓
  ├─ tenant connectors (priority order)
  │     MTN MoMo → Orange Money → tenant-Flutterwave
  ↓   on every failure
  └─ KOB-managed Flutterwave (fallback, never silent)`}</pre>
          </div>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>Existing <code className="px-1 py-0.5 rounded bg-muted text-xs">mobile-money-charge</code> is never modified — current callers see zero behavior change.</li>
            <li>The new <code className="px-1 py-0.5 rounded bg-muted text-xs">payment-router-charge</code> endpoint is purely opt-in.</li>
            <li>Every attempt (success or failure) is returned in the <code className="px-1 py-0.5 rounded bg-muted text-xs">attempts</code> array for full traceability.</li>
          </ul>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold">1. Register your credentials</h2>
          <p className="text-sm text-muted-foreground">
            Credentials are encrypted at rest with AES-GCM and never returned through any read API.
            You can also use the Payment Connectors panel in your dashboard.
          </p>
          <CodeBlock examples={[{ code: registerCurl, language: "bash" }]} title="Register MTN MoMo credentials (cURL)" />
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold">2. Charge through the router</h2>
          <CodeBlock
            examples={[
              { code: chargeCurl, language: "bash", label: "cURL" },
              { code: chargeNode, language: "typescript", label: "Node.js" },
              { code: chargePython, language: "python", label: "Python" },
            ]}
            title="Initiate a charge"
          />
          <div className="rounded-lg border border-border/60 p-4">
            <p className="text-sm font-semibold mb-2">Required fields per provider</p>
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border/60">
                  <th className="text-left p-2">Provider</th>
                  <th className="text-left p-2">Required credential fields</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/60">
                  <td className="p-2 font-mono">mtn_momo</td>
                  <td className="p-2">subscription_key, api_user, api_key, target_environment</td>
                </tr>
                <tr className="border-b border-border/60">
                  <td className="p-2 font-mono">orange_money</td>
                  <td className="p-2">client_id, client_secret, merchant_key</td>
                </tr>
                <tr>
                  <td className="p-2 font-mono">flutterwave</td>
                  <td className="p-2">secret_key</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="space-y-4 mb-10">
          <h2 className="text-xl font-semibold">Security model</h2>
          <ul className="list-disc pl-6 space-y-1.5 text-sm text-muted-foreground">
            <li>Credentials are encrypted at rest using AES-GCM with the platform encryption key.</li>
            <li>Row-level security ensures only the storing tenant (and platform admins for support) can mutate credentials.</li>
            <li>All connector calls are server-mediated through edge functions — credentials never reach the browser.</li>
            <li>Every create / update / delete is recorded in the audit log.</li>
            <li>Health checks that fail repeatedly will surface in the dashboard so you can rotate keys.</li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
