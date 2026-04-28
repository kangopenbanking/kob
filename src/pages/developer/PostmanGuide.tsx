import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { PostmanExportButton } from "@/components/developer/PostmanExportButton";

export default function PostmanGuide() {
  return (
    <>
      <Helmet>
        <title>Postman Collection | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Import the Kang Open Banking API Postman collection. Pre-configured environments for sandbox and production with all 339 endpoints." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/postman" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Postman Collection</h1>
          <p className="text-lg text-muted-foreground">
            Explore the Kang Open Banking API with our official Postman collection. All 339 endpoints, pre-configured environments, and example request bodies.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="download">Download</h2>
          <div className="mb-4">
            <PostmanExportButton variant="default" size="default" className="w-full sm:w-auto" />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <a href="/functions/v1/postman-collection" target="_blank" rel="noopener noreferrer" className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors text-center">
              <h3 className="font-semibold text-foreground mb-1">Download Collection JSON</h3>
              <p className="text-sm text-muted-foreground">Postman Collection v2.1 format</p>
            </a>
            <a href="https://www.postman.com/kangopenbanking" target="_blank" rel="noopener noreferrer" className="block border border-border rounded-lg p-4 hover:border-primary/50 transition-colors text-center">
              <h3 className="font-semibold text-foreground mb-1">Run in Postman</h3>
              <p className="text-sm text-muted-foreground">One-click import to your workspace</p>
            </a>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="setup">Setup</h2>
          <ol className="space-y-4 text-muted-foreground list-decimal list-inside">
            <li>Import the collection JSON into Postman</li>
            <li>Create a new Environment with these variables:
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm border border-border rounded-lg">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium text-foreground">Variable</th>
                      <th className="text-left p-3 font-medium text-foreground">Sandbox Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      ["base_url", "https://api.kangopenbanking.com/v1"],
                      ["secret_key", "sk_test_sandbox_KangOB2026Demo"],
                      ["merchant_id", "merch_test_001"],
                    ].map(([v, val]) => (
                      <tr key={v} className="border-t border-border">
                        <td className="p-3 font-mono text-sm text-foreground">{v}</td>
                        <td className="p-3 font-mono text-sm text-muted-foreground">{val}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </li>
            <li>Select the environment and start making requests</li>
          </ol>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="generate">Generate from OpenAPI</h2>
          <CodeBlock examples={[{ code: `# Import OpenAPI spec directly into Postman
# File → Import → Link → paste:
https://kangopenbanking.com/openapi.json

# Or generate via CLI
npx openapi-to-postmanv2 -s https://kangopenbanking.com/openapi.json -o kang-collection.json`, language: "bash" }]} title="Import from OpenAPI" />
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
