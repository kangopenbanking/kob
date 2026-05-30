import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { AlertCircle, Clock, MessageSquare, ShieldCheck, X, ArrowRight } from "lucide-react";

type KycStatus = "pending" | "approved" | "rejected" | "info_requested";

interface KycRow {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  updated_at: string;
}

interface Props {
  /** Route the user should be taken to in order to act on the banner. Defaults to /kyc. */
  verifyHref?: string;
}

const DISMISS_KEY = "kyc-banner-dismissed-at";

/**
 * Persistent dashboard-wide KYC status banner.
 * - Shows for unverified, pending, info_requested, and rejected users.
 * - Hides entirely when status is `approved`.
 * - Dismissible per session for non-blocking states (pending/approved-soft);
 *   info_requested and rejected cannot be dismissed.
 */
export const KYCStatusBanner: React.FC<Props> = ({ verifyHref = "/kyc" }) => {
  const { user, loading } = useAuthenticatedUser();
  const [row, setRow] = useState<KycRow | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let cancelled = false;

    const load = async () => {
      const { data } = await supabase
        .from("kyc_verifications")
        .select("id, status, rejection_reason, updated_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) setRow((data as KycRow | null) ?? null);
    };
    load();

    const channel = supabase
      .channel(`kyc-banner-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kyc_verifications", filter: `user_id=eq.${user.id}` },
        load,
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user, loading]);

  // Per-session dismissal for soft states only
  useEffect(() => {
    const ts = sessionStorage.getItem(DISMISS_KEY);
    if (ts) setDismissed(true);
  }, []);

  if (loading || row === undefined || !user) return null;
  if (row?.status === "approved") return null;

  const status: KycStatus | "unverified" = row?.status ?? "unverified";
  const isHard = status === "info_requested" || status === "rejected";
  if (!isHard && dismissed) return null;

  const config = (() => {
    switch (status) {
      case "unverified":
        return {
          icon: ShieldCheck,
          title: "Verify your identity to unlock full access",
          message: "Complete a quick KYC check to enable transfers, withdrawals and higher limits.",
          cta: "Start verification",
          tone: "amber" as const,
        };
      case "pending":
        return {
          icon: Clock,
          title: "Your identity verification is under review",
          message: "Our team is reviewing your documents. You will be notified by email and in-app once a decision is made.",
          cta: "View status",
          tone: "sky" as const,
        };
      case "info_requested":
        return {
          icon: MessageSquare,
          title: "Additional information requested",
          message: row?.rejection_reason || "Our reviewer needs more information. Please open your verification to update your submission.",
          cta: "Update submission",
          tone: "sky" as const,
        };
      case "rejected":
        return {
          icon: AlertCircle,
          title: "Identity verification was not approved",
          message: row?.rejection_reason || "Please review the reason and resubmit your documents to regain full account access.",
          cta: "Resubmit verification",
          tone: "red" as const,
        };
    }
  })();

  if (!config) return null;
  const Icon = config.icon;

  const toneClasses: Record<typeof config.tone, string> = {
    amber: "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
    sky: "border-sky-300 bg-sky-50 text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
    red: "border-red-300 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-950/40 dark:text-red-100",
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`relative border-b px-4 py-3 ${toneClasses[config.tone]}`}
    >
      <div className="mx-auto flex max-w-3xl items-start gap-3">
        <Icon className="mt-0.5 h-5 w-5 shrink-0" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">{config.title}</p>
          <p className="mt-0.5 text-xs leading-snug opacity-90">{config.message}</p>
        </div>
        <Link
          to={verifyHref}
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-current/30 bg-background/60 px-3 py-1.5 text-xs font-semibold hover:bg-background"
        >
          {config.cta}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        {!isHard && (
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => {
              sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
              setDismissed(true);
            }}
            className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
};

export default KYCStatusBanner;
