import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";

export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: February 16, 2026</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Welcome to Kang Open Banking ("KOB", "we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of our open banking platform, APIs, developer portal, and related services (collectively, the "Services").
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              By accessing or using the Services, you ("you," "your," or "User") agree to be legally bound by these Terms. If you are accessing the Services on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms, and references to "you" include both you individually and the organization.
            </p>
            <p className="text-muted-foreground leading-relaxed mb-4">
              <strong>IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE SERVICES.</strong>
            </p>
            <p className="text-muted-foreground leading-relaxed">
              We recommend printing or saving a copy of these Terms for your records.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. About Kang Open Banking</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Open Banking is a product of Kang Consultancy Co Ltd:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Registered in Canada under the Canada Business Corporations Act (CBCA) (s. 19 and 106), Registration No. 1381210-3, with offices in Port Dover, ON, Canada</li>
              <li>Registered in Cameroon under Reg. No. RCBDA2021B000451</li>
              <li>Regulated by the Ministry of Small and Medium-Sized Enterprises</li>
              <li>Accredited by the Management Centre (CGA/AMC) (Tax Reg. M102116572371B)</li>
              <li>Compliant with COBAC (Central African Banking Commission) regulations</li>
            </ul>
            <div className="bg-muted/50 rounded-lg p-4 mt-4">
              <p className="font-medium mb-2">Contact Information:</p>
              <p>Email: <a href="mailto:legal@kangopenbanking.com" className="text-primary hover:underline">legal@kangopenbanking.com</a></p>
              <p>Phone: +237 6 22 02 25 67</p>
              <p>Address: Bamenda, Cameroon</p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Definitions</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The following definitions apply throughout these Terms:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>"AISP"</strong> - Account Information Service Provider: a TPP authorized to access account information with user consent</li>
              <li><strong>"API"</strong> - Application Programming Interface: the technical interface provided by KOB for accessing Services</li>
              <li><strong>"Consent"</strong> - explicit authorization granted by a Payment Service User for data access or payment initiation</li>
              <li><strong>"Financial Institution" (FI)</strong> - banks, microfinance institutions, and other financial service providers integrated with KOB</li>
              <li><strong>"PISP"</strong> - Payment Initiation Service Provider: a TPP authorized to initiate payments on behalf of users</li>
              <li><strong>"PSU"</strong> - Payment Service User: an individual or entity using open banking services</li>
              <li><strong>"SCA"</strong> - Strong Customer Authentication: multi-factor authentication required for sensitive operations</li>
              <li><strong>"Sandbox"</strong> - the testing environment provided for development and integration</li>
              <li><strong>"TPP"</strong> - Third Party Provider: an organization registered to use KOB APIs (AISP, PISP, or both)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Service Description</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Kang Open Banking provides the following services:
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">4.1 Account Information Services (AISP)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Retrieve account details, balances, and transaction history</li>
                  <li>Access standing orders, direct debits, and beneficiaries</li>
                  <li>Real-time balance and transaction notifications</li>
                  <li>Multi-account aggregation across financial institutions</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.2 Payment Initiation Services (PISP)</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Initiate domestic payments in XAF currency</li>
                  <li>Single and bulk payment processing</li>
                  <li>Payment status tracking and confirmations</li>
                  <li>Scheduled and recurring payments</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.3 Mobile Money Integration</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>MTN Mobile Money and Orange Money transfers</li>
                  <li>Mobile money to bank account transfers</li>
                  <li>Balance inquiries and transaction verification</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.4 Developer Tools</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Comprehensive API documentation</li>
                  <li>Sandbox environment for testing</li>
                  <li>OAuth2 and OpenID Connect implementation</li>
                  <li>Webhooks for real-time notifications</li>
                  <li>SDK and code examples</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">4.5 Compliance and Security</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>KYC/AML verification services</li>
                  <li>Sanctions screening</li>
                  <li>Transaction monitoring and fraud detection</li>
                  <li>Consent management and revocation</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. User Eligibility and Registration</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">5.1 Eligibility Requirements</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">To use our Services, you must:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Be at least 18 years of age</li>
                  <li>Have legal capacity to enter into binding contracts</li>
                  <li>For TPPs: hold necessary regulatory authorizations or licenses</li>
                  <li>For organizations: be duly incorporated and in good standing</li>
                  <li>Not be located in or subject to sanctions by international bodies</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.2 Registration Process</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Complete the TPP registration form with accurate information</li>
                  <li>Provide required documentation (business registration, regulatory licenses)</li>
                  <li>Undergo KYC/AML verification</li>
                  <li>Accept Dynamic Client Registration (DCR) terms</li>
                  <li>Obtain and securely manage API credentials</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">5.3 Account Security</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You are responsible for maintaining the confidentiality of your account credentials, API keys, and access tokens. You must:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Use strong, unique passwords and enable multi-factor authentication</li>
                  <li>Never share credentials with unauthorized persons</li>
                  <li>Immediately notify us of any unauthorized access at <a href="mailto:security@kangopenbanking.cm" className="text-primary hover:underline">security@kangopenbanking.cm</a></li>
                  <li>Rotate API keys regularly (recommended every 90 days)</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  You are liable for all activities conducted under your account, whether authorized or not, until you notify us of a breach.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. API Usage and Restrictions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">6.1 Permitted Use</h3>
                <p className="text-muted-foreground leading-relaxed">You may use our APIs to:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Build applications that provide value to end users</li>
                  <li>Integrate open banking functionality into your services</li>
                  <li>Access data only within the scope of granted consents</li>
                  <li>Test and develop in the sandbox environment</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.2 Prohibited Activities</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">You must not:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Exceed rate limits or attempt to circumvent usage restrictions</li>
                  <li>Access data without valid, current consent from PSUs</li>
                  <li>Use the Services for illegal activities, fraud, or money laundering</li>
                  <li>Reverse engineer, decompile, or disassemble the APIs</li>
                  <li>Resell or sublicense access to the APIs without authorization</li>
                  <li>Store sensitive authentication data (passwords, PINs) in plain text</li>
                  <li>Scrape or harvest user data beyond consent scope</li>
                  <li>Interfere with the security or integrity of the Services</li>
                  <li>Use the Services to develop competing open banking platforms</li>
                  <li>Impersonate KOB or falsely claim endorsement</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">6.3 Rate Limits and Quotas</h3>
                <p className="text-muted-foreground leading-relaxed">
                  API usage is subject to rate limits based on your subscription tier:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Sandbox: 100 requests per minute</li>
                  <li>Production Basic: 300 requests per minute</li>
                  <li>Production Professional: 1,000 requests per minute</li>
                  <li>Enterprise: Custom limits</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  Exceeding rate limits may result in temporary suspension or throttling. Contact us for higher limits.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Consent and Data Protection</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">7.1 Consent Requirements</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Before accessing PSU data or initiating payments, you must:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Obtain explicit, informed consent using KOB's consent flow</li>
                  <li>Clearly explain what data will be accessed and how it will be used</li>
                  <li>Specify the duration of consent (maximum 90 days for AISP, single use for PISP)</li>
                  <li>Provide mechanisms for users to revoke consent at any time</li>
                  <li>Re-authenticate users for each new consent</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">7.2 Data Handling Obligations</h3>
                <p className="text-muted-foreground leading-relaxed">As a data processor, you must:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Process data only for the purposes specified in the consent</li>
                  <li>Implement appropriate security measures (encryption, access controls)</li>
                  <li>Not retain data longer than necessary or permitted by consent</li>
                  <li>Delete data upon consent revocation within 7 days</li>
                  <li>Comply with data subject rights requests (access, deletion, portability)</li>
                  <li>Report data breaches to KOB within 24 hours</li>
                  <li>Maintain records of processing activities</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">7.3 Privacy Compliance</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You must comply with all applicable data protection laws, including Cameroon Data Protection Law and GDPR where applicable. See our <Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link> and <Link to="/data-protection" className="text-primary hover:underline">Data Protection Framework</Link> for more details.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Intellectual Property Rights</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">8.1 KOB Intellectual Property</h3>
                <p className="text-muted-foreground leading-relaxed">
                  All intellectual property rights in the Services, including APIs, documentation, logos, trademarks, software, and content, are owned by or licensed to Kang Consultancy Co Ltd. These rights are protected by copyright, trademark, patent, and other intellectual property laws.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">8.2 Limited License</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We grant you a limited, non-exclusive, non-transferable, revocable license to:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Access and use the APIs in accordance with these Terms</li>
                  <li>Use our documentation for development purposes</li>
                  <li>Display KOB branding as required for "Powered by KOB" attribution</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-2">
                  This license terminates immediately upon termination of these Terms or your account.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">8.3 Your Content and Applications</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You retain all rights to your applications and content. However, you grant us a license to host, display, and use your developer profile information and application descriptions for promotional purposes.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">8.4 Feedback</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Any feedback, suggestions, or ideas you provide about the Services become our property, and we may use them without restriction or compensation.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Fees and Payment</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">9.1 Pricing Plans</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Our Services are offered under various pricing plans as detailed on our <Link to="/payments" className="text-primary hover:underline">pricing page</Link>. Fees are based on:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>API call volume (per request or monthly tiers)</li>
                  <li>Number of active consents</li>
                  <li>Payment transaction volume</li>
                  <li>Premium features (dedicated support, higher rate limits)</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">9.2 Billing</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Fees are billed monthly in advance or based on actual usage</li>
                  <li>Payment methods: bank transfer, mobile money, credit card (via Stripe)</li>
                  <li>Invoices are issued via email and available in your dashboard</li>
                  <li>All fees are in XAF (Central African CFA Franc) unless otherwise stated</li>
                  <li>Late payments incur a 2% monthly interest charge</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">9.3 Taxes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Fees are exclusive of taxes. You are responsible for all applicable taxes, including VAT, withholding tax, and other duties.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">9.4 Fee Changes</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may change fees with 30 days' notice. Continued use after the effective date constitutes acceptance.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Service Availability and Support</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">10.1 Service Level Commitments</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We aim for 99.9% uptime for production APIs. See our <Link to="/sla" className="text-primary hover:underline">Service Level Agreement</Link> for detailed commitments, exclusions, and remedies.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.2 Maintenance and Downtime</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to perform scheduled maintenance with 48 hours' notice. Emergency maintenance may occur without notice.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">10.3 Support</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Documentation and FAQs available 24/7</li>
                  <li>Email support: support@kangopenbanking.cm (response within 24 hours)</li>
                  <li>Developer forum and community support</li>
                  <li>Premium support: priority response, dedicated account manager (Enterprise plans)</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Liability and Disclaimers</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">11.1 Service "As Is"</h3>
                <p className="text-muted-foreground leading-relaxed">
                  THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR UNINTERRUPTED ACCESS.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">11.2 Limitation of Liability</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW:
                </p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>KOB shall not be liable for indirect, incidental, consequential, special, or punitive damages</li>
                  <li>Our total liability shall not exceed the fees paid by you in the 12 months preceding the claim</li>
                  <li>We are not liable for failures caused by third parties (Financial Institutions, network providers)</li>
                  <li>We are not responsible for your applications, data handling practices, or compliance failures</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">11.3 Financial Institution Liability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Financial Institutions connected to KOB are independent entities. We are not liable for their actions, errors, or failures to provide services.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree to indemnify, defend, and hold harmless Kang Consultancy Co Ltd, its affiliates, officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Your use or misuse of the Services</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of applicable laws or regulations</li>
              <li>Your infringement of third-party rights</li>
              <li>Your applications or content</li>
              <li>Your data handling or security breaches</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Termination and Suspension</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">13.1 Termination by You</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may terminate your account at any time by notifying us at <a href="mailto:support@kangopenbanking.cm" className="text-primary hover:underline">support@kangopenbanking.cm</a>. Prepaid fees are non-refundable.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">13.2 Termination by KOB</h3>
                <p className="text-muted-foreground leading-relaxed mb-2">We may suspend or terminate your account immediately if:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>You violate these Terms or our <Link to="/aup" className="text-primary hover:underline">Acceptable Use Policy</Link></li>
                  <li>Your account poses security or fraud risks</li>
                  <li>You fail to pay fees for 15 days after due date</li>
                  <li>We are required to do so by law or regulatory authority</li>
                  <li>You lose regulatory authorization or licenses</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">13.3 Effect of Termination</h3>
                <p className="text-muted-foreground leading-relaxed">Upon termination:</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-2">
                  <li>Your access to the Services is immediately revoked</li>
                  <li>API credentials are deactivated</li>
                  <li>You must cease all use of KOB APIs and branding</li>
                  <li>You must delete all PSU data obtained through our Services within 7 days</li>
                  <li>Obligations regarding confidentiality, indemnification, and liability survive termination</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Confidentiality</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              "Confidential Information" includes API keys, technical documentation, business terms, and non-public information disclosed by either party. You agree to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Keep Confidential Information strictly confidential</li>
              <li>Use it only for purposes of these Terms</li>
              <li>Not disclose it to third parties without prior written consent</li>
              <li>Protect it with the same care as your own confidential information (but no less than reasonable care)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Exceptions: information that is public, independently developed, or required to be disclosed by law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">15. Compliance with Laws</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You must comply with all applicable laws and regulations, including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>COBAC banking and financial services regulations</li>
              <li>Cameroon Data Protection Law and GDPR (where applicable)</li>
              <li>Anti-Money Laundering (AML) and Counter-Terrorist Financing (CTF) laws</li>
              <li>Consumer protection regulations</li>
              <li>Sanctions and export control laws</li>
              <li>PSD2-equivalent payment services directives</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">16. Dispute Resolution</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">16.1 Informal Resolution</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Before initiating formal proceedings, parties agree to attempt good faith negotiation for 30 days.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">16.2 Arbitration</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If negotiation fails, disputes shall be resolved through binding arbitration in Bamenda, Cameroon, under the Cameroon Arbitration Rules. The arbitration shall be conducted in English or French, as agreed by the parties.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">16.3 Exceptions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Either party may seek injunctive relief in court for intellectual property infringement or breach of confidentiality.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">17. Governing Law and Jurisdiction</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of Cameroon. For matters not subject to arbitration, the courts of Bamenda, Cameroon, have exclusive jurisdiction. International users also consent to the application of OHADA (Organization for the Harmonization of Business Law in Africa) commercial law principles.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">18. General Provisions</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">18.1 Entire Agreement</h3>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms, together with our Privacy Policy, SLA, AUP, and other referenced policies, constitute the entire agreement between you and KOB.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.2 Amendments</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may modify these Terms at any time. Material changes will be notified via email and the developer portal. Continued use after changes constitutes acceptance.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.3 Assignment</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may not assign these Terms without our prior written consent. We may assign our rights and obligations to affiliates or successors.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.4 Severability</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If any provision is found invalid or unenforceable, the remaining provisions remain in effect.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.5 No Waiver</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Failure to enforce any provision does not constitute a waiver of that provision.
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.6 Force Majeure</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Neither party is liable for failures due to circumstances beyond reasonable control (natural disasters, war, government actions, internet outages, etc.).
                </p>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">18.7 Language</h3>
                <p className="text-muted-foreground leading-relaxed">
                  These Terms are provided in English and French. In case of conflict, the English version prevails.
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">19. Contact Information</h2>
            <div className="text-muted-foreground leading-relaxed space-y-4">
              <p>For questions about these Terms or legal matters, contact us:</p>
              <div className="bg-muted/50 rounded-lg p-6 space-y-3">
                <p><strong>Legal Department</strong></p>
                <p className="font-medium">Email: <a href="mailto:legal@kangopenbanking.cm" className="text-primary hover:underline">legal@kangopenbanking.cm</a></p>
                <p className="font-medium">General Inquiries: <a href="mailto:info@kangopenbanking.cm" className="text-primary hover:underline">info@kangopenbanking.cm</a></p>
                <p className="font-medium">Phone: +237 6 22 02 25 67</p>
                <p className="font-medium">Address: Bamenda, Cameroon</p>
              </div>
              <div className="mt-4">
                <p className="font-semibold mb-2">Related Policies:</p>
                <ul className="space-y-1">
                  <li><Link to="/privacy" className="text-primary hover:underline">Privacy Policy</Link></li>
                  <li><Link to="/aup" className="text-primary hover:underline">Acceptable Use Policy</Link></li>
                  <li><Link to="/sla" className="text-primary hover:underline">Service Level Agreement</Link></li>
                  <li><Link to="/security-policy" className="text-primary hover:underline">Security Policy</Link></li>
                  <li><Link to="/data-protection" className="text-primary hover:underline">Data Protection Framework</Link></li>
                  <li><Link to="/compliance" className="text-primary hover:underline">Compliance Information</Link></li>
                </ul>
              </div>
            </div>
          </section>

          <section className="border-t pt-6">
            <p className="text-sm text-muted-foreground italic">
              By clicking "Accept" during registration or by accessing the Services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
            </p>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
