import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle, XCircle, Loader2, Building2, ArrowLeft, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

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

type Step = "loading" | "approve" | "processing" | "success" | "rejected" | "error" | "expired";

export default function PayByBankApproval() {
  const { intentId } = useParams<{ intentId: string }>();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("loading");
  const [intent, setIntent] = useState<Intent | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!intentId) { setStep("error"); return; }
    loadIntent();
  }, [intentId]);

  const loadIntent = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/app/auth"); return; }

    const { data, error } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "get_intent", intent_id: intentId },
    });

    if (error || !data || data.error) { setStep("error"); return; }
    setIntent(data);

    if (data.status === "expired") { setStep("expired"); return; }
    if (data.status !== "awaiting_auth") { setStep("error"); return; }
    setStep("approve");
  };

  const handleApprove = async () => {
    setStep("processing");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); navigate("/app/auth"); return; }

    const { data, error } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "authorize", intent_id: intentId, user_id: user.id },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Authorization failed");
      setStep("error");
      return;
    }

    setRedirectUrl(data.redirect_url);
    setStep("success");
  };

  const handleReject = async () => {
    setStep("processing");
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Please sign in"); navigate("/app/auth"); return; }
    const { data } = await supabase.functions.invoke("pay-by-bank", {
      body: { action: "reject", intent_id: intentId, user_id: user.id },
    });
    setRedirectUrl(data?.redirect_url);
    setStep("rejected");
  };

  return (
    <div className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-md mx-auto">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-muted-foreground mb-6">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm">
            <Shield className="h-3.5 w-3.5" /> Payment Authorization
          </div>
        </div>

        <Card className="border-border/50">
          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {step === "loading" && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Loading payment...</p>
                </motion.div>
              )}

              {step === "approve" && intent && (
                <motion.div key="approve" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
                  <div className="text-center space-y-3">
                    {intent.merchant_logo_url ? (
                      <img src={intent.merchant_logo_url} alt="" className="h-14 w-14 rounded-xl mx-auto object-cover" />
                    ) : (
                      <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                        <Building2 className="h-7 w-7 text-primary" />
                      </div>
                    )}
                    <p className="font-semibold">{intent.merchant_name}</p>
                    {intent.description && <p className="text-sm text-muted-foreground">{intent.description}</p>}
                  </div>

                  <div className="bg-muted/50 rounded-xl p-4 text-center">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-3xl font-bold text-foreground mt-1">{intent.currency} {Number(intent.amount).toLocaleString()}</p>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={handleReject} className="flex-1" size="lg">Reject</Button>
                    <Button onClick={handleApprove} className="flex-1" size="lg">
                      <Shield className="h-4 w-4 mr-2" /> Approve
                    </Button>
                  </div>
                </motion.div>
              )}

              {step === "processing" && (
                <motion.div key="processing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-12 gap-4">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Processing...</p>
                </motion.div>
              )}

              {step === "success" && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <div className="h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <h2 className="text-xl font-bold">Payment Successful</h2>
                  <p className="text-sm text-muted-foreground">Your payment has been authorized and processed.</p>
                  {redirectUrl && (
                    <Button variant="outline" onClick={() => window.location.href = redirectUrl} className="mt-2">
                      <ExternalLink className="h-4 w-4 mr-2" /> Return to Merchant
                    </Button>
                  )}
                  <Button variant="ghost" onClick={() => navigate("/app/home")} className="mt-1">
                    Go to Home
                  </Button>
                </motion.div>
              )}

              {step === "rejected" && (
                <motion.div key="rejected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <XCircle className="h-12 w-12 text-red-500" />
                  <h2 className="text-xl font-bold">Payment Rejected</h2>
                  <Button variant="ghost" onClick={() => navigate("/app/home")} className="mt-2">Go to Home</Button>
                </motion.div>
              )}

              {(step === "error" || step === "expired") && (
                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-8 gap-4 text-center">
                  <XCircle className="h-12 w-12 text-destructive" />
                  <h2 className="text-xl font-bold">{step === "expired" ? "Payment Expired" : "Invalid Payment"}</h2>
                  <p className="text-sm text-muted-foreground">{step === "expired" ? "This authorization has expired." : "This payment link is invalid."}</p>
                  <Button variant="ghost" onClick={() => navigate("/app/home")}>Go to Home</Button>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
