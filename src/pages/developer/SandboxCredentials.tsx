import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const authExample = `# Authenticate with sandbox credentials
curl -X POST https://api.kangopenbanking.com/v1/auth/token \\
  -H "Content-Type: application/x-www-form-urlencoded" \\
  -d "grant_type=client_credentials" \\
  -d "client_id=pk_test_sandbox_KangOB2026Demo" \\
  -d "client_secret=sk_test_sandbox_KangOB2026Demo"`;

const nodeAuth = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

// Ready to make API calls
const accounts = await kob.accounts.list();`;

const pythonAuth = `from kangopenbanking import KangOpenBanking

kob = KangOpenBanking(
    api_key="sk_test_sandbox_KangOB2026Demo",
    environment="sandbox",
)

# Ready to make API calls
accounts = kob.accounts.list()`;

export default function SandboxCredentials() {
  return (
    <>
      <Helmet>
        <title>Sandbox Credentials | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Free sandbox credentials for the Kang Open Banking API. No signup required. Get your test API keys, merchant IDs, and start integrating immediately." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/sandbox/credentials" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Sandbox Credentials</h1>
          <p className="text-lg text-muted-foreground">
            Use these credentials immediately to start testing. No signup, no approval, no credit card.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="api-keys">API Keys</h2>
          <p className="text-muted-foreground mb-4">
            These keys are shared across all sandbox users. They provide full API access in the test environment.
          </p>
          <div className="mb-4 p-4 border border-primary/30 bg-muted/30 rounded-md">
            <p className="text-sm text-foreground">
              <strong>Need your own credentials?</strong> Sign in and visit{" "}
              <a href="/developer/sandbox" className="text-primary underline">/developer/sandbox</a>{" "}
              to provision a personalized credential set — your own <code className="font-mono text-xs">sk_test_…</code>,{" "}
              <code className="font-mono text-xs">pk_test_…</code>,{" "}
              <code className="font-mono text-xs">merchant UUID</code>, and{" "}
              <code className="font-mono text-xs">whsec_test_…</code>. The shared values below are for quick anonymous testing only.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Credential</th>
                  <th className="text-left p-3 font-medium text-foreground">Value</th>
                  <th className="text-left p-3 font-medium text-foreground">Usage</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Secret Key", "sk_test_sandbox_KangOB2026Demo", "Server-side API calls"],
                  ["Publishable Key", "pk_test_sandbox_KangOB2026Demo", "Client-side initialization"],
                  ["Merchant ID", "merch_test_001", "Charge and payout operations"],
                  ["Webhook Secret", "whsec_test_sandbox_KangOB2026Demo", "Webhook signature verification"],
                ].map(([cred, val, usage]) => (
                  <tr key={cred} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{cred}</td>
                    <td className="p-3 font-mono text-sm text-foreground break-all">{val}</td>
                    <td className="p-3 text-muted-foreground">{usage}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="base-urls">Base URLs</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Environment</th>
                  <th className="text-left p-3 font-medium text-foreground">Base URL</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Sandbox", "https://api.kangopenbanking.com/v1"],
                  ["Production", "https://api.kangopenbanking.com/v1"],
                ].map(([env, url]) => (
                  <tr key={env} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{env}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{url}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="authentication">Quick Authentication</h2>
          <p className="text-muted-foreground mb-4">
            Authenticate using client credentials to obtain a bearer token:
          </p>
          <CodeBlock examples={[
            { code: authExample, language: "bash", label: "cURL" },
            { code: nodeAuth, language: "javascript", label: "Node.js" },
            { code: pythonAuth, language: "python", label: "Python" },
          ]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="key-prefixes">Key Prefixes</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Prefix</th>
                  <th className="text-left p-3 font-medium text-foreground">Environment</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["sk_test_", "Sandbox", "Secret key"],
                  ["pk_test_", "Sandbox", "Publishable key"],
                  ["sk_live_", "Production", "Secret key"],
                  ["pk_live_", "Production", "Publishable key"],
                  ["whsec_test_", "Sandbox", "Webhook secret"],
                  ["whsec_live_", "Production", "Webhook secret"],
                ].map(([prefix, env, type]) => (
                  <tr key={prefix} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{prefix}</td>
                    <td className="p-3 text-muted-foreground">{env}</td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="rate-limits">Sandbox Limits</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Limit</th>
                  <th className="text-left p-3 font-medium text-foreground">Value</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Daily requests", "1,000"],
                  ["Rate limit", "60 requests/minute"],
                  ["Data reset", "Every 24 hours (or on demand)"],
                  ["Max payload", "1 MB"],
                  ["Concurrent connections", "10"],
                ].map(([limit, val]) => (
                  <tr key={limit} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{limit}</td>
                    <td className="p-3 text-muted-foreground">{val}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
