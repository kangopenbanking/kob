import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, ShieldCheck, FileText, Camera, MapPin, CheckCircle2, AlertCircle, ChevronRight, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { submitIdentityKyc } from "@/lib/kycGateway";
import { extractEdgeFunctionError } from "@/lib/edge-function-error";

interface KycStatus {
  level: number | null;
  status: string | null;
  document_status?: string | null;
  selfie_status?: string | null;
  address_status?: string | null;
}

const STEPS = [
  { id: "document", label: "Identity document", desc: "National ID, passport or driver's license", icon: FileText, href: "/kyc-verification?step=document" },
  { id: "selfie", label: "Selfie verification", desc: "Take a quick selfie to match your ID", icon: Camera, href: "/kyc-verification?step=selfie" },
  { id: "address", label: "Proof of address", desc: "Utility bill or bank statement", icon: MapPin, href: "/kyc-verification?step=address" },
];

const statusBadge = (s?: string | null) => {
  if (s === "approved" || s === "verified") return <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Verified</Badge>;
  if (s === "pending" || s === "submitted") return <Badge variant="secondary">In review</Badge>;
  if (s === "rejected") return <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />Rejected</Badge>;
  return <Badge variant="outline">Not started</Badge>;
};

export default function CustomerKYCWizard() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [kyc, setKyc] = useState<KycStatus | null>(null);

  const startDidit = async () => {
    setLaunching(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please sign in first."); return; }
      const fallbackExpiry = new Date();
      fallbackExpiry.setFullYear(fallbackExpiry.getFullYear() + 5);
      const resp = await submitIdentityKyc({
        verification_type: "identity",
        document_type: "national_id",
        document_number: "PENDING",
        document_country: "CM",
        document_expiry_date: fallbackExpiry.toISOString().slice(0, 10),
        document_front_url: "",
        selfie_url: "",
        source_app: "customer_app",
      });
      if (resp.provider === "didit") {
        toast.success("Verification launched — complete the steps in the Didit window.");
      } else {
        // Provider fell back to manual — send user to the manual upload flow.
        toast.message("Redirecting to manual verification…");
        nav("/kyc-verification");
      }
    } catch (err: any) {
      toast.error(extractEdgeFunctionError(err, "Could not start verification"));
    } finally {
      setLaunching(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      // Source of truth: kyc_verifications (latest identity record)
      const { data: rows } = await (supabase.from("kyc_verifications") as any)
        .select("status, verification_type, document_front_url, selfie_url, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(5);
      const identity = (rows || []).find((r: any) => (r.verification_type ?? "identity") === "identity") || (rows || [])[0];
      const st = identity?.status ?? null;
      const approved = st === "approved" || st === "verified";
      setKyc({
        level: approved ? 2 : st ? 1 : 0,
        status: st,
        document_status: identity?.document_front_url ? st : null,
        selfie_status: identity?.selfie_url ? st : null,
        address_status: null,
      });
      setLoading(false);
    };
    load();
    // Realtime refresh when admin approves/rejects
    let channel: any;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      channel = supabase
        .channel(`kyc-wizard-${user.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "kyc_verifications", filter: `user_id=eq.${user.id}` }, () => load())
        .subscribe();
    })();
    return () => { if (channel) supabase.removeChannel(channel); };
  }, []);

  const stepStatus = (id: string) =>
    id === "document" ? kyc?.document_status : id === "selfie" ? kyc?.selfie_status : kyc?.address_status;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => nav(-1)} className="rounded-full p-2 hover:bg-muted" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Identity Verification</h1>
          <p className="text-xs text-muted-foreground">Unlock higher limits and full features</p>
        </div>
      </header>

      <div className="space-y-4 p-4">
        <Card className="border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-foreground">Verification status</p>
                {statusBadge(kyc?.status)}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Level {kyc?.level ?? 0} of 3 — complete all steps below to reach full verification.
              </p>
            </div>
          </div>
        </Card>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {STEPS.map(s => {
              const Icon = s.icon;
              const st = stepStatus(s.id);
              return (
                <Link key={s.id} to={s.href}>
                  <Card className="border-border bg-card p-4 transition-colors hover:bg-muted/40">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted">
                        <Icon className="h-5 w-5 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-foreground">{s.label}</p>
                          {statusBadge(st)}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Card>
                </Link>
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

        <Button variant="outline" className="w-full" onClick={() => nav("/app/help")}>
          Need help with verification?
        </Button>
      </div>
    </div>
  );
}
