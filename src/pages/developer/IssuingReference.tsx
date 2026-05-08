// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1, P2, P4, P6, P9)
// Public reference for the Virtual Card Issuing API (Kora middleware).
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard, ShieldCheck, Webhook, KeyRound } from "lucide-react";

const CURL_ISSUE = `curl -X POST https://api.kangopenbanking.com/v1/issuing/cards \\
  -H "Authorization: Bearer $KOB_API_KEY" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "Content-Type: application/json" \\
  -d '{
    "cardholder_id": "ch_01HXYZ...",
    "program_id": "prg_01HXYZ...",
    "currency": "USD",
    "initial_funding": "10.00"
  }'`;

const NODE_ISSUE = `import fetch from "node-fetch";
const res = await fetch("https://api.kangopenbanking.com/v1/issuing/cards", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.KOB_API_KEY}\`,
    "Idempotency-Key": crypto.randomUUID(),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    cardholder_id: "ch_01HXYZ",
    program_id: "prg_01HXYZ",
    currency: "USD",
    initial_funding: "10.00",
  }),
});
const card = await res.json();`;

const PY_ISSUE = `import os, uuid, requests
res = requests.post(
  "https://api.kangopenbanking.com/v1/issuing/cards",
  headers={
    "Authorization": f"Bearer {os.environ['KOB_API_KEY']}",
    "Idempotency-Key": str(uuid.uuid4()),
    "Content-Type": "application/json",
  },
  json={
    "cardholder_id": "ch_01HXYZ",
    "program_id": "prg_01HXYZ",
    "currency": "USD",
    "initial_funding": "10.00",
  },
  timeout=10,
)
card = res.json()`;

const Code = ({ code }: { code: string }) => (
  <pre className="rounded-md border bg-muted/40 p-4 text-xs overflow-x-auto"><code>{code}</code></pre>
);

export default function IssuingReference() {
  return (
    <div className="container max-w-5xl py-10 space-y-8">
      <Helmet>
        <title>Virtual Card Issuing API | Kang Open Banking</title>
        <meta
          name="description"
          content="Issue, fund, freeze, and terminate USD virtual cards for bank and developer customers via the Kang Open Banking Issuing API (Kora middleware)."
        />
        <link rel="canonical" href="https://info.kangfintechsolutions.com/developer/api/issuing" />
      </Helmet>

      <header className="space-y-3">
        <Badge variant="outline">v4.32.0 — Issuing</Badge>
        <h1 className="text-4xl font-bold tracking-tight">Virtual Card Issuing API</h1>
        <p className="text-lg text-muted-foreground">
          Issue USD virtual cards for your bank or developer tenant. Powered by the Kora middleware,
          with full lifecycle, funding, transactions, and PCI-safe reveal flows.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <CreditCard className="h-5 w-5" />
            <CardTitle className="text-base">Lifecycle</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            issue / freeze / unfreeze / terminate, fully audited per tenant.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <ShieldCheck className="h-5 w-5" />
            <CardTitle className="text-base">PCI-safe reveal</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Step-up MFA required. Full PAN/CVV is never persisted server-side.
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-3">
            <Webhook className="h-5 w-5" />
            <CardTitle className="text-base">Webhooks</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            HMAC-SHA256 signed events: charged, refunded, declined, terminated.
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Endpoints</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Method</TableHead>
                <TableHead>Path</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["POST", "/v1/issuing/cardholders", "Create cardholder (KYC)"],
                ["POST", "/v1/issuing/cards", "Issue a virtual card"],
                ["GET", "/v1/issuing/cards", "List cards for the tenant"],
                ["GET", "/v1/issuing/cards/{id}", "Retrieve a masked card"],
                ["POST", "/v1/issuing/cards/{id}/fund", "Fund a card"],
                ["POST", "/v1/issuing/cards/{id}/withdraw", "Withdraw from a card"],
                ["POST", "/v1/issuing/cards/{id}/freeze", "Freeze a card"],
                ["POST", "/v1/issuing/cards/{id}/unfreeze", "Unfreeze a card"],
                ["POST", "/v1/issuing/cards/{id}/terminate", "Permanently terminate"],
                ["GET", "/v1/issuing/cards/{id}/transactions", "List card transactions"],
                ["POST", "/v1/issuing/cards/{id}/reveal", "Reveal PAN (step-up MFA)"],
              ].map(([m, p, d]) => (
                <TableRow key={p as string}>
                  <TableCell><Badge variant="outline">{m}</Badge></TableCell>
                  <TableCell className="font-mono text-xs">{p}</TableCell>
                  <TableCell>{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3">
          <KeyRound className="h-5 w-5" />
          <CardTitle>Issue a card</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>
            <TabsContent value="curl"><Code code={CURL_ISSUE} /></TabsContent>
            <TabsContent value="node"><Code code={NODE_ISSUE} /></TabsContent>
            <TabsContent value="python"><Code code={PY_ISSUE} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Webhook events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>When it fires</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["card.issued", "A new card has been provisioned by the issuer."],
                ["card.charged", "A merchant authorisation succeeded against the card."],
                ["card.refunded", "A merchant refund was applied."],
                ["card.declined", "An authorisation was declined (insufficient funds, blocked MCC, frozen)."],
                ["card.terminated", "Card is permanently terminated and cannot be reactivated."],
              ].map(([e, w]) => (
                <TableRow key={e}>
                  <TableCell className="font-mono text-xs">{e}</TableCell>
                  <TableCell>{w}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-sm text-muted-foreground mt-4">
            All events include the <code className="font-mono">X-KOB-Signature</code>,{" "}
            <code className="font-mono">X-Webhook-ID</code>, and{" "}
            <code className="font-mono">X-Webhook-Timestamp</code> headers as defined in the global
            webhook policy. Receivers MUST deduplicate on the event id within a 24-hour window.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Error catalogue (RFC 7807)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>HTTP</TableHead>
                <TableHead>Meaning</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[
                ["card_kyc_required", 422, "Cardholder KYC is incomplete."],
                ["card_insufficient_funds", 409, "Card balance is below the requested amount."],
                ["card_provider_unavailable", 502, "Upstream issuer is unreachable; retry later."],
                ["card_terminated", 409, "Card has been permanently terminated."],
                ["mfa_required", 401, "Step-up MFA is required to reveal the card."],
                ["card_validation_failed", 422, "Request payload failed validation."],
                ["card_not_found", 404, "Card or cardholder does not exist for this tenant."],
              ].map(([c, h, d]) => (
                <TableRow key={c as string}>
                  <TableCell className="font-mono text-xs">{c}</TableCell>
                  <TableCell>{h}</TableCell>
                  <TableCell>{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
