import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Link2, CheckCircle, Building2 } from "lucide-react";
import { useState } from "react";

const demoBanks = [
  { id: "afriland", name: "Afriland First Bank", code: "AFB", country: "CM" },
  { id: "uba", name: "UBA Cameroon", code: "UBA", country: "CM" },
  { id: "sgbc", name: "Societe Generale Cameroun", code: "SGC", country: "CM" },
  { id: "bicec", name: "BICEC", code: "BIC", country: "CM" },
];

export default function EmbeddableBankConnectWidget() {
  const [step, setStep] = useState<"select" | "consent" | "connected">("select");
  const [selectedBank, setSelectedBank] = useState<string | null>(null);

  const handleConnect = () => {
    setStep("consent");
  };

  const handleAuthorize = () => {
    setStep("connected");
    window.parent?.postMessage({
      type: "kob-bank-connected",
      bank_id: selectedBank,
      status: "connected",
    }, "*");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border/50">
        <CardHeader className="text-center">
          <Link2 className="mx-auto h-8 w-8 text-primary" />
          <CardTitle className="mt-2">Connect Your Bank</CardTitle>
          <p className="text-sm text-muted-foreground">Link your bank account securely via Open Banking</p>
        </CardHeader>
        <CardContent>
          {step === "select" && (
            <div className="space-y-3">
              {demoBanks.map((bank) => (
                <button
                  key={bank.id}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                    selectedBank === bank.id ? "border-primary ring-1 ring-primary/20" : "border-border/30 hover:border-border"
                  }`}
                  onClick={() => setSelectedBank(bank.id)}
                >
                  <Building2 className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">{bank.name}</p>
                    <p className="text-xs text-muted-foreground">{bank.code} -- {bank.country}</p>
                  </div>
                </button>
              ))}
              <Button onClick={handleConnect} disabled={!selectedBank} className="w-full mt-4">
                Continue
              </Button>
            </div>
          )}

          {step === "consent" && (
            <div className="space-y-4 text-center">
              <Shield className="mx-auto h-10 w-10 text-primary" />
              <h3 className="font-semibold">Authorize Access</h3>
              <p className="text-sm text-muted-foreground">
                You are granting read-only access to your account information.
              </p>
              <div className="space-y-2 text-left">
                {["Account details", "Balances", "Transaction history", "Beneficiary list"].map((p) => (
                  <div key={p} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-primary" />
                    {p}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Consent valid for 90 days. Revoke any time.</p>
              <Button onClick={handleAuthorize} className="w-full">Authorize</Button>
            </div>
          )}

          {step === "connected" && (
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto h-12 w-12 text-primary" />
              <h3 className="mt-4 text-lg font-bold">Bank Connected</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Your bank account has been linked successfully.
              </p>
              <Badge variant="outline" className="mt-4">AISP Consent Active</Badge>
            </div>
          )}

          <div className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Secured by Kang Open Banking -- FAPI 1.0 Compliant
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
