import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle, XCircle, Loader2, Building2, CreditCard, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { extractEdgeFunctionError } from '@/lib/edge-function-error';
import { useHarvestedT } from '@/lib/i18n/useHarvestedT';

type Intent = {
  id: string;
  merchant_name: string;
  merchant_logo_url: string | null;
  amount: number;
  currency: string;
  description: string | null;
  status: string;
  expires_at: string;
  redirect_uri: string;
  state: string;
};

type Step = "loading" | "login" | "approve" | "processing" | "success" | "rejected" | "error" | "expired";

export default function PayByBankAuthorize() {
  const tr = useHarvestedT('customer');
  const [searchParams] = useSearchParams();
  const intentId = searchParams.get("intent_id");
  const stateParam = searchParams.get("state");

  const [step, setStep] = useState<Step>("loading");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!intentId) { setStep("error"); return; }
    loadIntent();
  }, [intentId]);

  const loadIntent = async () => {
    // Check if user is already logged in
    const { data: { session } } = await supabase.auth.getSession();
    
    const { data, error } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "get_intent", intent_id: intentId },
    });

    if (error || !data || data.error) {
      setStep("error");
      return;
    }

    setIntent(data);

    if (data.status === "expired") { setStep("expired"); return; }
    if (data.status !== "awaiting_auth") { setStep("error"); return; }

    if (session?.user) {
      setUserId(session.user.id);
      setStep("approve");
    } else {
      setStep("login");
    }
  };

  const handleLogin = async () => {
    setLoginLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    setLoginLoading(false);
    if (error) {
      toast.error(extractEdgeFunctionError(error));
      return;
    }
    setUserId(data.user.id);
    setStep("approve");
  };

  const handleApprove = async () => {
    setStep("processing");
    const { data, error } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "authorize", intent_id: intentId, user_id: userId },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Authorization failed");
      setStep("error");
      return;
    }

    setRedirectUrl(data.redirect_url);
    setStep("success");

    // Auto-redirect after 3 seconds
    setTimeout(() => {
      if (data.redirect_url) window.location.href = data.redirect_url;
    }, 3000);
  };

  const handleReject = async () => {
    setStep("processing");
    const { data } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "reject", intent_id: intentId, user_id: userId },
    });

    setRedirectUrl(data?.redirect_url);
    setStep("rejected");

    setTimeout(() => {
      if (data?.redirect_url) window.location.href = data.redirect_url;
    }, 3000);
  };

  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!intent?.expires_at) return;
    const calc = () => Math.max(0, Math.floor((new Date(intent.expires_at).getTime() - Date.now()) / 1000));
    setTimeLeft(calc());
    const interval = setInterval(() => {
      const t = calc();
      setTimeLeft(t);
      if (t <= 0) { setStep("expired"); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [intent?.expires_at]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-muted/30 to-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        {/* KOB Branding Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-4">
            <Shield className="h-4 w-4" />
            <span className="text-sm font-medium">{tr('Secure Payment Authorization')}</span>
          </div>
          <h1 className="text-2xl font-bold text-foreground">{tr('Kang Open Banking')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{tr('Pay by Bank')}</p>
        </div>

        <Card className="border-border/50 shadow-xl">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {/* LOADING */}
              {step === "loading" && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">{tr('Loading payment details...')}</p>
                </motion.div>
              )}

              {/* LOGIN */}
              {step === "login" && intent && (
                <motion.div key="login" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">{tr('Sign in to authorize payment to')}</p>
                    <p className="text-lg font-semibold text-foreground mt-1">{intent.merchant_name || "Merchant"}</p>
                    <p className="text-2xl font-bold text-primary mt-2">
                      {intent.currency} {Number(intent.amount).toLocaleString()}
                    </p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="email">{tr('Email')}</Label>
                      <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
                    </div>
                    <div>
                      <Label htmlFor="password">{tr('Password')}</Label>
                      <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleLogin()} />
                    </div>
                    <Button onClick={handleLogin} className="w-full" size="lg" disabled={loginLoading || !email || !password}>
                      {loginLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                      Sign In & Continue
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* APPROVE */}
              {step === "approve" && intent && (
                <motion.div key="approve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="text-center space-y-3">
                    {intent.merchant_logo_url ? (
                      <img src={intent.merchant_logo_url} alt={intent.merchant_name || ""} className="h-14 w-14 rounded-xl mx-auto object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                    )}
                    <p className="font-semibold text-foreground">{intent.merchant_name || "Merchant"}</p>
                    {intent.description && <p className="text-sm text-muted-foreground">{intent.description}</p>}
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{tr('Amount')}</span>
                      <span className="text-lg font-bold text-foreground">{intent.currency} {Number(intent.amount).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{tr('Payment Method')}</span>
                      <span className="text-sm font-medium text-foreground flex items-center gap-1">
                        <CreditCard className="h-3.5 w-3.5" /> Bank Account
                      </span>
                    </div>
                    {timeLeft > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">{tr('Expires in')}</span>
                        <span className="text-sm font-medium text-orange-600">{minutes}:{String(seconds).padStart(2, '0')}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReject} className="flex-1" size="lg">
                      Reject
                    </Button>
                    <Button onClick={handleApprove} className="flex-1" size="lg">
                      <Shield className="h-4 w-4 mr-2" />
                      Approve Payment
                    </Button>
                  </div>

                  <p className="text-xs text-center text-muted-foreground">
                    By approving, you authorize Kang Open Banking to debit your account for this payment.
                  </p>
                </motion.div>
              )}

              {/* PROCESSING */}
              {step === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                  <p className="text-muted-foreground">{tr('Processing your authorization...')}</p>
                </motion.div>
              )}

              {/* SUCCESS */}
              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{tr('Payment Authorized')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('Redirecting you back to the merchant...')}</p>
                  {redirectUrl && (
                    <Button variant="outline" size="sm" onClick={() => window.location.href = redirectUrl}>
                      Return to Merchant
                    </Button>
                  )}
                </motion.div>
              )}

              {/* REJECTED */}
              {step === "rejected" && (
                <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <XCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground">{tr('Payment Rejected')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('Redirecting you back...')}</p>
                </motion.div>
              )}

              {/* ERROR */}
              {step === "error" && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <AlertTriangle className="h-12 w-12 text-destructive" />
                  <h2 className="text-xl font-bold text-foreground">{tr('Something went wrong')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('This payment link may be invalid or has already been used.')}</p>
                </motion.div>
              )}

              {/* EXPIRED */}
              {step === "expired" && (
                <motion.div key="expired" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <AlertTriangle className="h-12 w-12 text-orange-500" />
                  <h2 className="text-xl font-bold text-foreground">{tr('Payment Expired')}</h2>
                  <p className="text-sm text-muted-foreground">{tr('This payment authorization has expired. Please start a new payment from the merchant.')}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Powered by Kang Open Banking • Secured with SCA
        </p>
      </motion.div>
    </div>
  );
}
