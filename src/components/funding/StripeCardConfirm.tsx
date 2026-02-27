import { useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, CreditCard, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const stripePromise = import.meta.env.VITE_STRIPE_PUBLIC_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY)
  : null;

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
    // Poll backend to verify provider status and credit the account/wallet
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
      if (data?.status === "succeeded") {
        return true;
      }
      if (data?.status === "failed" || data?.status === "cancelled") {
        return false;
      }
      // Wait before retrying
      await new Promise(r => setTimeout(r, 2000));
    }
    return null; // Still pending after retries
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
        // Confirm with backend to finalize funding intent
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
  if (!stripePromise) {
    return (
      <Alert>
        <AlertDescription>
          Stripe is not configured. Please set <code>VITE_STRIPE_PUBLIC_KEY</code> to enable card payments.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripeCardConfirmInner clientSecret={clientSecret} fundingIntentId={fundingIntentId} onSuccess={onSuccess} amount={amount} currency={currency} />
    </Elements>
  );
};
