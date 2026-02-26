import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shield, Clock, AlertTriangle, FileText } from "lucide-react";

export default function IncidentResponse() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Security</Badge>
        <h1 className="text-4xl font-bold mb-4">Incident Response</h1>
        <p className="text-xl text-muted-foreground">Structured incident management framework for security events and service disruptions.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <Card>
          <CardHeader><div className="flex items-center gap-3"><AlertTriangle className="h-6 w-6 text-primary" /><CardTitle>Severity Classification</CardTitle></div></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Severity</th><th className="text-left p-3 font-semibold">Definition</th><th className="text-left p-3 font-semibold">Response Time</th><th className="text-left p-3 font-semibold">Examples</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3"><Badge variant="destructive">P1 Critical</Badge></td><td className="p-3">Complete service outage or data breach</td><td className="p-3">15 minutes</td><td className="p-3">Database compromise, payment processing failure</td></tr>
                  <tr className="border-b"><td className="p-3"><Badge className="bg-orange-500">P2 High</Badge></td><td className="p-3">Major feature degradation</td><td className="p-3">1 hour</td><td className="p-3">Single processor outage, elevated error rates</td></tr>
                  <tr className="border-b"><td className="p-3"><Badge className="bg-yellow-500">P3 Medium</Badge></td><td className="p-3">Minor feature impact</td><td className="p-3">4 hours</td><td className="p-3">Non-critical API errors, reporting delays</td></tr>
                  <tr><td className="p-3"><Badge variant="secondary">P4 Low</Badge></td><td className="p-3">Minimal impact</td><td className="p-3">Next business day</td><td className="p-3">UI issues, documentation errors</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><Clock className="h-6 w-6 text-primary" /><CardTitle>Response Lifecycle</CardTitle></div></CardHeader>
          <CardContent>
            <div className="bg-muted p-6 rounded-lg overflow-x-auto">
              <pre className="text-xs text-muted-foreground whitespace-pre">{`
Incident Response Lifecycle
═══════════════════════════

  Detection → Triage → Containment → Investigation → Remediation → Post-Mortem

  1. DETECTION
     - Automated monitoring alerts
     - Customer reports
     - Security scanning

  2. TRIAGE (< 15 min for P1)
     - Severity classification
     - Team notification
     - Initial impact assessment

  3. CONTAINMENT
     - Isolate affected systems
     - Block attack vectors
     - Preserve evidence

  4. INVESTIGATION
     - Root cause analysis
     - Impact scope assessment
     - Regulatory notification (if required)

  5. REMEDIATION
     - Deploy fix
     - Verify resolution
     - Restore services

  6. POST-MORTEM
     - Timeline documentation
     - Lessons learned
     - Prevention measures
     - Stakeholder communication`}
              </pre>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><FileText className="h-6 w-6 text-primary" /><CardTitle>Regulatory Notifications</CardTitle></div></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <p>Data breach and significant incidents require notification to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>COBAC:</strong> Within 24 hours for incidents affecting payment services</li>
              <li><strong>BEAC:</strong> Within 48 hours for incidents affecting payment system integrity</li>
              <li><strong>Affected Users:</strong> Without undue delay when personal data is compromised</li>
              <li><strong>Payment Processors:</strong> Immediate notification for shared infrastructure incidents</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
