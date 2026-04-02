import { useState } from "react";
import { SEO } from "@/components/SEO";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Copy, Key, Rocket, ShieldCheck, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AutoDocNavigation } from "@/components/developer/AutoDocNavigation";

interface SandboxCredentials {
  client_id: string;
  api_key: string;
  merchant_id: string;
  webhook_secret: string;
}

const DeveloperRegistration = () => {
  const { toast } = useToast();
  const [step, setStep] = useState<"form" | "credentials">("form");
  const [loading, setLoading] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [credentials, setCredentials] = useState<SandboxCredentials | null>(null);
  const [form, setForm] = useState({
    appName: "",
    email: "",
    useCase: "",
    redirectUri: "",
  });

  const generateSandboxCredentials = () => {
    setLoading(true);
    // Simulate credential generation — in production this calls the backend
    setTimeout(() => {
      const rand = (len: number) =>
        Array.from(crypto.getRandomValues(new Uint8Array(len)))
          .map((b) => b.toString(36))
          .join("")
          .slice(0, len);

      setCredentials({
        client_id: `kob_client_${rand(24)}`,
        api_key: `kob_test_${rand(32)}`,
        merchant_id: `mch_test_${rand(16)}`,
        webhook_secret: `whsec_test_${rand(32)}`,
      });
      setStep("credentials");
      setLoading(false);
    }, 1200);
  };

  const copyToClipboard = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    toast({ title: "Copied", description: `${label} copied to clipboard` });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.appName || !form.email || !form.useCase) {
      toast({ title: "Missing fields", description: "Please fill in all required fields", variant: "destructive" });
      return;
    }
    generateSandboxCredentials();
  };

  return (
    <div className="space-y-8">
      <SEO
        title="Register Developer App | Kang Open Banking"
        description="Create a free developer account and receive instant sandbox API credentials for the Kang Open Banking API."
      />

      <div>
        <h1 className="text-3xl font-bold">Developer Registration</h1>
        <p className="text-muted-foreground mt-2">
          Register your application and receive instant sandbox credentials. No payment required.
        </p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-2 ${step === "form" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === "form" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>1</div>
          Register App
        </div>
        <div className="h-px w-12 bg-border" />
        <div className={`flex items-center gap-2 ${step === "credentials" ? "text-primary font-semibold" : "text-muted-foreground"}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${step === "credentials" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>2</div>
          Get Credentials
        </div>
      </div>

      {step === "form" && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Rocket className="h-5 w-5" /> Register Your Application</CardTitle>
            <CardDescription>Takes 30 seconds. You'll receive sandbox credentials instantly.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4 max-w-lg">
              <div className="space-y-2">
                <Label htmlFor="appName">Application Name *</Label>
                <Input id="appName" placeholder="My FinTech App" value={form.appName} onChange={(e) => setForm({ ...form, appName: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Developer Email *</Label>
                <Input id="email" type="email" placeholder="dev@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="useCase">Use Case *</Label>
                <Select value={form.useCase} onValueChange={(v) => setForm({ ...form, useCase: v })}>
                  <SelectTrigger><SelectValue placeholder="Select your use case" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="payment_aggregation">Payment Aggregation</SelectItem>
                    <SelectItem value="account_information">Account Information (AISP)</SelectItem>
                    <SelectItem value="payment_initiation">Payment Initiation (PISP)</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money Integration</SelectItem>
                    <SelectItem value="credit_scoring">Credit Scoring</SelectItem>
                    <SelectItem value="marketplace">Marketplace / E-commerce</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="redirectUri">Redirect URI (optional)</Label>
                <Input id="redirectUri" placeholder="https://app.example.com/callback" value={form.redirectUri} onChange={(e) => setForm({ ...form, redirectUri: e.target.value })} />
                <p className="text-xs text-muted-foreground">Required for OAuth2 flows. Can be added later.</p>
              </div>
              <Button type="submit" size="lg" disabled={loading}>
                {loading ? "Generating…" : "Create Sandbox App"}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {step === "credentials" && credentials && (
        <div className="space-y-6">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <CheckCircle className="h-5 w-5" /> Sandbox Credentials Ready
              </CardTitle>
              <CardDescription>
                Save these credentials now — the API key and webhook secret are shown <strong>only once</strong>.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {[
                { label: "Client ID", value: credentials.client_id, secret: false },
                { label: "Sandbox API Key", value: credentials.api_key, secret: true },
                { label: "Test Merchant ID", value: credentials.merchant_id, secret: false },
                { label: "Webhook Secret", value: credentials.webhook_secret, secret: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{item.label}</Label>
                    <code className="block text-sm font-mono">
                      {item.secret && !showSecret
                        ? item.value.slice(0, 12) + "•".repeat(20)
                        : item.value}
                    </code>
                  </div>
                  <div className="flex items-center gap-1">
                    {item.secret && (
                      <Button variant="ghost" size="icon" onClick={() => setShowSecret(!showSecret)}>
                        {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => copyToClipboard(item.value, item.label)}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Key className="h-5 w-5" /> Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <a href="/developer/getting-started" className="p-4 border rounded-lg hover:border-primary/50 transition-colors text-center">
                  <Rocket className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <h4 className="font-semibold text-sm">Getting Started Guide</h4>
                  <p className="text-xs text-muted-foreground mt-1">Make your first API call</p>
                </a>
                <a href="/developer/sandbox/overview" className="p-4 border rounded-lg hover:border-primary/50 transition-colors text-center">
                  <ShieldCheck className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <h4 className="font-semibold text-sm">Sandbox Environment</h4>
                  <p className="text-xs text-muted-foreground mt-1">Test numbers & test cards</p>
                </a>
                <a href="/developer/api-explorer" className="p-4 border rounded-lg hover:border-primary/50 transition-colors text-center">
                  <Key className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <h4 className="font-semibold text-sm">API Explorer</h4>
                  <p className="text-xs text-muted-foreground mt-1">Interactive API reference</p>
                </a>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <AutoDocNavigation />
    </div>
  );
};

export default DeveloperRegistration;
