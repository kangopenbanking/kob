import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { BarChart3, Target, Gauge, ArrowRight } from "lucide-react";

export default function RiskScoringModel() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Risk Scoring Model</h1>
        <p className="text-xl text-muted-foreground">
          Quantitative risk assessment framework for transactions, merchants, and users within the Kang Open Banking ecosystem.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Gauge className="h-6 w-6 text-primary" />
              <CardTitle>Scoring Matrix</CardTitle>
            </div>
            <CardDescription>Every transaction scored 0–100 across multiple dimensions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-semibold">Factor</th>
                    <th className="text-left p-3 font-semibold">Weight</th>
                    <th className="text-left p-3 font-semibold">Signals</th>
                    <th className="text-left p-3 font-semibold">Score Impact</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">Velocity</td><td className="p-3">25%</td><td className="p-3">Tx count/hour, amount/24h</td><td className="p-3">0–25</td></tr>
                  <tr className="border-b"><td className="p-3">Amount Threshold</td><td className="p-3">20%</td><td className="p-3">vs. user average, merchant average</td><td className="p-3">0–20</td></tr>
                  <tr className="border-b"><td className="p-3">Pattern Anomaly</td><td className="p-3">20%</td><td className="p-3">Time-of-day, geography, frequency</td><td className="p-3">0–20</td></tr>
                  <tr className="border-b"><td className="p-3">Device Trust</td><td className="p-3">15%</td><td className="p-3">Fingerprint history, IP reputation</td><td className="p-3">0–15</td></tr>
                  <tr className="border-b"><td className="p-3">Merchant Grade</td><td className="p-3">10%</td><td className="p-3">KYB status, chargeback ratio</td><td className="p-3">0–10</td></tr>
                  <tr><td className="p-3">Account Age</td><td className="p-3">10%</td><td className="p-3">Days since creation, verification level</td><td className="p-3">0–10</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-primary" />
              <CardTitle>Decision Thresholds</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              {[
                { level: "Low", range: "0–25", action: "Auto-approve", color: "border-green-500/50 bg-green-500/5" },
                { level: "Medium", range: "26–50", action: "Approve with monitoring", color: "border-yellow-500/50 bg-yellow-500/5" },
                { level: "High", range: "51–75", action: "Manual review required", color: "border-orange-500/50 bg-orange-500/5" },
                { level: "Critical", range: "76–100", action: "Auto-block + alert", color: "border-red-500/50 bg-red-500/5" },
              ].map((t) => (
                <div key={t.level} className={`border-2 rounded-lg p-4 ${t.color}`}>
                  <h4 className="font-bold text-lg">{t.level}</h4>
                  <p className="text-sm text-muted-foreground mb-2">Score: {t.range}</p>
                  <p className="text-sm font-medium">{t.action}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <ArrowRight className="h-6 w-6 text-primary" />
              <CardTitle>Decision Flow</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Transaction Request
       ↓
┌──────────────┐
│ Compute Risk │──→ Score < 26 ──→ ✅ APPROVE
│   Score      │
│  (0–100)     │──→ Score 26–50 ──→ ✅ APPROVE + FLAG for monitoring
│              │
│              │──→ Score 51–75 ──→ ⏸️  HOLD for manual review
│              │
│              │──→ Score > 75 ──→ ❌ BLOCK + Alert + STR
└──────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <BarChart3 className="h-6 w-6 text-primary" />
              <CardTitle>API Endpoint</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm font-mono mb-2">POST /v1/gateway/risk/score</p>
              <pre className="text-xs text-muted-foreground">{`{
  "amount": 50000,
  "currency": "XAF",
  "channel": "mobile_money",
  "customer_email": "user@example.com",
  "merchant_id": "merch_xxx",
  "device_fingerprint": "fp_abc123",
  "ip_address": "197.159.x.x"
}

Response:
{
  "risk_score": 32,
  "risk_level": "medium",
  "recommendation": "approve",
  "factors": [
    { "name": "velocity", "score": 8, "max": 25 },
    { "name": "amount_threshold", "score": 12, "max": 20 },
    { "name": "pattern_anomaly", "score": 5, "max": 20 },
    { "name": "device_trust", "score": 3, "max": 15 },
    { "name": "merchant_grade", "score": 2, "max": 10 },
    { "name": "account_age", "score": 2, "max": 10 }
  ]
}`}</pre>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
