import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function Unsubscribe() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [state, setState] = useState<"checking" | "valid" | "already" | "invalid" | "submitting" | "done" | "error">("checking");
  const [errorMsg, setErrorMsg] = useState<string>("");

  useEffect(() => {
    if (!token) { setState("invalid"); return; }
    (async () => {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${encodeURIComponent(token)}`, {
          headers: { apikey: SUPABASE_ANON },
        });
        const data = await r.json();
        if (r.ok && data.valid) setState("valid");
        else if (data?.reason === "already_unsubscribed") setState("already");
        else { setErrorMsg(data?.error || "Invalid or expired link"); setState("invalid"); }
      } catch (e: any) {
        setErrorMsg(e?.message || "Network error"); setState("error");
      }
    })();
  }, [token]);

  const confirm = async () => {
    setState("submitting");
    try {
      const r = await fetch(`${SUPABASE_URL}/functions/v1/handle-email-unsubscribe`, {
        method: "POST",
        headers: { apikey: SUPABASE_ANON, "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await r.json();
      if (r.ok && data.success) setState("done");
      else if (data?.reason === "already_unsubscribed") setState("already");
      else { setErrorMsg(data?.error || "Failed to unsubscribe"); setState("error"); }
    } catch (e: any) {
      setErrorMsg(e?.message || "Network error"); setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-md border-border/60 shadow-sm">
        <CardHeader>
          <CardTitle className="text-xl">Email preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {state === "checking" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verifying your link…</p>
          )}
          {state === "valid" && (
            <>
              <p className="text-sm text-muted-foreground">Click the button below to confirm you'd like to stop receiving these emails.</p>
              <Button onClick={confirm} className="w-full">Confirm unsubscribe</Button>
            </>
          )}
          {state === "submitting" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Updating your preferences…</p>
          )}
          {state === "done" && (
            <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 className="h-4 w-4" /> You've been unsubscribed. We won't send you these emails again.</p>
          )}
          {state === "already" && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4" /> This address has already been unsubscribed.</p>
          )}
          {(state === "invalid" || state === "error") && (
            <p className="flex items-center gap-2 text-sm text-rose-700"><AlertCircle className="h-4 w-4" /> {errorMsg || "This link is invalid or has expired."}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
