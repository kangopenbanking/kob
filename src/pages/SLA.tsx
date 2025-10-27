import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Zap, CheckCircle, AlertCircle } from "lucide-react";

export default function SLA() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Clock className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold">Service Level Agreement</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Effective: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Service Commitment</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kang Open Banking commits to providing reliable, high-performance API services with guaranteed uptime and support response times as outlined in this Service Level Agreement.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Service Availability</h2>
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4 text-center">
                <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold mb-1">99.9%</div>
                <div className="text-sm text-muted-foreground">Monthly Uptime</div>
                <Badge className="mt-2" variant="outline">Standard & Enterprise</Badge>
              </Card>

              <Card className="p-4 text-center">
                <Zap className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold mb-1">99.95%</div>
                <div className="text-sm text-muted-foreground">Monthly Uptime</div>
                <Badge className="mt-2" variant="outline">Premium Enterprise</Badge>
              </Card>

              <Card className="p-4 text-center">
                <Clock className="h-8 w-8 text-primary mx-auto mb-2" />
                <div className="text-3xl font-bold mb-1">&lt;200ms</div>
                <div className="text-sm text-muted-foreground">Avg Response Time</div>
                <Badge className="mt-2" variant="outline">P95 Latency</Badge>
              </Card>
            </div>

            <div className="space-y-4">
              <h3 className="text-xl font-medium">2.1 Uptime Calculation</h3>
              <p className="text-muted-foreground">
                Uptime is measured as the percentage of time the API is available during each calendar month, excluding scheduled maintenance windows.
              </p>
              
              <Card className="p-4 bg-muted/50">
                <p className="text-sm font-mono">
                  Uptime % = (Total Minutes in Month - Downtime Minutes) / Total Minutes in Month × 100
                </p>
              </Card>

              <h3 className="text-xl font-medium mt-6">2.2 Excluded Downtime</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Scheduled maintenance (announced 7 days in advance)</li>
                <li>Emergency security updates (best effort notification)</li>
                <li>Issues caused by customer's infrastructure or code</li>
                <li>Force majeure events (natural disasters, war, etc.)</li>
                <li>Third-party service failures beyond our control</li>
                <li>Network issues outside our infrastructure</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Performance Targets</h2>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Metric</th>
                      <th className="text-left py-3 px-4">Target</th>
                      <th className="text-left py-3 px-4">Measurement</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-3 px-4">API Response Time (P95)</td>
                      <td className="py-3 px-4">&lt; 200ms</td>
                      <td className="py-3 px-4">Monthly average</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">API Response Time (P99)</td>
                      <td className="py-3 px-4">&lt; 500ms</td>
                      <td className="py-3 px-4">Monthly average</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Error Rate</td>
                      <td className="py-3 px-4">&lt; 0.1%</td>
                      <td className="py-3 px-4">5xx errors/total requests</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">Transaction Success Rate</td>
                      <td className="py-3 px-4">&gt; 99.5%</td>
                      <td className="py-3 px-4">Successful/total transactions</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Scheduled Maintenance</h2>
            <div className="space-y-4">
              <Card className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold">Maintenance Windows</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Standard maintenance: Sundays 02:00 - 06:00 WAT (West Africa Time)
                    </p>
                  </div>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 ml-8">
                  <li>• 7 days advance notice via email and status page</li>
                  <li>• Maximum 4 hours per maintenance window</li>
                  <li>• Maximum 8 hours total maintenance per month</li>
                  <li>• Emergency maintenance: 24 hours notice when possible</li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Support Response Times</h2>
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Priority Level</th>
                      <th className="text-left py-3 px-4">Definition</th>
                      <th className="text-left py-3 px-4">Response Time</th>
                      <th className="text-left py-3 px-4">Resolution Target</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-3 px-4">
                        <Badge variant="destructive" className="text-xs">Critical</Badge>
                      </td>
                      <td className="py-3 px-4">Complete service outage</td>
                      <td className="py-3 px-4">15 minutes</td>
                      <td className="py-3 px-4">4 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">
                        <Badge variant="destructive" className="text-xs opacity-70">High</Badge>
                      </td>
                      <td className="py-3 px-4">Major functionality impaired</td>
                      <td className="py-3 px-4">1 hour</td>
                      <td className="py-3 px-4">8 hours</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">Medium</Badge>
                      </td>
                      <td className="py-3 px-4">Partial functionality affected</td>
                      <td className="py-3 px-4">4 hours</td>
                      <td className="py-3 px-4">2 business days</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs opacity-70">Low</Badge>
                      </td>
                      <td className="py-3 px-4">General questions, feature requests</td>
                      <td className="py-3 px-4">1 business day</td>
                      <td className="py-3 px-4">5 business days</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Card className="p-4 bg-muted/50 mt-4">
                <h3 className="font-semibold mb-2">Support Availability</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• <strong>Critical Issues:</strong> 24/7/365 support</li>
                  <li>• <strong>High Priority:</strong> 24/7/365 support</li>
                  <li>• <strong>Medium/Low Priority:</strong> Business hours (Mon-Fri, 8:00-18:00 WAT)</li>
                  <li>• <strong>Enterprise Clients:</strong> Dedicated support manager</li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Service Credits</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground">
                If we fail to meet our uptime commitment, you may be eligible for service credits:
              </p>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4">Monthly Uptime %</th>
                      <th className="text-left py-3 px-4">Service Credit</th>
                    </tr>
                  </thead>
                  <tbody className="text-muted-foreground">
                    <tr className="border-b">
                      <td className="py-3 px-4">99.0% - 99.89%</td>
                      <td className="py-3 px-4">10% of monthly fees</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">95.0% - 98.99%</td>
                      <td className="py-3 px-4">25% of monthly fees</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-3 px-4">&lt; 95.0%</td>
                      <td className="py-3 px-4">50% of monthly fees</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <Card className="p-4 bg-muted/50">
                <h3 className="font-semibold mb-2">Claiming Service Credits</h3>
                <ul className="text-sm text-muted-foreground space-y-2">
                  <li>• Submit claim within 30 days of incident via support portal</li>
                  <li>• Provide incident details and impact documentation</li>
                  <li>• Credits applied to next billing cycle</li>
                  <li>• Maximum credit per month: 50% of monthly fees</li>
                  <li>• Credits are your sole remedy for SLA breaches</li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Incident Management</h2>
            <div className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <Card className="p-4">
                  <AlertCircle className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-2">Detection & Response</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 24/7 system monitoring</li>
                    <li>• Automated incident detection</li>
                    <li>• Immediate triage and escalation</li>
                    <li>• Real-time status page updates</li>
                  </ul>
                </Card>

                <Card className="p-4">
                  <CheckCircle className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold mb-2">Communication</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Status page notifications</li>
                    <li>• Email alerts to stakeholders</li>
                    <li>• Regular incident updates</li>
                    <li>• Post-incident reports</li>
                  </ul>
                </Card>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Monitoring & Reporting</h2>
            <div className="space-y-4">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Real-time status dashboard at status.kangopenbanking.cm</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Monthly SLA performance reports</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Historical uptime and performance metrics</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <span className="text-muted-foreground">Incident post-mortems for major outages</span>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. SLA Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify this SLA with 90 days written notice. Material changes that reduce service commitments will not apply to existing contracts until renewal. You may terminate your agreement within 30 days of notification if you disagree with material changes.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Contact Information</h2>
            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <p><strong>SLA Inquiries:</strong> sla@kangopenbanking.cm</p>
                <p><strong>Service Credit Claims:</strong> billing@kangopenbanking.cm</p>
                <p><strong>Incident Reports:</strong> support@kangopenbanking.cm</p>
                <p><strong>Status Page:</strong> status.kangopenbanking.cm</p>
                <p><strong>Emergency Hotline:</strong> +237 6 22 02 25 67 (24/7)</p>
              </div>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
