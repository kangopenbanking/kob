import { ScrollArea } from "@/components/ui/scroll-area";

export default function Cookies() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <h1 className="text-4xl font-bold mb-8">Cookie Policy</h1>
      <p className="text-sm text-muted-foreground mb-8">Last updated: October 18, 2025</p>
      
      <ScrollArea className="h-[calc(100vh-200px)]">
        <div className="space-y-8 pr-4">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. What Are Cookies?</h2>
            <p className="text-muted-foreground leading-relaxed">
              Cookies are small text files stored on your device when you visit our website. They help us provide a better user experience, remember your preferences, and analyze site usage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Types of Cookies We Use</h2>
            
            <div className="space-y-6">
              <div className="border rounded-lg p-4">
                <h3 className="text-xl font-medium mb-2">2.1 Essential Cookies</h3>
                <p className="text-muted-foreground mb-2">Required for the website to function properly.</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 text-sm">
                  <li>Authentication and session management</li>
                  <li>Security and fraud prevention</li>
                  <li>Load balancing</li>
                  <li>Cannot be disabled</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-xl font-medium mb-2">2.2 Performance Cookies</h3>
                <p className="text-muted-foreground mb-2">Help us understand how visitors interact with our website.</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 text-sm">
                  <li>Page visit statistics</li>
                  <li>Navigation paths</li>
                  <li>Error tracking</li>
                  <li>Load time monitoring</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-xl font-medium mb-2">2.3 Functional Cookies</h3>
                <p className="text-muted-foreground mb-2">Remember your preferences and personalize your experience.</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 text-sm">
                  <li>Language preferences</li>
                  <li>Theme selection (dark/light mode)</li>
                  <li>Dashboard layouts</li>
                  <li>Notification preferences</li>
                </ul>
              </div>

              <div className="border rounded-lg p-4">
                <h3 className="text-xl font-medium mb-2">2.4 Analytics Cookies</h3>
                <p className="text-muted-foreground mb-2">Help us improve our services by collecting anonymous usage data.</p>
                <ul className="list-disc list-inside text-muted-foreground space-y-1 ml-4 text-sm">
                  <li>Feature usage patterns</li>
                  <li>API endpoint performance</li>
                  <li>User journey analysis</li>
                  <li>A/B testing results</li>
                </ul>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Third-Party Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We may use third-party services that set their own cookies:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li><strong>Google Analytics:</strong> Website analytics and usage tracking</li>
              <li><strong>Cloudflare:</strong> Security and content delivery</li>
              <li><strong>Stripe:</strong> Payment processing (when applicable)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Cookie Duration</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-2">Session Cookies</h3>
                <p className="text-muted-foreground text-sm">
                  Temporary cookies deleted when you close your browser. Used for authentication and session management.
                </p>
              </div>
              <div>
                <h3 className="text-lg font-medium mb-2">Persistent Cookies</h3>
                <p className="text-muted-foreground text-sm">
                  Remain on your device until expiration or manual deletion. Used for preferences and analytics (typically 1-24 months).
                </p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Managing Cookies</h2>
            <div className="space-y-4">
              <h3 className="text-xl font-medium mb-2">5.1 Browser Settings</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                You can control cookies through your browser settings:
              </p>
              <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4 text-sm">
                <li><strong>Chrome:</strong> Settings → Privacy and Security → Cookies</li>
                <li><strong>Firefox:</strong> Options → Privacy & Security → Cookies</li>
                <li><strong>Safari:</strong> Preferences → Privacy → Cookies</li>
                <li><strong>Edge:</strong> Settings → Privacy → Cookies</li>
              </ul>

              <h3 className="text-xl font-medium mb-2 mt-6">5.2 Our Cookie Preference Center</h3>
              <p className="text-muted-foreground leading-relaxed">
                You can manage your cookie preferences through our Cookie Preference Center, accessible via the banner on your first visit or through your account settings.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Impact of Disabling Cookies</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Disabling certain cookies may affect functionality:
            </p>
            <ul className="list-disc list-inside text-muted-foreground space-y-2 ml-4">
              <li>You may not be able to sign in or access certain features</li>
              <li>Your preferences may not be saved</li>
              <li>Some pages may not display correctly</li>
              <li>You may see less relevant information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Do Not Track (DNT)</h2>
            <p className="text-muted-foreground leading-relaxed">
              We respect Do Not Track browser settings. When DNT is enabled, we do not use analytics or tracking cookies, though essential cookies remain necessary for core functionality.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Updates to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this Cookie Policy periodically to reflect changes in technology, regulation, or our practices. Significant changes will be communicated via email or platform notification.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Contact Us</h2>
            <div className="text-muted-foreground leading-relaxed space-y-2">
              <p>Questions about our use of cookies?</p>
              <p className="font-medium">Email: privacy@kangopenbanking.com</p>
              <p className="font-medium">Phone: +237 6 22 02 25 67</p>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
}
