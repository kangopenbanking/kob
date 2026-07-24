/**
 * Customer KYC Resume flow
 *
 * Deep-links a user back into their existing Didit verification session after
 * an interruption. Never bypasses the unified-kyc-gateway: it re-invokes the
 * gateway which returns the same-or-fresh Didit verification_url and launches
 * the Didit SDK modal exactly like the initial flow.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { submitIdentityKyc, openDiditVerification } from "@/lib/kycGateway";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";
import { format } from "date-fns";

interface LastVerification {
  id: string;
  status: string;
  didit_session_id: string | null;
  updated_at: string | null;
  rejection_reason: string | null;
  document_country: string | null;
  document_type: string | null;
}

const STATUS_META: Record<string, { label: string; tone: "default" | "secondary" | "destructive" | "outline" }> = {
  approved: { label: "Verified", tone: "default" },
  pending: { label: "In progress", tone: "secondary" },
  manual_review: { label: "Manual review", tone: "secondary" },
  rejected: { label: "Rejected", tone: "destructive" },
  requires_resubmission: { label: "Action required", tone: "destructive" },
};

export default function CustomerKYCResume() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [resuming, setResuming] = useState(false);
  const [record, setRecord] = useState<LastVerification | null>(null);

  const loadLatest = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/app/auth", { replace: true });
        return;
      }
      const { data, error } = await supabase
        .from("kyc_verifications")
        .select("id,status,didit_session_id,updated_at,rejection_reason,document_country,document_type")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setRecord(data as LastVerification | null);
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Could not load verification"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLatest(); }, []);

  const handleResume = async () => {
    setResuming(true);
    try {
      // Re-invoke the gateway. It re-uses an existing pending Didit session
      // when possible. Do NOT send document metadata — Didit collects it
      // inside its own hosted flow. This prevents any re-collection.
      const resp = await submitIdentityKyc({
        verification_type: "identity",
        source_app: "customer_app_resume",
      });
      if (resp.verification_url) {
        toast.success("Resuming your Didit verification");
        await openDiditVerification(resp.verification_url);
      } else if (resp.provider === "didit") {
        toast.success("Didit session re-opened");
      } else {
        toast.info("Continuing verification with the fallback provider");
      }
      await loadLatest();
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Could not resume verification"));
    } finally {
      setResuming(false);
    }
  };

  const meta = record ? STATUS_META[record.status] ?? { label: record.status, tone: "outline" as const } : null;
  const canResume = !record || ["pending", "manual_review", "requires_resubmission", "rejected"].includes(record.status);

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">Resume verification</h1>
      </div>

      <div className="mx-auto max-w-lg space-y-4 p-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="rounded-full border p-2">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Didit identity verification</CardTitle>
              <p className="text-sm text-muted-foreground">
                Pick up exactly where you left off. Your progress is preserved.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading your verification…
              </div>
            ) : record ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Current status</span>
                  {meta && <Badge variant={meta.tone}>{meta.label}</Badge>}
                </div>
                {record.didit_session_id && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Session ID</span>
                    <code className="rounded bg-muted px-2 py-0.5 text-xs">
                      {record.didit_session_id.slice(0, 12)}…
                    </code>
                  </div>
                )}
                {record.updated_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Last update</span>
                    <span>{format(new Date(record.updated_at), "PP p")}</span>
                  </div>
                )}
                {record.rejection_reason && (
                  <div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
                    <span>{record.rejection_reason}</span>
                  </div>
                )}
                {record.status === "approved" && (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Your identity is verified. No further action needed.
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                We could not find an existing verification. Start a new one to unlock credit checks and higher limits.
              </p>
            )}

            <div className="flex flex-col gap-2 pt-2">
              <Button
                onClick={handleResume}
                disabled={!canResume || resuming}
                className="w-full"
              >
                {resuming ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Opening Didit…</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" /> Resume with Didit</>
                )}
              </Button>
              <Button variant="ghost" onClick={() => navigate("/app/home")} className="w-full">
                Back to home
              </Button>
            </div>

            <p className="pt-2 text-xs text-muted-foreground">
              Resuming re-opens your session through the KOB unified KYC gateway. Didit
              remains the primary provider — the gateway only falls back to the
              self-hosted flow if Didit is unavailable.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
