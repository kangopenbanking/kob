import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export default function AUP() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="flex items-center gap-3 mb-8">
        <AlertTriangle className="h-10 w-10 text-primary" />
        <h1 className="text-4xl font-bold">Acceptable Use Policy</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-8">Last updated: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Purpose</h2>
            <p className="text-muted-foreground leading-relaxed">
              This Acceptable Use Policy ("AUP") governs your use of Kang Open Banking's API services and platform. By accessing our services, you agree to comply with this policy. Violations may result in suspension or termination of your access.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Permitted Use</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                You may use our services for legitimate financial technology applications, including:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Account aggregation services for end users</li>
                <li>Payment initiation on behalf of authorized customers</li>
                <li>Financial data analytics and insights</li>
                <li>Personal finance management applications</li>
                <li>Business accounting and reconciliation tools</li>
                <li>Credit assessment and lending platforms</li>
                <li>Investment and savings applications</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Prohibited Activities</h2>
            <Card className="p-4 bg-destructive/10 border-destructive/20">
              <div className="flex items-start gap-3 mb-4">
                <XCircle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-destructive mb-2">Strictly Forbidden</h3>
                  <p className="text-sm text-muted-foreground">
                    The following activities are absolutely prohibited and will result in immediate account suspension:
                  </p>
                </div>
              </div>
            </Card>

            <div className="space-y-6 mt-6">
              <div>
                <h3 className="text-xl font-medium mb-3">3.1 Illegal Activities</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Money laundering or terrorist financing</li>
                  <li>Fraud, scams, or any illegal financial activities</li>
                  <li>Unauthorized access to accounts or data</li>
                  <li>Identity theft or impersonation</li>
                  <li>Violation of sanctions or embargoes</li>
                  <li>Facilitating illegal transactions</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">3.2 Security Violations</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Attempting to breach security or authentication mechanisms</li>
                  <li>Reverse engineering, decompiling, or disassembling services</li>
                  <li>Probing, scanning, or testing vulnerabilities without authorization</li>
                  <li>Accessing data or systems without explicit permission</li>
                  <li>Circumventing rate limits or access controls</li>
                  <li>Using stolen or unauthorized credentials</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">3.3 Abuse & Misuse</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Excessive API calls that degrade service performance</li>
                  <li>Scraping data beyond authorized scope</li>
                  <li>Creating fake accounts or automated bot accounts</li>
                  <li>Spamming or sending unsolicited communications</li>
                  <li>DDoS attacks or similar service disruptions</li>
                  <li>Using services to harm, harass, or deceive others</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">3.4 Data Misuse</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Storing data longer than permitted by regulations</li>
                  <li>Sharing user data without explicit consent</li>
                  <li>Selling or monetizing user data</li>
                  <li>Using data for purposes not disclosed to end users</li>
                  <li>Aggregating data across multiple users without authorization</li>
                  <li>Using data to train AI models without permission</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">3.5 Commercial Violations</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Reselling API access without authorization</li>
                  <li>Competing directly with Kang Open Banking services</li>
                  <li>Using services in ways that violate third-party rights</li>
                  <li>Trademark or intellectual property infringement</li>
                  <li>False advertising or misrepresentation of services</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-medium mb-3">3.6 Regulatory Violations</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Operating without required financial licenses</li>
                  <li>Non-compliance with COBAC or BEAC regulations</li>
                  <li>Violating AML/KYC requirements</li>
                  <li>Failing to implement required data protection measures</li>
                  <li>Not obtaining required user consents</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Fair Use Policy</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-medium">4.1 Rate Limits</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Rate limits are enforced to ensure fair access and service stability:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Respect published rate limits for your subscription tier</li>
                <li>Implement exponential backoff for retries</li>
                <li>Cache responses where appropriate</li>
                <li>Contact us if you need higher limits for legitimate use cases</li>
              </ul>

              <h3 className="text-xl font-medium mt-6">4.2 Resource Usage</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Use efficient API calls (batch requests when possible)</li>
                <li>Avoid unnecessary polling; use webhooks instead</li>
                <li>Implement proper error handling to avoid retry storms</li>
                <li>Monitor your usage patterns and optimize as needed</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. User Privacy & Consent</h2>
            <div className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                You must respect end-user privacy and obtain proper consent:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Obtain explicit consent before accessing user financial data</li>
                <li>Clearly disclose how you will use the data</li>
                <li>Provide users with ability to revoke consent</li>
                <li>Delete user data when requested or no longer needed</li>
                <li>Comply with data minimization principles</li>
                <li>Implement strong data security measures</li>
                <li>Respect user privacy preferences</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Content Restrictions</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When using our services to create or transmit content, you must not:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Create or distribute malicious software or viruses</li>
              <li>Transmit offensive, abusive, or discriminatory content</li>
              <li>Impersonate others or misrepresent affiliations</li>
              <li>Infringe on intellectual property rights</li>
              <li>Distribute false or misleading information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Reporting Violations</h2>
            <Card className="p-4 bg-muted/50">
              <p className="text-muted-foreground leading-relaxed mb-3">
                If you become aware of violations of this AUP, please report them immediately:
              </p>
              <div className="space-y-2 text-sm">
                <p><strong>Abuse Reports:</strong> abuse@kangopenbanking.cm</p>
                <p><strong>Security Issues:</strong> security@kangopenbanking.cm</p>
                <p><strong>Fraud Reports:</strong> fraud@kangopenbanking.cm</p>
                <p><strong>Emergency:</strong> +237 233 XX XX XX (24/7)</p>
              </div>
            </Card>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Enforcement</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-medium">8.1 Investigation</h3>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to investigate suspected violations of this AUP. This may include reviewing logs, API usage patterns, and user complaints.
              </p>

              <h3 className="text-xl font-medium mt-4">8.2 Actions We May Take</h3>
              <p className="text-muted-foreground leading-relaxed mb-3">
                Depending on the severity and nature of the violation, we may:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Issue a warning and require corrective action</li>
                <li>Temporarily suspend your API access</li>
                <li>Rate limit or throttle your API calls</li>
                <li>Permanently terminate your account</li>
                <li>Report violations to law enforcement</li>
                <li>Take legal action for damages</li>
                <li>Refuse future service</li>
              </ul>

              <h3 className="text-xl font-medium mt-4">8.3 Appeal Process</h3>
              <p className="text-muted-foreground leading-relaxed">
                If your account is suspended or terminated, you may appeal by contacting legal@kangopenbanking.cm within 30 days. Include a detailed explanation and evidence supporting your appeal.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cooperation with Authorities</h2>
            <p className="text-muted-foreground leading-relaxed">
              We cooperate fully with law enforcement and regulatory authorities. We may disclose information about your use of services if required by law or to protect our rights and the rights of others.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Modifications</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this AUP at any time. Material changes will be communicated via email at least 30 days in advance. Continued use of services after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Information</h2>
            <Card className="p-4">
              <div className="space-y-2 text-sm">
                <p><strong>Policy Questions:</strong> legal@kangopenbanking.cm</p>
                <p><strong>Abuse Reports:</strong> abuse@kangopenbanking.cm</p>
                <p><strong>Compliance Inquiries:</strong> compliance@kangopenbanking.cm</p>
                <p><strong>Phone:</strong> +237 233 XX XX XX</p>
              </div>
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
