import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, MailX, CheckCircle2, AlertTriangle } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function Unsubscribe() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }
    (async () => {
      try {
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`;
        const res = await fetch(url, { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } });
        const data = await res.json();
        if (!res.ok) { setStatus("invalid"); return; }
        if (data.valid === false && data.reason === "already_unsubscribed") { setStatus("already"); return; }
        setStatus("valid");
      } catch { setStatus("invalid"); }
    })();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", { body: { token } });
      if (error) throw error;
      if (data?.success) setStatus("success");
      else if (data?.reason === "already_unsubscribed") setStatus("already");
      else setStatus("error");
    } catch { setStatus("error"); }
    setProcessing(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <MailX className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">Email Preferences</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center gap-2">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
              <p className="text-muted-foreground">Verifying your request...</p>
            </div>
          )}
          {status === "valid" && (
            <>
              <p className="text-muted-foreground">
                You are about to unsubscribe from app email notifications from Kang Open Banking.
              </p>
              <p className="text-sm text-muted-foreground">
                You will still receive critical security and authentication emails.
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive" className="w-full">
                {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : "Confirm Unsubscribe"}
              </Button>
            </>
          )}
          {status === "success" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-secondary" />
              <p className="font-medium">Successfully Unsubscribed</p>
              <p className="text-sm text-muted-foreground">You will no longer receive app email notifications.</p>
            </div>
          )}
          {status === "already" && (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="h-10 w-10 text-muted-foreground" />
              <p className="font-medium">Already Unsubscribed</p>
              <p className="text-sm text-muted-foreground">You were already unsubscribed from these emails.</p>
            </div>
          )}
          {status === "invalid" && (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Invalid Link</p>
              <p className="text-sm text-muted-foreground">This unsubscribe link is invalid or has expired.</p>
            </div>
          )}
          {status === "error" && (
            <div className="flex flex-col items-center gap-2">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="font-medium">Something went wrong</p>
              <p className="text-sm text-muted-foreground">Please try again or contact support.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
