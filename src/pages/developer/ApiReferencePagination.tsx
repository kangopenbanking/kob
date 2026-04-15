import { Helmet } from "react-helmet-async";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

const cursorExample = `# First page
curl https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router?action=list_charges&limit=20 \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo"

# Next page using cursor
curl "https://wdzkzeahdtxlynetndqw.supabase.co/functions/v1/gateway-charges-router?action=list_charges&limit=20&cursor=eyJpZCI6IjEyMyJ9" \\
  -H "Authorization: Bearer sk_test_sandbox_KangOB2026Demo"`;

const responseExample = `{
  "data": [
    { "id": "ch_001", "amount": 5000, "currency": "XAF", "status": "successful" },
    { "id": "ch_002", "amount": 3000, "currency": "XAF", "status": "pending" }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1542,
    "has_next": true,
    "next_cursor": "eyJpZCI6IjEyMyJ9"
  },
  "meta": {
    "request_id": "req_a1b2c3d4",
    "timestamp": "2026-03-27T14:32:00Z"
  }
}`;

const nodeIterator = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({
  apiKey: 'sk_test_sandbox_KangOB2026Demo',
  environment: 'sandbox',
});

// Auto-paginate through all charges
for await (const charge of kob.charges.list({ limit: 100 })) {
  console.log(charge.id, charge.amount);
}

// Or fetch a single page
const page = await kob.charges.list({ limit: 20 });
console.log(page.data);        // Array of charges
console.log(page.has_next);    // true/false
console.log(page.next_cursor); // cursor for next page`;

export default function ApiReferencePagination() {
  return (
    <>
      <Helmet>
        <title>Pagination | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Cursor-based pagination for the Kang Open Banking API. Learn how to paginate through large result sets efficiently." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/api-reference/pagination" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Pagination</h1>
          <p className="text-lg text-muted-foreground">
            All list endpoints return paginated results using cursor-based pagination. This approach is more reliable than offset-based pagination for large, frequently-updated datasets.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="parameters">Query Parameters</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Parameter</th>
                  <th className="text-left p-3 font-medium text-foreground">Type</th>
                  <th className="text-left p-3 font-medium text-foreground">Default</th>
                  <th className="text-left p-3 font-medium text-foreground">Description</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["limit", "integer", "20", "Number of results per page (1-100)"],
                  ["cursor", "string", "null", "Cursor from previous response for next page"],
                  ["sort", "string", "created_at:desc", "Sort field and direction"],
                  ["created_after", "ISO 8601", "null", "Filter results created after this date"],
                  ["created_before", "ISO 8601", "null", "Filter results created before this date"],
                ].map(([param, type, def, desc]) => (
                  <tr key={param} className="border-t border-border">
                    <td className="p-3 font-mono text-sm text-foreground">{param}</td>
                    <td className="p-3 text-muted-foreground">{type}</td>
                    <td className="p-3 font-mono text-sm text-muted-foreground">{def}</td>
                    <td className="p-3 text-muted-foreground">{desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="example">Example Request</h2>
          <CodeBlock examples={[{ code: cursorExample, language: "bash", label: "cURL" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="response">Response Envelope</h2>
          <CodeBlock examples={[{ code: responseExample, language: "json" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="sdk">SDK Auto-Pagination</h2>
          <p className="text-muted-foreground mb-4">
            The official SDKs support async iteration to auto-paginate through all results:
          </p>
          <CodeBlock examples={[{ code: nodeIterator, language: "javascript", label: "Node.js" }]} />
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="best-practices">Best Practices</h2>
          <div className="space-y-3">
            {[
              ["Use cursors, not offsets", "Cursors are stable even when new records are inserted between requests."],
              ["Set a reasonable limit", "Use 50-100 for batch processing, 20 for user-facing lists."],
              ["Check has_next", "Stop paginating when has_next is false, not when data is empty."],
              ["Store cursors server-side", "If building a paginated UI, store the cursor for the current page on your server."],
            ].map(([title, desc]) => (
              <div key={title} className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-1">{title}</h3>
                <p className="text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        <AutoDocNavigation />
      </div>
    </>
  );
}
