import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const deprecationHeaders = `HTTP/1.1 200 OK
Content-Type: application/json
Deprecation: true
Sunset: Sat, 01 Jan 2028 00:00:00 GMT
Link: <https://kangopenbanking.com/developer/migrate>; rel="successor-version"`;

const versionHeader = `# Check current API version in any response
curl -I https://api.kangopenbanking.com/v1/gateway-charges-router \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo"

# Response headers include:
# X-API-Version: 4.23.0
# X-Request-Id: req_a1b2c3d4`;

export default function ApiReferenceVersioning() {
  return (
    <>
      <Helmet>
        <title>API Versioning | Kang Open Banking Developer Docs</title>
        <meta name="description" content="API versioning policy for Kang Open Banking. URL-based versioning, backward compatibility, deprecation notices, and migration guides." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/api-reference/versioning" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">API Versioning</h1>
          <p className="text-lg text-muted-foreground">
            The Kang API uses URL-based versioning. The current production version is v1 (specification v4.23.0). We follow a strict zero-breaking-changes policy.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="scheme">Versioning Scheme</h2>
          <p className="text-muted-foreground mb-4">
            All API endpoints include the version in the URL path:
          </p>
          <CodeBlock examples={[{ code: "https://api.kangopenbanking.com/v1/gateway-charges-router", language: "text" }]} />
          <div className="overflow-x-auto mt-4">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Component</th>
                  <th className="text-left p-3 font-medium text-foreground">Format</th>
                  <th className="text-left p-3 font-medium text-foreground">Example</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["URL version", "v{major}", "v1"],
                  ["Spec version", "{major}.{minor}.{patch}", "4.6.0"],
                  ["SDK version", "{major}.{minor}.{patch}", "1.1.0"],
                ].map(([comp, fmt, ex]) => (
                  <tr key={comp} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{comp}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{fmt}</td>
                    <td className="p-3 font-mono text-sm text-foreground">{ex}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="compatibility">Backward Compatibility</h2>
          <p className="text-muted-foreground mb-4">
            The v1 API follows a strict additive-only policy:
          </p>
          <div className="space-y-3">
            {[
              ["No field removal", "Existing response fields are never removed"],
              ["No type changes", "Field types remain stable across all patch and minor versions"],
              ["Additive only", "New fields, endpoints, and events may be added at any time"],
              ["Webhook events", "New event types may be introduced. Handlers should ignore unknown types"],
              ["Error codes", "New error codes may be added. Clients should handle unknown codes gracefully"],
            ].map(([title, desc]) => (
              <div key={title} className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="lifecycle">Version Lifecycle</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Phase</th>
                  <th className="text-left p-3 font-medium text-foreground">Duration</th>
                  <th className="text-left p-3 font-medium text-foreground">Behavior</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Active", "Current", "Full support, new features added"],
                  ["Deprecated", "6 months notice", "Deprecation and Sunset headers added"],
                  ["Sunset", "After sunset date", "Returns 410 Gone"],
                ].map(([phase, duration, behavior]) => (
                  <tr key={phase} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{phase}</td>
                    <td className="p-3 text-muted-foreground">{duration}</td>
                    <td className="p-3 text-muted-foreground">{behavior}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="deprecation">Deprecation Headers</h2>
          <p className="text-muted-foreground mb-4">
            When an endpoint is deprecated, all responses include these headers:
          </p>
          <CodeBlock examples={[{ code: deprecationHeaders, language: "http" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="version-check">Check API Version</h2>
          <CodeBlock examples={[{ code: versionHeader, language: "bash", label: "cURL" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="deprecated-fields">
            Deprecated Fields &amp; Migration Map
          </h2>
          <p className="text-muted-foreground mb-4">
            The following fields are marked <code className="text-xs px-1 py-0.5 rounded bg-muted">deprecated: true</code> in the
            current OpenAPI specification (v4.28.0). They remain functional under our backward-compatibility
            promise and will only be removed in <strong>v5.0.0</strong>. Integrators should migrate to the
            replacement fields now to avoid a future breaking change. All replacement amount fields use
            <strong> minor-unit strings</strong> (e.g. <code className="text-xs px-1 py-0.5 rounded bg-muted">"500000"</code>
            = 5,000.00 XAF) to preserve precision per ISO 20022 guidance.
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Schema</th>
                  <th className="text-left p-3 font-medium text-foreground">Deprecated field</th>
                  <th className="text-left p-3 font-medium text-foreground">Replacement</th>
                  <th className="text-left p-3 font-medium text-foreground">Removed in</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["LoanScheduleItem", "principal (number)", "principal_amount (string, minor units)", "v5.0.0"],
                  ["LoanScheduleItem", "interest (number)", "interest_amount (string, minor units)", "v5.0.0"],
                  ["LoanScheduleItem", "fees (number)", "fees_amount (string, minor units)", "v5.0.0"],
                  ["LoanScheduleItem", "total_due (number)", "total_due_amount (string, minor units)", "v5.0.0"],
                  ["VirtualCard", "balance_usd (number)", "balance (string) + currency (ISO 4217)", "v5.0.0"],
                  ["Transaction", "AccountId (OBIE alias)", "account_id — or use TransactionOBIE schema", "v5.0.0"],
                  ["Transaction", "TransactionId (OBIE alias)", "transaction_id — or use TransactionOBIE", "v5.0.0"],
                  ["Transaction", "Amount / Currency (OBIE)", "amount / currency — or TransactionOBIE", "v5.0.0"],
                  ["Transaction", "CreditDebitIndicator (OBIE)", "type — or TransactionOBIE", "v5.0.0"],
                  ["Transaction", "BookingDateTime / ValueDateTime", "booking_date / value_date — or TransactionOBIE", "v5.0.0"],
                  ["Transaction", "TransactionInformation / Status (OBIE)", "description / status — or TransactionOBIE", "v5.0.0"],
                ].map(([schema, oldField, newField, removed]) => (
                  <tr key={`${schema}-${oldField}`} className="border-t border-border">
                    <td className="p-3 font-mono text-xs text-foreground">{schema}</td>
                    <td className="p-3 font-mono text-xs text-muted-foreground line-through">{oldField}</td>
                    <td className="p-3 font-mono text-xs text-foreground">{newField}</td>
                    <td className="p-3 text-xs text-foreground">{removed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-sm text-muted-foreground">
            OBIE consumers should adopt the dedicated <code className="text-xs px-1 py-0.5 rounded bg-muted">TransactionOBIE</code>
            {" "}schema, which preserves the Open Banking UK PascalCase contract without the deprecation warnings.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="sdks">SDK Versions</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">SDK</th>
                  <th className="text-left p-3 font-medium text-foreground">Version</th>
                  <th className="text-left p-3 font-medium text-foreground">Package</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Node.js", "1.1.0", "@kangopenbanking/sdk"],
                  ["Python", "1.1.0", "kangopenbanking"],
                  ["PHP", "1.1.0", "kangopenbanking/sdk-php"],
                  ["Java", "1.0.0", "com.kangopenbanking:sdk"],
                  ["Go", "1.0.0", "github.com/kangopenbanking/kob-go"],
                  ["Flutter/Dart", "1.0.0", "kangopenbanking"],
                ].map(([sdk, ver, pkg]) => (
                  <tr key={sdk} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{sdk}</td>
                    <td className="p-3 font-mono text-sm text-foreground">{ver}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{pkg}</td>
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
