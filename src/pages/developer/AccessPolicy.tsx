import { Helmet } from "react-helmet-async";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function AccessPolicy() {
  return (
    <>
      <Helmet>
        <title>Developer Access Policy | Kang Open Banking</title>
        <meta name="description" content="Kang Open Banking's commitment to free, open developer access. Documentation, sandbox, API specs, and URL permanence guarantees." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/access-policy" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Developer Access Policy</h1>
          <p className="text-lg text-muted-foreground">
            Our commitment to developers building on the Kang Open Banking platform.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="docs-free">1. Documentation is Always Free</h2>
          <p className="text-muted-foreground">
            All documentation at kangopenbanking.com/developer is permanently free to read. No account required. No paywall. No email gate. A developer who has never heard of Kang can land on any documentation page and read it immediately.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="sandbox-free">2. Sandbox is Always Free</h2>
          <p className="text-muted-foreground mb-3">The sandbox environment is always available:</p>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li>Free tier: 1,000 requests/day</li>
            <li>No credit card required</li>
            <li>Never requires a paid subscription to access</li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="specs-downloadable">3. API Specifications Always Downloadable</h2>
          <p className="text-muted-foreground mb-3">The OpenAPI specification is always publicly downloadable:</p>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li><a href="https://kangopenbanking.com/openapi.json" className="text-primary hover:underline">https://kangopenbanking.com/openapi.json</a></li>
            <li><a href="https://kangopenbanking.com/openapi.yaml" className="text-primary hover:underline">https://kangopenbanking.com/openapi.yaml</a></li>
          </ul>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="urls-permanent">4. URLs Never Break</h2>
          <p className="text-muted-foreground">
            Once a documentation URL is published, it is permanent. If content moves, the old URL redirects (301) to the new location. No developer's bookmark will ever return a 404.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="breaking-changes">5. 30-Day Notice for Breaking Changes</h2>
          <p className="text-muted-foreground">
            Any breaking change to the API will be announced at least 30 days in advance via the changelog, status page, and email to registered developers.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="open-source">6. Open Source SDKs</h2>
          <p className="text-muted-foreground">
            All official SDKs are MIT-licensed and publicly available on GitHub at <a href="https://github.com/kangopenbanking" className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">github.com/kangopenbanking</a>.
          </p>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="standards">Standards We Follow</h2>
          <ul className="space-y-2 text-muted-foreground list-disc list-inside">
            <li>OpenAPI 3.1.0</li>
            <li>FAPI 1.0 Advanced Profile</li>
            <li>PSD2 (EU Payment Services Directive 2)</li>
            <li>OBIE R/W API v3.1</li>
            <li>ISO 20022</li>
            <li>RFC 7807 (Problem Details for HTTP APIs)</li>
            <li>COBAC/BEAC regulations for CEMAC region</li>
          </ul>
        </section>

        <p className="text-sm text-muted-foreground italic">Last updated: March 2026</p>

        <DocNavigation
          previousPage={{ title: "Developer Home", path: "/developer" }}
        />
      </div>
    </>
  );
}
