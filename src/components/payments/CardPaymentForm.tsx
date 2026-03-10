import { useState, useEffect } from "react";
import { loadStripe, Stripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

let stripePromiseCache: Promise<Stripe | null> | null = null;

function getStripePromise(): Promise<Stripe | null> {
  if (stripePromiseCache) return stripePromiseCache;
  const envKey = import.meta.env.VITE_STRIPE_PUBLIC_KEY;
  if (envKey) {
    stripePromiseCache = loadStripe(envKey);
    return stripePromiseCache;
  }
  stripePromiseCache = (async () => {
    try {
      const { data, error } = await supabase.functions.invoke("gateway-get-stripe-config");
      if (error || !data?.publishable_key) return null;
      return loadStripe(data.publishable_key);
    } catch { return null; }
  })();
  return stripePromiseCache;
}

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: 'hsl(var(--foreground))',
      '::placeholder': {
        color: 'hsl(var(--muted-foreground))',
      },
    },
  },
};

const CardPaymentFormContent = () => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [description, setDescription] = useState("");
  const [saveCard, setSaveCard] = useState(false);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements || !amount) {
      return;
    }

    setLoading(true);

    try {
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) {
        throw new Error('Card element not found');
      }

      // Create payment intent
      const { data: intentData, error: intentError } = await supabase.functions.invoke(
        'stripe-payment-intent',
        {
          body: {
            amount: parseFloat(amount),
            currency,
            description,
            save_card: saveCard,
          },
        }
      );

      if (intentError) throw intentError;

      // Confirm card payment
      const result = await stripe.confirmCardPayment(intentData.client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      toast({
        title: "Payment Successful",
        description: `Payment of ${currency} ${amount} processed successfully`,
      });

      // Reset form
      setAmount("");
      setDescription("");
      setSaveCard(false);
      cardElement.clear();

    } catch (error: any) {
      console.error('Payment error:', error);
      toast({
        title: "Payment Failed",
        description: error.message || "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit/Debit Card Payment</CardTitle>
        <CardDescription>
          Pay securely with Visa, Mastercard, American Express, or other supported cards
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handlePayment} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="amount">Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="currency">Currency *</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger id="currency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="XAF">XAF (FCFA)</SelectItem>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                  <SelectItem value="GBP">GBP (£)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="description">Description (Optional)</Label>
            <Input
              id="description"
              placeholder="Payment description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label>Card Details *</Label>
            <div className="mt-2 p-3 border rounded-md bg-background">
              <CardElement options={CARD_ELEMENT_OPTIONS} />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="saveCard"
              checked={saveCard}
              onCheckedChange={(checked) => setSaveCard(checked as boolean)}
            />
            <Label htmlFor="saveCard" className="cursor-pointer">
              Save card for future payments
            </Label>
          </div>

          <Button type="submit" disabled={!stripe || loading} className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              `Pay ${currency} ${amount || '0.00'}`
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
};

export const CardPaymentForm = () => {
  const [stripeInstance, setStripeInstance] = useState<Stripe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStripePromise().then((s) => {
      setStripeInstance(s);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...</div>;
  if (!stripeInstance) return <Card><CardContent className="py-6">Stripe is not configured.</CardContent></Card>;

  return (
    <Elements stripe={stripeInstance}>
      <CardPaymentFormContent />
    </Elements>
  );
};
