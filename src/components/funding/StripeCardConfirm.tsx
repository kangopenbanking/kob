import { useState, useEffect } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// Try build-time env var first, otherwise fetch from backend
let stripePromiseCache: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (stripePromiseCache) return stripePromiseCache;

  const envKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  if (envKey) {
    stripePromiseCache = loadStripe(envKey);
    return stripePromiseCache;
  }

  // Fetch publishable key from backend
  stripePromiseCache = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gateway-get-stripe-config");
      if (error || !data?.publishable_key) {
        console.error("Failed to fetch Stripe config:", error);
        return null;
      }
      return loadStripe(data.publishable_key);
    } catch (err) {
      console.error("Stripe config fetch error:", err);
      return null;
    }
  })();

  return stripePromiseCache;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: "16px",
      color: "#1a1a2e",
      "::placeholder": { color: "#9ca3af" },
    },
  },
};

interface StripeCardConfirmInnerProps {
  clientSecret: string;
  fundingIntentId?: string;
  onSuccess?: () => void;
  amount?: number;
  currency?: string;
}

const StripeCardConfirmInner = ({ clientSecret, fundingIntentId, onSuccess, amount, currency = "XAF" }: StripeCardConfirmInnerProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const confirmWithBackend = async (intentId: string) => {
    let attempts = 0;
    const maxAttempts = 5;
    while (attempts < maxAttempts) {
      attempts++;
      const { data, error } = await supabase.functions.invoke("gateway-confirm-funding", {
        body: { funding_intent_id: intentId },
      });
      if (error) {
        console.error("Confirm funding error:", error);
        break;
      }
      if (data?.status === "succeeded") return true;
      if (data?.status === "failed" || data?.status === "cancelled") return false;
      await new Promise(r => setTimeout(r, 2000));
    }
    return null;
  };

  const handleConfirm = async () => {
    if (!stripe || !elements) return;
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    setLoading(true);
    try {
      const { error, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (error) {
        toast.error(error.message || "Card payment failed");
      } else if (paymentIntent?.status === "succeeded") {
        if (fundingIntentId) {
          const result = await confirmWithBackend(fundingIntentId);
          if (result === true) {
            setConfirmed(true);
            toast.success("Payment confirmed and funds credited!");
            onSuccess?.();
          } else if (result === false) {
            toast.error("Payment was processed but funding failed. Contact support.");
          } else {
            setConfirmed(true);
            toast.success("Payment confirmed! Funds will be credited shortly.");
            onSuccess?.();
          }
        } else {
          setConfirmed(true);
          toast.success("Card payment confirmed successfully!");
          onSuccess?.();
        }
      } else {
        toast.info(`Payment status: ${paymentIntent?.status}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Payment confirmation failed");
    }
    setLoading(false);
  };

  if (confirmed) {
    return (
      <Alert className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700 dark:text-green-400">
          Card payment confirmed successfully. Funds have been credited.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      <Label className="flex items-center gap-2">
        <CreditCard className="h-4 w-4" /> Enter Card Details
      </Label>
      <div className="p-3 border rounded-md bg-background">
        <CardElement options={CARD_ELEMENT_OPTIONS} />
      </div>
      <Button onClick={handleConfirm} disabled={!stripe || loading} className="w-full">
        {loading ? (
          <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing...</>
        ) : (
          <>Confirm Card Payment{amount ? ` — ${new Intl.NumberFormat("fr-CM", { style: "currency", currency, minimumFractionDigits: 0 }).format(amount)}` : ""}</>
        )}
      </Button>
    </div>
  );
};

interface StripeCardConfirmProps {
  clientSecret: string;
  fundingIntentId?: string;
  onSuccess?: () => void;
  amount?: number;
  currency?: string;
}

export const StripeCardConfirm = ({ clientSecret, fundingIntentId, onSuccess, amount, currency }: StripeCardConfirmProps) => {
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getStripePromise().then((s) => {
      setStripeInstance(s);
      setLoading(false);
      if (!s) setFailed(true);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading payment form...
      </div>
    );
  }

  if (failed || !stripeInstance) {
    return (
      <Alert>
        <AlertDescription>
          Stripe is not configured. Card payments are unavailable.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Elements stripe={stripeInstance} options={{ clientSecret }}>
      <StripeCardConfirmInner clientSecret={clientSecret} fundingIntentId={fundingIntentId} onSuccess={onSuccess} amount={amount} currency={currency} />
    </Elements>
  );
};
