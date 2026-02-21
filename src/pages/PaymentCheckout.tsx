import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, CheckCircle, XCircle, CreditCard } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PaymentLink {
  id: string;
  title: string;
  amount: number;
  currency: string;
  description?: string;
  redirect_url?: string;
  status: string;
  merchant_id: string;
}

export default function PaymentCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("mobile_money");

  useEffect(() => {
    if (slug) fetchLink();
  }, [slug]);

  const fetchLink = async () => {
    try {
      const { data, error } = await supabase.functions.invoke('gateway-get-payment-link', {
        body: null,
        headers: { 'Content-Type': 'application/json' },
      });

      // Use query param approach
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-get-payment-link?slug=${slug}`,
        { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const linkData = await res.json();

      if (linkData?.error || !linkData?.id) {
        setLink(null);
      } else {
        setLink(linkData);
      }
    } catch {
      setLink(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!link) return;
    setSubmitting(true);

    try {
      const txRef = `pay-${link.id}-${Date.now()}`;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-create-charge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            merchant_id: link.merchant_id,
            amount: link.amount,
            currency: link.currency,
            channel,
            customer_email: email,
            customer_phone: phone,
            customer_name: name,
            tx_ref: txRef,
            payment_link_id: link.id,
          }),
        }
      );

      const chargeData = await res.json();
      if (chargeData?.status === 'successful' || chargeData?.status === 'processing') {
        setResult('success');
        if (chargeData.redirect_url) {
          setTimeout(() => window.location.href = chargeData.redirect_url, 2000);
        } else if (link.redirect_url) {
          setTimeout(() => window.location.href = link.redirect_url!, 2000);
        }
      } else if (chargeData?.status === 'failed') {
        setResult('failed');
      } else {
        // Pending/processing — show success
        setResult('success');
        toast({ title: "Payment initiated", description: "Please complete the payment on your device." });
      }
    } catch {
      setResult('failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!link || link.status !== 'active') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Payment Link Unavailable</h2>
            <p className="text-muted-foreground mt-2">This payment link is no longer active or has expired.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Payment Initiated!</h2>
            <p className="text-muted-foreground mt-2">Your payment is being processed. You will receive a confirmation shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (result === 'failed') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <XCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold">Payment Failed</h2>
            <p className="text-muted-foreground mt-2">Something went wrong. Please try again.</p>
            <Button className="mt-4" onClick={() => setResult(null)}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
            <CreditCard className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>{link.title}</CardTitle>
          {link.description && <CardDescription>{link.description}</CardDescription>}
          <div className="text-3xl font-bold text-primary mt-2">
            {new Intl.NumberFormat('fr-FR').format(link.amount)} {link.currency}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} placeholder="Jean-Pierre Kamga" required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
            </div>
            <div>
              <Label htmlFor="phone">Phone Number</Label>
              <Input id="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+237677123456" required />
            </div>
            <div>
              <Label>Payment Method</Label>
              <Select value={channel} onValueChange={setChannel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_money">Mobile Money (MTN/Orange)</SelectItem>
                  <SelectItem value="card">Card Payment</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="ussd">USSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : `Pay ${new Intl.NumberFormat('fr-FR').format(link.amount)} ${link.currency}`}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground text-center mt-4">
            Powered by Kang Open Banking • Secure payments
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
