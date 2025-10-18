import { ScrollArea } from "@/components/ui/scroll-area";

export default function Privacy() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kang Open Banking ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our banking API services and platform.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">2.1 Personal Information</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Name, email address, phone number</li>
                  <li>Company name and business details</li>
                  <li>Authentication credentials</li>
                  <li>Payment and billing information</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">2.2 Technical Information</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>IP addresses and device identifiers</li>
                  <li>API usage logs and request data</li>
                  <li>Browser type and operating system</li>
                  <li>Performance and diagnostic data</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">2.3 Financial Data</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Account information (with explicit consent)</li>
                  <li>Transaction data</li>
                  <li>Balance information</li>
                  <li>Payment instructions</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>To provide and maintain our API services</li>
              <li>To process transactions and payments</li>
              <li>To authenticate and authorize access</li>
              <li>To monitor and improve service performance</li>
              <li>To comply with legal and regulatory requirements</li>
              <li>To prevent fraud and enhance security</li>
              <li>To communicate service updates and support</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Sharing and Disclosure</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share your information with:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Financial institutions (with your explicit consent)</li>
              <li>Service providers who assist our operations</li>
              <li>Regulatory authorities (as required by law)</li>
              <li>Professional advisors (under confidentiality agreements)</li>
              <li>Third parties in case of merger or acquisition</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 mt-4">
              <li>TLS 1.3 encryption for data in transit</li>
              <li>AES-256 encryption for data at rest</li>
              <li>Multi-factor authentication</li>
              <li>Regular security audits and penetration testing</li>
              <li>Access controls and monitoring</li>
              <li>PCI-DSS compliance for payment data</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your information for as long as necessary to provide services and comply with legal obligations. Transaction data is retained for 7 years in accordance with COBAC regulations. You may request deletion of your data, subject to legal requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Under Cameroon data protection laws and GDPR (where applicable), you have the right to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Access your personal information</li>
              <li>Rectify inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to data processing</li>
              <li>Data portability</li>
              <li>Withdraw consent</li>
              <li>Lodge a complaint with supervisory authorities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. International Data Transfers</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your data is primarily stored within Cameroon and Central African region. Any international transfers comply with COBAC regulations and use appropriate safeguards such as standard contractual clauses.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Cookies and Tracking</h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar technologies for authentication, preferences, and analytics. See our <a href="/cookies" className="text-primary hover:underline">Cookie Policy</a> for details.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Privacy Policy periodically. We will notify you of material changes via email or platform notification. Continued use after changes constitutes acceptance.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Contact Us</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>For privacy-related inquiries, contact our Data Protection Officer:</p>
              <p className="font-medium">Email: privacy@kangopenbanking.cm</p>
              <p className="font-medium">Phone: +237 233 XX XX XX</p>
              <p className="font-medium">Address: Douala, Cameroon</p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
