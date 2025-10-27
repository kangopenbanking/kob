import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, Lock, Eye, UserCheck, FileText, Globe } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function DataProtection() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold">Data Protection</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Our commitment to protecting your personal and financial data
      </p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Data Protection Framework</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Open Banking is committed to protecting your personal and financial data in accordance with Cameroon's data protection law (Law No. 2019/020) and international best practices including GDPR principles.
            </p>

            <div className="grid md:grid-cols-3 gap-4">
              <Card className="p-4">
                <Lock className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-1 text-sm">Security</h3>
                <p className="text-xs text-muted-foreground">
                  Bank-grade encryption and security controls
                </p>
              </Card>

              <Card className="p-4">
                <Eye className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-1 text-sm">Transparency</h3>
                <p className="text-xs text-muted-foreground">
                  Clear disclosure of data practices
                </p>
              </Card>

              <Card className="p-4">
                <UserCheck className="h-6 w-6 text-primary mb-2" />
                <h3 className="font-semibold mb-1 text-sm">User Rights</h3>
                <p className="text-xs text-muted-foreground">
                  Full control over your personal data
                </p>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Legal Basis</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-3">2.1 Cameroon Data Protection Law</h3>
                <p className="text-muted-foreground leading-relaxed mb-3">
                  We comply with Law No. 2019/020 of December 24, 2019, relating to personal data protection in Cameroon, which establishes:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Requirements for data collection and processing</li>
                  <li>Rights of data subjects</li>
                  <li>Obligations of data controllers and processors</li>
                  <li>Rules for cross-border data transfers</li>
                  <li>Penalties for violations</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">2.2 GDPR Principles</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Where applicable (e.g., for EU residents), we apply GDPR principles including lawfulness, fairness, transparency, purpose limitation, data minimization, accuracy, storage limitation, and integrity.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Data We Process</h2>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Personal Identification Data
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Name, email address, phone number</li>
                  <li>• National ID or business registration</li>
                  <li>• Date of birth and address</li>
                  <li>• Professional information</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Financial Data (with explicit consent)
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• Account information and balances</li>
                  <li>• Transaction history</li>
                  <li>• Payment instructions</li>
                  <li>• Credit and debit card details (tokenized)</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  Usage Data
                </h3>
                <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                  <li>• API usage logs and access times</li>
                  <li>• IP addresses and device information</li>
                  <li>• Browser type and operating system</li>
                  <li>• Performance and error logs</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Lawful Bases for Processing</h2>
            <div className="space-y-3">
              <Card className="p-4">
                <h3 className="font-semibold mb-2">Consent</h3>
                <p className="text-sm text-muted-foreground">
                  For accessing your financial data, we obtain explicit, informed, and freely given consent. You can withdraw consent at any time.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Contractual Necessity</h3>
                <p className="text-sm text-muted-foreground">
                  Processing necessary to provide services under our Terms of Service and execute your requests.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Legal Obligation</h3>
                <p className="text-sm text-muted-foreground">
                  Compliance with COBAC regulations, AML/KYC requirements, tax laws, and court orders.
                </p>
              </Card>

              <Card className="p-4">
                <h3 className="font-semibold mb-2">Legitimate Interest</h3>
                <p className="text-sm text-muted-foreground">
                  Fraud prevention, security monitoring, service improvement, and direct marketing (with opt-out).
                </p>
              </Card>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Your Rights</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Under Cameroon data protection law and GDPR (where applicable), you have the following rights:
              </p>

              <div className="grid gap-3">
                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Access</h3>
                  <p className="text-sm text-muted-foreground">
                    Request a copy of your personal data we hold. Response within 30 days.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Rectification</h3>
                  <p className="text-sm text-muted-foreground">
                    Correct inaccurate or incomplete personal data.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Erasure ("Right to be Forgotten")</h3>
                  <p className="text-sm text-muted-foreground">
                    Request deletion of your data (subject to legal retention requirements).
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Restriction</h3>
                  <p className="text-sm text-muted-foreground">
                    Limit how we process your data in certain circumstances.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Data Portability</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive your data in a structured, machine-readable format.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Object</h3>
                  <p className="text-sm text-muted-foreground">
                    Object to processing based on legitimate interests or direct marketing.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Withdraw Consent</h3>
                  <p className="text-sm text-muted-foreground">
                    Withdraw consent at any time without affecting prior processing.
                  </p>
                </Card>

                <Card className="p-4">
                  <h3 className="font-semibold mb-1">Right to Lodge a Complaint</h3>
                  <p className="text-sm text-muted-foreground">
                    File a complaint with the data protection authority if you believe your rights have been violated.
                  </p>
                </Card>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Exercising Your Rights</h2>
            <Card className="p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                To exercise any of your data protection rights:
              </p>
              <ol className="text-sm text-muted-foreground space-y-2 ml-4 list-decimal list-inside">
                <li>Send a request to: <span className="font-medium text-foreground">privacy@kangopenbanking.com</span></li>
                <li>Include: Full name, email address, nature of request, supporting documentation</li>
                <li>We will verify your identity before processing</li>
                <li>Response provided within 30 days (may be extended by 60 days for complex requests)</li>
                <li>Free of charge (unless requests are manifestly unfounded or excessive)</li>
              </ol>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Data Security Measures</h2>
            <div className="space-y-3">
              <ul className="space-y-3">
                <li className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Encryption:</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      TLS 1.3 for data in transit, AES-256 for data at rest
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Access Controls:</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      Role-based access, multi-factor authentication, least privilege principle
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Monitoring:</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      24/7 security monitoring, intrusion detection, automated threat response
                    </span>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <Lock className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="font-medium">Staff Training:</span>
                    <span className="text-sm text-muted-foreground ml-2">
                      Regular security and privacy training for all employees
                    </span>
                  </div>
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Retention</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                We retain data only as long as necessary for the purposes collected or as required by law:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li><strong>Transaction data:</strong> 7 years (COBAC requirement)</li>
                <li><strong>Account information:</strong> Duration of account + 7 years</li>
                <li><strong>KYC documents:</strong> 5 years after relationship ends</li>
                <li><strong>Marketing data:</strong> Until consent withdrawn + 30 days</li>
                <li><strong>Technical logs:</strong> 90 days to 1 year</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cross-Border Data Transfers</h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <Globe className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-2">Data Localization</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    Your data is primarily stored within Cameroon and the CEMAC region in compliance with COBAC data localization requirements.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Globe className="h-6 w-6 text-primary mt-1 flex-shrink-0" />
                <div>
                  <h3 className="font-semibold mb-2">International Transfers</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed mb-2">
                    If we transfer data outside CEMAC (e.g., for cloud services or support), we ensure adequate protection through:
                  </p>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Standard Contractual Clauses (SCCs)</li>
                    <li>• Adequacy decisions (where applicable)</li>
                    <li>• Binding Corporate Rules</li>
                    <li>• Your explicit consent</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Data Breach Notification</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                In the event of a personal data breach:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>We will notify the data protection authority within 72 hours of becoming aware</li>
                <li>Affected individuals will be notified without undue delay</li>
                <li>Notification will include nature of breach, potential consequences, and mitigation measures</li>
                <li>We maintain detailed breach logs and incident reports</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Data Protection Officer</h2>
            <Card className="p-4 bg-muted/50">
              <p className="text-sm text-muted-foreground mb-3">
                Our Data Protection Officer (DPO) oversees all data protection activities:
              </p>
              <div className="space-y-1 text-sm">
                <p><strong>DPO Email:</strong> dpo@kangopenbanking.com</p>
                <p><strong>Privacy Team:</strong> privacy@kangopenbanking.com</p>
                <p><strong>Phone:</strong> +237 6 22 02 25 67</p>
                <p><strong>Address:</strong> Bamenda, Cameroon</p>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Supervisory Authority</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              You have the right to lodge a complaint with the supervisory authority:
            </p>
            <Card className="p-4">
              <p className="text-sm font-medium mb-2">National Agency for Information and Communication Technologies (ANTIC)</p>
              <p className="text-sm text-muted-foreground">Yaoundé, Cameroon</p>
              <p className="text-sm text-muted-foreground">Website: www.antic.cm</p>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We review and update this Data Protection policy regularly to reflect changes in law, technology, or our practices. Material changes will be communicated via email at least 30 days in advance.
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
