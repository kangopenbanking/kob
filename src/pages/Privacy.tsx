import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Notice</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: January 15, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Open Banking ("KOB", "we," "our," or "us") is a product of Kang Consultancy Co Ltd, committed to protecting your privacy and personal data. This Privacy Notice explains how we collect, use, disclose, and safeguard your information when you use our open banking API services, developer portal, and platform.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Consultancy Co Ltd is registered under the Canada Business Corporations Act (CBCA) (Reg. No. 1381210-3) with offices in Port Dover, ON, Canada, and in Cameroon under Reg. No. RCBDA2021B000451, regulated by the Ministry of Small and Medium-Sized Enterprises, and accredited by the Management Centre (CGA/AMC) (Tax Reg. M102116572371B).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We process personal data about individuals ("you", "your") who:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
              <li>Request details of our open banking services and API documentation</li>
              <li>Register as developers or Third Party Providers (TPPs) on our platform</li>
              <li>Work at or are otherwise engaged by financial institutions or organizations enrolled with KOB</li>
              <li>Are end users of Account Information Service Providers (AISPs) or Payment Initiation Service Providers (PISPs)</li>
              <li>Use our website, developer portal, or related services</li>
              <li>Are stakeholders, partners, or media contacts we communicate with</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Data Controller and Contact Information</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Open Banking is the data controller for the personal data we process. For any privacy-related inquiries, you can contact our Data Protection Officer:
            </p>
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <p className="font-medium">Email: privacy@kangopenbanking.cm</p>
              <p className="font-medium">Alternative: dpo@kangopenbanking.cm</p>
              <p className="font-medium">Phone: +237 6 22 02 25 67</p>
              <p className="font-medium">Address: Bamenda, Cameroon</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Lawful Bases for Processing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We process your personal data on the following lawful bases under Cameroon Data Protection Law and GDPR (where applicable):
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Contractual necessity:</strong> Where processing is necessary to perform our contract with you or your organization, or to take steps before entering into a contract</li>
              <li><strong>Legal obligation:</strong> To comply with our legal and regulatory obligations under COBAC regulations, anti-money laundering laws, and financial services regulations</li>
              <li><strong>Legitimate interests:</strong> Where processing is necessary for our legitimate interests or those of third parties, such as fraud prevention, security, service improvement, and operational integrity</li>
              <li><strong>Consent:</strong> Where you have given explicit consent for specific processing activities, such as marketing communications</li>
              <li><strong>Vital interests:</strong> Where processing is necessary to protect life or physical safety</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You can withdraw your consent at any time by contacting <a href="mailto:privacy@kangopenbanking.cm" className="text-primary hover:underline">privacy@kangopenbanking.cm</a>. You also have the right to object to processing based on legitimate interests.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Categories of Personal Data We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">4.1 Identity and Contact Information</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Full name, date of birth, nationality</li>
                  <li>Email address, phone number, postal address</li>
                  <li>Company name, business registration details, job title</li>
                  <li>Government-issued identification (passport, national ID card) for TPP registration and KYC verification</li>
                  <li>Proof of address documents</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.2 Financial and Transaction Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Bank account information (with explicit consent through AISP consents)</li>
                  <li>Transaction history, balance information, standing orders, direct debits</li>
                  <li>Payment instructions and beneficiary details (for PISP services)</li>
                  <li>Mobile money account information (MTN Mobile Money, Orange Money)</li>
                  <li>Payment and billing information for API usage fees</li>
                  <li>XAF currency transaction records</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.3 Technical and Usage Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>IP addresses, device identifiers, browser type, and operating system</li>
                  <li>API keys, OAuth tokens, and authentication credentials</li>
                  <li>API request logs, usage statistics, and performance metrics</li>
                  <li>Login and access logs (including failed login attempts)</li>
                  <li>Session information and two-factor authentication data</li>
                  <li>Webhook endpoints and notification preferences</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.4 Registration and Compliance Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>TPP registration details (FCA reference numbers, regulatory authorizations)</li>
                  <li>Dynamic Client Registration (DCR) information</li>
                  <li>Software statements and certificates</li>
                  <li>KYC and AML verification results</li>
                  <li>Sanctions screening records</li>
                  <li>Compliance audit trails</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. How We Use Your Personal Data</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use your personal data for the following purposes:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">5.1 Service Provision</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To provide and maintain our AISP (Account Information Service Provider) and PISP (Payment Initiation Service Provider) APIs</li>
                  <li>To process account information requests, balance inquiries, and transaction history retrieval</li>
                  <li>To initiate and execute payment instructions on behalf of payment service users</li>
                  <li>To facilitate mobile money transfers and bank transfers</li>
                  <li>To manage OAuth2 authorization flows and consent management</li>
                  <li>To provide access to the KOB Developer Portal and sandbox environment</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.2 Identity Verification and Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To verify your identity using government-issued documents and biometric scans</li>
                  <li>To prevent fraud, money laundering, and terrorist financing</li>
                  <li>To screen against international sanctions lists</li>
                  <li>To authenticate users and authorize API access</li>
                  <li>To implement Strong Customer Authentication (SCA) as required by PSD2-equivalent regulations</li>
                  <li>To monitor for suspicious activities and security threats</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.3 Compliance and Legal Obligations</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To comply with COBAC (Central African Banking Commission) regulations</li>
                  <li>To meet AML/CFT (Anti-Money Laundering/Combating the Financing of Terrorism) requirements</li>
                  <li>To respond to lawful requests from law enforcement and regulatory authorities</li>
                  <li>To maintain audit trails and records as required by law (7-year retention for financial records)</li>
                  <li>To report suspicious transactions to ANIF (National Agency for Financial Investigation)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.4 Service Improvement and Analytics</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To analyze API usage patterns and optimize performance</li>
                  <li>To improve our services, platform, and documentation</li>
                  <li>To conduct research and development for new features</li>
                  <li>To generate anonymized statistics and insights</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.5 Communications</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>To send service notifications, system alerts, and security updates</li>
                  <li>To provide technical support and respond to inquiries</li>
                  <li>To send marketing communications (with your consent, which can be withdrawn at any time)</li>
                  <li>To notify you of changes to our services, policies, or terms</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your data with:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">6.1 Financial Institutions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  With your explicit consent, we share data with banks and financial institutions in Cameroon (such as commercial banks, microfinance institutions) to retrieve account information or initiate payments on your behalf.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.2 Third Party Providers (TPPs)</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Authorized AISPs and PISPs registered on our platform access user data only with valid consents and within the scope of granted permissions.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.3 Service Providers and Processors</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Cloud hosting and infrastructure providers (Supabase, AWS, Google Cloud)</li>
                  <li>Payment processors (Stripe, Flutterwave) for API billing</li>
                  <li>Identity verification providers for KYC/AML checks</li>
                  <li>Security and fraud prevention services</li>
                  <li>Email and SMS communication platforms</li>
                  <li>Analytics and monitoring tools</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  All processors are bound by data processing agreements and process data only on our instructions.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.4 Regulatory and Legal Authorities</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>COBAC (Central African Banking Commission)</li>
                  <li>ANIF (National Agency for Financial Investigation)</li>
                  <li>Law enforcement agencies when required by law</li>
                  <li>Courts and arbitration bodies for dispute resolution</li>
                  <li>Tax authorities for compliance purposes</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.5 Professional Advisors</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Lawyers, auditors, accountants, and consultants under confidentiality obligations.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.6 Business Transfers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  In the event of a merger, acquisition, or sale of assets, your data may be transferred to the acquiring entity, subject to the same privacy protections.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Your personal data is primarily stored and processed within Cameroon and the Central African Economic and Monetary Community (CEMAC) region. However, some of our service providers are located outside Cameroon, including in Canada, the European Union, and the United States.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When we transfer data internationally, we ensure appropriate safeguards are in place:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Standard Contractual Clauses (SCCs) approved by the European Commission</li>
              <li>Adequacy decisions by relevant data protection authorities</li>
              <li>Binding Corporate Rules for intra-group transfers</li>
              <li>Explicit consent where required</li>
              <li>Compliance with COBAC cross-border data transfer requirements</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data Security Measures</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We implement industry-leading security measures to protect your personal data:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">8.1 Technical Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>TLS 1.3 encryption for all data in transit</li>
                  <li>AES-256 encryption for data at rest</li>
                  <li>Multi-factor authentication (MFA) for all user accounts</li>
                  <li>OAuth2 and OpenID Connect for secure authorization</li>
                  <li>API request signing using eIDAS-compliant certificates</li>
                  <li>Tokenization of sensitive payment data</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">8.2 Organizational Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Role-based access controls (RBAC) and principle of least privilege</li>
                  <li>Regular security audits and penetration testing by independent firms</li>
                  <li>ISO 27001 information security management practices</li>
                  <li>PCI-DSS compliance for payment card data</li>
                  <li>Incident response and breach notification procedures</li>
                  <li>Employee security training and background checks</li>
                  <li>24/7 security monitoring and threat detection</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected and to comply with legal obligations:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Financial transaction records:</strong> 7 years (COBAC requirement)</li>
              <li><strong>KYC/AML documentation:</strong> 7 years after relationship ends</li>
              <li><strong>API access logs:</strong> 6 years for security and audit purposes</li>
              <li><strong>Consent records:</strong> Duration of consent plus 7 years</li>
              <li><strong>Account information:</strong> Duration of active account plus 3 years</li>
              <li><strong>Marketing data:</strong> Until consent is withdrawn or 3 years of inactivity</li>
              <li><strong>Security incident logs:</strong> 6 years for potential legal claims</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              After the retention period expires, we securely delete or anonymize your data unless longer retention is required by law or for the establishment, exercise, or defense of legal claims.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Your Data Protection Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Under Cameroon Data Protection Law and GDPR (where applicable), you have the following rights:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">10.1 Right of Access</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request a copy of the personal data we hold about you and information about how we process it.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.2 Right to Rectification</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request correction of inaccurate or incomplete personal data.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.3 Right to Erasure ("Right to be Forgotten")</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request deletion of your personal data, subject to legal retention requirements and legitimate grounds for continued processing.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.4 Right to Restriction of Processing</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request that we limit processing of your data in certain circumstances, such as when accuracy is contested or processing is unlawful.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.5 Right to Data Portability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can request a copy of your data in a structured, machine-readable format (JSON, CSV, XML) and transmit it to another controller.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.6 Right to Object</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You can object to processing based on legitimate interests, including profiling and direct marketing.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.7 Right to Withdraw Consent</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Where processing is based on consent, you can withdraw it at any time. This includes AISP and PISP consents, which can be revoked through the consent management dashboard.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.8 Right to Lodge a Complaint</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You have the right to lodge a complaint with the National Commission for Data Protection in Cameroon or other relevant supervisory authority.
                </p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed mt-4">
              To exercise any of these rights, please contact our Data Protection Officer at <a href="mailto:dpo@kangopenbanking.cm" className="text-primary hover:underline">dpo@kangopenbanking.cm</a>. We will respond to your request within 30 days.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Cookies and Tracking Technologies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use cookies and similar technologies for authentication, session management, preferences, security, and analytics. These include:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Strictly necessary cookies:</strong> Required for authentication, security, and core functionality</li>
              <li><strong>Functional cookies:</strong> Remember your preferences and settings</li>
              <li><strong>Analytics cookies:</strong> Help us understand usage patterns and improve services</li>
              <li><strong>Performance cookies:</strong> Monitor system performance and error rates</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              For detailed information about cookies we use and how to manage them, see our <Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Automated Decision-Making and Profiling</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We use automated decision-making for the following purposes:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Fraud detection:</strong> Automated systems analyze transaction patterns to identify suspicious activities</li>
              <li><strong>Risk assessment:</strong> Algorithmic evaluation of API usage patterns and transaction volumes</li>
              <li><strong>Sanctions screening:</strong> Automated matching against international sanctions lists</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You have the right to request human review of automated decisions that have legal or similarly significant effects on you.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Children's Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Our services are not intended for individuals under 18 years of age. We do not knowingly collect personal data from children. If you believe we have inadvertently collected data from a minor, please contact us immediately at <a href="mailto:privacy@kangopenbanking.cm" className="text-primary hover:underline">privacy@kangopenbanking.cm</a>.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Changes to This Privacy Notice</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Notice periodically to reflect changes in our practices, technology, legal requirements, or business operations. Material changes will be communicated via:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
              <li>Email notification to registered users</li>
              <li>Prominent notice on our website and developer portal</li>
              <li>In-app notifications for mobile applications</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Continued use of our services after the effective date of changes constitutes acceptance of the updated Privacy Notice. We recommend reviewing this notice regularly.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Additional Information for Specific Services</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">15.1 AISP Services</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When using our Account Information Services, we process account data only with your explicit consent and within the scope granted. Consents can be managed and revoked at any time through your <Link to="/consent-management" className="text-primary hover:underline">consent management dashboard</Link>.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">15.2 PISP Services</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Payment initiation requires Strong Customer Authentication (SCA). We process payment instructions only with explicit authorization and do not store full payment credentials.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">15.3 Developer Portal</h3>
                <p className="text-muted-foreground leading-relaxed">
                  API keys and credentials are encrypted and never stored in plain text. Sandbox environment data is anonymized and automatically purged every 90 days.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Contact Us</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>For privacy-related inquiries, to exercise your data protection rights, or to report a data breach, contact our Data Protection Officer:</p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-3">
                <p><strong>Data Protection Officer</strong></p>
                <p className="font-medium">Email: <a href="mailto:dpo@kangopenbanking.cm" className="text-primary hover:underline">dpo@kangopenbanking.cm</a></p>
                <p className="font-medium">Privacy Team: <a href="mailto:privacy@kangopenbanking.cm" className="text-primary hover:underline">privacy@kangopenbanking.cm</a></p>
                <p className="font-medium">Phone: +237 6 22 02 25 67</p>
                <p className="font-medium">Address: Bamenda, Cameroon</p>
              </div>
              <div className="mt-4">
                <p className="font-semibold mb-2">Related Policies and Resources:</p>
                <ul className="space-y-1">
                  <li><Link to="/terms" className="text-primary hover:underline">Terms of Service</Link></li>
                  <li><Link to="/cookies" className="text-primary hover:underline">Cookie Policy</Link></li>
                  <li><Link to="/data-protection" className="text-primary hover:underline">Data Protection Framework</Link></li>
                  <li><Link to="/security-policy" className="text-primary hover:underline">Security Policy</Link></li>
                  <li><Link to="/aup" className="text-primary hover:underline">Acceptable Use Policy</Link></li>
                </ul>
              </div>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
