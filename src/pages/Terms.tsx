import { ScrollArea } from "@/components/ui/scroll-area";

export default function Terms() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Agreement to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Kang Open Banking API services ("Services"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you may not access the Services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Service Description</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kang Open Banking provides a unified API platform for accessing banking services across financial institutions in Cameroon, including commercial banks, credit unions, and mobile money operators.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. User Obligations</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-xl font-medium mb-2">3.1 Registration</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Provide accurate and complete registration information</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Notify us immediately of any unauthorized access</li>
                  <li>Accept responsibility for all activities under your account</li>
                </ul>
              </div>
              <div>
                <h3 className="text-xl font-medium mb-2">3.2 Compliance</h3>
                <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                  <li>Comply with COBAC and BEAC regulations</li>
                  <li>Adhere to data protection and privacy laws</li>
                  <li>Follow AML/KYC requirements</li>
                  <li>Respect intellectual property rights</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. API Usage</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-medium mb-2">4.1 License</h3>
              <p className="text-muted-foreground leading-relaxed">
                We grant you a limited, non-exclusive, non-transferable license to access and use the API in accordance with these Terms and your subscription plan.
              </p>
              
              <h3 className="text-xl font-medium mb-2">4.2 Restrictions</h3>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Do not reverse engineer or attempt to extract source code</li>
                <li>Do not exceed rate limits specified in your plan</li>
                <li>Do not use the API for illegal or fraudulent activities</li>
                <li>Do not sublicense or resell API access without authorization</li>
                <li>Do not interfere with service security or availability</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              All intellectual property rights in the Services, including but not limited to software, documentation, trademarks, and content, are owned by Kang Open Banking or its licensors. You may not use our intellectual property without prior written consent.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Payment Terms</h2>
            <div className="space-y-4">
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
                <li>Fees are based on your selected subscription plan</li>
                <li>Payment is due in advance on a monthly or annual basis</li>
                <li>All fees are non-refundable except as required by law</li>
                <li>We may modify pricing with 30 days notice</li>
                <li>Late payments may result in service suspension</li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive for 99.9% uptime as detailed in our SLA. However, we do not guarantee uninterrupted service and may perform scheduled maintenance with advance notice.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              To the maximum extent permitted by law:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>Services are provided "as is" without warranties</li>
              <li>We are not liable for indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed fees paid in the past 12 months</li>
              <li>We are not responsible for third-party actions or services</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Indemnification</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to indemnify and hold harmless Kang Open Banking from any claims, losses, or damages arising from your use of the Services, violation of these Terms, or infringement of any rights.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Termination</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Either party may terminate the agreement:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>With 30 days written notice</li>
              <li>Immediately for material breach</li>
              <li>Immediately for violation of applicable laws</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              Upon termination, your access will be revoked and data will be handled per our Privacy Policy.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Dispute Resolution</h2>
            <p className="text-muted-foreground leading-relaxed">
              Disputes shall be resolved through good faith negotiation. If unresolved, disputes shall be submitted to arbitration in Douala, Cameroon, under Cameroonian law.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms are governed by the laws of Cameroon and applicable CEMAC regulations, without regard to conflict of law provisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify these Terms at any time. Material changes will be communicated via email or platform notification at least 30 days in advance. Continued use constitutes acceptance of modified terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact Information</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>For questions about these Terms, contact us:</p>
              <p className="font-medium">Email: legal@kangopenbanking.cm</p>
              <p className="font-medium">Phone: +237 233 XX XX XX</p>
              <p className="font-medium">Address: Douala, Cameroon</p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
