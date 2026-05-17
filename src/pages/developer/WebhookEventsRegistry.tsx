// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P4, P6)
// Public registry of every webhook event KOB emits. Sourced from the SSOT
// in src/lib/webhook-event-schemas.ts so it never drifts from the spec.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { WEBHOOK_EVENT_SCHEMAS } from "@/lib/webhook-event-schemas";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CANONICAL = "https://kangopenbanking.com/developer/webhooks/events";

function categoryOf(eventType: string): string {
  const [head] = eventType.split(".");
  return head;
}

export default function WebhookEventsRegistry() {
  const events = Object.keys(WEBHOOK_EVENT_SCHEMAS).sort();
  const grouped = events.reduce<Record<string, string[]>>((acc, e) => {
    const k = categoryOf(e);
    (acc[k] ??= []).push(e);
    return acc;
  }, {});

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Developer", item: "https://kangopenbanking.com/developer" },
      { "@type": "ListItem", position: 2, name: "Webhooks", item: "https://kangopenbanking.com/developer/gateway/webhooks" },
      { "@type": "ListItem", position: 3, name: "Event Registry", item: CANONICAL },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <Helmet>
        <title>Webhook Event Registry — Kang Open Banking</title>
        <meta
          name="description"
          content="Canonical list of every webhook event Kang Open Banking emits, including envelope, required fields, and category."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Webhook Event Registry — Kang Open Banking" />
        <meta
          property="og:description"
          content="Every webhook event KOB emits, sourced from the live event-schema SSOT."
        />
        <meta property="og:image" content="https://kangopenbanking.com/images/og-gateway-webhooks.png" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://kangopenbanking.com/images/og-gateway-webhooks.png" />
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      </Helmet>

      <header className="mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link to="/developer" className="hover:underline">Developer</Link>
          <span className="mx-2">/</span>
          <Link to="/developer/gateway/webhooks" className="hover:underline">Webhooks</Link>
          <span className="mx-2">/</span>
          <span>Event Registry</span>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Webhook Event Registry</h1>
        <p className="text-muted-foreground max-w-3xl">
          The canonical, machine-verified list of every webhook event Kang Open Banking emits.
          Each entry mirrors the live schema in <code>src/lib/webhook-event-schemas.ts</code> and the
          corresponding component in <code>openapi.json</code>. Use this page to discover events,
          confirm payload shape, and wire up handlers.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{events.length} events</Badge>
          <Badge variant="outline">{Object.keys(grouped).length} categories</Badge>
          <Badge variant="outline">HMAC-SHA256 signed</Badge>
          <Badge variant="outline">7-attempt retry + DLQ</Badge>
        </div>
      </header>

      <Card className="mb-8 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Envelope</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Every event shares the same envelope. Only the <code>data</code> shape varies by event type.
          </p>
          <pre className="rounded-md bg-muted/60 p-4 text-xs overflow-x-auto">
{`{
  "id": "evt_...",          // unique event ID — use for deduplication
  "type": "charge.succeeded",
  "created": 1715900000,    // unix seconds
  "data": { /* event-specific payload */ }
}`}
          </pre>
          <p className="text-sm text-muted-foreground mt-3">
            Delivery headers: <code>X-Webhook-Signature</code>, <code>X-Webhook-Event</code>,
            <code> X-Webhook-ID</code>, <code>X-Webhook-Replay</code>,
            <code> X-Webhook-Replay-Of</code>, <code>X-Circuit-State</code>.
          </p>
        </CardContent>
      </Card>

      {Object.entries(grouped).map(([category, items]) => (
        <Card key={category} className="mb-6 border-border/60">
          <CardHeader>
            <CardTitle className="text-lg capitalize">{category} events</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event type</TableHead>
                  <TableHead>Required fields in <code>data.object</code></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((evt) => {
                  const schema = WEBHOOK_EVENT_SCHEMAS[evt];
                  const object = schema?.properties?.data?.properties?.object;
                  const required = object?.required ?? [];
                  return (
                    <TableRow key={evt}>
                      <TableCell className="font-mono text-sm">{evt}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {required.length ? required.join(", ") : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Next steps</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <Link to="/developer/gateway/webhooks" className="text-primary hover:underline">
              Webhook integration guide
            </Link>{" "}— register endpoints, verify signatures, handle retries.
          </p>
          <p>
            <Link to="/developer/api-reference/webhook-retry" className="text-primary hover:underline">
              Retry policy &amp; DLQ
            </Link>{" "}— full backoff schedule and replay semantics.
          </p>
          <p>
            <Link to="/developer/sandbox/webhook-tester" className="text-primary hover:underline">
              Sandbox webhook tester
            </Link>{" "}— trigger any of these events against your test endpoint.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
