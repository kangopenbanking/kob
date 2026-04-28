import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBlock } from "@/components/developer/CodeBlock";
import { ArrowLeftRight, Info } from "lucide-react";

const FIRST_PAGE_CURL = `# First page (forward, newest first)
curl "https://api.kangopenbanking.com/v1/aisp/accounts/{accountId}/transactions?limit=20" \\
  -H "Authorization: Bearer $KOB_SECRET_KEY"`;

const NEXT_PAGE_CURL = `# Next page — pass the previous response's X-Pagination-Next-Cursor
curl "https://api.kangopenbanking.com/v1/aisp/accounts/{accountId}/transactions?limit=20&starting_after=txn_K9d3z2" \\
  -H "Authorization: Bearer $KOB_SECRET_KEY"`;

const PREV_PAGE_CURL = `# Previous page (backward) — pass the previous response's X-Pagination-Prev-Cursor
curl "https://api.kangopenbanking.com/v1/aisp/accounts/{accountId}/transactions?limit=20&ending_before=txn_K9d3z2" \\
  -H "Authorization: Bearer $KOB_SECRET_KEY"`;

const RESPONSE_HEADERS = `HTTP/1.1 200 OK
Content-Type: application/json
X-Pagination-Mode: cursor
X-Pagination-Has-More: true
X-Pagination-Next-Cursor: txn_K9d3z2
X-Pagination-Prev-Cursor: txn_A1b2c3
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 974`;

const RESPONSE_BODY = `{
  "data": [
    { "id": "txn_A1b2c3", "amount": 5000, "currency": "XAF", "created": 1714329600 },
    { "id": "txn_K9d3z2", "amount": 1200, "currency": "XAF", "created": 1714329540 }
  ],
  "pagination": {
    "mode": "cursor",
    "limit": 20,
    "has_more": true,
    "next_cursor": "txn_K9d3z2",
    "prev_cursor": "txn_A1b2c3"
  }
}`;

const NODE_LOOP = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({ apiKey: process.env.KOB_SECRET_KEY!, environment: 'sandbox' });

let cursor: string | undefined;
do {
  const page = await kob.aisp.transactions.list({
    accountId: 'acc_123',
    limit: 50,
    starting_after: cursor,
  });
  for (const tx of page.data) console.log(tx.id, tx.amount);
  cursor = page.pagination.has_more ? page.pagination.next_cursor : undefined;
} while (cursor);`;

const PYTHON_LOOP = `from kangopenbanking import KangOpenBanking
import os

kob = KangOpenBanking(api_key=os.environ["KOB_SECRET_KEY"], environment="sandbox")

cursor = None
while True:
    page = kob.aisp.transactions.list(
        account_id="acc_123",
        limit=50,
        starting_after=cursor,
    )
    for tx in page.data:
        print(tx.id, tx.amount)
    if not page.pagination.has_more:
        break
    cursor = page.pagination.next_cursor`;

const RAW_FETCH = `// Manual cursor pagination using fetch
async function* listTransactions(accountId: string) {
  let cursor: string | undefined;
  while (true) {
    const url = new URL(\`https://api.kangopenbanking.com/v1/aisp/accounts/\${accountId}/transactions\`);
    url.searchParams.set("limit", "50");
    if (cursor) url.searchParams.set("starting_after", cursor);

    const res = await fetch(url, { headers: { Authorization: \`Bearer \${process.env.KOB_SECRET_KEY}\` } });
    const json = await res.json();
    for (const tx of json.data) yield tx;

    // Mapping: response cursor metadata → next request param
    const next = res.headers.get("X-Pagination-Next-Cursor") ?? json.pagination.next_cursor;
    if (!json.pagination.has_more || !next) return;
    cursor = next;
  }
}`;

const LEGACY_OFFSET = `# Legacy offset pagination (still supported for backward compatibility)
curl "https://api.kangopenbanking.com/v1/aisp/accounts/{accountId}/transactions?limit=20&offset=40" \\
  -H "Authorization: Bearer $KOB_SECRET_KEY"`;

export default function PaginationExamples() {
  return (
    <>
      <Helmet>
        <title>Pagination Examples (starting_after / ending_before) — Kang Open Banking</title>
        <meta name="description" content="Copy-paste cursor pagination examples for the Kang Open Banking API, including starting_after / ending_before, response headers, and SDK iterators." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/guides/pagination-examples" />
      </Helmet>

      <div className="max-w-5xl mx-auto p-6 space-y-6" data-testid="pagination-examples-page">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <ArrowLeftRight className="h-7 w-7" /> Cursor Pagination — Copy-Paste Examples
          </h1>
          <p className="text-muted-foreground mt-2">
            Recommended approach for all list endpoints. Cursor pagination is stable across inserts and deletes, unlike offset.
          </p>
        </div>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Cursor metadata mapping</AlertTitle>
          <AlertDescription>
            The server returns cursors in both response headers and the JSON body. Pass <code className="font-mono text-xs">next_cursor</code> as <code className="font-mono text-xs">starting_after</code> for the next page, and <code className="font-mono text-xs">prev_cursor</code> as <code className="font-mono text-xs">ending_before</code> to go back.
          </AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request → response → next request</CardTitle>
            <CardDescription>How cursor metadata flows from one call to the next.</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Response field / header</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Next request parameter</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow><TableCell className="font-mono text-xs">pagination.next_cursor</TableCell><TableCell>Forward (newer → older)</TableCell><TableCell className="font-mono text-xs">?starting_after=…</TableCell></TableRow>
                <TableRow><TableCell className="font-mono text-xs">pagination.prev_cursor</TableCell><TableCell>Backward (older → newer)</TableCell><TableCell className="font-mono text-xs">?ending_before=…</TableCell></TableRow>
                <TableRow><TableCell className="font-mono text-xs">X-Pagination-Next-Cursor</TableCell><TableCell>Forward</TableCell><TableCell className="font-mono text-xs">?starting_after=…</TableCell></TableRow>
                <TableRow><TableCell className="font-mono text-xs">X-Pagination-Has-More</TableCell><TableCell>Stop signal</TableCell><TableCell>Stop when <code className="font-mono text-xs">false</code></TableCell></TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">cURL — first / next / previous</CardTitle>
          </CardHeader>
          <CardContent>
            <CodeBlock examples={[
              { language: "bash", label: "First page", code: FIRST_PAGE_CURL },
              { language: "bash", label: "Next page (starting_after)", code: NEXT_PAGE_CURL },
              { language: "bash", label: "Previous page (ending_before)", code: PREV_PAGE_CURL },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Response shape</CardTitle>
            <CardDescription>Headers and body returned by every paginated endpoint.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock examples={[
              { language: "http", label: "Response headers", code: RESPONSE_HEADERS },
              { language: "json", label: "Response body", code: RESPONSE_BODY },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Full pagination loop</CardTitle>
            <CardDescription>Walk every page using the cursor metadata.</CardDescription>
          </CardHeader>
          <CardContent>
            <CodeBlock examples={[
              { language: "typescript", label: "Node.js (SDK iterator)", code: NODE_LOOP },
              { language: "python", label: "Python (SDK iterator)", code: PYTHON_LOOP },
              { language: "typescript", label: "Raw fetch (no SDK)", code: RAW_FETCH },
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Legacy offset (backward compatibility)</CardTitle>
            <CardDescription>Still supported but not recommended for production.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <CodeBlock examples={[{ language: "bash", label: "Offset", code: LEGACY_OFFSET }]} />
            <p className="text-xs text-muted-foreground">
              Offset pagination can skip or duplicate rows when records are inserted between requests. Use cursor pagination for any data set that may change.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
