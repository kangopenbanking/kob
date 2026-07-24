import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  ShieldCheck,
  FileText,
  Camera,
  MapPin,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { submitIdentityKyc, openDiditVerification } from "@/lib/kycGateway";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

interface KycRow {
  id: string;
  status: string | null;
  verification_method: string | null;
  didit_session_id: string | null;
  metadata: Record<string, unknown> | null;
  updated_at: string | null;
  verified_at: string | null;
  rejection_reason: string | null;
}

const STEPS = [
  {
    id: "document",
    label: "Identity document",
    desc: "National ID, passport or driver's licence — captured in the Didit hosted flow",
    icon: FileText,
  },
  {
    id: "selfie",
    label: "Selfie & liveness",
    desc: "Live selfie matched to your document by Didit",
    icon: Camera,
  },
  {
    id: "address",
    label: "Proof of address",
    desc: "Utility bill or bank statement uploaded inside Didit",
    icon: MapPin,
  },
];

const statusBadge = (s?: string | null) => {
  if (s === "approved" || s === "verified")
    return (
      <Badge variant="default" className="gap-1">
        <CheckCircle2 className="h-3 w-3" />
        Verified
      </Badge>
    );
  if (s === "pending" || s === "submitted" || s === "manual_review")
    return <Badge variant="secondary">In review</Badge>;
  if (s === "rejected" || s === "requires_resubmission")
    return (
      <Badge variant="destructive" className="gap-1">
        <AlertCircle className="h-3 w-3" />
        Action needed
      </Badge>
    );
  return <Badge variant="outline">Not started</Badge>;
};

export default function CustomerKYCWizard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [kyc, setKyc] = useState<KycRow | null>(null);

  const load = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      nav("/app/auth", { replace: true });
      return;
    }
    const { data } = await (supabase.from("kyc_verifications") as any)
      .select(
        "id, status, verification_method, didit_session_id, metadata, updated_at, verified_at, rejection_reason",
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setKyc((data as KycRow) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    load();
    let channel: any;
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`kyc-wizard-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kyc_verifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => load(),
        )
        .subscribe();
    })();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isApproved =
    kyc?.status === "approved" || kyc?.status === "verified";
  const isInReview =
    kyc?.status === "pending" ||
    kyc?.status === "submitted" ||
    kyc?.status === "manual_review";

  const startOrResumeDidit = async () => {
    if (isApproved) return;
    setLaunching(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Please sign in first.");
        return;
      }

      // If a pending Didit session already exists, resume it instead of
      // creating a new record — no re-collection of any document data.
      if (isInReview && kyc?.didit_session_id) {
        nav("/app/kyc/resume");
        return;
      }

      // Delegate everything to Didit. Do NOT send placeholder document
      // metadata — Didit collects it inside the hosted workflow.
      const resp = await submitIdentityKyc({
        verification_type: "identity",
        source_app: "customer_app",
      });

      if (resp.provider === "didit" && resp.verification_url) {
        toast.success("Opening Didit verification…");
        await openDiditVerification(resp.verification_url);
        await load();
        return;
      }

      // Provider fell back — take the user to the manual upload page.
      toast.message("Didit is unavailable — continuing with manual verification.");
      nav("/kyc-verification");
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Could not start verification"));
    } finally {
      setLaunching(false);
    }
  };

  // A single Didit workflow covers every step in STEPS. Once approved, all
  // three sub-steps inherit the "verified" status. In review = all pending.
  const stepStatus = (_id: string) => {
    if (isApproved) return "approved";
    if (kyc?.status === "rejected" || kyc?.status === "requires_resubmission")
      return kyc.status;
    if (isInReview) return "pending";
    return null;
  };

  const primaryLabel = launching
    ? "Launching…"
    : isApproved
      ? "Verification complete"
      : isInReview
        ? "Resume with Didit"
        : "Start verification with Didit";

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => nav(-1)}
          className="rounded-full p-2 hover:bg-muted"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">Identity Verification</h1>
          <p className="truncate text-xs text-muted-foreground">
            Powered by Didit — one flow, no re-uploads
          </p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <Card className="border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Verification status</p>
                {statusBadge(kyc?.status)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isApproved
                  ? "You are fully verified. You will not be asked for these details again."
                  : isInReview
                    ? "Your verification is being processed by Didit. You can safely resume the session below."
                    : "Complete a single Didit session to satisfy identity, selfie and address checks."}
              </p>
            </div>
          </div>
        </Card>

        {(kyc?.status === "rejected" || kyc?.status === "requires_resubmission") && kyc?.rejection_reason && (
          <Card className="border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">Verification not approved</p>
                <p className="mt-1 text-xs text-muted-foreground">{kyc.rejection_reason}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Retry with Didit below — no need to re-enter details we already have.
                </p>
              </div>
            </div>
          </Card>
        )}

        {isApproved && kyc?.verified_at && (
          <Card className="border-emerald-500/30 bg-emerald-500/5 p-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">You are fully verified</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Approved on {new Date(kyc.verified_at).toLocaleDateString()}. All Didit checks passed.
                </p>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map((s) => {
              const Icon = s.icon;
              const st = stepStatus(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={startOrResumeDidit}
                  disabled={isApproved || launching}
                  className="block w-full text-left"
                >
                  <Card className="border-border bg-card p-4 transition-colors hover:bg-muted/40 disabled:opacity-70">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {s.label}
                          </p>
                          {statusBadge(st)}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </Card>
                </button>
              );
            })}
          </div>
        )}

        <Card className="border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold text-foreground">Why verify?</p>
          <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground">
            <li>· Send larger transfers and receive higher limits</li>
            <li>· Required for international remittances and card issuance</li>
            <li>· Protects your account from fraud</li>
          </ul>
        </Card>

        <Button
          className="w-full"
          size="lg"
          onClick={startOrResumeDidit}
          disabled={launching || isApproved}
        >
          {launching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" strokeWidth={1.5} />
              Launching…
            </>
          ) : isInReview ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
              {primaryLabel}
            </>
          ) : (
            primaryLabel
          )}
        </Button>

        {!isApproved && (
          <Button
            variant="ghost"
            className="w-full"
            onClick={() => load()}
            disabled={loading}
          >
            <RefreshCw className="mr-2 h-4 w-4" strokeWidth={1.5} />
            Refresh status
          </Button>
        )}

        <Button variant="outline" className="w-full" onClick={() => nav("/app/help")}>
          Need help with verification?
        </Button>
      </div>
    </div>
  );
}
