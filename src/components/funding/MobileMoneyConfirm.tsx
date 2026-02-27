import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, Smartphone, RefreshCw, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface MobileMoneyConfirmProps {
  fundingIntentId: string;
  message?: string;
  onSuccess?: () => void;
}

type PollState = "polling" | "succeeded" | "failed" | "timeout";

const MAX_ATTEMPTS = 12;
const POLL_INTERVAL = 5000;

export const MobileMoneyConfirm = ({ fundingIntentId, message, onSuccess }: MobileMoneyConfirmProps) => {
  const [state, setState] = useState<PollState>("polling");
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke("gateway-confirm-funding", {
        body: { funding_intent_id: fundingIntentId },
      });

      if (fnError) {
        console.error("[MoMoConfirm] invoke error:", fnError);
        return false;
      }

      if (data?.status === "succeeded" || data?.funded) {
        setState("succeeded");
        toast.success("Payment confirmed!");
        onSuccess?.();
        return true;
      }
      if (data?.status === "failed" || data?.status === "cancelled") {
        setState("failed");
        setError(data?.message || "Payment was not completed");
        return true;
      }
      if (data?.already_processed && data?.status === "succeeded") {
        setState("succeeded");
        onSuccess?.();
        return true;
      }
      return false; // still pending
    } catch (e: any) {
      console.error("[MoMoConfirm] poll error:", e);
      return false;
    }
  }, [fundingIntentId, onSuccess]);

  useEffect(() => {
    if (state !== "polling") return;

    const timer = setInterval(async () => {
      setAttempt((prev) => {
        const next = prev + 1;
        if (next >= MAX_ATTEMPTS) {
          setState("timeout");
          clearInterval(timer);
          return next;
        }
        return next;
      });

      const done = await poll();
      if (done) clearInterval(timer);
    }, POLL_INTERVAL);

    // Also poll immediately
    poll();

    return () => clearInterval(timer);
  }, [state, poll]);

  const handleRetry = () => {
    setAttempt(0);
    setError(null);
    setState("polling");
  };

  const progress = Math.min((attempt / MAX_ATTEMPTS) * 100, 100);

  if (state === "succeeded") {
    return (
      <Card className="border-green-500/30 bg-green-50 dark:bg-green-950/20">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/40">
            <CheckCircle2 className="h-6 w-6 text-green-600" />
          </div>
          <p className="text-sm font-semibold text-green-700 dark:text-green-400">Payment Confirmed</p>
          <p className="text-xs text-muted-foreground">Your mobile money payment has been verified successfully.</p>
        </CardContent>
      </Card>
    );
  }

  if (state === "failed") {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <p className="text-sm font-semibold text-destructive">Payment Failed</p>
          <p className="text-xs text-muted-foreground">{error || "The payment could not be completed."}</p>
          <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Try Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (state === "timeout") {
    return (
      <Card className="border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20">
        <CardContent className="flex flex-col items-center gap-3 py-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/40">
            <Clock className="h-6 w-6 text-yellow-600" />
          </div>
          <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">Still Processing</p>
          <p className="text-xs text-muted-foreground text-center max-w-xs">
            Your payment is taking longer than expected. It may still complete — check back in a few minutes.
          </p>
          <Button variant="outline" size="sm" onClick={handleRetry} className="mt-2">
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Check Again
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Polling state
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="flex flex-col items-center gap-4 py-6">
        <div className="relative flex h-14 w-14 items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-primary/30 animate-ping" />
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
        </div>
        <div className="text-center space-y-1">
          <p className="text-sm font-semibold text-foreground">Waiting for Confirmation</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            {message || "Please confirm the payment on your phone. A prompt should appear shortly."}
          </p>
        </div>
        <div className="w-full max-w-xs space-y-1">
          <Progress value={progress} className="h-1.5" />
          <p className="text-[10px] text-muted-foreground text-center">
            Checking... ({attempt}/{MAX_ATTEMPTS})
          </p>
        </div>
      </CardContent>
    </Card>
  );
};
