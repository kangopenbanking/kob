import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { HelpCircle, Book, Shield, Code, CreditCard, Users } from "lucide-react";
import { SEO } from "@/components/SEO";

const FAQ_ITEMS = [
  { question: "What is Kang Open Banking?", answer: "Kang Open Banking is Cameroon's unified banking API platform that connects financial institutions, fintech companies, and developers across the Central African region with a single, secure API." },
  { question: "How do I get started?", answer: "Register for an account, complete KYC verification (usually approved within 24–48 hours), access the free sandbox, build your integration with our SDKs, test thoroughly, and request production credentials." },
  { question: "Is it secure and compliant?", answer: "Yes. We use TLS 1.3 and AES-256 encryption, OAuth 2.0 with OpenID Connect, optional mTLS, and hold PCI-DSS Level 1, ISO 27001, and SOC 2 Type II certifications. Fully COBAC and BEAC compliant." },
  { question: "What financial institutions do you support?", answer: "Over 25 institutions across Cameroon including major commercial banks, microfinance institutions, credit unions (CamCCUL network), and mobile money operators (MTN Mobile Money, Orange Money)." },
  { question: "What APIs do you provide?", answer: "Account Information Services (AISP), Payment Initiation Services (PISP), and Mobile Money services covering MTN Mobile Money and Orange Money collections and disbursements." },
  { question: "What are the API rate limits?", answer: "Sandbox: 100 requests per minute. Production Standard: 1,000 requests per minute. Enterprise: custom limits. Burst up to 2,000 requests per minute for short periods." },
  { question: "How much does it cost?", answer: "Sandbox is free forever. Production has pay-as-you-go starter pricing, monthly Growth subscriptions with included calls, and custom Enterprise pricing with dedicated support and SLAs." },
];

