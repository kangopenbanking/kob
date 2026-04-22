// PERMANENT PUBLIC ROUTE — DO NOT REMOVE OR REDIRECT (Order P1)
// Public, no-auth documentation for the KOB Integration Layer (v4.10.0).

import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/integration-layer`;

const curlExample = `curl -X POST "${BASE}/payments.create" \\
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: $(uuidgen)" \\
  -H "x-integration-env: sandbox" \\
  -d '{
    "amount": 4242,
    "currency": "XAF",
    "method": "mobile_money",
    "msisdn": "237670000000",
    "country": "CM"
  }'`;

const nodeExample = `import { KangOpenBanking } from '@kangopenbanking/sdk';

const kob = new KangOpenBanking({ apiKey: process.env.KOB_API_KEY });

const payment = await kob.integration.payments.create({
  amount: 4242,
  currency: 'XAF',
  method: 'mobile_money',
  msisdn: '237670000000',
  country: 'CM',
}, { idempotencyKey: crypto.randomUUID(), env: 'sandbox' });

console.log(payment.id, payment.status); // pi_sandbox_..., succeeded`;

const pythonExample = `import os, uuid, requests

base = f"{os.environ['KOB_BASE_URL']}/integration-layer"
res = requests.post(
    f"{base}/payments.create",
    headers={
        "Authorization": f"Bearer {os.environ['KOB_TOKEN']}",
        "Idempotency-Key": str(uuid.uuid4()),
        "x-integration-env": "sandbox",
    },
    json={"amount": 4242, "currency": "XAF", "method": "card", "country": "CM"},
)
print(res.json())`;

const phpExample = `<?php
use KangOpenBanking\\KOB;

\\$payment = KOB::integration()->payments->create([
  'amount'   => 4242,
  'currency' => 'XAF',
  'method'   => 'card',
  'country'  => 'CM',
], ['idempotency_key' => bin2hex(random_bytes(16)), 'env' => 'sandbox']);`;

export default function IntegrationLayerOverview() {
  return (
    <div className="container max-w-5xl py-10 space-y-8">
      <Helmet>
        <title>KOB Integration Layer — Stripe-style Open Banking | Kang Open Banking</title>
        <meta
          name="description"
          content="The KOB Integration Layer is a frictionless, plug-and-play facade over the Kang Open Banking API. Unified envelopes, smart routing, idempotency, webhook replay, and a sandbox simulator."
        />
        <link rel="canonical" href="https://kangopenbanking.com/developer/integration-layer" />
      </Helmet>

      <header className="space-y-2">
        <Badge variant="outline">v4.10.0 — Additive, non-breaking</Badge>
        <h1 className="text-4xl font-bold tracking-tight">KOB Integration Layer</h1>
        <p className="text-muted-foreground text-lg">
          A Stripe-style facade over the Kang Open Banking API. One unified envelope, one error
          shape, smart connector routing, platform-wide idempotency, and a sandbox simulator —
          all without changing a single existing endpoint.
        </p>
      </header>

      <Card>
        <CardHeader><CardTitle>Resources</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Resource</TableHead>
                <TableHead>Actions</TableHead>
                <TableHead>Routes to</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>customers</TableCell><TableCell>create, retrieve</TableCell><TableCell>identity-register, userinfo</TableCell></TableRow>
              <TableRow><TableCell>accounts</TableCell><TableCell>list, balances</TableCell><TableCell>aisp-accounts, aisp-balances</TableCell></TableRow>
              <TableRow><TableCell>payments</TableCell><TableCell>create, retrieve</TableCell><TableCell>gateway-create-charge, payment-router-charge</TableCell></TableRow>
              <TableRow><TableCell>transfers</TableCell><TableCell>create / initiate</TableCell><TableCell>api-transfers, pisp-domestic-payment, interbank-engine</TableCell></TableRow>
              <TableRow><TableCell>payouts</TableCell><TableCell>create, cancel</TableCell><TableCell>gateway-create-payout</TableCell></TableRow>
              <TableRow><TableCell>refunds</TableCell><TableCell>create</TableCell><TableCell>gateway-create-refund</TableCell></TableRow>
              <TableRow><TableCell>webhooks</TableCell><TableCell>register, replay, ping</TableCell><TableCell>gateway-webhook-endpoints, gateway-deliver-webhook</TableCell></TableRow>
              <TableRow><TableCell>sandbox</TableCell><TableCell>magic_values, trigger</TableCell><TableCell>sandbox-trigger-webhook</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Quickstart — create your first payment</CardTitle></CardHeader>
        <CardContent>
          <Tabs defaultValue="curl">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="node">Node.js</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
            </TabsList>
            <TabsContent value="curl"><pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{curlExample}</code></pre></TabsContent>
            <TabsContent value="node"><pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{nodeExample}</code></pre></TabsContent>
            <TabsContent value="python"><pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{pythonExample}</code></pre></TabsContent>
            <TabsContent value="php"><pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{phpExample}</code></pre></TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sandbox magic values</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Send <code>x-integration-env: sandbox</code> and any of the amounts below to deterministically
            simulate the corresponding outcome.
          </p>
          <Table>
            <TableHeader>
              <TableRow><TableHead>Amount</TableHead><TableHead>Outcome</TableHead><TableHead>Description</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              <TableRow><TableCell>4242</TableCell><TableCell>success</TableCell><TableCell>Charge succeeds immediately</TableCell></TableRow>
              <TableRow><TableCell>4000</TableCell><TableCell>declined</TableCell><TableCell>Charge declined by issuer</TableCell></TableRow>
              <TableRow><TableCell>5555</TableCell><TableCell>challenge</TableCell><TableCell>Triggers a 3DS / SCA challenge</TableCell></TableRow>
              <TableRow><TableCell>9999</TableCell><TableCell>delayed_success</TableCell><TableCell>Succeeds after a 10-second delay</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Unified envelopes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Every integration-layer response uses the same shape, regardless of the upstream connector.
          </p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`{
  "id": "pi_01HZ...",
  "object": "payment",
  "status": "succeeded",
  "amount": 4242,
  "currency": "XAF",
  "created": 1734567890,
  "livemode": false,
  "metadata": null,
  "data": {
    "payment_method": "card",
    "provider": "flutterwave",
    "provider_reference": "FLW-REF-..."
  }
}`}</code></pre>
          <p className="text-sm text-muted-foreground">Errors follow the same predictable shape:</p>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`{
  "error": {
    "type": "connector_error",
    "code": "card_declined",
    "message": "Test card declined",
    "request_id": "req_..."
  }
}`}</code></pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Webhook replay</CardTitle></CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto"><code>{`POST ${BASE}/webhooks.replay
{ "event_id": "evt_01HZ..." }`}</code></pre>
          <p className="text-sm text-muted-foreground mt-3">
            Replays are audited in <code>integration_webhook_replays</code> and re-use the existing
            HMAC-signed delivery pipeline — your endpoint receives an identical, idempotent payload.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
