import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Key, Copy, CheckCircle, Eye, EyeOff, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface GeneratedKey {
  api_key: string;
  publishable_key: string;
  merchant_id: string;
  webhook_secret: string;
  generated_at: string;
}

function generateRandomHex(length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, length);
}

export function InstantKeyGenerator() {
  const [keys, setKeys] = useState<GeneratedKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSecrets, setShowSecrets] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generateKeys = useCallback(() => {
    setLoading(true);
    // Simulate brief generation delay for UX
    setTimeout(() => {
      setKeys({
        api_key: `sk_test_${generateRandomHex(32)}`,
        publishable_key: `pk_test_${generateRandomHex(24)}`,
        merchant_id: `merch_sbx_${generateRandomHex(16)}`,
        webhook_secret: `whsec_test_${generateRandomHex(32)}`,
        generated_at: new Date().toISOString(),
      });
      setShowSecrets(true);
      setLoading(false);
      toast.success("Sandbox credentials generated instantly");
    }, 600);
  }, []);

  const copyValue = (value: string, label: string) => {
    navigator.clipboard.writeText(value);
    setCopied(label);
    toast.success(`${label} copied`);
    setTimeout(() => setCopied(null), 2000);
  };

  const maskValue = (value: string) => {
    if (showSecrets) return value;
    return value.slice(0, 12) + "..." + value.slice(-4);
  };

  const keyFields = keys ? [
    { label: "Secret Key", value: keys.api_key, sensitive: true, description: "Use in server-side code only" },
    { label: "Publishable Key", value: keys.publishable_key, sensitive: false, description: "Safe for client-side code" },
    { label: "Merchant ID", value: keys.merchant_id, sensitive: false, description: "Your sandbox merchant identifier" },
    { label: "Webhook Secret", value: keys.webhook_secret, sensitive: true, description: "For verifying webhook signatures" },
  ] : [];

  return (
    <Card className="border-primary/30">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary/50">
              <Key className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Instant Sandbox Credentials</CardTitle>
              <CardDescription>Generate API keys in one click -- no signup, no email, no waiting</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary">
            <ShieldCheck className="h-3.5 w-3.5 mr-1" /> Free Forever
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!keys ? (
          <div className="text-center py-6 space-y-4">
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              Get sandbox credentials instantly. These keys let you test the full API including charges, payouts, webhooks, and account aggregation.
            </p>
            <Button
              size="lg"
              onClick={generateKeys}
              disabled={loading}
              className="px-8"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Key className="h-4 w-4 mr-2" />
              )}
              {loading ? "Generating..." : "Generate Sandbox Keys"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSecrets(!showSecrets)}
                className="text-muted-foreground"
              >
                {showSecrets ? <EyeOff className="h-4 w-4 mr-1.5" /> : <Eye className="h-4 w-4 mr-1.5" />}
                {showSecrets ? "Hide secrets" : "Show secrets"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={generateKeys}
                disabled={loading}
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>

            <div className="space-y-2">
              {keyFields.map(({ label, value, sensitive, description }) => (
                <div
                  key={label}
                  className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/20 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-medium text-foreground">{label}</span>
                      {sensitive && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">secret</Badge>
                      )}
                    </div>
                    <code className="text-xs font-mono text-muted-foreground break-all block">
                      {sensitive ? maskValue(value) : value}
                    </code>
                    <span className="text-[10px] text-muted-foreground/70">{description}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 h-8 w-8 p-0"
                    onClick={() => copyValue(value, label)}
                  >
                    {copied === label ? (
                      <CheckCircle className="h-4 w-4 text-primary" />
                    ) : (
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              ))}
            </div>

            <div className="bg-muted/30 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Sandbox limits</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>60 requests/minute, 1,000 requests/day</li>
                <li>Test phone: +237650000000 (always succeeds)</li>
                <li>Test card: 4242 4242 4242 4242 (any exp/cvv)</li>
                <li>Max charge: 1,000,000 XAF per transaction</li>
              </ul>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