export default function FAQ() {
  return (
    <div className="container mx-auto px-4 py-12">
      <SEO
        title="Frequently Asked Questions"
        description="Answers about Kang Open Banking APIs, integration, security, pricing, compliance, and developer support across Cameroon and CEMAC."
        canonical="https://kangopenbanking.com/faq"
        faqItems={FAQ_ITEMS}
      />
      <div className="max-w-4xl mx-auto">
        {/* Hero Section */}
        <section className="text-center mb-12">
          <Badge variant="outline" className="mb-4">FAQ</Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Find answers to common questions about Kang Open Banking, our APIs, and integration process
          </p>
        </section>


        {/* Quick Links */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
          <Card className="p-4 text-center hover:shadow-lg transition-shadow">
            <Book className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Documentation</h3>
            <Link to="/documentation">
              <Button variant="link" size="sm">View Docs</Button>
            </Link>
          </Card>
          <Card className="p-4 text-center hover:shadow-lg transition-shadow">
            <Code className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Developer Portal</h3>
            <Link to="/developer">
              <Button variant="link" size="sm">Go to Portal</Button>
            </Link>
          </Card>
          <Card className="p-4 text-center hover:shadow-lg transition-shadow">
            <HelpCircle className="h-8 w-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Contact Support</h3>
            <Link to="/contact">
              <Button variant="link" size="sm">Get Help</Button>
            </Link>
          </Card>
        </div>

        {/* General Questions */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">General Questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>What is Kang Open Banking?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Kang Open Banking is Cameroon's premier unified banking API platform that connects financial institutions, fintech companies, and developers across the Central African region. We provide a single, secure API to access multiple banks, credit unions, and mobile money operators.
                  </p>
                  <p>
                    Our platform enables you to build financial applications that can read account information (AISP), initiate payments (PISP), and integrate mobile money services—all while maintaining the highest security standards and regulatory compliance with COBAC and BEAC.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>How do I get started?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>Getting started with Kang Open Banking is simple:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li><strong>Register for an account:</strong> Sign up on our platform with your business details</li>
                    <li><strong>Complete KYC verification:</strong> Submit required documents for identity and business verification (usually approved within 24-48 hours)</li>
                    <li><strong>Access sandbox environment:</strong> Get instant access to test APIs with sample data</li>
                    <li><strong>Build your integration:</strong> Use our comprehensive documentation and SDKs to integrate</li>
                    <li><strong>Test thoroughly:</strong> Use our sandbox to test all scenarios</li>
                    <li><strong>Go live:</strong> Request production credentials and deploy your application</li>
                  </ol>
                  <p>
                    Our developer support team is available 24/7 to help you through each step.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>Is it secure and compliant?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Yes, security and compliance are our top priorities. Kang Open Banking implements multiple layers of security:
                  </p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Encryption:</strong> TLS 1.3 for data in transit, AES-256 for data at rest</li>
                    <li><strong>Authentication:</strong> OAuth 2.0 with OpenID Connect, optional Mutual TLS (mTLS)</li>
                    <li><strong>Certifications:</strong> PCI-DSS Level 1, ISO 27001, SOC 2 Type II</li>
                    <li><strong>Regulatory Compliance:</strong> Full COBAC and BEAC compliance</li>
                    <li><strong>24/7 Monitoring:</strong> Real-time threat detection and automated incident response</li>
                  </ul>
                  <p>
                    All financial data access requires explicit user consent and can be revoked at any time. We undergo regular third-party security audits and maintain comprehensive audit trails.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>What financial institutions do you support?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  We connect to over 25 financial institutions across Cameroon, including major commercial banks, microfinance institutions, credit unions (CamCCUL network), and mobile money operators (MTN Mobile Money, Orange Money). New institutions are added regularly. Check our Developer Portal for the complete, up-to-date list of supported institutions.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>What does open banking mean for end users?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Open banking gives users secure control over their financial data. Instead of sharing passwords, users can grant authorized apps limited access to their banking information through secure APIs. Benefits include: better budgeting and money management tools, easier loan applications with automatic income verification, seamless payment experiences, account aggregation across multiple banks, and the ability to revoke access anytime.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Technical Questions */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Code className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Technical Questions</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="tech-1">
              <AccordionTrigger>What APIs do you provide?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>We provide comprehensive APIs across three main categories:</p>
                  
                  <div className="space-y-4 mt-4">
                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Account Information Services (AISP)</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                        <li>Account details and metadata</li>
                        <li>Real-time balance information</li>
                        <li>Transaction history with categorization</li>
                        <li>Standing orders and direct debits</li>
                        <li>Beneficiaries lists</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Payment Initiation Services (PISP)</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                        <li>Domestic payments (single and bulk)</li>
                        <li>International transfers (SWIFT)</li>
                        <li>Payment status tracking</li>
                        <li>Payment consent management</li>
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-foreground mb-2">Mobile Money Services</h4>
                      <ul className="list-disc list-inside space-y-1 ml-4 text-sm">
                        <li>MTN Mobile Money integration</li>
                        <li>Orange Money integration</li>
                        <li>Collection (receive payments)</li>
                        <li>Disbursement (send money)</li>
                        <li>Balance and transaction queries</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-2">
              <AccordionTrigger>What authentication methods are supported?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>We support multiple authentication methods depending on your use case:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>OAuth 2.0 with OpenID Connect:</strong> Primary method for production applications, industry-standard authorization</li>
                    <li><strong>Bearer Token Authentication:</strong> Simple token-based auth for API requests</li>
                    <li><strong>Mutual TLS (mTLS):</strong> Enhanced security through client certificates for sensitive operations</li>
                    <li><strong>API Key Authentication:</strong> For sandbox testing and non-sensitive operations</li>
                  </ul>
                  <p>All methods include support for refresh tokens, and we recommend implementing token rotation for security.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-3">
              <AccordionTrigger>What are the API rate limits?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>Rate limits vary by environment and subscription tier:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Sandbox:</strong> 100 requests per minute</li>
                    <li><strong>Production (Standard):</strong> 1,000 requests per minute</li>
                    <li><strong>Production (Enterprise):</strong> Custom limits based on your needs</li>
                    <li><strong>Burst Limit:</strong> Up to 2,000 requests per minute for short periods</li>
                  </ul>
                  <p>Rate limit information is included in response headers: X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset. If you exceed limits, you'll receive a 429 Too Many Requests response. Contact sales for higher limits.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-4">
              <AccordionTrigger>Do you provide SDKs or libraries?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Yes, we provide official SDKs for multiple programming languages: JavaScript/TypeScript (Node.js and React), Python, PHP, Java, and C#/.NET. We also provide a Postman collection for quick API testing. All SDKs are open source and available on our GitHub. SDKs handle authentication, request signing, error handling, and include TypeScript types for better development experience.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-5">
              <AccordionTrigger>How do I handle webhooks?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>Webhooks notify your application of events in real-time:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>Configure your webhook URL in the developer dashboard</li>
                    <li>Implement an HTTPS endpoint to receive POST requests</li>
                    <li>Verify webhook signatures using your webhook secret</li>
                    <li>Return a 200 OK response within 5 seconds</li>
                    <li>Process the event asynchronously if needed</li>
                  </ol>
                  <p>
                    We support webhooks for: payment status changes, consent updates, account changes, transaction notifications, and more. Failed deliveries are automatically retried with exponential backoff.
                  </p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="tech-6">
              <AccordionTrigger>What data formats do you support?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  All API endpoints use JSON for request and response bodies. We also support ISO 20022 XML format for payment messages (pain.001, pacs.008, camt.053) and SWIFT MT messages (MT103, MT940) for international transfers. Date/time values follow ISO 8601 format. Currency amounts use XAF (Central African Franc) unless specified otherwise.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Pricing & Billing */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Pricing & Billing</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="pricing-1">
              <AccordionTrigger>How much does it cost?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>Our pricing is flexible and scales with your usage:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Sandbox:</strong> Free forever for testing and development</li>
                    <li><strong>Starter:</strong> Pay-as-you-go based on API calls (no monthly fee)</li>
                    <li><strong>Growth:</strong> Monthly subscription with included API calls</li>
                    <li><strong>Enterprise:</strong> Custom pricing with dedicated support, SLA, and volume discounts</li>
                  </ul>
                  <p>Pricing varies by API type: Account information queries, payment initiations, and mobile money transactions have different rates. Contact our sales team for a detailed pricing quote tailored to your expected usage.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pricing-2">
              <AccordionTrigger>Are there any setup fees?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  No, there are no setup fees or onboarding costs. You can start integrating immediately with our sandbox environment for free. You only pay when you go to production and start processing real transactions. Enterprise clients with custom requirements may have implementation fees depending on the scope of customization needed.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pricing-3">
              <AccordionTrigger>What payment methods do you accept?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  We accept multiple payment methods: Bank transfers (within Cameroon and CEMAC), Mobile Money (MTN, Orange), Credit/Debit cards (Visa, Mastercard) via Stripe, and Wire transfers for international clients. Enterprise customers can also opt for monthly invoicing with NET-30 payment terms.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="pricing-4">
              <AccordionTrigger>Can I get a refund?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  We offer refunds on a case-by-case basis for service credits due to SLA breaches or technical issues on our end. Monthly subscription fees are non-refundable, but you can cancel anytime and won't be charged for the next billing cycle. For unused API call credits, we provide a 30-day money-back guarantee if you're not satisfied with the service.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Compliance & Legal */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Compliance & Legal</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="legal-1">
              <AccordionTrigger>What regulations do you comply with?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>We maintain full compliance with Central African financial regulations:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>COBAC Regulations:</strong> R-2018/01 (Payment Services), R-2005/01 (AML/CFT), R-2001/08 (Banking Secrecy)</li>
                    <li><strong>BEAC Guidelines:</strong> Payment system integration, foreign exchange controls</li>
                    <li><strong>Cameroon Data Protection Law:</strong> Law No. 2019/020 on personal data protection</li>
                    <li><strong>International Standards:</strong> PCI-DSS Level 1, ISO 27001, SOC 2 Type II</li>
                  </ul>
                  <p>We also follow GDPR principles where applicable and maintain ongoing dialogue with regulators to ensure continued compliance.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="legal-2">
              <AccordionTrigger>How do you handle user consent?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  User consent is central to our platform. Before any financial data is shared, users must explicitly authorize your application through our secure consent flow. Users see exactly what data will be shared, for how long, and can revoke access at any time through their bank or our consent management portal. All consents are logged with audit trails. Consents expire after a defined period (typically 90 days) and require renewal. We comply with COBAC's strong customer authentication (SCA) requirements for sensitive operations.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="legal-3">
              <AccordionTrigger>Where is data stored?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  All customer data is primarily stored within Cameroon and the CEMAC region in compliance with COBAC data localization requirements. We use secure, ISO 27001-certified data centers with geographic redundancy. For operational purposes (e.g., monitoring, support), some data may be processed by international service providers, but only with appropriate safeguards (Standard Contractual Clauses) and in compliance with Cameroon data protection law.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="legal-4">
              <AccordionTrigger>What happens if there's a data breach?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>While we implement extensive security measures to prevent breaches, we have a comprehensive incident response plan:</p>
                  <ol className="list-decimal list-inside space-y-2 ml-4">
                    <li>Immediate containment and investigation (24/7 security team)</li>
                    <li>Notification to data protection authority within 72 hours</li>
                    <li>Direct notification to affected users without undue delay</li>
                    <li>Detailed incident report including nature, impact, and mitigation</li>
                    <li>Post-incident review and security improvements</li>
                  </ol>
                  <p>We maintain cyber insurance coverage and follow industry best practices for breach notification and remediation.</p>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* Support */}
        <section className="mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Users className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">Support & Resources</h2>
          </div>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="support-1">
              <AccordionTrigger>What support do you provide?</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-3 text-muted-foreground">
                  <p>We offer multiple support channels based on your subscription tier:</p>
                  <ul className="list-disc list-inside space-y-2 ml-4">
                    <li><strong>Documentation:</strong> Comprehensive API docs, integration guides, code examples</li>
                    <li><strong>Email Support:</strong> support@kangopenbanking.com (24-48 hour response)</li>
                    <li><strong>Live Chat:</strong> Mon-Fri, 8AM-6PM WAT (Growth and Enterprise)</li>
                    <li><strong>24/7 Critical Support:</strong> Phone hotline for production emergencies (Enterprise)</li>
                    <li><strong>Dedicated Account Manager:</strong> For Enterprise clients</li>
                    <li><strong>Developer Community:</strong> Forum and Discord server</li>
                  </ul>
                  <p>Response times vary by issue severity and subscription tier—check our SLA page for details.</p>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-2">
              <AccordionTrigger>Do you offer implementation support?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Yes! We provide various levels of implementation support. All clients get access to our comprehensive documentation and code examples. Growth and Enterprise tiers include technical consulting hours. Enterprise clients can opt for white-glove onboarding with dedicated solutions architects. We also offer professional services for custom integrations, including on-site workshops and integration sprints. Contact sales to discuss your specific needs.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-3">
              <AccordionTrigger>How long does integration typically take?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Integration time varies by complexity. A basic AISP integration (read-only account data) typically takes 1-2 weeks. Full PISP integration (payments) usually takes 2-4 weeks. Mobile money integration adds 1-2 weeks. Complex enterprise integrations with custom requirements can take 6-12 weeks. Most developers can complete a sandbox integration in 1-3 days. We provide test credentials immediately upon signup to accelerate your development.
                </p>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="support-4">
              <AccordionTrigger>Can you help with regulatory compliance?</AccordionTrigger>
              <AccordionContent>
                <p className="text-muted-foreground">
                  Yes, our compliance team can provide guidance on COBAC/BEAC requirements, data protection obligations, and AML/KYC procedures. We offer compliance consultation services and can connect you with local legal experts. While we ensure our platform is compliant, you're responsible for your application's compliance. We provide documentation and best practices to help you meet regulatory requirements. Enterprise clients get access to compliance workshops and regulatory update briefings.
                </p>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </section>

        {/* CTA */}
        <section>
          <Card className="p-8 text-center bg-gradient-to-br from-primary/10 to-primary/5">
            <h2 className="text-2xl font-bold mb-4">Still Have Questions?</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Our support team is ready to help. Reach out via email, chat, or schedule a call with our solutions team.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/contact">
                <Button size="lg">Contact Support</Button>
              </Link>
              <Link to="/documentation">
                <Button size="lg" variant="outline">Browse Documentation</Button>
              </Link>
            </div>
          </Card>
        </section>
      </div>
    </div>
  );
}