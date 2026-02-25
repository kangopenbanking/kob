import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Lock, FlaskConical, Settings2, BarChart3, Webhook, ShieldCheck, ArrowRight } from "lucide-react";

const lockedFeatures = [
  { icon: FlaskConical, title: "Full Sandbox Environment", description: "Generate test accounts, simulate webhooks, and run end-to-end payment flows." },
  { icon: Settings2, title: "API Key Management", description: "Create production & sandbox keys, set IP allowlists, and configure rate limits." },
  { icon: BarChart3, title: "Analytics Dashboard", description: "Real-time API usage metrics, latency percentiles, and error rate monitoring." },
  { icon: Webhook, title: "Webhook Configuration", description: "Register callback URLs, view delivery logs, and replay failed events." },
  { icon: ShieldCheck, title: "mTLS Certificates", description: "Upload X.509 certificates for FAPI-compliant certificate-bound tokens." },
  { icon: Lock, title: "Production Access", description: "Go live with full KYB verification, compliance review, and dedicated support." },
];

export function AdvancedFeaturesGate() {
  return (
    <div className="relative rounded-2xl border-2 border-dashed border-primary/20 p-8 md:p-12 space-y-8">
      <div className="absolute -top-4 left-8 bg-background px-3">
        <span className="text-sm font-semibold text-primary flex items-center gap-1.5">
          <Lock className="h-3.5 w-3.5" /> Unlocked After Sign Up
        </span>
      </div>

      <div className="space-y-2">
        <h2 className="text-3xl font-bold">Advanced Features & Tools</h2>
        <p className="text-muted-foreground max-w-2xl">
          Create a free developer account to access the full platform — sandbox environment, production keys, webhooks, analytics, and more.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {lockedFeatures.map((item) => (
          <div
            key={item.title}
            className="relative p-4 rounded-lg border bg-muted/30 opacity-80"
          >
            <div className="flex items-start gap-3">
              <item.icon className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <h3 className="font-semibold text-sm">{item.title}</h3>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 pt-2">
        <Link to="/register">
          <Button size="lg" className="text-base px-8">
            Create Free Developer Account <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          Takes 30 seconds · Instant sandbox access · No payment required
        </p>
      </div>
    </div>
  );
}
