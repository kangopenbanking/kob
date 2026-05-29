import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";
import { Users, Wallet, ArrowDownToLine, ArrowUpFromLine, MapPin, ShieldCheck } from "lucide-react";

const codeBlock =
  "rounded-md border border-border/40 bg-muted/30 p-4 text-xs font-mono overflow-x-auto";

const registerExample = `curl -X POST https://api.kangopenbanking.com/v1/agents \\
  -H "Authorization: Bearer $KOB_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "business_name": "Mama Africa Mobile Money",
    "msisdn": "+237671234567",
    "country_code": "CM",
    "region": "Centre",
    "city": "Yaoundé",
    "latitude": 3.848,
    "longitude": 11.502,
    "tier": "standard"
  }'`;

const cashInExample = `curl -X POST https://api.kangopenbanking.com/v1/agents/$AGENT_ID/cash-in \\
  -H "Authorization: Bearer $KOB_API_KEY" \\
  -H "Idempotency-Key: 7f4a1b2c-9d3e-4f8a-b6c1-2d3e4f5a6b7c" \\
  -H "Content-Type: application/json" \\
  -d '{
    "amount": 25000,
    "currency": "XAF",
    "customer_msisdn": "+237698765432"
  }'`;

const nodeExample = `import fetch from "node-fetch";
import { randomUUID } from "node:crypto";

const res = await fetch(\`https://api.kangopenbanking.com/v1/agents/\${agentId}/cash-out\`, {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.KOB_API_KEY}\`,
    "Idempotency-Key": randomUUID(),
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ amount: 15000, currency: "XAF", customer_user_id: customerUuid }),
});
console.log(await res.json());`;

const pythonExample = `import os, uuid, requests

r = requests.post(
    f"https://api.kangopenbanking.com/v1/agents/{agent_id}/cash-out",
    headers={
        "Authorization": f"Bearer {os.environ['KOB_API_KEY']}",
        "Idempotency-Key": str(uuid.uuid4()),
        "Content-Type": "application/json",
    },
    json={"amount": 15000, "currency": "XAF", "customer_user_id": customer_uuid},
)
print(r.json())`;

const tiers = [
  { tier: "standard", commission: "1.00%", daily_limit: "XAF 500,000", kyc: "CNI + address proof" },
  { tier: "premium", commission: "1.25%", daily_limit: "XAF 2,000,000", kyc: "CNI + RCCM + tax ID" },
  { tier: "master", commission: "1.50%", daily_limit: "XAF 10,000,000", kyc: "Full COBAC dossier" },
];

export default function AgentBankingGuide() {
  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold">Agent Banking</h1>
          <Badge variant="outline">v4.46.0</Badge>
        </div>
        <p className="mt-2 text-muted-foreground">
          Register cash agents, manage float, and process customer cash-in / cash-out across the
          six CEMAC member states. Aligned with BIS Agent Banking Guidelines (2018), Mojaloop v1.1
          PartyIdType=AGENT, and the GSMA Agent Network Management Toolkit v2.
        </p>
      </div>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            What an Agent Is
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            An agent is a registered third party — typically a shop, kiosk, or fuel station — that
            converts cash to digital value (cash-in) and digital value to cash (cash-out) for
            customers. Each agent holds a float balance (digital value) and a cash-on-hand
            balance. The two move in opposite directions on every transaction.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            Endpoints
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Method</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Path</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Purpose</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["POST", "/v1/agents", "Register a new agent"],
                  ["GET", "/v1/agents", "Discover agents by country/region"],
                  ["GET", "/v1/agents/{agentId}", "Read agent + float balances"],
                  ["POST", "/v1/agents/{agentId}/float/topup", "Increase float"],
                  ["POST", "/v1/agents/{agentId}/float/withdraw", "Decrease float"],
                  ["POST", "/v1/agents/{agentId}/cash-in", "Customer deposits cash"],
                  ["POST", "/v1/agents/{agentId}/cash-out", "Customer withdraws cash"],
                  ["GET", "/v1/agents/{agentId}/transactions", "Transaction history"],
                ].map(([m, p, d]) => (
                  <tr key={p} className="border-b border-border/20">
                    <td className="px-3 py-2 font-mono">{m}</td>
                    <td className="px-3 py-2 font-mono">{p}</td>
                    <td className="px-3 py-2">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            Agent Tiers
          </CardTitle>
          <CardDescription>Tier determines commission, daily limits, and KYC depth.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/30">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tier</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Commission</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Daily Limit</th>
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">KYC</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t) => (
                  <tr key={t.tier} className="border-b border-border/20">
                    <td className="px-3 py-2 font-mono">{t.tier}</td>
                    <td className="px-3 py-2">{t.commission}</td>
                    <td className="px-3 py-2">{t.daily_limit}</td>
                    <td className="px-3 py-2">{t.kyc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownToLine className="h-5 w-5 text-primary" />
            Register an Agent
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className={codeBlock}>{registerExample}</pre>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowUpFromLine className="h-5 w-5 text-primary" />
            Cash-In / Cash-Out
          </CardTitle>
          <CardDescription>
            Every write requires an Idempotency-Key (UUIDv4). Replays return the original transaction.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">cURL — cash-in</p>
            <pre className={codeBlock}>{cashInExample}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Node.js — cash-out</p>
            <pre className={codeBlock}>{nodeExample}</pre>
          </div>
          <div>
            <p className="text-sm font-medium mb-2">Python — cash-out</p>
            <pre className={codeBlock}>{pythonExample}</pre>
          </div>
          <p className="text-xs text-muted-foreground">
            When the agent's float drops below its <code>low_threshold</code>, the response
            includes <code>X-Float-Warning: low_float</code>. Subscribe to the
            <code> agent.float.low</code> webhook for proactive top-up alerts.
          </p>
        </CardContent>
      </Card>

      <Card className="border border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Float Accounting Model
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Cash-in</strong>: customer hands cash to agent. Agent's float decreases by the
            amount (digital value transfers out to customer wallet), agent's cash-on-hand
            increases by the same amount.
          </p>
          <p>
            <strong>Cash-out</strong>: customer redeems digital value. Agent's float increases by
            the amount, agent's cash-on-hand decreases by the same amount.
          </p>
          <p>
            Commission accrues at the configured per-tier rate and is recorded as a separate
            <code> commission</code> transaction in the agent ledger.
          </p>
        </CardContent>
      </Card>

      <AutoDocNavigation />
    </div>
  );
}
