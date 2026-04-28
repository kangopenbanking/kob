import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const rotateExample = `# Rotate your API key (old key remains valid for 24 hours)
curl -X POST https://api.kangopenbanking.com/v1/api-keys/rotate \\
  -H "Authorization: Bearer sk_live_current_key" \\
  -H "Content-Type: application/json" \\
  -d '{"reason": "scheduled_rotation"}'

# Response
{
  "data": {
    "new_key": "sk_live_new_key_here",
    "old_key_expires_at": "2026-03-28T14:32:00Z",
    "rotated_at": "2026-03-27T14:32:00Z"
  }
}`;

const restrictedExample = `# Create a restricted key with specific scopes
curl -X POST https://api.kangopenbanking.com/v1/api-keys \\
  -H "Authorization: Bearer sk_live_master_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "payment-service",
    "scopes": ["charges:write", "charges:read", "webhooks:read"],
    "allowed_ips": ["10.0.1.0/24"],
    "expires_in_days": 90
  }'`;

export default function AuthApiKeys() {
  return (
    <>
      <Helmet>
        <title>API Keys | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Manage API keys for the Kang Open Banking API. Learn about key types, rotation, restricted keys, and IP allowlisting." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/authentication/api-keys" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">API Keys</h1>
          <p className="text-lg text-muted-foreground">
            API keys authenticate your server-side requests to the Kang Open Banking API. This guide covers key types, rotation, restricted keys, and security best practices.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="key-types">Key Types</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Key</th>
                  <th className="text-left p-3 font-medium text-foreground">Prefix</th>
                  <th className="text-left p-3 font-medium text-foreground">Environment</th>
                  <th className="text-left p-3 font-medium text-foreground">Capabilities</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Publishable", "pk_test_ / pk_live_", "Both", "Tokenize cards, initialize checkout"],
                  ["Secret", "sk_test_ / sk_live_", "Both", "Full API access — charges, payouts, refunds"],
                  ["Restricted", "rk_test_ / rk_live_", "Both", "Scoped to specific permissions"],
                ].map(([key, prefix, env, caps]) => (
                  <tr key={key} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{key}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{prefix}</td>
                    <td className="p-3 text-muted-foreground">{env}</td>
                    <td className="p-3 text-muted-foreground">{caps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="rotation">Key Rotation</h2>
          <p className="text-muted-foreground mb-4">
            Rotate keys periodically or immediately if compromised. The old key remains valid for 24 hours to allow zero-downtime migration.
          </p>
          <CodeBlock examples={[{ code: rotateExample, language: "bash" }]} title="Rotate API Key" />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="restricted-keys">Restricted Keys</h2>
          <p className="text-muted-foreground mb-4">
            For microservice architectures, create restricted keys with specific scopes and IP allowlists.
          </p>
          <CodeBlock examples={[{ code: restrictedExample, language: "bash" }]} title="Create Restricted Key" />

          <h3 className="text-lg font-semibold text-foreground mt-6 mb-3" id="available-scopes">Available Scopes</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Scope</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["charges:read", "Read charge status and details"],
                  ["charges:write", "Create and capture charges"],
                  ["payouts:read", "Read payout status"],
                  ["payouts:write", "Initiate payouts"],
                  ["refunds:write", "Issue refunds"],
                  ["webhooks:read", "List webhook endpoints and events"],
                  ["webhooks:write", "Create/update webhook endpoints"],
                  ["merchants:read", "Read merchant profile"],
                  ["subscriptions:write", "Create and manage subscriptions"],
                ].map(([scope, desc]) => (
                  <tr key={scope} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{scope}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="best-practices">Best Practices</h2>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li>Store secret keys in environment variables, never in source code</li>
            <li>Use restricted keys for each microservice with minimum required scopes</li>
            <li>Set IP allowlists for production keys</li>
            <li>Rotate keys every 90 days as a baseline policy</li>
            <li>Monitor key usage via the Dashboard for anomalous activity</li>
            <li>Revoke compromised keys immediately — do not wait for rotation</li>
          </ul>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
