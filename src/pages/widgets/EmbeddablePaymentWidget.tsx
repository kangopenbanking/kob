import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shield, CreditCard } from "lucide-react";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";

export default function EmbeddablePaymentWidget() {
  const [searchParams] = useSearchParams();
  const [amount, setAmount] = useState(searchParams.get("amount") || "");
  const [currency] = useState(searchParams.get("currency") || "XAF");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [processing, setProcessing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const merchantName = searchParams.get("merchant") || "Kang Open Banking";
  const theme = searchParams.get("theme") || "light";

  useEffect(() => {
    // Listen for postMessage config from parent iframe
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "kob-widget-config") {
        if (event.data.amount) setAmount(event.data.amount.toString());
        if (event.data.email) setEmail(event.data.email);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handlePay = async () => {
    setProcessing(true);
    // Simulate payment -- in production, calls gateway-charges-router
    await new Promise((r) => setTimeout(r, 2000));
    setStatus("success");
    setProcessing(false);

    // Notify parent iframe
    window.parent?.postMessage({ type: "kob-payment-complete", status: "success", amount, currency }, "*");
  };

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border border-border/50">
          <CardContent className="py-12 text-center">
            <Shield className="mx-auto h-12 w-12 text-primary" />
            <h2 className="mt-4 text-xl font-bold">Payment Successful</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {amount} {currency} has been processed successfully.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border border-border/50">
        <CardHeader className="text-center">
          <CreditCard className="mx-auto h-8 w-8 text-primary" />
          <CardTitle className="mt-2">{merchantName}</CardTitle>
          <p className="text-sm text-muted-foreground">Secure payment powered by KOB</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Amount ({currency})</Label>
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter amount"
              readOnly={!!searchParams.get("amount")}
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="space-y-2">
            <Label>Phone (Mobile Money)</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+237..." />
          </div>
          <Button onClick={handlePay} disabled={processing || !amount} className="w-full">
            {processing ? "Processing..." : `Pay ${amount ? `${amount} ${currency}` : ""}`}
          </Button>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Shield className="h-3 w-3" />
            Secured by Kang Open Banking
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
