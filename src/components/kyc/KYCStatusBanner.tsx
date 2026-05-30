import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuthenticatedUser } from "@/hooks/useAuthenticatedUser";
import { AlertCircle, Clock, MessageSquare, ShieldCheck, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type KycStatus = "pending" | "approved" | "rejected" | "info_requested";

interface KycRow {
  id: string;
  status: KycStatus;
  rejection_reason: string | null;
  updated_at: string;
}

interface Props {
  /** Route the user should be taken to in order to act on the banner. Defaults to /kyc-verification. */
  verifyHref?: string;
}

const DISMISS_KEY = "kyc-banner-dismissed-at";

/**
 * Modern KYC status notification card.
 * - Shows for unverified, pending, info_requested, and rejected users.
 * - Hides entirely when status is `approved`.
 * - Dismissible per session for soft states (unverified / pending);
 *   info_requested and rejected cannot be dismissed.
 */
export const KYCStatusBanner: React.FC<Props> = ({ verifyHref = "/kyc-verification" }) => {
  const { user, loading } = useAuthenticatedUser();
  const [row, setRow] = useState<KycRow | null | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);

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

  useEffect(() => {
    const ts = sessionStorage.getItem(DISMISS_KEY);
    if (ts) setDismissed(true);
    const t = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(t);
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
          label: "Action required",
          title: "Verify your identity to unlock full access",
          message: "Complete a quick KYC check to enable transfers, withdrawals and higher limits.",
          cta: "Start verification",
          tone: "warning" as const,
        };
      case "pending":
        return {
          icon: Clock,
          label: "Under review",
          title: "Your identity verification is in progress",
          message: "Our compliance team is reviewing your documents. You will be notified by email and in-app once a decision is made.",
          cta: "View status",
          tone: "info" as const,
        };
      case "info_requested":
        return {
          icon: MessageSquare,
          label: "More information needed",
          title: "Additional information requested",
          message: row?.rejection_reason || "Our reviewer needs more information. Please open your verification to update your submission.",
          cta: "Update submission",
          tone: "info" as const,
        };
      case "rejected":
        return {
          icon: AlertCircle,
          label: "Not approved",
          title: "Identity verification was not approved",
          message: row?.rejection_reason || "Please review the reason and resubmit your documents to regain full account access.",
          cta: "Resubmit verification",
          tone: "danger" as const,
        };
    }
  })();

  if (!config) return null;
  const Icon = config.icon;

  // Semantic, theme-aware tones. No gradients.
  const toneClasses: Record<typeof config.tone, {
    card: string;
    iconWrap: string;
    pill: string;
    accent: string;
  }> = {
    warning: {
      card: "border-amber-200/70 bg-amber-50/80 dark:border-amber-900/50 dark:bg-amber-950/30",
      iconWrap: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200",
      pill: "bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-100",
      accent: "before:bg-amber-500",
    },
    info: {
      card: "border-sky-200/70 bg-sky-50/80 dark:border-sky-900/50 dark:bg-sky-950/30",
      iconWrap: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200",
      pill: "bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-100",
      accent: "before:bg-sky-500",
    },
    danger: {
      card: "border-red-200/70 bg-red-50/80 dark:border-red-900/50 dark:bg-red-950/30",
      iconWrap: "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-200",
      pill: "bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-100",
      accent: "before:bg-red-500",
    },
  };

  const tone = toneClasses[config.tone];

  return (
    <div className="px-3 pt-3 sm:px-4 sm:pt-4">
      <div
        role="status"
        aria-live="polite"
        className={[
          "relative overflow-hidden rounded-2xl border backdrop-blur-sm shadow-sm",
          "transition-all duration-500 ease-out",
          mounted ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0",
          "before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-l-2xl",
          tone.card,
          tone.accent,
        ].join(" ")}
      >
        <div className="flex items-start gap-3 p-4 pl-5 sm:gap-4 sm:p-5 sm:pl-6">
          <div
            className={[
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
              "ring-1 ring-inset ring-current/10",
              tone.iconWrap,
            ].join(" ")}
            aria-hidden="true"
          >
            <Icon className="h-5 w-5" strokeWidth={1.75} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  tone.pill,
                ].join(" ")}
              >
                {config.label}
              </span>
              <span className="text-[11px] font-medium text-muted-foreground">
                Identity verification
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold leading-snug text-foreground">
              {config.title}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground sm:text-[13px]">
              {config.message}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button asChild size="sm" variant="default" className="h-9 rounded-full px-4">
                <Link to={verifyHref} aria-label={config.cta}>
                  {config.cta}
                  <ArrowRight className="ml-1.5 h-3.5 w-3.5" strokeWidth={2} />
                </Link>
              </Button>
              {!isHard && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
                    setDismissed(true);
                  }}
                  className="h-9 rounded-full px-3 text-xs text-muted-foreground hover:text-foreground"
                >
                  Remind me later
                </Button>
              )}
            </div>
          </div>

          {!isHard && (
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => {
                sessionStorage.setItem(DISMISS_KEY, String(Date.now()));
                setDismissed(true);
              }}
              className="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground/70 transition-colors hover:bg-background/60 hover:text-foreground"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default KYCStatusBanner;
