import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Server, ShieldAlert, KeyRound, Lock } from "lucide-react";

const curlRegister = `curl -X POST https://api.kangopenbanking.com/v1/tenant-connectors-manage \\
  -H "Authorization: Bearer <USER_JWT>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "action": "create",
    "owner_type": "institution",
    "owner_id": "<INSTITUTION_UUID>",
    "connector_id": "soap_bank",
    "environment": "live",
    "country": "CM",
    "priority": 50,
    "display_name": "T24 Core Branch 001",
    "credentials": {
      "endpoint_url": "https://core.bank.local/T24/PaymentService",
      "username": "kob_integration",
      "password": "********",
      "service_namespace": "http://t24.bank/payments",
      "operation_initiate": "InitiatePayment",
      "operation_status": "GetPaymentStatus"
    }
  }'`;

const nodeRegister = `import { supabase } from "@/integrations/supabase/client";

await supabase.functions.invoke("tenant-connectors-manage", {
  body: {
    action: "create",
    owner_type: "institution",
    owner_id: institutionId,
    connector_id: "soap_bank",
    environment: "live",
    country: "CM",
    priority: 50,
    credentials: {
      endpoint_url: "https://core.bank.local/T24/PaymentService",
      username: "kob_integration",
      password: process.env.SOAP_PWD,
      service_namespace: "http://t24.bank/payments",
      operation_initiate: "InitiatePayment",
      operation_status: "GetPaymentStatus",
    },
  },
});`;

const pythonRegister = `import requests
requests.post(
  "https://api.kangopenbanking.com/v1/tenant-connectors-manage",
  headers={"Authorization": f"Bearer {jwt}", "Content-Type": "application/json"},
  json={
    "action": "create", "owner_type": "institution", "owner_id": str(inst_id),
    "connector_id": "soap_bank", "environment": "live", "country": "CM", "priority": 50,
    "credentials": {
      "endpoint_url": "https://core.bank.local/T24/PaymentService",
      "username": "kob_integration", "password": pwd,
      "service_namespace": "http://t24.bank/payments",
      "operation_initiate": "InitiatePayment",
      "operation_status": "GetPaymentStatus",
    }
  })`;

export default function SoapBankAdapter() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-8 max-w-5xl">
      <header className="space-y-3">
        <Badge variant="outline" className="border-primary text-primary">Legacy Banking</Badge>
        <h1 className="text-4xl font-bold tracking-tight">SOAP Bank Adapter</h1>
        <p className="text-muted-foreground max-w-3xl">
          Connect KOB to legacy core-banking systems exposing SOAP/WSDL endpoints —
          T24, Flexcube, OBDX, FusionBanking and equivalents. The adapter speaks the same
          unified <code>PaymentConnector</code> contract, so failover, polling, and admin
          oversight work identically to direct mobile-money rails.
        </p>
      </header>

      <Alert variant="destructive">
        <ShieldAlert className="h-4 w-4" />
        <AlertTitle>mTLS limitation</AlertTitle>
        <AlertDescription>
          TLS is terminated by the edge proxy. Mutual-TLS to your bank is not possible
          inside the managed runtime — front the connector with your own VPN, reverse proxy,
          or API gateway when the bank requires client X.509.
        </AlertDescription>
      </Alert>

      <Card className="border-2">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Required credentials</CardTitle>
          <CardDescription>All fields are encrypted at rest with AES-GCM.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Field</TableHead><TableHead>Purpose</TableHead></TableRow></TableHeader>
            <TableBody>
              <TableRow><TableCell className="font-mono">endpoint_url</TableCell><TableCell>SOAP service URL (the WSDL is fetched from <code>?wsdl</code>)</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">username</TableCell><TableCell>WS-Security UsernameToken username</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">password</TableCell><TableCell>WS-Security UsernameToken password</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">service_namespace</TableCell><TableCell>XML target namespace for operations</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">operation_initiate</TableCell><TableCell>SOAP operation name to start a payment</TableCell></TableRow>
              <TableRow><TableCell className="font-mono">operation_status</TableCell><TableCell>SOAP operation name to query a payment</TableCell></TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Server className="h-5 w-5 text-primary" />Sample envelope (informational)</CardTitle>
          <CardDescription>The adapter generates this automatically — you never write XML.</CardDescription>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-xs font-mono">{`<soapenv:Envelope xmlns:soapenv="..." xmlns:tns="http://t24.bank/payments">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>kob_integration</wsse:Username>
        <wsse:Password Type="...PasswordText">********</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <tns:InitiatePayment>
      <Reference>KOB-2026-0001</Reference>
      <Amount>50000</Amount>
      <Currency>XAF</Currency>
      <AccountNumber>237699999999</AccountNumber>
    </tns:InitiatePayment>
  </soapenv:Body>
</soapenv:Envelope>`}</pre>
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        {[
          { title: "cURL", body: curlRegister },
          { title: "Node.js", body: nodeRegister },
          { title: "Python", body: pythonRegister },
        ].map((ex) => (
          <Card key={ex.title}>
            <CardHeader className="pb-2"><CardTitle className="text-sm">{ex.title} — register adapter</CardTitle></CardHeader>
            <CardContent><pre className="bg-muted p-3 rounded text-xs font-mono overflow-x-auto whitespace-pre-wrap">{ex.body}</pre></CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-primary/40 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5 text-primary" />Security notes</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>Credentials are encrypted with the platform-managed <code>PAYMENT_CONNECTOR_KEY</code>; they are never returned through any read endpoint.</p>
          <p>Every create / update / delete is recorded through <code>log_audit_event</code> and visible in the admin Audit Trail drawer.</p>
          <p>Refunds are not supported by the generic adapter — implement them through your bank's specific workflow on the bank side.</p>
        </CardContent>
      </Card>
    </div>
  );
}
