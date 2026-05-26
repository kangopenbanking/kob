import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Loader2, CheckCircle, XCircle, CreditCard, Wallet } from "lucide-react";
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
  fee_bearer?: string;
  fee_amount?: number;
}

export default function PaymentCheckout() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<'success' | 'failed' | null>(null);
  // Customer P2P pay link (set when slug resolves to a customer_pay_links row)
  const [customerLink, setCustomerLink] = useState<any | null>(null);
  const [customerAmount, setCustomerAmount] = useState<string>("");
  const [resolveError, setResolveError] = useState<'expired' | 'inactive' | 'not_found' | null>(null);

  // OTP state
  const [otpRequired, setOtpRequired] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [chargeId, setChargeId] = useState<string | null>(null);
  const [flwRef, setFlwRef] = useState<string | null>(null);
  const [submittingOtp, setSubmittingOtp] = useState(false);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("mobile_money");

  // Wallet payment state (must be before early returns)
  const [walletSession, setWalletSession] = useState<any>(null);
  const [payingWithWallet, setPayingWithWallet] = useState(false);

  useEffect(() => {
    if (slug) fetchLink();
  }, [slug]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setWalletSession(session);
    });
  }, []);

  const fetchLink = async () => {
    try {
      // 1. Try the merchant gateway payment link first.
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-query?action=get-payment-link&slug=${slug}`,
        { headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      const linkData = await res.json().catch(() => null);
      if (linkData?.id && !linkData?.error) {
        setLink(linkData);
        return;
      }

      // 2. Fall back to the consumer-created pay link (shared from the mobile app).
      const r2 = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/customer-paylink-public-resolve`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ slug }),
        }
      );
      const cData = await r2.json().catch(() => null);
      if (r2.ok && cData?.link) {
        setCustomerLink({ ...cData.link, receiver: cData.receiver });
        if (cData.link.amount) setCustomerAmount(String(cData.link.amount));
        return;
      }
      if (cData?.error === 'expired' || cData?.error === 'inactive' || cData?.error === 'not_found') {
        setResolveError(cData.error);
      } else {
        setResolveError('not_found');
      }
      setLink(null);
    } catch {
      setLink(null);
      setResolveError('not_found');
    } finally {
      setLoading(false);
    }
  };


  const getDisplayAmount = () => {
    if (!link) return 0;
    if (link.fee_bearer === 'customer' && link.fee_amount) {
      return link.amount + link.fee_amount;
    }
    return link.amount;
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

      if (chargeData?.status === 'processing' && !chargeData.redirect_url) {
        // OTP required
        setChargeId(chargeData.id);
        setFlwRef(chargeData.provider_ref);
        setOtpRequired(true);
        toast({ title: "OTP Required", description: "Please enter the OTP sent to your device." });
      } else if (chargeData?.status === 'successful') {
        setResult('success');
        if (chargeData.redirect_url) {
          setTimeout(() => window.location.href = chargeData.redirect_url, 2000);
        } else if (link.redirect_url) {
          setTimeout(() => window.location.href = link.redirect_url!, 2000);
        }
      } else if (chargeData?.status === 'failed') {
        setResult('failed');
      } else {
        setResult('success');
        toast({ title: "Payment initiated", description: "Please complete the payment on your device." });
      }
    } catch {
      setResult('failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOtpSubmit = async () => {
    if (!chargeId || otpValue.length < 4) return;
    setSubmittingOtp(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gateway-validate-charge`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ charge_id: chargeId, otp: otpValue, flw_ref: flwRef }),
        }
      );

      const data = await res.json();
      if (data.status === 'successful') {
        setResult('success');
        if (link?.redirect_url) {
          setTimeout(() => window.location.href = link.redirect_url!, 2000);
        }
      } else {
        setResult('failed');
      }
    } catch {
      setResult('failed');
    } finally {
      setSubmittingOtp(false);
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
            <Button className="mt-4" onClick={() => { setResult(null); setOtpRequired(false); setOtpValue(""); }}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // OTP input screen
  if (otpRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto bg-primary/10 p-3 rounded-full w-fit mb-2">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>Enter OTP</CardTitle>
            <CardDescription>A verification code has been sent to your device. Enter it below to complete your payment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button className="w-full" onClick={handleOtpSubmit} disabled={submittingOtp || otpValue.length < 4}>
              {submittingOtp ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying...</> : 'Verify & Pay'}
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Powered by Kang Open Banking • Secure payments
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayAmount = getDisplayAmount();

  const handleWalletPay = async () => {
    if (!link || !walletSession) return;
    setPayingWithWallet(true);
    try {
      const { data, error } = await supabase.functions.invoke('pos-qr-payment', {
        body: { action: 'pay', merchant_id: link.merchant_id, amount: link.amount },
        headers: { 'Idempotency-Key': `paylink_${link.id}_${Date.now()}` },
      });
      if (error) throw error;
      if (data?.error) {
        if (data.error === 'insufficient_balance') {
          toast({ title: "Insufficient Balance", description: `You need ${new Intl.NumberFormat('fr-FR').format(data.required)} XAF but have ${new Intl.NumberFormat('fr-FR').format(data.available)} XAF`, variant: "destructive" });
        } else {
          toast({ title: "Payment Failed", description: data.message || data.error, variant: "destructive" });
        }
        return;
      }
      setResult('success');
      if (link.redirect_url) {
        setTimeout(() => window.location.href = link.redirect_url!, 2000);
      }
    } catch (err: any) {
      toast({ title: "Payment Failed", description: err.message || 'Something went wrong', variant: "destructive" });
    } finally {
      setPayingWithWallet(false);
    }
  };

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
            {new Intl.NumberFormat('fr-FR').format(displayAmount)} {link.currency}
          </div>
          {link.fee_bearer === 'customer' && link.fee_amount && (
            <p className="text-xs text-muted-foreground mt-1">
              Includes {new Intl.NumberFormat('fr-FR').format(link.fee_amount)} {link.currency} processing fee
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Wallet payment option for authenticated users */}
          {walletSession && (
            <div className="mb-6">
              <Button
                className="w-full h-12 rounded-2xl text-sm font-bold"
                onClick={handleWalletPay}
                disabled={payingWithWallet}
              >
                {payingWithWallet ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Paying with Wallet...</>
                ) : (
                  `Pay with Kang Wallet — ${new Intl.NumberFormat('fr-FR').format(displayAmount)} ${link.currency}`
                )}
              </Button>
              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">or pay with</span>
                </div>
              </div>
            </div>
          )}
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
                  <SelectItem value="card">Card Payment (Visa/Mastercard)</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="ussd">USSD</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : `Pay ${new Intl.NumberFormat('fr-FR').format(displayAmount)} ${link.currency}`}
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
