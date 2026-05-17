// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P6)
// Canonical payment state machine — single source of truth for charge
// lifecycle states, transitions, and terminal semantics. Mirrors the diagram
// at /mnt/documents/KOB_Payment_State_Machine.mmd.
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const CANONICAL = "https://kangopenbanking.com/developer/payments/state-machine";

const STATES: Array<{ name: string; terminal: boolean; description: string }> = [
  { name: "created",     terminal: false, description: "Charge created, awaiting customer authorization or provider routing." },
  { name: "processing",  terminal: false, description: "Provider has accepted the charge and is processing the payment." },
  { name: "pending",     terminal: false, description: "Awaiting asynchronous confirmation (mobile money USSD, bank transfer notification)." },
  { name: "authorized",  terminal: false, description: "Funds reserved on a card. Awaiting capture." },
  { name: "succeeded",   terminal: true,  description: "Funds moved into the merchant settlement account. Final positive state." },
  { name: "captured",    terminal: true,  description: "Authorized charge captured. Equivalent to succeeded for non-auth flows." },
  { name: "failed",      terminal: true,  description: "Provider declined or operation errored. failure_reason populated." },
  { name: "cancelled",   terminal: true,  description: "Cancelled by merchant or customer before terminal settlement." },
  { name: "voided",      terminal: true,  description: "Authorization released without capture. No funds moved." },
  { name: "expired",     terminal: true,  description: "Pending charge timed out before confirmation." },
  { name: "refunded",    terminal: true,  description: "Funds returned to customer. Partial refunds keep status succeeded with refunded_amount > 0." },
  { name: "reversed",    terminal: true,  description: "Post-settlement reversal — funds clawed back from merchant account." },
  { name: "disputed",    terminal: false, description: "Chargeback raised. Funds may be withheld pending evidence review." },
];

const TRANSITIONS: Array<[string, string, string]> = [
  ["created",    "processing",  "Provider accepts the charge"],
  ["created",    "failed",      "Provider rejects at validation"],
  ["created",    "cancelled",   "Merchant or customer cancels before processing"],
  ["processing", "pending",     "Provider returns async pending status"],
  ["processing", "authorized",  "Card authorization reserved"],
  ["processing", "succeeded",   "Synchronous success (mobile money instant credit)"],
  ["processing", "failed",      "Provider declines after attempt"],
  ["pending",    "succeeded",   "Customer completes USSD / bank transfer received"],
  ["pending",    "failed",      "Customer declines or timeout"],
  ["pending",    "expired",     "Confirmation window elapsed"],
  ["authorized", "captured",    "Merchant captures the authorization"],
  ["authorized", "voided",      "Merchant voids before capture"],
  ["authorized", "expired",     "Authorization window elapsed without capture"],
  ["succeeded",  "refunded",    "Full refund issued"],
  ["captured",   "refunded",    "Full refund issued"],
  ["succeeded",  "reversed",    "Post-settlement reversal (operator action)"],
  ["succeeded",  "disputed",    "Customer initiates chargeback"],
  ["disputed",   "reversed",    "Dispute lost — funds returned to customer"],
  ["disputed",   "succeeded",   "Dispute won — funds remain with merchant"],
];

export default function PaymentStateMachine() {
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Developer", item: "https://kangopenbanking.com/developer" },
      { "@type": "ListItem", position: 2, name: "Payments", item: "https://kangopenbanking.com/developer/gateway/charges" },
      { "@type": "ListItem", position: 3, name: "State Machine", item: CANONICAL },
    ],
  };

  return (
    <div className="container mx-auto px-4 py-10 max-w-5xl">
      <Helmet>
        <title>Payment State Machine — Kang Open Banking</title>
        <meta
          name="description"
          content="Canonical charge lifecycle: every state Kang Open Banking emits, every legal transition, and the terminal-state guarantees."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:title" content="Payment State Machine — Kang Open Banking" />
        <meta property="og:description" content="Canonical charge lifecycle for the KOB payment gateway." />
        <meta property="og:image" content="https://kangopenbanking.com/images/og-gateway-quickstart.png" />
        <meta property="og:url" content={CANONICAL} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content="https://kangopenbanking.com/images/og-gateway-quickstart.png" />
        <script type="application/ld+json">{JSON.stringify(breadcrumb)}</script>
      </Helmet>

      <header className="mb-8 space-y-3">
        <p className="text-sm text-muted-foreground">
          <Link to="/developer" className="hover:underline">Developer</Link>
          <span className="mx-2">/</span>
          <Link to="/developer/gateway/charges" className="hover:underline">Payments</Link>
          <span className="mx-2">/</span>
          <span>State Machine</span>
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">Payment State Machine</h1>
        <p className="text-muted-foreground max-w-3xl">
          Every charge processed by the KOB payment gateway moves through a finite set of states.
          This page is the canonical reference — the values listed here exactly match the
          <code> status </code>field on every charge object, the <code>type</code> field of every
          charge webhook event, and the state column in <code>gateway_charges</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline">{STATES.length} states</Badge>
          <Badge variant="outline">{TRANSITIONS.length} legal transitions</Badge>
          <Badge variant="outline">{STATES.filter(s => s.terminal).length} terminal</Badge>
        </div>
      </header>

      <Card className="mb-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">States</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>State</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {STATES.map((s) => (
                <TableRow key={s.name}>
                  <TableCell className="font-mono text-sm">{s.name}</TableCell>
                  <TableCell>
                    <Badge variant={s.terminal ? "secondary" : "outline"}>
                      {s.terminal ? "terminal" : "transient"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{s.description}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="mb-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Legal transitions</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-3">
            Any transition not listed below is rejected by the gateway and will not produce a webhook.
            Out-of-order events for the same <code>charge.id</code> should be treated as duplicates
            (use <code>X-Webhook-ID</code> to deduplicate).
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>From</TableHead>
                <TableHead>To</TableHead>
                <TableHead>Trigger</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {TRANSITIONS.map(([from, to, why]) => (
                <TableRow key={`${from}->${to}`}>
                  <TableCell className="font-mono text-sm">{from}</TableCell>
                  <TableCell className="font-mono text-sm">{to}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{why}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="border-border/60">
        <CardHeader>
          <CardTitle className="text-lg">Guarantees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            <strong className="text-foreground">Terminal states are immutable.</strong> Once a charge
            reaches <code>succeeded</code>, <code>failed</code>, <code>cancelled</code>,
            <code> voided</code>, <code>expired</code>, <code>refunded</code>, or <code>reversed</code>
            it will never transition back to a transient state. The only exception is
            <code> disputed</code> (chargeback), which can be raised against a <code>succeeded</code>
            charge.
          </p>
          <p>
            <strong className="text-foreground">Webhooks mirror the state.</strong> Every transition
            emits a corresponding webhook event (see the{" "}
            <Link to="/developer/webhooks/events" className="text-primary hover:underline">
              Event Registry
            </Link>
            ).
          </p>
          <p>
            <strong className="text-foreground">Idempotency.</strong> Transitions are atomic —
            duplicate provider callbacks will not move a terminal charge.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
