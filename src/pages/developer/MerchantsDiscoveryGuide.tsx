import { ApiEndpoint } from "@/components/developer/ApiEndpoint";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Search, QrCode, ListChecks } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CodeBlock } from "@/components/developer/CodeBlock";

// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P4, P6, P9)
export default function MerchantsDiscoveryGuide() {
  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Search className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">KOB Merchants Discovery</h1>
          <Badge variant="outline" className="ml-2">Public · No Auth</Badge>
        </div>
        <p className="text-lg text-muted-foreground">
          Discover KYB-approved KOB merchants from any virtual-card or wallet app, then resolve a
          per-merchant EMVCo QR payload. Both endpoints are public, paginated, and CDN-cached for
          60 seconds.
        </p>
        <div className="flex gap-2 mt-4 flex-wrap">
          <Badge>GET</Badge>
          <Badge variant="secondary">Cursor Paginated</Badge>
          <Badge variant="secondary">EMVCo QR</Badge>
          <Badge variant="outline">XAF / Cameroon</Badge>
        </div>
      </div>

      <Separator />

      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-3">
          <ListChecks className="h-6 w-6" /> Endpoints at a Glance
        </h2>
        <Card className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Path</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Purpose</TableHead>
                <TableHead>Auth</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell className="font-mono text-sm">/v1/merchants-qr-directory</TableCell>
                <TableCell><Badge variant="outline">GET</Badge></TableCell>
                <TableCell>List active KOB merchants (cursor paginated)</TableCell>
                <TableCell>None</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="font-mono text-sm">/v1/merchants-qr-get</TableCell>
                <TableCell><Badge variant="outline">GET</Badge></TableCell>
                <TableCell>Generate static or dynamic EMVCo QR for one merchant</TableCell>
                <TableCell>None</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Configure Your Client</h2>
        <p className="text-muted-foreground mb-3">
          The most common integration error is hitting the gateway base with no path, which returns
          <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-sm">Requested function was not found</code>.
          Set both the base URL and the merchants path explicitly.
        </p>
        <CodeBlock
          language="bash"
          code={`# Required environment variables for any KOB virtual-card client
KOB_API_BASE_URL=https://api.kangopenbanking.com/v1
KOB_MERCHANTS_PATH=/merchants-qr-directory
KOB_MERCHANT_QR_PATH=/merchants-qr-get`}
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-3">
          <Search className="h-6 w-6" /> List Merchants
        </h2>
        <ApiEndpoint
          method="GET"
          endpoint="/v1/merchants-qr-directory"
          description="Returns the active KOB merchant directory. Cursor paginated (max 100 per page). Cached for 60 seconds at the edge."
          parameters={[
            { name: "limit", type: "integer", required: false, description: "Page size, 1–100. Default 25." },
            { name: "cursor", type: "string", required: false, description: "Last merchant_id from the previous page (next_cursor)." },
            { name: "country", type: "string", required: false, description: "ISO-3166 alpha-2 filter, e.g. CM." },
            { name: "category", type: "string", required: false, description: "MCC code filter, e.g. 5411 for grocery stores." },
          ]}
          response={`{
  "object": "list",
  "data": [
    {
      "merchant_id": "8f5c1a52-...-a1b2",
      "name": "Marché Central",
      "environment": "production",
      "status": "active",
      "mcc": "5411",
      "country": "CM",
      "logo_url": "https://...",
      "verified": true,
      "created_at": "2026-04-12T08:31:00Z"
    }
  ],
  "has_more": true,
  "next_cursor": "8f5c1a52-...-a1b2"
}`}
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold flex items-center gap-2 mb-3">
          <QrCode className="h-6 w-6" /> Get Merchant QR
        </h2>
        <ApiEndpoint
          method="GET"
          endpoint="/v1/merchants-qr-get"
          description="Returns an EMVCo-compliant QR payload for a single merchant. Omit amount for a static (reusable) QR; pass amount + ref for a dynamic (one-shot) QR."
          parameters={[
            { name: "id", type: "string (uuid)", required: true, description: "merchant_id from the directory." },
            { name: "amount", type: "string (minor units)", required: false, description: "Zero-decimal for XAF/XOF. Makes the QR dynamic." },
            { name: "ref", type: "string", required: false, description: "Merchant reference / order id echoed in the EMVCo Tag 62." },
          ]}
          response={`{
  "merchant_id": "8f5c1a52-...-a1b2",
  "qr_kind": "dynamic",
  "amount": "1500",
  "currency": "XAF",
  "emvco_payload": "00020101021238...6304ABCD",
  "expires_at": "2026-05-06T01:30:00Z"
}`}
        />
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Full Pagination Example</h2>
        <CodeBlock
          language="bash"
          code={`curl "https://api.kangopenbanking.com/v1/merchants-qr-directory?limit=100&country=CM"`}
        />
        <div className="mt-4">
          <CodeBlock
            language="javascript"
            code={`async function fetchAllMerchants() {
  const out = [];
  let cursor = null;
  do {
    const url = new URL("https://api.kangopenbanking.com/v1/merchants-qr-directory");
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url);
    if (!res.ok) throw new Error(\`directory_\${res.status}\`);
    const page = await res.json();
    out.push(...page.data);
    cursor = page.has_more ? page.next_cursor : null;
  } while (cursor && out.length < 1000);
  return out;
}`}
          />
        </div>
        <div className="mt-4">
          <CodeBlock
            language="python"
            code={`import requests

def fetch_all_merchants(country="CM"):
    url = "https://api.kangopenbanking.com/v1/merchants-qr-directory"
    out, cursor = [], None
    while True:
        params = {"limit": 100, "country": country}
        if cursor:
            params["cursor"] = cursor
        page = requests.get(url, params=params, timeout=15).json()
        out.extend(page.get("data", []))
        if not page.get("has_more"):
            break
        cursor = page.get("next_cursor")
    return out`}
          />
        </div>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Typed SDK Helpers</h2>
        <Card className="p-6 space-y-4">
          <div>
            <p className="font-semibold mb-2">Node</p>
            <CodeBlock language="javascript" code={`import { qr } from "@kangopenbanking/sdk-node";
const merchants = await qr.directory.list({ country: "CM" });
const byId = await qr.directory.byId();
const payload = await qr.merchant.get("8f5c1a52-...-a1b2", { amount: "1500", ref: "ORDER-42" });`} />
          </div>
          <div>
            <p className="font-semibold mb-2">Python</p>
            <CodeBlock language="python" code={`from kangopenbanking import qr

merchants = qr.directory.list(country="CM")
payload = qr.merchant.get("8f5c1a52-...-a1b2", amount="1500", ref="ORDER-42")`} />
          </div>
          <div>
            <p className="font-semibold mb-2">PHP</p>
            <CodeBlock language="php" code={`use KangOpenBanking\\Resources\\QRDirectoryResource;

$qr = new QRDirectoryResource();
$merchants = $qr->list('CM');
$payload   = $qr->getMerchantQr('8f5c1a52-...-a1b2', '1500', 'ORDER-42');`} />
          </div>
          <p className="text-sm text-muted-foreground">
            All SDK helpers wrap cursor pagination and cache the directory in-process for 5 minutes,
            so you can call <code className="px-1 rounded bg-muted">directory.list()</code> on every QR scan
            without rate-limit risk.
          </p>
        </Card>
      </section>

      <section>
        <h2 className="text-2xl font-bold mb-3">Common Errors</h2>
        <Card className="p-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>HTTP</TableHead>
                <TableHead>Body</TableHead>
                <TableHead>Cause</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell>404</TableCell>
                <TableCell className="font-mono text-xs">Requested function was not found</TableCell>
                <TableCell>Missing path segment. You called <code className="px-1 rounded bg-muted">/v1</code> instead of <code className="px-1 rounded bg-muted">/v1/merchants-qr-directory</code>.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>400</TableCell>
                <TableCell className="font-mono text-xs">{`{ "error": "invalid_country" }`}</TableCell>
                <TableCell><code className="px-1 rounded bg-muted">country</code> must be ISO-3166 alpha-2 uppercase.</TableCell>
              </TableRow>
              <TableRow>
                <TableCell>400</TableCell>
                <TableCell className="font-mono text-xs">{`{ "error": "invalid_cursor" }`}</TableCell>
                <TableCell>Cursor must be a UUID returned in <code className="px-1 rounded bg-muted">next_cursor</code>.</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
