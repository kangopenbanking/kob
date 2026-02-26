import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { HardDrive, Clock, RefreshCcw, Shield } from "lucide-react";

export default function DisasterRecovery() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-5xl">
      <div className="mb-8">
        <Badge variant="outline" className="mb-4">Architecture</Badge>
        <h1 className="text-4xl font-bold mb-4">Disaster Recovery</h1>
        <p className="text-xl text-muted-foreground">Business continuity and disaster recovery framework for Kang Open Banking infrastructure.</p>
      </div>
      <Separator className="my-8" />
      <div className="space-y-8">
        <div className="grid md:grid-cols-3 gap-6">
          <Card>
            <CardContent className="pt-6 text-center">
              <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">&lt; 15 min</p>
              <p className="text-sm text-muted-foreground">Recovery Time Objective</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <HardDrive className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">&lt; 5 min</p>
              <p className="text-sm text-muted-foreground">Recovery Point Objective</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Shield className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-2xl font-bold">99.95%</p>
              <p className="text-sm text-muted-foreground">Availability Target</p>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader><div className="flex items-center gap-3"><RefreshCcw className="h-6 w-6 text-primary" /><CardTitle>Recovery Procedures</CardTitle></div></CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-3 font-semibold">Scenario</th><th className="text-left p-3 font-semibold">Detection</th><th className="text-left p-3 font-semibold">Response</th><th className="text-left p-3 font-semibold">Recovery</th></tr></thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-b"><td className="p-3">Database failure</td><td className="p-3">Automated health checks</td><td className="p-3">Failover to standby</td><td className="p-3">PITR restore &lt; 5 min</td></tr>
                  <tr className="border-b"><td className="p-3">Edge function outage</td><td className="p-3">Error rate monitoring</td><td className="p-3">Auto-restart / redeploy</td><td className="p-3">&lt; 2 min</td></tr>
                  <tr className="border-b"><td className="p-3">Processor outage (Stripe)</td><td className="p-3">Webhook timeout</td><td className="p-3">Queue retries, alert</td><td className="p-3">Dependent on processor</td></tr>
                  <tr className="border-b"><td className="p-3">DDoS attack</td><td className="p-3">CDN anomaly detection</td><td className="p-3">WAF rules + rate limiting</td><td className="p-3">&lt; 5 min</td></tr>
                  <tr><td className="p-3">Data corruption</td><td className="p-3">Integrity checks</td><td className="p-3">Isolate + rollback</td><td className="p-3">PITR to last clean state</td></tr>
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Backup Strategy</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-3">
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Continuous:</strong> Write-ahead log (WAL) streaming for point-in-time recovery</li>
              <li><strong>Daily:</strong> Full database snapshots retained for 30 days</li>
              <li><strong>Weekly:</strong> Cold storage backups retained for 1 year</li>
              <li><strong>Code:</strong> Git-based version control with automated deployment rollback capability</li>
              <li><strong>Secrets:</strong> Vault snapshots with cross-region replication</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
