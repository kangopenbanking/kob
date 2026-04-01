import { Helmet } from "react-helmet-async";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { DocNavigation } from "@/components/developer/DocNavigation";

export default function DeveloperSupport() {
  const [sending, setSending] = useState(false);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSending(true);
    setTimeout(() => {
      setSending(false);
      toast.success("Support request submitted. We'll respond within 24 hours.");
      (e.target as HTMLFormElement).reset();
    }, 1000);
  };

  return (
    <>
      <Helmet>
        <title>Developer Support | Kang Open Banking Developer Docs</title>
        <meta name="description" content="Get help with the Kang Open Banking API. Contact developer support, browse FAQs, and access community resources." />
        <link rel="canonical" href="https://kangopenbanking.com/developer/support" />
      </Helmet>

      <div className="max-w-4xl space-y-10">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Developer Support</h1>
          <p className="text-lg text-muted-foreground">
            Get help integrating with the Kang Open Banking API. Our developer support team responds within 24 hours on business days.
          </p>
        </div>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="contact">Contact Channels</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-border rounded-lg">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-foreground">Channel</th>
                  <th className="text-left p-3 font-medium text-foreground">Details</th>
                  <th className="text-left p-3 font-medium text-foreground">Response Time</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Email", "developers@kangopenbanking.com", "< 24 hours"],
                  ["Support Form", "Below on this page", "< 24 hours"],
                  ["Status Page", "/developer/status", "Real-time"],
                  ["API Status Email", "Subscribe at /developer/status", "Instant alerts"],
                ].map(([channel, details, time]) => (
                  <tr key={channel} className="border-t border-border">
                    <td className="p-3 font-medium text-foreground">{channel}</td>
                    <td className="p-3 text-muted-foreground">{details}</td>
                    <td className="p-3 text-muted-foreground">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="faq">Common Questions</h2>
          <div className="space-y-4">
            {[
              { q: "How do I get sandbox credentials?", a: "Use the public test credentials: sk_test_sandbox_KangOB2026Demo. No signup required. See /developer/sandbox for details." },
              { q: "Why is my API call returning 401?", a: "Check that your Authorization header uses 'Bearer ' prefix (with a space). Verify you're using the correct key for the environment (sk_test_ for sandbox, sk_live_ for production)." },
              { q: "How do I test webhooks locally?", a: "Use ngrok or a similar tunnel. Then use POST /v1/sandbox/webhooks to trigger test events to your tunnel URL." },
              { q: "What's the rate limit for sandbox?", a: "60 requests/minute, 1,000 requests/day. These reset at midnight UTC." },
            ].map((faq) => (
              <div key={faq.q} className="border border-border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">{faq.q}</h3>
                <p className="text-sm text-muted-foreground">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold text-foreground mb-4" id="form">Submit a Request</h2>
          <form onSubmit={handleSubmit} className="space-y-4 border border-border rounded-lg p-6">
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Email</label>
              <Input type="email" required placeholder="you@company.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Subject</label>
              <Input required placeholder="e.g. Webhook signature mismatch" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">Description</label>
              <Textarea required rows={5} placeholder="Include your request_id, endpoint, and any error messages..." />
            </div>
            <Button type="submit" disabled={sending}>
              {sending ? "Sending..." : "Submit Request"}
            </Button>
          </form>
        </section>

        <DocNavigation
          previousPage={{ title: "Developer Home", path: "/developer" }}
        />
      </div>
    </>
  );
}
