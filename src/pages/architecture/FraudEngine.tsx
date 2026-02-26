import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, AlertTriangle, Zap, Eye, Brain, Layers } from "lucide-react";

export default function FraudEngine() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Fraud Detection Engine</h1>
        <p className="text-xl text-muted-foreground">
          Multi-layer fraud prevention system protecting every transaction across Kang Open Banking infrastructure.
        </p>
      </div>

      <Separator className="my-8" />

      <div className="space-y-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Layers className="h-6 w-6 text-primary" />
              <CardTitle>Multi-Layer Architecture</CardTitle>
            </div>
            <CardDescription>Five-layer defence model applied to every transaction</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
┌─────────────────────────────────────────────────────┐
│  Layer 1 — Pre-Transaction Risk Scoring             │
│  → Velocity checks (per-user, per-device, per-IP)   │
│  → Amount threshold analysis                        │
│  → Geographic anomaly detection                     │
│  → Device fingerprint verification                  │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  Layer 2 — Real-Time Transaction Analysis           │
│  → Pattern matching against known fraud vectors     │
│  → Merchant risk grade assessment                   │
│  → Cross-reference with sanctions lists             │
│  → Behavioral biometric signals                     │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  Layer 3 — Processor Signal Aggregation             │
│  → Stripe Radar signals (3DS, CVC, AVS)            │
│  → Flutterwave fraud flags                          │
│  → PayPal Seller Protection status                  │
│  → Internal scoring engine fusion                   │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  Layer 4 — Post-Transaction Monitoring              │
│  → Chargeback pattern analysis                      │
│  → Refund velocity monitoring                       │
│  → Settlement anomaly detection                     │
│  → Suspicious activity reports (STR)                │
└──────────────────┬──────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────┐
│  Layer 5 — Continuous Learning & Audit              │
│  → Risk model retraining triggers                   │
│  → Audit log immutability (audit_logs table)        │
│  → Regulatory reporting (BEAC/COBAC)                │
│  → Anomaly detection dashboard                      │
└─────────────────────────────────────────────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>

        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Zap className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Velocity Checks</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Applied at charge creation via <code className="text-xs bg-muted px-1 py-0.5 rounded">gateway-create-charge</code>:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Max transactions per user per hour</li>
                <li>Max transaction amount per rolling 24h window</li>
                <li>Device fingerprint frequency limits</li>
                <li>IP-based geographic velocity</li>
                <li>New-device first-transaction restrictions</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Risk Scoring API</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Exposed via <code className="text-xs bg-muted px-1 py-0.5 rounded">POST /v1/gateway/risk/score</code>:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Returns score 0–100 with risk_level (low/medium/high/critical)</li>
                <li>Velocity, amount-threshold, and pattern-anomaly factors</li>
                <li>Actionable recommendation (approve/review/block)</li>
                <li>Factors breakdown for audit trail</li>
                <li>Integrates with merchant risk grading</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Eye className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Device Fingerprinting</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Tracked via <code className="text-xs bg-muted px-1 py-0.5 rounded">audit_logs.device_fingerprint</code>:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Browser/device identification hash</li>
                <li>Geolocation correlation with IP</li>
                <li>Session continuity verification</li>
                <li>New-device alerting and step-up auth</li>
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Merchant Risk Grading</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Merchants assigned risk tiers based on:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>KYB verification completeness</li>
                <li>Historical chargeback ratio</li>
                <li>Transaction volume patterns</li>
                <li>Industry risk classification (MCC)</li>
                <li>Geographic risk factors</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Processor Signal Integration</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Stripe Radar</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 3D Secure challenge results</li>
                  <li>• CVC/AVS verification</li>
                  <li>• Machine learning risk score</li>
                  <li>• Early fraud warning (EFW)</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Flutterwave</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Mobile money verification</li>
                  <li>• Callback signature validation</li>
                  <li>• Transaction status polling</li>
                  <li>• Pending state timeout</li>
                </ul>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Internal Engine</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Composite risk fusion</li>
                  <li>• Override capabilities</li>
                  <li>• Manual review queue</li>
                  <li>• Audit trail logging</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
