import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, Eye, FileCheck, AlertTriangle, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function SecurityPolicy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold">Security Policy</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Last updated: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Security Overview</h2>
            <p className="text-muted-foreground leading-relaxed">
              At Kang Open Banking, security is our highest priority. We implement comprehensive security measures to protect your data, ensure service availability, and maintain the integrity of financial transactions across our platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Security Architecture</h2>
            <div className="grid md:grid-cols-2 gap-4">
              <Card className="p-4">
                <Lock className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-2">Encryption</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• TLS 1.3 for data in transit</li>
                  <li>• AES-256 for data at rest</li>
                  <li>• End-to-end encryption</li>
                  <li>• Secure key management (HSM)</li>
                </ul>
              </Card>
              
              <Card className="p-4">
                <Eye className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-2">Authentication</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• OAuth 2.0 / OpenID Connect</li>
                  <li>• Multi-factor authentication (MFA)</li>
                  <li>• JWT token-based auth</li>
                  <li>• Mutual TLS (mTLS) option</li>
                </ul>
              </Card>

              <Card className="p-4">
                <FileCheck className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-2">Compliance</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• PCI-DSS Level 1 certified</li>
                  <li>• COBAC compliant</li>
                  <li>• ISO 27001 certified</li>
                  <li>• SOC 2 Type II audited</li>
                </ul>
              </Card>

              <Card className="p-4">
                <AlertTriangle className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-2">Monitoring</h3>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 24/7 security monitoring</li>
                  <li>• Real-time threat detection</li>
                  <li>• Automated incident response</li>
                  <li>• Regular vulnerability scans</li>
                </ul>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Data Protection Measures</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">3.1 Data Classification</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li><strong>Highly Sensitive:</strong> Passwords, PINs, payment credentials (encrypted, tokenized)</li>
                  <li><strong>Sensitive:</strong> PII, account numbers, transaction data (encrypted)</li>
                  <li><strong>Internal:</strong> API keys, logs, system data (access controlled)</li>
                  <li><strong>Public:</strong> Documentation, general information (freely accessible)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">3.2 Data Isolation</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Each client's data is logically isolated in multi-tenant architecture with strict access controls. Physical isolation is available for enterprise clients.
                </p>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">3.3 Backup & Recovery</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Automated daily backups with encryption</li>
                  <li>Geographic redundancy across multiple data centers</li>
                  <li>Point-in-time recovery capability</li>
                  <li>Tested disaster recovery plan (RPO: 1 hour, RTO: 4 hours)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Application Security</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">4.1 Secure Development</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>OWASP Top 10 protection</li>
                  <li>Secure code reviews</li>
                  <li>Static and dynamic code analysis</li>
                  <li>Dependency vulnerability scanning</li>
                  <li>Security testing in CI/CD pipeline</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">4.2 API Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Rate limiting and throttling</li>
                  <li>Input validation and sanitization</li>
                  <li>SQL injection prevention</li>
                  <li>XSS and CSRF protection</li>
                  <li>API gateway with WAF</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">4.3 Network Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>DDoS mitigation</li>
                  <li>Firewall protection</li>
                  <li>VPN for administrative access</li>
                  <li>Network segmentation</li>
                  <li>Intrusion detection/prevention systems</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Access Control</h2>
            <div className="space-y-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Role-based access control (RBAC)</li>
                <li>Principle of least privilege</li>
                <li>Mandatory multi-factor authentication for staff</li>
                <li>Regular access reviews and audits</li>
                <li>Automated account deprovisioning</li>
                <li>Privileged access management (PAM)</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Incident Response</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">6.1 Detection & Response</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>24/7 Security Operations Center (SOC)</li>
                  <li>SIEM for log aggregation and analysis</li>
                  <li>Automated threat detection</li>
                  <li>Incident response team on-call</li>
                  <li>Mean time to detection (MTTD): &lt; 15 minutes</li>
                  <li>Mean time to respond (MTTR): &lt; 1 hour</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">6.2 Communication</h3>
                <p className="text-muted-foreground leading-relaxed">
                  In case of security incidents affecting your data, we will notify you within 72 hours as required by COBAC and data protection regulations. Critical incidents are communicated immediately.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Compliance & Audits</h2>
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <CheckCircle className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Active Certifications</h3>
                </div>
                <ul className="text-sm text-muted-foreground space-y-2 ml-4">
                  <li>• PCI-DSS Level 1 (Payment Card Industry)</li>
                  <li>• ISO 27001 (Information Security Management)</li>
                  <li>• SOC 2 Type II (Security, Availability, Confidentiality)</li>
                  <li>• COBAC Compliance (Central African Banking Commission)</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-2">Regular Audits</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Annual third-party security audits</li>
                  <li>Quarterly penetration testing</li>
                  <li>Monthly vulnerability assessments</li>
                  <li>Continuous compliance monitoring</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Vulnerability Disclosure Program</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We welcome responsible disclosure of security vulnerabilities. Our bug bounty program rewards researchers who help us maintain security.
              </p>
              
              <div className="bg-muted/50 rounded-lg p-4">
                <h3 className="font-semibold mb-2">Reporting a Vulnerability</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  Email: <span className="font-medium text-foreground">security@kangopenbanking.cm</span>
                </p>
                <p className="text-sm text-muted-foreground mb-2">
                  Use our PGP key for sensitive reports (available on our website)
                </p>
                <p className="text-sm text-muted-foreground">
                  Response time: Critical issues &lt; 24 hours, others &lt; 72 hours
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Security Best Practices for Users</h2>
            <div className="space-y-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Enable multi-factor authentication (MFA)</li>
                <li>Use strong, unique passwords</li>
                <li>Rotate API keys regularly (at least quarterly)</li>
                <li>Implement IP whitelisting where possible</li>
                <li>Monitor API usage for anomalies</li>
                <li>Keep your integration libraries up to date</li>
                <li>Never share credentials or API keys</li>
                <li>Use separate credentials for production and sandbox</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We continuously improve our security measures. This policy is reviewed and updated quarterly. Material changes will be communicated via email and posted on our status page.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Security Team</h2>
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="text-muted-foreground space-y-2">
                <p><strong>Security Inquiries:</strong> security@kangopenbanking.cm</p>
                <p><strong>Vulnerability Reports:</strong> security@kangopenbanking.cm (use PGP)</p>
                <p><strong>Security Hotline:</strong> +237 233 XX XX XX (24/7)</p>
                <p><strong>Physical Security:</strong> Douala, Cameroon</p>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
