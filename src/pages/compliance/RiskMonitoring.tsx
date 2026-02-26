import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Activity, Bell, Eye, BarChart3 } from "lucide-react";

export default function RiskMonitoring() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Compliance</Badge>
        <h1 className="text-4xl font-bold mb-4">Risk Monitoring</h1>
        <p className="text-xl text-muted-foreground">
          Real-time transaction surveillance and automated risk detection across all payment channels.
        </p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Eye className="h-6 w-6 text-primary" /><CardTitle>Monitoring Architecture</CardTitle></div></CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Transaction Flow Monitoring
════════════════════════════

  Every Transaction
       ↓
  ┌──────────────────┐
  │  Rule Engine      │
  │  • Velocity rules │
  │  • Amount rules   │
  │  • Pattern rules  │
  │  • Geo rules      │
  └────────┬─────────┘
           ↓
  ┌──────────────────┐     ┌──────────────┐
  │  Risk Score       │────→│  Alert Queue  │
  │  0–100            │     │  (if > 50)    │
  └────────┬─────────┘     └──────┬───────┘
           ↓                      ↓
  ┌──────────────────┐     ┌──────────────┐
  │  Auto Decision    │     │  Manual       │
  │  approve/block    │     │  Review Queue │
  └──────────────────┘     └──────────────┘`}
              </pre>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Activity className="h-6 w-6 text-primary" /><CardTitle>Automated Rules</CardTitle></div></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Rule</th><th className="text-left p-3 font-semibold">Threshold</th><th className="text-left p-3 font-semibold">Action</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">High-value single transaction</td><td className="p-3">&gt; 5,000,000 XAF</td><td className="p-3">Manual review + enhanced logging</td></tr>
                  <tr className="border-b"><td className="p-3">Velocity (count)</td><td className="p-3">&gt; 10 tx/hour per user</td><td className="p-3">Temporary hold + alert</td></tr>
                  <tr className="border-b"><td className="p-3">Velocity (amount)</td><td className="p-3">&gt; 10,000,000 XAF/24h per user</td><td className="p-3">Block + investigation</td></tr>
                  <tr className="border-b"><td className="p-3">New device + high value</td><td className="p-3">First tx from device &gt; 500,000 XAF</td><td className="p-3">Step-up authentication</td></tr>
                  <tr className="border-b"><td className="p-3">Cross-border pattern</td><td className="p-3">&gt; 3 countries in 24h</td><td className="p-3">Review + PEP check</td></tr>
                  <tr><td className="p-3">Structuring detection</td><td className="p-3">Multiple tx just below thresholds</td><td className="p-3">STR filing trigger</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Bell className="h-6 w-6 text-primary" /><CardTitle>Alerting & Escalation</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <div className="grid md:grid-cols-3 gap-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Tier 1 — Automated</h4>
                <p>Low-risk alerts logged and auto-resolved. Included in daily compliance report.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Tier 2 — Review Queue</h4>
                <p>Medium-risk alerts assigned to compliance team for manual investigation within 24 hours.</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2">Tier 3 — Escalation</h4>
                <p>High-risk alerts trigger immediate account freeze, senior review, and potential STR filing with ANIF.</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><BarChart3 className="h-6 w-6 text-primary" /><CardTitle>Monitoring Data Sources</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <ul className="list-disc list-inside space-y-2">
              <li><code className="text-xs bg-muted px-1 rounded">audit_logs</code> — Full transaction audit trail with IP, device, geolocation</li>
              <li><code className="text-xs bg-muted px-1 rounded">gateway_charges</code> — All payment transactions with status lifecycle</li>
              <li><code className="text-xs bg-muted px-1 rounded">sanctions_screening</code> — Screening results and match history</li>
              <li><code className="text-xs bg-muted px-1 rounded">customer_due_diligence</code> — CDD records and risk assessments</li>
              <li><code className="text-xs bg-muted px-1 rounded">suspicious_activity_reports</code> — Filed and pending STRs</li>
              <li><code className="text-xs bg-muted px-1 rounded">security_events</code> — Login anomalies and authentication failures</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
